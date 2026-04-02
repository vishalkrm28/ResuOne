import { SeoLayout, CtaButton, FaqSection, RelatedPages } from "@/components/layout/seo-layout";
import { Shield, AlertCircle, CheckCircle2 } from "lucide-react";

const faqs = [
  { q: "Do ATS systems really reject resumes automatically?", a: "Yes. Most large employers use ATS to filter applications before a recruiter sees them. Resumes are ranked by keyword relevance, and low-scoring ones are never opened." },
  { q: "What makes a resume ATS-friendly?", a: "Standard section headings (Experience, Education, Skills), no tables or graphics, exact keyword matches from the job description, and clean formatting that parsers can read." },
  { q: "How does ResuOne fix ATS issues?", a: "It identifies which keywords are missing, rewrites your experience bullets to include them naturally, and outputs a clean DOCX file that ATS systems parse correctly." },
  { q: "Is my data safe?", a: "Yes. Your CV and job description are used only to generate your result and are never shared or sold." },
];

export default function AtsResumeChecker() {
  return (
    <SeoLayout
      title="ATS Resume Checker – Pass Applicant Tracking Systems | ResuOne"
      description="Free ATS resume checker. ResuOne scans your CV for ATS compatibility, finds missing keywords, and helps you pass applicant tracking systems automatically."
    >
      {/* Hero */}
      <section className="pt-20 pb-16 px-6 text-center bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <Shield className="w-3.5 h-3.5" /> ATS Compatibility Check
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-5 leading-tight">
            ATS Resume Checker – Pass the Bots
          </h1>
          <p className="text-lg text-muted-foreground mb-4 leading-relaxed">
            75% of resumes are rejected by Applicant Tracking Systems before a human ever reads them. It's not about your experience — it's about how your CV is written.
          </p>
          <p className="text-base text-muted-foreground mb-10">
            ResuOne scans your resume, identifies exactly what ATS systems are looking for, and helps you fix it — so your application gets seen.
          </p>
          <CtaButton label="Check your resume now" />
        </div>
      </section>

      {/* Sections */}
      <section className="py-16 max-w-4xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-muted/30 rounded-2xl p-6 border border-border/40">
            <Shield className="w-8 h-8 text-primary mb-4" />
            <h2 className="text-lg font-bold mb-3">What is ATS?</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Applicant Tracking Systems are software used by 99% of Fortune 500 companies and most medium-sized businesses to automatically screen resumes. They rank candidates by keyword match before any human review.
            </p>
          </div>
          <div className="bg-muted/30 rounded-2xl p-6 border border-border/40">
            <AlertCircle className="w-8 h-8 text-primary mb-4" />
            <h2 className="text-lg font-bold mb-3">Why Resumes Fail</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Missing keywords, non-standard section headers, tables, images, and overly creative formatting all cause ATS failures. A beautifully designed resume can score zero in an ATS scan.
            </p>
          </div>
          <div className="bg-muted/30 rounded-2xl p-6 border border-border/40">
            <CheckCircle2 className="w-8 h-8 text-primary mb-4" />
            <h2 className="text-lg font-bold mb-3">How to Fix It</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              ResuOne rewrites your CV to include the exact keywords from the job description, uses standard section headings, and exports a clean DOCX that every major ATS can parse correctly.
            </p>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-10 bg-muted/20 border-y border-border/40">
        <div className="max-w-4xl mx-auto px-6 grid md:grid-cols-3 gap-6 text-center">
          {[
            { stat: "75%", label: "of resumes rejected by ATS before human review" },
            { stat: "3×", label: "more interviews with ATS-optimised CVs" },
            { stat: "60s", label: "to get your ATS report with ResuOne" },
          ].map(s => (
            <div key={s.stat}>
              <p className="text-4xl font-extrabold text-primary mb-1">{s.stat}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Mid CTA */}
      <section className="py-12 text-center px-6">
        <p className="text-xl font-bold text-foreground mb-4">Find out if your resume passes ATS — free</p>
        <CtaButton label="Check your resume now" />
      </section>

      <FaqSection items={faqs} />

      {/* Bottom CTA */}
      <section className="py-16 text-center px-6">
        <h2 className="text-2xl font-bold mb-4">Stop getting filtered out before you're seen</h2>
        <p className="text-muted-foreground mb-8">Free to start. Results in under a minute.</p>
        <CtaButton label="Check your resume now" />
      </section>

      <RelatedPages current="/ats-resume-checker" />
    </SeoLayout>
  );
}
