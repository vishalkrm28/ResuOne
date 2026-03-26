import { Lock, Crown } from "lucide-react";
import { Card, CardContent } from "@/components/Card";
import { BlurredLockedSection } from "./blurred-locked-section";
import { UpgradeCTACard } from "./upgrade-cta-card";

interface FreePreview {
  summaryPreview: string;
  firstBullet: string;
  lockedSectionsCount: number;
}

interface LockedPreviewCardProps {
  preview: FreePreview;
}

/**
 * Shown in the CV tab when a free user has run analysis but their full
 * tailored CV is gated server-side. Shows the summary snippet + first
 * bullet point as a teaser, then a blurred locked section + upgrade CTA.
 *
 * Security note: the full CV text is never sent by the server to free users.
 * This component only renders the preview data the server intentionally shared.
 */
export function LockedPreviewCard({ preview }: LockedPreviewCardProps) {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Card header */}
          <div className="bg-muted px-6 py-3 border-b border-border flex justify-between items-center rounded-t-2xl">
            <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              Tailored CV — Preview
            </span>
            <span className="text-xs text-violet-600 font-semibold bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <Crown className="w-3 h-3" aria-hidden="true" />
              Pro unlocks full resume
            </span>
          </div>

          {/* Visible preview content */}
          <div className="p-6 font-mono text-sm space-y-5">
            {/* Professional summary preview */}
            {preview.summaryPreview && (
              <section aria-label="Professional summary preview">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Professional Summary
                </p>
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                  {preview.summaryPreview}
                </p>
              </section>
            )}

            {/* First rewritten bullet */}
            {preview.firstBullet && (
              <section aria-label="Work experience — first highlight">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Work Experience — First Highlight
                </p>
                <p className="text-foreground leading-relaxed flex gap-2">
                  <span className="text-muted-foreground shrink-0" aria-hidden="true">•</span>
                  <span>{preview.firstBullet}</span>
                </p>
              </section>
            )}

            {/* Divider before locked section */}
            <div className="border-t border-dashed border-border" />

            {/* Blurred + locked section */}
            <BlurredLockedSection
              label={`${preview.lockedSectionsCount} section${preview.lockedSectionsCount !== 1 ? "s" : ""} locked`}
              lineCount={12}
            />
          </div>
        </CardContent>
      </Card>

      {/* Upgrade CTA — placed directly below the locked card */}
      <UpgradeCTACard
        headline="Unlock the full optimized resume"
        description="See the complete rewrite across all sections, then edit and export it."
        variant="cv"
        ctaLabel="Start 7-day Pro trial"
      />
    </div>
  );
}
