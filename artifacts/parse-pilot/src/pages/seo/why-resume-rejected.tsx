import { SeoLayout, CtaButton, FaqSection, RelatedPages } from "@/components/layout/seo-layout";
import { AlertCircle, Shield, PenLine } from "lucide-react";

const faqs = [
  { q: "Why am I not getting interviews even though I'm qualified?", a: "Most rejections happen before a recruiter sees your application. ATS systems filter CVs by keyword match — if your resume doesn't use the same language as the job description, it gets rejected automatically." },
  { q: "What are the most common resume mistakes?", a: "Missing keywords, generic summaries not tailored to the role, weak achievement descriptions, non-standard formatting that ATS can't parse, and applying with the same CV to every job." },
  { q: "How quickly can ResuOne fix my resume?", a: "In under 60 seconds. Upload your CV, paste the job description, and receive a fully optimised version with every gap addressed." },
  { q: "Do I need to rewrite my whole CV?", a: "No. ResuOne keeps your real experience and structure — it rewrites how your work is described to match what employers are searching for." },
];

const mistakes = [
  { title: "Generic objective statements", desc: "Opening summaries that aren't tailored to the specific role get ignored by ATS and recruiters alike." },
  { title: "Missing job-specific keywords", desc: "Not using the exact phrases from the job description — even synonyms — causes ATS systems to rank you near the bottom." },
  { title: "Weak achievement descriptions", desc: "Listing duties instead of results ('responsible for sales' vs 'grew sales 40% in 6 months') makes you indistinguishable from other candidates." },
  { title: "ATS-unfriendly formatting", desc: "Tables, columns, headers/footers, and images all cause ATS parsing failures. Your information may never be read." },
  { title: "One CV for every job", desc: "Sending the same generic resume to all applications means you match no one perfectly. Each application needs tailoring." },
  { title: "No cover letter or weak one", desc: "A generic cover letter signals low effort. A tailored cover letter matching the job's priorities doubles your chance of a response." },
];

export default function WhyResumeRejected() {
  return (
    <SeoLayout
      title="Why Your Resume Gets Rejected – Common Mistakes & Fixes | ResuOne"
      description="Find out why your resume gets rejected and how to fix it. ResuOne identifies ATS failures, missing keywords, and weak descriptions — and fixes them in 60 seconds."
    >
      {/* Hero */}
      <section className="pt-20 pb-16 px-6 text-center bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <AlertCircle className="w-3.5 h-3.5" /> Resume Rejection Analysis
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-5 leading-tight">
            Why Your Resume Gets Rejected
          </h1>
          <p className="text-lg text-muted-foreground mb-4 leading-relaxed">
            You may be fully qualified — but still getting no interviews. The problem isn't your experience. It's how your resume presents it.
          </p>
          <p className="text-base text-muted-foreground mb-10">
            ResuOne identifies exactly what's costing you interviews and fixes it, so employers finally see the candidate you actually are.
          </p>
          <CtaButton label="Fix your resume now" />
        </div>
      </section>

      {/* Top mistakes */}
      <section className="py-16 max-w-4xl mx-auto px-6">
        <h2 className="text-2xl font-bold text-center mb-10">The 6 Most Common Reasons Resumes Get Rejected</h2>
        <div className="grid md:grid-cols-2 gap-5">
          {mistakes.map((m, i) => (
            <div key={i} className="flex gap-4 items-start bg-muted/20 rounded-xl p-5 border border-border/40">
              <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
              <div>
                <p className="font-semibold text-foreground mb-1 text-sm">{m.title}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How ATS works */}
      <section className="py-12 bg-muted/20 border-y border-border/40 px-6">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <Shield className="w-10 h-10 text-primary mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-3">ATS Filtering</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              99% of large employers use ATS to screen resumes. Your CV is scored automatically — and only the top-ranked applications reach a human recruiter.
            </p>
          </div>
          <div className="text-center">
            <AlertCircle className="w-10 h-10 text-primary mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-3">Keyword Rejection</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              ATS systems search for exact keyword matches. Using 'led projects' when the job says 'project management' often scores as zero — even though they mean the same thing.
            </p>
          </div>
          <div className="text-center">
            <PenLine className="w-10 h-10 text-primary mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-3">Weak Descriptions</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Duty-based bullets ('responsible for…') don't demonstrate value. Recruiters want achievement evidence: numbers, impact, and scope. ResuOne rewrites bullets to show both.
            </p>
          </div>
        </div>
      </section>

      {/* Mid CTA */}
      <section className="py-12 text-center px-6">
        <p className="text-xl font-bold text-foreground mb-4">Find out exactly why your resume is being rejected</p>
        <CtaButton label="Fix your resume now" />
      </section>

      <FaqSection items={faqs} />

      {/* Bottom CTA */}
      <section className="py-16 text-center px-6">
        <h2 className="text-2xl font-bold mb-4">Stop wondering. Start getting interviews.</h2>
        <p className="text-muted-foreground mb-8">Free to start. Fix takes under 60 seconds.</p>
        <CtaButton label="Fix your resume now" />
      </section>

      <RelatedPages current="/why-resume-rejected" />
    </SeoLayout>
  );
}
