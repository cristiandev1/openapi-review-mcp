import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { parse } from "yaml";
import { createDemo } from "../examples/order-api/create-demo.mjs";

const env = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== undefined));
let sandbox;
let repository;
let client;

async function connect(extraEnv = {}) {
  const result = new Client({ name: "openapi-review-mcp-acceptance", version: "0.1.0" });
  await result.connect(new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/server.js", import.meta.url)), "--repo", repository],
    env: { ...env, ...extraEnv },
  }));
  return result;
}

function git(...args) {
  return execFileSync("git", args, { cwd: repository, encoding: "utf8" }).trim();
}

function compare(baseRef = "main", headRef = "HEAD", specPath = "openapi.yaml") {
  return client.callTool({ name: "compare_contracts", arguments: { specPath, baseRef, headRef } });
}

function inspect(overrides = {}) {
  return client.callTool({
    name: "get_endpoint_contract",
    arguments: { specPath: "openapi.yaml", ref: "HEAD", method: "POST", path: "/orders", ...overrides },
  });
}

function payload(response) {
  const text = JSON.parse(response.content[0].text);
  if (!response.isError) assert.deepEqual(text, response.structuredContent);
  return text;
}

before(async () => {
  sandbox = await mkdtemp(join(tmpdir(), "openapi-review-test-"));
  repository = createDemo(join(sandbox, "repository"));
  const spec = parse(await readFile(join(repository, "openapi.yaml"), "utf8"));
  spec.openapi = "3.1.0";
  await writeFile(join(repository, "openapi.json"), JSON.stringify(spec, null, 2));
  await writeFile(join(repository, "invalid.yaml"), "openapi: [");
  await writeFile(join(repository, "external.yaml"), "openapi: 3.0.3\ninfo: {title: Example, version: '1'}\npaths: {}\ncomponents: {schemas: {Thing: {$ref: 'other.yaml#/Thing'}}}\n");
  git("add", "openapi.json", "invalid.yaml", "external.yaml");
  git("commit", "-qm", "Add alternate acceptance fixtures");
  client = await connect();
});

after(async () => {
  await client?.close();
  if (sandbox) await rm(sandbox, { recursive: true, force: true });
});

test("FR-004 lists the two read-only MCP tools through stdio", async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name).sort(), ["compare_contracts", "get_endpoint_contract"]);
  assert.ok(tools.every(tool => tool.annotations.readOnlyHint));
});

test("FR-001 detects an incompatible change and an empty compatible diff", {
  skip: process.env.SKIP_REAL_OASDIFF === "1" ? "oasdiff binary unavailable in this environment" : false,
}, async () => {
  const result = payload(await compare());
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.base.commit, git("rev-parse", "main"));
  assert.equal(result.head.commit, git("rev-parse", "HEAD"));
  assert.equal(result.hasBreakingChanges, true);
  const finding = result.findings.find(item => item.method === "POST" && item.path === "/orders" && item.description.includes("currency"));
  assert.equal(finding?.severity, "breaking", JSON.stringify(result));
  assert.equal(finding.headLocation?.specPath, "openapi.yaml");
  assert.ok(finding.headLocation?.line > 0);

  const compatible = payload(await compare("main", "compatible"));
  assert.equal(compatible.ok, true, JSON.stringify(compatible));
  assert.equal(compatible.hasBreakingChanges, false);
  assert.deepEqual(compatible.findings, []);
});

test("FR-002 inspects YAML and JSON, resolves components and honors parameter overrides", async () => {
  for (const specPath of ["openapi.yaml", "openapi.json"]) {
    const result = payload(await inspect({ specPath }));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.source.specPath, specPath);
    assert.equal(result.operationId, "createOrder");
    assert.equal(result.pointer, "/paths/~1orders/post");
    assert.equal(result.parameters.length, 1);
    assert.equal(result.parameters[0].pointer, "/components/parameters/RequestId");
    assert.equal(result.parameters[0].value.description, "Request identifier for order creation.");
    assert.deepEqual(result.components["#/components/schemas/CreateOrder"].required, ["productId", "currency"]);
    assert.equal(result.responses["201"].value.description, "Order created.");
  }
});

test("FR-003 distinguishes invalid refs, paths, missing files, malformed specs, external refs and missing operations", async () => {
  const cases = [
    [inspect({ ref: "does-not-exist" }), "INVALID_REF"],
    [inspect({ specPath: "../openapi.yaml" }), "INVALID_ARGUMENT"],
    [inspect({ specPath: "missing.yaml" }), "SPEC_NOT_FOUND"],
    [inspect({ specPath: "invalid.yaml" }), "INVALID_SPEC"],
    [inspect({ specPath: "external.yaml" }), "UNSUPPORTED_REFERENCE"],
    [inspect({ path: "/unknown" }), "ENDPOINT_NOT_FOUND"],
  ];
  const responses = await Promise.all(cases.map(([request]) => request));
  for (const [index, response] of responses.entries()) {
    assert.equal(response.isError, true);
    assert.equal(payload(response).code, cases[index][1]);
  }
});

test("FR-003 returns an actionable error when the comparison executable is missing", async () => {
  const isolatedClient = await connect({ OASDIFF_BIN: join(sandbox, "missing-oasdiff") });
  try {
    const response = await isolatedClient.callTool({
      name: "compare_contracts",
      arguments: { specPath: "openapi.yaml", baseRef: "main", headRef: "HEAD" },
    });
    assert.equal(response.isError, true);
    assert.equal(payload(response).code, "DEPENDENCY_MISSING");
  } finally {
    await isolatedClient.close();
  }
});

test("FR-005 the demo consumer still omits the newly required field", async () => {
  const result = payload(await inspect());
  assert.ok(result.components["#/components/schemas/CreateOrder"].required.includes("currency"));
  const source = await readFile(join(repository, "client.mjs"), "utf8");
  assert.match(source, /JSON\.stringify\(\{ productId \}\)/);
});
