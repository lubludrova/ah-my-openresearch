// Orchestrator — see design/Product Design.md §6 for full role description and tier policy.
// STUB: replace PROMPT with the final prompt and wire tier from config.

import type { AgentDefinition } from './types';

const ORCHESTRATOR_PROMPT = `You are Orchestrator.

(STUB — replace with full prompt derived from design/Product Design.md §6.)
`;

export function createOrchestratorAgent(
  model: string,
  customPrompt?: string,
  customAppendPrompt?: string,
): AgentDefinition {
  const prompt = customPrompt
    ?? (customAppendPrompt ? `${ORCHESTRATOR_PROMPT}\n\n${customAppendPrompt}` : ORCHESTRATOR_PROMPT);
  return {
    name: 'orchestrator',
    description: 'Intake, routing, handoff summary, next actions.',
    config: { model, temperature: 0.1, prompt },
  };
}
