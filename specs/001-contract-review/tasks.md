# Tasks 001

- [x] T-001 Define scope, runtime boundaries, and acceptance requirements.
- [x] T-002 Set up TypeScript, the SDK, and the Git-backed fixture workflow. FR-001, FR-004, FR-005.
- [x] T-003 Read and validate committed OpenAPI documents with typed errors. FR-001, FR-003.
- [x] T-004 Implement CLI-backed compatibility findings and evidence. FR-001, FR-003.
- [x] T-005 Implement operation inspection with parameter overrides and local references. FR-002, FR-003.
- [x] T-006 Register and exercise both tools through a real stdio session. FR-004.
- [x] T-007 Verify acceptance cases and document the three host configurations. FR-001 through FR-005.
- [x] T-008 Verify the demo from a clean checkout and record actual host coverage. FR-005.
- [ ] T-009 Run the same demo in Codex, Claude Code, and Copilot in VS Code, then update their verification status. FR-005.

## Verification evidence

The [first acceptance run](https://github.com/cristiandev1/openapi-review-mcp/actions/runs/45102486299)
installed the pinned engine in a clean checkout and passed all six tests. The suite
started the server through the MCP SDK stdio client and reproduced both contract
comparisons and the outdated consumer. Native host runs are tracked in T-009.
