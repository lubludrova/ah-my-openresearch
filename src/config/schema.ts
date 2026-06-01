// Zod schema for ~/.config/opencode/amore.json
// Source of truth for user-configurable fields. See design/Product Design.md §3 D16.
// Run scripts/generate-schema.ts to produce amore.schema.json for IDE autocomplete.

import { z } from 'zod';

// ────────────────────────────────────────────────────────────────────
// Tier
// ────────────────────────────────────────────────────────────────────

export const TierSchema = z.enum(['cheap', 'midtier', 'frontier', 'mixed']);
export type Tier = z.infer<typeof TierSchema>;

// ────────────────────────────────────────────────────────────────────
// Persona config — generic shape (D16, see Product Design §6)
// Persona-specific defaults (model, tier, prompt) live in agent factories,
// NOT in this schema. User config selectively overrides those defaults.
// ────────────────────────────────────────────────────────────────────

export const PersonaConfigSchema = z.object({
  enabled: z.boolean().default(true),

  // Provider/model-id, e.g. 'anthropic/claude-haiku-4-5'.
  // Omit → use persona's code default.
  model: z.string().optional(),

  // Tier override. Omit → use persona's code default tier.
  tier: TierSchema.optional(),

  // Allowlist of MCPs this persona may call (subset of MCP_REGISTRY keys).
  // Omit → use persona's code default allowlist.
  mcps: z.array(z.string()).optional(),

  // Allowlist of skills this persona may invoke (subset of src/skills/<name>).
  // Omit → use persona's code default allowlist.
  skills: z.array(z.string()).optional(),

  // Sampling temperature. Default 0.1 (deterministic-ish).
  temperature: z.number().min(0).max(2).default(0.1),

  // Output token cap. Optional.
  max_tokens: z.number().positive().optional(),

  // Full prompt replacement.
  custom_prompt: z.string().optional(),

  // Append after default prompt (does not replace it).
  custom_append_prompt: z.string().optional(),
});
export type PersonaConfig = z.infer<typeof PersonaConfigSchema>;

// ────────────────────────────────────────────────────────────────────
// Council config — extends PersonaConfigSchema with multi-LLM fields
// ────────────────────────────────────────────────────────────────────

export const CouncillorSchema = z.object({
  model: z.string(),
  // Optional role hint for prompting (e.g. 'adversarial', 'supportive', 'expert').
  role: z.string().optional(),
});
export type Councillor = z.infer<typeof CouncillorSchema>;

export const CouncilConfigSchema = PersonaConfigSchema.extend({
  // Council members. Synthesizer model is the parent `model` field.
  councillors: z.array(CouncillorSchema).optional(),
  // Total token budget per Council session.
  budget_max_tokens: z.number().positive().optional(),
});
export type CouncilConfig = z.infer<typeof CouncilConfigSchema>;

// ────────────────────────────────────────────────────────────────────
// Personas map — typed by persona name (D6)
// ────────────────────────────────────────────────────────────────────

export const PersonasConfigSchema = z.object({
  orchestrator: PersonaConfigSchema.optional(),
  librarian: PersonaConfigSchema.optional(),
  prospector: PersonaConfigSchema.optional(),
  coder: PersonaConfigSchema.optional(),
  council: CouncilConfigSchema.optional(),
  writer: PersonaConfigSchema.optional(),
});
export type PersonasConfig = z.infer<typeof PersonasConfigSchema>;

// ────────────────────────────────────────────────────────────────────
// Contradiction-check config (D13)
// ────────────────────────────────────────────────────────────────────

export const ContradictionConfigSchema = z.object({
  threshold: z.number().min(0).max(1).default(0.80),
  embedding_model: z.string().default('BAAI/bge-small-en-v1.5'),
  candidate_statuses: z.array(z.string()).default(['supported', 'partial']),
});
export type ContradictionConfig = z.infer<typeof ContradictionConfigSchema>;

// ────────────────────────────────────────────────────────────────────
// Top-level amore config
// ────────────────────────────────────────────────────────────────────

export const AmoreConfigSchema = z.object({
  // Path to the project's lab/ directory.
  lab_dir: z.string().default('./lab'),

  // Path to the outside literature wiki (cross-project source).
  // Omit → librarian operates without a literature-tier write target.
  literature_wiki_path: z.string().optional(),

  // Persona overrides — typed per persona name.
  personas: PersonasConfigSchema.optional(),

  // Per-MCP user config. Keyed by MCP name from MCP_REGISTRY.
  // TODO Phase 1: replace with typed McpsConfigSchema once D15 user-config
  // collection flow is implemented.
  mcps: z.record(z.string(), z.record(z.string(), z.string())).optional(),

  // Active domain pack (e.g. 'rl'). Undefined = generic mode.
  domain: z.string().optional(),

  // Contradiction-check config (D13).
  contradiction: ContradictionConfigSchema.default({}),
});
export type AmoreConfig = z.infer<typeof AmoreConfigSchema>;
