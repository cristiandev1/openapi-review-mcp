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
| Codex | Setup documented. Native host run pending. |
| Claude Code | Setup documented. Native host run pending. |
| GitHub Copilot in VS Code | Setup documented. Native host run pending. |

## Reproduce the review

From this repository, run `npm run demo`. The command prints a new temporary
Git worktree with `main`, `compatible`, and `feature/require-currency` branches.
Use that directory as the server's `--repo` path and open it as the assistant's
workspace. Submit the prompt above.

Expected evidence:

1. The new contract for `POST /orders` requires `currency`, whose allowed values
   are `USD` and `EUR`.
2. Comparing `main` with `compatible` returns no breaking changes or warnings.
3. The demo's `client.mjs` still sends only `productId`. The assistant should cite
   that file when it explains the change needed by this caller.

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

The [specification](specs/001-contract-review/spec.md) defines the result and
acceptance criteria. The [plan](specs/001-contract-review/plan.md) records the
implementation decisions. The [tasks](specs/001-contract-review/tasks.md) trace
them to tests. [AGENTS.md](AGENTS.md) is the entry point for coding agents, and
[CHANGELOG.md](CHANGELOG.md) tracks user-facing changes.

Run `npm run check` to build and run the full suite against an installed oasdiff.
Use `SKIP_REAL_OASDIFF=1 npm run check` only to exercise the remaining cases
when the executable is unavailable.

MIT licensed.
