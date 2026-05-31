// Writer — see design/Product Design.md §6 for full role description and tier policy.
// STUB: replace PROMPT with the final prompt and wire tier from config.

import type { AgentDefinition } from './types';

const WRITER_PROMPT = `You are Writer.

(STUB — replace with full prompt derived from design/Product Design.md §6.)
`;

export function createWriterAgent(
  model: string,
  customPrompt?: string,
  customAppendPrompt?: string,
): AgentDefinition {
  const prompt = customPrompt
    ?? (customAppendPrompt ? `${WRITER_PROMPT}\n\n${customAppendPrompt}` : WRITER_PROMPT);
  return {
    name: 'writer',
    description: 'Paper narrative, LaTeX, figures, final review.',
    config: { model, temperature: 0.1, prompt },
  };
}
