# Installation

`ah-my-openresearch` (short alias **`amore`**) is an OpenCode/Codex/Claude Code
plugin. You point it at a project directory; it scaffolds a per-project
research lab and wires the plugin into your host coding-CLI.

## Prerequisites

| Tool | Why | Required? |
|---|---|---|
| [Bun](https://bun.sh) | Runs the CLI and the OpenCode plugin SDK | **yes** |
| [OpenCode](https://opencode.ai/) (or Codex CLI / Claude Code) | The host CLI the plugin loads into | yes for actual use |
| [Obsidian](https://obsidian.md/) | Holds the outside literature wiki | recommended |
| Obsidian **Local REST API** community plugin v4.1+ | Exposes your vault to amore's `librarian` over MCP | optional but expected for the literature-to-claim loop |

`amore` itself ships as an npm package. No git clone required.

## Install

```bash
cd ~/dev/my-new-project          # any directory you want amore in
bunx ah-my-openresearch install
```

What this does, in order:

1. Creates `lab/` (the per-project research record): `README.md`,
   `SCHEMA.md`, `log.md`, `index.md`, `edges.jsonl`, `drafts/`.
2. Auto-detects `~/RL-Wiki` or `~/PM-Wiki`. If found, asks `Use detected
   literature wiki at <path>? [Y/n]`. If not found, asks for a path.
3. If the chosen wiki has the Obsidian Local REST API plugin installed,
   asks `Auto-configure MCP entry? [Y/n]` and reads the plugin's
   `data.json` to wire `mcp.obsidian` into the new `opencode.json`.
4. Writes `<project>/opencode.json` with the plugin entry
   (`"plugin": ["ah-my-openresearch"]`).

Everything is idempotent: re-running `install` never overwrites existing
files. Skipping the bootstrap is `--no-bootstrap`.

### Non-interactive

```bash
bunx ah-my-openresearch install \
  --literature-wiki ~/my-wiki \
  --with-obsidian-mcp
```

| Flag | What |
|---|---|
| `--literature-wiki <path>` | Use this path; skip auto-detect and prompts. Warns (does not fail) if the path doesn't exist yet. |
| `--no-wiki` | Skip `literature_wiki_path` entirely. Useful for non-literature projects. |
| `--with-obsidian-mcp` | Wire `mcp.obsidian` into `opencode.json`. Required in non-TTY mode (CI). |
| `--no-bootstrap` | Only create the lab; don't seed `lab/config.json` or `opencode.json`. |
| `--reconcile` | If `lab/README.md` or `lab/SCHEMA.md` differ from the defaults, write `.new` candidates beside them. |

## Setting up the Obsidian Local REST API plugin

The librarian persona reads/writes your wiki through this plugin. Install it
**once per vault** you want amore to access.

1. Open Obsidian, switch to the vault that holds your literature wiki.
2. Settings → Community plugins → Browse → search **"Local REST API"** →
   pick *Local REST API with MCP* by Adam Coddington → Install → Enable.
3. Click the gear icon next to it. Note the **API key** (Bearer token) and
   the **HTTPS URL** (`https://127.0.0.1:27124/` by default).

amore reads these automatically from `<wiki>/.obsidian/plugins/obsidian-local-rest-api/data.json`
when you pass `--with-obsidian-mcp` (or answer Y at the prompt).

### If the in-Obsidian install hangs

The Community plugins installer downloads from GitHub releases; this is
sometimes slow to the point of looking stuck (manifest downloads fast,
`main.js` doesn't). Manual fallback:

```bash
PLUGIN_DIR=~/<your-vault>/.obsidian/plugins/obsidian-local-rest-api
mkdir -p "$PLUGIN_DIR"
VERSION=$(curl -s https://api.github.com/repos/coddingtonbear/obsidian-local-rest-api/releases/latest | grep tag_name | cut -d'"' -f4)
BASE="https://github.com/coddingtonbear/obsidian-local-rest-api/releases/download/$VERSION"
curl -sL "$BASE/main.js" -o "$PLUGIN_DIR/main.js"
curl -sL "$BASE/manifest.json" -o "$PLUGIN_DIR/manifest.json"
curl -sL "$BASE/styles.css" -o "$PLUGIN_DIR/styles.css"
```

Then in Obsidian Settings → Community plugins, click the refresh icon and
enable it.

## Composing with the global OpenCode config

`amore install` writes a **project-level** `opencode.json` that declares the
plugin and instructions. Provider/model/MCPs you keep in
`~/.config/opencode/opencode.json` (the global config) still apply. When
OpenCode loads a project, the two files compose.

A minimal `opencode.json` from `amore install`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["ah-my-openresearch"],
  "instructions": ["AGENTS.md"]
}
```

With Obsidian auto-wired:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["ah-my-openresearch"],
  "instructions": ["AGENTS.md"],
  "mcp": {
    "obsidian": {
      "type": "local",
      "command": ["bunx", "obsidian-mcp-server@latest"],
      "environment": {
        "OBSIDIAN_API_KEY": "...your key from data.json...",
        "OBSIDIAN_BASE_URL": "https://127.0.0.1:27124",
        "OBSIDIAN_VERIFY_SSL": "false"
      }
    }
  }
}
```

The API key is a **per-machine secret**: commit the file only if you're sure
the repo is private, or add `opencode.json` to `.gitignore`.

## First run

```bash
cd ~/dev/my-new-project
opencode                          # or `codex`, or `claude`
```

The host CLI loads `ah-my-openresearch`, which registers six research
personas (`orchestrator`, `librarian`, `prospector`, `coder`, `council`,
`writer`) and the `obsidian` MCP. Ask `librarian` to extract claims from a
paper note in your wiki; the personas write artifacts only under
`lab/drafts/`.

Run `amore doctor` at any point to validate the lab contract.

## Troubleshooting

**`amore doctor` says `index.md` is stale.**
Run `amore doctor --repair`. The index is auto-generated from artifact
frontmatter and `edges.jsonl`; manual edits to it are not preserved.

**`bunx obsidian-mcp-server@latest` is slow on first run.**
The package pulls ~330 transitive dependencies into the bun cache. After
the first install, subsequent runs are fast.

**HTTPS certificate warnings.**
The Local REST API plugin generates a self-signed cert. `amore install`
sets `OBSIDIAN_VERIFY_SSL=false` in the MCP env so the server skips
verification for localhost. If you want strict verification, follow the
plugin's "trust this certificate" instructions in its settings page.

**The plugin loads but `librarian` says `wiki contract not found`.**
amore looks for `CLAUDE.md`, `AGENTS.md`, `README.md`, or `ingest_prompt.md`
at the wiki root. Add a short `<wiki>/CLAUDE.md` describing the wiki's
naming convention, frontmatter, and log format. If you skip this, the
librarian falls back to internal defaults.

**Multiple vaults open in Obsidian: only one Local REST API serves.**
The plugin opens a TCP port; only one vault can bind at a time. Open the
vault you want amore to read just before invoking the librarian.

**`amore install` runs but no `opencode.json` was created.**
The file already existed in the project. `install` never overwrites it.
Delete or merge by hand, then re-run.

## What `amore install` does NOT do

- Does not modify `~/.config/opencode/opencode.json` (your global config).
- Does not install `bun`, `obsidian-mcp-server`, or any Obsidian plugin.
- Does not check whether OpenCode/Codex/Claude Code is installed.
- Does not write into your literature wiki — only the librarian persona
  does that, at runtime.
