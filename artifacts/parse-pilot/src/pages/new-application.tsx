import { useState, useCallback } from "react";
import { useLocalAuth } from "@/hooks/use-local-auth";
import { useCreateApplication, useUploadCv } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import { useDropzone } from "react-dropzone";
import { useLocation } from "wouter";
import { UploadCloud, File, Loader2, Sparkles, AlertCircle, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function NewApplication() {
  const { userId } = useLocalAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const createMutation = useCreateApplication();
  const uploadMutation = useUploadCv();

  const [cvText, setCvText] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFileName(file.name);
    
    try {
      const result = await uploadMutation.mutateAsync({ data: { file } });
      setCvText(result.extractedText);
      toast({
        title: "File uploaded successfully",
        description: "CV text extracted. You can review it below.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Could not extract text from this file.",
      });
      setFileName(null);
    }
  }, [uploadMutation, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    if (!cvText.trim() || !jobTitle.trim() || !company.trim() || !jobDescription.trim()) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please fill in all fields and provide a CV.",
      });
      return;
    }

    try {
      const app = await createMutation.mutateAsync({
        data: {
          userId,
          jobTitle,
          company,
          jobDescription,
          originalCvText: cvText,
        }
      });
      
      toast({
        title: "Application Created",
        description: "Redirecting to analysis dashboard...",
      });
      
      setLocation(`/applications/${app.id}`);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create application.",
      });
    }
  };

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          New Application
        </h1>
        <p className="mt-2 text-muted-foreground text-lg">
          Upload your CV and the job details to generate an ATS-optimized application.
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
              
              <div 
                {...getRootProps()} 
                className={`
                  border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 mb-6
                  ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-secondary/50'}
                  ${uploadMutation.isPending ? 'opacity-50 pointer-events-none' : ''}
                `}
              >
                <input {...getInputProps()} />
                {uploadMutation.isPending ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <p className="text-sm font-medium text-muted-foreground">Extracting text from CV...</p>
                  </div>
                ) : fileName ? (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                      <File className="w-6 h-6 text-emerald-600" />
                    </div>
                    <p className="font-semibold text-foreground">{fileName}</p>
                    <p className="text-sm text-muted-foreground mt-1">Click or drag to replace</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <UploadCloud className="w-8 h-8 text-primary" />
                    </div>
                    <p className="font-semibold text-lg mb-1">Drop your CV here</p>
                    <p className="text-sm text-muted-foreground">Supports PDF and DOCX</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-foreground">Extracted Text / Manual Paste</label>
                  {fileName && <span className="text-xs text-primary font-medium flex items-center gap-1"><Sparkles className="w-3 h-3"/> Auto-extracted</span>}
                </div>
                <Textarea 
                  placeholder="Paste your CV text here manually if you prefer..."
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  className="h-64 font-mono text-xs leading-relaxed"
                />
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
                <label className="text-sm font-semibold text-foreground">Target Role / Job Title</label>
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
                  <span className="text-xs font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">Critical for AI Analysis</span>
                </label>
                <Textarea 
                  placeholder="Paste the full job description here. The AI will analyze your CV against these requirements to ensure ATS compatibility."
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
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Sparkles className="w-6 h-6" />
            )}
            {createMutation.isPending ? "Creating Application..." : "Create & Analyze Application"}
          </Button>

          <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
            <AlertCircle className="w-3 h-3" />
            ParsePilot will only rewrite existing facts. It will never invent experience.
          </p>
        </div>
      </form>
    </AppLayout>
  );
}
