// Prospector — see design/Product Design.md §6 for full role description and tier policy.
// STUB: replace PROMPT with the final prompt and wire tier from config.

import type { AgentDefinition } from './types';

const PROSPECTOR_PROMPT = `You are Prospector.

(STUB — replace with full prompt derived from design/Product Design.md §6.)
`;

export function createProspectorAgent(
  model: string,
  customPrompt?: string,
  customAppendPrompt?: string,
): AgentDefinition {
  const prompt = customPrompt
    ?? (customAppendPrompt ? `${PROSPECTOR_PROMPT}\n\n${customAppendPrompt}` : PROSPECTOR_PROMPT);
  return {
    name: 'prospector',
    description: 'Ideation, experiment planning, result interpretation.',
    config: { model, temperature: 0.1, prompt },
  };
}
