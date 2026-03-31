import { useParams } from "wouter";
import { Link } from "wouter";
import { SeoLayout, CtaButton } from "@/components/layout/seo-layout";
import { getPost, blogPosts } from "./posts";
import { ArrowLeft, Calendar, Clock, ArrowRight } from "lucide-react";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = getPost(slug);

  if (!post) {
    return (
      <SeoLayout title="Post Not Found | ParsePilot Blog" description="This blog post could not be found.">
        <div className="text-center py-32 px-6">
          <p className="text-muted-foreground text-lg mb-6">This article doesn't exist.</p>
          <Link href="/blog" className="text-primary hover:underline font-medium">← Back to Blog</Link>
        </div>
      </SeoLayout>
    );
  }

  const others = blogPosts.filter(p => p.slug !== slug).slice(0, 2);

  return (
    <SeoLayout title={`${post.title} | ParsePilot Blog`} description={post.description}>
      {/* Back link */}
      <div className="max-w-2xl mx-auto px-6 pt-8">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Blog
        </Link>
      </div>

      {/* Header */}
      <article className="max-w-2xl mx-auto px-6 pt-6 pb-16">
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{post.date}</span>
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{post.readTime}</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-4 leading-tight">{post.title}</h1>
        <p className="text-muted-foreground text-base leading-relaxed mb-10 border-b border-border/40 pb-8">{post.description}</p>

        {/* Content */}
        <div className="space-y-5">
          {post.content.map((section, i) => {
            if (section.type === "h2") {
              return <h2 key={i} className="text-xl font-bold text-foreground mt-8 mb-2">{section.text}</h2>;
            }
            if (section.type === "p") {
              return <p key={i} className="text-muted-foreground leading-relaxed text-base">{section.text}</p>;
            }
            if (section.type === "ul") {
              return (
                <ul key={i} className="space-y-2">
                  {section.items?.map((item, j) => (
                    <li key={j} className="flex gap-3 text-muted-foreground text-sm leading-relaxed">
                      <span className="text-primary mt-1 shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              );
            }
            if (section.type === "cta") {
              return (
                <div key={i} className="bg-primary/5 border border-primary/15 rounded-2xl p-6 text-center my-8">
                  <p className="font-semibold text-foreground mb-4">Fix your resume automatically — in 60 seconds</p>
                  <CtaButton label="Analyze your CV now" />
                </div>
              );
            }
            return null;
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 pt-8 border-t border-border/40 text-center">
          <p className="text-foreground font-semibold mb-4">Apply everything in this article — automatically</p>
          <CtaButton label="Analyze your CV now" />
        </div>
      </article>

      {/* Related posts */}
      {others.length > 0 && (
        <section className="bg-muted/20 border-t border-border/40 py-12 px-6">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-6">More Articles</p>
            <div className="grid md:grid-cols-2 gap-5">
              {others.map(p => (
                <Link key={p.slug} href={`/blog/${p.slug}`}>
                  <div className="group border border-border/40 rounded-xl p-5 hover:border-primary/30 hover:bg-background transition-all cursor-pointer">
                    <p className="text-xs text-muted-foreground mb-2">{p.readTime}</p>
                    <p className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm mb-1">{p.title}</p>
                    <span className="text-xs text-primary flex items-center gap-1 group-hover:gap-2 transition-all">Read <ArrowRight className="w-3 h-3" /></span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </SeoLayout>
  );
}
