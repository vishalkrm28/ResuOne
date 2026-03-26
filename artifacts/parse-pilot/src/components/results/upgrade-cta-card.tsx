import { Sparkles, FileDown, PenTool, BarChart3, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { UpgradeButton } from "@/components/billing/upgrade-button";

interface UpgradeCTACardProps {
  headline?: string;
  description?: string;
  /** Which bullet point list to show */
  variant?: "cv" | "export" | "cover" | "full";
  className?: string;
  ctaLabel?: string;
}

const BULLETS: Record<NonNullable<UpgradeCTACardProps["variant"]>, { icon: React.ElementType; text: string }[]> = {
  cv: [
    { icon: FileText, text: "View and edit the full optimized resume" },
    { icon: BarChart3, text: "See all rewritten bullets and sections" },
    { icon: FileDown, text: "Export to DOCX and PDF instantly" },
  ],
  export: [
    { icon: FileDown, text: "Download tailored CV as DOCX or PDF" },
    { icon: PenTool, text: "Generate and export a matching cover letter" },
    { icon: FileText, text: "Print-ready formatting included" },
  ],
  cover: [
    { icon: PenTool, text: "Generate a personalized cover letter" },
    { icon: Sparkles, text: "Matches tone to your tailored resume" },
    { icon: FileDown, text: "Export cover letter as DOCX or PDF" },
  ],
  full: [
    { icon: FileText, text: "Full optimized resume — all sections" },
    { icon: PenTool, text: "Cover letter generation and export" },
    { icon: FileDown, text: "DOCX and PDF export" },
    { icon: BarChart3, text: "Advanced keyword insights" },
  ],
};

export function UpgradeCTACard({
  headline = "Unlock the full optimized resume",
  description,
  variant = "cv",
  ctaLabel = "Start 7-day Pro trial",
  className,
}: UpgradeCTACardProps) {
  const bullets = BULLETS[variant];

  return (
    <div
      className={cn(
        "rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/70 to-indigo-50/70 p-6 flex flex-col gap-5",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 border border-violet-200/60 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h4 className="font-semibold text-base text-foreground leading-snug">{headline}</h4>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>
      </div>

      <ul className="space-y-2">
        {bullets.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2.5 text-sm text-foreground/80">
            <Icon className="w-3.5 h-3.5 text-violet-500 shrink-0" />
            {text}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1.5">
        <UpgradeButton label={ctaLabel} className="w-full h-10" />
        <p className="text-center text-[11px] text-muted-foreground">
          No card charged for 7 days · Cancel anytime
        </p>
      </div>
    </div>
  );
}
