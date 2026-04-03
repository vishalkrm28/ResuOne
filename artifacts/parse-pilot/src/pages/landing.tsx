import { useAuth } from "@workspace/replit-auth-web";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Footer } from "@/components/layout/footer";
import { LogoBrand } from "@/components/brand/logo";
import {
  Sparkles,
  FileText,
  Target,
  CheckCircle2,
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
  AlertCircle,
  Users,
  Mail,
  Building2,
  GraduationCap,
  Briefcase,
  TrendingUp,
} from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const faqs: { q: string; a: string }[] = [
  {
    q: "Does ResuOne invent experience I don't have?",
    a: "Never. ResuOne only uses what's in your CV. It restructures and reframes how your existing experience is presented — it never adds roles, skills, or achievements that aren't there. This is a hard constraint built into every output.",
  },
  {
    q: "What do I get for free?",
    a: "Match score, missing keyword list, and a partial preview of the optimised result — all before you pay anything. You only pay when you want the complete output.",
  },
  {
    q: "How does the $6.99 unlock work?",
    a: "After analysis you see a preview. Pay $6.99 once for that result and the full optimised CV, cover letter option, and export unlock immediately. No subscription. No recurring charge.",
  },
  {
    q: "Can I cancel my Pro subscription?",
    a: "Yes, any time from Settings → Billing. You won't be charged for the next period after cancelling.",
  },
  {
    q: "Can I edit the CV before downloading?",
    a: "Yes. After unlocking, the full tailored CV opens in an editor. Review and adjust before exporting as DOCX or PDF.",
  },
  {
    q: "Is the output ATS-friendly?",
    a: "Yes. ResuOne uses standard section headers and the exact keyword language ATS systems filter for. DOCX exports follow formatting conventions most parsers handle correctly.",
  },
  {
    q: "How does Recruiter Mode work?",
    a: "Upload candidate CVs against a job description. ResuOne scores each one, surfaces the top matches, and lets you invite shortlisted candidates by email — all in one place. No ATS setup required.",
  },
  {
    q: "Can my team use Recruiter Mode together?",
    a: "Yes. The Team plan lets you add up to 2 additional members who share the same candidate pool. Everyone sees the same pipeline.",
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

function CandidateListMock() {
  const candidates = [
    { name: "Sarah Chen", role: "Marketing Manager", score: 91, tag: "top", tagLabel: "Top match", tagColor: "bg-primary text-primary-foreground" },
    { name: "James Moore", role: "Growth Lead", score: 78, tag: "strong", tagLabel: "Strong", tagColor: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20" },
    { name: "Priya Patel", role: "Brand Strategist", score: 62, tag: "review", tagLabel: "Review", tagColor: "bg-amber-500/10 text-amber-700 border border-amber-500/20" },
  ];

  return (
    <div className="relative w-full max-w-sm mx-auto lg:mx-0 lg:ml-auto">
      <div className="absolute -inset-6 bg-gradient-to-br from-violet-500/15 to-indigo-500/8 rounded-3xl blur-2xl pointer-events-none" />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl overflow-hidden text-left">
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
          <span className="ml-2 text-xs text-white/80 font-medium">
            ResuOne — Candidate Pipeline
          </span>
        </div>

        <div className="px-5 pt-4 pb-3 border-b border-border/40">
          <p className="text-xs font-semibold text-foreground">Senior Marketing Manager</p>
          <p className="text-xs text-muted-foreground mt-0.5">12 candidates screened · 3 top matches</p>
        </div>

        <div className="divide-y divide-border/30">
          {candidates.map((c) => (
            <div key={c.name} className="flex items-center gap-3 px-5 py-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                {c.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{c.name}</p>
                <p className="text-[10px] text-muted-foreground">{c.role}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-center">
                  <span className="text-sm font-bold text-primary">{c.score}%</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${c.tagColor}`}>
                  {c.tagLabel}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3.5 bg-muted/20 border-t border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Mail className="w-3 h-3 text-primary" />
            <p className="text-[10px] text-muted-foreground">2 invites sent · 1 accepted</p>
          </div>
          <button className="text-[10px] bg-primary text-primary-foreground px-2.5 py-1 rounded-full font-semibold">
            Invite Sarah →
          </button>
        </div>
      </div>
    </div>
  );
}

function HeroMockPanel() {
  return (
    <div className="relative w-full max-w-xs mx-auto">
      <div className="absolute -inset-4 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 rounded-3xl blur-xl pointer-events-none" />
      <div className="relative bg-card border border-border rounded-2xl shadow-xl overflow-hidden text-left">
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-2.5 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white/20" />
          <div className="w-2 h-2 rounded-full bg-white/20" />
          <div className="w-2 h-2 rounded-full bg-white/20" />
          <span className="ml-2 text-xs text-white/60 font-medium">CV Analysis</span>
        </div>
        <div className="p-4 space-y-3.5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Match score</span>
              <span className="text-sm font-bold text-amber-600">72%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-amber-400 to-amber-500" />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Missing keywords</p>
            <div className="flex flex-wrap gap-1">
              {["SAP", "KPI reporting", "stakeholder comms"].map((k) => (
                <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-700 text-[10px] font-medium border border-rose-500/20">
                  <X className="w-2 h-2" />{k}
                </span>
              ))}
            </div>
          </div>
          <div className="border border-dashed border-border rounded-lg p-2.5 bg-muted/20 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-3.5 h-3.5 text-violet-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-foreground">Full optimised CV</p>
              <p className="text-[10px] text-muted-foreground">Rewritten for this role</p>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 border border-violet-500/30 bg-violet-500/5 px-1.5 py-0.5 rounded whitespace-nowrap">
              <Lock className="w-2.5 h-2.5" />$6.99
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "/api";

export default function Landing() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const [, setLocation] = useLocation();
  const [analysesCount, setAnalysesCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  useEffect(() => {
    fetch(`${API_BASE}/public/stats`)
      .then((r) => r.json())
      .then((d) => setAnalysesCount(d.analysesCount ?? 0))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="border-b border-border/50 sticky top-0 z-50 bg-background/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <LogoBrand size="md" />
          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="hidden sm:block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              How it works
            </a>
            <a href="#use-cases" className="hidden md:block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              For Recruiters
            </a>
            <a href="#pricing" className="hidden sm:block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
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
              Get Started
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

          {/* Left — copy */}
          <div className="flex-1 text-center lg:text-left max-w-xl mx-auto lg:mx-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium mb-6">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {analysesCount !== null && analysesCount >= 50
                ? `${analysesCount.toLocaleString()}+ CVs analyzed`
                : "CV analysis · candidate matching · instant invites"}
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.07] mb-5">
              From CV Analysis
              <br />
              to Interview —{" "}
              <span className="text-primary">In One Flow</span>
            </h1>

            <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0">
              Analyze candidates, identify top matches, and invite them instantly. No complex ATS. Just faster hiring decisions.
            </p>

            <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3">
              <button
                onClick={login}
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:opacity-90 transition-opacity shadow-md w-full sm:w-auto justify-center"
              >
                <FileText className="w-4 h-4" />
                Analyze CV
              </button>
              <button
                onClick={login}
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-border hover:border-primary/40 font-semibold text-base transition-colors w-full sm:w-auto justify-center"
              >
                <Users className="w-4 h-4" />
                Start Hiring
              </button>
            </div>

            <p className="text-xs text-muted-foreground mt-4 text-center lg:text-left">
              Free analysis · No card required · Instant results
            </p>
          </div>

          {/* Right — dual mocks */}
          <div className="flex-1 w-full">
            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-5 justify-center lg:justify-end">
              <CandidateListMock />
              <div className="hidden sm:block lg:hidden xl:block">
                <HeroMockPanel />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust strip ─────────────────────────────────────────────────── */}
      <div className="border-y border-border/40 bg-muted/20 py-4">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          {[
            "Match scoring for every candidate",
            "Instant email invites",
            "ATS-friendly CV output",
            "No fabricated experience",
            "Edit before export",
          ].map((item) => (
            <div key={item} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Three steps to the right hire
          </h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Upload CVs, get scored matches, invite the best candidates. All without leaving ResuOne.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-10 max-w-4xl mx-auto">
          {[
            {
              num: "1",
              icon: <FileText className="w-5 h-5" />,
              title: "Upload CVs or paste a job description",
              body: "Drop in candidate CVs and your job posting. ResuOne extracts skills, experience, and requirements automatically.",
            },
            {
              num: "2",
              icon: <BarChart3 className="w-5 h-5" />,
              title: "Get match scores and insights",
              body: "Every candidate gets a precise match score. See who fits, who's close, and what's missing — at a glance.",
            },
            {
              num: "3",
              icon: <Mail className="w-5 h-5" />,
              title: "Invite top candidates instantly",
              body: "Send interview invites directly from ResuOne. Track who's accepted, declined, or pending — no extra tools needed.",
            },
          ].map((s) => (
            <div key={s.num} className="flex gap-5">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                {s.num}
              </div>
              <div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="bg-muted/20 border-y border-border/40">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">
              Features
            </p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything you need. Nothing you don't.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: <BarChart3 className="w-6 h-6" />,
                title: "CV Analysis",
                desc: "Understand candidate strengths and gaps instantly. Every CV scored against your exact role requirements.",
              },
              {
                icon: <Target className="w-6 h-6" />,
                title: "Smart Matching",
                desc: "See exactly how candidates match your role. Ranked scores, keyword coverage, and clear shortlist recommendations.",
              },
              {
                icon: <Mail className="w-6 h-6" />,
                title: "Instant Invite",
                desc: "Invite candidates to interviews in one click. Track responses without switching between tools.",
              },
              {
                icon: <Zap className="w-6 h-6" />,
                title: "Simple Workflow",
                desc: "No ATS complexity. Just decisions. Upload CVs, see scores, send invites — done.",
              },
            ].map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-xl p-6">
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use Cases ────────────────────────────────────────────────────── */}
      <section id="use-cases" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">
            Who uses ResuOne
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Built for real hiring decisions
          </h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            No guesswork. No bloated ATS. Just a clear view of who fits the role.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            {
              icon: <Briefcase className="w-6 h-6 text-violet-500" />,
              audience: "Recruiters",
              headline: "For recruiters hiring fast",
              body: "Screen more candidates in less time. Get precise match scores, spot the top fits, and send invites — all in one place.",
              detail: "Recruiter Solo & Team plans available",
            },
            {
              icon: <TrendingUp className="w-6 h-6 text-violet-500" />,
              audience: "Startups",
              headline: "For teams screening candidates at scale",
              body: "No HR team? No problem. ResuOne handles the screening so you can focus on the interviews that matter.",
              detail: "Share a candidate pool with your whole team",
            },
            {
              icon: <GraduationCap className="w-6 h-6 text-violet-500" />,
              audience: "Universities",
              headline: "For placement and career offices",
              body: "Help students understand how their CV reads to employers. Surface gaps, suggest improvements, and improve placement outcomes.",
              detail: "Works for any role, any industry",
            },
          ].map((uc) => (
            <div key={uc.audience} className="bg-card border border-border rounded-xl p-7">
              <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center mb-5">
                {uc.icon}
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {uc.audience}
              </p>
              <h3 className="font-semibold text-base mb-3 leading-snug">{uc.headline}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{uc.body}</p>
              <p className="text-xs text-primary/80 font-medium">{uc.detail}</p>
            </div>
          ))}
        </div>

        {/* Trust callout */}
        <div className="mt-14 max-w-2xl mx-auto text-center p-8 rounded-2xl border border-border/60 bg-muted/20">
          <Shield className="w-8 h-8 text-emerald-500 mx-auto mb-4" />
          <p className="text-xl font-bold mb-2">Built for real hiring decisions. No guesswork.</p>
          <p className="text-sm text-muted-foreground">
            Every score is derived from the actual job description and CV content — not a generic algorithm. Formatting may vary. Always review before submission.
          </p>
        </div>
      </section>

      {/* ── Problem — for job seekers ───────────────────────────────────── */}
      <section className="bg-muted/20 border-y border-border/40">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">For job seekers</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
              Sending applications and hearing nothing back?
            </h2>
            <p className="text-muted-foreground text-lg">
              The problem usually isn't your experience. It's how your CV is read before it reaches a person.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {[
              {
                icon: <Target className="w-5 h-5 text-rose-500" />,
                title: "Keyword mismatch",
                text: "Your CV doesn't use the specific terms recruiters are filtering for — even when you have the experience.",
              },
              {
                icon: <AlertCircle className="w-5 h-5 text-rose-500" />,
                title: "ATS filtering",
                text: "Most applications are eliminated automatically. A low match score means a human never reads your CV.",
              },
              {
                icon: <FileText className="w-5 h-5 text-rose-500" />,
                title: "Generic framing",
                text: "The same CV sent to every role consistently underperforms. Role-specific applications win.",
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-3 p-5 rounded-xl border border-border bg-card">
                <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1">{item.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CV Analysis solution ──────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">
            CV Analysis
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
            Shows you what's wrong — and rewrites it
          </h2>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            Not a resume template. An analysis engine that reads your CV against the actual job description.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              icon: <BarChart3 className="w-6 h-6" />,
              title: "Match Score",
              desc: "A real percentage — how closely your CV aligns with this specific role.",
            },
            {
              icon: <Target className="w-6 h-6" />,
              title: "Missing Keywords",
              desc: "The exact terms and requirements your CV is lacking, ranked by importance.",
            },
            {
              icon: <PenLine className="w-6 h-6" />,
              title: "CV Rewrite",
              desc: "A stronger version tailored to the job. Same experience, sharper language.",
            },
            {
              icon: <FileText className="w-6 h-6" />,
              title: "Cover Letter",
              desc: "A role-specific letter that mirrors the job description — not a generic template.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-xl p-6">
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trust section ────────────────────────────────────────────────── */}
      <section className="bg-muted/20 border-y border-border/40">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">
                Why it's safe to trust
              </p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
                You see everything before you pay
              </h2>
              <p className="text-muted-foreground text-lg">
                Most tools make you commit before you see the output. ResuOne shows you the analysis first, always.
              </p>
            </div>

            <div className="flex items-start gap-4 p-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 mb-10">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Shield className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-emerald-900 mb-1">
                  Zero fabrication — hard constraint, not a setting
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Every word in the output comes directly from your original CV. ResuOne restructures and sharpens how your experience is presented — it never invents roles, skills, or achievements. This is enforced at the system level, not a guideline.
                </p>
              </div>
            </div>

            <div className="space-y-0 divide-y divide-border/60 border border-border/60 rounded-2xl bg-card overflow-hidden">
              {[
                {
                  icon: <Eye className="w-4 h-4 text-foreground" />,
                  statement: "See your match score and missing keywords before paying anything",
                  detail: "Analysis is always free. You decide whether the result is worth $6.99 before you commit.",
                },
                {
                  icon: <Lock className="w-4 h-4 text-foreground" />,
                  statement: "No subscription required to get a result",
                  detail: "Pay $6.99 per result if you want the full output. Pro is for people who apply frequently.",
                },
                {
                  icon: <PenLine className="w-4 h-4 text-foreground" />,
                  statement: "Review and edit the CV before downloading",
                  detail: "The full tailored CV opens in an editor after unlock. Nothing is exported without your approval.",
                },
                {
                  icon: <CheckCircle2 className="w-4 h-4 text-foreground" />,
                  statement: "ATS-formatted output — clean structure, standard headers",
                  detail: "DOCX exports follow the formatting conventions most ATS parsers handle correctly.",
                },
              ].map((t) => (
                <div key={t.statement} className="flex items-start gap-4 px-6 py-5">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    {t.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-0.5">{t.statement}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Proof + Before/After ─────────────────────────────────────────── */}
      <section id="proof" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">
            See it in action
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
            The exact output ResuOne produces
          </h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Real gaps. Specific fixes. The same experience — presented with the language the role calls for.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start max-w-5xl mx-auto">
          {/* Left — proof mock */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-violet-500/8 to-indigo-500/5 rounded-3xl blur-xl pointer-events-none" />
            <div className="relative bg-card border border-border rounded-2xl shadow-lg overflow-hidden text-left">
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white/20" />
                <div className="w-2 h-2 rounded-full bg-white/20" />
                <div className="w-2 h-2 rounded-full bg-white/20" />
                <span className="ml-2 text-xs text-white/60 font-medium">
                  ResuOne — Senior Business Analyst
                </span>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                  <div>
                    <p className="text-xs font-semibold text-amber-700">Match score</p>
                    <p className="text-xs text-muted-foreground mt-0.5">3 critical gaps found</p>
                  </div>
                  <span className="text-3xl font-black text-amber-600">72%</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold text-emerald-700 mb-2 uppercase tracking-wide">Matched</p>
                    {["Excel", "data modelling", "reporting"].map((k) => (
                      <div key={k} className="flex items-center gap-1.5 text-xs text-emerald-700 mb-1">
                        <CheckCircle2 className="w-3 h-3 flex-shrink-0" />{k}
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-rose-700 mb-2 uppercase tracking-wide">Missing</p>
                    {["SAP", "KPI reporting", "stakeholder comms"].map((k) => (
                      <div key={k} className="flex items-center gap-1.5 text-xs text-rose-700 mb-1">
                        <X className="w-3 h-3 flex-shrink-0" />{k}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Rewritten experience</p>
                  <div className="border border-border/60 rounded-lg bg-muted/20 p-3 mb-2">
                    <p className="text-xs text-foreground leading-relaxed">
                      Delivered monthly KPI reporting packs for senior stakeholders, reducing review cycle time by 40% through structured data modelling and automated Excel dashboards.
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {["KPI reporting", "data modelling"].map((k) => (
                        <span key={k} className="text-[10px] bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 rounded-full px-1.5 py-0.5 font-medium">{k}</span>
                      ))}
                    </div>
                  </div>
                  <div className="border border-dashed border-border/60 rounded-lg p-3 relative overflow-hidden">
                    <p className="text-xs text-muted-foreground leading-relaxed blur-sm select-none">
                      Coordinated cross-functional stakeholder communication across finance, operations, and procurement to deliver SAP reporting migration on schedule.
                    </p>
                    <div className="absolute inset-0 flex items-center justify-center bg-card/60">
                      <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 border border-border/60 bg-card px-2 py-1 rounded-full">
                        <Lock className="w-2.5 h-2.5" />2 more bullets — unlock for $6.99
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right — before/after */}
          <div className="space-y-4">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-6">
              Before &amp; after — same experience, sharper language
            </p>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="bg-muted/60 border-b border-border px-4 py-2.5 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-400" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Before</span>
                <span className="ml-auto text-xs text-rose-600 font-medium">35% match</span>
              </div>
              <div className="p-4">
                <p className="text-sm text-muted-foreground leading-relaxed italic mb-3">
                  "Worked with vendors and handled deliveries."
                </p>
                <div className="flex flex-wrap gap-1">
                  {["SAP", "KPI reporting", "stakeholder communication"].map((k) => (
                    <span key={k} className="inline-flex items-center gap-1 text-[10px] bg-rose-500/10 text-rose-700 border border-rose-500/20 rounded-full px-1.5 py-0.5 font-medium">
                      <X className="w-2 h-2" />{k} missing
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-1">
              <div className="flex-1 h-px bg-border/60" />
              <span className="flex items-center gap-1 font-medium">
                <Sparkles className="w-3 h-3 text-primary" />
                ResuOne rewrites using your existing experience
              </span>
              <div className="flex-1 h-px bg-border/60" />
            </div>

            <div className="rounded-xl border border-violet-500/30 bg-card overflow-hidden">
              <div className="bg-violet-500/5 border-b border-violet-500/20 px-4 py-2.5 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">After</span>
                <span className="ml-auto text-xs text-emerald-600 font-medium">88% match</span>
              </div>
              <div className="p-4">
                <p className="text-sm text-foreground leading-relaxed mb-3">
                  "Coordinated vendor workflows and{" "}
                  <mark className="bg-emerald-500/15 text-emerald-800 rounded px-0.5">delivery planning</mark>{" "}
                  to support{" "}
                  <mark className="bg-emerald-500/15 text-emerald-800 rounded px-0.5">operational readiness</mark>{" "}
                  and reduce timeline risk."
                </p>
                <div className="flex flex-wrap gap-1">
                  {["stakeholder communication", "KPI reporting"].map((k) => (
                    <span key={k} className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 rounded-full px-1.5 py-0.5 font-medium">
                      <CheckCircle2 className="w-2 h-2" />{k} added
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-3 italic">
                  No new experience invented — restructured from what was already in the CV.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Mid-page CTA */}
        <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-4 p-8 rounded-2xl border border-border/60 bg-muted/20">
          <div className="text-center sm:text-left">
            <p className="font-semibold mb-1">Ready to see your score?</p>
            <p className="text-sm text-muted-foreground">Free to analyse. See results before paying.</p>
          </div>
          <button
            onClick={login}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            Analyze CV — Free
          </button>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="bg-muted/20 border-y border-border/40">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">
              Pricing
            </p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              See the analysis first. Pay only for what you use.
            </h2>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              No subscription required to get a result.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Free */}
            <div className="bg-card border border-border rounded-2xl p-7 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 to-emerald-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">Start here — Free</p>
              <p className="text-4xl font-bold mb-1">$0</p>
              <p className="text-sm text-muted-foreground mb-6">No card. No commitment.</p>
              <ul className="space-y-2.5 text-sm flex-1 mb-7">
                {["Match score", "Missing keywords", "Partial optimised preview", "See results before paying"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <button onClick={login} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                <ArrowRight className="w-4 h-4" />Start for free
              </button>
            </div>

            {/* Unlock */}
            <div className="bg-card border border-border rounded-2xl p-7 flex flex-col">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Unlock</p>
              <p className="text-4xl font-bold mb-1">$6.99<span className="text-lg font-normal text-muted-foreground"> per result</span></p>
              <p className="text-sm text-muted-foreground mb-6">No subscription. Instant access.</p>
              <ul className="space-y-2.5 text-sm flex-1 mb-7">
                {["Full optimised CV", "Cover letter", "Edit before export", "DOCX & PDF download", "Yours forever — no expiry"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <button onClick={login} className="w-full py-2.5 rounded-xl border border-border hover:border-primary/40 text-sm font-semibold transition-colors">
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
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Pro</p>
              </div>
              <p className="text-4xl font-bold mb-1">$14.99<span className="text-lg font-normal text-muted-foreground">/mo</span></p>
              <p className="text-sm text-muted-foreground mb-6">Cancel any time.</p>
              <ul className="space-y-2.5 text-sm flex-1 mb-7">
                {["100 credits per month", "Full CV rewrites", "Cover letter generation", "DOCX & PDF export", "Edit before export", "Cancel any time"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <BadgeCheck className="w-4 h-4 text-violet-500 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <button onClick={login} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-semibold transition-all shadow-md">
                Get Pro — $14.99/mo
              </button>
              <p className="text-center text-xs text-muted-foreground mt-3">Cancel any time. No long-term commitment.</p>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Each optimisation or cover letter costs 1 credit. Exports are always free. Pro credits reset each billing period.
          </p>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section>
        <div className="max-w-2xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">FAQ</p>
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
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 px-8 py-16 text-center text-white">
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
              Start identifying and inviting
              <br />
              the right candidates today.
            </h2>
            <p className="text-violet-200 text-lg mb-10 max-w-md mx-auto">
              Upload a CV, get a match score, send an invite. Hiring doesn't need to be complicated.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={login}
                className="flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-violet-700 font-semibold text-base hover:bg-violet-50 transition-colors shadow-lg"
              >
                <FileText className="w-4 h-4" />
                Analyze CV
              </button>
              <button
                onClick={login}
                className="flex items-center gap-2 px-8 py-4 rounded-xl bg-white/10 border border-white/30 text-white font-semibold text-base hover:bg-white/20 transition-colors"
              >
                <Users className="w-4 h-4" />
                Try Recruiter Flow
              </button>
            </div>
            <p className="text-violet-300 text-xs mt-5">
              Free to start · No card required
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
