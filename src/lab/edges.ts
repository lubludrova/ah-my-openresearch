import { appendFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { LAB_SCHEMA_VERSION } from '../config/constants';
import { ConfidenceSchema, NodeIdSchema } from './artifact-schema';
import { type ArtifactType, getNodeType } from './id-generator';
import { SourceRefSchema } from './provenance';

export const EDGE_TYPES = [
  'supports',
  'contradicts',
  'tested_by',
  'produced_by',
  'supersedes',
  'extends',
  'addresses_gap',
  'inspired_by',
] as const;

export type EdgeType = (typeof EDGE_TYPES)[number];

const EdgeTypeSchema = z.enum(EDGE_TYPES);

function isDirectionAllowed(
  type: EdgeType,
  fromType: ArtifactType,
  toType: ArtifactType,
): boolean {
  switch (type) {
    case 'supports':
    case 'contradicts':
      return (
        (fromType === 'claim' && toType === 'claim') ||
        (fromType === 'exp' && toType === 'claim')
      );
    case 'tested_by':
      return (fromType === 'claim' || fromType === 'idea') && toType === 'exp';
    case 'produced_by':
      return fromType === 'claim' && toType === 'exp';
    case 'supersedes':
    case 'extends':
      return fromType === toType;
    case 'addresses_gap':
      return fromType === 'idea' && toType === 'claim';
    case 'inspired_by':
      return fromType === 'idea' && (toType === 'claim' || toType === 'idea');
  }
}

export const EdgeSchema = z
  .strictObject({
    schema_version: z.literal(LAB_SCHEMA_VERSION).default(LAB_SCHEMA_VERSION),
    edge_id: z.string().regex(/^edge:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/),
    from: NodeIdSchema,
    to: NodeIdSchema,
    type: EdgeTypeSchema,
    created: z.string().min(1),
    created_by: z.string().min(1),
    provenance: z.array(SourceRefSchema).optional(),
    confidence: ConfidenceSchema.optional(),
    note: z.string().optional(),
  })
  .superRefine((edge, ctx) => {
    const fromType = getNodeType(edge.from);
    const toType = getNodeType(edge.to);

    if (!fromType || !toType) {
      return;
    }

    if (!isDirectionAllowed(edge.type, fromType, toType)) {
      ctx.addIssue({
        code: 'custom',
        message: `Edge direction ${fromType} -> ${toType} is not valid for ${edge.type}.`,
        path: ['type'],
      });
    }
  });

export type Edge = z.infer<typeof EdgeSchema>;

export function makeEdgeId(from: string, type: EdgeType, to: string): string {
  const slug = `${from}-${type}-${to}`
    .replace(/:/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `edge:${slug}`;
}

export async function readEdges(labDir: string): Promise<Edge[]> {
  const path = resolve(labDir, 'edges.jsonl');
  const content = await readFile(path, 'utf8');
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line) => EdgeSchema.parse(JSON.parse(line)));
}

export async function appendEdge(labDir: string, edge: Edge): Promise<void> {
  const parsed = EdgeSchema.parse(edge);
  await appendFile(
    resolve(labDir, 'edges.jsonl'),
    `${JSON.stringify(parsed)}\n`,
    'utf8',
  );
}

export function countBrokenEdgeRefs(
  edges: Edge[],
  nodeIds: ReadonlySet<string>,
): number {
  return edges.filter(
    (edge) => !nodeIds.has(edge.from) || !nodeIds.has(edge.to),
  ).length;
}
