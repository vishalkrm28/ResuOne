import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Sparkles, ArrowLeft, Mail, Send, CheckCircle } from "lucide-react";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";

function trackEvent(event: string, props?: Record<string, unknown>) {
  if (typeof window !== "undefined") {
    console.info("[analytics]", event, props);
  }
}

export default function Contact() {
  useEffect(() => { trackEvent("contact_page_viewed"); }, []);

  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Partial<typeof form>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const validate = () => {
    const errs: Partial<typeof form> = {};
    if (!form.name.trim()) errs.name = "Name is required.";
    if (!form.email.trim()) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = "Please enter a valid email address.";
    }
    if (!form.message.trim()) {
      errs.message = "Message is required.";
    } else if (form.message.trim().length < 10) {
      errs.message = "Message must be at least 10 characters.";
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setStatus("submitting");
    setServerError(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }

      setStatus("success");
      setForm({ name: "", email: "", message: "" });
      trackEvent("contact_submitted", { hasUser: !!document.cookie.includes("session") });
    } catch (err: any) {
      setStatus("error");
      setServerError(err.message ?? "Failed to send. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="border-b border-border/40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">ResuOne</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-2xl mx-auto px-6 py-16 w-full">
        {/* Heading */}
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2">Contact</h1>
          <p className="text-muted-foreground">
            Have a question or need help? Send us a message and we'll get back to you.
          </p>
        </div>

        {status === "success" ? (
          <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800/40">
            <CardContent className="flex flex-col items-center text-center gap-4 py-12 px-8">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold mb-1">Message sent</h2>
                <p className="text-sm text-muted-foreground">
                  Your message has been sent. We'll get back to you soon.
                </p>
              </div>
              <button
                onClick={() => setStatus("idle")}
                className="text-sm text-primary font-medium hover:underline mt-2"
              >
                Send another message
              </button>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1.5">
                Name <span className="text-destructive">*</span>
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm bg-background text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:ring-2 focus:ring-primary/30 ${
                  errors.name ? "border-destructive" : "border-input focus:border-primary"
                }`}
                placeholder="Your name"
              />
              {errors.name && (
                <p className="text-xs text-destructive mt-1">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                Email <span className="text-destructive">*</span>
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm bg-background text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:ring-2 focus:ring-primary/30 ${
                  errors.email ? "border-destructive" : "border-input focus:border-primary"
                }`}
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="text-xs text-destructive mt-1">{errors.email}</p>
              )}
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-foreground mb-1.5">
                Message <span className="text-destructive">*</span>
              </label>
              <textarea
                id="message"
                rows={6}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm bg-background text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:ring-2 focus:ring-primary/30 resize-none ${
                  errors.message ? "border-destructive" : "border-input focus:border-primary"
                }`}
                placeholder="How can we help you?"
              />
              {errors.message && (
                <p className="text-xs text-destructive mt-1">{errors.message}</p>
              )}
            </div>

            {/* Server error */}
            {status === "error" && serverError && (
              <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-4 py-3">
                {serverError}
              </p>
            )}

            {/* Submit */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="submit"
                disabled={status === "submitting"}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {status === "submitting" ? (
                  <>
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Message
                  </>
                )}
              </button>

              {/* Direct email */}
              <a
                href="mailto:help@parsepilot.io"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                help@parsepilot.io
              </a>
            </div>
          </form>
        )}

        {/* Always-visible direct email hint below form */}
        {status !== "success" && (
          <p className="mt-8 text-xs text-muted-foreground/70 text-center">
            Or email us directly at{" "}
            <a href="mailto:help@parsepilot.io" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">
              help@parsepilot.io
            </a>
          </p>
        )}
      </main>

      <Footer />
    </div>
  );
}
