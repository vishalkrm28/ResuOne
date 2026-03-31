import { SeoLayout, CtaButton, FaqSection, RelatedPages } from "@/components/layout/seo-layout";
import { BarChart3, Target, AlertCircle } from "lucide-react";

const faqs = [
  { q: "What is a good CV match score?", a: "A score of 70–80% or higher significantly improves your chances of passing ATS filters and reaching a human reviewer. Anything below 60% usually means critical keywords or sections are missing." },
  { q: "How is the match score calculated?", a: "ParsePilot compares your CV against the job description using keyword frequency, skill alignment, and section relevance — the same signals ATS systems use to rank candidates." },
  { q: "Can I improve my score?", a: "Yes. ParsePilot shows exactly which keywords are missing and rewrites your CV to include them naturally, without inventing experience you don't have." },
  { q: "Is it free to check my score?", a: "Yes — your match score and missing keyword list are shown for free. The full optimised CV output requires a one-time $6.99 unlock or a Pro subscription." },
];

export default function CvMatchScore() {
  return (
    <SeoLayout
      title="CV Match Score Tool – Check Your Resume Instantly | ParsePilot"
      description="Check your CV match score against any job description instantly. ParsePilot analyses your resume, finds missing keywords, and shows your ATS compatibility score."
    >
      {/* Hero */}
      <section className="pt-20 pb-16 px-6 text-center bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <BarChart3 className="w-3.5 h-3.5" /> Free Match Score
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-5 leading-tight">
            Check Your CV Match Score Instantly
          </h1>
          <p className="text-lg text-muted-foreground mb-4 leading-relaxed">
            Most resumes get rejected before a human sees them. Applicant Tracking Systems scan your CV for relevance — if it doesn't match the job description, it gets filtered out automatically.
          </p>
          <p className="text-base text-muted-foreground mb-10">
            ParsePilot analyses your CV and gives you a clear match score with exact reasons, so you know exactly what to fix.
          </p>
          <CtaButton label="Analyze your CV now" />
        </div>
      </section>

      {/* Sections */}
      <section className="py-16 max-w-4xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-muted/30 rounded-2xl p-6 border border-border/40">
            <BarChart3 className="w-8 h-8 text-primary mb-4" />
            <h2 className="text-lg font-bold mb-3">What is CV Match Score?</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              A CV match score measures how well your resume aligns with a specific job description. It's calculated by comparing keywords, skills, and experience sections against what the employer is looking for.
            </p>
          </div>
          <div className="bg-muted/30 rounded-2xl p-6 border border-border/40">
            <Target className="w-8 h-8 text-primary mb-4" />
            <h2 className="text-lg font-bold mb-3">Why It Matters</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Over 75% of applications are rejected by ATS before a recruiter reads them. A low match score means your CV is invisible — even if you're the ideal candidate for the role.
            </p>
          </div>
          <div className="bg-muted/30 rounded-2xl p-6 border border-border/40">
            <AlertCircle className="w-8 h-8 text-primary mb-4" />
            <h2 className="text-lg font-bold mb-3">Missing Skills Detection</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              ParsePilot identifies every keyword and skill phrase present in the job description but absent from your CV, ranked by importance so you know exactly what to address first.
            </p>
          </div>
        </div>
      </section>

      {/* Mid CTA */}
      <section className="py-12 bg-primary/5 border-y border-primary/10 text-center px-6">
        <p className="text-xl font-bold text-foreground mb-4">See your match score — free, in under 60 seconds</p>
        <CtaButton label="Analyze your CV now" />
      </section>

      {/* How it works */}
      <section className="py-16 max-w-3xl mx-auto px-6">
        <h2 className="text-2xl font-bold text-center mb-10">How ParsePilot Calculates Your Score</h2>
        <div className="space-y-6">
          {[
            { step: "1", title: "Upload your CV", desc: "Paste or upload your existing CV in any format." },
            { step: "2", title: "Paste the job description", desc: "Copy the full job posting — title, requirements, responsibilities." },
            { step: "3", title: "Get your match score", desc: "Receive a percentage score, missing keyword list, and an optimised CV draft." },
          ].map(s => (
            <div key={s.step} className="flex gap-4 items-start">
              <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center shrink-0">{s.step}</div>
              <div>
                <p className="font-semibold text-foreground mb-1">{s.title}</p>
                <p className="text-muted-foreground text-sm">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <FaqSection items={faqs} />

      {/* Bottom CTA */}
      <section className="py-16 text-center px-6">
        <h2 className="text-2xl font-bold mb-4">Ready to check your score?</h2>
        <p className="text-muted-foreground mb-8">Free to start. No credit card required.</p>
        <CtaButton label="Analyze your CV now" />
      </section>

      <RelatedPages current="/cv-match-score" />
    </SeoLayout>
  );
}
