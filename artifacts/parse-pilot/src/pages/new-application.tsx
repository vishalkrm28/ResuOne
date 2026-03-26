import { useState, useCallback } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useCreateApplication, useUploadCv } from "@workspace/api-client-react";
import type { ParsedCv } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import { useDropzone } from "react-dropzone";
import { useLocation } from "wouter";
import { UploadCloud, File, Loader2, Sparkles, AlertCircle, FileText, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const UPLOAD_ERROR_MESSAGES: Record<string, string> = {
  FILE_TOO_LARGE: "This file exceeds 10 MB. Please compress it or paste your CV text manually.",
  INVALID_FILE_TYPE: "Only PDF, DOCX, DOC, and TXT files are accepted.",
  EXTRACTION_FAILED: "Could not read text from this file. Try a different format or paste manually.",
  EMPTY_CONTENT: "The file appears to contain no readable text. Try a different file.",
  NO_FILE: "No file was received. Please try again.",
};

function uploadErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const body = (error as any)?.response?.data as { code?: string; error?: string } | undefined;
    if (body?.code && UPLOAD_ERROR_MESSAGES[body.code]) {
      return UPLOAD_ERROR_MESSAGES[body.code];
    }
    if (body?.error) return body.error;
    return error.message;
  }
  return "Upload failed. Please try again.";
}

export default function NewApplication() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const createMutation = useCreateApplication();
  const uploadMutation = useUploadCv();

  const [cvText, setCvText] = useState("");
  const [parsedCv, setParsedCv] = useState<ParsedCv | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setFileName(file.name);
      setParsedCv(null);

      try {
        const result = await uploadMutation.mutateAsync({ data: { file } });
        setCvText(result.extractedText);
        setParsedCv(result.parsedCv ?? null);

        const skillCount = result.parsedCv?.skills?.length ?? 0;
        const expCount = result.parsedCv?.work_experience?.length ?? 0;
        const description =
          result.parsedCv
            ? `Found ${expCount} role${expCount !== 1 ? "s" : ""} and ${skillCount} skill${skillCount !== 1 ? "s" : ""}.`
            : "Text extracted. CV structure could not be parsed — check the text below.";

        toast({
          title: "CV uploaded",
          description,
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: uploadErrorMessage(error),
        });
        setFileName(null);
      }
    },
    [uploadMutation, toast],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
      "text/plain": [".txt"],
    },
    maxFiles: 1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    if (!cvText.trim() || !jobTitle.trim() || !company.trim() || !jobDescription.trim()) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please provide a CV and fill in the job title, company, and description.",
      });
      return;
    }

    try {
      const app = await createMutation.mutateAsync({
        data: {
          userId: user.id,
          jobTitle,
          company,
          jobDescription,
          originalCvText: cvText,
          parsedCvJson: parsedCv ?? undefined,
        },
      });

      toast({
        title: "Application created",
        description: "Redirecting to the analysis dashboard…",
      });

      setLocation(`/applications/${app.id}`);
    } catch (error: unknown) {
      const body = (error as any)?.response?.data as { code?: string; error?: string } | undefined;
      if (body?.code === "PRO_REQUIRED") {
        toast({
          variant: "destructive",
          title: "Free plan limit reached",
          description: "Upgrade to Pro for unlimited applications. Visit Settings → Billing.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to save the application. Please try again.",
        });
      }
    }
  };

  const isUploading = uploadMutation.isPending;
  const isCreating = createMutation.isPending;

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          New Application
        </h1>
        <p className="mt-2 text-muted-foreground text-lg">
          Upload your CV and paste the job details to generate an ATS-optimized application.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: CV Upload */}
        <div className="space-y-6">
          <Card className="border-primary/10">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <File className="w-5 h-5 text-primary" />
                Your CV
              </h3>

              {/* Drop Zone */}
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 mb-6
                  ${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/50"}
                  ${isUploading ? "opacity-50 pointer-events-none" : ""}
                `}
              >
                <input {...getInputProps()} />

                {isUploading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <p className="text-sm font-medium">Extracting text and parsing structure…</p>
                    <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
                  </div>
                ) : fileName && parsedCv ? (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    </div>
                    <p className="font-semibold text-foreground">{fileName}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {parsedCv.work_experience.length} role{parsedCv.work_experience.length !== 1 ? "s" : ""} ·{" "}
                      {parsedCv.skills.length} skill{parsedCv.skills.length !== 1 ? "s" : ""} ·{" "}
                      {parsedCv.education.length} degree{parsedCv.education.length !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-primary mt-2 font-medium">Click or drag to replace</p>
                  </div>
                ) : fileName ? (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                      <File className="w-6 h-6 text-amber-600" />
                    </div>
                    <p className="font-semibold text-foreground">{fileName}</p>
                    <p className="text-xs text-muted-foreground mt-1">Text extracted — review below</p>
                    <p className="text-xs text-primary mt-2 font-medium">Click or drag to replace</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <UploadCloud className="w-8 h-8 text-primary" />
                    </div>
                    <p className="font-semibold text-lg mb-1">Drop your CV here</p>
                    <p className="text-sm text-muted-foreground">PDF, DOCX, DOC or TXT · max 10 MB</p>
                  </div>
                )}
              </div>

              {/* Text area */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-foreground">
                    CV Text
                  </label>
                  {fileName && !isUploading && (
                    <span className="text-xs text-primary font-medium flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Auto-extracted
                    </span>
                  )}
                </div>
                <Textarea
                  placeholder="Paste your CV text here, or upload a file above…"
                  value={cvText}
                  onChange={(e) => {
                    setCvText(e.target.value);
                    if (!e.target.value) {
                      setFileName(null);
                      setParsedCv(null);
                    }
                  }}
                  className="h-64 font-mono text-xs leading-relaxed"
                />
                {cvText && (
                  <p className="text-xs text-muted-foreground text-right">
                    {cvText.length.toLocaleString()} characters
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Job Details */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-6">
              <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Job Details
              </h3>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Job Title</label>
                <Input
                  placeholder="e.g. Senior Frontend Engineer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Company Name</label>
                <Input
                  placeholder="e.g. Acme Corp"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Job Description
                  <span className="text-xs font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                    Critical for AI analysis
                  </span>
                </label>
                <Textarea
                  placeholder="Paste the full job description here. The AI will analyse your CV against these requirements for ATS compatibility."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="h-64"
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-lg gap-2 mt-4"
            disabled={isCreating || isUploading}
          >
            {isCreating ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Sparkles className="w-6 h-6" />
            )}
            {isCreating ? "Saving Application…" : "Create Application"}
          </Button>

          <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
            <AlertCircle className="w-3 h-3" />
            ParsePilot will only rewrite existing facts — it will never invent experience.
          </p>
        </div>
      </form>
    </AppLayout>
  );
}
