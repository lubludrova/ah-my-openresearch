import { z } from 'zod';

export const SOURCE_KINDS = ['arxiv', 'doi', 'url', 'wiki', 'zotero'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

const SOURCE_KIND_SET = new Set<string>(SOURCE_KINDS);
const EXP_REF_REGEX = /^exp:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const GIT_HASH_REGEX = /^[0-9a-f]{7,40}$/i;

export function parseSourceRef(ref: string):
  | {
      kind: SourceKind;
      id: string;
      locator?: string;
    }
  | undefined {
  const colon = ref.indexOf(':');
  if (colon <= 0) {
    return undefined;
  }

  const kind = ref.slice(0, colon);
  if (!SOURCE_KIND_SET.has(kind)) {
    return undefined;
  }

  const rest = ref.slice(colon + 1);
  if (!rest) {
    return undefined;
  }

  const hash = rest.indexOf('#');
  if (hash === -1) {
    return { kind: kind as SourceKind, id: rest };
  }

  const id = rest.slice(0, hash);
  const locator = rest.slice(hash + 1);

  if (!id || !locator) {
    return undefined;
  }

  return { kind: kind as SourceKind, id, locator };
}

export function isValidSourceRef(ref: string): boolean {
  return parseSourceRef(ref) !== undefined;
}

export const SourceRefSchema = z.string().refine(isValidSourceRef, {
  message: 'Expected source ref grammar <kind>:<id>[#<locator>].',
});

export const ExpRefSchema = z.string().regex(EXP_REF_REGEX);

export const GitCommitSchema = z.string().regex(GIT_HASH_REGEX);

export const ProvenanceSchema = z.strictObject({
  sources: z.array(SourceRefSchema).default([]),
  experiments: z.array(ExpRefSchema).default([]),
  commits: z.array(GitCommitSchema).default([]),
});

export type Provenance = z.infer<typeof ProvenanceSchema>;
