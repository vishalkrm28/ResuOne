import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { listCoverLetters, type CoverLetterSummary } from "@/lib/application-api";
import { buildCoverLetterPrintHtml, openPrintWindow, downloadDocx } from "@/lib/pdf-export";
import {
  MailOpen,
  Sparkles,
  Loader2,
  Building2,
  Calendar,
  Copy,
  CheckCheck,
  FileText,
  Download,
} from "lucide-react";

const TONE_LABELS: Record<string, string> = {
  professional: "Professional",
  confident: "Confident",
  warm: "Warm",
  concise: "Concise",
};

const TONE_COLORS: Record<string, string> = {
  professional: "bg-blue-100 text-blue-800 border-blue-200",
  confident: "bg-purple-100 text-purple-800 border-purple-200",
  warm: "bg-orange-100 text-orange-800 border-orange-200",
  concise: "bg-gray-100 text-gray-800 border-gray-200",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <Button variant="outline" size="sm" onClick={copy}>
      {copied ? (
        <>
          <CheckCheck className="w-3.5 h-3.5 mr-1.5 text-green-600" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5 mr-1.5" />
          Copy
        </>
      )}
    </Button>
  );
}

function ExpandedLetter({ letter }: { letter: CoverLetterSummary }) {
  const { toast } = useToast();
  const [downloadingDocx, setDownloadingDocx] = useState(false);

  function handleExport() {
    const blob = new Blob([letter.coverLetterText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const label = [letter.jobTitle, letter.jobCompany].filter(Boolean).join(" @ ") || "cover-letter";
    a.download = `${label}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportPdf() {
    const html = buildCoverLetterPrintHtml(letter.coverLetterText, letter.jobTitle, letter.jobCompany);
    const label = [letter.jobTitle, letter.jobCompany].filter(Boolean).join("_") || "cover-letter";
    const safeName = label.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    openPrintWindow(html, `${safeName}.pdf`);
  }

  async function handleExportDocx() {
    setDownloadingDocx(true);
    try {
      const label = [letter.jobTitle, letter.jobCompany].filter(Boolean).join("_") || "cover-letter";
      const safeName = label.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      await downloadDocx(`/export/cover-letter/${letter.id}/docx`, `${safeName}.docx`);
      toast({ title: "Downloaded successfully" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Export failed", description: err?.message });
    } finally {
      setDownloadingDocx(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap mb-3 max-h-72 overflow-y-auto">
        {letter.coverLetterText}
      </div>
      <div className="flex gap-2 flex-wrap">
        <CopyButton text={letter.coverLetterText} />
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export .txt
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPdf}>
          <FileText className="w-3.5 h-3.5 mr-1.5" />
          Export PDF
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportDocx} disabled={downloadingDocx}>
          {downloadingDocx ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5 mr-1.5" />
          )}
          Export .docx
        </Button>
        {letter.tailoredCvId && (
          <Link href={`/application/tailored-cvs/${letter.tailoredCvId}?action=cover-letter`}>
            <Button variant="ghost" size="sm">
              Regenerate
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        <MailOpen className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No cover letters yet</h2>
      <p className="text-muted-foreground text-sm max-w-sm mb-6">
        Open a tailored CV and click <em>Cover Letter</em> to generate your first one. Or go to{" "}
        <strong>Find Jobs</strong> to create a tailored CV first.
      </p>
      <div className="flex gap-3">
        <Link href="/application/tailored-cvs">
          <Button variant="outline">
            <FileText className="w-4 h-4 mr-2" />
            My Tailored CVs
          </Button>
        </Link>
        <Link href="/jobs/recommendations">
          <Button>
            <Sparkles className="w-4 h-4 mr-2" />
            Find Jobs
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function CoverLettersPage() {
  const { toast } = useToast();
  const [letters, setLetters] = useState<CoverLetterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    listCoverLetters()
      .then(setLetters)
      .catch(() => toast({ variant: "destructive", title: "Failed to load cover letters" }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MailOpen className="w-6 h-6 text-primary" />
              Cover Letters
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              AI-generated cover letters tailored for specific roles
            </p>
          </div>
          <Link href="/application/tailored-cvs">
            <Button variant="outline" size="sm">
              <FileText className="w-4 h-4 mr-2" />
              Tailored CVs
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : letters.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {letters.map((letter) => {
              const isExpanded = expandedId === letter.id;
              const snippet = letter.coverLetterText.slice(0, 180).trim();

              return (
                <Card key={letter.id} className="border border-border hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <h3 className="font-semibold text-base">
                            {letter.jobTitle
                              ? `Cover Letter${letter.jobCompany ? ` for ${letter.jobCompany}` : ""}`
                              : "Cover Letter"}
                          </h3>
                          <Badge
                            variant="outline"
                            className={`text-xs ${TONE_COLORS[letter.tone] ?? TONE_COLORS.professional}`}
                          >
                            {TONE_LABELS[letter.tone] ?? letter.tone}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap mb-2">
                          {letter.jobCompany && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {letter.jobCompany}
                            </span>
                          )}
                          {letter.jobTitle && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {letter.jobTitle}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(letter.createdAt).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        {!isExpanded && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {snippet}
                            {letter.coverLetterText.length > 180 && "…"}
                          </p>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedId(isExpanded ? null : letter.id)}
                        className="shrink-0"
                      >
                        {isExpanded ? "Collapse" : "Open"}
                      </Button>
                    </div>

                    {isExpanded && <ExpandedLetter letter={letter} />}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
