// Defaults and constants for omo-research.

export const DEFAULT_CONFIG_PATH = '~/.config/opencode/omo-research.json';

// Lab: per-project research record (sits next to project code).
export const DEFAULT_LAB_DIR = './lab';

// Outside literature wiki: read-only source for librarian (queried via MCP).
export const DEFAULT_LITERATURE_WIKI = '~/RL-Wiki';

// MVP=c (Product Design D2): only orchestrator + librarian are active.
export const ACTIVE_MVP_PERSONAS = ['orchestrator', 'librarian'] as const;

// Claim ID rules (see design/Product Design.md §7 Identifier rules).
export const CLAIM_ID_MAX_LENGTH = 60;
export const CLAIM_ID_STOPWORDS = [
  'a', 'an', 'the',
  'in', 'of', 'for', 'to', 'on', 'at', 'by', 'with', 'from', 'as',
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'and', 'or',
] as const;
export const CLAIM_ID_REGEX = /^(claim|exp|idea):[a-z0-9][a-z0-9-]*[a-z0-9](?:-\d{4}-\d{2}-\d{2})?$/;

// Contradiction-check (D8 buildable, see Product Design §7 Contradiction flag behavior).
export const CONTRADICTION_THRESHOLD_DEFAULT = 0.80;
export const CONTRADICTION_EMBEDDING_MODEL = 'BAAI/bge-small-en-v1.5';
// Candidate pool for similarity comparison: canon claims with these statuses.
export const CONTRADICTION_CANDIDATE_STATUSES = ['supported', 'partial'] as const;

// All designed personas (full cycle).
export const ALL_PERSONAS = [
  'orchestrator',
  'librarian',
  'prospector',
  'coder',
  'council',
  'writer',
] as const;
