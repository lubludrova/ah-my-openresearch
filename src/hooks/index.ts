// Hooks aggregator. Phase 6 ships one hook — the write-boundary enforcer.

export {
  createPreWriteDraftsOnlyHook,
  classifyLabWrite,
} from './pre-write-drafts-only';
export type {
  PreWriteHook,
  LabWriteVerdict,
  LabWriteDecision,
} from './pre-write-drafts-only';
