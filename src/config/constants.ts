// Defaults and constants for amore (ah-my-openresearch).

export const CONFIG_SCHEMA_VERSION = 'v1';
export const LAB_SCHEMA_VERSION = 'v1.0';
export const CONFIG_SCHEMA_FILENAME = 'ah-my-openresearch.schema.json';

export const DEFAULT_CONFIG_PATH = '~/.config/opencode/ah-my-openresearch.json';

// Lab: per-project research record (sits next to project code).
export const DEFAULT_LAB_DIR = './lab';

// Outside literature wiki: cross-project read/write literature store.
export const DEFAULT_LITERATURE_WIKI = '~/RL-Wiki';

export const DEFAULT_DOMAIN = 'generic';

// All designed personas are enabled from the first build (D2).
export const ALL_PERSONAS = [
  'orchestrator',
  'librarian',
  'prospector',
  'coder',
  'council',
  'writer',
] as const;

export const ACTIVE_MVP_PERSONAS = ALL_PERSONAS;

export const DEFAULT_PERSONA_TEMPERATURE = 0.1;

// Per-persona default models. Filled in as each persona's design round closes.
// Orchestrator is set first (frontier — user decision, Phase 4b).
// The other five remain on the placeholder until their own design rounds.
export const DEFAULT_PERSONA_MODELS: Record<
  (typeof ALL_PERSONAS)[number],
  string
> = {
  orchestrator: 'openai/gpt-5.5',
  librarian: 'openai/gpt-5.4-mini',
  prospector: 'openai/gpt-5.5',
  coder: 'openai/gpt-5.4-mini',
  council: 'openai/gpt-5.5',
  writer: 'openai/gpt-5.5',
};

// Claim ID rules (see design/Product Design.md §7 Identifier rules).
export const CLAIM_ID_MAX_LENGTH = 60;
export const CLAIM_ID_STOPWORDS = [
  'a',
  'an',
  'the',
  'in',
  'of',
  'for',
  'to',
  'on',
  'at',
  'by',
  'with',
  'from',
  'as',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'and',
  'or',
] as const;
export const CLAIM_ID_REGEX =
  /^(claim|exp|idea):[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

// Post-MVP contradiction-check defaults (D8/D13). No MVP auto-flag loop.
export const CONTRADICTION_THRESHOLD_DEFAULT = 0.8;
export const CONTRADICTION_EMBEDDING_MODEL = 'BAAI/bge-small-en-v1.5';
// Candidate pool for similarity comparison: canon claims with these statuses.
export const CONTRADICTION_CANDIDATE_STATUSES = [
  'supported',
  'partial',
] as const;
