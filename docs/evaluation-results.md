# Evaluation results

This file separates deterministic MCP checks from coding-assistant host
observations. Update a status only after performing the corresponding run. Demo
contracts and client code are synthetic.

## Automated MCP contract evaluation

| Field | Result |
| --- | --- |
| Status | Partial local verification; the comparison cases were skipped |
| Commands | `SKIP_REAL_OASDIFF=1 npm run eval:contracts`; `SKIP_REAL_OASDIFF=1 npm run check` |
| Transport | MCP TypeScript SDK client over stdio |
| Runtime | Node.js 22.16.0; npm 10.9.2 |
| Compatibility engine | Required: oasdiff 1.39.0; unavailable locally |
| Scenarios | Compatible version change; required request field; removed operation |
| Scope | Structured server results, operation lookup, and the intentionally outdated fixture |

On 2026-11-23, the focused suite reported 4 passed, 3 skipped, and 0 failed.
The full check reported 9 passed, 4 skipped, and 0 failed. Build, manifest
validation, operation inspection, and the stale consumer fixture passed. All
three compatibility comparisons were skipped because `oasdiff` was not on the
local `PATH`. A download attempt failed with `curl: (6) Could not resolve host:
github.com`, so no oasdiff comparison result is claimed for this local run.
GitHub Actions installs the pinned 1.39.0 binary and runs `npm run check`.

The focused suite must not be described as an LLM or native-host evaluation.
Run it without `SKIP_REAL_OASDIFF=1` after installing the pinned engine to
complete the comparison scenarios.

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
