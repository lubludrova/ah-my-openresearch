// Coder — see design/Product Design.md §6 for full role description and tier policy.
// STUB: replace PROMPT with the final prompt and wire tier from config.

import type { AgentDefinition } from './types';

const CODER_PROMPT = `You are Coder.

(STUB — replace with full prompt derived from design/Product Design.md §6.)
`;

export function createCoderAgent(
  model: string,
  customPrompt?: string,
  customAppendPrompt?: string,
): AgentDefinition {
  const prompt = customPrompt
    ?? (customAppendPrompt ? `${CODER_PROMPT}\n\n${customAppendPrompt}` : CODER_PROMPT);
  return {
    name: 'coder',
    description: 'Implementation and runs through host CLI / ACP.',
    config: { model, temperature: 0.1, prompt },
  };
}
