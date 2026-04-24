import { cn } from "@/lib/utils";
import { DollarSign, Home, ShieldCheck, Languages, PackageOpen } from "lucide-react";

interface BreakdownRow {
  label: string;
  icon: React.ReactNode;
  score: number;
  max: number;
  description: string;
}

interface Props {
  salaryScore: number;
  costOfLivingScore: number;
  visaScore: number;
  languageScore: number;
  relocationSupportScore: number;
  relocationScore: number;
  className?: string;
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.round((score / max) * 100);
  const color =
    pct >= 80 ? "bg-emerald-500" :
    pct >= 55 ? "bg-sky-500" :
    pct >= 35 ? "bg-amber-400" :
    "bg-red-400";
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium w-10 text-right text-foreground">
        {score}/{max}
      </span>
    </div>
  );
}

export function RelocationBreakdown({
  salaryScore, costOfLivingScore, visaScore, languageScore,
  relocationSupportScore, relocationScore, className,
}: Props) {
  const rows: BreakdownRow[] = [
    {
      label: "Salary",
      icon: <DollarSign className="w-3.5 h-3.5 text-emerald-600" />,
      score: salaryScore,
      max: 25,
      description: "Based on salary signal vs market benchmark",
    },
    {
      label: "Cost of living",
      icon: <Home className="w-3.5 h-3.5 text-sky-600" />,
      score: costOfLivingScore,
      max: 25,
      description: "Based on estimated monthly surplus",
    },
    {
      label: "Visa fit",
      icon: <ShieldCheck className="w-3.5 h-3.5 text-violet-600" />,
      score: visaScore,
      max: 20,
      description: "Based on sponsorship signal and your preferences",
    },
    {
      label: "Language fit",
      icon: <Languages className="w-3.5 h-3.5 text-amber-600" />,
      score: languageScore,
      max: 20,
      description: "Based on job language requirements vs your profile",
    },
    {
      label: "Relocation support",
      icon: <PackageOpen className="w-3.5 h-3.5 text-rose-600" />,
      score: relocationSupportScore,
      max: 10,
      description: "Employer relocation support or remote option",
    },
  ];

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Score breakdown</p>
        <span className="text-sm font-bold text-foreground">{relocationScore}/100</span>
      </div>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2">
          <span className="flex items-center gap-1 w-36 text-xs text-muted-foreground">
            {row.icon}
            {row.label}
          </span>
          <ScoreBar score={row.score} max={row.max} />
        </div>
      ))}
    </div>
  );
}
