// Defaults and constants for omo-research.

export const DEFAULT_CONFIG_PATH = '~/.config/opencode/omo-research.json';
export const DEFAULT_VAULT_PATH = '~/RL-Wiki';

// MVP=c (Product Design D2): only orchestrator + librarian are active.
export const ACTIVE_MVP_PERSONAS = ['orchestrator', 'librarian'] as const;

// All designed personas (full cycle).
export const ALL_PERSONAS = [
  'orchestrator',
  'librarian',
  'prospector',
  'coder',
  'council',
  'writer',
] as const;
