#!/usr/bin/env python3
"""Write periscan.sarif from GET /api/v1/findings.sarif?missionId=.

Denied jobsQueued=0 must not write a file or upload a fake pass.
The log is a Community measurement, not a certification or pentest report.
"""

from __future__ import annotations

import http.client
import json
import os
import sys
import urllib.parse

SARIF_VERSION = "2.1.0"
SARIF_NAME = "periscan.sarif"


def env(name: str, default: str = "") -> str:
    return (os.environ.get(name) or default).strip()


def is_true(value: str) -> bool:
    return value.lower() in {"1", "true", "yes"}


def split_base(url: str) -> str:
    origin = url.strip().rstrip("/")
    if origin.endswith("/api/v1"):
        return origin
    return origin + "/api/v1"


def write_output(path: str, key: str, value: str) -> None:
    if not path:
        return
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(f"{key}={value}\n")


def http_raw(url: str, token: str) -> tuple[int, bytes]:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise SystemExit(f"unsupported SARIF URL: {url}")
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"
    headers = {
        "Accept": "application/sarif+json, application/json",
        "Authorization": "Bearer " + token,
        "Connection": "close",
        "User-Agent": "periscan-community-proof-action",
    }
    if parsed.scheme == "https":
        connection: http.client.HTTPConnection = http.client.HTTPSConnection(
            parsed.hostname, parsed.port or 443, timeout=45
        )
    else:
        connection = http.client.HTTPConnection(
            parsed.hostname, parsed.port or 80, timeout=45
        )
    try:
        connection.request("GET", path, headers=headers)
        response = connection.getresponse()
        return int(response.status), response.read()
    except OSError as error:
        raise SystemExit(f"GET {url} failed: {error}") from error
    finally:
        connection.close()


def main() -> int:
    token = env("PERISCAN_API_TOKEN")
    raw_url = env("PERISCAN_API_URL")
    mission_id = env("PERISCAN_MISSION_ID")
    denied = is_true(env("PERISCAN_DENIED"))
    workspace = env("GITHUB_WORKSPACE") or os.getcwd()
    github_output = env("GITHUB_OUTPUT")
    sarif_path = os.path.join(workspace, SARIF_NAME)

    if denied or not mission_id:
        if os.path.isfile(sarif_path):
            os.remove(sarif_path)
        write_output(github_output, "sarif_path", "")
        print(
            "Denied jobsQueued=0: not uploading a fake pass.",
            file=sys.stderr,
        )
        return 0

    if not token:
        print("api_token is required to fetch SARIF.", file=sys.stderr)
        return 1
    if not raw_url:
        print("api_url is required to fetch SARIF.", file=sys.stderr)
        return 1

    query = urllib.parse.urlencode({"missionId": mission_id})
    url = f"{split_base(raw_url)}/findings.sarif?{query}"
    status, raw = http_raw(url, token)
    if status != 200:
        detail = raw.decode("utf-8", errors="replace")[:500]
        print(f"GET /api/v1/findings.sarif failed: HTTP {status} {detail}", file=sys.stderr)
        return 1

    try:
        parsed = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        print(f"SARIF export was not JSON: {error}", file=sys.stderr)
        return 1

    if not isinstance(parsed, dict) or parsed.get("version") != SARIF_VERSION:
        print("SARIF export was not a SARIF 2.1.0 log.", file=sys.stderr)
        return 1
    if not isinstance(parsed.get("runs"), list):
        print("SARIF export missing runs.", file=sys.stderr)
        return 1

    tmp_path = sarif_path + ".tmp"
    with open(tmp_path, "wb") as handle:
        handle.write(raw)
    os.replace(tmp_path, sarif_path)
    write_output(github_output, "sarif_path", SARIF_NAME)
    print(f"Wrote {SARIF_NAME} from GET /api/v1/findings.sarif?missionId=")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
