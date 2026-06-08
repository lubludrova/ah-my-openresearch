import {
  CLAIM_ID_MAX_LENGTH,
  CLAIM_ID_REGEX,
  CLAIM_ID_STOPWORDS,
} from '../config/constants';

export type ArtifactType = 'claim' | 'exp' | 'idea';

const GREEK_ASCII: Record<string, string> = {
  α: 'alpha',
  β: 'beta',
  γ: 'gamma',
  δ: 'delta',
  ε: 'epsilon',
  θ: 'theta',
  κ: 'kappa',
  λ: 'lambda',
  μ: 'mu',
  π: 'pi',
  σ: 'sigma',
  τ: 'tau',
  φ: 'phi',
  ω: 'omega',
};

const STOPWORDS = new Set<string>(CLAIM_ID_STOPWORDS);

export function slugifyTitle(title: string): string {
  const ascii = title
    .trim()
    .toLowerCase()
    .replace(/[αβγδεθκλμπστφω]/g, (char) => GREEK_ASCII[char] ?? char)
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '');

  const words = ascii
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0 && !STOPWORDS.has(word));

  const slug = words.join('-');
  const fallback = slug || 'untitled';

  if (fallback.length <= CLAIM_ID_MAX_LENGTH) {
    return fallback;
  }

  const truncated = fallback.slice(0, CLAIM_ID_MAX_LENGTH);
  const boundary = truncated.lastIndexOf('-');
  return (boundary > 0 ? truncated.slice(0, boundary) : truncated).replace(
    /-+$/g,
    '',
  );
}

export function buildNodeId(
  type: ArtifactType,
  title: string,
  date?: string,
): string {
  const slug = slugifyTitle(title);

  if (type === 'exp') {
    if (!date) {
      throw new Error('Experiment node IDs require a YYYY-MM-DD date.');
    }

    return `exp:${slug}-${date}`;
  }

  return `${type}:${slug}`;
}

export function ensureUniqueNodeId(
  nodeId: string,
  existingIds: Iterable<string>,
): string {
  const used = new Set(existingIds);

  if (!used.has(nodeId)) {
    return nodeId;
  }

  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${nodeId}-${suffix}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }
}

export function getNodeType(nodeId: string): ArtifactType | undefined {
  const [prefix] = nodeId.split(':', 1);

  if (prefix === 'claim' || prefix === 'exp' || prefix === 'idea') {
    return prefix;
  }

  return undefined;
}

export function isValidNodeId(nodeId: string): boolean {
  if (!CLAIM_ID_REGEX.test(nodeId)) {
    return false;
  }

  if (nodeId.startsWith('exp:')) {
    return /-\d{4}-\d{2}-\d{2}(?:-\d+)?$/.test(nodeId);
  }

  return true;
}
