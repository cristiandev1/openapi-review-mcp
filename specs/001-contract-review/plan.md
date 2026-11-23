# Implementation plan 001

## Architecture

Use TypeScript on Node.js 22 or newer. The MCP SDK handles protocol negotiation,
tool input schemas, and stdio transport. The server runs with one configured Git
repository, set using `--repo` or the process working directory.

1. A shared process runner starts Git and oasdiff with argument arrays, timeouts,
   bounded output, and no shell.
2. Resolve each ref to an immutable commit, then read the exact spec blob from
   that commit. Verify that the tree entry is a regular file.
3. Parse the document and check the OpenAPI version, root shape, and reference scope.
4. For comparison, run `oasdiff breaking --format json` against two isolated local
   files. Normalize findings, preserve changed-operation references, and clean up.
5. For operation lookup, read the path item and its effective parameters. Resolve
   directly referenced components and leave nested references inspectable using
   the returned component map. Keep recursive schema graphs finite.
6. Return machine-readable results and equivalent JSON text. Error results include
   `ok: false`, a stable code, and an actionable message.

## Tool contracts

- `compare_contracts(specPath, baseRef, headRef)` returns `base`, `head`,
  `hasBreakingChanges`, and `findings`. Each finding retains oasdiff's identifier,
  severity, description, affected method and path when supplied, and locations
  in the original Git revision when known.
- `get_endpoint_contract(specPath, ref, method, path)` returns the source revision,
  operation, effective parameters, request body, responses, and referenced
  components. Evidence uses JSON Pointers into the original document.

## Decisions

- Use the oasdiff CLI as the compatibility engine. This project adds local Git
  resolution and operation inspection around it.
- Keep the MCP service read-only for Git and prevent it from resolving external
  document references.
- Target the interoperable legacy MCP SDK line for stdio clients that use the
  initialization handshake. Verify actual host support before claiming it.
- Use the same checked-in example in tests, documentation, and the portfolio demo.
