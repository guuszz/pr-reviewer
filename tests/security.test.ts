import assert from "node:assert/strict";
import test from "node:test";

import { extractAddedLines, scanSecurityDiff, summarizeSecurity } from "../lib/security";

const diff = `diff --git a/src/auth.ts b/src/auth.ts
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,2 +10,6 @@
 const existing = true;
+const apiKey = "super-secret-value-123";
+const result = eval(userInput);
+const digest = createHash("md5").update(value).digest("hex");
+const safe = process.env.API_KEY;
`;

test("extractAddedLines preserves file and new line numbers", () => {
  const lines = extractAddedLines(diff);
  assert.equal(lines[0].file, "src/auth.ts");
  assert.equal(lines[0].line, 11);
  assert.equal(lines[1].line, 12);
});

test("scanner detects credentials, eval, and weak hashes", () => {
  const findings = scanSecurityDiff(diff);
  assert.deepEqual(findings.map((finding) => finding.ruleId), ["SPR-001", "SPR-003", "SPR-008"]);
  assert.equal(findings[0].cwe, "CWE-798");
});

test("scanner ignores environment variables and placeholders", () => {
  const safeDiff = `+++ b/.env.example\n@@ -0,0 +1,2 @@\n+API_KEY="your_api_key_here"\n+const token = process.env.API_TOKEN;`;
  assert.deepEqual(scanSecurityDiff(safeDiff), []);
});

test("summary counts each severity", () => {
  const summary = summarizeSecurity(scanSecurityDiff(diff));
  assert.deepEqual(summary, { total: 3, critical: 1, high: 1, medium: 1, low: 0 });
});

test("deny TLS bypass and interpolated shell execution", () => {
  const risky = `+++ b/src/run.ts\n@@ -0,0 +1,2 @@\n+exec(\`ping \${host}\`);\n+const agent = { rejectUnauthorized: false };`;
  assert.deepEqual(scanSecurityDiff(risky).map((item) => item.ruleId), ["SPR-004", "SPR-006"]);
});

