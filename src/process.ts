import { execFile } from "node:child_process";

export class ReviewError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function runProcess(command: string, args: string[], cwd?: string): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd,
      env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      timeout: 30_000,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error && typeof error.code !== "number") {
        reject(new ReviewError(
          error.code === "ENOENT" ? "DEPENDENCY_MISSING" : "PROCESS_FAILED",
          error.code === "ENOENT"
            ? `The executable "${command}" is unavailable. Check the installation and PATH.`
            : `The command "${command}" could not finish within its execution limits.`,
        ));
        return;
      }
      resolve({ stdout, stderr, exitCode: error ? Number(error.code) : 0 });
    });
  });
}
