package main

import (
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strconv"
	"strings"
	"testing"
)

func hostPortFromURL(t *testing.T, raw string) (string, int) {
	t.Helper()
	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("parse url: %v", err)
	}
	host, portStr, err := net.SplitHostPort(parsed.Host)
	if err != nil {
		t.Fatalf("split host/port: %v", err)
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
		t.Fatalf("atoi port: %v", err)
	}
	return host, port
}

func loopbackScope(port int) scopeConstraints {
	return scopeConstraints{
		ApprovedCIDRs:     []string{"127.0.0.0/8"},
		ApprovedHostnames: []string{"127.0.0.1", "localhost"},
		ApprovedPorts:     []int{port},
	}
}

func TestExecuteDNSResolutionResolvesInScopeHost(t *testing.T) {
	exec, err := executeDNSResolution(taskEnvelope{
		ModuleID:         dnsResolutionModuleID,
		Inputs:           map[string]interface{}{"hostname": "localhost", "timeoutSeconds": float64(5)},
		ScopeConstraints: scopeConstraints{ApprovedHostnames: []string{"localhost"}},
	})
	if err != nil {
		t.Fatalf("dns resolution: %v", err)
	}
	if exec.Outcome != "resolved" {
		t.Fatalf("want outcome resolved, got %s", exec.Outcome)
	}
	if exec.ValidationState != "Reachable" {
		t.Fatalf("want validationState Reachable, got %s", exec.ValidationState)
	}
}

func TestExecuteDNSResolutionRejectsOutOfScopeHost(t *testing.T) {
	if _, err := executeDNSResolution(taskEnvelope{
		ModuleID:         dnsResolutionModuleID,
		Inputs:           map[string]interface{}{"hostname": "out-of-scope.example.com"},
		ScopeConstraints: scopeConstraints{ApprovedHostnames: []string{"localhost"}},
	}); err == nil {
		t.Fatal("expected out-of-scope DNS host to be rejected before any lookup")
	}
}

func TestExecuteHTTPHealthHealthyAndUnhealthy(t *testing.T) {
	cases := []struct {
		status int
		want   string
	}{
		{status: http.StatusOK, want: "healthy"},
		{status: http.StatusInternalServerError, want: "unhealthy"},
	}
	for _, tc := range cases {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(tc.status)
		}))
		host, port := hostPortFromURL(t, server.URL)
		exec, err := executeHTTPHealth(taskEnvelope{
			ModuleID:         httpHealthModuleID,
			Inputs:           map[string]interface{}{"hostname": host, "port": float64(port)},
			ScopeConstraints: loopbackScope(port),
		})
		server.Close()
		if err != nil {
			t.Fatalf("http health (%d): %v", tc.status, err)
		}
		if exec.Outcome != tc.want {
			t.Fatalf("status %d: want %s, got %s", tc.status, tc.want, exec.Outcome)
		}
		if exec.ValidationState != "Reachable" {
			t.Fatalf("status %d: want Reachable, got %s", tc.status, exec.ValidationState)
		}
	}
}

func TestExecuteHTTPHealthRejectsOutOfScopePort(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	defer server.Close()
	host, port := hostPortFromURL(t, server.URL)
	if _, err := executeHTTPHealth(taskEnvelope{
		ModuleID: httpHealthModuleID,
		Inputs:   map[string]interface{}{"hostname": host, "port": float64(port)},
		// Approve a different port so the real port is out of scope.
		ScopeConstraints: scopeConstraints{
			ApprovedHostnames: []string{"127.0.0.1"},
			ApprovedPorts:     []int{port + 1},
		},
	}); err == nil {
		t.Fatal("expected out-of-scope port to be rejected before any request")
	}
}

func TestExecuteTLSCertificateReportsPresentedCert(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	defer server.Close()
	host, port := hostPortFromURL(t, server.URL)
	exec, err := executeTLSCertificate(taskEnvelope{
		ModuleID:         tlsCertificateModuleID,
		Inputs:           map[string]interface{}{"hostname": host, "port": float64(port)},
		ScopeConstraints: loopbackScope(port),
	})
	if err != nil {
		t.Fatalf("tls certificate: %v", err)
	}
	if exec.ValidationState != "Reachable" {
		t.Fatalf("want Reachable, got %s", exec.ValidationState)
	}
	if exec.Outcome == "expired" {
		t.Fatalf("httptest cert should not be expired, got %s", exec.Outcome)
	}
	if len(exec.EvidencePayload) == 0 {
		t.Fatal("expected non-empty certificate evidence")
	}
}

func TestExecuteTLSCertificateRejectsOutOfScope(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	defer server.Close()
	host, port := hostPortFromURL(t, server.URL)
	if _, err := executeTLSCertificate(taskEnvelope{
		ModuleID:         tlsCertificateModuleID,
		Inputs:           map[string]interface{}{"hostname": host, "port": float64(port)},
		ScopeConstraints: scopeConstraints{ApprovedHostnames: []string{"10.0.0.1"}, ApprovedPorts: []int{port}},
	}); err == nil {
		t.Fatal("expected out-of-scope TLS host to be rejected before handshake")
	}
}

func cidrLoopbackScope(port int) scopeConstraints {
	return scopeConstraints{
		ApprovedCIDRs:        []string{"127.0.0.0/8"},
		ApprovedPorts:        []int{port},
		ForbidInternetEgress: true,
	}
}

func TestExecutePortConnectReportsPresentOnScopedCIDR(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer listener.Close()
	go func() {
		conn, acceptErr := listener.Accept()
		if acceptErr == nil && conn != nil {
			_ = conn.Close()
		}
	}()
	port := listener.Addr().(*net.TCPAddr).Port

	exec, err := executePortConnect(taskEnvelope{
		ModuleID:         portConnectModuleID,
		Inputs:           map[string]interface{}{"port": float64(port), "timeoutSeconds": float64(2)},
		Target:           map[string]interface{}{"hostname": "127.0.0.1"},
		ScopeConstraints: cidrLoopbackScope(port),
	})
	if err != nil {
		t.Fatalf("port connect: %v", err)
	}
	if exec.Outcome != "present" {
		t.Fatalf("want outcome present, got %s", exec.Outcome)
	}
	if exec.ValidationState != "Reachable" {
		t.Fatalf("want Reachable, got %s", exec.ValidationState)
	}
	if exec.Filename != "port-connect-result" {
		t.Fatalf("want port-connect-result filename, got %s", exec.Filename)
	}
	if strings.Contains(strings.ToLower(string(exec.EvidencePayload)), "banner") {
		t.Fatalf("port-present check must not collect a banner: %s", exec.EvidencePayload)
	}
	var evidence map[string]interface{}
	if err := json.Unmarshal(exec.EvidencePayload, &evidence); err != nil {
		t.Fatalf("evidence json: %v", err)
	}
	if evidence["present"] != true {
		t.Fatalf("want present=true evidence, got %#v", evidence["present"])
	}
	if evidence["targetHost"] != "127.0.0.1" {
		t.Fatalf("want targetHost 127.0.0.1, got %#v", evidence["targetHost"])
	}
}

func TestExecutePortConnectReportsAbsentWithoutBannerRead(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	_ = listener.Close()

	exec, err := executePortConnect(taskEnvelope{
		ModuleID:         portConnectModuleID,
		Inputs:           map[string]interface{}{"port": float64(port), "timeoutSeconds": float64(1)},
		Target:           map[string]interface{}{"hostname": "127.0.0.1"},
		ScopeConstraints: cidrLoopbackScope(port),
	})
	if err != nil {
		t.Fatalf("port connect absent: %v", err)
	}
	if exec.Outcome != "absent" {
		t.Fatalf("want outcome absent, got %s", exec.Outcome)
	}
	if strings.Contains(strings.ToLower(string(exec.EvidencePayload)), "banner") {
		t.Fatalf("absent port must still be banner-free: %s", exec.EvidencePayload)
	}
}

func TestExecutePortConnectRejectsIPOutsideApprovedCIDR(t *testing.T) {
	_, err := executePortConnect(taskEnvelope{
		ModuleID: portConnectModuleID,
		Inputs:   map[string]interface{}{"port": float64(443), "timeoutSeconds": float64(1)},
		Target:   map[string]interface{}{"hostname": "10.0.0.1"},
		ScopeConstraints: scopeConstraints{
			ApprovedCIDRs:        []string{"127.0.0.0/8"},
			ApprovedPorts:        []int{443},
			ForbidInternetEgress: true,
		},
	})
	if err == nil || !strings.Contains(err.Error(), "outside approved runner scope") {
		t.Fatalf("expected out-of-CIDR IP rejected before dial, got %v", err)
	}
}

func TestExecutePortConnectRejectsHostnameThatIsNotAnIP(t *testing.T) {
	_, err := executePortConnect(taskEnvelope{
		ModuleID: portConnectModuleID,
		Inputs:   map[string]interface{}{"port": float64(443), "timeoutSeconds": float64(1)},
		Target:   map[string]interface{}{"hostname": "app.internal"},
		ScopeConstraints: scopeConstraints{
			ApprovedCIDRs:        []string{"10.0.0.0/8"},
			ApprovedHostnames:    []string{"app.internal"},
			ApprovedPorts:        []int{443},
			ForbidInternetEgress: true,
		},
	})
	if err == nil || !strings.Contains(err.Error(), "must be an IP") {
		t.Fatalf("expected hostname-only target rejected; port-present is CIDR/IP only, got %v", err)
	}
}

func TestExecutePortConnectRejectsTimeoutAboveFiveSeconds(t *testing.T) {
	_, err := executePortConnect(taskEnvelope{
		ModuleID:         portConnectModuleID,
		Inputs:           map[string]interface{}{"port": float64(443), "timeoutSeconds": float64(10)},
		Target:           map[string]interface{}{"hostname": "127.0.0.1"},
		ScopeConstraints: cidrLoopbackScope(443),
	})
	if err == nil || !strings.Contains(err.Error(), "timeoutSeconds") {
		t.Fatalf("expected timeoutSeconds > 5 rejected, got %v", err)
	}
}

func TestExecutePortConnectRejectsMultiplePorts(t *testing.T) {
	_, err := executePortConnect(taskEnvelope{
		ModuleID: portConnectModuleID,
		Inputs: map[string]interface{}{
			"ports":          []interface{}{float64(80), float64(443)},
			"timeoutSeconds": float64(1),
		},
		Target:           map[string]interface{}{"hostname": "127.0.0.1"},
		ScopeConstraints: cidrLoopbackScope(80),
	})
	if err == nil || !strings.Contains(err.Error(), "single port") {
		t.Fatalf("expected multi-port input rejected; this is not nmap, got %v", err)
	}
}

func TestExecutePortConnectRejectsCIDRSweepTarget(t *testing.T) {
	_, err := executePortConnect(taskEnvelope{
		ModuleID:         portConnectModuleID,
		Inputs:           map[string]interface{}{"port": float64(443), "timeoutSeconds": float64(1)},
		Target:           map[string]interface{}{"hostname": "127.0.0.0/8"},
		ScopeConstraints: cidrLoopbackScope(443),
	})
	if err == nil || !strings.Contains(err.Error(), "must be an IP") {
		t.Fatalf("expected CIDR sweep target rejected, got %v", err)
	}
}

func TestExecutePTRLookupResolvesLoopbackInApprovedCIDR(t *testing.T) {
	exec, err := executePTRLookup(taskEnvelope{
		ModuleID: ptrLookupModuleID,
		Inputs:   map[string]interface{}{"timeoutSeconds": float64(2)},
		Target:   map[string]interface{}{"hostname": "127.0.0.1"},
		ScopeConstraints: scopeConstraints{
			ApprovedCIDRs:        []string{"127.0.0.0/8"},
			ForbidInternetEgress: true,
		},
	})
	if err != nil {
		t.Fatalf("ptr lookup: %v", err)
	}
	if exec.Filename != "ptr-lookup-result" {
		t.Fatalf("want ptr-lookup-result filename, got %s", exec.Filename)
	}
	var evidence map[string]interface{}
	if err := json.Unmarshal(exec.EvidencePayload, &evidence); err != nil {
		t.Fatalf("evidence json: %v", err)
	}
	if evidence["targetHost"] != "127.0.0.1" {
		t.Fatalf("want targetHost 127.0.0.1, got %#v", evidence["targetHost"])
	}
	if exec.Outcome != "resolved" && exec.Outcome != "unresolved" {
		t.Fatalf("want resolved or unresolved, got %s", exec.Outcome)
	}
}

func TestExecutePTRLookupRejectsIPOutsideApprovedCIDR(t *testing.T) {
	_, err := executePTRLookup(taskEnvelope{
		ModuleID: ptrLookupModuleID,
		Inputs:   map[string]interface{}{"timeoutSeconds": float64(1)},
		Target:   map[string]interface{}{"hostname": "8.8.8.8"},
		ScopeConstraints: scopeConstraints{
			ApprovedCIDRs:        []string{"127.0.0.0/8"},
			ForbidInternetEgress: true,
		},
	})
	if err == nil || !strings.Contains(err.Error(), "outside approved runner scope") {
		t.Fatalf("expected public/out-of-CIDR PTR target rejected before lookup, got %v", err)
	}
}

func TestExecutePTRLookupRejectsHostname(t *testing.T) {
	_, err := executePTRLookup(taskEnvelope{
		ModuleID: ptrLookupModuleID,
		Inputs:   map[string]interface{}{"timeoutSeconds": float64(1)},
		Target:   map[string]interface{}{"hostname": "localhost"},
		ScopeConstraints: scopeConstraints{
			ApprovedHostnames:    []string{"localhost"},
			ForbidInternetEgress: true,
		},
	})
	if err == nil || !strings.Contains(err.Error(), "must be an IP") {
		t.Fatalf("expected hostname PTR target rejected; PTR is CIDR/IP only, got %v", err)
	}
}

func TestGoRunnerSourceHasNoNmapOrArbitraryShell(t *testing.T) {
	source, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatalf("read main.go: %v", err)
	}
	body := string(source)
	for _, forbidden := range []string{
		`"os/exec"`,
		"exec.Command",
		"nmap",
		"reverse ssh",
		"PERISCAN_LIVE_OFFENSIVE",
	} {
		if strings.Contains(strings.ToLower(body), strings.ToLower(forbidden)) {
			t.Fatalf("Go runner must not contain %q", forbidden)
		}
	}
}
