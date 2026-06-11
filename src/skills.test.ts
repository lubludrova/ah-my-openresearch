import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'skills');

interface SkillFrontmatter {
  name?: unknown;
  description?: unknown;
}

describe('bundled skills', () => {
  test('each skill has valid OpenCode frontmatter', () => {
    const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const failures: string[] = [];

    expect(skillDirs.length).toBeGreaterThan(0);

    for (const skillName of skillDirs) {
      const skillPath = join(SKILLS_DIR, skillName, 'SKILL.md');
      if (!existsSync(skillPath)) {
        failures.push(`${skillName}: missing SKILL.md`);
        continue;
      }

      const raw = readFileSync(skillPath, 'utf8');
      const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!frontmatter) {
        failures.push(`${skillName}: missing YAML frontmatter`);
        continue;
      }

      let parsed: SkillFrontmatter;
      try {
        parsed = YAML.parse(frontmatter[1]) as SkillFrontmatter;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${skillName}: invalid YAML frontmatter: ${message}`);
        continue;
      }

      if (parsed.name !== skillName) {
        failures.push(`${skillName}: frontmatter name must match directory`);
      }
      if (
        typeof parsed.description !== 'string' ||
        parsed.description.trim().length === 0
      ) {
        failures.push(`${skillName}: description must be a non-empty string`);
      }
    }

    expect(failures).toEqual([]);
  });

  test('wiki-lint reports are constrained to wiki reports directory', () => {
    const raw = readFileSync(join(SKILLS_DIR, 'wiki-lint', 'SKILL.md'), 'utf8');
    expect(raw).toContain('<WIKI_PATH>/reports/');
    expect(raw).toContain('Do not write `LINT_REPORT.md` to the wiki root');
    expect(raw).toContain('English by default');
    expect(raw).not.toContain('**REPORT_PATH** — `<WIKI_PATH>/LINT_REPORT.md`');
  });
});
