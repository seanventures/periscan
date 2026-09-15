// Point the Node process's default DNS resolver at the range's CoreDNS so the
// measured DNS modules (dns_resolution / dns_caa / dns_email_security), which use
// node:dns/promises resolve4/6/cname/caa/txt, query the range.test zone instead
// of the system resolver. TLS/HTTP modules use dns.lookup (getaddrinfo) and are
// unaffected — map their hosts in /etc/hosts instead (see README).
//
// Run the API with:
//   NODE_OPTIONS="--import /ABS/PATH/infra/test-range/dns-preload.mjs" \
//   NODE_EXTRA_CA_CERTS="/ABS/PATH/infra/test-range/certs/ca.crt" \
//   pnpm --filter @periscan/api dev
//
// CoreDNS forwards non-range.test queries upstream, so real DNS still resolves.
import dns from "node:dns";

const server = process.env.RANGE_DNS_SERVER ?? "127.0.0.1:5354";
dns.setServers([server]);
// setServers on the default resolver also governs dns/promises resolve* calls.
console.error(`[range] node DNS resolver -> ${server}`);
