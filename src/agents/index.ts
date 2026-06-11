// Aggregator for all six amore personas (D2/D6).
// Returns a Record<name, AgentDefinition> suitable for merging into
// `opencodeConfig.agent` from the plugin's `config` hook.

import {
  DEFAULT_LITERATURE_WIKI,
  DEFAULT_PERSONA_MODELS,
} from '../config/constants';
import type { PersonaConfig, PersonasConfig } from '../config/schema';
import { createCoderAgent } from './coder';
import { createCouncilAgent } from './council';
import { createLibrarianAgent } from './librarian';
import { createOrchestratorAgent } from './orchestrator';
import { createProspectorAgent } from './prospector';
import type { AgentDefinition } from './types';
import { createWriterAgent } from './writer';

export { createCouncillorAgents, DEFAULT_COUNCILLORS } from './council';
export {
  createCoderAgent,
  createCouncilAgent,
  createLibrarianAgent,
  createOrchestratorAgent,
  createProspectorAgent,
  createWriterAgent,
};
export type { AgentDefinition, AgentMode, Tier } from './types';

export interface CreateAllAgentsOptions {
  /** Per-persona model overrides. Keys are persona names. */
  models?: Partial<Record<string, string>>;
  /** Per-persona skill allowlist overrides. Keys are persona names. */
  skills?: Partial<Record<string, string[]>>;
  /** Path to the outside literature wiki (passed to librarian). */
  wikiPath?: string;
  /**
   * Persona overrides from amore user config (.opencode/amore.json, legacy
   * lab/config.json, or the global ~/.config/opencode/ah-my-openresearch.json).
   * Applied after `models` / `skills`; user OpenCode agent entries still win
   * over everything at plugin-merge time.
   */
  personas?: PersonasConfig;
}

/**
 * Per-persona skill allowlists. Each persona declares which skill names it
 * may invoke. `["*"]` means any skill registered with OpenCode. Allowlists
 * are intentionally generous — most personas can call `claim-extract` for
 * provenance work, and `paper-search` is useful both for librarian (ingest)
 * and for prospector (novelty checks).
 */
export const DEFAULT_PERSONA_SKILLS: Record<string, string[]> = {
  orchestrator: ['*'],
  librarian: ['claim-extract', 'wiki-ingest', 'wiki-lint', 'paper-search'],
  prospector: [
    'gap-map',
    'idea-creator',
    'novelty-vs-wiki',
    'research-refine',
    'paper-search',
    'claim-extract',
    'analyze-results',
  ],
  coder: [
    'run-experiment',
    'monitor-experiment',
    'analyze-results',
    'claim-extract',
  ],
  council: ['council-session', 'paper-audit'],
  writer: ['paper-plan', 'paper-figure', 'paper-audit', 'council-session'],
};

function withSkills(
  agent: AgentDefinition,
  personaName: string,
  override?: string[],
): AgentDefinition {
  const skills = override ?? DEFAULT_PERSONA_SKILLS[personaName];
  if (!skills) {
    return agent;
  }
  return { ...agent, skills };
}

/**
 * Applies user-config persona overrides on top of a factory-built agent.
 * Only fields the user explicitly set are touched — in particular,
 * `temperature` is optional in the schema so persona-specific defaults
 * (prospector 0.5, writer 0.2) survive partial overrides.
 */
function applyPersonaConfig(
  agent: AgentDefinition,
  config?: PersonaConfig,
): AgentDefinition {
  if (!config) {
    return agent;
  }
  const out: AgentDefinition = { ...agent };
  if (config.model) {
    out.model = config.model;
  }
  if (config.temperature !== undefined) {
    out.temperature = config.temperature;
  }
  if (config.skills) {
    out.skills = config.skills;
  }
  if (config.custom_prompt) {
    out.prompt = config.custom_prompt;
  } else if (config.custom_append_prompt) {
    out.prompt = `${out.prompt}\n\n${config.custom_append_prompt}`;
  }
  if (config.enabled === false) {
    out.disable = true;
  }
  return out;
}

/**
 * Builds every persona using per-persona model defaults and the configured
 * literature wiki path. Pass `options` to swap any default.
 */
export function createAllAgents(
  options?: CreateAllAgentsOptions,
): Record<string, AgentDefinition> {
  const models: Record<string, string> = {
    ...DEFAULT_PERSONA_MODELS,
    ...options?.models,
  };
  const skillsOverrides = options?.skills ?? {};
  const wikiPath = options?.wikiPath ?? DEFAULT_LITERATURE_WIKI;
  const personas = options?.personas;

  function build(
    name: keyof PersonasConfig,
    base: AgentDefinition,
  ): AgentDefinition {
    const withDefaults = withSkills(base, name, skillsOverrides[name]);
    return applyPersonaConfig(withDefaults, personas?.[name]);
  }

  return {
    orchestrator: build(
      'orchestrator',
      createOrchestratorAgent(models.orchestrator),
    ),
    librarian: build(
      'librarian',
      createLibrarianAgent(models.librarian, wikiPath),
    ),
    prospector: build(
      'prospector',
      createProspectorAgent(models.prospector, wikiPath),
    ),
    coder: build('coder', createCoderAgent(models.coder)),
    council: build('council', createCouncilAgent(models.council, wikiPath)),
    writer: build('writer', createWriterAgent(models.writer, wikiPath)),
  };
}
