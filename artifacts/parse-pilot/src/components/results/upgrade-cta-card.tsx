import { FileDown, PenTool, FileText, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { UpgradeButton } from "@/components/billing/upgrade-button";
import { UnlockButton } from "@/components/billing/unlock-button";

interface UpgradeCTACardProps {
  headline?: string;
  description?: string;
  /** Which outcome bullet list to show */
  variant?: "cv" | "export" | "cover" | "bottom";
  className?: string;
  ctaLabel?: string;
  /** Render as a dark gradient banner (for bottom-of-page placement) */
  dark?: boolean;
  /**
   * When provided, show a secondary $4 one-time unlock option below the Pro CTA.
   * Only renders in dark mode (bottom banner).
   */
  applicationId?: string;
}

const BULLETS: Record<NonNullable<UpgradeCTACardProps["variant"]>, { icon: React.ElementType; text: string }[]> = {
  cv: [
    { icon: FileText, text: "The full rewrite — every section, every bullet" },
    { icon: FileDown, text: "One-click export to DOCX or PDF" },
    { icon: PenTool, text: "A matching cover letter, generated in seconds" },
  ],
  export: [
    { icon: FileDown, text: "Tailored CV as DOCX or PDF — print-ready" },
    { icon: PenTool, text: "Matching cover letter export included" },
    { icon: FileText, text: "All formatting handled automatically" },
  ],
  cover: [
    { icon: PenTool, text: "A cover letter written around your tailored CV" },
    { icon: FileText, text: "Three tone options — professional, enthusiastic, concise" },
    { icon: FileDown, text: "Export as DOCX or PDF in one click" },
  ],
  bottom: [
    { icon: FileText, text: "The complete tailored resume, ready to copy" },
    { icon: FileDown, text: "DOCX and PDF export" },
    { icon: PenTool, text: "Cover letter generation" },
  ],
};

export function UpgradeCTACard({
  headline = "See the complete rewrite",
  description,
  variant = "cv",
  ctaLabel = "Get Pro — $12/mo",
  dark = false,
  applicationId,
  className,
}: UpgradeCTACardProps) {
  const bullets = BULLETS[variant];

  if (dark) {
    return (
      <div
        className={cn(
          "rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-8 flex flex-col items-center text-center gap-5",
          className,
        )}
      >
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white">{headline}</h3>
          {description && (
            <p className="text-sm text-white/75 max-w-sm mx-auto leading-relaxed">{description}</p>
          )}
        </div>
        <ul className="flex flex-col sm:flex-row gap-x-8 gap-y-2 items-center">
          {bullets.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2 text-sm text-white/85">
              <Icon className="w-3.5 h-3.5 text-white/60 shrink-0" />
              {text}
            </li>
          ))}
        </ul>
        <div className="flex flex-col items-center gap-1.5">
          <UpgradeButton
            label={ctaLabel}
            className="h-12 px-8 text-sm font-semibold bg-white text-violet-700 hover:bg-white/90 border-0 shadow-lg"
          />
          <p className="text-[11px] text-white/55">Cancel anytime · No long-term commitment</p>
        </div>

        {/* One-time unlock option — shown when applicationId is provided */}
        {applicationId && (
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-white/20 w-full">
            <p className="text-[11px] text-white/60">
              Just need this one result? No subscription required.
            </p>
            <UnlockButton
              applicationId={applicationId}
              label="Unlock this result for $4"
              className="h-9 px-5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/25 shadow-none"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/80 to-indigo-50/60 p-5 flex flex-col gap-4",
        className,
      )}
    >
      <div>
        <h4 className="font-semibold text-[15px] text-foreground leading-snug flex items-center gap-1.5">
          {headline}
          <ArrowRight className="w-4 h-4 text-violet-500 shrink-0" />
        </h4>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
        )}
      </div>

      <ul className="space-y-1.5">
        {bullets.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2.5 text-sm text-foreground/75">
            <Icon className="w-3.5 h-3.5 text-violet-500 shrink-0" />
            {text}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1">
        <UpgradeButton label={ctaLabel} className="w-full h-11 text-sm" />
        <p className="text-center text-[11px] text-muted-foreground">
          Cancel anytime · No long-term commitment
        </p>
      </div>
    </div>
  );
}
