import { Link } from "wouter";
import { SeoLayout, CtaButton } from "@/components/layout/seo-layout";
import { blogPosts } from "./posts";
import { ArrowRight, Clock, Calendar } from "lucide-react";

export default function BlogIndex() {
  return (
    <SeoLayout
      title="ResuOne Blog – Resume Tips, ATS Advice & Job Search Guides"
      description="Expert guides on beating ATS systems, fixing common resume mistakes, and getting more interviews. Free advice from the ResuOne team."
    >
      {/* Hero */}
      <section className="pt-16 pb-10 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground mb-4">Resume Advice That Actually Works</h1>
          <p className="text-muted-foreground text-lg">Practical guides on ATS optimisation, resume writing, and getting more interviews.</p>
        </div>
      </section>

      {/* Posts */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <div className="space-y-6">
          {blogPosts.map(post => (
            <Link key={post.slug} href={`/blog/${post.slug}`}>
              <article className="group border border-border/40 rounded-2xl p-6 hover:border-primary/30 hover:bg-primary/2 transition-all cursor-pointer">
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{post.date}</span>
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{post.readTime}</span>
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{post.title}</h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">{post.description}</p>
                <span className="text-primary text-sm font-medium flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                  Read article <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </article>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary/5 border-t border-primary/10 text-center px-6">
        <h2 className="text-2xl font-bold mb-3">Ready to optimise your resume?</h2>
        <p className="text-muted-foreground mb-8">Apply everything you've read — automatically, in 60 seconds.</p>
        <CtaButton label="Analyze your CV now" />
      </section>
    </SeoLayout>
  );
}
