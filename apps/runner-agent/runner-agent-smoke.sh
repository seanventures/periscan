#!/usr/bin/env bash
# In-image smoke test for the Periscan runner-agent in-network toolkit.
# Run INSIDE the built image:
#   docker run --rm periscan-runner-agent bash apps/runner-agent/runner-agent-smoke.sh
#
# Asserts the AgentLocal in-network tool binaries resolve and report a version.
# metasploit is intentionally NOT baked into this image (heavy ruby framework);
# it is resolved at runtime from its official container or an operator install,
# so it is reported as 'deferred' rather than failing the smoke.
set -euo pipefail

fail=0

check_version() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "ok   | ${name} | $("$@" 2>&1 | head -n1)"
  else
    echo "FAIL | ${name} | not runnable: $*"
    fail=1
  fi
}

echo "== AgentLocal binary version checks =="
check_version nmap nmap --version
check_version subfinder subfinder -version
check_version httpx httpx -version
check_version dnsx dnsx -version
check_version kerbrute kerbrute version
check_version netexec nxc --version

echo "== deferred (resolved at runtime, not baked) =="
echo "info | metasploit | provided via metasploitframework/metasploit-framework container or operator install (PERISCAN_METASPLOIT_IMAGE/_BINARY)"

if [ "${fail}" -ne 0 ]; then
  echo "runner-agent smoke test FAILED"
  exit 1
fi
echo "runner-agent smoke test PASSED"
