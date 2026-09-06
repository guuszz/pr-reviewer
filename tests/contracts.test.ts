import assert from "node:assert/strict";
import test from "node:test";
import { fetchPrData } from "../lib/github";
import { getCached, setCached } from "../lib/cache";

test("cache preserves truncation metadata", () => {
  const entry = { markdown: "review", prInfo: { title: "fixture", url: "https://github.com/fixture/repo/pull/1", author: "fixture", state: "open" }, truncated: true };
  setCached("fixture-cache-metadata", entry);
  assert.equal((getCached("fixture-cache-metadata") as typeof entry).truncated, true);
});

test("GitHub fetch is anonymous and retains diff beyond model limit", async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = "fixture-never-send";
  const headers: Headers[] = [];
  const diff = " ".repeat(50_100) + "\n+++ b/a.ts\n@@ -0,0 +1 @@\n+eval(input);";
  globalThis.fetch = async (url, init) => {
    headers.push(new Headers(init?.headers));
    if (new Headers(init?.headers).get("Accept")?.includes("diff")) return new Response(diff);
    if (String(url).includes("/files?")) return Response.json([]);
    return Response.json({ title: "fixture", body: "", html_url: "https://github.com/fixture/repo/pull/1", state: "open", user: { login: "fixture" }, base: { repo: { private: false } } });
  };
  try {
    const pr = await fetchPrData({ owner: "fixture", repo: "repo", number: 1 });
    assert.equal(pr.diff, diff);
    assert.ok(headers.every(h => !h.has("Authorization")));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
  }
});
import { createReviewHandlers, snapshotId } from "../lib/review-handlers";
import { readBoundedText, RESPONSE_MAX_BYTES, type PrData } from "../lib/github";

const fixture: PrData = {
  title: "offline contract", body: "", diff: " ".repeat(50_100) + "\n+++ b/a.ts\n@@ -0,0 +1 @@\n+eval(input);",
  files: [], truncated: true, html_url: "https://github.com/fixture/contracts/pull/2", state: "open", user: { login: "fixture" },
};
const request = () => new Request("http://localhost/api/analyze", { method: "POST", body: JSON.stringify({ url: fixture.html_url }) });

test("content fingerprints preserve case and invalidate on changed metadata or engine", () => {
  const id = snapshotId(fixture, "v1");
  assert.equal(id.length, 64);
  for (const changed of [{ ...fixture, diff: fixture.diff.toUpperCase() }, { ...fixture, title: "changed" }]) {
    assert.notEqual(snapshotId(changed, "v1"), id);
  }
  assert.notEqual(snapshotId(fixture, "v2"), id);
});

test("JSON and NDJSON preserve findings and truncation on cache miss and hit; changed PR re-analyzes", async () => {
  let pr = { ...fixture };
  let fetches = 0;
  let analyses = 0;
  const handlers = createReviewHandlers({
    engineVersion: "integration-contract-v1",
    fetchPr: async () => { fetches++; return pr; },
    analyze: async (input) => {
      analyses++;
      assert.equal(input.diff.length, 50_000);
      assert.equal(input.securityFindings?.[0].ruleId, "SPR-003");
      return "offline model fixture";
    },
    stream: async function* (input) { analyses++; assert.equal(input.diff.length, 50_000); yield "offline "; yield "stream fixture"; },
    share: async () => null,
  });
  const first = await (await handlers.json(request())).json();
  const hit = await (await handlers.json(request())).json();
  assert.equal(first.fromCache, false);
  assert.equal(hit.fromCache, true);
  assert.deepEqual({ ...hit, fromCache: false }, first);
  const events = (await (await handlers.ndjson(request())).text()).trim().split("\n").map(x => JSON.parse(x));
  assert.equal(events[0].truncated, true);
  assert.deepEqual(events[0].securityFindings, first.securityFindings);
  assert.deepEqual(events[0].securitySummary, first.securitySummary);
  assert.equal(events[0].snapshotId, first.snapshotId);
  assert.equal(events[0].fromCache, true);
  assert.equal(analyses, 1);
  assert.equal(fetches, 3);
  pr = { ...pr, title: "new snapshot" };
  const changed = (await (await handlers.ndjson(request())).text()).trim().split("\n").map(x => JSON.parse(x));
  assert.equal(changed[0].fromCache, false);
  assert.notEqual(changed[0].snapshotId, first.snapshotId);
  assert.equal(changed.at(-1).type, "done");
  const afterStream = await (await handlers.json(request())).json();
  assert.equal(afterStream.fromCache, true);
  assert.equal(afterStream.markdown, "offline stream fixture");
  assert.equal(analyses, 2);
});

test("failed sharing never advertises a link; invalid URL never calls GitHub", async () => {
  let calls = 0;
  const handlers = createReviewHandlers({
    engineVersion: "share-failure-v1", fetchPr: async () => { calls++; return fixture; },
    analyze: async () => "fixture", stream: async function* () { yield "fixture"; },
    share: async () => { throw new Error("offline redis failure"); },
  });
  assert.equal((await (await handlers.json(request())).json()).shareId, null);
  for (const handler of [handlers.json, handlers.ndjson]) {
    const bad = new Request("http://localhost/", { method: "POST", body: JSON.stringify({ url: "https://invalid.example/" }) });
    assert.equal((await handler(bad)).status, 400);
  }
  assert.equal(calls, 1);
});

test("bounded response stops reading and cancels oversized stream", async () => {
  let reads = 0;
  let cancelled = false;
  const response = new Response(new ReadableStream({
    pull(controller) { reads++; controller.enqueue(new Uint8Array(RESPONSE_MAX_BYTES / 2)); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 }));
  await assert.rejects(readBoundedText(response), /2 MB/);
  assert.equal(reads, 3);
  assert.equal(cancelled, true);
});

test("private or ambiguous visibility stops before diff fetch", async () => {
  const oldFetch = globalThis.fetch;
  try {
    for (const visibility of [true, undefined]) {
      let calls = 0;
      globalThis.fetch = async () => { calls++; return Response.json({ base: { repo: { private: visibility } } }); };
      await assert.rejects(fetchPrData({ owner: "fixture", repo: "repo", number: 1 }), /explicitamente públicos/);
      assert.equal(calls, 1);
    }
  } finally { globalThis.fetch = oldFetch; }
});
