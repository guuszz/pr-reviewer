# Changelog

## Unreleased
- Revalidate public PR contents before snapshot-keyed cache lookup.
- Share JSON/NDJSON security metadata and preserve model-context truncation.
- Scan the complete accepted diff; reject HTTP responses above 2 MB during streaming.
- Exclude private repositories and ignore GitHub tokens.
- Preserve historical share IDs; new links are snapshot-based and returned after persistence.
- Correct SPR rule IDs and remove the unimplemented application rate-limit claim.
- Update vulnerable transitive browser/CSS tooling dependencies; repeat all quality gates.
