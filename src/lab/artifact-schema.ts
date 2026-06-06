import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { LAB_SCHEMA_VERSION } from '../config/constants';
import { isValidNodeId } from './id-generator';
import { ProvenanceSchema } from './provenance';

export const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const NodeIdSchema = z.string().refine(isValidNodeId, {
  message:
    'Expected lab node id: claim:<slug>, idea:<slug>, or exp:<slug>-YYYY-MM-DD.',
});
export const ConfidenceSchema = z.enum(['low', 'medium', 'high']);

const DomainSchema = z.record(z.string(), z.unknown()).default({});
const NodeRefListSchema = z.array(NodeIdSchema).default([]);
const ExpRefListSchema = z
  .array(z.string().regex(/^exp:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/))
  .default([]);
const ClaimRefListSchema = z
  .array(z.string().regex(/^claim:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/))
  .default([]);
const IdeaRefListSchema = z
  .array(z.string().regex(/^idea:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/))
  .default([]);

const BaseArtifactFields = {
  schema_version: z.literal(LAB_SCHEMA_VERSION).default(LAB_SCHEMA_VERSION),
  node_id: NodeIdSchema,
  title: z.string().min(1),
  created: DateStringSchema,
  updated: DateStringSchema,
  tags: z.array(z.string()).default([]),
  provenance: ProvenanceSchema.default({
    sources: [],
    experiments: [],
    commits: [],
  }),
  domain: DomainSchema,
};

export const ClaimFrontmatterSchema = z.strictObject({
  ...BaseArtifactFields,
  type: z.literal('claim'),
  status: z.enum(['open', 'supported', 'partial', 'invalidated']),
  confidence: ConfidenceSchema,
  contradicts: NodeRefListSchema,
  supports: NodeRefListSchema,
  tested_by: ExpRefListSchema,
});
export type ClaimFrontmatter = z.infer<typeof ClaimFrontmatterSchema>;

export const IdeaFrontmatterSchema = z.strictObject({
  ...BaseArtifactFields,
  type: z.literal('idea'),
  status: z.enum(['open', 'selected', 'rejected', 'superseded']),
  hypothesis: z.string().default(''),
  target_gaps: z.array(z.string()).default([]),
  motivated_by: z.array(z.string()).default([]),
  planned_experiments: ExpRefListSchema,
});
export type IdeaFrontmatter = z.infer<typeof IdeaFrontmatterSchema>;

export const ExperimentPlanSchema = z.strictObject({
  question: z.string().default(''),
  metrics: z.array(z.string()).default([]),
  baselines: z.array(z.string()).default([]),
  ablations: z.array(z.string()).default([]),
  seeds: z.number().int().positive().nullable().default(null),
});

export const ExperimentRunSchema = z.strictObject({
  commit: z.string().default(''),
  command: z.string().default(''),
  started_at: z.string().nullable().default(null),
  completed_at: z.string().nullable().default(null),
});

export const ExperimentResultsSchema = z.strictObject({
  result_files: z.array(z.string()).default([]),
  summary: z.string().default(''),
  outcome: z
    .enum(['unknown', 'supports', 'partial', 'contradicts', 'inconclusive'])
    .default('unknown'),
});

export const ExperimentFrontmatterSchema = z.strictObject({
  ...BaseArtifactFields,
  type: z.literal('exp'),
  status: z.enum(['planned', 'running', 'completed', 'failed', 'abandoned']),
  tests: ClaimRefListSchema,
  idea_refs: IdeaRefListSchema,
  claim_refs: ClaimRefListSchema,
  plan: ExperimentPlanSchema.default({
    question: '',
    metrics: [],
    baselines: [],
    ablations: [],
    seeds: null,
  }),
  run: ExperimentRunSchema.default({
    commit: '',
    command: '',
    started_at: null,
    completed_at: null,
  }),
  results: ExperimentResultsSchema.default({
    result_files: [],
    summary: '',
    outcome: 'unknown',
  }),
});
export type ExperimentFrontmatter = z.infer<typeof ExperimentFrontmatterSchema>;

export const ArtifactFrontmatterSchema = z.discriminatedUnion('type', [
  ClaimFrontmatterSchema,
  IdeaFrontmatterSchema,
  ExperimentFrontmatterSchema,
]);
export type ArtifactFrontmatter = z.infer<typeof ArtifactFrontmatterSchema>;

export interface ParsedArtifact {
  frontmatter: ArtifactFrontmatter;
  body: string;
}

export function extractFrontmatter(markdown: string): {
  raw: string;
  body: string;
} {
  if (!markdown.startsWith('---\n')) {
    throw new Error('Artifact markdown must start with YAML frontmatter.');
  }

  const end = markdown.indexOf('\n---', 4);
  if (end === -1) {
    throw new Error('Artifact markdown is missing closing frontmatter marker.');
  }

  const afterMarker = markdown.slice(end + 4);
  return {
    raw: markdown.slice(4, end),
    body: afterMarker.startsWith('\n') ? afterMarker.slice(1) : afterMarker,
  };
}

export function parseArtifactMarkdown(markdown: string): ParsedArtifact {
  const { raw, body } = extractFrontmatter(markdown);
  const parsed = parseYaml(raw);
  const frontmatter = ArtifactFrontmatterSchema.parse(parsed);
  return { frontmatter, body };
}
