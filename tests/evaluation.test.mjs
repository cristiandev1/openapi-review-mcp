import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createDemo } from "../examples/order-api/create-demo.mjs";

const manifest = JSON.parse(await readFile(new URL("../examples/order-api/scenarios.json", import.meta.url), "utf8"));
const env = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== undefined));
const skipWithoutOasdiff = process.env.SKIP_REAL_OASDIFF === "1"
  ? "oasdiff binary unavailable in this environment"
  : false;

let sandbox;
let repository;
let client;

function payload(response) {
  const text = JSON.parse(response.content[0].text);
  if (!response.isError) assert.deepEqual(text, response.structuredContent);
  return text;
}

async function compare(scenario) {
  const response = await client.callTool({
    name: "compare_contracts",
    arguments: {
      specPath: scenario.specPath,
      baseRef: scenario.baseRef,
      headRef: scenario.headRef,
    },
  });
  assert.notEqual(response.isError, true, `${scenario.id}: ${JSON.stringify(payload(response))}`);
  return payload(response);
}

async function inspect(scenario) {
  const response = await client.callTool({
    name: "get_endpoint_contract",
    arguments: {
      specPath: scenario.specPath,
      ref: scenario.inspect.ref,
      method: scenario.inspect.method,
      path: scenario.inspect.path,
    },
  });
  if (scenario.inspect.expectedErrorCode) {
    assert.equal(response.isError, true, `${scenario.id}: expected an operation lookup error`);
    assert.equal(payload(response).code, scenario.inspect.expectedErrorCode);
    return;
  }

  assert.notEqual(response.isError, true, `${scenario.id}: ${JSON.stringify(payload(response))}`);
  const result = payload(response);
  const schema = result.components["#/components/schemas/CreateOrder"];
  assert.deepEqual(schema.required, scenario.inspect.expectedRequiredFields);
}

before(async () => {
  sandbox = await mkdtemp(join(tmpdir(), "openapi-review-eval-"));
  repository = createDemo(join(sandbox, "repository"));
  client = new Client({ name: "openapi-review-evaluation", version: "0.1.0" });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/server.js", import.meta.url)), "--repo", repository],
    env,
  }));
});

after(async () => {
  await client?.close();
  if (sandbox) await rm(sandbox, { recursive: true, force: true });
});

test("evaluation manifest has unique IDs and complete comparison expectations", () => {
  assert.equal(manifest.version, 1);
  assert.ok(Array.isArray(manifest.scenarios) && manifest.scenarios.length >= 3);
  const ids = manifest.scenarios.map(scenario => scenario.id);
  assert.equal(new Set(ids).size, ids.length, "scenario IDs must be unique");

  for (const scenario of manifest.scenarios) {
    assert.ok(scenario.id && scenario.description, "each scenario needs an ID and description");
    assert.ok(scenario.specPath && scenario.baseRef && scenario.headRef, `${scenario.id} needs refs and a spec path`);
    assert.equal(typeof scenario.expected?.hasBreakingChanges, "boolean", `${scenario.id} needs a compatibility expectation`);
    if (scenario.expected.hasBreakingChanges) {
      assert.ok(scenario.expected.finding, `${scenario.id} needs a finding expectation`);
    } else {
      assert.equal(scenario.expected.findingCount, 0, `${scenario.id} needs an empty finding expectation`);
    }
  }
});

for (const scenario of manifest.scenarios) {
  test(`comparison scenario ${scenario.id}`, { skip: skipWithoutOasdiff }, async () => {
    const result = await compare(scenario);
    assert.equal(result.ok, true, `${scenario.id}: ${JSON.stringify(result)}`);
    assert.equal(result.hasBreakingChanges, scenario.expected.hasBreakingChanges);

    if (scenario.expected.findingCount !== undefined) {
      assert.equal(result.findings.length, scenario.expected.findingCount);
    }

    if (scenario.expected.finding) {
      const expected = scenario.expected.finding;
      const finding = result.findings.find(item =>
        item.severity === expected.severity &&
        (expected.method === undefined || item.method === expected.method) &&
        (expected.path === undefined || item.path === expected.path) &&
        (!expected.descriptionIncludes || item.description.toLowerCase().includes(expected.descriptionIncludes.toLowerCase()))
      );
      assert.ok(finding, `${scenario.id}: expected finding not present in ${JSON.stringify(result.findings)}`);
    }
  });

  if (scenario.inspect) {
    test(`operation evidence ${scenario.id}`, async () => inspect(scenario));
  }

  if (scenario.consumer) {
    test(`outdated consumer fixture ${scenario.id}`, async () => {
      const source = await readFile(join(repository, scenario.consumer.path), "utf8");
      assert.ok(source.includes(scenario.consumer.stalePayloadSnippet), `${scenario.id}: consumer fixture changed`);
      assert.ok(!source.includes(scenario.consumer.missingField), `${scenario.id}: consumer should still omit the required field`);
    });
  }
}
