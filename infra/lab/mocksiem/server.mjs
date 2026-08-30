/**
 * Lab SIEM: ingest + search for DRV / DNS canary observe loops.
 *
 * Supports:
 *   - Lab native: POST /v1/events, GET /v1/events?marker=
 *   - Splunk REST-ish: POST /services/search/jobs/export, GET /services/server/info
 *
 * Product Splunk connector observeControl hits /services/search/jobs/export.
 * Not a product SIEM. No auth required in lab mode.
 */
import http from "node:http";

const PORT = Number(process.env.PORT || 9200);
/** @type {Array<Record<string, unknown>>} */
const events = [];

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch {
        // form-urlencoded or plain text
        resolve(raw);
      }
    });
    req.on("error", reject);
  });
}

function parseFormBody(raw) {
  if (raw == null) return {};
  if (typeof raw === "object") return raw;
  const params = new URLSearchParams(String(raw));
  /** @type {Record<string, string>} */
  const out = {};
  for (const [k, v] of params.entries()) {
    out[k] = v;
  }
  return out;
}

function eventMatchesMarker(event, marker) {
  if (!marker) return true;
  const m = String(
    event.marker || event.message || event.query || event._raw || ""
  );
  return m.includes(marker);
}

function findHits({ marker, host, queryText }) {
  return events.filter((e) => {
    if (marker && !eventMatchesMarker(e, marker)) return false;
    if (host) {
      const h = String(e.host || e.hostname || "");
      if (!h.includes(host)) return false;
    }
    if (queryText) {
      // Match if any event field appears in the Splunk search body, or marker tokens in query.
      const blob = JSON.stringify(e);
      const tokens = extractQuotedTokens(queryText);
      if (tokens.length > 0) {
        return tokens.some(
          (t) => blob.includes(t) || eventMatchesMarker(e, t)
        );
      }
      // Fallback: any periscan- marker mentioned in search vs stored events
      const m = String(e.marker || "");
      if (m && queryText.includes(m)) return true;
      return queryText.toLowerCase().includes("periscan") && m.startsWith("periscan-");
    }
    return true;
  });
}

function extractQuotedTokens(text) {
  const tokens = [];
  const re = /"([^"]+)"/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match[1]) tokens.push(match[1]);
  }
  return tokens;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  res.setHeader("content-type", "application/json");
  // CORS not needed for server-side connector; allow simple probes.
  res.setHeader("access-control-allow-origin", "*");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    res.end(JSON.stringify({ status: "ok", events: events.length }));
    return;
  }

  // Splunk health-ish endpoint used by connector health checks.
  if (
    req.method === "GET" &&
    (url.pathname === "/services/server/info" ||
      url.pathname === "/services/server/info/")
  ) {
    res.end(
      JSON.stringify({
        entry: [
          {
            content: {
              serverName: "periscan-lab-mocksiem",
              version: "lab-1.0"
            }
          }
        ]
      })
    );
    return;
  }

  if (req.method === "POST" && (url.pathname === "/v1/events" || url.pathname === "/ingest")) {
    try {
      const body = (await readBody(req)) || {};
      const event =
        typeof body === "string"
          ? { message: body }
          : { ...body };
      const stored = {
        id: `evt-${events.length + 1}`,
        ts: new Date().toISOString(),
        ...event
      };
      events.push(stored);
      res.statusCode = 201;
      res.end(JSON.stringify({ ok: true, event: stored }));
    } catch (e) {
      res.statusCode = 400;
      res.end(JSON.stringify({ ok: false, error: String(e) }));
    }
    return;
  }

  if (req.method === "GET" && (url.pathname === "/v1/events" || url.pathname === "/search")) {
    const marker = url.searchParams.get("marker") || url.searchParams.get("q") || "";
    const host = url.searchParams.get("host") || "";
    const hits = findHits({ marker, host });
    res.end(JSON.stringify({ total: hits.length, hits }));
    return;
  }

  if (req.method === "DELETE" && url.pathname === "/v1/events") {
    events.length = 0;
    res.end(JSON.stringify({ ok: true, cleared: true }));
    return;
  }

  // Splunk export: product connector POSTs form body with `search=...`
  if (
    req.method === "POST" &&
    (url.pathname === "/services/search/jobs/export" ||
      url.pathname === "/services/search/jobs/export/")
  ) {
    try {
      const raw = await readBody(req);
      const form = parseFormBody(raw);
      const search = String(form.search || form.q || "");
      const hits = findHits({ queryText: search });
      if (hits.length === 0) {
        // Empty export body = NoEvidence for product connector.
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end("");
        return;
      }
      // NDJSON-ish lines with result/_raw so observeSplunkControl hasResult=true.
      const lines = hits.slice(0, 5).map((e) => {
        const marker = String(e.marker || e.message || "periscan-lab");
        const rawLine = `Periscan lab SIEM correlated allowlisted marker ${marker} host=${e.host || "lab"}`;
        return JSON.stringify({
          preview: false,
          result: {
            _raw: rawLine,
            marker,
            host: e.host || null,
            source: e.source || "mocksiem"
          }
        });
      });
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(lines.join("\n") + "\n");
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ messages: [{ type: "ERROR", text: String(e) }] }));
    }
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "not_found", path: url.pathname }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[mocksiem] listening on :${PORT} (lab native + Splunk export)`);
});
