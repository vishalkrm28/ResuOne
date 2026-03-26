import type { ScoringBreakdown } from "./scoring-types.js";

export function getScoreBand(score: number): Pick<ScoringBreakdown, "scoreBand" | "scoreBandLabel" | "scoreBandDescription"> {
  if (score >= 80) {
    return {
      scoreBand: "strong",
      scoreBandLabel: "Strong Match",
      scoreBandDescription: "Strong keyword alignment with this role",
    };
  }
  if (score >= 60) {
    return {
      scoreBand: "moderate",
      scoreBandLabel: "Moderate Match",
      scoreBandDescription: "Moderate fit with some missing requirements",
    };
  }
  return {
    scoreBand: "low",
    scoreBandLabel: "Low Match",
    scoreBandDescription: "Low alignment — key requirements are missing",
  };
}
