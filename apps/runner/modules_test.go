package main

import (
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
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
