import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, AlertTriangle, HelpCircle, Plane } from "lucide-react";
import { cn } from "@/lib/utils";

export type RelocationRecommendation =
  | "strong_move"
  | "possible_move"
  | "risky_move"
  | "not_recommended"
  | "unknown";

interface Props {
  recommendation: RelocationRecommendation;
  score?: number;
  className?: string;
}

interface BadgeMeta {
  label: string;
  icon: React.ReactNode;
  className: string;
  description: string;
}

const BADGE_META: Record<RelocationRecommendation, BadgeMeta> = {
  strong_move: {
    label: "Strong move",
    icon: <TrendingUp className="w-3 h-3" />,
    className: "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100",
    description: "Strong relocation candidate — salary, cost of living, and fit signals all look favourable.",
  },
  possible_move: {
    label: "Possible move",
    icon: <Plane className="w-3 h-3" />,
    className: "bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100",
    description: "Viable relocation opportunity — some positive signals but worth verifying details.",
  },
  risky_move: {
    label: "Risky move",
    icon: <AlertTriangle className="w-3 h-3" />,
    className: "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100",
    description: "Relocation carries notable risk — review salary, visa, and cost-of-living carefully.",
  },
  not_recommended: {
    label: "Not recommended",
    icon: <TrendingDown className="w-3 h-3" />,
    className: "bg-red-50 text-red-700 border-red-300 hover:bg-red-100",
    description: "Current data suggests this move may not be financially or practically viable.",
  },
  unknown: {
    label: "Relocation unclear",
    icon: <HelpCircle className="w-3 h-3" />,
    className: "bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100",
    description: "Insufficient data to assess relocation viability — try adding more profile details.",
  },
};

export function RelocationScoreBadge({ recommendation, score, className }: Props) {
  const meta = BADGE_META[recommendation] ?? BADGE_META.unknown;
  const tooltip = score !== undefined
    ? `${meta.description} (Score: ${score}/100)`
    : meta.description;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn("flex items-center gap-1 cursor-default text-xs font-medium", meta.className, className)}
          >
            {meta.icon}
            {meta.label}
            {score !== undefined && (
              <span className="ml-0.5 opacity-70 text-[10px]">{score}</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs bg-white text-gray-800 border border-gray-200 shadow-lg">
          {tooltip}
          <p className="mt-1 text-gray-500 text-[10px]">Estimate only — not financial advice.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
