import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/layout/footer";

interface SeoLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function SeoLayout({ title, description, children }: SeoLayoutProps) {
  useEffect(() => {
    document.title = title;
    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.name = "description";
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = description;
  }, [title, description]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/40">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src="/resuone-logo.png" alt="ResuOne" className="h-8 w-auto object-contain" />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/blog" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Blog</Link>
            <Link href="/dashboard" className="bg-primary text-primary-foreground px-4 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5">
              Try Free <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <Footer />
    </div>
  );
}

export function CtaButton({ label = "Analyze your CV now", className = "" }: { label?: string; className?: string }) {
  return (
    <Link href="/dashboard">
      <button className={`inline-flex items-center gap-2 bg-primary text-primary-foreground px-7 py-3.5 rounded-xl font-semibold text-base hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 ${className}`}>
        {label} <ArrowRight className="w-4 h-4" />
      </button>
    </Link>
  );
}

interface FaqItem { q: string; a: string; }
export function FaqSection({ items }: { items: FaqItem[] }) {
  return (
    <section className="py-16 max-w-2xl mx-auto px-6">
      <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={i} className="border border-border/60 rounded-xl p-5">
            <p className="font-semibold text-foreground mb-1.5">{item.q}</p>
            <p className="text-muted-foreground text-sm leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RelatedPages({ current }: { current: string }) {
  const pages = [
    { href: "/cv-match-score", label: "CV Match Score" },
    { href: "/ats-resume-checker", label: "ATS Resume Checker" },
    { href: "/resume-keyword-optimizer", label: "Keyword Optimizer" },
    { href: "/resume-job-match", label: "Resume vs Job Match" },
    { href: "/why-resume-rejected", label: "Why Resumes Get Rejected" },
  ].filter(p => p.href !== current);

  return (
    <section className="py-10 border-t border-border/40">
      <div className="max-w-4xl mx-auto px-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Related Tools</p>
        <div className="flex flex-wrap gap-3">
          {pages.map(p => (
            <Link key={p.href} href={p.href} className="text-sm text-primary hover:underline border border-primary/20 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors">
              {p.label}
            </Link>
          ))}
          <Link href="/blog" className="text-sm text-primary hover:underline border border-primary/20 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors">
            Blog
          </Link>
        </div>
      </div>
    </section>
  );
}
