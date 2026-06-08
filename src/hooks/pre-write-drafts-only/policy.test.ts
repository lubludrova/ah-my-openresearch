// Phase 6 verifiable: write-boundary policy correctly classifies paths.

import { describe, expect, test } from 'bun:test';
import { classifyLabWrite } from './policy';

const ROOT = '/tmp/sample-project';

describe('classifyLabWrite', () => {
  test.each([
    ['lab/drafts/claim-foo.md', 'allow', 'inside-allowlist'],
    ['lab/drafts/exp-bar-2026-06-03.md', 'allow', 'inside-allowlist'],
    ['lab/drafts/idea-baz.md', 'allow', 'inside-allowlist'],
    ['lab/drafts/subdir/anything.md', 'allow', 'inside-allowlist'],
    ['lab/log.md', 'allow', 'inside-allowlist'],
    ['lab/edges.jsonl', 'allow', 'inside-allowlist'],
    ['lab/index.md', 'allow', 'inside-allowlist'],
  ])('allows inside-allowlist: %s', (target, decision, reason) => {
    const v = classifyLabWrite(ROOT, target);
    expect(v.decision).toBe(decision as 'allow' | 'deny');
    expect(v.reason).toBe(reason as LabWriteVerdictReason);
  });

  test.each([
    ['lab/README.md', 'deny'],
    ['lab/SCHEMA.md', 'deny'],
    ['lab/canon/claim-foo.md', 'deny'], // doesn't exist in MVP; would be canon
    ['lab/critique/note.md', 'deny'], // doesn't exist in MVP
    ['lab/random.md', 'deny'],
    ['lab/edges.jsonl.bak', 'deny'], // close-but-not-allowlist names
  ])('denies inside-lab-not-allowlisted: %s', (target, decision) => {
    const v = classifyLabWrite(ROOT, target);
    expect(v.decision).toBe(decision as 'allow' | 'deny');
    expect(v.reason).toBe('inside-lab-not-allowlisted');
    expect(v.labSubpath).toBeDefined();
  });

  test.each([
    'src/main.ts',
    'README.md',
    '../sibling-project/lab/drafts/x.md',
    '/etc/passwd',
    '/tmp/other-project/lab/drafts/x.md',
  ])('treats target outside lab/ as outside-lab: %s', (target) => {
    const v = classifyLabWrite(ROOT, target);
    expect(v.decision).toBe('allow');
    expect(v.reason).toBe('outside-lab');
  });

  test('handles `..`-traversal that escapes lab/', () => {
    const v = classifyLabWrite(ROOT, 'lab/../etc/passwd');
    expect(v.decision).toBe('allow');
    expect(v.reason).toBe('outside-lab');
  });

  test('denies `..`-traversal that lands back inside lab/ outside allowlist', () => {
    const v = classifyLabWrite(ROOT, 'lab/drafts/../README.md');
    expect(v.decision).toBe('deny');
    expect(v.reason).toBe('inside-lab-not-allowlisted');
  });

  test('handles absolute paths under the project lab', () => {
    const v = classifyLabWrite(ROOT, `${ROOT}/lab/drafts/claim.md`);
    expect(v.decision).toBe('allow');
    expect(v.reason).toBe('inside-allowlist');
  });

  test('handles absolute paths under the project lab but outside allowlist', () => {
    const v = classifyLabWrite(ROOT, `${ROOT}/lab/SCHEMA.md`);
    expect(v.decision).toBe('deny');
    expect(v.reason).toBe('inside-lab-not-allowlisted');
  });

  test('empty target → allow with empty-target reason', () => {
    const v = classifyLabWrite(ROOT, '');
    expect(v.decision).toBe('allow');
    expect(v.reason).toBe('empty-target');
  });
});

type LabWriteVerdictReason =
  | 'outside-lab'
  | 'inside-allowlist'
  | 'inside-lab-not-allowlisted'
  | 'empty-target';
