import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-muted/10">
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">

        {/* Brand mark */}
        <div className="flex items-center justify-center mb-10">
          <img src="/resuone-logo.png" alt="ResuOne" className="h-10 w-auto object-contain" />
        </div>

        {/* Main bold statement */}
        <p className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground leading-tight mb-4">
          You're not getting rejected.
          <br />
          <span className="text-primary">Your CV is.</span> Fix that.
        </p>

        {/* Subline */}
        <p className="text-sm text-muted-foreground mb-10">
          ATS-friendly &nbsp;•&nbsp; No fake experience added &nbsp;•&nbsp; Edit before export
        </p>

        {/* SEO tool links */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground/70 mb-6">
          <Link href="/cv-match-score" className="hover:text-muted-foreground transition-colors">CV Match Score</Link>
          <Link href="/ats-resume-checker" className="hover:text-muted-foreground transition-colors">ATS Checker</Link>
          <Link href="/resume-keyword-optimizer" className="hover:text-muted-foreground transition-colors">Keyword Optimizer</Link>
          <Link href="/resume-job-match" className="hover:text-muted-foreground transition-colors">Resume vs Job</Link>
          <Link href="/why-resume-rejected" className="hover:text-muted-foreground transition-colors">Why Rejected?</Link>
          <Link href="/blog" className="hover:text-muted-foreground transition-colors">Blog</Link>
        </div>

        {/* Legal links */}
        <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground/60">
          <Link
            href="/terms"
            className="hover:text-muted-foreground transition-colors"
          >
            Terms of Service
          </Link>
          <Link
            href="/privacy"
            className="hover:text-muted-foreground transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            href="/contact"
            className="hover:text-muted-foreground transition-colors"
          >
            Contact
          </Link>
          <span>© {new Date().getFullYear()} ResuOne</span>
        </div>

      </div>
    </footer>
  );
}
