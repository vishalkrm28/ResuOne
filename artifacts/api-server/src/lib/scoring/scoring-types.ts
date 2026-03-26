export interface ScoringInput {
  cvSkills: string[];
  cvBullets: string[];
  cvTitles: string[];
  cvSummary: string;
  cvText: string;

  jdRequiredSkills: string[];
  jdPreferredSkills: string[];
  jdMustHave: string[];
  jdNiceToHave: string[];
  jdResponsibilities: string[];
  jdRequiredYears: number | null;
  jdText: string;
}

export interface ScoringComponentResult {
  rawScore: number;
  maxScore: number;
  matched: number;
  total: number;
}

export interface ScoringBreakdown {
  totalScore: number;
  scoreBand: "strong" | "moderate" | "low";
  scoreBandLabel: string;
  scoreBandDescription: string;

  requiredKeywords: ScoringComponentResult;
  preferredKeywords: ScoringComponentResult;
  responsibilities: ScoringComponentResult;
  seniority: ScoringComponentResult;
  industry: ScoringComponentResult;

  matchedKeywords: string[];
  missingKeywords: string[];
  detectedIndustry: string;
  inputHash: string;
}
