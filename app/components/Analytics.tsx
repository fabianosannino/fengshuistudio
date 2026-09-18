/**
 * Third-party tracking is suspended while its consent and data contract are
 * reviewed. The previous automatic scripts could transmit query parameters,
 * private route identifiers and referrers, including after SPA navigation.
 * Re-enabling requires an explicit public-route allowlist, minimized payloads
 * and browser/network verification. Environment IDs alone do not enable it.
 */
export default function Analytics() {
  return null
}
