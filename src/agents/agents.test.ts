// Phase 4 verifiable: aggregator shape + per-persona prompt content guards.

import { describe, expect, test } from 'bun:test';
import {
  ALL_PERSONAS,
  DEFAULT_LITERATURE_WIKI,
  DEFAULT_PERSONA_MODELS,
} from '../config/constants';
import { COUNCILLOR_ROLE_FRAMINGS, buildCouncillorPrompt } from './council';
import { createAllAgents } from './index';

describe('createAllAgents', () => {
  test('returns exactly the six designed personas (D2/D6)', () => {
    const agents = createAllAgents();
    expect(Object.keys(agents).sort()).toEqual([...ALL_PERSONAS].sort());
  });

  test('every agent has the SDK-compatible flat shape', () => {
    const agents = createAllAgents();
    for (const [name, agent] of Object.entries(agents)) {
      expect(typeof agent.description).toBe('string');
      expect(agent.description.length).toBeGreaterThan(0);
      expect(['primary', 'subagent', 'all']).toContain(agent.mode);
      expect(typeof agent.model).toBe('string');
      expect(agent.model.length).toBeGreaterThan(0);
      expect(typeof agent.temperature).toBe('number');
      expect(typeof agent.prompt).toBe('string');
      expect(agent.prompt.length).toBeGreaterThan(0);
      // Defensive: name must NOT be on the value — it lives as the record key.
      expect(
        (agent as unknown as Record<string, unknown>).name,
      ).toBeUndefined();
      expect(name.length).toBeGreaterThan(0);
    }
  });

  test('orchestrator is primary; writer and council are all; others are subagents', () => {
    const agents = createAllAgents();
    expect(agents.orchestrator.mode).toBe('primary');
    expect(agents.writer.mode).toBe('all');
    expect(agents.council.mode).toBe('all');
    for (const name of ['librarian', 'prospector', 'coder']) {
      expect(agents[name].mode).toBe('subagent');
    }
  });

  test('uses per-persona default models', () => {
    const agents = createAllAgents();
    for (const name of ALL_PERSONAS) {
      expect(agents[name].model).toBe(DEFAULT_PERSONA_MODELS[name]);
    }
  });

  test('per-persona model overrides win over defaults', () => {
    const agents = createAllAgents({
      models: {
        orchestrator: 'override-orch',
        librarian: 'override-lib',
      },
    });
    expect(agents.orchestrator.model).toBe('override-orch');
    expect(agents.librarian.model).toBe('override-lib');
    expect(agents.prospector.model).toBe(DEFAULT_PERSONA_MODELS.prospector);
  });
});

describe('orchestrator default settings', () => {
  test('uses frontier model openai/gpt-5.5 by default', () => {
    const agents = createAllAgents();
    expect(agents.orchestrator.model).toBe('openai/gpt-5.5');
  });

  test('description is the coordinator one-liner', () => {
    const agents = createAllAgents();
    expect(agents.orchestrator.description).toMatch(/coordinator/i);
    expect(agents.orchestrator.description).toMatch(/specialist/i);
  });
});

describe('orchestrator prompt structure', () => {
  test('contains the expected XML-style sections', () => {
    const prompt = createAllAgents().orchestrator.prompt;
    expect(prompt).toContain('<Role>');
    expect(prompt).toContain('<Personas>');
    expect(prompt).toContain('<Workflow>');
    expect(prompt).toContain('<HandoffFormat>');
    expect(prompt).toContain('<Communication>');
    expect(prompt).toContain('<Example>');
  });

  test('references all five specialists', () => {
    const prompt = createAllAgents().orchestrator.prompt;
    for (const handle of [
      '@librarian',
      '@prospector',
      '@coder',
      '@council',
      '@writer',
    ]) {
      expect(prompt).toContain(handle);
    }
  });

  test('does not mention MCP', () => {
    const prompt = createAllAgents().orchestrator.prompt;
    expect(prompt).not.toMatch(/\bMCP\b/i);
  });

  test('does not mention MVP or shallow-now phrasing', () => {
    const prompt = createAllAgents().orchestrator.prompt;
    expect(prompt).not.toMatch(/\bMVP\b/i);
    expect(prompt).not.toMatch(/MVP-shallow/i);
  });

  test('describes librarian access generically (no user-specific paths)', () => {
    const prompt = createAllAgents().orchestrator.prompt;
    expect(prompt).not.toContain('~/RL-Wiki');
    expect(prompt).not.toContain('RL-Wiki');
  });
});

describe('librarian default settings', () => {
  test('uses cheaper model openai/gpt-5.4-mini by default', () => {
    const agents = createAllAgents();
    expect(agents.librarian.model).toBe('openai/gpt-5.4-mini');
  });

  test('description names it the literature specialist', () => {
    const agents = createAllAgents();
    expect(agents.librarian.description).toMatch(/literature specialist/i);
  });
});

describe('librarian prompt structure', () => {
  test('contains the expected XML-style sections', () => {
    const prompt = createAllAgents().librarian.prompt;
    expect(prompt).toContain('<Role>');
    expect(prompt).toContain('<Session Start>');
    expect(prompt).toContain('<Boundaries>');
    expect(prompt).toContain('<Skills>');
    expect(prompt).toContain('<Behavior>');
    expect(prompt).toContain('<Handoff>');
    expect(prompt).toContain('<Communication>');
  });

  test('references the lab/drafts/ write zone and node_id format', () => {
    const prompt = createAllAgents().librarian.prompt;
    expect(prompt).toContain('lab/drafts/');
    expect(prompt).toContain('claim:<slug>');
  });

  test('references its known skills by name', () => {
    const prompt = createAllAgents().librarian.prompt;
    expect(prompt).toContain('paper-search');
    expect(prompt).toContain('wiki-ingest');
    expect(prompt).toContain('wiki-lint');
    expect(prompt).toContain('claim-extract');
  });

  test('does not mention MCP or MVP', () => {
    const prompt = createAllAgents().librarian.prompt;
    expect(prompt).not.toMatch(/\bMCP\b/i);
    expect(prompt).not.toMatch(/\bMVP\b/i);
  });

  test('does not contain wiki-specific hardcoded content (raw/, English-only)', () => {
    const prompt = createAllAgents().librarian.prompt;
    // These are RL-Wiki specifics that belong in the user's wiki contract,
    // not in the universal persona prompt.
    expect(prompt).not.toMatch(/raw\/ is read-only/i);
    expect(prompt).not.toMatch(/English-only content rule/i);
  });
});

describe('prospector default settings', () => {
  test('uses frontier model openai/gpt-5.5 by default', () => {
    const agents = createAllAgents();
    expect(agents.prospector.model).toBe('openai/gpt-5.5');
  });

  test('uses higher temperature (0.5) for divergent ideation', () => {
    const agents = createAllAgents();
    expect(agents.prospector.temperature).toBe(0.5);
  });

  test('description names it the research ideator', () => {
    const agents = createAllAgents();
    expect(agents.prospector.description).toMatch(/research ideator/i);
  });

  test('deterministic personas keep T=0.1 (orchestrator, librarian, coder, council)', () => {
    const agents = createAllAgents();
    for (const name of ['orchestrator', 'librarian', 'coder', 'council']) {
      expect(agents[name].temperature).toBe(0.1);
    }
  });
});

describe('prospector prompt structure', () => {
  test('contains the expected XML-style sections', () => {
    const prompt = createAllAgents().prospector.prompt;
    expect(prompt).toContain('<Role>');
    expect(prompt).toContain('<Session Start>');
    expect(prompt).toContain('<Boundaries>');
    expect(prompt).toContain('<Skills>');
    expect(prompt).toContain('<Behavior>');
    expect(prompt).toContain('<Handoff>');
    expect(prompt).toContain('<Communication>');
  });

  test('references both idea and exp artifact paths', () => {
    const prompt = createAllAgents().prospector.prompt;
    expect(prompt).toContain('idea-<slug>.md');
    expect(prompt).toContain('exp-<slug>-<YYYY-MM-DD>.md');
    expect(prompt).toContain('idea:<slug>');
    expect(prompt).toContain('exp:<slug>-<YYYY-MM-DD>');
  });

  test('references its known skills by name', () => {
    const prompt = createAllAgents().prospector.prompt;
    expect(prompt).toContain('gap-map');
    expect(prompt).toContain('idea-creator');
    expect(prompt).toContain('novelty-vs-wiki');
    expect(prompt).toContain('research-refine');
    expect(prompt).toContain('experiment-plan');
    expect(prompt).not.toContain('idea-discovery');
  });

  test('does not mention MCP or MVP', () => {
    const prompt = createAllAgents().prospector.prompt;
    expect(prompt).not.toMatch(/\bMCP\b/i);
    expect(prompt).not.toMatch(/\bMVP\b/i);
  });
});

describe('prospector wikiPath injection', () => {
  test('embeds DEFAULT_LITERATURE_WIKI when no override passed', () => {
    const prompt = createAllAgents().prospector.prompt;
    expect(prompt).toContain(DEFAULT_LITERATURE_WIKI);
  });

  test('embeds custom wikiPath when override passed', () => {
    const customPath = '/custom/path/to/some-wiki';
    const prompt = createAllAgents({ wikiPath: customPath }).prospector.prompt;
    expect(prompt).toContain(customPath);
    expect(prompt).not.toContain(DEFAULT_LITERATURE_WIKI);
  });

  test('placeholder is fully replaced (no <WIKI_PATH> token left)', () => {
    const prompt = createAllAgents({ wikiPath: '/x' }).prospector.prompt;
    expect(prompt).not.toContain('<WIKI_PATH>');
  });
});

describe('coder default settings', () => {
  test('uses cheaper model openai/gpt-5.4-mini by default', () => {
    const agents = createAllAgents();
    expect(agents.coder.model).toBe('openai/gpt-5.4-mini');
  });

  test('description names it the implementation specialist', () => {
    const agents = createAllAgents();
    expect(agents.coder.description).toMatch(/implementation specialist/i);
  });

  test('keeps deterministic temperature (0.1)', () => {
    const agents = createAllAgents();
    expect(agents.coder.temperature).toBe(0.1);
  });
});

describe('coder prompt structure', () => {
  test('contains the expected XML-style sections (including Pre-flight and Anti-patterns)', () => {
    const prompt = createAllAgents().coder.prompt;
    expect(prompt).toContain('<Role>');
    expect(prompt).toContain('<Session Start>');
    expect(prompt).toContain('<Boundaries>');
    expect(prompt).toContain('<Pre-flight>');
    expect(prompt).toContain('<Skills>');
    expect(prompt).toContain('<Behavior>');
    expect(prompt).toContain('<Handoff>');
    expect(prompt).toContain('<Anti-patterns>');
    expect(prompt).toContain('<Communication>');
  });

  test('references exp artifact path and status transitions', () => {
    const prompt = createAllAgents().coder.prompt;
    expect(prompt).toContain('exp-<slug>-<YYYY-MM-DD>.md');
    expect(prompt).toContain('planned');
    expect(prompt).toContain('running');
    expect(prompt).toContain('completed');
    expect(prompt).toContain('failed');
    expect(prompt).toContain('abandoned');
  });

  test('references its known skills by name', () => {
    const prompt = createAllAgents().coder.prompt;
    expect(prompt).toContain('run-experiment');
    expect(prompt).toContain('monitor-experiment');
    expect(prompt).toContain('analyze-results');
  });

  test('contains key reproducibility instructions', () => {
    const prompt = createAllAgents().coder.prompt;
    expect(prompt).toContain('--seed');
    expect(prompt).toContain('CUDA_VISIBLE_DEVICES');
    expect(prompt).toContain('tee');
  });

  test('contains decision matrix vocabulary', () => {
    const prompt = createAllAgents().coder.prompt;
    expect(prompt).toContain('CONTINUE');
    expect(prompt).toContain('WAIT');
    expect(prompt).toContain('STOP');
  });

  test('anti-patterns section contains key hard forbids', () => {
    const prompt = createAllAgents().coder.prompt;
    expect(prompt).toMatch(/Never construct ground truth/i);
    expect(prompt).toMatch(/Never normalize metrics/i);
    expect(prompt).toMatch(/Never silently relaunch/i);
    expect(prompt).toMatch(/Never extract claims from results yourself/i);
  });

  test('does not mention MCP or MVP', () => {
    const prompt = createAllAgents().coder.prompt;
    expect(prompt).not.toMatch(/\bMCP\b/i);
    expect(prompt).not.toMatch(/\bMVP\b/i);
  });

  test('does not contain wikiPath placeholder (coder does not read wiki)', () => {
    const prompt = createAllAgents().coder.prompt;
    expect(prompt).not.toContain('<WIKI_PATH>');
  });
});

describe('council default settings', () => {
  test('uses frontier model openai/gpt-5.5 by default', () => {
    const agents = createAllAgents();
    expect(agents.council.model).toBe('openai/gpt-5.5');
  });

  test('description names it the multi-LLM adversarial review/consensus', () => {
    const agents = createAllAgents();
    expect(agents.council.description).toMatch(/multi-LLM/i);
    expect(agents.council.description).toMatch(/adversarial|consensus/i);
  });

  test('mode is "all" (full agent: primary + subagent)', () => {
    const agents = createAllAgents();
    expect(agents.council.mode).toBe('all');
  });

  test('uses temperature 0.1 (synthesis wants determinism)', () => {
    const agents = createAllAgents();
    expect(agents.council.temperature).toBe(0.1);
  });
});

describe('council prompt structure', () => {
  test('contains the expected XML-style sections', () => {
    const prompt = createAllAgents().council.prompt;
    expect(prompt).toContain('<Role>');
    expect(prompt).toContain('<Session Start>');
    expect(prompt).toContain('<When to invoke me>');
    expect(prompt).toContain('<Boundaries>');
    expect(prompt).toContain('<Council Workflow>');
    expect(prompt).toContain('<Councillor Framing>');
    expect(prompt).toContain('<Required Output>');
    expect(prompt).toContain('<Skills>');
    expect(prompt).toContain('<Behavior>');
    expect(prompt).toContain('<Anti-patterns>');
    expect(prompt).toContain('<Communication>');
  });

  test('required output names the three canonical sections', () => {
    const prompt = createAllAgents().council.prompt;
    expect(prompt).toContain('## Council Response');
    expect(prompt).toContain('## Councillor Details');
    expect(prompt).toContain('## Council Summary');
  });

  test('verdict mapping is deterministic (counts → PASS/WARN/FAIL)', () => {
    const prompt = createAllAgents().council.prompt;
    expect(prompt).toContain('PASS');
    expect(prompt).toContain('WARN');
    expect(prompt).toContain('FAIL');
    expect(prompt).toMatch(/unanimous/i);
    expect(prompt).toMatch(/majority/i);
    expect(prompt).toMatch(/split/i);
  });

  test('contains key anti-patterns: pre-filter, average, self-grade', () => {
    const prompt = createAllAgents().council.prompt;
    expect(prompt).toMatch(/Never pre-filter/i);
    expect(prompt).toMatch(/Never average/i);
    expect(prompt).toMatch(/Never let yourself self-grade/i);
  });

  test('references all four goal modes', () => {
    const prompt = createAllAgents().council.prompt;
    for (const mode of ['advice', 'decision', 'review', 'plan']) {
      expect(prompt).toContain(mode);
    }
  });

  test('references its known skills by name', () => {
    const prompt = createAllAgents().council.prompt;
    expect(prompt).toContain('council-session');
    expect(prompt).toContain('paper-audit');
    // kill-argument is folded into council-session(role=adversarial,members=1)
    expect(prompt).not.toContain('`kill-argument`');
    // paper-claim-audit is folded into paper-audit umbrella
    expect(prompt).not.toContain('`paper-claim-audit`');
  });

  test('does not mention MCP or MVP', () => {
    const prompt = createAllAgents().council.prompt;
    expect(prompt).not.toMatch(/\bMCP\b/i);
    expect(prompt).not.toMatch(/\bMVP\b/i);
  });
});

describe('council wikiPath injection', () => {
  test('embeds DEFAULT_LITERATURE_WIKI when no override passed', () => {
    const prompt = createAllAgents().council.prompt;
    expect(prompt).toContain(DEFAULT_LITERATURE_WIKI);
  });

  test('embeds custom wikiPath when override passed', () => {
    const customPath = '/custom/path/to/some-wiki';
    const prompt = createAllAgents({ wikiPath: customPath }).council.prompt;
    expect(prompt).toContain(customPath);
    expect(prompt).not.toContain(DEFAULT_LITERATURE_WIKI);
  });

  test('placeholder is fully replaced (no <WIKI_PATH> token left)', () => {
    const prompt = createAllAgents({ wikiPath: '/x' }).council.prompt;
    expect(prompt).not.toContain('<WIKI_PATH>');
  });
});

describe('COUNCILLOR_ROLE_FRAMINGS', () => {
  test('exposes all four canonical councillor roles', () => {
    expect(Object.keys(COUNCILLOR_ROLE_FRAMINGS).sort()).toEqual([
      'adversarial',
      'expert',
      'methodologist',
      'supportive',
    ]);
  });

  test('adversarial framing forbids hedging and acknowledging mitigations', () => {
    expect(COUNCILLOR_ROLE_FRAMINGS.adversarial).toMatch(/Do NOT hedge/);
    expect(COUNCILLOR_ROLE_FRAMINGS.adversarial).toMatch(
      /acknowledge mitigations/,
    );
    expect(COUNCILLOR_ROLE_FRAMINGS.adversarial).toMatch(/single.*strongest/i);
  });

  test('every framing is a non-empty string', () => {
    for (const v of Object.values(COUNCILLOR_ROLE_FRAMINGS)) {
      expect(typeof v).toBe('string');
      expect((v as string).length).toBeGreaterThan(20);
    }
  });
});

describe('buildCouncillorPrompt', () => {
  test('renders independent-assessment framing and confidence requirement', () => {
    const out = buildCouncillorPrompt({
      role: 'adversarial',
      question: 'Is this claim valid?',
      artifactPaths: ['lab/drafts/claim-foo.md'],
    });
    expect(out).toMatch(/INDEPENDENT assessment/);
    expect(out).toMatch(/will NOT\s+see their responses/);
    expect(out).toMatch(/## Assessment/);
    expect(out).toMatch(/## Evidence/);
    expect(out).toMatch(/## Dissent points/);
    expect(out).toMatch(/## Confidence/);
    expect(out).toMatch(/low \| medium \| high/);
  });

  test('embeds the question and the artifact list verbatim', () => {
    const out = buildCouncillorPrompt({
      role: 'expert',
      question: 'Does the proof of Lemma 3 hold under Gaussianity?',
      artifactPaths: ['paper/3_method.tex', 'lab/drafts/claim-bar.md'],
    });
    expect(out).toContain('Does the proof of Lemma 3 hold under Gaussianity?');
    expect(out).toContain('- paper/3_method.tex');
    expect(out).toContain('- lab/drafts/claim-bar.md');
  });

  test('handles empty artifact list gracefully', () => {
    const out = buildCouncillorPrompt({
      role: 'supportive',
      question: 'What should I read next on offline RL?',
      artifactPaths: [],
    });
    expect(out).toMatch(/none provided/);
  });

  test('injects the role-specific framing', () => {
    const out = buildCouncillorPrompt({
      role: 'methodologist',
      question: 'Q?',
      artifactPaths: [],
    });
    expect(out).toContain(COUNCILLOR_ROLE_FRAMINGS.methodologist);
  });
});

describe('writer default settings', () => {
  test('uses frontier model openai/gpt-5.5 by default', () => {
    const agents = createAllAgents();
    expect(agents.writer.model).toBe('openai/gpt-5.5');
  });

  test('description names it the academic writer', () => {
    const agents = createAllAgents();
    expect(agents.writer.description).toMatch(/academic writer/i);
  });

  test('mode is "all" (full agent: primary + subagent)', () => {
    const agents = createAllAgents();
    expect(agents.writer.mode).toBe('all');
  });

  test('uses temperature 0.2 (slight narrative-flow boost)', () => {
    const agents = createAllAgents();
    expect(agents.writer.temperature).toBe(0.2);
  });
});

describe('writer prompt structure', () => {
  test('contains the expected XML-style sections (including Workflow Phases and Anti-patterns)', () => {
    const prompt = createAllAgents().writer.prompt;
    expect(prompt).toContain('<Role>');
    expect(prompt).toContain('<Session Start>');
    expect(prompt).toContain('<Boundaries>');
    expect(prompt).toContain('<Workflow Phases>');
    expect(prompt).toContain('<Skills>');
    expect(prompt).toContain('<Behavior>');
    expect(prompt).toContain('<Handoff>');
    expect(prompt).toContain('<Anti-patterns>');
    expect(prompt).toContain('<Communication>');
  });

  test('references the paper/ write zone and lab/drafts/ as read-only', () => {
    const prompt = createAllAgents().writer.prompt;
    expect(prompt).toContain('<project>/paper/');
    expect(prompt).toMatch(/lab\/drafts\/.*READ-ONLY/i);
  });

  test('references its known skills by name', () => {
    const prompt = createAllAgents().writer.prompt;
    expect(prompt).toContain('paper-plan');
    expect(prompt).toContain('paper-figure');
    expect(prompt).toContain('paper-audit');
    expect(prompt).toContain('council-session');
  });

  test('marks drafting and compile as persona work, not skills', () => {
    const prompt = createAllAgents().writer.prompt;
    // After Wave 4 design: paper-write / paper-compile dropped as separate
    // skills (would just duplicate the persona's craft rules).
    expect(prompt).not.toContain('`paper-write`');
    expect(prompt).not.toContain('`paper-compile`');
    expect(prompt).toMatch(/Drafting.*your own work|not skill-delegated/i);
  });

  test('contains key writing-craft instructions', () => {
    const prompt = createAllAgents().writer.prompt;
    expect(prompt).toMatch(/Claims-Evidence Matrix/);
    expect(prompt).toMatch(/Active voice/i);
    expect(prompt).toMatch(/topic sentence/i);
    expect(prompt).toMatch(/Abstract is self-contained/i);
  });

  test('contains citation integrity rules', () => {
    const prompt = createAllAgents().writer.prompt;
    expect(prompt).toContain('[VERIFY]');
    expect(prompt).toMatch(/DBLP.*CrossRef.*arXiv/i);
    expect(prompt).toMatch(/Never cite a paper from memory/i);
  });

  test('anti-patterns section forbids AI-isms by name', () => {
    const prompt = createAllAgents().writer.prompt;
    expect(prompt).toContain('"delve"');
    expect(prompt).toContain('"pivotal"');
    expect(prompt).toContain('"tapestry"');
    expect(prompt).toMatch(/Never use AI-isms/i);
  });

  test('anti-patterns forbids unsupported scope and hidden proof steps', () => {
    const prompt = createAllAgents().writer.prompt;
    expect(prompt).toMatch(/unsupported scope claims/i);
    expect(prompt).toMatch(/state-of-the-art/);
    expect(prompt).toMatch(/Never hide proof steps/i);
  });

  test('does not mention MCP or MVP', () => {
    const prompt = createAllAgents().writer.prompt;
    expect(prompt).not.toMatch(/\bMCP\b/i);
    expect(prompt).not.toMatch(/\bMVP\b/i);
  });
});

describe('writer wikiPath injection', () => {
  test('embeds DEFAULT_LITERATURE_WIKI when no override passed', () => {
    const prompt = createAllAgents().writer.prompt;
    expect(prompt).toContain(DEFAULT_LITERATURE_WIKI);
  });

  test('embeds custom wikiPath when override passed', () => {
    const customPath = '/custom/path/to/some-wiki';
    const prompt = createAllAgents({ wikiPath: customPath }).writer.prompt;
    expect(prompt).toContain(customPath);
    expect(prompt).not.toContain(DEFAULT_LITERATURE_WIKI);
  });

  test('placeholder is fully replaced (no <WIKI_PATH> token left)', () => {
    const prompt = createAllAgents({ wikiPath: '/x' }).writer.prompt;
    expect(prompt).not.toContain('<WIKI_PATH>');
  });
});

describe('librarian wikiPath injection', () => {
  test('embeds DEFAULT_LITERATURE_WIKI when no override passed', () => {
    const prompt = createAllAgents().librarian.prompt;
    expect(prompt).toContain(DEFAULT_LITERATURE_WIKI);
  });

  test('embeds custom wikiPath when override passed', () => {
    const customPath = '/custom/path/to/some-wiki';
    const prompt = createAllAgents({ wikiPath: customPath }).librarian.prompt;
    expect(prompt).toContain(customPath);
    // Default path should NOT leak through when override is given
    expect(prompt).not.toContain(DEFAULT_LITERATURE_WIKI);
  });

  test('placeholder is fully replaced (no <WIKI_PATH> token left)', () => {
    const prompt = createAllAgents({ wikiPath: '/x' }).librarian.prompt;
    expect(prompt).not.toContain('<WIKI_PATH>');
  });
});
