import { Crown, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/Card";
import { BlurredLockedSection } from "./blurred-locked-section";
import { UpgradeButton } from "@/components/billing/upgrade-button";
import { UnlockButton } from "@/components/billing/unlock-button";

interface FreePreview {
  summaryPreview: string;
  firstBullet: string;
  lockedSectionsCount: number;
}

interface LockedPreviewCardProps {
  preview: FreePreview;
  applicationId: string;
}

const UNLOCK_INCLUDES = [
  "Full rewritten resume — every section",
  "Download as DOCX or PDF",
  "Copy and edit in-browser",
];

/**
 * Shown in the CV tab when a free user has run analysis.
 *
 * Design intent:
 *  - $4 one-time unlock is the PRIMARY action (no-commitment, instant)
 *  - Pro subscription is the SECONDARY action (better long-term value)
 *  - Both are honest about what they cost and what they include
 */
export function LockedPreviewCard({ preview, applicationId }: LockedPreviewCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* ── Card header ─────────────────────────────────────────── */}
        <div className="bg-muted px-6 py-3 border-b border-border flex justify-between items-center rounded-t-2xl">
          <span className="text-sm font-semibold text-foreground">
            Your optimized resume is ready
          </span>
          <span className="text-xs text-violet-600 font-semibold bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0">
            <Crown className="w-3 h-3" aria-hidden="true" />
            Full version locked
          </span>
        </div>

        {/* ── Visible preview content ──────────────────────────────── */}
        <div className="px-6 pt-5 pb-0 font-mono text-sm space-y-4">
          {preview.summaryPreview && (
            <section aria-label="Professional summary preview">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                Professional Summary
              </p>
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {preview.summaryPreview}
              </p>
            </section>
          )}

          {preview.firstBullet && (
            <section aria-label="Work experience — first rewritten bullet">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                Work Experience — First Rewritten Bullet
              </p>
              <p className="text-foreground leading-relaxed flex gap-2">
                <span className="text-muted-foreground shrink-0" aria-hidden="true">•</span>
                <span>{preview.firstBullet}</span>
              </p>
            </section>
          )}
        </div>

        {/* ── Blurred locked section + in-card CTA overlay ─────────── */}
        <div className="relative mt-4">
          <BlurredLockedSection
            lineCount={preview.lockedSectionsCount > 3 ? 14 : 10}
            lineWidths={["100%", "92%", "82%", "100%", "72%", "88%", "95%", "65%", "100%", "78%", "88%", "60%", "93%", "74%"]}
          />

          {/* Overlay — floats over the blurred section */}
          <div className="absolute inset-0 flex items-end justify-center pb-5 px-4">
            <div className="bg-card/96 backdrop-blur-sm border border-border shadow-2xl rounded-2xl overflow-hidden w-full max-w-sm">

              {/* ── Header ── */}
              <div className="px-5 pt-5 pb-4 text-center border-b border-border/60">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  {preview.lockedSectionsCount} section{preview.lockedSectionsCount !== 1 ? "s" : ""} rewritten &amp; waiting
                </p>
                <h4 className="text-[15px] font-bold text-foreground leading-snug">
                  Get the full resume,<br />tailored for this role
                </h4>
              </div>

              {/* ── Primary: one-time unlock ── */}
              <div className="px-5 py-4">
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-sm font-bold text-foreground">Unlock this result</span>
                  <span className="text-lg font-bold text-foreground">£6.99 <span className="text-xs font-normal text-muted-foreground">one-time</span></span>
                </div>

                <ul className="space-y-1.5 mb-4">
                  {UNLOCK_INCLUDES.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-[12px] text-foreground/80">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>

                <UnlockButton
                  applicationId={applicationId}
                  label="Unlock now — £6.99"
                  className="w-full h-10 text-sm font-semibold"
                />
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  No subscription · No recurring charge · Instant access
                </p>
              </div>

              {/* ── Secondary: Pro subscription ── */}
              <div className="px-5 pb-4 pt-3 border-t border-border/60 bg-muted/30">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-foreground">
                      ParsePilot Pro — £14.99/mo
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Your career, unlimited roles · Cover letters · Export DOCX &amp; PDF
                    </p>
                  </div>
                  <UpgradeButton
                    label="Go Pro →"
                    className="shrink-0 h-8 px-3 text-[11px]"
                  />
                </div>
                <p className="text-[9px] text-muted-foreground mt-1.5">
                  Cancel anytime · No long-term commitment
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* Extra bottom padding */}
        <div className="h-6" aria-hidden="true" />

        {/* Footer hint */}
        <div className="border-t border-border px-6 py-3 flex items-center justify-center gap-2 bg-muted/40 rounded-b-2xl">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">
            AI rewrote your CV to match this role — without changing any facts
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
