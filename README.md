# OpenAPI Review MCP

Review a backend contract change against the client code in your workspace.
This local MCP server compares committed OpenAPI specs and supplies evidence for
the coding assistant to locate affected call sites.

## What you can ask

> Compare `openapi.yaml` between `main` and `HEAD`. Flag breaking changes,
> inspect the new contract for each affected operation, then find the callers
> in this workspace. Cite the spec and the caller separately.

The MCP supplies the Git revisions, compatibility findings, and operation
schemas. The assistant searches for call sites using its workspace access.

## Install

Requirements: Node.js 22+, Git, and [oasdiff](https://github.com/oasdiff/oasdiff/releases/tag/v1.39.0).
CI pins oasdiff 1.39.0. Install it from its official release or with
`brew install oasdiff` on macOS. Ensure the executable is on the MCP host's
`PATH`, or define `OASDIFF_BIN` with its absolute path.

```sh
git clone https://github.com/cristiandev1/openapi-review-mcp.git
cd openapi-review-mcp
npm ci
npm run build
```

Configure the host to launch `node` with two absolute paths: one to
`dist/server.js` in this repository and one to the Git worktree with the
API contract. Keep the MCP installation path separate from the target worktree.

### Codex

Add to `~/.codex/config.toml` or use the desktop app's MCP server settings.

```toml
[mcp_servers.openapi_review]
command = "node"
args = ["/absolute/path/openapi-review-mcp/dist/server.js", "--repo", "/absolute/path/api-worktree"]
```

### Claude Code

```sh
claude mcp add --transport stdio openapi-review -- node /absolute/path/openapi-review-mcp/dist/server.js --repo /absolute/path/api-worktree
```

### GitHub Copilot in VS Code

Add the server as a local stdio command in Copilot's MCP configuration. The
workspace-root portable Copilot configuration is `.mcp.json`.

```json
{
  "mcpServers": {
    "openapi-review": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/absolute/path/openapi-review-mcp/dist/server.js",
        "--repo",
        "/absolute/path/api-worktree"
      ],
      "tools": ["*"]
    }
  }
}
```

| Environment | Verification |
| --- | --- |
| MCP TypeScript SDK client | [Verified in GitHub Actions](https://github.com/cristiandev1/openapi-review-mcp/actions/runs/45102486299) with oasdiff 1.39.0 |
| Contract scenario suite | Run `npm run eval:contracts`; included in `npm run check`. See [evaluation results](docs/evaluation-results.md). |
| Codex | Setup documented. Native host run pending. |
| Claude Code | Setup documented. Native host run pending. |
| GitHub Copilot in VS Code | Setup documented. Native host run pending. |

## Reproduce the review

From this repository, run `npm run demo`. The command prints a new temporary
Git worktree with `main`, `compatible`, `feature/require-currency`, and
`feature/remove-order-operation` branches.
Use that directory as the server's `--repo` path and open it as the assistant's
workspace. Submit the prompt above.

Expected evidence:

1. The new contract for `POST /orders` requires `currency`, whose allowed values
   are `USD` and `EUR`.
2. Comparing `main` with `compatible` returns no breaking changes or warnings.
3. The demo's `client.mjs` still sends only `productId`. The assistant should cite
   that file when it explains the change needed by this caller.
4. `feature/remove-order-operation` removes `POST /orders` and is reported as a
   breaking change.

## Contract scenario evaluation

The checked-in [scenario manifest](examples/order-api/scenarios.json) defines
synthetic compatible, required-field, and removed-operation cases. Run the
focused suite with:

```sh
npm run eval:contracts
```

The suite starts the built MCP server through the TypeScript SDK stdio client,
checks structured tool results against each scenario, and confirms that the
required-field fixture still contains its outdated consumer. It is included in
`npm run check`. These automated checks validate the server and its fixtures;
they do not measure whether an LLM host finds or cites a caller correctly.

Record native host runs separately in
[`docs/evaluation-results.md`](docs/evaluation-results.md). Include the host,
date, actual tool calls, contract finding, and exact workspace file and line.
Keep pending status until a run has actually been completed.

## Tool contracts

| Tool | Required arguments | Result |
| --- | --- | --- |
| `compare_contracts` | `specPath`, `baseRef`, `headRef` | Resolved commits, breaking-change flag, findings, and available source locations |
| `get_endpoint_contract` | `specPath`, `ref`, uppercase `method`, exact template `path` | Commit, operation pointer, effective parameters, request body, responses, and referenced components |

Both tools return structured data and equivalent JSON text for successful calls
with `ok: true`. Domain failures return JSON text with `ok: false`, a stable `code`, and a
`message`. Host input-shape validation follows the MCP SDK's error handling.
Treat contract findings as possible client impact until a caller is found.

The server reads local commits. Fetch the base branch yourself if it is absent.
It supports self-contained OpenAPI 3.0 and 3.1 specs in YAML or JSON and internal
JSON Pointer references. External references, YAML aliases, uncommitted files,
remote execution, and hosted transports are outside this version's scope.

## How it is built

The specifications under `specs/` define behavior and acceptance criteria. The
plans record implementation decisions, and task lists trace requirements to
tests. [AGENTS.md](AGENTS.md) is the entry point for coding agents,
[CHANGELOG.md](CHANGELOG.md) tracks user-facing changes, and
[`docs/evaluation-results.md`](docs/evaluation-results.md) distinguishes
automated evidence from native host observations.

Run `npm run check` to build and run the full suite against an installed oasdiff.
Use `SKIP_REAL_OASDIFF=1 npm run check` only to exercise the remaining cases
when the executable is unavailable.

MIT licensed.
