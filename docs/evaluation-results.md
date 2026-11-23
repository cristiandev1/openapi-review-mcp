# Evaluation results

This file separates deterministic MCP checks from coding-assistant host
observations. Update a status only after performing the corresponding run. Demo
contracts and client code are synthetic.

## Automated MCP contract evaluation

| Field | Result |
| --- | --- |
| Status | Passed locally |
| Commands | `OASDIFF_BIN=/opt/homebrew/opt/oasdiff@1.39.0/bin/oasdiff npm run eval:contracts`; `OASDIFF_BIN=/opt/homebrew/opt/oasdiff@1.39.0/bin/oasdiff npm run check` |
| Transport | MCP TypeScript SDK client over stdio |
| Runtime | Node.js 22.16.0; npm 10.9.2 |
| Compatibility engine | oasdiff 1.39.0, installed with a local Homebrew formula from the official macOS release asset |
| Scenarios | Compatible version change; required request field; removed operation |
| Scope | Structured server results, operation lookup, and the intentionally outdated fixture |

On 2026-11-23, `npm run eval:contracts` reported 7 passed, 0 skipped, and 0
failed. The full `npm run check` reported 13 passed, 0 skipped, and 0 failed.
`brew test oasdiff@1.39.0` also passed, and the binary reported
`oasdiff version 1.39.0`. The installed formula uses the official release asset
with SHA-256 `fe88d9950324d3b0ebeaf8e0d3a210b64cb099a0f55fce5ee5a22b276df0eac4`.
GitHub Actions independently installs the pinned 1.39.0 binary and runs
`npm run check`.

The focused suite validates deterministic MCP output and fixtures. It is not an
LLM or native-host evaluation.

## Native host review

| Host | Status | Evidence |
| --- | --- | --- |
| Codex CLI | Pending | Record actual tool calls, finding, commit IDs, and cited client file and line. |
| Claude Code | Pending | Record only after a native session is run. |
| GitHub Copilot in VS Code | Pending | Record only after a native session is run. |

For each completed host run, record the date, host/version, scenario refs and
commit IDs, actual MCP tool calls, observed contract finding, exact consumer
file and line, whether the suggested fix was correct, and any blocker. Do not
copy expected output into the observed result field.

## Run record template

```text
Date:
Host and version:
Scenario ID:
Base commit:
Head commit:
MCP tools called:
Observed contract finding:
Observed consumer citation:
Suggested fix assessment:
Outcome and limitations:
```
