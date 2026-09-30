# oc-gw-audit

Security research artifacts for the **OpenClaw Gateway**: technical writeups and proof-of-concept tooling covering two publicly disclosed upstream issues (ClawJacked and CVE-2026-100525) and a suite of five gateway-specific findings of our own (F1–F5).

Everything in this repository is for **defensive and educational research**. Please read [Scope and fair use](#scope-and-fair-use) and [Honest status of the PoCs](#honest-status-of-the-pocs) before running anything.

## Contents

| Path | Kind | Subject | Upstream status |
| --- | --- | --- | --- |
| `clawjacked-poc.md` | Writeup | ClawJacked — localhost WebSocket hijacking | Disclosed by Oasis Security, fixed in OpenClaw `2026.2.25` |
| `clawjacked_exploit.py` | PoC (Python) | Loopback WebSocket accessibility check | Same issue as above |
| `web-poc.ts` | PoC (TypeScript) | Minimal WebSocket connect/handshake demo | Same issue as above |
| `web-poc-test.js` | Harness (Node) | Syntax-only harness for `web-poc.ts`; makes no network calls | — |
| `prometheus-poc.md` | Writeup | CVE-2026-100525 — metrics scope bypass | Public CVE, fixed in `@openclaw/diagnostics-prometheus` `2026.9.3` |
| `prometheus_cve_exploit.py` | PoC (Python) | Metrics endpoint accessibility check | Same issue as above |
| `README-F1-F5.md` | Writeup | Overview of the F1–F5 findings | **Not** disclosed upstream |
| `F1.rs` … `F5.rs` | PoCs (Rust) | Five gateway findings (see below) | **Not** disclosed upstream |
| `LICENSE` | Legal | The Unlicense (public domain) | — |

## Scope and fair use

- The two documented issues (ClawJacked, CVE-2026-100525) are **publicly disclosed and fixed upstream**. Nothing here is a zero-day.
- The F1–F5 findings are **original, unverified research** against the OpenClaw gateway model. They have not been reported to or confirmed by the OpenClaw maintainers, and they carry no CVE or advisory.
- Every PoC targets **`127.0.0.1` only**. Do not point any of this at systems you do not own or have explicit written permission to test.
- Provided as-is, with no warranty, for education and defensive verification.

## Requirements

- **Rust toolchain** (`rustc`) for the F1–F5 PoCs. They are single-file, dependency-free programs — no `Cargo.toml` is needed.
- **Python 3.8+** for the `.py` PoCs. `clawjacked_exploit.py` additionally uses `websocket-client` for the WebSocket-layer check (optional; without it the script degrades to a TCP-only probe):

  ```bash
  pip install websocket-client
  ```

- **Node.js 18+** for `web-poc-test.js`. Running `web-poc.ts` directly also needs a TypeScript runtime and the `ws` package; for a real connectivity check prefer `clawjacked_exploit.py`.
- A **running OpenClaw gateway** for the PoCs that talk to one. Most of them assume the gateway default port **`18789`** on `127.0.0.1`.

## 1. ClawJacked — localhost WebSocket hijacking

**Publicly disclosed by Oasis Security on 2026-02-26 and fixed within 24 hours in OpenClaw `2026.2.25`.**

Browsers do not apply the same-origin policy to WebSocket handshakes, so JavaScript on any website a developer visits can open a WebSocket to a gateway bound to loopback. The published chain: connect to `localhost`, brute-force the gateway password (no rate limiting at the time), get silently registered as a trusted device because localhost connections were auto-approved, and end up with full agent control.

### Artifacts

- `clawjacked-poc.md` — structured writeup of the attack flow and mitigations.
- `clawjacked_exploit.py` — accessibility check. It verifies TCP reachability, attempts a **plain, unauthenticated** WebSocket upgrade, sends one simulated JSON frame, and reports whether anything came back.
- `web-poc.ts` — a compact Node/TypeScript illustration of the connection attempt.

```bash
python3 clawjacked_exploit.py
```

Interpretation of the results, straight from the script's own docstring:

| Result | Meaning |
| --- | --- |
| `CONNECTED` + reply | The gateway accepts unauthenticated WS frames on loopback. This is a **necessary precondition** for the class of issue — not proof of the vulnerability. |
| WebSocket upgrade rejected | A listener exists but refuses plain WS — consistent with auth/origin gating. |
| TCP refused | Gateway not running, or bound elsewhere. |

The PoC deliberately does **not** authenticate and does **not** execute commands. Reproducing the real ClawJacked chain requires implementing the operator session-token handshake described in the disclosure, which is out of scope for this repository.

## 2. CVE-2026-100525 — Prometheus diagnostics scope bypass

**CVSS 4.0: 5.3 (Medium). Published 2026-09-26. Fixed in `@openclaw/diagnostics-prometheus` `2026.9.3`.**

In deployments using an identity-bearing gateway authentication mode such as `trusted-proxy`, the diagnostics plugin did not enforce the `operator.read` scope on its authenticated metrics endpoint. A caller whose effective role has no read scope could therefore retrieve the diagnostics document even though ordinary read methods reject the same identity. Shared-secret gateway callers already hold full operator scope and are not affected.

Workaround, per the advisory: disable the Prometheus endpoint, or ensure every identity that can reach it is intended to hold `operator.read`.

### Artifacts

- `prometheus-poc.md` — writeup of the reproduction steps and impact.
- `prometheus_cve_exploit.py` — endpoint accessibility check against `/tools/prometheus/metrics`.

```bash
python3 prometheus_cve_exploit.py
```

The script's success criterion is deliberately strict: HTTP **200** _and_ a body that parses as Prometheus exposition format (most lines matching `# HELP` / `# TYPE` / `name{labels} value`). 404s, HTML error pages and empty bodies are explicit failures.

**Important:** this script sends **no credentials**, so it can neither prove nor disprove the scope bypass. Proving CVE-2026-100525 requires a valid JWT for an identity **without** `operator.read`, issued by a gateway in trusted-proxy mode. What the script can tell you is whether the endpoint is reachable and serving metrics to an unauthenticated caller.

## 3. F1–F5 — original gateway PoC suite

> **These five findings are our own, unverified research.** They have not been confirmed by upstream, carry no CVE or advisory, and should be treated as hypotheses with accompanying test code — not as established vulnerabilities.

| ID | Finding | Mechanism probed |
| --- | --- | --- |
| F1 | Dashboard fragment token leak | A token appearing in a URL `#fragment` can be replayed as a bearer credential for full gateway access. |
| F2 | JS bridge token forgery | An XSS payload reading `window.__OPENCLAW_NATIVE_BROWSER_TOKEN__` can replay it as auth. |
| F3 | Hot-reload config evasion | Configuration hot-reload applies changes mid-flight without cryptographic validation, letting an attacker inject bypass rules. |
| F4 | Ephemeral SSH port hijacking | Local malware binding an ephemeral port can intercept the SSH control channel. |
| F5 | Cross-tab label leakage | Route-scoped labels in shared `localStorage` enable cross-tab impersonation. |

### Build and run

Each PoC is a standalone single-file program with no dependencies:

```bash
for f in F1 F2 F3 F4 F5; do rustc "$f.rs" -o "$f" && "./$f"; done
```

They connect to a gateway on `127.0.0.1:18789` and **panic if nothing is listening** there. Start the gateway first, or expect `connect to gateway` / `connect` panics.

### Honest status of the PoCs

This section exists because the repository has a stated commitment to PoCs that are honest about what they actually test (see the commit *"fix: make PoCs honest about what they actually test"*). By inspection, the five Rust programs are not equivalent in strength:

- **F1 is the only one with a working mechanism.** It parses a `token=` / `access_token=` value out of a `#fragment`, replays it as `Authorization: Bearer`, and treats a non-401 response as proof. If the gateway really does emit credentials in URL fragments, this is a genuine finding.
- **F2 cannot succeed as written.** It replays the hard-coded placeholder string `"XSS_EXTRACTED_TOKEN"`, so a real gateway will answer 401 and the script exits `NO PROOF`. It documents an attack shape; it does not demonstrate token forgery.
- **F3 is not self-contained.** It compares the HTTP status of `/tools/list` before and after a window, but the script never modifies any configuration. Any status difference therefore comes from unrelated churn, not from the described attack.
- **F4 does not test SSH at all.** `TcpListener::bind` succeeding means the port is **free**, not that an SSH listener is present, and the listener is dropped immediately by the `Ok(_)` pattern. The final bind on a known-free port always succeeds, so the "success" branch fires on virtually any host.
- **F5 is largely illustrative.** It prints a conceptual JavaScript snippet and probes `/tools/list` without credentials. The snippet's `window.opener.localStorage` framing is not a working cross-origin primitive: same-origin tabs already share one storage area, and cross-origin access raises a `SecurityError`. The defensible part of the hypothesis is key collision across routes within the same origin — worth testing, but not demonstrated by this program.

Contributions that turn any of these into a reproducible result — or that disprove them — are welcome.

## Repository layout

```
.
├── clawjacked-poc.md            # ClawJacked writeup
├── clawjacked_exploit.py        # loopback WS accessibility check
├── web-poc.ts                   # TypeScript connection demo
├── web-poc-test.js              # syntax-only Node harness (no network I/O)
├── prometheus-poc.md            # CVE-2026-100525 writeup
├── prometheus_cve_exploit.py    # metrics endpoint accessibility check
├── README-F1-F5.md              # F1–F5 overview
├── F1.rs … F5.rs                # F1–F5 standalone Rust PoCs
└── LICENSE                      # The Unlicense
```

## Known inconsistencies

- **Port numbers disagree.** The Rust PoCs and both Python scripts use the gateway default `18789`, while `web-poc.ts` and `clawjacked-poc.md` still reference `4000`. `18789` is the correct default; the `4000` references are stale.
- **`README-F1-F5.md` build instructions are stale.** It tells you to `cd clawjacked-research` first, which is a directory that does not exist in this repository. Use the loop command in [Build and run](#build-and-run) instead.

## References

- Oasis Security — *OpenClaw Vulnerability: Website-to-Local Agent Takeover* (ClawJacked, 2026-02-26): <https://www.oasis.security/blog/openclaw-vulnerability>
- GitHub Security Advisory for the Prometheus issue: <https://github.com/openclaw/openclaw/security/advisories/GHSA-rx8p-qcpv-c7vr>
- Related OpenClaw advisory (WebSocket log poisoning, patched in `2026.2.13`): <https://github.com/openclaw/openclaw/security/advisories/GHSA-g27f-9qjv-22pm>

## License

Released into the public domain under [The Unlicense](LICENSE). You are free to use, modify and distribute this material without restriction.
