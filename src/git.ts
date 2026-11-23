import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { ReviewError, runProcess } from "./process.js";

export interface Revision {
  ref: string;
  commit: string;
  specPath: string;
}

function validateSpecPath(specPath: string): void {
  if (/[\\:\u0000-\u001f\u007f]/.test(specPath) ||
      specPath.split("/").some(segment => !segment || segment === "." || segment === "..")) {
    throw new ReviewError("INVALID_ARGUMENT", "Use a canonical repository-relative spec path.");
  }
  if (!/\.(ya?ml|json)$/i.test(specPath)) {
    throw new ReviewError("INVALID_ARGUMENT", "Use a spec file ending in .yaml, .yml, or .json.");
  }
}

export async function getGitRoot(repo: string): Promise<string> {
  const directory = resolve(repo);
  const info = await stat(directory).catch(() => undefined);
  if (!info?.isDirectory()) {
    throw new ReviewError("INVALID_REPOSITORY", "The configured Git worktree directory is unavailable.");
  }
  const result = await runProcess("git", ["rev-parse", "--show-toplevel"], directory);
  if (result.exitCode !== 0) {
    throw new ReviewError("INVALID_REPOSITORY", "Configure the server with the path to a local Git worktree.");
  }
  return result.stdout.trimEnd();
}

export async function readRevision(root: string, specPath: string, ref: string) {
  validateSpecPath(specPath);
  if (ref.startsWith("-") || /[:\u0000-\u0020\u007f]/.test(ref)) {
    throw new ReviewError("INVALID_REF", `Invalid Git reference "${ref}".`);
  }

  const revision = await runProcess("git", ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`], root);
  const commit = revision.stdout.trim();
  if (revision.exitCode !== 0 || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit)) {
    throw new ReviewError("INVALID_REF", `Git reference "${ref}" does not resolve to a local commit.`);
  }

  const tree = await runProcess("git", ["--literal-pathspecs", "ls-tree", "--full-tree", "-z", commit, "--", specPath], root);
  if (tree.exitCode !== 0) {
    throw new ReviewError("GIT_READ_FAILED", "Git could not read the requested commit tree.");
  }
  if (!tree.stdout) {
    throw new ReviewError("SPEC_NOT_FOUND", `No file "${specPath}" exists at "${ref}".`);
  }
  const entry = /^(100644|100755) blob ([a-f0-9]+)\t/.exec(tree.stdout);
  if (!entry || tree.stdout.slice(entry[0].length) !== `${specPath}\0`) {
    throw new ReviewError("INVALID_SPEC", `"${specPath}" at "${ref}" must be a regular file.`);
  }

  const blob = await runProcess("git", ["cat-file", "blob", entry[2] ?? ""], root);
  if (blob.exitCode !== 0) {
    throw new ReviewError("GIT_READ_FAILED", "Git could not read the committed spec blob.");
  }
  return { source: { ref, commit, specPath } satisfies Revision, text: blob.stdout };
}
