export function normalizeKeyword(kw: string): string {
  return kw
    .toLowerCase()
    .replace(/[^a-z0-9 +#./]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const kw of keywords) {
    const norm = normalizeKeyword(kw);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      result.push(norm);
    }
  }
  return result;
}

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "must", "can",
  "that", "this", "these", "those", "i", "you", "he", "she", "it", "we",
  "they", "what", "which", "who", "how", "when", "where", "why",
  "not", "no", "nor", "so", "yet", "both", "either", "neither",
  "each", "every", "all", "any", "few", "more", "most", "other",
  "some", "such", "only", "own", "same", "than", "too", "very",
  "just", "as", "into", "through", "during", "before", "after",
  "above", "below", "between", "out", "off", "over", "under",
  "again", "further", "then", "once", "up", "down",
  "our", "their", "your", "its", "his", "her", "my",
  "work", "including", "related", "required", "ability", "strong",
  "excellent", "good", "great", "knowledge", "understanding",
  "preferred", "responsible", "responsibilities", "collaborate",
  "team", "teams", "member", "members", "using", "used", "use",
  "ensure", "ensuring", "provide", "providing", "support", "supporting",
  "across", "within", "role", "roles", "position", "company",
]);

export function extractKeywordsFromText(text: string, minLen = 3): string[] {
  const normalized = normalizeKeyword(text);
  const words = normalized.split(/\s+/).filter(
    w => w.length >= minLen && !STOP_WORDS.has(w)
  );
  return [...new Set(words)];
}

export function isTermInText(term: string, text: string): boolean {
  const normTerm = normalizeKeyword(term);
  const normText = normalizeKeyword(text);

  if (!normTerm || !normText) return false;

  const words = normTerm.split(" ");
  if (words.length === 1) {
    const pattern = new RegExp(`(?<![a-z0-9])${escapeRegex(normTerm)}(?![a-z0-9])`, "i");
    return pattern.test(normText);
  }

  return normText.includes(normTerm);
}

function escapeRegex(s: string): string {
  return s.replace(/[+.#]/g, "\\$&");
}
