# Tasks 002

- [x] T-201 Define evaluation scope and acceptance cases before implementation.
- [x] T-202 Add the removed-operation revision to the synthetic Git demo.
- [x] T-203 Add a scenario manifest for compatible, required-field, and removed-operation changes.
- [x] T-204 Exercise manifest scenarios through the MCP SDK stdio client.
- [x] T-205 Add an evaluation command and keep scenarios in the full check.
- [x] T-206 Document automated evidence separately from native-host observations.
- [x] T-207 Run the build and tests that do not require oasdiff; record skipped comparisons and the local dependency blocker.
- [x] T-208 Run all three comparison scenarios with oasdiff 1.39.0.

## Verification evidence

`OASDIFF_BIN=/opt/homebrew/opt/oasdiff@1.39.0/bin/oasdiff npm run eval:contracts`:
7 passed, 0 skipped, 0 failed. The full check passed 13 tests with no skips.
`brew test oasdiff@1.39.0` passed. Native host checks remain pending and are
tracked in [`docs/evaluation-results.md`](../../docs/evaluation-results.md).
