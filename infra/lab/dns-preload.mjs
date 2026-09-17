/**
 * Point Node's dns.promises resolver at lab CoreDNS (host-published 5355).
 * Usage:
 *   NODE_OPTIONS="--import $(pwd)/infra/lab/dns-preload.mjs" pnpm --filter @periscan/api dev
 */
import dns from "node:dns";

const server = process.env.LAB_DNS_SERVER || "127.0.0.1";
const port = Number(process.env.LAB_DNS_PORT || 5355);
dns.setServers([`${server}:${port}`]);
console.error(`[lab dns-preload] dns.setServers([${server}:${port}])`);
