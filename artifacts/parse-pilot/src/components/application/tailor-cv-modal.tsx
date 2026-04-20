import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { tailorCv, generateCoverLetter } from "@/lib/application-api";
import { Loader2, Sparkles, X, FileText, MailOpen } from "lucide-react";

interface Application {
  id: string;
  jobTitle: string;
  company: string;
}

interface Props {
  applications: Application[];
  jobTitle?: string;
  jobCompany?: string;
  externalJobCacheId?: string;
  jobText?: string;
  defaultApplicationId?: string;
  onClose: () => void;
}

type Mode = "tailor" | "cover-letter";

export function TailorCvModal({
  applications,
  jobTitle,
  jobCompany,
  externalJobCacheId,
  jobText,
  defaultApplicationId,
  onClose,
}: Props) {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [mode, setMode] = useState<Mode>("tailor");
  const [selectedAppId, setSelectedAppId] = useState<string>(
    defaultApplicationId ?? applications[0]?.id ?? "",
  );
  const [versionName, setVersionName] = useState(
    jobTitle && jobCompany
      ? `Tailored for ${jobTitle} @ ${jobCompany}`
      : jobTitle
      ? `Tailored for ${jobTitle}`
      : "",
  );
  const [tone, setTone] = useState("professional");
  const [loading, setLoading] = useState(false);

  async function handleTailorCv() {
    setLoading(true);
    try {
      const result = await tailorCv({
        sourceApplicationId: selectedAppId || undefined,
        externalJobCacheId,
        jobText,
        jobTitle,
        jobCompany,
        versionName: versionName.trim() || undefined,
      });
      toast({ title: "CV tailored!", description: result.versionName ?? "" });
      onClose();
      navigate(`/application/tailored-cvs/${result.id}`);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to tailor CV",
        description: err?.message ?? "Please try again",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCoverLetter() {
    setLoading(true);
    try {
      const result = await generateCoverLetter({
        sourceApplicationId: selectedAppId || undefined,
        externalJobCacheId,
        jobText,
        jobTitle,
        jobCompany,
        tone,
      });
      toast({ title: "Cover letter generated!" });
      onClose();
      navigate(`/application/cover-letters`);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to generate cover letter",
        description: err?.message ?? "Please try again",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-bold text-lg">Application Assistant</h2>
            {(jobTitle || jobCompany) && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {[jobTitle, jobCompany].filter(Boolean).join(" @ ")}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 p-4 pb-0">
          <button
            onClick={() => setMode("tailor")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
              mode === "tailor"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <FileText className="w-4 h-4" />
            Tailor CV
          </button>
          <button
            onClick={() => setMode("cover-letter")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
              mode === "cover-letter"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <MailOpen className="w-4 h-4" />
            Cover Letter
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* CV selector */}
          {applications.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Source CV</label>
              <Select value={selectedAppId} onValueChange={setSelectedAppId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a CV…" />
                </SelectTrigger>
                <SelectContent>
                  {applications.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.jobTitle} @ {a.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                We'll use the parsed CV from this application.
              </p>
            </div>
          )}

          {/* Tailor CV: version name */}
          {mode === "tailor" && (
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Version name <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                placeholder="e.g. Tailored for Product Manager @ Spotify"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
              />
            </div>
          )}

          {/* Cover letter: tone */}
          {mode === "cover-letter" && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Tone</label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="confident">Confident</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="concise">Concise (shortest)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {applications.length === 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No analysed CVs found. Please analyse a CV first to use this feature.
            </p>
          )}

          {/* Info */}
          {mode === "tailor" && (
            <p className="text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-2">
              Uses 1 AI credit. Tailoring rewrites and reframes your experience — it never invents information.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={loading}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={mode === "tailor" ? handleTailorCv : handleCoverLetter}
            disabled={loading || applications.length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {mode === "tailor" ? "Tailoring…" : "Generating…"}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {mode === "tailor" ? "Tailor My CV" : "Generate Letter"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
