import { useAuth } from "@workspace/replit-auth-web";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import {
  Sparkles,
  FileText,
  Target,
  CheckCircle2,
  Download,
  ArrowRight,
  Shield,
  ChevronDown,
  ChevronUp,
  BarChart3,
  PenLine,
  BadgeCheck,
  Crown,
  Lock,
  Eye,
  Zap,
  X,
} from "lucide-react";

// ─── FAQ data ────────────────────────────────────────────────────────────────

const faqs: { q: string; a: string }[] = [
  {
    q: "Does ParsePilot invent experience I don't have?",
    a: "Never. ParsePilot only uses what's already in your CV. It may reframe or restructure how your experience is presented, but it will never add roles, skills, or achievements that aren't there. This is a hard constraint, not a default setting.",
  },
  {
    q: "What do I get for free?",
    a: "You can analyse your CV, see your match score, view the top missing keywords, and get a partial preview of the optimised result — all before paying anything. You only pay when you want the full output.",
  },
  {
    q: "How does the $4 unlock work?",
    a: "After analysis you see a preview of the tailored CV. Pay $4 once for that specific result and the full optimised CV, cover letter option, and export unlock immediately. No subscription required.",
  },
  {
    q: "Can I cancel my Pro subscription?",
    a: "Yes, at any time from Settings → Billing. You won't be charged for the next period after cancelling.",
  },
  {
    q: "Can I edit the generated resume before downloading?",
    a: "Yes. After unlocking, the full tailored CV appears in an editor. Review and adjust it before exporting as DOCX or PDF.",
  },
  {
    q: "Is the output ATS-friendly?",
    a: "Yes. ParsePilot formats output with clean section headers and the keywords ATS systems filter for. DOCX exports follow formatting conventions most parsers handle correctly.",
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left text-sm font-medium hover:text-primary transition-colors"
      >
        {q}
        {open ? (
          <ChevronUp className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <p className="pb-5 text-sm text-muted-foreground leading-relaxed">{a}</p>
      )}
    </div>
  );
}

function HeroMockPanel() {
  return (
    <div className="relative w-full max-w-sm mx-auto lg:mx-0 lg:ml-auto">
      <div className="absolute -inset-6 bg-gradient-to-br from-violet-500/15 to-indigo-500/8 rounded-3xl blur-2xl pointer-events-none" />

      <div className="relative bg-card border border-border rounded-2xl shadow-2xl overflow-hidden text-left">
        {/* Window chrome */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
          <span className="ml-2 text-xs text-white/80 font-medium">
            ParsePilot — Operations Manager
          </span>
        </div>

        <div className="p-5 space-y-4">
          {/* Match score */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Match score
              </span>
              <span className="text-sm font-bold text-amber-600">72%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-amber-400 to-amber-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Good alignment — 3 critical keywords missing
            </p>
          </div>

          {/* Missing keywords */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Missing keywords
            </p>
            <div className="flex flex-wrap gap-1.5">
              {["SAP", "KPI reporting", "stakeholder communication"].map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 text-xs font-medium border border-rose-500/20"
                >
                  <X className="w-2.5 h-2.5" />
                  {k}
                </span>
              ))}
            </div>
          </div>

          {/* Optimised summary — blurred */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-muted-foreground">
                Optimised summary
              </p>
              <span className="inline-flex items-center gap-1 text-[10px] text-violet-600 font-medium">
                <Lock className="w-2.5 h-2.5" />
                Unlock to read
              </span>
            </div>
            <div className="border border-border/60 rounded-lg bg-muted/30 p-3 space-y-1.5 overflow-hidden">
              <p className="text-xs text-foreground leading-relaxed">
                Results-driven Operations Manager with 7+ years coordinating
                multi-site teams across supply chain and logistics functions…
              </p>
              <div className="relative">
                <p className="text-xs text-muted-foreground leading-relaxed blur-sm select-none">
                  Delivered measurable cost reductions through KPI-driven process
                  improvement and cross-functional stakeholder alignment.
                  Experienced in SAP ERP workflows and vendor contract management.
                </p>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card/80 flex items-end justify-center pb-1">
                  <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    Full summary visible after unlock
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Locked resume preview */}
          <div className="border border-dashed border-border rounded-lg p-3 bg-muted/20 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-violet-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                Full tailored CV — 2 pages
              </p>
              <p className="text-[10px] text-muted-foreground">
                Rewritten to match the role
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-violet-600 border border-violet-500/30 bg-violet-500/5 px-2 py-1 rounded-lg">
              <Lock className="w-3 h-3" />
              $4
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProofMockPanel() {
  return (
    <div className="relative max-w-lg mx-auto">
      <div className="absolute -inset-4 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 rounded-3xl blur-xl pointer-events-none" />

      <div className="relative bg-card border border-border rounded-2xl shadow-xl overflow-hidden text-left">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white/20" />
          <div className="w-2 h-2 rounded-full bg-white/20" />
          <div className="w-2 h-2 rounded-full bg-white/20" />
          <span className="ml-2 text-xs text-white/60 font-medium">
            ParsePilot — Senior Business Analyst
          </span>
        </div>

        <div className="p-5 space-y-4">
          {/* Score */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
            <div>
              <p className="text-xs font-semibold text-amber-700">Match score</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                3 critical gaps found
              </p>
            </div>
            <span className="text-3xl font-black text-amber-600">72%</span>
          </div>

          {/* Keywords */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] font-semibold text-emerald-700 mb-1.5 uppercase tracking-wide">
                Matched
              </p>
              {["Excel", "data modelling", "reporting"].map((k) => (
                <div
                  key={k}
                  className="flex items-center gap-1.5 text-xs text-emerald-700 mb-1"
                >
                  <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                  {k}
                </div>
              ))}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-rose-700 mb-1.5 uppercase tracking-wide">
                Missing
              </p>
              {["SAP", "KPI reporting", "stakeholder comms"].map((k) => (
                <div
                  key={k}
                  className="flex items-center gap-1.5 text-xs text-rose-700 mb-1"
                >
                  <X className="w-3 h-3 flex-shrink-0" />
                  {k}
                </div>
              ))}
            </div>
          </div>

          {/* Optimised bullet — one visible, rest locked */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Rewritten experience
            </p>
            <div className="space-y-2">
              <div className="border border-border/60 rounded-lg bg-muted/20 p-3">
                <p className="text-xs text-foreground leading-relaxed">
                  Delivered monthly KPI reporting packs for senior stakeholders,
                  reducing review cycle time by 40% through structured data
                  modelling and automated Excel dashboards.
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] text-violet-600 font-medium mt-1.5">
                  <Sparkles className="w-2.5 h-2.5" />
                  Tailored from your CV
                </span>
              </div>

              <div className="border border-dashed border-border/60 rounded-lg p-3 relative overflow-hidden">
                <p className="text-xs text-muted-foreground leading-relaxed blur-sm select-none">
                  Coordinated cross-functional stakeholder communication across
                  finance, operations, and procurement to deliver SAP reporting
                  migration on schedule.
                </p>
                <div className="absolute inset-0 flex items-center justify-center bg-card/50">
                  <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 border border-border/60 bg-card px-2 py-1 rounded-full">
                    <Lock className="w-2.5 h-2.5" />
                    2 more bullets — unlock for $4
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Landing() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="border-b border-border/50 sticky top-0 z-50 bg-background/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">ParsePilot</span>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="#pricing"
              className="hidden sm:block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </a>
            <button
              onClick={login}
              className="hidden sm:block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Log in
            </button>
            <button
              onClick={login}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Analyze My CV
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-20">

          {/* Left — copy */}
          <div className="flex-1 text-center lg:text-left max-w-xl mx-auto lg:mx-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium mb-6">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Match score + missing keywords — free, instantly
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.07] mb-5">
              See exactly why your
              <br />
              CV gets rejected —{" "}
              <span className="text-primary">and fix it</span>
              <br />
              instantly.
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0">
              Get a real match score and missing keyword analysis in under a minute — then unlock a fully rewritten CV tailored to the role for $4.
            </p>

            <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3">
              <button
                onClick={login}
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:opacity-90 transition-opacity shadow-md w-full sm:w-auto justify-center"
              >
                <Sparkles className="w-4 h-4" />
                Get My Match Score — Free
              </button>
              <a
                href="#proof"
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-border hover:border-primary/40 font-medium text-sm transition-colors w-full sm:w-auto justify-center"
              >
                See Example
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <p className="text-xs text-muted-foreground mt-4 text-center lg:text-left">
              No card required · See your score before paying anything
            </p>
          </div>

          {/* Right — mock */}
          <div className="flex-1 w-full">
            <HeroMockPanel />
          </div>
        </div>
      </section>

      {/* ── Trust strip ─────────────────────────────────────────────────── */}
      <div className="border-y border-border/40 bg-muted/20 py-4">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          {[
            "ATS-friendly formatting",
            "No fake experience added",
            "See analysis before you pay",
            "Edit before export",
            "PDF & DOCX upload",
          ].map((item) => (
            <div key={item} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Problem ─────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
            Sending applications and hearing nothing back?
          </h2>
          <p className="text-muted-foreground text-lg mb-10">
            The problem usually isn't your experience. It's how your CV is read before it reaches a person.
          </p>

          <div className="grid sm:grid-cols-3 gap-5 text-left">
            {[
              {
                icon: <Target className="w-5 h-5 text-rose-500" />,
                text: "Your CV doesn't match the keywords recruiters are filtering for",
              },
              {
                icon: <BarChart3 className="w-5 h-5 text-rose-500" />,
                text: "ATS systems reject weak alignment before a recruiter even reads it",
              },
              {
                icon: <FileText className="w-5 h-5 text-rose-500" />,
                text: "Generic resumes consistently underperform against role-specific applications",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex gap-3 p-5 rounded-xl border border-border bg-card"
              >
                <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                  {item.icon}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solution ────────────────────────────────────────────────────── */}
      <section className="bg-muted/20 border-y border-border/40">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">
              How ParsePilot helps
            </p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
              ParsePilot shows you what's wrong — and how to fix it
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: <BarChart3 className="w-6 h-6" />,
                title: "Match Score",
                desc: "See how closely your CV matches the role before you apply",
              },
              {
                icon: <Target className="w-6 h-6" />,
                title: "Missing Keywords",
                desc: "Find the exact terms and requirements your CV is lacking",
              },
              {
                icon: <PenLine className="w-6 h-6" />,
                title: "Resume Rewrite",
                desc: "Get a stronger version tailored to the job, using only your real experience",
              },
              {
                icon: <FileText className="w-6 h-6" />,
                title: "Cover Letter",
                desc: "Generate a role-specific letter when you need it, not a generic template",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-card border border-border rounded-xl p-6"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Three steps to a stronger application
          </h2>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            No templates. No guessing. Every output is built from your real experience.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {[
            {
              num: "01",
              icon: <FileText className="w-6 h-6" />,
              title: "Upload your CV",
              body: "Paste your text or upload a PDF or DOCX. We extract every detail — work history, skills, education.",
            },
            {
              num: "02",
              icon: <PenLine className="w-6 h-6" />,
              title: "Paste the job description",
              body: "Copy in the full job posting. The more context you give, the more targeted your result.",
            },
            {
              num: "03",
              icon: <Zap className="w-6 h-6" />,
              title: "Get instant analysis, unlock the full result",
              body: "See your score and gaps immediately. Pay $4 to unlock the complete optimised CV and export.",
            },
          ].map((s, i) => (
            <div key={s.num} className="relative text-center md:text-left">
              {i < 2 && (
                <div className="hidden md:block absolute top-6 left-[calc(100%+8px)] w-8 border-t border-dashed border-border/60" />
              )}
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 mx-auto md:mx-0">
                {s.icon}
              </div>
              <div className="text-4xl font-black text-primary/8 leading-none mb-2">
                {s.num}
              </div>
              <h3 className="font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trust section ────────────────────────────────────────────────── */}
      <section className="bg-muted/20 border-y border-border/40">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">
                Built for trust
              </p>
              <h2 className="text-3xl md:text-4xl font-bold mb-5 leading-tight">
                Built for trust, not hype
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8 text-lg">
                ParsePilot helps you tailor your resume without inventing skills, tools, or experience you don't have.
              </p>

              <div className="flex items-start gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 mb-6">
                <Shield className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-emerald-800">
                    Zero fabrication guarantee
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Every word in the output comes from your original CV. ParsePilot restructures and highlights what's already there — it never adds experience you don't have.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                {
                  icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
                  title: "ATS-friendly formatting",
                  desc: "Output uses standard section headers and clean structure that ATS parsers handle correctly.",
                },
                {
                  icon: <Shield className="w-5 h-5 text-emerald-600" />,
                  title: "No fake experience added",
                  desc: "Only your real skills and history are used. Nothing is invented or implied.",
                },
                {
                  icon: <Eye className="w-5 h-5 text-emerald-600" />,
                  title: "See the analysis before you pay",
                  desc: "Match score and missing keywords are free. You decide if it's worth unlocking.",
                },
                {
                  icon: <PenLine className="w-5 h-5 text-emerald-600" />,
                  title: "Edit before export",
                  desc: "Review and adjust the tailored CV in the editor before downloading. Nothing is final until you say so.",
                },
              ].map((t) => (
                <div
                  key={t.title}
                  className="bg-card border border-border rounded-xl p-5"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
                    {t.icon}
                  </div>
                  <h3 className="font-semibold text-sm mb-1.5">{t.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Proof section ────────────────────────────────────────────────── */}
      <section id="proof" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">
            See it in action
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
            See what you're missing before you apply
          </h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            This is the kind of output ParsePilot produces. Real gaps. Specific fixes. No guessing.
          </p>
        </div>

        <ProofMockPanel />
      </section>

      {/* ── Before / After ───────────────────────────────────────────────── */}
      <section className="bg-muted/20 border-y border-border/40">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">
              Before vs after
            </p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
              From generic to role-specific
            </h2>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              The same experience — presented with the language the role actually calls for.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Before */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="bg-muted/60 border-b border-border px-5 py-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-400" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Before
                </span>
              </div>
              <div className="p-5">
                <p className="text-sm text-muted-foreground leading-relaxed italic">
                  "Worked with vendors and handled deliveries."
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full w-[35%] rounded-full bg-rose-400" />
                  </div>
                  <span className="text-xs text-muted-foreground">35% match</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Missing: KPI reporting, stakeholder communication, SAP
                </p>
              </div>
            </div>

            {/* After */}
            <div className="bg-card border border-violet-500/30 rounded-xl overflow-hidden">
              <div className="bg-violet-500/5 border-b border-violet-500/20 px-5 py-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
                  After
                </span>
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-violet-600 font-medium">
                  <Sparkles className="w-2.5 h-2.5" />
                  ParsePilot tailored
                </span>
              </div>
              <div className="p-5">
                <p className="text-sm text-foreground leading-relaxed">
                  "Coordinated vendor workflows and delivery planning to support operational readiness and reduce timeline risk."
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full w-[88%] rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500" />
                  </div>
                  <span className="text-xs text-muted-foreground">88% match</span>
                </div>
                <p className="text-xs text-emerald-700 mt-2">
                  Keywords matched · No experience invented
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">
            Pricing
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            See your analysis first. Only pay when you want the full result.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Free — entry point */}
          <div className="bg-card border border-border rounded-2xl p-7 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 to-emerald-500" />
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">
              Start here — Free
            </p>
            <p className="text-4xl font-bold mb-1">$0</p>
            <p className="text-sm text-muted-foreground mb-6">
              No card. No commitment.
            </p>
            <ul className="space-y-2.5 text-sm flex-1 mb-7">
              {[
                "Match score",
                "Missing keywords",
                "Partial optimised preview",
                "See results before paying",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={login}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              Start for free
            </button>
          </div>

          {/* Unlock */}
          <div className="bg-card border border-border rounded-2xl p-7 flex flex-col">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Unlock
            </p>
            <p className="text-4xl font-bold mb-1">
              $4<span className="text-lg font-normal text-muted-foreground"> per result</span>
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              No subscription. Instant access.
            </p>
            <ul className="space-y-2.5 text-sm flex-1 mb-7">
              {[
                "Full optimised CV",
                "Cover letter",
                "Copy and edit",
                "DOCX & PDF export",
                "Yours forever — no expiry",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={login}
              className="w-full py-2.5 rounded-xl border border-border hover:border-primary/40 text-sm font-semibold transition-colors"
            >
              Analyze to unlock
            </button>
          </div>

          {/* Pro */}
          <div className="relative bg-card border-2 border-violet-500 rounded-2xl p-7 flex flex-col">
            <div className="flex justify-center mb-4 -mt-1">
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold px-3.5 py-1 rounded-full shadow-sm">
                Best for active job seekers
              </span>
            </div>

            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-4 h-4 text-violet-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                Pro
              </p>
            </div>
            <p className="text-4xl font-bold mb-1">
              $12<span className="text-lg font-normal text-muted-foreground">/mo</span>
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Best for active job seekers.
            </p>
            <ul className="space-y-2.5 text-sm flex-1 mb-7">
              {[
                "100 credits per month",
                "Full CV rewrites",
                "Cover letter generation",
                "DOCX & PDF export",
                "Edit before export",
                "Cancel any time",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <BadgeCheck className="w-4 h-4 text-violet-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={login}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-semibold transition-all shadow-md"
            >
              Get Pro — $12/mo
            </button>
            <p className="text-center text-xs text-muted-foreground mt-3">
              Cancel any time. No long-term commitment.
            </p>
          </div>
        </div>

        <div className="mt-8 max-w-4xl mx-auto rounded-xl border border-border/60 bg-muted/30 p-5 text-sm text-muted-foreground text-center">
          <span className="font-medium text-foreground">How credits work:</span>{" "}
          Each CV optimisation or cover letter costs 1 credit. DOCX and PDF exports are always free. Pro credits reset each billing period.
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 bg-muted/10">
        <div className="max-w-2xl mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">
              FAQ
            </p>
            <h2 className="text-3xl font-bold">Common questions</h2>
          </div>
          <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card px-6">
            {faqs.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 px-8 py-16 text-center text-white">
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />

          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
              Stop guessing.
              <br />
              Start applying with a stronger CV.
            </h2>
            <p className="text-violet-200 text-lg mb-10 max-w-md mx-auto">
              Upload your CV and see exactly where you stand — before you spend another hour rewriting it manually.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={login}
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-violet-700 font-semibold text-base hover:bg-violet-50 transition-colors shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                Analyze My CV
              </button>
              <a
                href="#proof"
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/30 text-white font-medium text-sm hover:bg-white/10 transition-colors"
              >
                See Example
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <p className="text-violet-300 text-xs mt-6">
              Free to analyse · No card required
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/40 bg-muted/10">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">ParsePilot</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-foreground transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
