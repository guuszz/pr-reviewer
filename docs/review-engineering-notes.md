# Review snapshot and response contract

## Problem / root cause
URL-keyed cache lookup happened before fetching the PR. New commits could reuse stale findings. The JSON cache-hit path omitted findings and truncation; streaming hardcoded truncation to false. The fetcher cut the diff before deterministic scanning and forwarded any configured token, including credentials able to read private repositories. README rule IDs and its rate-limit claim did not match implementation.

## Decision and alternatives
Both transports now use shared handlers with injectable adapters. Fresh anonymous GitHub data is hashed with the analysis version; deterministic rules scan the complete accepted diff, while model context is reduced separately. Bounded HTTP reads reject oversized responses and disable redirects. This favors explicit public-only behavior over accepting a broadly scoped token and attempting to infer its privileges. Application rate limiting is not implemented; its claim was removed rather than calling a cache a security control.

A commit-SHA cache would require atomic collection or retrying when head/base change; a content fingerprint accurately identifies the received snapshot without claiming atomicity. An external durable cache would reduce cold-start work but introduces infrastructure; the in-memory 50-entry/one-hour cache remains an optimization, not a quota.

## Evidence
Baseline: 5 tests and typecheck passed. Two regression tests failed against original code (lost metadata; diff cut before analysis). Added offline integration tests cover both transports, cache hit/miss, changed content, truncation, late deterministic findings, private/ambiguous visibility, oversized-stream cancellation, sharing failure and invalid input. Run `npm test`, `npm run typecheck`, `npm run build` and `npm audit --audit-level=high`.

## Remaining limits
No live-model or live-Redis integration was exercised. No per-user quota, distributed cache, exhaustive rule corpus, atomic Git snapshot or complete file-list pagination. Regex signals require human validation and do not establish exploitability. The streaming UI consumes share links on completion. Redis writes are first-writer-wins; old URL-based links remain readable but do not retroactively gain snapshot guarantees.

Implementation and tests assisted by Codex; the owner should review and reproduce the tests before merging.

Dependency gate initially reported one high and one low advisory. A targeted transitive update of browserslist and postcss-selector-parser (plus required browser data) produced a clean npm audit. Tests, typecheck and production build were repeated successfully.
