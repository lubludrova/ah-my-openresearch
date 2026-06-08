// Phase 6 write-boundary policy — pure path classification.
//
// Given a project root and a target write path, decide whether the write is:
//   - allowed and inside the lab/ MVP allowlist;
//   - allowed because the target is outside lab/ (not this hook's concern);
//   - denied because the target is inside lab/ but NOT in the allowlist.
//
// The hook in ./index.ts consumes this verdict to either pass through or
// throw on the host's `tool.execute.before` event.

import { isAbsolute, relative, resolve, sep } from 'node:path';

// Allowed subpaths inside `<project>/lab/` per D11/D24.
const ALLOWED_LAB_EXACT_FILES = new Set(['log.md', 'edges.jsonl', 'index.md']);
const ALLOWED_LAB_TOP_LEVEL_DIRS = new Set(['drafts']);

export type LabWriteDecision = 'allow' | 'deny';

export interface LabWriteVerdict {
  decision: LabWriteDecision;
  reason:
    | 'outside-lab'
    | 'inside-allowlist'
    | 'inside-lab-not-allowlisted'
    | 'empty-target';
  // Relative path under lab/ when target is inside lab/, otherwise undefined.
  labSubpath?: string;
}

export function classifyLabWrite(
  projectRoot: string,
  targetPath: string,
): LabWriteVerdict {
  if (!targetPath || targetPath.length === 0) {
    return { decision: 'allow', reason: 'empty-target' };
  }

  const labRoot = resolve(projectRoot, 'lab');
  const absolute = isAbsolute(targetPath)
    ? resolve(targetPath)
    : resolve(projectRoot, targetPath);
  const rel = relative(labRoot, absolute);

  // Outside lab/ (including `..`-escape and absolute paths in unrelated trees).
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    return { decision: 'allow', reason: 'outside-lab' };
  }

  const segments = rel.split(sep);
  const first = segments[0];

  if (ALLOWED_LAB_TOP_LEVEL_DIRS.has(first)) {
    return {
      decision: 'allow',
      reason: 'inside-allowlist',
      labSubpath: rel,
    };
  }

  if (segments.length === 1 && ALLOWED_LAB_EXACT_FILES.has(first)) {
    return {
      decision: 'allow',
      reason: 'inside-allowlist',
      labSubpath: rel,
    };
  }

  return {
    decision: 'deny',
    reason: 'inside-lab-not-allowlisted',
    labSubpath: rel,
  };
}
