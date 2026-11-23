# Agent guide

OpenAPI Review MCP compares two committed API contracts and supplies operation-level
evidence to a coding agent. It runs locally. The agent can then inspect its
workspace for affected call sites. The server returns evidence about the contract
and never claims to have found an affected caller.

## Read in this order

1. [Current specification](specs/001-contract-review/spec.md) for behavior, scope, and acceptance criteria.
2. [Implementation plan](specs/001-contract-review/plan.md) for boundaries and design decisions.
3. [Task list](specs/001-contract-review/tasks.md) for requirement-to-test traceability.
4. [README](README.md) for installation and the reproducible demo.
5. [Changelog](CHANGELOG.md) for released and pending user-facing changes.

## How to change this repository

- Write or update the spec and acceptance cases before changing behavior. Use a new numbered spec for a new feature.
- Update the plan and tasks with the affected requirement IDs. Check a task off after its evidence is verified.
- Make the smallest implementation that passes the acceptance cases. Use existing helpers.
- Preserve tool names, documented inputs, result fields, and error codes unless a spec explicitly changes them.
- Keep all repository documentation, code identifiers, tool messages, and changelog entries in English.
- Run `npm run check` before declaring the change complete. Record actual host checks in the README.
- Put user-facing changes under Unreleased in CHANGELOG.md until a release is cut.

## Runtime boundaries

- MCP stdout is reserved for the protocol. Operational diagnostics belong on stderr.
- Use Git arguments and committed blobs. Avoid shell interpolation, network access, and worktree mutation.
- Restrict spec paths to the configured repository. Reject external references before invoking oasdiff.
- Compatibility findings come from oasdiff. Operation evidence comes from the selected OpenAPI revision.
- Demo data is synthetic. Do not commit customer specs, credentials, or machine-specific paths.
