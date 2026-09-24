#!/usr/bin/env bash
# In-image smoke test for the Periscan scan-executor toolkit.
# Run INSIDE the built image:
#   docker run --rm periscan-scan-executor bash infra/docker/scan-executor-smoke.sh
#
# Asserts:
#   (1) every permissive bundled binary resolves + reports a version
#   (2) the registry's own runtime resolver finds the engines bundled in this
#       server-side image; the full Current catalog also includes runner and
#       optional engines that are not part of this image
#   (3) legal-review GPL tools are absent from the default image (and present
#       only when PERISCAN_INCLUDE_LEGAL_REVIEW_TOOLS=1, i.e. runtime-legal-review)
set -euo pipefail

fail=0
legal_review_profile="${PERISCAN_INCLUDE_LEGAL_REVIEW_TOOLS:-0}"

check_version() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "ok   | ${name} | $("$@" 2>&1 | head -n1)"
  else
    echo "FAIL | ${name} | not runnable: $*"
    fail=1
  fi
}

command_present() {
  command -v "$1" >/dev/null 2>&1
}

echo "== binary version checks =="
check_version gitleaks gitleaks version
check_version nuclei nuclei -version
check_version trivy trivy --version
check_version osv-scanner osv-scanner --version
check_version prowler prowler --version
check_version promptfoo npx --no-install promptfoo --version
check_version pyrit python3 -c "import pyrit; print(getattr(pyrit,'__version__','installed'))"
# ffuf is MIT and may be present; version flag differs by package — only require PATH.
if command_present ffuf; then
  echo "ok   | ffuf | $(command -v ffuf)"
else
  echo "FAIL | ffuf | not on PATH (MIT tool expected in default image)"
  fail=1
fi

echo "== legal-review GPL tools (default image must not redistribute) =="
# testssl.sh / sqlmap / nikto / whatweb / scout (ScoutSuite) are RequiresLegalReview.
# Default `runtime` stage must not ship them. Optional `runtime-legal-review` may.
legal_review_cmds=(testssl.sh sqlmap nikto whatweb scout)
for cmd in "${legal_review_cmds[@]}"; do
  if command_present "${cmd}"; then
    if [ "${legal_review_profile}" = "1" ]; then
      echo "ok   | ${cmd} | present (legal-review profile)"
    else
      echo "FAIL | ${cmd} | present but must not ship in default scan-executor image"
      fail=1
    fi
  else
    if [ "${legal_review_profile}" = "1" ]; then
      echo "FAIL | ${cmd} | missing from legal-review profile"
      fail=1
    else
      echo "ok   | ${cmd} | absent (default image)"
    fi
  fi
done

echo "== bundled engine registry resolution (pnpm tools:check) =="
if pnpm tools:check --phase=CurrentMvp > /tmp/tools-check.txt; then
  bundled_tools=(gitleaks nuclei trivy osv-scanner prowler promptfoo pyrit)
  for tool in "${bundled_tools[@]}"; do
    if grep -F "${tool} | available |" /tmp/tools-check.txt; then
      :
    else
      echo "FAIL | ${tool} | bundled engine missing from runtime registry"
      fail=1
    fi
  done
else
  echo "FAIL | pnpm tools:check exited non-zero"
  fail=1
fi

if [ "${fail}" -ne 0 ]; then
  echo "scan-executor smoke test FAILED"
  exit 1
fi
echo "scan-executor smoke test PASSED"
