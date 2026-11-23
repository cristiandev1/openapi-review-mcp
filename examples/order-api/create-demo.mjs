import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function createDemo(directory = mkdtempSync(join(tmpdir(), "openapi-review-demo-"))) {
  const root = resolve(directory);
  mkdirSync(root, { recursive: true });
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.name", "OpenAPI Review Demo");
  git("config", "user.email", "openapi-review@example.invalid");
  git("config", "commit.gpgsign", "false");

  const specPath = join(root, "openapi.yaml");
  const base = readFileSync(new URL("./openapi.yaml", import.meta.url), "utf8");
  writeFileSync(specPath, base);
  copyFileSync(new URL("./client.mjs", import.meta.url), join(root, "client.mjs"));
  git("add", "openapi.yaml", "client.mjs");
  git("commit", "-qm", "Add the initial order API and its consumer");

  git("switch", "-qc", "compatible");
  const compatible = base.replace("version: 1.0.0", "version: 1.1.0");
  writeFileSync(specPath, compatible);
  git("commit", "-qam", "Bump the contract version");

  git("switch", "-qc", "feature/require-currency");
  writeFileSync(specPath, compatible.replace("required: [productId]", "required: [productId, currency]"));
  git("commit", "-qam", "Require currency when creating orders");

  git("switch", "-q", "compatible");
  git("switch", "-qc", "feature/remove-order-operation");
  const withoutOrderOperation = compatible.replace(
    /paths:\n  \/orders:[\s\S]*?\ncomponents:/,
    "paths: {}\ncomponents:",
  );
  if (withoutOrderOperation === compatible) {
    throw new Error("Could not remove the order operation from the demo contract.");
  }
  writeFileSync(specPath, withoutOrderOperation);
  git("commit", "-qam", "Remove the order creation operation");
  git("switch", "-q", "feature/require-currency");
  return root;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const path = process.argv[2];
  if (path) {
    // An explicit destination must be new to keep the demo out of existing repositories.
    mkdirSync(resolve(path));
  }
  process.stdout.write(`${createDemo(path)}\n`);
}
