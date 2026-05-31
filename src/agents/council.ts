// Council — see design/Product Design.md §6 for full role description and tier policy.
// STUB: replace PROMPT with the final prompt and wire tier from config.

import type { AgentDefinition } from './types';

const COUNCIL_PROMPT = `You are Council.

(STUB — replace with full prompt derived from design/Product Design.md §6.)
`;

export function createCouncilAgent(
  model: string,
  customPrompt?: string,
  customAppendPrompt?: string,
): AgentDefinition {
  const prompt = customPrompt
    ?? (customAppendPrompt ? `${COUNCIL_PROMPT}\n\n${customAppendPrompt}` : COUNCIL_PROMPT);
  return {
    name: 'council',
    description: 'Multi-model critique, consensus, adversarial review.',
    config: { model, temperature: 0.1, prompt },
  };
}
