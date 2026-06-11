// Zod schema for the global amore config file.
// Source of truth for user-configurable fields.
// Run scripts/generate-schema.ts to produce ah-my-openresearch.schema.json for IDE autocomplete.

import { z } from 'zod';
import {
  CONFIG_SCHEMA_VERSION,
  DEFAULT_LAB_DIR,
  DEFAULT_ORCHESTRATION_MAX_PARALLEL,
} from './constants';

// ────────────────────────────────────────────────────────────────────
// Tier
// ────────────────────────────────────────────────────────────────────

export const TierSchema = z.enum(['cheap', 'midtier', 'frontier', 'mixed']);
export type Tier = z.infer<typeof TierSchema>;

// ────────────────────────────────────────────────────────────────────
// Persona config — generic shape.
// Persona-specific defaults (model, tier, prompt) live in agent factories,
// NOT in this schema. User config selectively overrides those defaults.
// ────────────────────────────────────────────────────────────────────

export const PersonaConfigSchema = z.strictObject({
  // false → the persona is still registered but carries OpenCode's
  // `disable: true` flag. Omit → enabled.
  enabled: z.boolean().optional(),

  // Provider/model-id, e.g. 'anthropic/claude-haiku-4-5'.
  // Omit → use persona's code default.
  model: z.string().optional(),

  // Tier override. Omit → use persona's code default tier.
  tier: TierSchema.optional(),

  // Allowlist of skills this persona may invoke (subset of src/skills/<name>).
  // Omit → use persona's code default allowlist.
  skills: z.array(z.string()).optional(),

  // Sampling temperature. Omit → use persona's code default (most personas
  // 0.1; prospector 0.5; writer 0.2). An explicit value always wins.
  temperature: z.number().min(0).max(2).optional(),

  // Full prompt replacement.
  custom_prompt: z.string().optional(),

  // Append after default prompt (does not replace it).
  custom_append_prompt: z.string().optional(),
});
export type PersonaConfig = z.infer<typeof PersonaConfigSchema>;

// ────────────────────────────────────────────────────────────────────
// Council config — extends PersonaConfigSchema with multi-LLM fields
// ────────────────────────────────────────────────────────────────────

export const CouncillorSchema = z.strictObject({
  model: z.string(),
  // Optional role hint for prompting (e.g. 'adversarial', 'supportive', 'expert').
  role: z.string().optional(),
});
export type Councillor = z.infer<typeof CouncillorSchema>;

export const CouncilConfigSchema = PersonaConfigSchema.extend({
  // Council members. Synthesizer model is the parent `model` field.
  councillors: z.array(CouncillorSchema).optional(),
});
export type CouncilConfig = z.infer<typeof CouncilConfigSchema>;

// ────────────────────────────────────────────────────────────────────
// Personas map — typed by persona name (D6)
// ────────────────────────────────────────────────────────────────────

export const PersonasConfigSchema = z.strictObject({
  orchestrator: PersonaConfigSchema.optional(),
  librarian: PersonaConfigSchema.optional(),
  prospector: PersonaConfigSchema.optional(),
  coder: PersonaConfigSchema.optional(),
  council: CouncilConfigSchema.optional(),
  writer: PersonaConfigSchema.optional(),
});
export type PersonasConfig = z.infer<typeof PersonasConfigSchema>;

// ────────────────────────────────────────────────────────────────────
// MCP user config (D15)
// Exact upstream command/env recipes are confirmed in Phase 3. These schemas
// represent user-provided values consumed by the current MCP registry.
// ────────────────────────────────────────────────────────────────────

// Obsidian MCP env-overrides. The MCP itself reads OBSIDIAN_API_KEY and
// related env vars at server-startup time (see src/mcp/obsidian.ts). These
// schema fields exist so a project can declare them in .opencode/amore.json
// and `amore install`/`amore doctor` can verify them without re-reading process.env.
export const ObsidianMcpConfigSchema = z.strictObject({
  api_key: z.string().optional(),
  base_url: z.string().optional(),
  // Server-side write/read allowlists (forwarded to OBSIDIAN_WRITE_PATHS / READ_PATHS).
  write_paths: z.string().optional(),
  read_paths: z.string().optional(),
  read_only: z.boolean().optional(),
});
export type ObsidianMcpConfig = z.infer<typeof ObsidianMcpConfigSchema>;

export const McpsConfigSchema = z.strictObject({
  obsidian: ObsidianMcpConfigSchema.optional(),
});
export type McpsConfig = z.infer<typeof McpsConfigSchema>;

// ────────────────────────────────────────────────────────────────────
// Orchestration policy
// ────────────────────────────────────────────────────────────────────

export const OrchestrationConfigSchema = z.strictObject({
  // Maximum number of independent specialist tasks the orchestrator may place
  // in one execution wave. This is a planning limit consumed by the
  // orchestrate-task skill, not a separate runtime scheduler.
  max_parallel: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(DEFAULT_ORCHESTRATION_MAX_PARALLEL),
});
export type OrchestrationConfig = z.infer<typeof OrchestrationConfigSchema>;

// ────────────────────────────────────────────────────────────────────
// Top-level amore config
// ────────────────────────────────────────────────────────────────────

export const AmoreConfigSchema = z.strictObject({
  schema_version: z
    .literal(CONFIG_SCHEMA_VERSION)
    .default(CONFIG_SCHEMA_VERSION),

  // Path to the project's lab/ directory.
  lab_dir: z.string().default(DEFAULT_LAB_DIR),

  // Path to the outside literature wiki (cross-project source).
  // Omit → librarian operates without a literature-tier write target.
  literature_wiki_path: z.string().optional(),

  // Persona overrides — typed per persona name.
  personas: PersonasConfigSchema.optional(),

  // Per-MCP user config. Keyed by MCP name from MCP_REGISTRY.
  mcps: McpsConfigSchema.optional(),

  // Multi-agent planning policy. Used by orchestrator/orchestrate-task to keep
  // automatic dispatch explicit, bounded, and conflict-aware.
  orchestration: OrchestrationConfigSchema.optional(),
});
export type AmoreConfig = z.infer<typeof AmoreConfigSchema>;
