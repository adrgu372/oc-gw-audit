# ClawJacked Research

Educational PoCs and accessibility tests for publicly disclosed security findings related to OpenClaw.

These scripts are **not working exploits**; each one validates only a narrow, clearly labeled property
(see below). Both findings are **publicly disclosed and already patched upstream**:

- **ClawJacked** — localhost WebSocket hijacking, disclosed by [Oasis Security](https://www.oasis.security/). Patched upstream.
- **CVE-2026-100525 / GHSA-rx8p-qcpv-c7vr** — Prometheus diagnostics scope bypass. Publicly disclosed via
  [GitHub Advisory](https://github.com/openclaw/openclaw/security/advisories/GHSA-rx8p-qcpv-c7vr);
  fixed in `@openclaw/diagnostics-prometheus` v2026.9.3.

## Structure

| File | What it actually validates |
|---|---|
| `clawjacked-poc.md` | Technical writeup of the disclosed WebSocket vulnerability |
| `web-poc.ts` | TypeScript demo of the connection pattern (requires a running gateway; no auth, no command execution) |
| `clawjacked_exploit.py` | **Accessibility only:** whether the gateway on the real default port **18789** (per `src/gateway/server.ts`) accepts an *unauthenticated* WebSocket on loopback. Does NOT authenticate and does NOT execute commands; an accepted connection is a precondition signal, not confirmation of ClawJacked |
| `prometheus-poc.md` | Documentation of the scope-bypass advisory |
| `prometheus_cve_exploit.py` | **Endpoint accessibility only:** whether `/tools/prometheus/metrics` on port 18789 returns HTTP 200 with valid Prometheus exposition format to an unauthenticated caller. Cannot prove the scope bypass, which requires a real JWT lacking the `operator.read` scope |
| `web-poc-test.js` | **Syntax validation only** of the handler-registration pattern; performs no network I/O and proves nothing about the vulnerability |

## Honest limitations

- No script here authenticates to the gateway, so none can demonstrate session hijack or scope enforcement behavior.
- The WebSocket "handshake" sent by `clawjacked_exploit.py` is a simulated frame used only to elicit a response; it is not a protocol-level exploit.
- A 404 or HTML error page is treated as failure, never as a hit.

> All content is for educational and research purposes only.
>
> Based on public disclosures by [Oasis Security](https://www.oasis.security/) and [VulnCheck](https://www.vulncheck.com/).
