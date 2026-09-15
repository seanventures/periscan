package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func TestProcessTaskRunsReachabilityForSignedInScopeTask(t *testing.T) {
	privateKey, publicKeyPEM := testSigningKey(t)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer listener.Close()
	go func() {
		conn, _ := listener.Accept()
		if conn != nil {
			_ = conn.Close()
		}
	}()

	port := listener.Addr().(*net.TCPAddr).Port
	task := signedTask(t, privateKey, map[string]interface{}{
		"ports":          []interface{}{float64(port)},
		"timeoutSeconds": float64(1),
	}, map[string]interface{}{
		"hostname": "127.0.0.1",
	}, scopeConstraints{
		ApprovedCIDRs:        []string{"127.0.0.0/8"},
		ApprovedDNSSuffixes:  []string{},
		ApprovedHostnames:    []string{},
		ApprovedPorts:        []int{port},
		ForbidInternetEgress: true,
	})

	result := processTask(task, runnerConfig{
		runnerID:         task.RunnerID,
		signingKeyID:     "test-key",
		signingPublicKey: publicKeyPEM,
		tenantID:         task.TenantID,
	})

	if result.Status != "Completed" {
		t.Fatalf("expected completed result, got %s: %v", result.Status, result.ErrorSummary)
	}
	if result.Outcome == nil || *result.Outcome != "reachable" {
		t.Fatalf("expected reachable outcome, got %v", result.Outcome)
	}
	if result.ValidationState == nil || *result.ValidationState != "Reachable" {
		t.Fatalf("expected Reachable validation state, got %v", result.ValidationState)
	}
	if len(result.EvidenceManifest) != 1 {
		t.Fatalf("expected one evidence item, got %d", len(result.EvidenceManifest))
	}
}

func TestGenerateRunnerCSRProducesValidPemShape(t *testing.T) {
	csrPem, privateKeyPem, err := generateRunnerCSR(runnerConfig{
		hostname:   "runner.internal",
		runnerName: "test-runner",
	})
	if err != nil {
		t.Fatalf("generate csr: %v", err)
	}
	if !strings.HasPrefix(csrPem, "-----BEGIN CERTIFICATE REQUEST-----") {
		t.Fatalf("expected csr begin marker, got %q", csrPem)
	}
	if !strings.HasSuffix(csrPem, "-----END CERTIFICATE REQUEST-----\n") {
		t.Fatalf("expected csr end marker, got %q", csrPem)
	}
	if !strings.HasPrefix(privateKeyPem, "-----BEGIN RSA PRIVATE KEY-----") {
		t.Fatalf("expected private key begin marker, got %q", privateKeyPem)
	}
	if !strings.HasSuffix(privateKeyPem, "-----END RSA PRIVATE KEY-----\n") {
		t.Fatalf("expected private key end marker, got %q", privateKeyPem)
	}
}

func TestProcessTaskRejectsInvalidSignature(t *testing.T) {
	privateKey, publicKeyPEM := testSigningKey(t)
	task := signedTask(t, privateKey, map[string]interface{}{
		"ports": []interface{}{float64(443)},
	}, map[string]interface{}{
		"hostname": "app.internal",
	}, scopeConstraints{
		ApprovedHostnames: []string{"app.internal"},
		ApprovedPorts:     []int{443},
	})
	task.Signature.Signature = "not-valid-base64url!"

	result := processTask(task, runnerConfig{
		runnerID:         task.RunnerID,
		signingKeyID:     "test-key",
		signingPublicKey: publicKeyPEM,
		tenantID:         task.TenantID,
	})

	if result.Status != "Failed" {
		t.Fatalf("expected failed result, got %s", result.Status)
	}
	if result.ErrorSummary == nil {
		t.Fatal("expected error summary for invalid signature")
	}
}

func TestProcessTaskRejectsOutOfScopeHostBeforeExecution(t *testing.T) {
	privateKey, publicKeyPEM := testSigningKey(t)
	task := signedTask(t, privateKey, map[string]interface{}{
		"ports": []interface{}{float64(443)},
	}, map[string]interface{}{
		"hostname": "evil.internal",
	}, scopeConstraints{
		ApprovedDNSSuffixes: []string{"corp.internal"},
		ApprovedPorts:       []int{443},
	})

	result := processTask(task, runnerConfig{
		runnerID:         task.RunnerID,
		signingKeyID:     "test-key",
		signingPublicKey: publicKeyPEM,
		tenantID:         task.TenantID,
	})

	if result.Status != "Failed" {
		t.Fatalf("expected failed result, got %s", result.Status)
	}
	if result.ErrorSummary == nil || !strings.Contains(*result.ErrorSummary, "outside approved runner scope") {
		t.Fatalf("expected scope error, got %v", result.ErrorSummary)
	}
}

func TestProcessTaskRejectsExpiredTask(t *testing.T) {
	privateKey, publicKeyPEM := testSigningKey(t)
	task := signedTask(t, privateKey, map[string]interface{}{
		"ports": []interface{}{float64(443)},
	}, map[string]interface{}{
		"hostname": "app.internal",
	}, scopeConstraints{
		ApprovedHostnames: []string{"app.internal"},
		ApprovedPorts:     []int{443},
	})
	task.ExpiresAt = time.Now().UTC().Add(-time.Minute).Format(time.RFC3339Nano)
	task = resignTask(t, task, privateKey)

	result := processTask(task, runnerConfig{
		runnerID:         task.RunnerID,
		signingKeyID:     "test-key",
		signingPublicKey: publicKeyPEM,
		tenantID:         task.TenantID,
	})

	if result.Status != "Failed" {
		t.Fatalf("expected failed result, got %s", result.Status)
	}
	if result.ErrorSummary == nil || !strings.Contains(*result.ErrorSummary, "expired") {
		t.Fatalf("expected expiry error, got %v", result.ErrorSummary)
	}
}

func TestCreateHTTPClientUsesExplicitProxyURL(t *testing.T) {
	client, err := createHTTPClient(runnerConfig{
		apiBaseURL:        "https://runner.periscan.example",
		controlPlaneProxy: "http://127.0.0.1:8080",
	})
	if err != nil {
		t.Fatalf("createHTTPClient: %v", err)
	}
	transport, ok := client.Transport.(*http.Transport)
	if !ok || transport.Proxy == nil {
		t.Fatal("expected transport with proxy function")
	}

	req, err := http.NewRequest(http.MethodGet, "https://runner.periscan.example", nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	proxy, err := transport.Proxy(req)
	if err != nil {
		t.Fatalf("proxy lookup: %v", err)
	}
	if proxy == nil {
		t.Fatal("explicit proxy must be set")
	}
	if got := proxy.Host; got != "127.0.0.1:8080" {
		t.Fatalf("expected explicit proxy host 127.0.0.1:8080, got %s", got)
	}
}

func TestCreateHTTPClientUsesEnvironmentProxyWhenNoExplicitConfigured(t *testing.T) {
	oldHTTPS := os.Getenv("HTTPS_PROXY")
	oldHTTP := os.Getenv("HTTP_PROXY")
	os.Setenv("HTTPS_PROXY", "http://127.0.0.1:8888")
	os.Setenv("HTTP_PROXY", "")
	defer func() {
		_ = os.Setenv("HTTPS_PROXY", oldHTTPS)
		_ = os.Setenv("HTTP_PROXY", oldHTTP)
	}()

	client, err := createHTTPClient(runnerConfig{
		apiBaseURL: "https://runner.periscan.example",
	})
	if err != nil {
		t.Fatalf("createHTTPClient: %v", err)
	}
	transport := client.Transport.(*http.Transport)
	req, err := http.NewRequest(http.MethodGet, "https://runner.periscan.example", nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	proxy, err := transport.Proxy(req)
	if err != nil {
		t.Fatalf("proxy lookup: %v", err)
	}
	if proxy == nil {
		t.Fatal("expected proxy from env")
	}
	if proxy.Host != "127.0.0.1:8888" {
		t.Fatalf("expected HTTPS_PROXY host 127.0.0.1:8888, got %s", proxy.Host)
	}
}

func TestCreateHTTPClientRejectsInvalidExplicitProxy(t *testing.T) {
	if _, err := createHTTPClient(runnerConfig{
		apiBaseURL:        "https://runner.periscan.example",
		controlPlaneProxy: "::bad",
	}); err == nil {
		t.Fatal("expected invalid proxy URL error")
	}
}

func TestCreateHTTPClientRequiresMtlsCertificateAndKeyPair(t *testing.T) {
	if _, err := createHTTPClient(runnerConfig{
		apiBaseURL:   "https://runner.periscan.example",
		mtlsCertFile: "runner.crt",
	}); err == nil {
		t.Fatal("expected missing mTLS key error")
	}
	if _, err := createHTTPClient(runnerConfig{
		apiBaseURL:  "https://runner.periscan.example",
		mtlsKeyFile: "runner.key",
	}); err == nil {
		t.Fatal("expected missing mTLS certificate error")
	}
}

func TestProcessTaskRejectsTenantMismatch(t *testing.T) {
	privateKey, publicKeyPEM := testSigningKey(t)
	task := signedTask(t, privateKey, map[string]interface{}{
		"ports": []interface{}{float64(443)},
	}, map[string]interface{}{
		"hostname": "app.internal",
	}, scopeConstraints{
		ApprovedHostnames: []string{"app.internal"},
		ApprovedPorts:     []int{443},
	})

	result := processTask(task, runnerConfig{
		runnerID:         task.RunnerID,
		signingKeyID:     "test-key",
		signingPublicKey: publicKeyPEM,
		tenantID:         "99999999-9999-4999-8999-999999999999",
	})

	if result.Status != "Failed" {
		t.Fatalf("expected failed result, got %s", result.Status)
	}
	if result.ErrorSummary == nil || !strings.Contains(*result.ErrorSummary, "tenantId mismatch") {
		t.Fatalf("expected tenant mismatch error, got %v", result.ErrorSummary)
	}
}

func TestProcessTaskRejectsSigningKeyIdMismatch(t *testing.T) {
	privateKey, publicKeyPEM := testSigningKey(t)
	task := signedTask(t, privateKey, map[string]interface{}{
		"ports": []interface{}{float64(443)},
	}, map[string]interface{}{
		"hostname": "app.internal",
	}, scopeConstraints{
		ApprovedHostnames: []string{"app.internal"},
		ApprovedPorts:     []int{443},
	})

	result := processTask(task, runnerConfig{
		runnerID:         task.RunnerID,
		signingKeyID:     "different-key",
		signingPublicKey: publicKeyPEM,
		tenantID:         task.TenantID,
	})

	if result.Status != "Failed" {
		t.Fatalf("expected failed result, got %s", result.Status)
	}
	if result.ErrorSummary == nil || !strings.Contains(*result.ErrorSummary, "keyId mismatch") {
		t.Fatalf("expected keyId mismatch error, got %v", result.ErrorSummary)
	}
}

func TestInsecureSkipVerifyRequiresBootstrapMode(t *testing.T) {
	oldBootstrap := os.Getenv("PERISCAN_RUNNER_BOOTSTRAP_MODE")
	_ = os.Setenv("PERISCAN_RUNNER_BOOTSTRAP_MODE", "")
	defer func() {
		_ = os.Setenv("PERISCAN_RUNNER_BOOTSTRAP_MODE", oldBootstrap)
	}()

	client, err := createHTTPClient(runnerConfig{
		apiBaseURL:         "https://runner.periscan.example",
		insecureSkipVerify: false,
	})
	if err != nil {
		t.Fatalf("createHTTPClient: %v", err)
	}
	transport := client.Transport.(*http.Transport)
	if transport.TLSClientConfig != nil {
		t.Fatal("expected default TLS verification without bootstrap mode")
	}

	_ = os.Setenv("PERISCAN_RUNNER_BOOTSTRAP_MODE", "true")
	client, err = createHTTPClient(runnerConfig{
		apiBaseURL:         "https://runner.periscan.example",
		bootstrapMode:      true,
		insecureSkipVerify: true,
	})
	if err != nil {
		t.Fatalf("createHTTPClient bootstrap: %v", err)
	}
	transport = client.Transport.(*http.Transport)
	if transport.TLSClientConfig == nil || !transport.TLSClientConfig.InsecureSkipVerify {
		t.Fatal("expected insecure skip verify only in bootstrap mode")
	}
}

func TestExtractCommandSupportsSubcommandBeforeFlags(t *testing.T) {
	command, args := extractCommand([]string{
		"periscan-runner",
		"poll",
		"--api",
		"https://api.periscan.test",
	})

	if command != "poll" {
		t.Fatalf("expected poll command, got %q", command)
	}
	if strings.Join(args, " ") != "periscan-runner --api https://api.periscan.test" {
		t.Fatalf("unexpected filtered args: %v", args)
	}
}

func TestBoundedPollDelayClampsServerValues(t *testing.T) {
	if got := boundedPollDelay(0); got != 15*time.Second {
		t.Fatalf("expected default poll delay, got %s", got)
	}
	if got := boundedPollDelay(10); got != 10*time.Second {
		t.Fatalf("expected server poll delay, got %s", got)
	}
	if got := boundedPollDelay(600); got != 300*time.Second {
		t.Fatalf("expected clamped poll delay, got %s", got)
	}
}

func TestPostJSONReturnsStatusError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.WriteHeader(http.StatusForbidden)
		_, _ = response.Write([]byte(`{"error":"revoked"}`))
	}))
	defer server.Close()

	err := postJSON(server.Client(), server.URL, "runner-token", map[string]string{"ok": "false"}, nil)
	if err == nil {
		t.Fatal("expected API status error")
	}
	var statusErr apiStatusError
	if !errors.As(err, &statusErr) {
		t.Fatalf("expected apiStatusError, got %T", err)
	}
	if statusErr.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", statusErr.StatusCode)
	}
}

func TestUploadTaskEvidenceUpdatesResultManifest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") != "Bearer runner-token" {
			t.Fatalf("missing runner authorization header")
		}
		response.Header().Set("Content-Type", "application/json")
		_, _ = response.Write([]byte(`{"artifact":{"evidenceId":"77777777-7777-4777-8777-777777777777","redactionStatus":"Redacted","sha256":"stored-sha"}}`))
	}))
	defer server.Close()

	task := taskEnvelope{
		ArtifactUpload: map[string]interface{}{
			"artifactUploadUrl": server.URL,
		},
		TaskID: "66666666-6666-4666-8666-666666666666",
	}
	processed := processedTaskResult{
		EvidenceUploads: []runnerEvidenceUpload{
			{
				ArtifactType: "NormalizedEvidence",
				Content:      []byte(`{"ok":true}`),
				ContentType:  "application/json",
				Filename:     "reachability-result",
				SHA256:       sha256Hex([]byte(`{"ok":true}`)),
				SizeBytes:    len([]byte(`{"ok":true}`)),
			},
		},
		Result: taskResult{
			EvidenceManifest: []evidenceManifestItem{
				{
					ArtifactType:    "NormalizedEvidence",
					RedactionStatus: "Redacted",
					SHA256:          sha256Hex([]byte(`{"ok":true}`)),
					SizeBytes:       len([]byte(`{"ok":true}`)),
				},
			},
			Status: "Completed",
		},
	}

	result := uploadTaskEvidence(
		server.Client(),
		runnerConfig{authToken: "runner-token"},
		task,
		processed,
	)

	if result.Status != "Completed" {
		t.Fatalf("expected completed result, got %s", result.Status)
	}
	if result.EvidenceManifest[0].EvidenceID != "77777777-7777-4777-8777-777777777777" {
		t.Fatalf("expected uploaded evidence id, got %q", result.EvidenceManifest[0].EvidenceID)
	}
	if result.EvidenceManifest[0].SHA256 != "stored-sha" {
		t.Fatalf("expected stored evidence hash, got %q", result.EvidenceManifest[0].SHA256)
	}
}

func TestUploadTaskEvidenceFailureMarksResultFailed(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.WriteHeader(http.StatusInternalServerError)
		_, _ = response.Write([]byte(`{"error":"store unavailable"}`))
	}))
	defer server.Close()

	result := uploadTaskEvidence(
		server.Client(),
		runnerConfig{authToken: "runner-token"},
		taskEnvelope{
			ArtifactUpload: map[string]interface{}{
				"artifactUploadUrl": server.URL,
			},
			TaskID: "66666666-6666-4666-8666-666666666666",
		},
		processedTaskResult{
			EvidenceUploads: []runnerEvidenceUpload{
				{
					ArtifactType: "NormalizedEvidence",
					Content:      []byte(`{"ok":true}`),
					ContentType:  "application/json",
					Filename:     "reachability-result",
					SHA256:       sha256Hex([]byte(`{"ok":true}`)),
					SizeBytes:    len([]byte(`{"ok":true}`)),
				},
			},
			Result: taskResult{
				Status: "Completed",
			},
		},
	)

	if result.Status != "Failed" {
		t.Fatalf("expected failed result after upload failure, got %s", result.Status)
	}
	if result.ErrorSummary == nil || !strings.Contains(*result.ErrorSummary, "evidence upload failed") {
		t.Fatalf("expected upload error summary, got %v", result.ErrorSummary)
	}
}

func TestRunnerLocalLabInternalChecksE2E(t *testing.T) {
	privateKey, publicKeyPEM := testSigningKey(t)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer listener.Close()
	go func() {
		conn, _ := listener.Accept()
		if conn != nil {
			_ = conn.Close()
		}
	}()

	// Dedicated banner listener that emits a greeting (for tcp_banner_check lab test)
	bannerListener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("banner listen: %v", err)
	}
	defer bannerListener.Close()
	go func() {
		for {
			conn, acceptErr := bannerListener.Accept()
			if acceptErr != nil {
				return
			}
			if conn != nil {
				_, _ = conn.Write([]byte("220 banner-test.internal ESMTP\r\n"))
				_ = conn.Close()
			}
		}
	}()

	httpServer := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/healthz" {
			t.Fatalf("unexpected health path: %s", request.URL.Path)
		}
		response.WriteHeader(http.StatusNoContent)
	}))
	defer httpServer.Close()

	tlsServer := httptest.NewTLSServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.WriteHeader(http.StatusOK)
	}))
	defer tlsServer.Close()

	uploadsByFilename := map[string]int{}
	uploadServer := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") != "Bearer runner-token" {
			t.Fatalf("missing runner authorization header")
		}
		var payload artifactUploadRequest
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			t.Fatalf("decode upload payload: %v", err)
		}
		if payload.ArtifactType != "NormalizedEvidence" || payload.SizeBytes == 0 || payload.ContentBase64 == "" {
			t.Fatalf("unexpected upload payload: %+v", payload)
		}
		uploadsByFilename[payload.Filename]++
		response.Header().Set("Content-Type", "application/json")
		_, _ = response.Write([]byte(`{"artifact":{"evidenceId":"77777777-7777-4777-8777-777777777777","redactionStatus":"Redacted","sha256":"stored-lab-sha"}}`))
	}))
	defer uploadServer.Close()

	runnerCfg := runnerConfig{
		runnerID:         "22222222-2222-4222-8222-222222222222",
		signingKeyID:     "test-key",
		signingPublicKey: publicKeyPEM,
		tenantID:         "11111111-1111-4111-8111-111111111111",
	}

	reachabilityPort := listener.Addr().(*net.TCPAddr).Port
	bannerPort := bannerListener.Addr().(*net.TCPAddr).Port
	httpPort := httpServer.Listener.Addr().(*net.TCPAddr).Port
	tlsPort := tlsServer.Listener.Addr().(*net.TCPAddr).Port

	labTasks := []struct {
		moduleID        string
		safetyLevel     string
		taskID          string
		inputs          map[string]interface{}
		target          map[string]interface{}
		scope           scopeConstraints
		expectedOutcome string
		expectedFile    string
	}{
		{
			moduleID:    reachabilityModuleID,
			safetyLevel: "ActiveNonInvasive",
			taskID:      "66666666-6666-4666-8666-666666666661",
			inputs: map[string]interface{}{
				"ports":          []interface{}{float64(reachabilityPort)},
				"timeoutSeconds": float64(1),
			},
			target: map[string]interface{}{
				"hostname": "127.0.0.1",
			},
			scope: scopeConstraints{
				ApprovedCIDRs:        []string{"127.0.0.0/8"},
				ApprovedPorts:        []int{reachabilityPort},
				ForbidInternetEgress: true,
			},
			expectedOutcome: "reachable",
			expectedFile:    "reachability-result",
		},
		{
			moduleID:    dnsResolutionModuleID,
			safetyLevel: "PassiveReadOnly",
			taskID:      "66666666-6666-4666-8666-666666666662",
			inputs: map[string]interface{}{
				"timeoutSeconds": float64(2),
			},
			target: map[string]interface{}{
				"hostname": "localhost",
			},
			scope: scopeConstraints{
				ApprovedHostnames:    []string{"localhost"},
				ForbidInternetEgress: true,
			},
			expectedOutcome: "resolved",
			expectedFile:    "dns-resolution-result",
		},
		{
			moduleID:    tlsCertificateModuleID,
			safetyLevel: "PassiveReadOnly",
			taskID:      "66666666-6666-4666-8666-666666666663",
			inputs: map[string]interface{}{
				"port":           float64(tlsPort),
				"timeoutSeconds": float64(2),
			},
			target: map[string]interface{}{
				"hostname": "127.0.0.1",
			},
			scope: scopeConstraints{
				ApprovedCIDRs:        []string{"127.0.0.0/8"},
				ApprovedPorts:        []int{tlsPort},
				ForbidInternetEgress: true,
			},
			expectedOutcome: "valid",
			expectedFile:    "tls-certificate-result",
		},
		{
			moduleID:    httpHealthModuleID,
			safetyLevel: "PassiveReadOnly",
			taskID:      "66666666-6666-4666-8666-666666666664",
			inputs: map[string]interface{}{
				"path":           "/healthz",
				"port":           float64(httpPort),
				"scheme":         "http",
				"timeoutSeconds": float64(2),
			},
			target: map[string]interface{}{
				"hostname": "127.0.0.1",
			},
			scope: scopeConstraints{
				ApprovedCIDRs:        []string{"127.0.0.0/8"},
				ApprovedPorts:        []int{httpPort},
				ForbidInternetEgress: true,
			},
			expectedOutcome: "healthy",
			expectedFile:    "http-health-result",
		},
		{
			moduleID:    httpHeaderModuleID,
			safetyLevel: "PassiveReadOnly",
			taskID:      "66666666-6666-4666-8666-666666666665",
			inputs: map[string]interface{}{
				"path":           "/healthz",
				"port":           float64(httpPort),
				"scheme":         "http",
				"timeoutSeconds": float64(2),
			},
			target: map[string]interface{}{
				"hostname": "127.0.0.1",
			},
			scope: scopeConstraints{
				ApprovedCIDRs:        []string{"127.0.0.0/8"},
				ApprovedPorts:        []int{httpPort},
				ForbidInternetEgress: true,
			},
			expectedOutcome: "headers_collected",
			expectedFile:    "http-header-result",
		},
		{
			moduleID:    certExpiryModuleID,
			safetyLevel: "PassiveReadOnly",
			taskID:      "66666666-6666-4666-8666-666666666666",
			inputs: map[string]interface{}{
				"port":           float64(tlsPort),
				"timeoutSeconds": float64(2),
			},
			target: map[string]interface{}{
				"hostname": "127.0.0.1",
			},
			scope: scopeConstraints{
				ApprovedCIDRs:        []string{"127.0.0.0/8"},
				ApprovedPorts:        []int{tlsPort},
				ForbidInternetEgress: true,
			},
			expectedOutcome: "valid",
			expectedFile:    "cert-expiry-result",
		},
		{
			moduleID:    tcpBannerModuleID,
			safetyLevel: "PassiveReadOnly",
			taskID:      "66666666-6666-4666-8666-666666666667",
			inputs: map[string]interface{}{
				"port":           float64(bannerPort),
				"timeoutSeconds": float64(2),
			},
			target: map[string]interface{}{
				"hostname": "127.0.0.1",
			},
			scope: scopeConstraints{
				ApprovedCIDRs:        []string{"127.0.0.0/8"},
				ApprovedPorts:        []int{bannerPort},
				ForbidInternetEgress: true,
			},
			expectedOutcome: "banner_collected",
			expectedFile:    "tcp-banner-result",
		},
		{
			moduleID:    tlsInfoModuleID,
			safetyLevel: "PassiveReadOnly",
			taskID:      "66666666-6666-4666-8666-666666666668",
			inputs: map[string]interface{}{
				"port":           float64(tlsPort),
				"timeoutSeconds": float64(2),
			},
			target: map[string]interface{}{
				"hostname": "127.0.0.1",
			},
			scope: scopeConstraints{
				ApprovedCIDRs:        []string{"127.0.0.0/8"},
				ApprovedPorts:        []int{tlsPort},
				ForbidInternetEgress: true,
			},
			expectedOutcome: "tls_handshake_ok",
			expectedFile:    "tls-info-result",
		},
	}

	for _, labTask := range labTasks {
		t.Run(labTask.moduleID, func(t *testing.T) {
			task := signedTask(t, privateKey, labTask.inputs, labTask.target, labTask.scope)
			task.ArtifactUpload["artifactUploadUrl"] = uploadServer.URL
			task.ModuleID = labTask.moduleID
			task.SafetyLevel = labTask.safetyLevel
			task.TaskID = labTask.taskID
			task = resignTask(t, task, privateKey)

			processed := processTaskWithEvidence(task, runnerCfg)
			result := uploadTaskEvidence(
				uploadServer.Client(),
				runnerConfig{authToken: "runner-token"},
				task,
				processed,
			)

			if result.Status != "Completed" {
				t.Fatalf("expected completed lab result, got %s: %v", result.Status, result.ErrorSummary)
			}
			if result.Outcome == nil || *result.Outcome != labTask.expectedOutcome {
				t.Fatalf("expected %s lab outcome, got %v", labTask.expectedOutcome, result.Outcome)
			}
			if result.ValidationState == nil || *result.ValidationState != "Reachable" {
				t.Fatalf("expected Reachable validation state, got %v", result.ValidationState)
			}
			if len(result.EvidenceManifest) != 1 || result.EvidenceManifest[0].EvidenceID == "" {
				t.Fatalf("expected uploaded evidence manifest, got %+v", result.EvidenceManifest)
			}
			if uploadsByFilename[labTask.expectedFile] != 1 {
				t.Fatalf("expected one upload for %s, got %d", labTask.expectedFile, uploadsByFilename[labTask.expectedFile])
			}
		})
	}
}

func TestProcessTaskRejectsReplayedNonce(t *testing.T) {
	privateKey, publicKeyPEM := testSigningKey(t)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer listener.Close()
	go func() {
		for {
			conn, acceptErr := listener.Accept()
			if acceptErr != nil {
				return
			}
			_ = conn.Close()
		}
	}()

	port := listener.Addr().(*net.TCPAddr).Port
	task := signedTask(t, privateKey, map[string]interface{}{
		"ports":          []interface{}{float64(port)},
		"timeoutSeconds": float64(1),
	}, map[string]interface{}{
		"hostname": "127.0.0.1",
	}, scopeConstraints{
		ApprovedCIDRs:        []string{"127.0.0.0/8"},
		ApprovedPorts:        []int{port},
		ForbidInternetEgress: true,
	})

	cfg := runnerConfig{
		runnerID:         task.RunnerID,
		signingKeyID:     "test-key",
		signingPublicKey: publicKeyPEM,
		tenantID:         task.TenantID,
		nonceCache:       newNonceCache(),
	}

	first := processTask(task, cfg)
	if first.Status != "Completed" {
		t.Fatalf("expected first task completed, got %s: %v", first.Status, first.ErrorSummary)
	}

	second := processTask(task, cfg)
	if second.Status != "Failed" {
		t.Fatalf("expected replayed task to fail, got %s", second.Status)
	}
	if second.ErrorSummary == nil || !strings.Contains(*second.ErrorSummary, "replay") {
		t.Fatalf("expected replay rejection, got %v", second.ErrorSummary)
	}
}

func TestProcessTaskRejectsDisallowedModule(t *testing.T) {
	privateKey, publicKeyPEM := testSigningKey(t)
	task := signedTask(t, privateKey, map[string]interface{}{
		"ports": []interface{}{float64(443)},
	}, map[string]interface{}{
		"hostname": "app.internal",
	}, scopeConstraints{
		ApprovedHostnames: []string{"app.internal"},
		ApprovedPorts:     []int{443},
	})
	task.ModuleID = "runner.shell"
	task = resignTask(t, task, privateKey)

	result := processTask(task, runnerConfig{
		runnerID:         task.RunnerID,
		signingKeyID:     "test-key",
		signingPublicKey: publicKeyPEM,
		tenantID:         task.TenantID,
	})

	if result.Status != "Failed" {
		t.Fatalf("expected failed result, got %s", result.Status)
	}
	if result.ErrorSummary == nil || !strings.Contains(*result.ErrorSummary, "not locally allowlisted") {
		t.Fatalf("expected allowlist rejection, got %v", result.ErrorSummary)
	}
}

func TestProcessTaskRejectsDisallowedSafetyLevel(t *testing.T) {
	privateKey, publicKeyPEM := testSigningKey(t)
	task := signedTask(t, privateKey, map[string]interface{}{
		"ports": []interface{}{float64(443)},
	}, map[string]interface{}{
		"hostname": "app.internal",
	}, scopeConstraints{
		ApprovedHostnames: []string{"app.internal"},
		ApprovedPorts:     []int{443},
	})
	task.SafetyLevel = "BASLite"
	task = resignTask(t, task, privateKey)

	result := processTask(task, runnerConfig{
		runnerID:         task.RunnerID,
		signingKeyID:     "test-key",
		signingPublicKey: publicKeyPEM,
		tenantID:         task.TenantID,
	})

	if result.Status != "Failed" {
		t.Fatalf("expected failed result, got %s", result.Status)
	}
	if result.ErrorSummary == nil || !strings.Contains(*result.ErrorSummary, "safety level is not permitted") {
		t.Fatalf("expected safety-level rejection, got %v", result.ErrorSummary)
	}
}

func TestPollCycleSkipsExecutionWhenServerKillSwitchActive(t *testing.T) {
	resultCalled := false
	heartbeatReported := false
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if strings.HasSuffix(request.URL.Path, "/poll") {
			var body map[string]interface{}
			if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
				t.Fatalf("decode poll heartbeat: %v", err)
			}
			health, _ := body["health"].(map[string]interface{})
			heartbeatReported = health["runnerId"] == "22222222-2222-4222-8222-222222222222" && health["version"] == runnerVersion && health["status"] == "Active"
			response.Header().Set("Content-Type", "application/json")
			_, _ = response.Write([]byte(`{"killSwitchActive":true,"nextPollAfterSeconds":15,"tasks":[]}`))
			return
		}
		if strings.Contains(request.URL.Path, "/result") {
			resultCalled = true
		}
		response.WriteHeader(http.StatusOK)
		_, _ = response.Write([]byte(`{}`))
	}))
	defer server.Close()

	cfg := runnerConfig{
		apiBaseURL:       server.URL,
		authToken:        "runner-token",
		runnerID:         "22222222-2222-4222-8222-222222222222",
		signingPublicKey: "unused",
		nonceCache:       newNonceCache(),
	}

	processed, delay, err := pollCycle(server.Client(), cfg)
	if err != nil {
		t.Fatalf("pollCycle: %v", err)
	}
	if processed != 0 {
		t.Fatalf("expected no tasks processed under kill switch, got %d", processed)
	}
	if delay <= 0 {
		t.Fatalf("expected a positive next poll delay, got %s", delay)
	}
	if resultCalled {
		t.Fatal("expected no task result submission under kill switch")
	}
	if !heartbeatReported {
		t.Fatal("expected every poll to report runner liveness")
	}
}

func TestPollCycleAcknowledgesKillSwitchOnHost(t *testing.T) {
	acknowledged := false
	changedAt := "2026-07-14T16:00:00Z"
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		if strings.HasSuffix(request.URL.Path, "/poll") {
			_, _ = response.Write([]byte(`{"controlStateChangedAt":"` + changedAt + `","killSwitchActive":true,"nextPollAfterSeconds":15,"runnerRevoked":false,"tasks":[]}`))
			return
		}
		if strings.HasSuffix(request.URL.Path, "/control-state/acknowledge") {
			var body map[string]interface{}
			if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
				t.Fatalf("decode acknowledgement: %v", err)
			}
			acknowledged = body["controlState"] == "KillSwitchActive" && body["stateChangedAt"] == changedAt
			_, _ = response.Write([]byte(`{}`))
			return
		}
		response.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	cfg := runnerConfig{
		apiBaseURL: server.URL,
		authToken:  "runner-token",
		runnerID:   "22222222-2222-4222-8222-222222222222",
	}

	processed, _, err := pollCycle(server.Client(), cfg)
	if err != nil {
		t.Fatalf("pollCycle: %v", err)
	}
	if processed != 0 || !acknowledged {
		t.Fatalf("expected host acknowledgement and no work, processed=%d acknowledged=%v", processed, acknowledged)
	}
}

func TestRunnerExposesNoArbitraryShellModule(t *testing.T) {
	for moduleID := range allowlistedModules {
		lowered := strings.ToLower(moduleID)
		for _, forbidden := range []string{"shell", "exec", "tunnel", "ssh", "command"} {
			if strings.Contains(lowered, forbidden) {
				t.Fatalf("runner must not allowlist a remote-access module: %s", moduleID)
			}
		}
	}
	if _, ok := implementedModules["runner.shell"]; ok {
		t.Fatal("runner.shell must not be implemented")
	}
}

func TestNormalizeModuleIDMapsControlPlaneAliases(t *testing.T) {
	if got := normalizeModuleID("periscan.dns_resolution_check"); got != dnsResolutionModuleID {
		t.Fatalf("dns alias: got %s want %s", got, dnsResolutionModuleID)
	}
	if got := normalizeModuleID("periscan.tcp_reachability"); got != reachabilityModuleID {
		t.Fatalf("reachability alias: got %s want %s", got, reachabilityModuleID)
	}
	if got := normalizeModuleID(dnsResolutionModuleID); got != dnsResolutionModuleID {
		t.Fatalf("native id must pass through: got %s", got)
	}
	if !allowlistedModules["periscan.dns_resolution_check"] {
		t.Fatal("control-plane dns measured module must be allowlisted")
	}
}

// TestSignResultVerifiesLikeControlPlane proves the signature the runner
// produces over a result's localAuditSha256 verifies against the registered
// public key exactly as the server does: verify(pub, []byte(localAuditSha256),
// base64.StdEncoding-decoded signature).
func TestSignResultVerifiesLikeControlPlane(t *testing.T) {
	publicKeyPEM, privateKeyPEM, err := generateResultSigningKey()
	if err != nil {
		t.Fatalf("generate result signing key: %v", err)
	}

	// The registered SPKI PEM must parse to a usable Ed25519 public key (this is
	// exactly what the control plane feeds to createPublicKey / verify).
	publicKey, err := parseEd25519PublicKey(publicKeyPEM)
	if err != nil {
		t.Fatalf("parse registered public key: %v", err)
	}

	localAuditSha256 := sha256Hex([]byte("periscan-runner-signed-result"))
	result := taskResult{LocalAuditSHA256: localAuditSha256}

	signed, err := signResult(privateKeyPEM, result)
	if err != nil {
		t.Fatalf("sign result: %v", err)
	}
	if signed.ResultSignature == "" {
		t.Fatal("expected a result signature to be set")
	}

	signature, err := base64.StdEncoding.DecodeString(signed.ResultSignature)
	if err != nil {
		t.Fatalf("result signature is not base64 std: %v", err)
	}

	// Mirror the server's verifyRunnerResultSignature: sign is over the UTF-8
	// bytes of the localAuditSha256 string, not the raw digest bytes.
	if !ed25519.Verify(publicKey, []byte(localAuditSha256), signature) {
		t.Fatal("runner result signature failed control-plane-style verification")
	}

	// A signature over the wrong message must fail — guards against accidentally
	// signing the raw digest or some other field.
	if ed25519.Verify(publicKey, []byte("tampered"), signature) {
		t.Fatal("signature verified against the wrong message")
	}
}

// TestSignResultNoopWithoutKey confirms a legacy/unregistered runner (no
// result-signing key) submits an unsigned result rather than erroring.
func TestSignResultNoopWithoutKey(t *testing.T) {
	result := taskResult{LocalAuditSHA256: sha256Hex([]byte("no-key"))}
	signed, err := signResult("", result)
	if err != nil {
		t.Fatalf("signResult with no key should not error: %v", err)
	}
	if signed.ResultSignature != "" {
		t.Fatalf("expected no signature without a key, got %q", signed.ResultSignature)
	}
}

// TestRegistrationRequestCarriesResultSigningPublicKey confirms the registration
// body serializes the SPKI PEM under the field the server schema expects.
func TestRegistrationRequestCarriesResultSigningPublicKey(t *testing.T) {
	publicKeyPEM, _, err := generateResultSigningKey()
	if err != nil {
		t.Fatalf("generate result signing key: %v", err)
	}
	body := registrationRequest{ResultSigningPublicKeyPem: publicKeyPEM}
	encoded, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal registration request: %v", err)
	}
	var decoded map[string]interface{}
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatalf("unmarshal registration request: %v", err)
	}
	got, ok := decoded["resultSigningPublicKeyPem"].(string)
	if !ok || got != publicKeyPEM {
		t.Fatalf("resultSigningPublicKeyPem not serialized correctly: %v", decoded["resultSigningPublicKeyPem"])
	}
}

func testSigningKey(t *testing.T) (ed25519.PrivateKey, string) {
	t.Helper()
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	der, err := x509.MarshalPKIXPublicKey(publicKey)
	if err != nil {
		t.Fatalf("marshal public key: %v", err)
	}
	publicKeyPEM := string(pem.EncodeToMemory(&pem.Block{
		Bytes: der,
		Type:  "PUBLIC KEY",
	}))
	return privateKey, publicKeyPEM
}

func signedTask(
	t *testing.T,
	privateKey ed25519.PrivateKey,
	inputs map[string]interface{},
	target map[string]interface{},
	scope scopeConstraints,
) taskEnvelope {
	t.Helper()
	task := taskEnvelope{
		ArtifactUpload: map[string]interface{}{
			"artifactUploadUrl": "https://runner.periscan.test/tasks/artifacts",
			"maxArtifactBytes":  float64(1000000),
			"resultCallbackUrl": "https://runner.periscan.test/tasks/result",
		},
		ExpiresAt:            time.Now().UTC().Add(time.Hour).Format(time.RFC3339Nano),
		ExecutionEnvironment: "InternalRunner",
		Inputs:               inputs,
		ModuleID:             "runner.reachability_check",
		SafetyLevel:          "ActiveNonInvasive",
		RunID:                "44444444-4444-4444-8444-444444444444",
		RunnerID:             "22222222-2222-4222-8222-222222222222",
		ScopeConstraints:     scope,
		ScopeID:              "55555555-5555-4555-8555-555555555555",
		Target:               target,
		TaskID:               "66666666-6666-4666-8666-666666666666",
		TenantID:             "11111111-1111-4111-8111-111111111111",
	}
	return resignTask(t, task, privateKey)
}

func resignTask(t *testing.T, task taskEnvelope, privateKey ed25519.PrivateKey) taskEnvelope {
	t.Helper()
	unsigned, err := taskUnsignedMap(task)
	if err != nil {
		t.Fatalf("unsigned task: %v", err)
	}
	canonical, err := canonicalJSON(unsigned)
	if err != nil {
		t.Fatalf("canonical task: %v", err)
	}
	task.Signature = runnerTaskSignature{
		Algorithm:    "EdDSA",
		DigestSHA256: sha256Hex(canonical),
		KeyID:        "test-key",
		Nonce:        task.TaskID,
		Signature:    base64.RawURLEncoding.EncodeToString(ed25519.Sign(privateKey, canonical)),
	}
	return task
}
