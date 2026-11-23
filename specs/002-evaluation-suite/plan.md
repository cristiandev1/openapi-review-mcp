# Implementation plan 002

## Architecture

Keep the evaluation deterministic and local. Reuse the existing temporary Git
fixture generator and MCP SDK client pattern.

1. Extend the generated repository with a branch that removes `POST /orders`.
2. Store scenario refs, operation inputs, and expected structured outcomes in a
   JSON manifest alongside the existing order API example.
3. Add a focused node:test suite that reads each manifest case, calls
   `compare_contracts` and, where declared, `get_endpoint_contract` over the
   existing stdio transport, and asserts the expected evidence.
4. Add a dedicated npm script for running just the contract scenarios. Keep the
   suite included in `npm run check`.
5. Document the fixture assertion, automated protocol results, and native host
   observations as separate evidence categories. Leave host status pending until
   a real host run is recorded.

## Decisions

- Reuse `createDemo` so tests and the documented demo share the same committed
  revisions.
- Keep scenario IDs stable and visible in test output for review and reporting.
- Match findings by severity and affected operation, with a small description
  fragment only where it identifies the intended change. Avoid asserting
  incidental ordering or exact oasdiff wording.
- Never describe an MCP SDK test as a Codex, Claude, or Copilot host test.
