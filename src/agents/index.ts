// Aggregator for all six amore personas (D2/D6).
// Returns a Record<name, AgentDefinition> suitable for merging into
// `opencodeConfig.agent` from the plugin's `config` hook.

import {
  DEFAULT_LITERATURE_WIKI,
  DEFAULT_PERSONA_MODELS,
} from '../config/constants';
import { createCoderAgent } from './coder';
import { createCouncilAgent } from './council';
import { createLibrarianAgent } from './librarian';
import { createOrchestratorAgent } from './orchestrator';
import { createProspectorAgent } from './prospector';
import type { AgentDefinition } from './types';
import { createWriterAgent } from './writer';

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
  /** Path to the outside literature wiki (passed to librarian). */
  wikiPath?: string;
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
  const wikiPath = options?.wikiPath ?? DEFAULT_LITERATURE_WIKI;
  return {
    orchestrator: createOrchestratorAgent(models.orchestrator),
    librarian: createLibrarianAgent(models.librarian, wikiPath),
    prospector: createProspectorAgent(models.prospector, wikiPath),
    coder: createCoderAgent(models.coder),
    council: createCouncilAgent(models.council, wikiPath),
    writer: createWriterAgent(models.writer, wikiPath),
  };
}
