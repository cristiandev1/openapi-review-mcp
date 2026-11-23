import { parseArgs } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { compareSnapshots } from "./diff.js";
import { getGitRoot, readRevision } from "./git.js";
import { inspectOperation, methods, parseSpec } from "./openapi.js";
import { ReviewError } from "./process.js";

const specPath = z.string().min(1).max(4096).describe("Repository-relative OpenAPI .yaml, .yml, or .json path.");
const gitRef = z.string().min(1).max(1024).describe("An available local Git ref or revision, such as main, HEAD, or HEAD~1.");
const readOnly = { readOnlyHint: true, idempotentHint: true, openWorldHint: false };

const revision = z.object({ ref: gitRef, commit: z.string(), specPath });
const location = revision.extend({ line: z.number(), column: z.number().nullable() });
const finding = z.object({
  id: z.string(),
  severity: z.enum(["breaking", "warning"]),
  description: z.string(),
  comment: z.string().nullable(),
  method: z.string().nullable(),
  operationId: z.string().nullable(),
  path: z.string().nullable(),
  operationPointer: z.string().nullable(),
  baseLocation: location.nullable(),
  headLocation: location.nullable(),
});
const pointedValue = z.object({ pointer: z.string(), value: z.unknown() });

async function asTool(task: () => Promise<Record<string, unknown>>) {
  try {
    const payload = { ok: true, ...await task() };
    return { structuredContent: payload, content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
  } catch (error) {
    const known = error instanceof ReviewError;
    const payload = {
      ok: false,
      code: known ? error.code : "INTERNAL_ERROR",
      message: known ? error.message : "The contract review failed unexpectedly.",
    };
    if (!known) console.error(error);
    return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
  }
}

async function main() {
  const { values } = parseArgs({ options: { repo: { type: "string" } } });
  const repo = values.repo ?? process.cwd();
  const engine = process.env.OASDIFF_BIN || "oasdiff";

  const server = new McpServer({ name: "openapi-review-mcp", version: "0.1.0" }, {
    instructions: "Compare committed OpenAPI specs in the configured local Git repository. Inspect an operation for schema evidence, then search the workspace for consuming call sites. Cite the contract and code separately. Never claim that a caller is affected without locating it.",
  });

  server.registerTool("compare_contracts", {
    title: "Compare committed OpenAPI contracts",
    description: "Find breaking and warning-level OpenAPI changes between two local Git revisions. Returns commit IDs, changed operations, and source evidence when available.",
    inputSchema: { specPath, baseRef: gitRef, headRef: gitRef },
    outputSchema: {
      ok: z.literal(true),
      base: revision,
      head: revision,
      hasBreakingChanges: z.boolean(),
      findings: z.array(finding),
    },
    annotations: readOnly,
  }, args => asTool(async () => {
    const root = await getGitRoot(repo);
    const [base, head] = await Promise.all([
      readRevision(root, args.specPath, args.baseRef),
      readRevision(root, args.specPath, args.headRef),
    ]);
    parseSpec(base.text, base.source);
    parseSpec(head.text, head.source);
    return compareSnapshots(base, head, engine);
  }));

  server.registerTool("get_endpoint_contract", {
    title: "Inspect a committed OpenAPI operation",
    description: "Inspect request, response, and parameter evidence for an exact OpenAPI operation at a local Git revision. Includes source pointers and referenced components.",
    inputSchema: {
      specPath,
      ref: gitRef,
      method: z.enum(methods).describe("Uppercase HTTP method."),
      path: z.string().startsWith("/").max(2048).describe("Exact OpenAPI path template, such as /orders/{id}."),
    },
    outputSchema: {
      ok: z.literal(true),
      source: revision,
      method: z.enum(methods),
      path: z.string(),
      pointer: z.string(),
      operationId: z.string().nullable(),
      parameters: z.array(pointedValue),
      requestBody: pointedValue.nullable(),
      responses: z.record(z.string(), pointedValue),
      components: z.record(z.string(), z.unknown()),
    },
    annotations: readOnly,
  }, args => asTool(async () => {
    const root = await getGitRoot(repo);
    const snapshot = await readRevision(root, args.specPath, args.ref);
    return inspectOperation(parseSpec(snapshot.text, snapshot.source), snapshot.source, args.method, args.path);
  }));

  await server.connect(new StdioServerTransport());
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
