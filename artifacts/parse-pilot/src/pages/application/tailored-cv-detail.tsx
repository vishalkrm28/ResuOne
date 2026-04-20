import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  getTailoredCv,
  renameTailoredCv,
  generateCoverLetter,
  exportAssets,
  type TailoredCvDetail,
} from "@/lib/application-api";
import { buildCvPrintHtml, openPrintWindow, downloadDocx } from "@/lib/pdf-export";
import {
  FileText,
  User,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Globe,
  Loader2,
  ChevronLeft,
  Copy,
  Pencil,
  Download,
  MailOpen,
  CheckCheck,
  Tag,
  Briefcase,
  GraduationCap,
  Award,
  ArrowRight,
} from "lucide-react";

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <Button variant="outline" size="sm" onClick={copy}>
      {copied ? <CheckCheck className="w-3.5 h-3.5 mr-1.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
      {copied ? "Copied!" : label}
    </Button>
  );
}

function Section({ title, icon: Icon, children }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

export default function TailoredCvDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [cv, setCv] = useState<TailoredCvDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [generatingCoverLetter, setGeneratingCoverLetter] = useState(false);
  const [coverLetterTone, setCoverLetterTone] = useState("professional");
  const [showCoverLetterPanel, setShowCoverLetterPanel] = useState(false);
  const [generatedLetter, setGeneratedLetter] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);

  useEffect(() => {
    if (!id) return;
    getTailoredCv(id)
      .then((data) => {
        setCv(data);
        setNewName(data.versionName ?? "");
        // Auto-open cover letter panel if navigated with ?action=cover-letter
        if (window.location.search.includes("cover-letter")) {
          setShowCoverLetterPanel(true);
        }
      })
      .catch(() => toast({ variant: "destructive", title: "Failed to load tailored CV" }))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleRename() {
    if (!newName.trim() || !id) return;
    try {
      await renameTailoredCv(id, newName.trim());
      setCv((prev) => prev ? { ...prev, versionName: newName.trim() } : prev);
      setRenaming(false);
      toast({ title: "Renamed" });
    } catch {
      toast({ variant: "destructive", title: "Failed to rename" });
    }
  }

  async function handleGenerateCoverLetter() {
    if (!id) return;
    setGeneratingCoverLetter(true);
    try {
      const result = await generateCoverLetter({
        tailoredCvId: id,
        tone: coverLetterTone,
        jobTitle: cv?.jobTitle ?? undefined,
        jobCompany: cv?.jobCompany ?? undefined,
      });
      setGeneratedLetter(result.coverLetterText);
      toast({ title: "Cover letter generated!" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to generate cover letter", description: err?.message });
    } finally {
      setGeneratingCoverLetter(false);
    }
  }

  async function handleExport() {
    if (!id) return;
    setExporting(true);
    try {
      const payload = await exportAssets({ tailoredCvId: id });
      if (payload.tailored_cv_text) {
        const blob = new Blob([payload.tailored_cv_text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${cv?.versionName ?? "tailored-cv"}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Exported successfully" });
      }
    } catch {
      toast({ variant: "destructive", title: "Export failed" });
    } finally {
      setExporting(false);
    }
  }

  function handleExportPdf() {
    if (!cv) return;
    const html = buildCvPrintHtml(cv.tailoredCvJson, cv.versionName);
    const safeName = (cv.versionName ?? "tailored-cv").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    openPrintWindow(html, `${safeName}.pdf`);
  }

  async function handleExportDocx() {
    if (!id || !cv) return;
    setExportingDocx(true);
    try {
      const safeName = (cv.versionName ?? "tailored-cv").replace(/[^a-z0-9]/gi, "_").toLowerCase();
      await downloadDocx(`/export/tailored-cv/${id}/docx`, `${safeName}.docx`);
      toast({ title: "Downloaded successfully" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Export failed", description: err?.message });
    } finally {
      setExportingDocx(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!cv) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">Tailored CV not found.</p>
          <Link href="/application/tailored-cvs">
            <Button variant="link" className="mt-4">Back to list</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const tcv = cv.tailoredCvJson;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* ── Breadcrumb + Actions ── */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <Link href="/application/tailored-cvs">
              <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
                Tailored CVs
              </button>
            </Link>

            {renaming ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRename()}
                  className="h-8 text-lg font-bold"
                />
                <Button size="sm" onClick={handleRename}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button>
              </div>
            ) : (
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {cv.versionName ?? "Tailored CV"}
                <button onClick={() => setRenaming(true)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
              </h1>
            )}

            <div className="text-sm text-muted-foreground mt-0.5">
              {[cv.jobTitle, cv.jobCompany].filter(Boolean).join(" @ ")} ·{" "}
              {new Date(cv.createdAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-1.5" />
              )}
              Export .txt
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Export PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportDocx}
              disabled={exportingDocx}
            >
              {exportingDocx ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-1.5" />
              )}
              Export .docx
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCoverLetterPanel(!showCoverLetterPanel)}
            >
              <MailOpen className="w-3.5 h-3.5 mr-1.5" />
              Cover Letter
            </Button>
          </div>
        </div>

        {/* ── Cover Letter Panel ── */}
        {showCoverLetterPanel && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <MailOpen className="w-4 h-4 text-primary" />
                Generate Cover Letter
              </h3>
              {!generatedLetter ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <Select value={coverLetterTone} onValueChange={setCoverLetterTone}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="confident">Confident</SelectItem>
                      <SelectItem value="warm">Warm</SelectItem>
                      <SelectItem value="concise">Concise</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleGenerateCoverLetter} disabled={generatingCoverLetter}>
                    {generatingCoverLetter ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating…
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Generate
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="bg-background border border-border rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap mb-3 max-h-80 overflow-y-auto">
                    {generatedLetter}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <CopyButton text={generatedLetter} label="Copy letter" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setGeneratedLetter(null); }}
                    >
                      Regenerate
                    </Button>
                    <Link href="/application/cover-letters">
                      <Button variant="ghost" size="sm">
                        View all cover letters
                        <ChevronLeft className="w-3.5 h-3.5 ml-1 rotate-180" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── CV Preview ── */}
        <div className="space-y-5">
          {/* Contact Header */}
          <Card className="border border-border">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  {tcv.full_name && (
                    <h2 className="text-2xl font-bold">{tcv.full_name}</h2>
                  )}
                  {tcv.headline && (
                    <p className="text-primary font-medium mt-0.5">{tcv.headline}</p>
                  )}
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                    {tcv.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        {tcv.email}
                      </span>
                    )}
                    {tcv.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {tcv.phone}
                      </span>
                    )}
                    {tcv.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {tcv.location}
                      </span>
                    )}
                    {tcv.linkedin && (
                      <span className="flex items-center gap-1">
                        <Linkedin className="w-3.5 h-3.5" />
                        {tcv.linkedin}
                      </span>
                    )}
                    {tcv.portfolio && (
                      <span className="flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" />
                        {tcv.portfolio}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Professional Summary */}
          {tcv.professional_summary && (
            <Section title="Professional Summary" icon={User}>
              <div className="flex items-start gap-3">
                <p className="text-sm leading-relaxed flex-1">{tcv.professional_summary}</p>
                <CopyButton text={tcv.professional_summary} label="Copy" />
              </div>
            </Section>
          )}

          {/* Core Skills */}
          {tcv.core_skills.length > 0 && (
            <Section title="Core Skills" icon={Tag}>
              <div className="flex flex-wrap gap-2">
                {tcv.core_skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                ))}
              </div>
            </Section>
          )}

          {/* ATS Keywords */}
          {tcv.ats_keywords_added.length > 0 && (
            <Section title="ATS Keywords Emphasised" icon={Tag}>
              <div className="flex flex-wrap gap-2">
                {tcv.ats_keywords_added.map((kw) => (
                  <Badge key={kw} className="text-xs bg-primary/10 text-primary border-primary/20 border">{kw}</Badge>
                ))}
              </div>
            </Section>
          )}

          {/* Experience */}
          {tcv.tailored_experience.length > 0 && (
            <Section title="Professional Experience" icon={Briefcase}>
              <div className="space-y-5">
                {tcv.tailored_experience.map((role, i) => (
                  <div key={i} className="pb-5 border-b border-border last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-sm">{role.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {role.company}
                          {role.start_date && ` · ${role.start_date} – ${role.end_date ?? "Present"}`}
                        </p>
                      </div>
                      <CopyButton
                        text={role.bullets.map((b) => `• ${b}`).join("\n")}
                        label="Copy bullets"
                      />
                    </div>
                    <ul className="space-y-1.5">
                      {role.bullets.map((bullet, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-foreground/80">
                          <span className="text-primary mt-0.5 shrink-0">•</span>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Education */}
          {tcv.education.length > 0 && (
            <Section title="Education" icon={GraduationCap}>
              <div className="space-y-2">
                {tcv.education.map((edu, i) => (
                  <div key={i} className="text-sm">
                    <p className="font-medium">{edu.degree}</p>
                    <p className="text-muted-foreground">
                      {edu.institution}{edu.year ? ` · ${edu.year}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Certifications */}
          {tcv.certifications.length > 0 && (
            <Section title="Certifications" icon={Award}>
              <ul className="space-y-1">
                {tcv.certifications.map((cert, i) => (
                  <li key={i} className="text-sm text-foreground/80 flex items-center gap-1.5">
                    <span className="text-primary">✓</span>
                    {cert}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Tailoring notes (internal) */}
          {(tcv.tailoring_summary || tcv.notes?.tailoring_strategy) && (
            <Card className="border-dashed border-muted">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  Tailoring notes
                </p>
                {tcv.tailoring_summary && (
                  <p className="text-sm text-muted-foreground mb-2">{tcv.tailoring_summary}</p>
                )}
                {tcv.notes?.tailoring_strategy && (
                  <p className="text-xs text-muted-foreground italic">{tcv.notes.tailoring_strategy}</p>
                )}
                {tcv.notes?.risk_flags && tcv.notes.risk_flags.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-amber-600 mb-1">Risk flags</p>
                    {tcv.notes.risk_flags.map((flag, i) => (
                      <p key={i} className="text-xs text-amber-700">⚠ {flag}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
