export function recommendationWeight(value: string | null | undefined): number {
  if (value === "strong_yes") return 4;
  if (value === "yes") return 3;
  if (value === "maybe") return 2;
  return 1;
}

export function scoreToRecommendation(score: number): string {
  if (score >= 80) return "strong_yes";
  if (score >= 65) return "yes";
  if (score >= 50) return "maybe";
  return "no";
}

export function rankCandidates(matches: any[]): any[] {
  return matches
    .sort((a, b) => {
      if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
      const recDiff = recommendationWeight(b.interviewRecommendation) - recommendationWeight(a.interviewRecommendation);
      if (recDiff !== 0) return recDiff;
      return (a.missingSkills?.length || 0) - (b.missingSkills?.length || 0);
    })
    .map((item, index) => ({ ...item, rankPosition: index + 1 }));
}
