// web-poc-test.js - SYNTAX/STRUCTURE VALIDATION ONLY.
//
// This file performs NO network I/O and NO real assertions against a
// gateway. It exists solely so `node web-poc-test.js` parses and runs the
// handler-registration pattern used by web-poc.ts. The previous version
// printed "PASSED" unconditionally, which was misleading; it now states
// plainly that nothing was tested.
//
// For a real connectivity check, run: python3 clawjacked_exploit.py

const events = [];
const mockWs = {
  on: (event, handler) => {
    if (typeof handler === "function") events.push(event);
  },
  send: () => { /* no-op: no connection exists */ }
};

function registerHandlers(ws) {
  ws.on("open", () => {});
  ws.on("message", () => {});
  ws.on("error", () => {});
  ws.on("close", () => {});
  return ws;
}

const handlersRegistered = ["open", "message", "error", "close"];
const withHandlers = registerHandlers(mockWs);
const ok = handlersRegistered.every((e) => events.includes(e));

console.log("[*] Syntax validation only - no network requests were made.");
console.log(`[*] Handler registration parsed and invoked: ${ok ? "yes" : "no"}`);
console.log("[i] This file does NOT test a gateway. See clawjacked_exploit.py / web-poc.ts.");
console.log(ok ? "[+] SYNTAX CHECK OK (validates nothing about the vulnerability)" : "[-] SYNTAX CHECK FAILED");
process.exitCode = ok ? 0 : 1;
