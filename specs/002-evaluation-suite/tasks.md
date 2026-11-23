# Tasks 002

- [x] T-201 Define evaluation scope and acceptance cases before implementation.
- [x] T-202 Add the removed-operation revision to the synthetic Git demo.
- [x] T-203 Add a scenario manifest for compatible, required-field, and removed-operation changes.
- [x] T-204 Exercise manifest scenarios through the MCP SDK stdio client.
- [x] T-205 Add an evaluation command and keep scenarios in the full check.
- [x] T-206 Document automated evidence separately from native-host observations.
- [x] T-207 Run the build and tests that do not require oasdiff; record skipped comparisons and the local dependency blocker.
- [ ] T-208 Run all three comparison scenarios with oasdiff 1.39.0.

## Verification evidence

`SKIP_REAL_OASDIFF=1 npm run eval:contracts`: 4 passed, 3 skipped, 0 failed.
`SKIP_REAL_OASDIFF=1 npm run check`: 9 passed, 4 skipped, 0 failed. The skipped
cases require oasdiff. T-208 and all native host checks remain pending.
Native host evidence is tracked in
[`docs/evaluation-results.md`](../../docs/evaluation-results.md).
