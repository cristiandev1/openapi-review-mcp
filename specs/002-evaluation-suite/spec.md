# Specification 002: Contract review evaluation suite

## Problem

The existing demo proves the MCP protocol and two contract outcomes, but its
expectations are embedded in one protocol test. Developers need a small,
repeatable scenario suite that makes coverage visible and distinguishes server
evidence from a coding assistant's workspace analysis.

## User journey

A maintainer runs the evaluation command and sees each synthetic contract
scenario pass or fail through the real MCP stdio client. They can then run the
same demo in a native coding assistant, record its actual tool calls and client
citations, and report host results separately from automated protocol results.

## Functional requirements

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| FR-201 | Define contract scenarios in a checked-in, machine-readable manifest with stable IDs, Git refs, spec path, and explicit expected results. | The manifest contains compatible, required-field, and removed-operation cases. |
| FR-202 | Run every manifest case against the built MCP server over stdio and assert actual compatibility results. | `npm run eval:contracts` passes against oasdiff 1.39.0 and reports each scenario by ID. |
| FR-203 | Inspect the relevant operation at the requested revision when a scenario requires operation evidence. | The required-field scenario verifies the committed contract requires `currency`; the removed-operation scenario verifies the endpoint is absent. |
| FR-204 | Keep synthetic consumer fixture checks separate from host-level caller discovery. | Automated tests confirm the fixture still sends the old request; documentation states that only a native host run can verify model-driven file and line citations. |
| FR-205 | Record verification mode and observed status without inventing native host results. | Evaluation documentation marks automated protocol and native host evidence separately, with host runs pending until actually performed. |

## Boundaries

- Scenarios use synthetic OpenAPI documents and temporary local Git repositories.
- Contract expectations are tested through the MCP SDK stdio client and the
  configured local oasdiff executable.
- The automated suite does not call an LLM or assert generated prose.
- Host-specific observations are manually recorded with the host, date, tool
  calls, actual result, and cited workspace file and line.
- This feature does not change the MCP tool schemas or runtime behavior.

## Release criteria

All three scenarios pass from a clean checkout with the pinned oasdiff version.
The README gives the evaluation command and separates protocol evidence from
native-host evidence. The recorded host status reflects only sessions actually
performed.
