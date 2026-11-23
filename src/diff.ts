import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { z } from "zod";
import { type Revision } from "./git.js";
import { escapePointer } from "./openapi.js";
import { ReviewError, runProcess } from "./process.js";

const position = z.object({
  line: z.number().int().nonnegative().optional(),
  column: z.number().int().nonnegative().optional(),
});
const engineFinding = z.object({
  id: z.string().min(1),
  text: z.string(),
  level: z.literal([0, 1, 2, 3]),
  operation: z.string().optional(),
  operationId: z.string().optional(),
  path: z.string().optional(),
  section: z.string().optional(),
  comment: z.string().optional(),
  baseSource: position.nullish(),
  revisionSource: position.nullish(),
});
const engineReport = z.array(engineFinding).nullable();

type Snapshot = { source: Revision; text: string };
type Position = z.infer<typeof position>;

function evidence(source: Revision, where: Position | null | undefined) {
  if (!where?.line) return null;
  return { ...source, line: where.line, column: where.column || null };
}

export async function compareSnapshots(base: Snapshot, head: Snapshot, engine: string) {
  const temporary = await mkdtemp(join(tmpdir(), "openapi-review-"));
  try {
    const extension = extname(base.source.specPath).toLowerCase();
    const baseFile = join(temporary, `base${extension}`);
    const headFile = join(temporary, `revision${extension}`);
    await Promise.all([
      writeFile(baseFile, base.text, { mode: 0o600 }),
      writeFile(headFile, head.text, { mode: 0o600 }),
    ]);

    const result = await runProcess(engine, ["breaking", "--format", "json", baseFile, headFile], temporary);
    if (result.exitCode > 1 || (result.exitCode === 1 && !result.stdout.trim())) {
      throw new ReviewError("DIFF_FAILED", "oasdiff could not compare these specs. Check that both documents are valid OpenAPI and that the required CLI version is installed.");
    }

    let report: z.infer<typeof engineReport>;
    try {
      report = engineReport.parse(JSON.parse(result.stdout));
    } catch {
      throw new ReviewError("DIFF_FAILED", "oasdiff did not return a supported JSON report. Check the tool version and the two OpenAPI documents.");
    }

    const findings = (report ?? []).map(finding => {
      const severity = finding.level === 3 ? "breaking"
        : finding.level === 2 ? "warning" : "info";
      return {
        id: finding.id,
        severity,
        description: finding.text,
        comment: finding.comment ?? null,
        method: finding.operation?.toUpperCase() ?? null,
        operationId: finding.operationId ?? null,
        path: finding.path ?? null,
        operationPointer: finding.path && finding.operation && (finding.section === undefined || finding.section === "paths")
          ? `/paths/${escapePointer(finding.path)}/${finding.operation.toLowerCase()}`
          : null,
        baseLocation: evidence(base.source, finding.baseSource),
        headLocation: evidence(head.source, finding.revisionSource),
      };
    });
    return {
      base: base.source,
      head: head.source,
      hasBreakingChanges: findings.some(finding => finding.severity === "breaking"),
      findings: findings.filter(finding => finding.severity !== "info"),
    };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
