import { cn } from "@/lib/utils";

interface CoverLetterRendererProps {
  text: string;
  className?: string;
}

const SALUTATION_RE = /^dear\s/i;
const CLOSING_RE = /^(sincerely|regards|best regards|kind regards|yours truly|yours sincerely|warm regards|respectfully|thank you|with appreciation)[,.]?\s*$/i;

type LineKind = "blank" | "salutation" | "closing" | "signature" | "meta" | "paragraph";

interface ParsedLine {
  kind: LineKind;
  raw: string;
}

function classifyLines(raw: string): ParsedLine[] {
  const lines = raw.split("\n");
  const result: ParsedLine[] = [];
  let closingFound = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      result.push({ kind: "blank", raw: "" });
      continue;
    }
    if (SALUTATION_RE.test(trimmed)) {
      result.push({ kind: "salutation", raw: trimmed });
      continue;
    }
    if (CLOSING_RE.test(trimmed)) {
      closingFound = true;
      result.push({ kind: "closing", raw: trimmed });
      continue;
    }
    if (closingFound) {
      result.push({ kind: "signature", raw: trimmed });
      continue;
    }
    result.push({ kind: "paragraph", raw: trimmed });
  }

  return result;
}

export function CoverLetterRenderer({ text, className }: CoverLetterRendererProps) {
  if (!text?.trim()) return null;

  const lines = classifyLines(text);

  return (
    <div className={cn("font-serif text-[14px] leading-[1.85] text-foreground px-10 py-8 space-y-0", className)}>
      {lines.map((line, idx) => {
        if (line.kind === "blank") {
          return <div key={idx} className="h-4" />;
        }

        if (line.kind === "salutation") {
          return (
            <p key={idx} className="text-foreground font-medium not-italic mb-1">
              {line.raw}
            </p>
          );
        }

        if (line.kind === "closing") {
          return (
            <p key={idx} className="text-foreground mt-6">
              {line.raw}
            </p>
          );
        }

        if (line.kind === "signature") {
          return (
            <p key={idx} className="font-semibold text-foreground">
              {line.raw}
            </p>
          );
        }

        // regular paragraph
        return (
          <p key={idx} className="text-foreground/90">
            {line.raw}
          </p>
        );
      })}
    </div>
  );
}
