import { SeoLayout, CtaButton, FaqSection, RelatedPages } from "@/components/layout/seo-layout";
import { FileText, BarChart3, PenLine } from "lucide-react";

const faqs = [
  { q: "Why should I tailor my resume for every job?", a: "Tailored resumes get 3× more interviews. Generic CVs score low in ATS and feel impersonal to recruiters. Matching your CV to the job description is the single highest-impact thing you can do." },
  { q: "How long does it take to compare with ParsePilot?", a: "Under 60 seconds. Upload your CV, paste the job description, and you'll see your match score, gaps, and an optimised draft immediately." },
  { q: "Will ParsePilot change my actual experience?", a: "No. It only reframes how your existing experience is described, using the language of the job description. No invented roles or skills — ever." },
  { q: "Can I use it for multiple jobs?", a: "Yes. Each analysis is tied to one job description. Pro subscribers get 100 analyses per month to apply broadly." },
];

export default function ResumeJobMatch() {
  return (
    <SeoLayout
      title="Compare Resume with Job Description – Resume vs Job Match | ParsePilot"
      description="Compare your resume against any job description instantly. ParsePilot shows your match score, missing skills, and rewrites your CV to close the gap. Free to try."
    >
      {/* Hero */}
      <section className="pt-20 pb-16 px-6 text-center bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <FileText className="w-3.5 h-3.5" /> Resume vs Job Description
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-5 leading-tight">
            Compare Your Resume with Any Job
          </h1>
          <p className="text-lg text-muted-foreground mb-4 leading-relaxed">
            Most candidates send the same generic resume to every application. That's why 80% of applications fail — not because the candidate is underqualified, but because the resume doesn't speak the employer's language.
          </p>
          <p className="text-base text-muted-foreground mb-10">
            ParsePilot shows the exact gaps between your resume and any job description, then closes them automatically.
          </p>
          <CtaButton label="Compare now" />
        </div>
      </section>

      {/* Feature sections */}
      <section className="py-16 max-w-4xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-muted/30 rounded-2xl p-6 border border-border/40">
            <BarChart3 className="w-8 h-8 text-primary mb-4" />
            <h2 className="text-lg font-bold mb-3">Match Score</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Get a percentage score showing how closely your current CV aligns with the job description — the same way ATS systems would rank you against other applicants.
            </p>
          </div>
          <div className="bg-muted/30 rounded-2xl p-6 border border-border/40">
            <FileText className="w-8 h-8 text-primary mb-4" />
            <h2 className="text-lg font-bold mb-3">Missing Skills</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              See every skill, tool, and phrase in the job description that your resume doesn't include — ranked by importance so you know what's costing you the most.
            </p>
          </div>
          <div className="bg-muted/30 rounded-2xl p-6 border border-border/40">
            <PenLine className="w-8 h-8 text-primary mb-4" />
            <h2 className="text-lg font-bold mb-3">Why Tailoring Matters</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              A tailored CV that matches 80%+ of the job description is 3× more likely to get an interview. ParsePilot does the tailoring for you in under a minute.
            </p>
          </div>
        </div>
      </section>

      {/* Side-by-side visual */}
      <section className="py-12 px-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-10">Before vs After ParsePilot</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-red-200 dark:border-red-800 rounded-2xl p-6 bg-red-50/50 dark:bg-red-900/10">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3">❌ Generic Resume</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Match score: 38%</li>
              <li>• 24 missing keywords</li>
              <li>• Filtered out by ATS</li>
              <li>• Never seen by recruiter</li>
            </ul>
          </div>
          <div className="border border-green-200 dark:border-green-800 rounded-2xl p-6 bg-green-50/50 dark:bg-green-900/10">
            <p className="text-sm font-semibold text-green-600 dark:text-green-400 mb-3">✓ ParsePilot Optimised</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Match score: 84%</li>
              <li>• All critical keywords present</li>
              <li>• Passes ATS filters</li>
              <li>• Recruiter sees your application</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Mid CTA */}
      <section className="py-12 bg-primary/5 border-y border-primary/10 text-center px-6">
        <p className="text-xl font-bold text-foreground mb-4">Compare your resume against your target job — free</p>
        <CtaButton label="Compare now" />
      </section>

      <FaqSection items={faqs} />

      {/* Bottom CTA */}
      <section className="py-16 text-center px-6">
        <h2 className="text-2xl font-bold mb-4">Stop sending generic resumes</h2>
        <p className="text-muted-foreground mb-8">Tailored in 60 seconds. Free to start.</p>
        <CtaButton label="Compare now" />
      </section>

      <RelatedPages current="/resume-job-match" />
    </SeoLayout>
  );
}
