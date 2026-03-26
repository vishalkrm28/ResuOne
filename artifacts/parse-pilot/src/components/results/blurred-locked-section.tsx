import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlurredLockedSectionProps {
  /** Label shown in the lock badge at the top of the blurred area */
  label?: string;
  /** Number of fake placeholder lines to render */
  lineCount?: number;
  /** Line widths as percentage strings — cycles if fewer than lineCount */
  lineWidths?: string[];
  className?: string;
}

const DEFAULT_WIDTHS = ["100%", "88%", "74%", "92%", "60%", "83%", "70%", "95%", "78%", "64%"];

export function BlurredLockedSection({
  label = "Full content locked",
  lineCount = 10,
  lineWidths,
  className,
}: BlurredLockedSectionProps) {
  const widths = lineWidths ?? DEFAULT_WIDTHS;

  return (
    <div className={cn("relative rounded-xl overflow-hidden", className)}>
      {/* Visible lock label badge */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-card border border-violet-200 rounded-full px-3 py-1 shadow-sm">
        <Lock className="w-3 h-3 text-violet-500 shrink-0" />
        <span className="text-[11px] font-semibold text-violet-600 whitespace-nowrap">{label}</span>
      </div>

      {/* Blurred placeholder lines */}
      <div
        className="space-y-2.5 p-6 pt-10 blur-[6px] pointer-events-none select-none"
        aria-hidden="true"
      >
        {Array.from({ length: lineCount }).map((_, i) => (
          <div
            key={i}
            className="h-3 bg-muted-foreground/18 rounded-full"
            style={{ width: widths[i % widths.length] }}
          />
        ))}
      </div>

      {/* Gradient fade — stronger at bottom so blur blends into card */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background pointer-events-none" />
    </div>
  );
}
