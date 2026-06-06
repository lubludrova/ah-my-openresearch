// Phase 6 write-boundary hook: enforces D11/D24 inside `<project>/lab/`.
//
// Wires onto OpenCode's `tool.execute.before` event. For native write tools
// (`write`, `edit`) it extracts the target path from args and throws if the
// destination lives inside `<project>/lab/` but outside the MVP allowlist.
//
// Out of scope (documented gaps):
//   - `bash` tool: shell redirection / `rm` is not safely policed via
//     `tool.execute.before`. Restrict by prompt + permissions in Phase 4b.
//   - MCP-tool writes (e.g. obsidian_*): handled by the server's own
//     OBSIDIAN_WRITE_PATHS env (Phase 3 wiring).
//   - Writes outside `<project>/lab/` (e.g. into project source code): not
//     this hook's concern.

import { classifyLabWrite } from './policy';

// Native OpenCode write/edit tool names. If OpenCode introduces a new tool
// name for file writes, add it here.
const WRITE_TOOL_NAMES = new Set(['write', 'edit']);

// Arg keys we recognize as "the file path to write". Defensive — we try
// multiple variants because the exact arg name surfaces during real demo.
const PATH_ARG_KEYS = ['filePath', 'file_path', 'path'] as const;

function extractTargetPath(args: unknown): string | undefined {
  if (args === null || typeof args !== 'object') return undefined;
  const argRecord = args as Record<string, unknown>;
  for (const key of PATH_ARG_KEYS) {
    const value = argRecord[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

export type PreWriteHook = (
  input: { tool: string; sessionID: string; callID: string },
  output: { args: unknown },
) => Promise<void>;

/**
 * Builds a `tool.execute.before` handler bound to a specific project root.
 * The plugin entry passes `input.directory` from the Plugin function context.
 */
export function createPreWriteDraftsOnlyHook(
  projectRoot: string,
): PreWriteHook {
  return async (input, output) => {
    if (!WRITE_TOOL_NAMES.has(input.tool)) return;

    const targetPath = extractTargetPath(output.args);
    if (!targetPath) return; // Unrecognized arg shape — fail open, do not block.

    const verdict = classifyLabWrite(projectRoot, targetPath);
    if (verdict.decision === 'deny') {
      throw new Error(
        `[amore:write-boundary] write to lab/${verdict.labSubpath} blocked. During MVP, agents may only write to: lab/drafts/**, lab/log.md, lab/edges.jsonl, lab/index.md. To edit lab/README.md or lab/SCHEMA.md, do it outside an agent session.`,
      );
    }
  };
}

export { classifyLabWrite } from './policy';
export type { LabWriteVerdict, LabWriteDecision } from './policy';
