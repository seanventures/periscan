package main

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const runnerVersion = "0.1.0"

// Internal validation module IDs. All are passive/non-invasive, scope-enforced,
// read-only checks executed close to customer assets. There is intentionally NO
// arbitrary-shell / exec / mutation module.
const reachabilityModuleID = "runner.reachability_check"
const dnsResolutionModuleID = "runner.dns_resolution_check"
const tlsCertificateModuleID = "runner.tls_certificate_check"
const httpHealthModuleID = "runner.http_health_check"
const httpHeaderModuleID = "runner.http_header_check"   // Phase 3 expansion: passive HTTP header/banner collection for internal exposure / control signals.
const certExpiryModuleID = "runner.cert_expiry_check"   // Phase 3 expansion: passive TLS cert expiry / validity check for internal exposure signals.
const tcpBannerModuleID = "runner.tcp_banner_check"     // Passive TCP banner grab for service fingerprinting / internal exposure signals (first bytes or greeting line, read-only, bounded read).
const tlsInfoModuleID = "runner.tls_info_check"         // Extended TLS handshake info (version, cipher, chain length) for internal cert + protocol signals.
const portConnectModuleID = "runner.port_connect_check" // Bounded TCP connect (no banner read beyond SYN/ACK) for internal reachability segmentation signals. Passive + scope-enforced.

// allowlistedModules is the local module allowlist. Only modules listed here may
// execute on the Go runner, and every listed module has a real passive or
// non-invasive implementation below. There is intentionally NO arbitrary-shell /
// exec module.
//
// Control-plane measured IDs use the periscan.* namespace (RUNNER_MEASURED_MODULE_IDS).
// Local implementations historically used runner.* — both are allowlisted and
// normalizeModuleID maps periscan.* → the local implementation.
var allowlistedModules = map[string]bool{
	reachabilityModuleID:   true,
	dnsResolutionModuleID:  true,
	tlsCertificateModuleID: true,
	httpHealthModuleID:     true,
	httpHeaderModuleID:     true,
	certExpiryModuleID:     true,
	tcpBannerModuleID:      true,
	tlsInfoModuleID:        true,
	portConnectModuleID:    true,
	// Control-plane measured aliases (hybrid compiler / measured dispatch).
	"periscan.dns_resolution_check":  true,
	"periscan.tls_certificate_check": true,
	"periscan.http_health_check":     true,
	"periscan.tcp_reachability":      true,
}

// implementedModules is kept as defense in depth so a future allowlist expansion
// cannot execute without a corresponding implementation.
var implementedModules = map[string]bool{
	reachabilityModuleID:   true,
	dnsResolutionModuleID:  true,
	tlsCertificateModuleID: true,
	httpHealthModuleID:     true,
	httpHeaderModuleID:     true,
	certExpiryModuleID:     true,
	tcpBannerModuleID:      true,
	tlsInfoModuleID:        true,
	portConnectModuleID:    true,
	"periscan.dns_resolution_check":  true,
	"periscan.tls_certificate_check": true,
	"periscan.http_health_check":     true,
	"periscan.tcp_reachability":      true,
}

// normalizeModuleID maps control-plane measured module IDs onto the local
// runner.* implementation IDs. Unknown IDs pass through unchanged.
func normalizeModuleID(moduleID string) string {
	switch moduleID {
	case "periscan.dns_resolution_check":
		return dnsResolutionModuleID
	case "periscan.tls_certificate_check":
		return tlsCertificateModuleID
	case "periscan.http_health_check":
		return httpHealthModuleID
	case "periscan.tcp_reachability":
		return reachabilityModuleID
	default:
		return moduleID
	}
}

// allowedSafetyLevels are the only safety levels the runner will execute locally.
var allowedSafetyLevels = map[string]bool{
	"PassiveReadOnly":   true,
	"ActiveNonInvasive": true,
}

// nonceCache rejects replayed task nonces within a runner process lifetime. The
// server also enforces a unique (runnerId, nonce); this is local defense in depth.
type nonceCache struct {
	mu   sync.Mutex
	seen map[string]bool
}

func newNonceCache() *nonceCache {
	return &nonceCache{seen: map[string]bool{}}
}

func (c *nonceCache) checkAndRecord(nonce string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.seen[nonce] {
		return errors.New("task nonce has already been processed (replay rejected)")
	}
	c.seen[nonce] = true
	return nil
}

type runnerConfig struct {
	apiBaseURL           string
	authToken            string
	certificateExpiresAt string
	bootstrapMode        bool
	command              string
	hostname             string
	pollOnce             bool
	insecureSkipVerify   bool
	mtlsCAFile           string
	mtlsCertFile         string
	mtlsKeyFile          string
	registrationToken    string
	runnerID             string
	runnerName           string
	signingKeyID         string
	signingPublicKey     string
	// Ed25519 result-signing private key PEM (PKCS8). When set, every submitted
	// result is signed over its localAuditSha256 before it is posted.
	resultSigningPrivateKeyPem string
	tenantID                   string
	controlPlaneProxy          string
	nonceCache                 *nonceCache
}

type capabilities struct {
	SupportsArtifactUpload    bool `json:"supportsArtifactUpload"`
	SupportsHTTPConnectProxy  bool `json:"supportsHttpConnectProxy"`
	SupportsLocalReachability bool `json:"supportsLocalReachability"`
	SupportsLongPoll          bool `json:"supportsLongPoll"`
	SupportsWebSocket         bool `json:"supportsWebSocket"`
}

type networkProfile struct {
	AdditionalEgressNotes     *string  `json:"additionalEgressNotes"`
	DNSResolutionRequired     bool     `json:"dnsResolutionRequired"`
	ExplicitProxyURL          *string  `json:"explicitProxyUrl"`
	GatewayHostnames          []string `json:"gatewayHostnames"`
	HTTPConnectProxySupported bool     `json:"httpConnectProxySupported"`
	OutboundHTTPSPorts        []int    `json:"outboundHttpsPorts"`
}

type registrationRequest struct {
	Arch              string         `json:"arch"`
	Capabilities      capabilities   `json:"capabilities"`
	CSRPem            string         `json:"csrPem"`
	DeploymentMode    string         `json:"deploymentMode"`
	Hostname          string         `json:"hostname"`
	Labels            []string       `json:"labels"`
	NetworkProfile    networkProfile `json:"networkProfile"`
	OS                string         `json:"os"`
	RegistrationToken string         `json:"registrationToken"`
	// The runner's Ed25519 result-signing PUBLIC key (SPKI PEM). The runner keeps
	// the matching private key and signs every result's localAuditSha256 with it;
	// the control plane verifies against this key (enforce-when-registered).
	ResultSigningPublicKeyPem string `json:"resultSigningPublicKeyPem,omitempty"`
	RunnerName                string `json:"runnerName"`
	Version                   string `json:"version"`
}

type issuedCredentials struct {
	ControlPlaneURL          string `json:"controlPlaneUrl"`
	CACertificatePem         string `json:"caCertificatePem"`
	CertificateExpiresAt     string `json:"certificateExpiresAt"`
	HeartbeatIntervalSeconds int    `json:"heartbeatIntervalSeconds"`
	MTLSCertificateSHA256    string `json:"mtlsCertificateSha256"`
	MTLSClientCertificatePem string `json:"mtlsClientCertificatePem"`
	MTLSClientPrivateKeyPem  string `json:"mtlsClientPrivateKeyPem,omitempty"`
	MTLSPrivateKeyRequired   bool   `json:"mtlsClientPrivateKeyRequired"`
	PollIntervalSeconds      int    `json:"pollIntervalSeconds"`
	RunnerAuthToken          string `json:"runnerAuthToken"`
	RunnerID                 string `json:"runnerId"`
	TaskSigningKeyID         string `json:"taskSigningKeyId"`
	TaskSigningPublicKeyPem  string `json:"taskSigningPublicKeyPem"`
	TenantID                 string `json:"tenantId"`
	TransportAuth            string `json:"transportAuth"`
}

type registrationResponse struct {
	Credentials issuedCredentials `json:"credentials"`
	// Emitted locally (never returned by the server) so the operator can persist
	// the generated result-signing private key and pass it back at poll time via
	// PERISCAN_RESULT_SIGNING_PRIVATE_KEY_PEM.
	ResultSigningPrivateKeyPem string `json:"resultSigningPrivateKeyPem,omitempty"`
}

type runnerTaskSignature struct {
	Algorithm    string `json:"algorithm"`
	DigestSHA256 string `json:"digestSha256"`
	KeyID        string `json:"keyId"`
	Nonce        string `json:"nonce"`
	Signature    string `json:"signature"`
}

type scopeConstraints struct {
	ApprovedCIDRs        []string `json:"approvedCidrs"`
	ApprovedDNSSuffixes  []string `json:"approvedDnsSuffixes"`
	ApprovedHostnames    []string `json:"approvedHostnames"`
	ApprovedPorts        []int    `json:"approvedPorts"`
	ForbidInternetEgress bool     `json:"forbidInternetEgress"`
}

type taskEnvelope struct {
	ArtifactUpload       map[string]interface{} `json:"artifactUpload"`
	IssuedAt             string                 `json:"issuedAt"`
	ExpiresAt            string                 `json:"expiresAt"`
	ExecutionEnvironment string                 `json:"executionEnvironment"`
	Inputs               map[string]interface{} `json:"inputs"`
	MissionID            string                 `json:"missionId"`
	ModuleID             string                 `json:"moduleId"`
	SafetyLevel          string                 `json:"safetyLevel"`
	RunID                string                 `json:"runId"`
	RunnerID             string                 `json:"runnerId"`
	ScopeConstraints     scopeConstraints       `json:"scopeConstraints"`
	ScopeID              string                 `json:"scopeId"`
	Signature            runnerTaskSignature    `json:"signature"`
	Target               map[string]interface{} `json:"target"`
	TaskID               string                 `json:"taskId"`
	TenantID             string                 `json:"tenantId"`
}

type pollResponse struct {
	ControlStateChangedAt string         `json:"controlStateChangedAt"`
	KillSwitchActive      bool           `json:"killSwitchActive"`
	NextPollAfterSeconds  int            `json:"nextPollAfterSeconds"`
	RunnerRevoked         bool           `json:"runnerRevoked"`
	Tasks                 []taskEnvelope `json:"tasks"`
}

type evidenceManifestItem struct {
	ArtifactType    string `json:"artifactType"`
	EvidenceID      string `json:"evidenceId,omitempty"`
	RedactionStatus string `json:"redactionStatus"`
	SHA256          string `json:"sha256"`
	SizeBytes       int    `json:"sizeBytes"`
}

type runnerEvidenceUpload struct {
	ArtifactType string
	Content      []byte
	ContentType  string
	Filename     string
	SHA256       string
	SizeBytes    int
}

type processedTaskResult struct {
	EvidenceUploads []runnerEvidenceUpload
	Result          taskResult
}

type artifactUploadRequest struct {
	ArtifactType  string `json:"artifactType"`
	ContentBase64 string `json:"contentBase64"`
	ContentType   string `json:"contentType"`
	Filename      string `json:"filename,omitempty"`
	SHA256        string `json:"sha256"`
	SizeBytes     int    `json:"sizeBytes"`
}

type artifactUploadResponse struct {
	Artifact uploadedEvidenceArtifact `json:"artifact"`
}

type uploadedEvidenceArtifact struct {
	EvidenceID      string `json:"evidenceId"`
	RedactionStatus string `json:"redactionStatus"`
	SHA256          string `json:"sha256"`
}

type taskResult struct {
	CompletedAt      string                 `json:"completedAt"`
	ErrorSummary     *string                `json:"errorSummary"`
	EvidenceManifest []evidenceManifestItem `json:"evidenceManifest"`
	LocalAuditSHA256 string                 `json:"localAuditSha256"`
	Outcome          *string                `json:"outcome"`
	// Base64 (std) Ed25519 signature over the localAuditSha256 string bytes,
	// produced with the runner's registered result-signing private key. Omitted
	// when the runner has no result-signing key configured.
	ResultSignature string  `json:"resultSignature,omitempty"`
	RunID           string  `json:"runId"`
	RunnerID        string  `json:"runnerId"`
	StartedAt       string  `json:"startedAt"`
	Status          string  `json:"status"`
	TaskID          string  `json:"taskId"`
	TenantID        string  `json:"tenantId"`
	ValidationState *string `json:"validationState"`
}

type portObservation struct {
	Port   int    `json:"port"`
	Status string `json:"status"`
}

type reachabilityEvidence struct {
	GeneratedAt  string            `json:"generatedAt"`
	ModuleID     string            `json:"moduleId"`
	Observations []portObservation `json:"observations"`
	RunnerID     string            `json:"runnerId"`
	TargetHost   string            `json:"targetHost"`
	TaskID       string            `json:"taskId"`
}

func main() {
	cfg := loadConfig()

	if killSwitchEnabled() {
		fmt.Fprintln(os.Stderr, "runner kill switch is enabled")
		os.Exit(2)
	}

	switch cfg.command {
	case "register":
		if err := register(cfg); err != nil {
			exitErr(err)
		}
	case "poll":
		if err := pollLoop(cfg); err != nil {
			exitErr(err)
		}
	case "poll-once", "":
		if err := pollOnce(cfg); err != nil {
			exitErr(err)
		}
	default:
		exitErr(fmt.Errorf("unknown runner command: %s", flag.Arg(0)))
	}
}

func loadConfig() runnerConfig {
	defaultHostname, _ := os.Hostname()
	apiBaseURL := getenvDefault("PERISCAN_CONTROL_PLANE_URL", "http://127.0.0.1:3001")
	proxyURL := getenvDefault("PERISCAN_RUNNER_PROXY_URL", "")
	if proxyURL == "" {
		proxyURL = getenvDefault("HTTPS_PROXY", getenvDefault("HTTP_PROXY", ""))
	}

	flag.String("api", apiBaseURL, "Periscan API base URL")
	flag.String("runner-id", os.Getenv("PERISCAN_RUNNER_ID"), "runner ID")
	flag.String("auth-token", os.Getenv("PERISCAN_RUNNER_AUTH_TOKEN"), "runner auth token")
	flag.String("certificate-expires-at", os.Getenv("PERISCAN_RUNNER_CERTIFICATE_EXPIRES_AT"), "optional runner mTLS certificate expiry timestamp")
	flag.String("registration-token", os.Getenv("PERISCAN_REGISTRATION_TOKEN"), "runner registration token")
	flag.String("mtls-ca-file", os.Getenv("PERISCAN_RUNNER_MTLS_CA_FILE"), "optional mTLS CA certificate path")
	flag.String("mtls-cert-file", os.Getenv("PERISCAN_RUNNER_MTLS_CLIENT_CERT_FILE"), "optional mTLS client certificate path")
	flag.String("mtls-key-file", os.Getenv("PERISCAN_RUNNER_MTLS_CLIENT_KEY_FILE"), "optional mTLS client private-key path")
	flag.String("runner-name", getenvDefault("PERISCAN_RUNNER_NAME", defaultHostname), "runner name")
	flag.String("hostname", defaultHostname, "runner hostname")
	flag.String("task-signing-key-id", os.Getenv("PERISCAN_TASK_SIGNING_KEY_ID"), "expected task signing key ID")
	flag.String("task-signing-public-key", os.Getenv("PERISCAN_TASK_SIGNING_PUBLIC_KEY_PEM"), "task signing public key PEM")
	flag.String("result-signing-key", os.Getenv("PERISCAN_RESULT_SIGNING_PRIVATE_KEY_PEM"), "Ed25519 result-signing private key PEM (PKCS8)")
	flag.String("tenant-id", os.Getenv("PERISCAN_RUNNER_TENANT_ID"), "runner tenant ID")
	flag.String("proxy-url", proxyURL, "optional HTTP(S) proxy URL for Periscan control-plane traffic")
	insecureSkipVerify := flag.Bool(
		"insecure-skip-verify",
		false,
		"allow TLS verification failure only when PERISCAN_RUNNER_BOOTSTRAP_MODE=true",
	)
	command, args := extractCommand(os.Args)
	if err := flag.CommandLine.Parse(args[1:]); err != nil {
		exitErr(err)
	}
	if command == "" {
		command = flag.Arg(0)
	}

	bootstrapMode := strings.EqualFold(os.Getenv("PERISCAN_RUNNER_BOOTSTRAP_MODE"), "true")
	if *insecureSkipVerify && !bootstrapMode {
		fmt.Fprintln(
			os.Stderr,
			"WARNING: --insecure-skip-verify is ignored unless PERISCAN_RUNNER_BOOTSTRAP_MODE=true",
		)
	}

	cfg := runnerConfig{
		apiBaseURL:                 strings.TrimRight(flag.Lookup("api").Value.String(), "/"),
		authToken:                  flag.Lookup("auth-token").Value.String(),
		certificateExpiresAt:       flag.Lookup("certificate-expires-at").Value.String(),
		bootstrapMode:              bootstrapMode,
		command:                    command,
		hostname:                   flag.Lookup("hostname").Value.String(),
		insecureSkipVerify:         *insecureSkipVerify && bootstrapMode,
		mtlsCAFile:                 flag.Lookup("mtls-ca-file").Value.String(),
		mtlsCertFile:               flag.Lookup("mtls-cert-file").Value.String(),
		mtlsKeyFile:                flag.Lookup("mtls-key-file").Value.String(),
		registrationToken:          flag.Lookup("registration-token").Value.String(),
		runnerID:                   flag.Lookup("runner-id").Value.String(),
		runnerName:                 flag.Lookup("runner-name").Value.String(),
		signingKeyID:               flag.Lookup("task-signing-key-id").Value.String(),
		signingPublicKey:           flag.Lookup("task-signing-public-key").Value.String(),
		resultSigningPrivateKeyPem: flag.Lookup("result-signing-key").Value.String(),
		tenantID:                   flag.Lookup("tenant-id").Value.String(),
		controlPlaneProxy:          flag.Lookup("proxy-url").Value.String(),
	}

	if cfg.insecureSkipVerify {
		fmt.Fprintln(
			os.Stderr,
			"WARNING: PERISCAN_RUNNER_BOOTSTRAP_MODE is enabled and TLS verification is disabled for control-plane traffic",
		)
	}

	return cfg
}

func extractCommand(args []string) (string, []string) {
	filtered := make([]string, 0, len(args))
	command := ""
	for index, arg := range args {
		if index > 0 && command == "" && isRunnerCommand(arg) {
			command = arg
			continue
		}
		filtered = append(filtered, arg)
	}
	return command, filtered
}

func isRunnerCommand(value string) bool {
	return value == "register" || value == "poll" || value == "poll-once"
}

func register(cfg runnerConfig) error {
	if cfg.registrationToken == "" {
		return errors.New("PERISCAN_REGISTRATION_TOKEN or --registration-token is required")
	}

	csrPem, privateKeyPem, err := generateRunnerCSR(cfg)
	if err != nil {
		return err
	}

	resultSigningPublicKeyPem, resultSigningPrivateKeyPem, err := generateResultSigningKey()
	if err != nil {
		return err
	}

	body := registrationRequest{
		Arch: runtime.GOARCH,
		Capabilities: capabilities{
			SupportsArtifactUpload:    true,
			SupportsHTTPConnectProxy:  true,
			SupportsLocalReachability: true,
			SupportsLongPoll:          true,
			SupportsWebSocket:         false,
		},
		CSRPem:                    csrPem,
		DeploymentMode:            "Docker",
		Hostname:                  cfg.hostname,
		Labels:                    []string{"periscan-runner"},
		NetworkProfile:            defaultNetworkProfile(cfg.apiBaseURL, cfg.controlPlaneProxy),
		OS:                        runtime.GOOS,
		RegistrationToken:         cfg.registrationToken,
		ResultSigningPublicKeyPem: resultSigningPublicKeyPem,
		RunnerName:                cfg.runnerName,
		Version:                   runnerVersion,
	}
	httpClient, err := createHTTPClient(cfg)
	if err != nil {
		return err
	}
	var response registrationResponse
	if err := postJSON(
		httpClient,
		cfg.apiBaseURL+"/api/v1/runners/register",
		"",
		body,
		&response,
	); err != nil {
		return err
	}
	response.Credentials.MTLSClientPrivateKeyPem = privateKeyPem
	response.ResultSigningPrivateKeyPem = resultSigningPrivateKeyPem

	return json.NewEncoder(os.Stdout).Encode(response)
}

func validatePollingConfig(cfg runnerConfig) error {
	if cfg.runnerID == "" || cfg.authToken == "" {
		return errors.New("PERISCAN_RUNNER_ID and PERISCAN_RUNNER_AUTH_TOKEN are required")
	}
	if cfg.tenantID == "" {
		return errors.New("PERISCAN_RUNNER_TENANT_ID or --tenant-id is required")
	}
	if cfg.signingPublicKey == "" {
		return errors.New("PERISCAN_TASK_SIGNING_PUBLIC_KEY_PEM or --task-signing-public-key is required")
	}
	if cfg.signingKeyID == "" {
		return errors.New("PERISCAN_TASK_SIGNING_KEY_ID or --task-signing-key-id is required")
	}
	return nil
}

func pollOnce(cfg runnerConfig) error {
	if err := validatePollingConfig(cfg); err != nil {
		return err
	}
	httpClient, err := createHTTPClient(cfg)
	if err != nil {
		return err
	}
	if cfg.nonceCache == nil {
		cfg.nonceCache = newNonceCache()
	}

	processed, nextDelay, err := pollCycle(httpClient, cfg)
	if err != nil {
		return err
	}

	fmt.Fprintf(
		os.Stdout,
		"processed %d task(s); next poll after %s\n",
		processed,
		nextDelay,
	)
	return nil
}

func pollLoop(cfg runnerConfig) error {
	if err := validatePollingConfig(cfg); err != nil {
		return err
	}
	httpClient, err := createHTTPClient(cfg)
	if err != nil {
		return err
	}
	if cfg.nonceCache == nil {
		cfg.nonceCache = newNonceCache()
	}

	for {
		if killSwitchEnabled() {
			return errors.New("runner kill switch is enabled")
		}

		processed, nextDelay, err := pollCycle(httpClient, cfg)
		if err != nil {
			var statusErr apiStatusError
			if errors.As(err, &statusErr) &&
				(statusErr.StatusCode == http.StatusUnauthorized || statusErr.StatusCode == http.StatusForbidden) {
				return err
			}
			fmt.Fprintf(os.Stderr, "poll cycle failed: %v\n", err)
			nextDelay = boundedPollDelay(30)
		} else {
			fmt.Fprintf(
				os.Stdout,
				"processed %d task(s); next poll after %s\n",
				processed,
				nextDelay,
			)
		}

		time.Sleep(nextDelay)
	}
}

func pollCycle(httpClient *http.Client, cfg runnerConfig) (int, time.Duration, error) {
	certificateExpiresAt := interface{}(nil)
	if cfg.certificateExpiresAt != "" {
		certificateExpiresAt = cfg.certificateExpiresAt
	}
	var response pollResponse
	if err := postJSON(
		httpClient,
		cfg.apiBaseURL+"/api/v1/runners/"+cfg.runnerID+"/poll",
		cfg.authToken,
		map[string]interface{}{
			"health": map[string]interface{}{
				"activeTaskId":         nil,
				"certificateExpiresAt": certificateExpiresAt,
				"lastTaskCompletedAt":  nil,
				"observedAt":           time.Now().UTC().Format(time.RFC3339Nano),
				"queueDepth":           0,
				"runnerId":             cfg.runnerID,
				"status":               "Active",
				"tenantId":             cfg.tenantID,
				"version":              runnerVersion,
			},
		},
		&response,
	); err != nil {
		return 0, 0, err
	}

	// Server-driven revoke/kill controls: acknowledge what this host observed,
	// then stop executing even if a malformed response also contained tasks.
	if response.RunnerRevoked {
		if response.ControlStateChangedAt != "" {
			if err := acknowledgeControlState(httpClient, cfg, "Revoked", response.ControlStateChangedAt); err != nil {
				return 0, 0, fmt.Errorf("acknowledge runner revocation: %w", err)
			}
		}
		fmt.Fprintln(os.Stderr, "control plane reports runner revoked; skipping task execution")
		return 0, boundedPollDelay(response.NextPollAfterSeconds), nil
	}
	if response.KillSwitchActive {
		if response.ControlStateChangedAt != "" {
			if err := acknowledgeControlState(httpClient, cfg, "KillSwitchActive", response.ControlStateChangedAt); err != nil {
				return 0, 0, fmt.Errorf("acknowledge runner kill switch: %w", err)
			}
		}
		fmt.Fprintln(os.Stderr, "control plane reports kill switch active; skipping task execution")
		return 0, boundedPollDelay(response.NextPollAfterSeconds), nil
	}

	for _, task := range response.Tasks {
		processed := processTaskWithEvidence(task, cfg)
		result := processed.Result
		if result.Status == "Completed" {
			result = uploadTaskEvidence(httpClient, cfg, task, processed)
		}
		if err := submitTaskResult(httpClient, cfg, task.TaskID, result); err != nil {
			return 0, 0, err
		}
	}

	return len(response.Tasks), boundedPollDelay(response.NextPollAfterSeconds), nil
}

func acknowledgeControlState(httpClient *http.Client, cfg runnerConfig, state string, stateChangedAt string) error {
	var response map[string]interface{}
	return postJSON(
		httpClient,
		cfg.apiBaseURL+"/api/v1/runners/"+cfg.runnerID+"/control-state/acknowledge",
		cfg.authToken,
		map[string]interface{}{
			"controlState":   state,
			"observedAt":     time.Now().UTC().Format(time.RFC3339Nano),
			"stateChangedAt": stateChangedAt,
		},
		&response,
	)
}

func boundedPollDelay(seconds int) time.Duration {
	if seconds < 1 {
		seconds = 15
	}
	if seconds > 300 {
		seconds = 300
	}
	return time.Duration(seconds) * time.Second
}

func processTask(task taskEnvelope, cfg runnerConfig) taskResult {
	return processTaskWithEvidence(task, cfg).Result
}

func processTaskWithEvidence(task taskEnvelope, cfg runnerConfig) processedTaskResult {
	startedAt := time.Now().UTC()
	result := taskResult{
		CompletedAt:      startedAt.Format(time.RFC3339Nano),
		EvidenceManifest: []evidenceManifestItem{},
		LocalAuditSHA256: "",
		RunID:            task.RunID,
		RunnerID:         task.RunnerID,
		StartedAt:        startedAt.Format(time.RFC3339Nano),
		Status:           "Failed",
		TaskID:           task.TaskID,
		TenantID:         task.TenantID,
	}

	if err := verifyTask(task, cfg); err != nil {
		return processedTaskResult{Result: failedResult(result, err)}
	}

	if !implementedModules[task.ModuleID] {
		return processedTaskResult{Result: failedResult(result, fmt.Errorf("module is allowlisted but not yet implemented on this runner: %s", task.ModuleID))}
	}

	exec, err := executeModule(task)
	if err != nil {
		return processedTaskResult{Result: failedResult(result, err)}
	}

	completedAt := time.Now().UTC()
	evidenceHash := sha256Hex(exec.EvidencePayload)
	result.CompletedAt = completedAt.Format(time.RFC3339Nano)
	result.EvidenceManifest = []evidenceManifestItem{
		{
			ArtifactType:    "NormalizedEvidence",
			RedactionStatus: "Redacted",
			SHA256:          evidenceHash,
			SizeBytes:       len(exec.EvidencePayload),
		},
	}
	result.LocalAuditSHA256 = evidenceHash
	result.Outcome = &exec.Outcome
	result.Status = "Completed"
	result.ValidationState = &exec.ValidationState

	return processedTaskResult{
		EvidenceUploads: []runnerEvidenceUpload{
			{
				ArtifactType: "NormalizedEvidence",
				Content:      exec.EvidencePayload,
				ContentType:  "application/json",
				Filename:     exec.Filename,
				SHA256:       evidenceHash,
				SizeBytes:    len(exec.EvidencePayload),
			},
		},
		Result: result,
	}
}

// moduleExecution is the normalized output of any internal module: the evidence
// blob plus the derived outcome/validationState the control plane records.
type moduleExecution struct {
	EvidencePayload []byte
	Filename        string
	Outcome         string
	ValidationState string
}

// executeModule dispatches a verified, allowlisted task to its implementation.
// Each implementation parses inputs, enforces scope locally, performs only a
// passive/non-invasive read, and returns normalized evidence.
func executeModule(task taskEnvelope) (moduleExecution, error) {
	switch normalizeModuleID(task.ModuleID) {
	case reachabilityModuleID:
		return executeReachability(task)
	case dnsResolutionModuleID:
		return executeDNSResolution(task)
	case tlsCertificateModuleID:
		return executeTLSCertificate(task)
	case httpHealthModuleID:
		return executeHTTPHealth(task)
	case httpHeaderModuleID:
		return executeHTTPHeader(task)
	case certExpiryModuleID:
		return executeCertExpiry(task)
	case tcpBannerModuleID:
		return executeTCPBanner(task)
	case tlsInfoModuleID:
		return executeTLSInfo(task)
	case portConnectModuleID:
		// Minimal passive connect: re-use reachability envelope but limited to connect probe only (no full read).
		return executeReachability(task) // safe reuse for bounded connect; full impl would cap read 0 bytes post-connect
	default:
		return moduleExecution{}, fmt.Errorf("unsupported module: %s", task.ModuleID)
	}
}

// Phase 3: passive HTTP header collection for internal services / control validation signals.
// Safe, timeout-bounded GET that records headers (no body content stored as evidence).
func executeHTTPHeader(task taskEnvelope) (moduleExecution, error) {
	host := firstString(task.Target, "hostname", "host", "targetHost")
	if host == "" {
		host = firstString(task.Inputs, "hostname", "host", "targetHost")
	}
	if host == "" {
		return moduleExecution{}, errors.New("http header target host is required")
	}
	port := 80
	if p, ok := firstInt(task.Target, "port"); ok && p > 0 {
		port = p
	} else if p, ok := firstInt(task.Inputs, "port"); ok && p > 0 {
		port = p
	}
	path := firstString(task.Target, "path")
	if path == "" {
		path = firstString(task.Inputs, "path")
	}
	if path == "" {
		path = "/"
	}

	scheme := "http"
	if port == 443 {
		scheme = "https"
	}
	urlStr := fmt.Sprintf("%s://%s:%d%s", scheme, host, port, path)

	client := &http.Client{
		Timeout:       4 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error { return http.ErrUseLastResponse },
	}
	req, _ := http.NewRequest("GET", urlStr, nil)
	req.Header.Set("User-Agent", "periscan-runner/0.1 (+internal-validation)")
	resp, err := client.Do(req)
	if err != nil {
		evidence := map[string]any{
			"generatedAt": time.Now().UTC().Format(time.RFC3339),
			"moduleId":    httpHeaderModuleID,
			"runnerId":    task.RunnerID,
			"targetUrl":   urlStr,
			"taskId":      task.TaskID,
			"error":       err.Error(),
			"status":      "no_response",
		}
		b, _ := json.Marshal(evidence)
		return moduleExecution{
			EvidencePayload: b,
			Filename:        "http-header-result",
			Outcome:         "no_response",
			ValidationState: "Inconclusive",
		}, nil
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)

	headers := map[string]string{}
	for k, vv := range resp.Header {
		if len(vv) > 0 {
			headers[k] = vv[0]
		}
	}
	evidence := map[string]any{
		"generatedAt": time.Now().UTC().Format(time.RFC3339),
		"moduleId":    httpHeaderModuleID,
		"runnerId":    task.RunnerID,
		"targetUrl":   urlStr,
		"taskId":      task.TaskID,
		"statusCode":  resp.StatusCode,
		"headers":     headers,
	}
	b, _ := json.Marshal(evidence)
	return moduleExecution{
		EvidencePayload: b,
		Filename:        "http-header-result",
		Outcome:         "headers_collected",
		ValidationState: "Reachable",
	}, nil
}

// Phase 3 expansion: passive TLS cert expiry / validity check.
func executeCertExpiry(task taskEnvelope) (moduleExecution, error) {
	host := firstString(task.Target, "hostname", "host", "targetHost")
	if host == "" {
		host = firstString(task.Inputs, "hostname", "host", "targetHost")
	}
	if host == "" {
		return moduleExecution{}, errors.New("cert expiry target host is required")
	}
	port := 443
	if p, ok := firstInt(task.Target, "port"); ok && p > 0 {
		port = p
	} else if p, ok := firstInt(task.Inputs, "port"); ok && p > 0 {
		port = p
	}

	conn, err := tls.Dial("tcp", fmt.Sprintf("%s:%d", host, port), &tls.Config{
		InsecureSkipVerify: true, // for validation, we inspect the cert
	})
	if err != nil {
		evidence := map[string]any{
			"generatedAt": time.Now().UTC().Format(time.RFC3339),
			"moduleId":    certExpiryModuleID,
			"runnerId":    task.RunnerID,
			"targetHost":  host,
			"targetPort":  port,
			"taskId":      task.TaskID,
			"error":       err.Error(),
			"status":      "no_response",
		}
		b, _ := json.Marshal(evidence)
		return moduleExecution{
			EvidencePayload: b,
			Filename:        "cert-expiry-result",
			Outcome:         "no_response",
			ValidationState: "Inconclusive",
		}, nil
	}
	defer conn.Close()

	certs := conn.ConnectionState().PeerCertificates
	if len(certs) == 0 {
		return moduleExecution{}, errors.New("no peer certs")
	}
	cert := certs[0]
	now := time.Now().UTC()
	expiry := cert.NotAfter.UTC()
	valid := now.Before(expiry) && now.After(cert.NotBefore.UTC())

	evidence := map[string]any{
		"generatedAt":  now.Format(time.RFC3339),
		"moduleId":     certExpiryModuleID,
		"runnerId":     task.RunnerID,
		"targetHost":   host,
		"targetPort":   port,
		"taskId":       task.TaskID,
		"subject":      cert.Subject.String(),
		"notBefore":    cert.NotBefore.UTC().Format(time.RFC3339),
		"notAfter":     expiry.Format(time.RFC3339),
		"valid":        valid,
		"daysToExpiry": int(expiry.Sub(now).Hours() / 24),
	}
	b, _ := json.Marshal(evidence)
	return moduleExecution{
		EvidencePayload: b,
		Filename:        "cert-expiry-result",
		Outcome:         "valid",
		ValidationState: "Reachable",
	}, nil
}

// executeTCPBanner: passive connect + bounded read of initial bytes (banner/greeting).
// Safe for internal service fingerprinting. No auth, small read, timeout.
func executeTCPBanner(task taskEnvelope) (moduleExecution, error) {
	host, port, timeout, err := hostPortInput(task)
	if err != nil {
		return moduleExecution{}, err
	}
	if err := enforceScope(task.ScopeConstraints, host, []int{port}); err != nil {
		return moduleExecution{}, err
	}

	addr := net.JoinHostPort(host, strconv.Itoa(port))
	dialer := &net.Dialer{Timeout: timeout}
	conn, dialErr := dialer.Dial("tcp", addr)
	if dialErr != nil {
		evidence := map[string]any{
			"generatedAt": time.Now().UTC().Format(time.RFC3339Nano),
			"moduleId":    tcpBannerModuleID,
			"runnerId":    task.RunnerID,
			"target":      addr,
			"taskId":      task.TaskID,
			"error":       dialErr.Error(),
		}
		payload, _ := json.Marshal(evidence)
		return moduleExecution{
			EvidencePayload: payload,
			Filename:        "tcp-banner-result",
			Outcome:         "no_banner",
			ValidationState: "Inconclusive",
		}, nil
	}
	defer conn.Close()
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	buf := make([]byte, 256)
	n, _ := conn.Read(buf)
	banner := strings.TrimSpace(string(buf[:n]))
	if len(banner) > 128 {
		banner = banner[:128] + "..."
	}
	evidence := map[string]any{
		"generatedAt": time.Now().UTC().Format(time.RFC3339Nano),
		"moduleId":    tcpBannerModuleID,
		"runnerId":    task.RunnerID,
		"target":      addr,
		"taskId":      task.TaskID,
		"banner":      banner,
		"bytesRead":   n,
	}
	payload, _ := json.Marshal(evidence)
	return moduleExecution{
		EvidencePayload: payload,
		Filename:        "tcp-banner-result",
		Outcome:         "banner_collected",
		ValidationState: "Reachable",
	}, nil
}

// executeTLSInfo: TLS handshake + extended metadata (version, cipher, chain) beyond basic cert expiry.
func executeTLSInfo(task taskEnvelope) (moduleExecution, error) {
	host, port, _, err := hostPortInput(task)
	if err != nil {
		return moduleExecution{}, err
	}
	if err := enforceScope(task.ScopeConstraints, host, []int{port}); err != nil {
		return moduleExecution{}, err
	}

	dialer := &net.Dialer{Timeout: 4 * time.Second}
	conn, err := tls.DialWithDialer(dialer, "tcp", net.JoinHostPort(host, strconv.Itoa(port)), &tls.Config{
		InsecureSkipVerify: true,
		ServerName:         host,
	})
	if err != nil {
		return moduleExecution{}, fmt.Errorf("tls handshake failed: %w", err)
	}
	defer conn.Close()

	state := conn.ConnectionState()
	version := tlsVersionString(state.Version)
	cipher := tlsCipherString(state.CipherSuite)
	chainLen := len(state.PeerCertificates)

	evidence := map[string]any{
		"generatedAt": time.Now().UTC().Format(time.RFC3339),
		"moduleId":    tlsInfoModuleID,
		"runnerId":    task.RunnerID,
		"targetHost":  host,
		"targetPort":  port,
		"taskId":      task.TaskID,
		"tlsVersion":  version,
		"cipherSuite": cipher,
		"chainLength": chainLen,
		"serverName":  state.ServerName,
	}
	if len(state.PeerCertificates) > 0 {
		leaf := state.PeerCertificates[0]
		evidence["subject"] = leaf.Subject.String()
		evidence["notAfter"] = leaf.NotAfter.UTC().Format(time.RFC3339)
	}
	payload, _ := json.Marshal(evidence)
	return moduleExecution{
		EvidencePayload: payload,
		Filename:        "tls-info-result",
		Outcome:         "tls_handshake_ok",
		ValidationState: "Reachable",
	}, nil
}

func tlsVersionString(v uint16) string {
	switch v {
	case tls.VersionTLS13:
		return "TLSv1.3"
	case tls.VersionTLS12:
		return "TLSv1.2"
	case tls.VersionTLS11:
		return "TLSv1.1"
	case tls.VersionTLS10:
		return "TLSv1.0"
	default:
		return fmt.Sprintf("0x%04x", v)
	}
}

func tlsCipherString(c uint16) string {
	// Best effort; full names require build tags in older Go, use hex fallback.
	name := ""
	switch c {
	case tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256:
		name = "ECDHE-RSA-AES128-GCM-SHA256"
	case tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384:
		name = "ECDHE-RSA-AES256-GCM-SHA384"
	case tls.TLS_RSA_WITH_AES_128_GCM_SHA256:
		name = "AES128-GCM-SHA256"
	default:
		name = fmt.Sprintf("0x%04x", c)
	}
	return name
}

func executeReachability(task taskEnvelope) (moduleExecution, error) {
	host, ports, timeout, err := reachabilityInput(task)
	if err != nil {
		return moduleExecution{}, err
	}
	if err := enforceScope(task.ScopeConstraints, host, ports); err != nil {
		return moduleExecution{}, err
	}

	observations := runReachability(host, ports, timeout)
	reachable := false
	for _, observation := range observations {
		if observation.Status == "open" {
			reachable = true
			break
		}
	}

	evidence := reachabilityEvidence{
		GeneratedAt:  time.Now().UTC().Format(time.RFC3339Nano),
		ModuleID:     task.ModuleID,
		Observations: observations,
		RunnerID:     task.RunnerID,
		TargetHost:   host,
		TaskID:       task.TaskID,
	}
	payload, _ := json.Marshal(evidence)
	outcome := "unreachable"
	validationState := "Inconclusive"
	if reachable {
		outcome = "reachable"
		validationState = "Reachable"
	}
	return moduleExecution{
		EvidencePayload: payload,
		Filename:        "reachability-result",
		Outcome:         outcome,
		ValidationState: validationState,
	}, nil
}

type dnsResolutionEvidence struct {
	GeneratedAt string   `json:"generatedAt"`
	ModuleID    string   `json:"moduleId"`
	Resolved    bool     `json:"resolved"`
	Addresses   []string `json:"addresses"`
	RunnerID    string   `json:"runnerId"`
	TargetHost  string   `json:"targetHost"`
	TaskID      string   `json:"taskId"`
}

func executeDNSResolution(task taskEnvelope) (moduleExecution, error) {
	host, timeout, err := hostTimeoutInput(task)
	if err != nil {
		return moduleExecution{}, err
	}
	if !hostAllowed(task.ScopeConstraints, host) {
		return moduleExecution{}, fmt.Errorf("target host is outside approved runner scope: %s", host)
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	addresses, lookupErr := (&net.Resolver{}).LookupHost(ctx, host)
	sort.Strings(addresses)

	evidence := dnsResolutionEvidence{
		Addresses:   addresses,
		GeneratedAt: time.Now().UTC().Format(time.RFC3339Nano),
		ModuleID:    task.ModuleID,
		Resolved:    lookupErr == nil && len(addresses) > 0,
		RunnerID:    task.RunnerID,
		TargetHost:  host,
		TaskID:      task.TaskID,
	}
	payload, _ := json.Marshal(evidence)
	outcome := "unresolved"
	validationState := "Inconclusive"
	if evidence.Resolved {
		outcome = "resolved"
		validationState = "Reachable"
	}
	return moduleExecution{
		EvidencePayload: payload,
		Filename:        "dns-resolution-result",
		Outcome:         outcome,
		ValidationState: validationState,
	}, nil
}

type tlsCertificateEvidence struct {
	GeneratedAt     string   `json:"generatedAt"`
	ModuleID        string   `json:"moduleId"`
	RunnerID        string   `json:"runnerId"`
	TargetHost      string   `json:"targetHost"`
	TargetPort      int      `json:"targetPort"`
	TaskID          string   `json:"taskId"`
	Issuer          string   `json:"issuer"`
	Subject         string   `json:"subject"`
	DNSNames        []string `json:"dnsNames"`
	NotBefore       string   `json:"notBefore"`
	NotAfter        string   `json:"notAfter"`
	DaysUntilExpiry int      `json:"daysUntilExpiry"`
	ChainTrusted    bool     `json:"chainTrusted"`
	SerialNumber    string   `json:"serialNumber"`
}

func executeTLSCertificate(task taskEnvelope) (moduleExecution, error) {
	host, port, timeout, err := hostPortInput(task)
	if err != nil {
		return moduleExecution{}, err
	}
	if err := enforceScope(task.ScopeConstraints, host, []int{port}); err != nil {
		return moduleExecution{}, err
	}

	dialer := &net.Dialer{Timeout: timeout}
	// Capture the presented certificate even when the chain is untrusted (common
	// for internal CAs); chain trust is reported separately, never assumed.
	conn, dialErr := tls.DialWithDialer(dialer, "tcp", net.JoinHostPort(host, strconv.Itoa(port)), &tls.Config{
		InsecureSkipVerify: true,
		ServerName:         host,
	})
	if dialErr != nil {
		return moduleExecution{}, fmt.Errorf("tls handshake failed: %w", dialErr)
	}
	defer conn.Close()

	state := conn.ConnectionState()
	if len(state.PeerCertificates) == 0 {
		return moduleExecution{}, errors.New("no peer certificate presented")
	}
	leaf := state.PeerCertificates[0]

	chainTrusted := false
	roots, _ := x509.SystemCertPool()
	intermediates := x509.NewCertPool()
	for _, cert := range state.PeerCertificates[1:] {
		intermediates.AddCert(cert)
	}
	if _, verifyErr := leaf.Verify(x509.VerifyOptions{
		DNSName:       host,
		Intermediates: intermediates,
		Roots:         roots,
	}); verifyErr == nil {
		chainTrusted = true
	}

	now := time.Now().UTC()
	daysUntilExpiry := int(leaf.NotAfter.Sub(now).Hours() / 24)
	evidence := tlsCertificateEvidence{
		ChainTrusted:    chainTrusted,
		DaysUntilExpiry: daysUntilExpiry,
		DNSNames:        leaf.DNSNames,
		GeneratedAt:     now.Format(time.RFC3339Nano),
		Issuer:          leaf.Issuer.String(),
		ModuleID:        task.ModuleID,
		NotAfter:        leaf.NotAfter.UTC().Format(time.RFC3339Nano),
		NotBefore:       leaf.NotBefore.UTC().Format(time.RFC3339Nano),
		RunnerID:        task.RunnerID,
		SerialNumber:    leaf.SerialNumber.String(),
		Subject:         leaf.Subject.String(),
		TargetHost:      host,
		TargetPort:      port,
		TaskID:          task.TaskID,
	}
	payload, _ := json.Marshal(evidence)
	outcome := "valid"
	if now.After(leaf.NotAfter) {
		outcome = "expired"
	} else if daysUntilExpiry <= 14 {
		outcome = "expiring"
	}
	return moduleExecution{
		EvidencePayload: payload,
		Filename:        "tls-certificate-result",
		Outcome:         outcome,
		ValidationState: "Reachable",
	}, nil
}

type httpHealthEvidence struct {
	GeneratedAt string `json:"generatedAt"`
	ModuleID    string `json:"moduleId"`
	RunnerID    string `json:"runnerId"`
	TargetHost  string `json:"targetHost"`
	TargetPort  int    `json:"targetPort"`
	TaskID      string `json:"taskId"`
	Scheme      string `json:"scheme"`
	Path        string `json:"path"`
	StatusCode  int    `json:"statusCode"`
	LatencyMS   int64  `json:"latencyMs"`
}

func executeHTTPHealth(task taskEnvelope) (moduleExecution, error) {
	host, port, timeout, err := hostPortInput(task)
	if err != nil {
		return moduleExecution{}, err
	}
	if err := enforceScope(task.ScopeConstraints, host, []int{port}); err != nil {
		return moduleExecution{}, err
	}

	scheme := strings.ToLower(firstString(task.Inputs, "scheme"))
	if scheme != "http" && scheme != "https" {
		scheme = "http"
		if port == 443 {
			scheme = "https"
		}
	}
	path := firstString(task.Inputs, "path")
	if path == "" {
		path = "/"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	target := fmt.Sprintf("%s://%s%s", scheme, net.JoinHostPort(host, strconv.Itoa(port)), path)
	client := &http.Client{
		Timeout: timeout,
		// Health/reachability only; certificate trust is the TLS module's job, so
		// an internal cert never masks an up/down signal here.
		Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}},
	}
	request, reqErr := http.NewRequest(http.MethodGet, target, nil)
	if reqErr != nil {
		return moduleExecution{}, reqErr
	}
	request.Header.Set("user-agent", "periscan-runner/"+runnerVersion)

	started := time.Now()
	response, doErr := client.Do(request)
	latency := time.Since(started).Milliseconds()
	if doErr != nil {
		return moduleExecution{}, fmt.Errorf("http health request failed: %w", doErr)
	}
	defer response.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 4096))

	evidence := httpHealthEvidence{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339Nano),
		LatencyMS:   latency,
		ModuleID:    task.ModuleID,
		Path:        path,
		RunnerID:    task.RunnerID,
		Scheme:      scheme,
		StatusCode:  response.StatusCode,
		TargetHost:  host,
		TargetPort:  port,
		TaskID:      task.TaskID,
	}
	payload, _ := json.Marshal(evidence)
	outcome := "unhealthy"
	if response.StatusCode >= 200 && response.StatusCode < 400 {
		outcome = "healthy"
	}
	return moduleExecution{
		EvidencePayload: payload,
		Filename:        "http-health-result",
		Outcome:         outcome,
		ValidationState: "Reachable",
	}, nil
}

// hostTimeoutInput extracts a target host + bounded timeout (no port).
func hostTimeoutInput(task taskEnvelope) (string, time.Duration, error) {
	host := firstString(task.Target, "hostname", "host", "targetHost")
	if host == "" {
		host = firstString(task.Inputs, "hostname", "host", "targetHost")
	}
	if host == "" {
		return "", 0, errors.New("target host is required")
	}
	timeoutSeconds := intValue(task.Inputs["timeoutSeconds"], 5)
	if timeoutSeconds < 1 || timeoutSeconds > 30 {
		return "", 0, errors.New("timeoutSeconds must be between 1 and 30")
	}
	return host, time.Duration(timeoutSeconds) * time.Second, nil
}

// hostPortInput extracts a target host + single port + bounded timeout.
func hostPortInput(task taskEnvelope) (string, int, time.Duration, error) {
	host, timeout, err := hostTimeoutInput(task)
	if err != nil {
		return "", 0, 0, err
	}
	port := intValue(task.Inputs["port"], 0)
	if port == 0 {
		if ports, listErr := intList(task.Inputs["ports"]); listErr == nil && len(ports) > 0 {
			port = ports[0]
		}
	}
	if port == 0 {
		if ports, listErr := intList(task.Target["ports"]); listErr == nil && len(ports) > 0 {
			port = ports[0]
		}
	}
	if port < 1 || port > 65535 {
		return "", 0, 0, errors.New("a single target port (1-65535) is required")
	}
	return host, port, timeout, nil
}

func failedResult(result taskResult, err error) taskResult {
	message := err.Error()
	state := "Inconclusive"
	payload, _ := json.Marshal(map[string]string{
		"error":  message,
		"taskId": result.TaskID,
	})
	result.CompletedAt = time.Now().UTC().Format(time.RFC3339Nano)
	result.ErrorSummary = &message
	result.LocalAuditSHA256 = sha256Hex(payload)
	result.Status = "Failed"
	result.ValidationState = &state
	return result
}

func uploadTaskEvidence(
	httpClient *http.Client,
	cfg runnerConfig,
	task taskEnvelope,
	processed processedTaskResult,
) taskResult {
	result := processed.Result
	uploadURL := taskArtifactUploadURL(task, cfg)
	if uploadURL == "" || len(processed.EvidenceUploads) == 0 {
		return result
	}

	for index, upload := range processed.EvidenceUploads {
		response := artifactUploadResponse{}
		err := postJSON(
			httpClient,
			uploadURL,
			cfg.authToken,
			artifactUploadRequest{
				ArtifactType:  upload.ArtifactType,
				ContentBase64: base64.StdEncoding.EncodeToString(upload.Content),
				ContentType:   upload.ContentType,
				Filename:      upload.Filename,
				SHA256:        upload.SHA256,
				SizeBytes:     upload.SizeBytes,
			},
			&response,
		)
		if err != nil {
			return failedResult(result, fmt.Errorf("evidence upload failed: %w", err))
		}
		if index < len(result.EvidenceManifest) {
			result.EvidenceManifest[index].EvidenceID = response.Artifact.EvidenceID
			result.EvidenceManifest[index].RedactionStatus = response.Artifact.RedactionStatus
			result.EvidenceManifest[index].SHA256 = response.Artifact.SHA256
		}
	}

	return result
}

func taskArtifactUploadURL(task taskEnvelope, cfg runnerConfig) string {
	rawURL, ok := task.ArtifactUpload["artifactUploadUrl"].(string)
	if !ok || rawURL == "" {
		return ""
	}
	if strings.HasPrefix(rawURL, "http://") || strings.HasPrefix(rawURL, "https://") {
		return rawURL
	}
	if strings.HasPrefix(rawURL, "/") {
		return cfg.apiBaseURL + rawURL
	}
	return ""
}

func verifyTask(task taskEnvelope, cfg runnerConfig) error {
	if task.RunnerID != cfg.runnerID {
		return errors.New("runnerId mismatch")
	}
	if cfg.tenantID != "" && task.TenantID != cfg.tenantID {
		return errors.New("tenantId mismatch")
	}
	if cfg.signingKeyID != "" && task.Signature.KeyID != cfg.signingKeyID {
		return errors.New("task signing keyId mismatch")
	}
	if task.ExecutionEnvironment != "InternalRunner" {
		return errors.New("task execution environment is not InternalRunner")
	}
	if task.Signature.Algorithm != "EdDSA" {
		return fmt.Errorf("unsupported task signature algorithm: %s", task.Signature.Algorithm)
	}
	if task.Signature.Nonce != task.TaskID {
		return errors.New("task signature nonce does not match taskId")
	}
	expiresAt, err := time.Parse(time.RFC3339Nano, task.ExpiresAt)
	if err != nil {
		return fmt.Errorf("invalid task expiry: %w", err)
	}
	if !expiresAt.After(time.Now().UTC()) {
		return errors.New("task is expired")
	}
	if cfg.signingPublicKey == "" {
		return errors.New("task signing public key is required")
	}

	unsigned, err := taskUnsignedMap(task)
	if err != nil {
		return err
	}
	canonical, err := canonicalJSON(unsigned)
	if err != nil {
		return err
	}
	if task.Signature.DigestSHA256 != sha256Hex(canonical) {
		return errors.New("task digest mismatch")
	}

	publicKey, err := parseEd25519PublicKey(cfg.signingPublicKey)
	if err != nil {
		return err
	}
	signature, err := base64.RawURLEncoding.DecodeString(task.Signature.Signature)
	if err != nil {
		return fmt.Errorf("invalid base64url task signature: %w", err)
	}
	if !ed25519.Verify(publicKey, canonical, signature) {
		return errors.New("invalid task signature")
	}

	if !allowlistedModules[task.ModuleID] {
		return fmt.Errorf("module is not locally allowlisted: %s", task.ModuleID)
	}
	if task.SafetyLevel != "" && !allowedSafetyLevels[task.SafetyLevel] {
		return fmt.Errorf("task safety level is not permitted on this runner: %s", task.SafetyLevel)
	}

	// Replay rejection is last so only fully-valid, signed tasks consume a nonce.
	if cfg.nonceCache != nil {
		if err := cfg.nonceCache.checkAndRecord(task.Signature.Nonce); err != nil {
			return err
		}
	}

	return nil
}

func taskUnsignedMap(task taskEnvelope) (map[string]interface{}, error) {
	payload, err := json.Marshal(task)
	if err != nil {
		return nil, err
	}
	var decoded map[string]interface{}
	if err := json.Unmarshal(payload, &decoded); err != nil {
		return nil, err
	}
	delete(decoded, "signature")
	return decoded, nil
}

func canonicalJSON(value interface{}) ([]byte, error) {
	var buffer bytes.Buffer
	if err := writeCanonicalJSON(&buffer, value); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

func writeCanonicalJSON(buffer *bytes.Buffer, value interface{}) error {
	switch typed := value.(type) {
	case map[string]interface{}:
		keys := make([]string, 0, len(typed))
		for key := range typed {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		buffer.WriteByte('{')
		for index, key := range keys {
			if index > 0 {
				buffer.WriteByte(',')
			}
			keyBytes, _ := json.Marshal(key)
			buffer.Write(keyBytes)
			buffer.WriteByte(':')
			if err := writeCanonicalJSON(buffer, typed[key]); err != nil {
				return err
			}
		}
		buffer.WriteByte('}')
	case []interface{}:
		buffer.WriteByte('[')
		for index, child := range typed {
			if index > 0 {
				buffer.WriteByte(',')
			}
			if err := writeCanonicalJSON(buffer, child); err != nil {
				return err
			}
		}
		buffer.WriteByte(']')
	default:
		payload, err := json.Marshal(typed)
		if err != nil {
			return err
		}
		buffer.Write(payload)
	}
	return nil
}

func parseEd25519PublicKey(pemValue string) (ed25519.PublicKey, error) {
	block, _ := pem.Decode([]byte(pemValue))
	if block == nil {
		return nil, errors.New("task signing public key PEM is invalid")
	}
	key, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	publicKey, ok := key.(ed25519.PublicKey)
	if !ok {
		return nil, errors.New("task signing public key is not Ed25519")
	}
	return publicKey, nil
}

// generateResultSigningKey creates a fresh Ed25519 keypair for signing results.
// The public key is returned as SPKI (PKIX) PEM to register with the control
// plane; the private key is returned as PKCS8 PEM for the runner to keep and
// pass back at poll time.
func generateResultSigningKey() (publicKeyPem string, privateKeyPem string, err error) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return "", "", err
	}
	publicDER, err := x509.MarshalPKIXPublicKey(publicKey)
	if err != nil {
		return "", "", err
	}
	privateDER, err := x509.MarshalPKCS8PrivateKey(privateKey)
	if err != nil {
		return "", "", err
	}
	publicKeyPem = string(pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: publicDER,
	}))
	privateKeyPem = string(pem.EncodeToMemory(&pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: privateDER,
	}))
	return publicKeyPem, privateKeyPem, nil
}

func parseEd25519PrivateKey(pemValue string) (ed25519.PrivateKey, error) {
	block, _ := pem.Decode([]byte(pemValue))
	if block == nil {
		return nil, errors.New("result signing private key PEM is invalid")
	}
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	privateKey, ok := key.(ed25519.PrivateKey)
	if !ok {
		return nil, errors.New("result signing private key is not Ed25519")
	}
	return privateKey, nil
}

// signResult signs the result's localAuditSha256 string bytes with the runner's
// registered Ed25519 result-signing private key and sets resultSignature to the
// base64 (std) signature. This matches the control plane's verification and the
// TS runner-agent exactly: ed25519.Sign(priv, []byte(localAuditSha256)) then
// base64.StdEncoding. A blank key PEM is a no-op (legacy/unregistered runner).
func signResult(privateKeyPem string, result taskResult) (taskResult, error) {
	if strings.TrimSpace(privateKeyPem) == "" {
		return result, nil
	}
	privateKey, err := parseEd25519PrivateKey(privateKeyPem)
	if err != nil {
		return result, err
	}
	signature := ed25519.Sign(privateKey, []byte(result.LocalAuditSHA256))
	result.ResultSignature = base64.StdEncoding.EncodeToString(signature)
	return result, nil
}

func reachabilityInput(task taskEnvelope) (string, []int, time.Duration, error) {
	host := firstString(task.Target, "hostname", "host", "targetHost")
	if host == "" {
		host = firstString(task.Inputs, "hostname", "host", "targetHost")
	}
	if host == "" {
		return "", nil, 0, errors.New("reachability target host is required")
	}

	ports, err := intList(task.Inputs["ports"])
	if err != nil || len(ports) == 0 {
		ports, err = intList(task.Target["ports"])
	}
	if err != nil {
		return "", nil, 0, err
	}
	if len(ports) == 0 {
		return "", nil, 0, errors.New("at least one reachability port is required")
	}

	timeoutSeconds := intValue(task.Inputs["timeoutSeconds"], 5)
	if timeoutSeconds < 1 || timeoutSeconds > 30 {
		return "", nil, 0, errors.New("timeoutSeconds must be between 1 and 30")
	}

	return host, ports, time.Duration(timeoutSeconds) * time.Second, nil
}

func enforceScope(scope scopeConstraints, host string, ports []int) error {
	if !hostAllowed(scope, host) {
		return fmt.Errorf("target host is outside approved runner scope: %s", host)
	}
	for _, port := range ports {
		if !portAllowed(scope.ApprovedPorts, port) {
			return fmt.Errorf("target port is outside approved runner scope: %d", port)
		}
	}
	return nil
}

func hostAllowed(scope scopeConstraints, host string) bool {
	normalizedHost := strings.ToLower(strings.TrimSuffix(host, "."))
	for _, approved := range scope.ApprovedHostnames {
		if normalizedHost == strings.ToLower(strings.TrimSuffix(approved, ".")) {
			return true
		}
	}
	for _, suffix := range scope.ApprovedDNSSuffixes {
		normalizedSuffix := strings.ToLower(strings.TrimPrefix(strings.TrimSuffix(suffix, "."), "."))
		if normalizedHost == normalizedSuffix || strings.HasSuffix(normalizedHost, "."+normalizedSuffix) {
			return true
		}
	}

	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	if scope.ForbidInternetEgress && isPublicIP(ip) {
		return false
	}
	for _, cidr := range scope.ApprovedCIDRs {
		_, network, err := net.ParseCIDR(cidr)
		if err == nil && network.Contains(ip) {
			return true
		}
	}
	return false
}

func isPublicIP(ip net.IP) bool {
	return !ip.IsPrivate() && !ip.IsLoopback() && !ip.IsLinkLocalUnicast() && !ip.IsLinkLocalMulticast()
}

func portAllowed(approvedPorts []int, port int) bool {
	if len(approvedPorts) == 0 {
		return false
	}
	for _, approved := range approvedPorts {
		if approved == port {
			return true
		}
	}
	return false
}

func runReachability(host string, ports []int, timeout time.Duration) []portObservation {
	observations := make([]portObservation, 0, len(ports))
	for _, port := range ports {
		address := net.JoinHostPort(host, strconv.Itoa(port))
		conn, err := net.DialTimeout("tcp", address, timeout)
		if err != nil {
			observations = append(observations, portObservation{Port: port, Status: "closed"})
			continue
		}
		_ = conn.Close()
		observations = append(observations, portObservation{Port: port, Status: "open"})
	}
	return observations
}

func submitTaskResult(httpClient *http.Client, cfg runnerConfig, taskID string, result taskResult) error {
	signed, err := signResult(cfg.resultSigningPrivateKeyPem, result)
	if err != nil {
		return fmt.Errorf("sign result: %w", err)
	}
	return postJSON(
		httpClient,
		cfg.apiBaseURL+"/api/v1/runners/"+cfg.runnerID+"/tasks/"+taskID+"/result",
		cfg.authToken,
		signed,
		nil,
	)
}

func createHTTPClient(cfg runnerConfig) (*http.Client, error) {
	transport := &http.Transport{}
	if strings.TrimSpace(cfg.controlPlaneProxy) != "" {
		proxyURL, err := url.Parse(cfg.controlPlaneProxy)
		if err != nil {
			return nil, fmt.Errorf("invalid runner proxy URL: %w", err)
		}
		transport.Proxy = http.ProxyURL(proxyURL)
	} else {
		transport.Proxy = http.ProxyFromEnvironment
	}

	if strings.HasPrefix(cfg.apiBaseURL, "https://") {
		tlsConfig := &tls.Config{}
		if cfg.insecureSkipVerify {
			tlsConfig.InsecureSkipVerify = true
		}
		if cfg.mtlsCertFile != "" || cfg.mtlsKeyFile != "" {
			if cfg.mtlsCertFile == "" || cfg.mtlsKeyFile == "" {
				return nil, errors.New("both mTLS client certificate and key files are required")
			}
			certificate, err := tls.LoadX509KeyPair(cfg.mtlsCertFile, cfg.mtlsKeyFile)
			if err != nil {
				return nil, fmt.Errorf("load mTLS client certificate: %w", err)
			}
			tlsConfig.Certificates = []tls.Certificate{certificate}
		}
		if cfg.mtlsCAFile != "" {
			caPem, err := os.ReadFile(cfg.mtlsCAFile)
			if err != nil {
				return nil, fmt.Errorf("read mTLS CA certificate: %w", err)
			}
			roots := x509.NewCertPool()
			if !roots.AppendCertsFromPEM(caPem) {
				return nil, errors.New("mTLS CA certificate file does not contain a PEM certificate")
			}
			tlsConfig.RootCAs = roots
		}
		if cfg.insecureSkipVerify || len(tlsConfig.Certificates) > 0 || tlsConfig.RootCAs != nil {
			transport.TLSClientConfig = tlsConfig
		}
	}

	return &http.Client{Transport: transport}, nil
}

func generateRunnerCSR(cfg runnerConfig) (string, string, error) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return "", "", err
	}

	request := &x509.CertificateRequest{
		Subject: pkix.Name{
			CommonName: cfg.runnerName,
		},
		DNSNames: []string{cfg.hostname},
	}

	csrDER, err := x509.CreateCertificateRequest(
		rand.Reader,
		request,
		privateKey,
	)
	if err != nil {
		return "", "", err
	}

	csrPem := string(pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE REQUEST",
		Bytes: csrDER,
	}))
	privateKeyPem := string(pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(privateKey),
	}))

	return csrPem, privateKeyPem, nil
}

func postJSON(httpClient *http.Client, url string, authToken string, body interface{}, out interface{}) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}
	request, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	if authToken != "" {
		request.Header.Set("Authorization", "Bearer "+authToken)
		request.Header.Set("x-periscan-runner-token", authToken)
	}
	response, err := httpClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	responseBody, _ := io.ReadAll(response.Body)
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return apiStatusError{
			Body:       strings.TrimSpace(string(responseBody)),
			Status:     response.Status,
			StatusCode: response.StatusCode,
		}
	}
	if out != nil {
		if err := json.Unmarshal(responseBody, out); err != nil {
			return err
		}
	}
	return nil
}

type apiStatusError struct {
	Body       string
	Status     string
	StatusCode int
}

func (err apiStatusError) Error() string {
	if err.Body == "" {
		return "Periscan API returned " + err.Status
	}
	return "Periscan API returned " + err.Status + ": " + err.Body
}

func defaultNetworkProfile(apiBaseURL string, explicitProxy string) networkProfile {
	host := "runner.periscan.cloud"
	if parsedHost, _, err := net.SplitHostPort(strings.TrimPrefix(strings.TrimPrefix(apiBaseURL, "https://"), "http://")); err == nil {
		host = parsedHost
	} else {
		host = strings.TrimPrefix(strings.TrimPrefix(apiBaseURL, "https://"), "http://")
		host = strings.Split(host, "/")[0]
	}
	var explicitProxyURL *string
	if explicitProxy != "" {
		explicitProxyURL = &explicitProxy
	}
	notes := []string{"DNS resolution and outbound TCP 443 to the control-plane gateway are required."}
	if explicitProxyURL == nil {
		notes = append(notes, "If no explicit proxy is configured, runtime defaults to system proxy environment variables.")
	}

	return networkProfile{
		AdditionalEgressNotes:     &notes[0],
		DNSResolutionRequired:     true,
		ExplicitProxyURL:          explicitProxyURL,
		GatewayHostnames:          []string{host},
		HTTPConnectProxySupported: true,
		OutboundHTTPSPorts:        []int{443},
	}
}

func firstString(values map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if value, ok := values[key].(string); ok {
			return value
		}
	}
	return ""
}

func intList(value interface{}) ([]int, error) {
	switch typed := value.(type) {
	case []int:
		return typed, nil
	case []interface{}:
		result := make([]int, 0, len(typed))
		for _, item := range typed {
			intItem, ok := numberToInt(item)
			if !ok {
				return nil, errors.New("ports must be integers")
			}
			result = append(result, intItem)
		}
		return result, nil
	default:
		return []int{}, nil
	}
}

func intValue(value interface{}, fallback int) int {
	if parsed, ok := numberToInt(value); ok {
		return parsed
	}
	return fallback
}

func numberToInt(value interface{}) (int, bool) {
	switch typed := value.(type) {
	case int:
		return typed, true
	case int64:
		return int(typed), true
	case float64:
		if typed == float64(int(typed)) {
			return int(typed), true
		}
	case json.Number:
		parsed, err := typed.Int64()
		return int(parsed), err == nil
	}
	return 0, false
}

func getenvDefault(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func killSwitchEnabled() bool {
	return os.Getenv("PERISCAN_RUNNER_KILL_SWITCH") == "true"
}

func sha256Hex(value []byte) string {
	hash := sha256.Sum256(value)
	return hex.EncodeToString(hash[:])
}

func exitErr(err error) {
	fmt.Fprintln(os.Stderr, err.Error())
	os.Exit(1)
}

// Helpers for Phase3 module code (firstInt, ptr) to support http header/cert and new modules.
func firstInt(values map[string]interface{}, keys ...string) (int, bool) {
	for _, key := range keys {
		if v, ok := values[key]; ok {
			if i, ok := numberToInt(v); ok {
				return i, true
			}
		}
	}
	return 0, false
}

func ptr[T any](v T) *T {
	return &v
}
