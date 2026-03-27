import {
  normalizeKeyword,
  isTermInText,
  getSignificantWords,
  getWordRoot,
  buildCvRootSet,
  prefixFoundInRoots,
  extractKeywordsFromText,
} from "./normalize-keywords.js";
import { resolveToCanonical, getAllAliases } from "./keyword-synonyms.js";

export interface MatchResult {
  matched: string[];
  missing: string[];
}

/**
 * Builds the CV corpus from:
 * 1. AI-extracted keywords (skills / bullets / titles) — with aliases and roots
 * 2. Every meaningful word in the raw CV full text — catches skills mentioned
 *    in prose that the AI didn't explicitly extract (e.g. "hands-on with AWS")
 */
function buildCvCorpus(cvKeywords: string[], cvFullText: string): Set<string> {
  const corpus = new Set<string>();

  for (const kw of cvKeywords) {
    const norm = normalizeKeyword(kw);
    if (!norm) continue;
    corpus.add(norm);
    const canonical = resolveToCanonical(norm);
    corpus.add(canonical);
    corpus.add(getWordRoot(canonical));
    for (const alias of getAllAliases(norm)) {
      corpus.add(alias);
      corpus.add(getWordRoot(alias));
    }
    corpus.add(getWordRoot(norm));
    for (const word of norm.split(" ")) {
      if (word.length >= 3) corpus.add(getWordRoot(word));
    }
  }

  // Index individual meaningful words from the full CV text.
  // minLen=3 so that 3-char abbreviations (aws, sql, gcp, api …) are included.
  for (const word of extractKeywordsFromText(cvFullText, 3)) {
    corpus.add(word);
    corpus.add(getWordRoot(word));
  }

  return corpus;
}

/**
 * Checks a single word against every available CV data source:
 * corpus (extracted + text-derived), exact text search, root set, and
 * prefix-fuzzy stem matching.
 */
function wordFoundInCv(
  w: string,
  cvFullText: string,
  cvRoots: Set<string>,
  cvCorpus: Set<string>,
): boolean {
  const root = getWordRoot(w);
  return (
    cvCorpus.has(w) ||
    cvCorpus.has(root) ||
    isTermInText(w, cvFullText) ||
    cvRoots.has(w) ||
    cvRoots.has(root) ||
    prefixFoundInRoots(root, cvRoots)
  );
}

/**
 * Checks whether the significant words of `term` are collectively present in
 * the CV.  Threshold: 2-word phrases need both; 3+ need ≥ ⌈75%⌉.
 * Checks corpus, text, root set, and prefix-fuzzy matching for each word.
 */
function significantWordsPresent(
  term: string,
  cvFullText: string,
  cvRoots: Set<string>,
  cvCorpus: Set<string>,
  minLen = 4,
): boolean {
  const sigWords = getSignificantWords(term, minLen);
  if (sigWords.length < 2) return false;

  const required = sigWords.length === 2 ? 2 : Math.ceil(sigWords.length * 0.75);
  let found = 0;

  for (const w of sigWords) {
    if (wordFoundInCv(w, cvFullText, cvRoots, cvCorpus)) {
      found++;
      if (found >= required) return true;
    }
  }
  return false;
}

/**
 * Checks whether a single-word JD term can be found in the CV via stem,
 * prefix, or corpus matching.  Handles inflection variants:
 *   "leadership" → root "leader" matches "leader", "leading", "led"
 *   "demonstration" → root "demonstr" → prefix matches "demonstrat"
 */
function stemMatchFound(
  norm: string,
  aliases: string[],
  cvRoots: Set<string>,
  cvCorpus: Set<string>,
): boolean {
  if (norm.split(" ").length !== 1 || norm.length < 5) return false;

  const root = getWordRoot(norm);
  if (
    cvCorpus.has(norm) ||
    cvRoots.has(norm) ||
    cvRoots.has(root) ||
    prefixFoundInRoots(root, cvRoots)
  ) {
    return true;
  }

  for (const alias of aliases) {
    if (alias.split(" ").length !== 1) continue;
    const aliasRoot = getWordRoot(alias);
    if (
      cvCorpus.has(alias) ||
      cvRoots.has(alias) ||
      cvRoots.has(aliasRoot) ||
      prefixFoundInRoots(aliasRoot, cvRoots)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a multi-word JD phrase has exactly one significant word
 * (after stop-word filtering with `minLen`) and that word is found in the CV.
 * Also checks aliases of the phrase.
 *
 * Used for two passes:
 *   minLen=4 — catches "leadership skills" → ["leadership"]
 *   minLen=3 — catches "AWS experience" → ["aws"]  (3-char abbreviation fallback)
 */
function singleSigWordFound(
  norm: string,
  aliases: string[],
  cvFullText: string,
  cvRoots: Set<string>,
  cvCorpus: Set<string>,
  minLen: number,
): boolean {
  const sigWords = getSignificantWords(norm, minLen);
  if (sigWords.length === 1) {
    if (wordFoundInCv(sigWords[0], cvFullText, cvRoots, cvCorpus)) return true;
  }
  for (const alias of aliases) {
    if (alias === norm) continue;
    const aliasSig = getSignificantWords(alias, minLen);
    if (aliasSig.length === 1) {
      if (wordFoundInCv(aliasSig[0], cvFullText, cvRoots, cvCorpus)) return true;
    }
  }
  return false;
}

export function matchKeywords(
  jdKeywords: string[],
  cvKeywords: string[],
  cvFullText: string,
): MatchResult {
  const cvCorpus = buildCvCorpus(cvKeywords, cvFullText);
  const cvRoots = buildCvRootSet(cvFullText);
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

    // ── Pass 1: corpus lookup ─────────────────────────────────────────────
    // Covers AI-extracted skills/bullets/titles AND individual words from
    // the full CV text (via the enriched buildCvCorpus).
    if (cvCorpus.has(norm) || cvCorpus.has(canonical)) found = true;

    // ── Pass 2: alias corpus lookup ──────────────────────────────────────
    if (!found) {
      for (const alias of aliases) {
        if (cvCorpus.has(alias)) { found = true; break; }
      }
    }

    // ── Pass 3: exact text search — term and canonical ───────────────────
    if (!found && isTermInText(norm, cvFullText)) found = true;
    if (!found && canonical !== norm && isTermInText(canonical, cvFullText)) found = true;

    // ── Pass 4: text search across all aliases ────────────────────────────
    if (!found) {
      for (const alias of aliases) {
        if (alias !== norm && isTermInText(alias, cvFullText)) { found = true; break; }
      }
    }

    // ── Pass 5: significant-word presence check (minLen=4) ───────────────
    // Catches word-order variation, nominal/verbal form switch, partial phrase
    // match.  Uses corpus + prefix fuzzy lookup for each significant word.
    if (!found && significantWordsPresent(norm, cvFullText, cvRoots, cvCorpus, 4)) found = true;

    // ── Pass 6: significant-word check across canonical & aliases ─────────
    if (!found) {
      const formsToCheck = [canonical, ...aliases].filter(f => f !== norm);
      for (const form of formsToCheck) {
        if (significantWordsPresent(form, cvFullText, cvRoots, cvCorpus, 4)) { found = true; break; }
      }
    }

    // ── Pass 7: root/stem + prefix matching for single-word terms ─────────
    // Catches inflection variants AND near-root mismatches like
    // "demonstration"→"demonstr" ↔ "demonstrated"→"demonstrat".
    if (!found && stemMatchFound(norm, aliases, cvRoots, cvCorpus)) found = true;

    // ── Pass 8: single-significant-word check (minLen=4) ─────────────────
    // Handles phrases like "leadership skills" where the stop-word filter
    // leaves only one meaningful word.
    if (!found && norm.split(" ").length > 1) {
      found = singleSigWordFound(norm, aliases, cvFullText, cvRoots, cvCorpus, 4);
    }

    // ── Pass 9: 3-char abbreviation fallback (minLen=3) ──────────────────
    // Catches "AWS experience", "strong SQL skills", "GCP certification" etc.
    // where the key term is a 3-char abbreviation and all surrounding words
    // are in SIGNIFICANCE_STOP.  Only activates when minLen=4 yields 0 sig
    // words so it does not interfere with earlier passes.
    if (
      !found &&
      norm.split(" ").length > 1 &&
      getSignificantWords(norm, 4).length === 0
    ) {
      found = singleSigWordFound(norm, aliases, cvFullText, cvRoots, cvCorpus, 3);
    }

    if (found) {
      matched.push(rawJdKw);
    } else {
      missing.push(rawJdKw);
    }
  }

  return { matched, missing };
}
