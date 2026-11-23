# Specification 001: Local OpenAPI contract review

## Problem

When a backend pull request changes an API contract, frontend, mobile, and SDK
developers need to know which contract assumptions changed and where their callers
may need an update. A coding agent should be able to inspect the exact committed
versions and follow a finding back to the operation schema.

## User journey

A developer configures the local MCP server for a Git repository. They ask their
coding assistant to compare `main` with `HEAD`, inspect a changed operation, and
locate a caller that still uses the old contract. The developer verifies the
reported location and decides how to adapt the caller.

## Functional requirements

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| FR-001 | Compare one repository-relative OpenAPI path at two local Git commit references. Return the resolved commits and breaking or warning findings from oasdiff. | A required `currency` request field is reported for `POST /orders`; a non-breaking change yields an empty findings array. |
| FR-002 | Retrieve a standard HTTP operation by method and exact OpenAPI path at a chosen revision. Return request and response evidence, including the effective parameters. | Lookup works for YAML and JSON, operation parameters override matching path parameters, and internal references can be inspected without recursively expanding schemas. |
| FR-003 | Give stable, actionable errors for invalid arguments or revisions, missing files or operations, invalid or unsupported specs, external references, and engine/setup failures. | Acceptance cases exercise these categories through MCP or focused integration tests. |
| FR-004 | Publish both tools over local MCP stdio with structured responses and a JSON text fallback. | A real MCP client starts the built executable, lists both tools, and calls them. |
| FR-005 | Provide a reproducible example and setup instructions for Codex, Claude Code, and Copilot in VS Code. | A temporary demo repository reproduces the contract change and has a caller that omits `currency`. The README distinguishes documented host setup from tested host integrations. |

## Boundaries

- One configured local Git repository and one self-contained OpenAPI 3.0 or 3.1
  document per revision. YAML and JSON are supported.
- Both revisions are resolved to commits before reading their blobs. Uncommitted
  edits are outside the comparison.
- Paths are canonical, repository-relative, and slash-separated. No fetches or
  branch checkouts are performed by the tools.
- Local JSON Pointer references into the same document are supported. External
  references and external schema identifiers are rejected before invoking oasdiff.
- The server exposes operation evidence. Workspace search and narrative analysis
  are performed by the host. Consumer-specific impact needs evidence from a caller.
- The first version exposes local stdio. Hosted HTTP transport is outside this release.

## Release criteria

The test matrix covers a breaking change, a compatible change, operation inspection,
error handling, and a real stdio session. A clean checkout can reproduce the demo
with the documented prerequisites.
