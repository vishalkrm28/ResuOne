import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RelocationScoreBadge, type RelocationRecommendation } from "./relocation-score-badge";
import { RelocationBreakdown } from "./relocation-breakdown";
import {
  Plane, DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, ChevronDown, ChevronUp, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AiSummary {
  summary: string;
  mainUpside: string;
  mainRisk: string;
  candidateAdvice: string;
  confidenceNote: string;
}

interface Props {
  relocationScore: number;
  relocationRecommendation: RelocationRecommendation;
  estimatedMonthlyGrossSalary?: number | null;
  estimatedMonthlyNetSalary?: number | null;
  estimatedMonthlyCost?: number | null;
  estimatedMonthlySurplus?: number | null;
  salaryScore: number;
  costOfLivingScore: number;
  visaScore: number;
  languageScore: number;
  relocationSupportScore: number;
  salaryQualitySignal?: string;
  costOfLivingSignal?: string;
  visaFit?: string;
  languageFit?: string;
  riskFlags?: string[];
  positiveFactors?: string[];
  aiSummary?: AiSummary | null;
  currency?: string;
  disclaimer?: string;
  className?: string;
}

function fmtCurrency(val: number | null | undefined, currency = "USD"): string {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(val);
}

function RiskFlag({ flag }: { flag: string }) {
  const labels: Record<string, string> = {
    salary_missing: "Salary not disclosed",
    salary_low: "Salary below benchmark",
    high_cost_of_living: "High cost of living",
    no_sponsorship_signal: "No sponsorship signal",
    sponsorship_unknown: "Sponsorship unclear",
    local_language_required: "Local language may be required",
    language_fit_poor: "Language fit concern",
    no_relocation_support: "No relocation support",
    work_authorization_unclear: "Work authorization unclear",
    tax_unknown: "Tax estimate unavailable",
    cost_data_low_confidence: "Cost data limited",
  };
  return (
    <span className="flex items-center gap-1 text-xs text-amber-700">
      <AlertTriangle className="w-3 h-3" />
      {labels[flag] ?? flag}
    </span>
  );
}

function PositiveFactor({ factor }: { factor: string }) {
  const labels: Record<string, string> = {
    salary_above_benchmark: "Salary above benchmark",
    affordable_city: "Affordable city",
    visa_friendly: "Visa-friendly role",
    english_friendly: "English-friendly workplace",
    relocation_support: "Relocation support offered",
    remote_option: "Remote-friendly",
    target_country_match: "Matches your target country",
    strong_candidate_match: "Strong candidate match",
  };
  return (
    <span className="flex items-center gap-1 text-xs text-emerald-700">
      <CheckCircle2 className="w-3 h-3" />
      {labels[factor] ?? factor}
    </span>
  );
}

export function RelocationInsightCard({
  relocationScore, relocationRecommendation,
  estimatedMonthlyGrossSalary, estimatedMonthlyNetSalary,
  estimatedMonthlyCost, estimatedMonthlySurplus,
  salaryScore, costOfLivingScore, visaScore, languageScore, relocationSupportScore,
  salaryQualitySignal, costOfLivingSignal, visaFit, languageFit,
  riskFlags = [], positiveFactors = [],
  aiSummary, currency = "USD", disclaimer, className,
}: Props) {
  const [showBreakdown, setShowBreakdown] = useState(true);
  const surplusColor = estimatedMonthlySurplus !== null && estimatedMonthlySurplus !== undefined
    ? (estimatedMonthlySurplus > 0 ? "text-emerald-600" : "text-red-600")
    : "text-muted-foreground";

  return (
    <Card className={cn("border-border", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plane className="w-4 h-4 text-sky-600" />
          Relocation intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score + badge */}
        <div className="flex items-center gap-3">
          <div className="text-3xl font-bold text-foreground">{relocationScore}</div>
          <div className="flex flex-col gap-1">
            <RelocationScoreBadge recommendation={relocationRecommendation} />
            <span className="text-xs text-muted-foreground">out of 100</span>
          </div>
        </div>

        {/* Financials grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-xs text-muted-foreground">Est. gross/mo</p>
            <p className="font-medium">{fmtCurrency(estimatedMonthlyGrossSalary, currency)}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-xs text-muted-foreground">Est. net/mo</p>
            <p className="font-medium">{fmtCurrency(estimatedMonthlyNetSalary, currency)}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-xs text-muted-foreground">Est. living cost/mo</p>
            <p className="font-medium">{fmtCurrency(estimatedMonthlyCost, currency)}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-xs text-muted-foreground">Est. surplus/mo</p>
            <p className={cn("font-semibold", surplusColor)}>
              {fmtCurrency(estimatedMonthlySurplus, currency)}
            </p>
          </div>
        </div>

        {/* Fit signals */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Fit signals</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Visa */}
            <div className={cn("rounded-md p-2 border",
              visaFit === "good" ? "bg-emerald-50 border-emerald-200" :
              visaFit === "risky" ? "bg-amber-50 border-amber-200" :
              visaFit === "unlikely" ? "bg-red-50 border-red-200" :
              "bg-slate-50 border-slate-200"
            )}>
              <p className="text-muted-foreground">Visa</p>
              <p className={cn("font-semibold capitalize",
                visaFit === "good" ? "text-emerald-700" :
                visaFit === "risky" ? "text-amber-700" :
                visaFit === "unlikely" ? "text-red-700" :
                "text-slate-500"
              )}>
                {visaFit === "good" ? "Favourable" :
                 visaFit === "risky" ? "Risky" :
                 visaFit === "unlikely" ? "Unlikely" :
                 "Unknown"}
              </p>
            </div>
            {/* Language */}
            <div className={cn("rounded-md p-2 border",
              languageFit === "excellent" || languageFit === "good" ? "bg-emerald-50 border-emerald-200" :
              languageFit === "partial" ? "bg-amber-50 border-amber-200" :
              languageFit === "poor" ? "bg-red-50 border-red-200" :
              "bg-slate-50 border-slate-200"
            )}>
              <p className="text-muted-foreground">Language</p>
              <p className={cn("font-semibold capitalize",
                languageFit === "excellent" || languageFit === "good" ? "text-emerald-700" :
                languageFit === "partial" ? "text-amber-700" :
                languageFit === "poor" ? "text-red-700" :
                "text-slate-500"
              )}>
                {languageFit === "excellent" ? "Excellent" :
                 languageFit === "good" ? "Good" :
                 languageFit === "partial" ? "Partial" :
                 languageFit === "poor" ? "Poor fit" :
                 "Unknown"}
              </p>
            </div>
            {/* Salary signal */}
            {salaryQualitySignal && (
              <div className={cn("rounded-md p-2 border",
                salaryQualitySignal === "above_benchmark" || salaryQualitySignal === "strong" ? "bg-emerald-50 border-emerald-200" :
                salaryQualitySignal === "below_benchmark" || salaryQualitySignal === "low" ? "bg-red-50 border-red-200" :
                "bg-slate-50 border-slate-200"
              )}>
                <p className="text-muted-foreground">Salary signal</p>
                <p className={cn("font-semibold capitalize",
                  salaryQualitySignal === "above_benchmark" || salaryQualitySignal === "strong" ? "text-emerald-700" :
                  salaryQualitySignal === "below_benchmark" || salaryQualitySignal === "low" ? "text-red-700" :
                  "text-slate-500"
                )}>
                  {salaryQualitySignal.replace(/_/g, " ")}
                </p>
              </div>
            )}
            {/* Cost of living signal */}
            {costOfLivingSignal && (
              <div className={cn("rounded-md p-2 border",
                costOfLivingSignal === "affordable" || costOfLivingSignal === "low" ? "bg-emerald-50 border-emerald-200" :
                costOfLivingSignal === "high" || costOfLivingSignal === "very_high" ? "bg-red-50 border-red-200" :
                "bg-slate-50 border-slate-200"
              )}>
                <p className="text-muted-foreground">Cost of living</p>
                <p className={cn("font-semibold capitalize",
                  costOfLivingSignal === "affordable" || costOfLivingSignal === "low" ? "text-emerald-700" :
                  costOfLivingSignal === "high" || costOfLivingSignal === "very_high" ? "text-red-700" :
                  "text-slate-500"
                )}>
                  {costOfLivingSignal.replace(/_/g, " ")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Positive factors */}
        {positiveFactors.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Positive signals</p>
            {positiveFactors.map((f) => <PositiveFactor key={f} factor={f} />)}
          </div>
        )}

        {/* Risk flags */}
        {riskFlags.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Risk flags</p>
            {riskFlags.map((f) => <RiskFlag key={f} flag={f} />)}
          </div>
        )}

        {/* AI summary */}
        {aiSummary && (
          <div className="rounded-md bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-sky-800 dark:text-sky-300">Relocation analysis</p>
            <p className="text-xs text-foreground">{aiSummary.summary}</p>
            {aiSummary.mainUpside && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                <span className="font-medium">Upside:</span> {aiSummary.mainUpside}
              </p>
            )}
            {aiSummary.mainRisk && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <span className="font-medium">Risk:</span> {aiSummary.mainRisk}
              </p>
            )}
            {aiSummary.candidateAdvice && (
              <p className="text-xs text-foreground border-t border-sky-200 dark:border-sky-800 pt-1.5 mt-1.5">
                {aiSummary.candidateAdvice}
              </p>
            )}
          </div>
        )}

        {/* Score breakdown toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground h-7"
          onClick={() => setShowBreakdown((v) => !v)}
        >
          {showBreakdown ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
          {showBreakdown ? "Hide" : "Show"} score breakdown
        </Button>

        {showBreakdown && (
          <RelocationBreakdown
            salaryScore={salaryScore}
            costOfLivingScore={costOfLivingScore}
            visaScore={visaScore}
            languageScore={languageScore}
            relocationSupportScore={relocationSupportScore}
            relocationScore={relocationScore}
          />
        )}

        {/* Disclaimer */}
        {disclaimer && (
          <p className="text-[10px] text-muted-foreground leading-relaxed border-t border-border pt-2">
            <Info className="w-2.5 h-2.5 inline mr-0.5" />
            {disclaimer}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
