import { useState } from "react";
import { useParams } from "wouter";
import { 
  useGetApplication, 
  useAnalyzeApplication, 
  useGenerateCoverLetter 
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Textarea } from "@/components/Textarea";
import { Input } from "@/components/Input";
import { 
  Loader2, Sparkles, CheckCircle2, XCircle, 
  Download, FileText, LayoutList, MessageSquareWarning, PenTool
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"cv" | "keywords" | "missing" | "cover">("cv");
  
  const { data: app, isLoading, refetch } = useGetApplication(id);
  const analyzeMutation = useAnalyzeApplication();
  const coverLetterMutation = useGenerateCoverLetter();

  const [missingAnswers, setMissingAnswers] = useState<Record<string, string>>({});
  const [coverTone, setCoverTone] = useState<"professional" | "enthusiastic" | "concise">("professional");

  const handleAnalyze = async (answers?: Record<string, string>) => {
    try {
      await analyzeMutation.mutateAsync({
        id,
        data: { confirmedAnswers: answers || {} }
      });
      toast({ title: "Analysis complete", description: "Your CV has been optimized." });
      refetch();
      if (answers) setActiveTab("cv");
    } catch (e) {
      toast({ variant: "destructive", title: "Analysis failed", description: "Please try again." });
    }
  };

  const handleGenerateCoverLetter = async () => {
    try {
      await coverLetterMutation.mutateAsync({
        id,
        data: { tone: coverTone }
      });
      toast({ title: "Cover letter generated", description: "Review and edit your new cover letter." });
      refetch();
    } catch (e) {
      toast({ variant: "destructive", title: "Generation failed", description: "Please try again." });
    }
  };

  if (isLoading || !app) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const needsAnalysis = app.status === "draft" || !app.tailoredCvText;

  const tabs = [
    { id: "cv", label: "Tailored CV", icon: FileText },
    { id: "keywords", label: "Keyword Analysis", icon: LayoutList },
    { 
      id: "missing", 
      label: "Missing Info", 
      icon: MessageSquareWarning, 
      count: app.missingInfoQuestions?.length || 0 
    },
    { id: "cover", label: "Cover Letter", icon: PenTool },
  ] as const;

  return (
    <AppLayout>
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              {app.jobTitle}
            </h1>
            <Badge variant={app.status as any} className="uppercase">{app.status}</Badge>
          </div>
          <p className="text-muted-foreground text-lg flex items-center gap-2">
            at <span className="font-semibold text-foreground">{app.company}</span>
          </p>
        </div>
        
        <div className="flex gap-3 w-full lg:w-auto">
          <Button 
            variant="outline" 
            className="flex-1 lg:flex-none gap-2 bg-card"
            onClick={() => window.open(`/api/export/application/${id}/docx`, '_blank')}
            disabled={needsAnalysis}
          >
            <Download className="w-4 h-4" />
            DOCX
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 lg:flex-none gap-2 bg-card"
            onClick={() => window.open(`/api/export/application/${id}/pdf`, '_blank')}
            disabled={needsAnalysis}
          >
            <Download className="w-4 h-4" />
            PDF
          </Button>
        </div>
      </div>

      <div className="flex space-x-1 border-b border-border mb-8 overflow-x-auto pb-[1px]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors whitespace-nowrap",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 bg-destructive text-destructive-foreground w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                  {tab.count}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="min-h-[500px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* TAB: CV */}
            {activeTab === "cv" && (
              needsAnalysis ? (
                <Card className="border-dashed border-2 bg-transparent text-center p-12">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Sparkles className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">AI Analysis Required</h3>
                  <p className="text-muted-foreground mb-8 max-w-md mx-auto text-lg">
                    Run the ATS optimization engine to reorganize and tailor your CV to the target job description.
                  </p>
                  <Button 
                    size="lg" 
                    onClick={() => handleAnalyze()}
                    disabled={analyzeMutation.isPending}
                    className="gap-2 h-14 px-8 text-lg"
                  >
                    {analyzeMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    {analyzeMutation.isPending ? "Analyzing & Rewriting..." : "Run AI Optimization"}
                  </Button>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="bg-muted px-6 py-3 border-b border-border flex justify-between items-center rounded-t-2xl">
                      <span className="text-sm font-semibold text-muted-foreground">Tailored Output</span>
                      <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(app.tailoredCvText!)}>
                        Copy
                      </Button>
                    </div>
                    <Textarea 
                      value={app.tailoredCvText || ""}
                      readOnly
                      className="min-h-[600px] border-0 rounded-none rounded-b-2xl focus-visible:ring-0 resize-none font-mono text-sm p-6"
                    />
                  </CardContent>
                </Card>
              )
            )}

            {/* TAB: KEYWORDS */}
            {activeTab === "keywords" && (
              !app.keywordMatchScore ? (
                 <div className="text-center py-20 text-muted-foreground">Run analysis first to see keyword matches.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="md:col-span-1 flex flex-col items-center justify-center p-8 text-center">
                    <div className="relative w-40 h-40 flex items-center justify-center mb-4">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-muted opacity-20" />
                        <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" 
                          strokeDasharray={440} 
                          strokeDashoffset={440 - (440 * app.keywordMatchScore) / 100}
                          className="text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)] transition-all duration-1000 ease-out" 
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-bold">{app.keywordMatchScore}%</span>
                        <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground mt-1">Match</span>
                      </div>
                    </div>
                    <h3 className="font-bold text-xl mb-2">ATS Compatibility</h3>
                    <p className="text-sm text-muted-foreground">
                      We've aligned your skills with the job description. Score above 80% is recommended.
                    </p>
                  </Card>
                  
                  <div className="md:col-span-2 space-y-6">
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          Matched Keywords
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {app.matchedKeywords.length > 0 ? app.matchedKeywords.map(kw => (
                            <span key={kw} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium">
                              {kw}
                            </span>
                          )) : <span className="text-sm text-muted-foreground">None found.</span>}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-6">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                          <XCircle className="w-5 h-5 text-destructive" />
                          Missing Keywords
                        </h3>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {app.missingKeywords.length > 0 ? app.missingKeywords.map(kw => (
                            <span key={kw} className="px-3 py-1.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm font-medium">
                              {kw}
                            </span>
                          )) : <span className="text-sm text-muted-foreground">Excellent! No major keywords missing.</span>}
                        </div>
                        {app.missingKeywords.length > 0 && (
                          <p className="text-sm text-muted-foreground bg-muted p-4 rounded-xl border border-border">
                            Consider answering the questions in the <strong>Missing Info</strong> tab to provide context around these keywords. ParsePilot AI will then weave them into your CV.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )
            )}

            {/* TAB: MISSING INFO */}
            {activeTab === "missing" && (
              !app.missingInfoQuestions || app.missingInfoQuestions.length === 0 ? (
                <Card className="text-center p-16">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2">No Missing Information</h3>
                  <p className="text-muted-foreground text-lg">Your CV already contains all the necessary context required by the job description.</p>
                </Card>
              ) : (
                <div className="max-w-3xl">
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold mb-2">Clarification Required</h3>
                    <p className="text-muted-foreground">
                      To safely add missing keywords without inventing facts, ParsePilot AI needs you to confirm your experience. Fill out any relevant fields below and re-run the analysis.
                    </p>
                  </div>
                  
                  <div className="space-y-6">
                    {app.missingInfoQuestions.map((q, idx) => (
                      <Card key={idx} className="border-l-4 border-l-accent overflow-hidden">
                        <CardContent className="p-6">
                          <label className="block text-base font-semibold text-foreground mb-3">
                            {q}
                          </label>
                          <Textarea 
                            placeholder="Provide details if you have this experience, otherwise leave blank..."
                            value={missingAnswers[q] || ""}
                            onChange={(e) => setMissingAnswers(prev => ({...prev, [q]: e.target.value}))}
                            className="min-h-[100px]"
                          />
                        </CardContent>
                      </Card>
                    ))}
                    
                    <Button 
                      size="lg" 
                      onClick={() => handleAnalyze(missingAnswers)}
                      disabled={analyzeMutation.isPending}
                      className="w-full h-14 text-lg"
                    >
                      {analyzeMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                      Re-Analyze with New Context
                    </Button>
                  </div>
                </div>
              )
            )}

            {/* TAB: COVER LETTER */}
            {activeTab === "cover" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                  <Card>
                    <CardContent className="p-6 space-y-6">
                      <div>
                        <h3 className="font-bold text-lg mb-2">Tone</h3>
                        <div className="space-y-2">
                          {["professional", "enthusiastic", "concise"].map(t => (
                            <label key={t} className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-secondary transition-colors">
                              <input 
                                type="radio" 
                                name="tone" 
                                checked={coverTone === t}
                                onChange={() => setCoverTone(t as any)}
                                className="w-4 h-4 text-primary focus:ring-primary"
                              />
                              <span className="capitalize font-medium text-sm">{t}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      
                      <Button 
                        className="w-full h-12" 
                        onClick={handleGenerateCoverLetter}
                        disabled={coverLetterMutation.isPending || !app.tailoredCvText}
                      >
                        {coverLetterMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <PenTool className="w-5 h-5 mr-2" />}
                        Generate Letter
                      </Button>
                      
                      {!app.tailoredCvText && (
                        <p className="text-xs text-destructive text-center font-medium">You must generate a Tailored CV first.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
                
                <div className="lg:col-span-2">
                  <Card className="h-full min-h-[500px] flex flex-col">
                    <div className="bg-muted px-6 py-3 border-b border-border flex justify-between items-center rounded-t-2xl">
                      <span className="text-sm font-semibold text-muted-foreground">Output Document</span>
                      {app.coverLetterText && (
                        <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(app.coverLetterText!)}>
                          Copy
                        </Button>
                      )}
                    </div>
                    {app.coverLetterText ? (
                       <Textarea 
                         value={app.coverLetterText}
                         readOnly
                         className="flex-1 border-0 rounded-none rounded-b-2xl focus-visible:ring-0 resize-none font-serif text-base p-8 leading-relaxed"
                       />
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
                        <PenTool className="w-12 h-12 mb-4 opacity-20" />
                        <p>Configure your preferences and click Generate to create a custom cover letter based on your optimized CV.</p>
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
