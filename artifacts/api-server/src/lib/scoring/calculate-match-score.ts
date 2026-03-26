import { createHash } from "crypto";
import type { ScoringInput, ScoringBreakdown, ScoringComponentResult } from "./scoring-types.js";
import { normalizeKeywords, extractKeywordsFromText, isTermInText } from "./normalize-keywords.js";
import { matchKeywords } from "./keyword-similarity.js";
import { detectIndustry, scoreIndustryAlignment } from "./industry-config.js";
import { getScoreBand } from "./score-bands.js";

const WEIGHTS = {
  required: 45,
  preferred: 15,
  responsibility: 20,
  seniority: 10,
  industry: 10,
} as const;

const SENIOR_SIGNALS = ["senior", "lead", "principal", "staff", "head of", "director", "vp", "manager", "architect"];
const JUNIOR_SIGNALS = ["junior", "associate", "graduate", "entry level", "trainee", "intern"];

interface KeywordComponentResult extends ScoringComponentResult {
  matchedItems: string[];
  missingItems: string[];
}

function buildCvKeywordPool(input: ScoringInput): string[] {
  return [...input.cvSkills, ...input.cvBullets, ...input.cvTitles].filter(Boolean);
}

function scoreRequired(input: ScoringInput, cvPool: string[]): KeywordComponentResult {
  const uniqueJd = [...new Set([...input.jdRequiredSkills, ...input.jdMustHave].filter(Boolean))];

  if (uniqueJd.length === 0) {
    const fallback = extractKeywordsFromText(input.jdText, 4)
      .slice(0, 20)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1));

    if (fallback.length === 0) {
      // JD has no extractable keywords at all — neutral 50% rather than
      // an arbitrary bonus score that rewards CVs for empty job descriptions.
      return {
        rawScore: Math.round(WEIGHTS.required * 0.5),
        maxScore: WEIGHTS.required,
        matched: 0,
        total: 0,
        matchedItems: [],
        missingItems: [],
      };
    }

    const { matched: matchedItems, missing: missingItems } = matchKeywords(fallback, cvPool, input.cvText);
    const ratio = matchedItems.length / fallback.length;
    return {
      rawScore: Math.round(ratio * WEIGHTS.required),
      maxScore: WEIGHTS.required,
      matched: matchedItems.length,
      total: fallback.length,
      matchedItems,
      missingItems,
    };
  }

  const { matched: matchedItems, missing: missingItems } = matchKeywords(uniqueJd, cvPool, input.cvText);
  const ratio = matchedItems.length / uniqueJd.length;
  return {
    rawScore: Math.round(ratio * WEIGHTS.required),
    maxScore: WEIGHTS.required,
    matched: matchedItems.length,
    total: uniqueJd.length,
    matchedItems,
    missingItems,
  };
}

function scorePreferred(input: ScoringInput, cvPool: string[]): KeywordComponentResult {
  const uniqueJd = [...new Set([...input.jdPreferredSkills, ...input.jdNiceToHave].filter(Boolean))];

  if (uniqueJd.length === 0) {
    return {
      rawScore: Math.round(WEIGHTS.preferred * 0.5),
      maxScore: WEIGHTS.preferred,
      matched: 0,
      total: 0,
      matchedItems: [],
      missingItems: [],
    };
  }

  const { matched: matchedItems, missing: missingItems } = matchKeywords(uniqueJd, cvPool, input.cvText);
  const ratio = matchedItems.length / uniqueJd.length;
  return {
    rawScore: Math.round(ratio * WEIGHTS.preferred),
    maxScore: WEIGHTS.preferred,
    matched: matchedItems.length,
    total: uniqueJd.length,
    matchedItems,
    missingItems,
  };
}

function scoreResponsibilities(input: ScoringInput): ScoringComponentResult {
  if (input.jdResponsibilities.length === 0) {
    // No responsibilities parsed from JD — neutral 50%, consistent with
    // the other component fallbacks. Was 60% (arbitrary bonus), now 50%.
    return {
      rawScore: Math.round(WEIGHTS.responsibility * 0.5),
      maxScore: WEIGHTS.responsibility,
      matched: 0,
      total: 0,
    };
  }

  const cvSearchText = [input.cvText, input.cvSummary, ...input.cvBullets].join(" ");
  const totalResponsibilities = input.jdResponsibilities.length;
  let matchedScore = 0;

  for (const responsibility of input.jdResponsibilities) {
    const terms = extractKeywordsFromText(responsibility, 4).slice(0, 5);
    if (terms.length === 0) {
      matchedScore += 0.5;
      continue;
    }
    const matchedTermCount = terms.filter(t => isTermInText(t, cvSearchText)).length;
    const termRatio = matchedTermCount / terms.length;
    if (termRatio >= 0.5) {
      matchedScore += 1;
    } else if (termRatio >= 0.2) {
      matchedScore += 0.4;
    }
  }

  const ratio = matchedScore / totalResponsibilities;
  return {
    rawScore: Math.round(ratio * WEIGHTS.responsibility),
    maxScore: WEIGHTS.responsibility,
    matched: Math.round(matchedScore),
    total: totalResponsibilities,
  };
}

function scoreSeniority(input: ScoringInput): ScoringComponentResult {
  const jdTextLower = input.jdText.toLowerCase();
  const cvTitlesLower = input.cvTitles.join(" ").toLowerCase();
  const cvTextLower = input.cvText.toLowerCase();

  const jdIsSenior = SENIOR_SIGNALS.some(s => jdTextLower.includes(s));
  const jdIsJunior = JUNIOR_SIGNALS.some(s => jdTextLower.includes(s));
  const cvIsSenior = SENIOR_SIGNALS.some(s => cvTitlesLower.includes(s) || cvTextLower.includes(s));
  const cvIsJunior = JUNIOR_SIGNALS.some(s => cvTitlesLower.includes(s));

  let ratio = 0.7;

  if (jdIsSenior && cvIsSenior) {
    ratio = 1.0;
  } else if (jdIsSenior && cvIsJunior) {
    ratio = 0.4;
  } else if (jdIsSenior && !cvIsJunior) {
    ratio = 0.75;
  } else if (jdIsJunior) {
    ratio = 1.0;
  } else if (!jdIsSenior && !jdIsJunior) {
    ratio = 0.8;
  }

  if (input.jdRequiredYears !== null) {
    const cvExperienceEntries = input.cvTitles.length;
    const expectedEntries = Math.max(1, Math.ceil(input.jdRequiredYears / 2));
    if (cvExperienceEntries >= expectedEntries) {
      ratio = Math.min(1, ratio + 0.1);
    } else if (cvExperienceEntries === 0) {
      ratio = Math.min(ratio, 0.5);
    }
  }

  return {
    rawScore: Math.round(ratio * WEIGHTS.seniority),
    maxScore: WEIGHTS.seniority,
    matched: Math.round(ratio * 10),
    total: 10,
  };
}

function scoreIndustryComponent(input: ScoringInput): ScoringComponentResult & { detectedIndustry: string } {
  const industry = detectIndustry(input.jdText);
  const alignmentRatio = scoreIndustryAlignment(industry, input.cvText);
  return {
    rawScore: Math.round(alignmentRatio * WEIGHTS.industry),
    maxScore: WEIGHTS.industry,
    matched: Math.round(alignmentRatio * 10),
    total: 10,
    detectedIndustry: industry.name,
  };
}

function computeInputHash(input: ScoringInput): string {
  // Include every field that actually influences the score so that two
  // different scoring inputs cannot produce the same hash.
  //
  // Previous version only hashed cvSkills + JD required/preferred/mustHave,
  // missing cvBullets, cvTitles, jdNiceToHave, jdResponsibilities — all of
  // which affect responsibilities, seniority, and preferred-keyword scoring.

  const cvKeys = normalizeKeywords([
    ...input.cvSkills,
    ...input.cvTitles,
  ]).sort();

  const cvBulletTokens = normalizeKeywords(
    input.cvBullets.flatMap(b => b.split(/\s+/)).filter(Boolean)
  ).sort();

  const jdKeys = normalizeKeywords([
    ...input.jdRequiredSkills,
    ...input.jdPreferredSkills,
    ...input.jdMustHave,
    ...input.jdNiceToHave,
  ]).sort();

  const jdRespTokens = normalizeKeywords(
    input.jdResponsibilities.flatMap(r => r.split(/\s+/)).filter(Boolean)
  ).sort();

  const yearsStr = input.jdRequiredYears !== null ? String(input.jdRequiredYears) : "";

  const hashInput = [
    cvKeys.join(","),
    cvBulletTokens.join(","),
    jdKeys.join(","),
    jdRespTokens.join(","),
    yearsStr,
  ].join("|");

  return createHash("sha256").update(hashInput).digest("hex").slice(0, 16);
}

export function calculateMatchScore(input: ScoringInput): ScoringBreakdown {
  const cvPool = buildCvKeywordPool(input);

  const reqResult = scoreRequired(input, cvPool);
  const prefResult = scorePreferred(input, cvPool);
  const respResult = scoreResponsibilities(input);
  const senResult = scoreSeniority(input);
  const indResult = scoreIndustryComponent(input);

  const rawTotal =
    reqResult.rawScore +
    prefResult.rawScore +
    respResult.rawScore +
    senResult.rawScore +
    indResult.rawScore;

  const totalScore = Math.min(100, Math.max(0, Math.round(rawTotal)));
  const { scoreBand, scoreBandLabel, scoreBandDescription } = getScoreBand(totalScore);

  const allMatched = [...new Set([...reqResult.matchedItems, ...prefResult.matchedItems])];
  const allMissing = [...new Set([
    ...reqResult.missingItems,
    ...prefResult.missingItems.filter(m => !allMatched.includes(m)),
  ])];

  return {
    totalScore,
    scoreBand,
    scoreBandLabel,
    scoreBandDescription,
    requiredKeywords: {
      rawScore: reqResult.rawScore,
      maxScore: WEIGHTS.required,
      matched: reqResult.matched,
      total: reqResult.total,
    },
    preferredKeywords: {
      rawScore: prefResult.rawScore,
      maxScore: WEIGHTS.preferred,
      matched: prefResult.matched,
      total: prefResult.total,
    },
    responsibilities: respResult,
    seniority: senResult,
    industry: {
      rawScore: indResult.rawScore,
      maxScore: WEIGHTS.industry,
      matched: indResult.matched,
      total: indResult.total,
    },
    matchedKeywords: allMatched,
    missingKeywords: allMissing,
    detectedIndustry: indResult.detectedIndustry,
    inputHash: computeInputHash(input),
  };
}
