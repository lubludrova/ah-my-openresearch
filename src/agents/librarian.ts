// Librarian — see design/Product Design.md §6 for full role description and tier policy.
// STUB: replace PROMPT with the final prompt and wire tier from config.

import type { AgentDefinition } from './types';

const LIBRARIAN_PROMPT = `You are Librarian.

(STUB — replace with full prompt derived from design/Product Design.md §6.)
`;

export function createLibrarianAgent(
  model: string,
  customPrompt?: string,
  customAppendPrompt?: string,
): AgentDefinition {
  const prompt = customPrompt
    ?? (customAppendPrompt ? `${LIBRARIAN_PROMPT}\n\n${customAppendPrompt}` : LIBRARIAN_PROMPT);
  return {
    name: 'librarian',
    description: 'Literature search, claim extraction, wiki custody, schema/edge maintenance.',
    config: { model, temperature: 0.1, prompt },
  };
}
