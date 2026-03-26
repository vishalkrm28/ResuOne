import { normalizeKeyword } from "./normalize-keywords.js";
import { resolveToCanonical, getAllAliases } from "./keyword-synonyms.js";
import { isTermInText } from "./normalize-keywords.js";

export interface MatchResult {
  matched: string[];
  missing: string[];
}

function buildCvCorpus(cvKeywords: string[]): Set<string> {
  const corpus = new Set<string>();
  for (const kw of cvKeywords) {
    const norm = normalizeKeyword(kw);
    if (!norm) continue;
    corpus.add(norm);
    const canonical = resolveToCanonical(norm);
    corpus.add(canonical);
    for (const alias of getAllAliases(norm)) {
      corpus.add(alias);
    }
  }
  return corpus;
}

export function matchKeywords(
  jdKeywords: string[],
  cvKeywords: string[],
  cvFullText: string,
): MatchResult {
  const cvCorpus = buildCvCorpus(cvKeywords);
  const matched: string[] = [];
  const missing: string[] = [];
  const seenNorm = new Set<string>();

  for (const rawJdKw of jdKeywords) {
    const norm = normalizeKeyword(rawJdKw);
    if (!norm || seenNorm.has(norm)) continue;
    seenNorm.add(norm);

    const canonical = resolveToCanonical(norm);
    const aliases = getAllAliases(norm);

    let found = false;

    if (cvCorpus.has(norm) || cvCorpus.has(canonical)) {
      found = true;
    }

    if (!found) {
      for (const alias of aliases) {
        if (cvCorpus.has(alias)) {
          found = true;
          break;
        }
      }
    }

    if (!found) {
      if (isTermInText(norm, cvFullText)) {
        found = true;
      }
    }

    if (!found) {
      for (const alias of aliases) {
        if (isTermInText(alias, cvFullText)) {
          found = true;
          break;
        }
      }
    }

    if (found) {
      matched.push(rawJdKw);
    } else {
      missing.push(rawJdKw);
    }
  }

  return { matched, missing };
}
