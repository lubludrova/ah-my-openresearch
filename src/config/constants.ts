// Defaults and constants for amore (ah-my-openresearch).

export const CONFIG_SCHEMA_VERSION = 'v1';
export const LAB_SCHEMA_VERSION = 'v1.0';
export const CONFIG_SCHEMA_FILENAME = 'ah-my-openresearch.schema.json';

export const DEFAULT_CONFIG_PATH = '~/.config/opencode/ah-my-openresearch.json';
export const DEFAULT_PROJECT_CONFIG_PATH = '.opencode/amore.json';
export const ROOT_PROJECT_CONFIG_PATH = 'amore.json';
export const LEGACY_LAB_CONFIG_FILENAME = 'config.json';
export const PROJECT_OPENCODE_CONFIG_PATH = 'opencode.json';
export const LEGACY_PROJECT_OPENCODE_CONFIG_PATH = '.opencode/opencode.json';

// Lab: per-project research record (sits next to project code).
export const DEFAULT_LAB_DIR = './lab';
export const DEFAULT_ORCHESTRATION_MAX_PARALLEL = 5;

// Outside literature wiki: cross-project read/write literature store.
// Generic fallback only — install never writes a wiki path the user did
// not explicitly choose; this default just keeps persona prompts
// path-shaped when no wiki is configured.
export const DEFAULT_LITERATURE_WIKI = '~/literature-wiki';

// All six research personas are enabled from the first build.
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

export type PersonaName = (typeof ALL_PERSONAS)[number];

export const MODEL_PRESET_NAMES = ['openai', 'anthropic', 'google'] as const;
export type ModelPresetName = (typeof MODEL_PRESET_NAMES)[number];

// Per-provider persona model presets. Frontier model for the
// reasoning-heavy personas (orchestrator, prospector, council, writer),
// cheaper model for the volume personas (librarian, coder).
// Model ids verified against models.dev (the registry OpenCode resolves
// models from) on 2026-06-10.
export const MODEL_PRESETS: Record<
  ModelPresetName,
  Record<PersonaName, string>
> = {
  openai: {
    orchestrator: 'openai/gpt-5.5',
    librarian: 'openai/gpt-5.4-mini',
    prospector: 'openai/gpt-5.5',
    coder: 'openai/gpt-5.4-mini',
    council: 'openai/gpt-5.5',
    writer: 'openai/gpt-5.5',
  },
  anthropic: {
    orchestrator: 'anthropic/claude-sonnet-4-6',
    librarian: 'anthropic/claude-haiku-4-5',
    prospector: 'anthropic/claude-sonnet-4-6',
    coder: 'anthropic/claude-haiku-4-5',
    council: 'anthropic/claude-sonnet-4-6',
    writer: 'anthropic/claude-sonnet-4-6',
  },
  google: {
    orchestrator: 'google/gemini-3.1-pro-preview',
    librarian: 'google/gemini-3.5-flash',
    prospector: 'google/gemini-3.1-pro-preview',
    coder: 'google/gemini-3.5-flash',
    council: 'google/gemini-3.1-pro-preview',
    writer: 'google/gemini-3.1-pro-preview',
  },
};

// Per-persona default models when no preset / override is configured.
export const DEFAULT_PERSONA_MODELS: Record<PersonaName, string> =
  MODEL_PRESETS.openai;

// Claim ID rules for lab node IDs.
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
