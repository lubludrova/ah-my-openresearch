// Zod schema for ~/.config/opencode/omo-research.json (STUB)
// Source of truth for what users can configure.
// Run scripts/generate-schema.ts to produce omo-research.schema.json for IDE autocomplete.

import { z } from 'zod';

export const TierSchema = z.enum(['cheap', 'midtier', 'frontier', 'mixed']);

export const PersonaConfigSchema = z.object({
  enabled: z.boolean().default(true),
  model: z.string(),
  // Optional override; persona's default tier is decided in code.
  tier: TierSchema.optional(),
});

export const OmoResearchConfigSchema = z.object({
  vault_path: z.string(),
  personas: z.record(z.string(), PersonaConfigSchema),
  mcps: z.array(z.string()).default([]),
  // Active domain pack (e.g., "rl"). Undefined = generic mode.
  domain: z.string().optional(),
});

export type OmoResearchConfig = z.infer<typeof OmoResearchConfigSchema>;
