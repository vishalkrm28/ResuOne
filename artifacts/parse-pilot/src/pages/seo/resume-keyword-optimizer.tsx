import { SeoLayout, CtaButton, FaqSection, RelatedPages } from "@/components/layout/seo-layout";
import { Search, Target, Zap } from "lucide-react";

const faqs = [
  { q: "Why do keywords matter so much?", a: "ATS systems filter resumes by searching for exact phrases from the job description. If your CV uses 'managed a team' but the job says 'led cross-functional teams', you won't match — even though it means the same thing." },
  { q: "Will ParsePilot add keywords I don't actually have?", a: "Never. ParsePilot only adds keywords that reflect your real experience, reframing how you describe it to match the language employers use. It never invents skills or roles." },
  { q: "How many keywords does a typical resume miss?", a: "Most CVs miss 15–30% of the critical keywords from any given job description. ParsePilot identifies every gap and shows you how to address them." },
  { q: "Does keyword stuffing work?", a: "No — modern ATS systems penalise obvious stuffing. ParsePilot embeds keywords naturally in rewritten experience bullets, not as a list at the bottom." },
];

export default function ResumeKeywordOptimizer() {
  return (
    <SeoLayout
      title="Resume Keyword Optimization Tool | ParsePilot"
      description="Find missing resume keywords instantly. ParsePilot compares your CV against any job description, identifies keyword gaps, and rewrites your resume to pass ATS filters."
    >
      {/* Hero */}
      <section className="pt-20 pb-16 px-6 text-center bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <Search className="w-3.5 h-3.5" /> Keyword Gap Analysis
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-5 leading-tight">
            Optimize Your Resume Keywords
          </h1>
          <p className="text-lg text-muted-foreground mb-4 leading-relaxed">
            If your resume lacks the right keywords, it won't be seen — regardless of how qualified you are. ATS systems filter on exact phrase matches, not intent.
          </p>
          <p className="text-base text-muted-foreground mb-10">
            ParsePilot extracts every key term from the job description, compares it against your CV, and rewrites your resume to close every gap.
          </p>
          <CtaButton label="Find missing keywords" />
        </div>
      </section>

      {/* Feature sections */}
      <section className="py-16 max-w-4xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-muted/30 rounded-2xl p-6 border border-border/40">
            <Search className="w-8 h-8 text-primary mb-4" />
            <h2 className="text-lg font-bold mb-3">Keyword Matching</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              ParsePilot extracts every meaningful phrase from the job description — hard skills, soft skills, tools, certifications — and checks whether your CV contains them in any form.
            </p>
          </div>
          <div className="bg-muted/30 rounded-2xl p-6 border border-border/40">
            <Target className="w-8 h-8 text-primary mb-4" />
            <h2 className="text-lg font-bold mb-3">Skill Gap Identification</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              See a prioritised list of which skills and terms are most critical to the role and missing from your resume — ranked by how often they appear in the job description.
            </p>
          </div>
          <div className="bg-muted/30 rounded-2xl p-6 border border-border/40">
            <Zap className="w-8 h-8 text-primary mb-4" />
            <h2 className="text-lg font-bold mb-3">Optimization Tips</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              ParsePilot doesn't just list gaps — it rewrites your experience bullets to naturally include the missing keywords, matching the exact phrasing ATS systems look for.
            </p>
          </div>
        </div>
      </section>

      {/* Example keyword list visual */}
      <section className="py-12 bg-muted/20 border-y border-border/40 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-8">Example: Keywords ParsePilot Finds Missing</h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {["Stakeholder management", "KPI reporting", "Cross-functional collaboration", "Agile methodology", "Python", "Data analysis", "Project delivery", "Budget oversight", "SQL", "Presentation skills"].map(kw => (
              <span key={kw} className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 text-xs font-medium px-3 py-1.5 rounded-full">
                ✕ {kw}
              </span>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">These gaps are identified from your actual job description — not generic suggestions</p>
        </div>
      </section>

      {/* Mid CTA */}
      <section className="py-12 text-center px-6">
        <p className="text-xl font-bold text-foreground mb-4">See exactly which keywords you're missing</p>
        <CtaButton label="Find missing keywords" />
      </section>

      <FaqSection items={faqs} />

      {/* Bottom CTA */}
      <section className="py-16 text-center px-6">
        <h2 className="text-2xl font-bold mb-4">Stop missing out because of keywords</h2>
        <p className="text-muted-foreground mb-8">Free keyword analysis. Results in seconds.</p>
        <CtaButton label="Find missing keywords" />
      </section>

      <RelatedPages current="/resume-keyword-optimizer" />
    </SeoLayout>
  );
}
