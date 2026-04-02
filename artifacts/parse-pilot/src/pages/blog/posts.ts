export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
  content: BlogSection[];
}

export interface BlogSection {
  type: "h2" | "p" | "ul" | "cta";
  text?: string;
  items?: string[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: "how-to-beat-ats-systems-2026",
    title: "How to Beat ATS Systems in 2026",
    description: "Applicant Tracking Systems reject 75% of resumes automatically. Here's the exact strategy to get your CV through every filter and in front of a human recruiter.",
    date: "March 28, 2026",
    readTime: "6 min read",
    content: [
      { type: "p", text: "You apply for a job you're qualified for. You never hear back. Sound familiar? In most cases, your resume was rejected by an Applicant Tracking System (ATS) — automated software that screens applications before any human sees them. In 2026, 99% of Fortune 500 companies and the vast majority of mid-size businesses use ATS." },
      { type: "h2", text: "What ATS Systems Actually Do" },
      { type: "p", text: "An ATS parses your resume into structured fields — name, contact, work history, skills, education — and then scores it against the job description. The scoring is largely keyword-based. If your CV doesn't contain the phrases the employer used in their job posting, your score drops. Applications below a threshold score are automatically rejected." },
      { type: "h2", text: "The 5 Rules for Passing ATS in 2026" },
      { type: "ul", items: [
        "Use exact keywords from the job description — not synonyms. If the job says 'project management', don't write 'managing projects'. ATS systems often don't treat these as equivalent.",
        "Use standard section headings: Work Experience, Education, Skills. Custom headings like 'Where I've Been' confuse parsers.",
        "Avoid tables, columns, text boxes, and images. They break ATS parsing. A clean, single-column layout is always safer.",
        "Include your skills section as a simple list. ATS systems often extract skills from a dedicated section separately from experience.",
        "Tailor your CV for every application. A 65% match gets filtered out; an 85% match gets through. The difference is usually 10–15 specific phrases.",
      ]},
      { type: "h2", text: "The Keyword Problem" },
      { type: "p", text: "The hardest part of ATS optimisation is identifying which keywords matter most. A typical job description contains 300–500 words. Parsing it manually to extract the highest-priority terms, then checking your CV against each one, takes 30–45 minutes per application — which is why most candidates don't do it." },
      { type: "p", text: "This is exactly the problem ResuOne solves. It extracts every meaningful keyword from the job description, compares it against your CV, and rewrites your experience bullets to include the missing terms naturally — without inventing experience you don't have." },
      { type: "cta" },
      { type: "h2", text: "Soft Skills Still Matter — But Phrasing is Everything" },
      { type: "p", text: "Many candidates assume ATS only cares about hard skills (software, certifications, technical tools). In reality, soft skills like 'stakeholder management', 'cross-functional collaboration', and 'executive communication' are heavily weighted in senior roles. The catch: they need to appear using the job description's exact phrasing." },
      { type: "h2", text: "What to Do Right Now" },
      { type: "ul", items: [
        "Pull your current CV and the job description you're targeting.",
        "Highlight every phrase in the job description that doesn't appear in your CV.",
        "Rewrite your experience bullets to include those phrases where your real experience supports them.",
        "Or — use ResuOne to do all of this in 60 seconds.",
      ]},
      { type: "p", text: "ATS optimisation isn't about gaming the system. It's about making sure the system can actually see the qualifications you genuinely have. Don't let an algorithm filter you out before you get a fair shot." },
    ],
  },
  {
    slug: "resume-mistakes-that-get-you-rejected",
    title: "Resume Mistakes That Get You Rejected",
    description: "Most rejections have nothing to do with your qualifications. These are the 8 resume mistakes that silently kill your applications — and how to fix each one.",
    date: "March 22, 2026",
    readTime: "5 min read",
    content: [
      { type: "p", text: "If you're sending applications and hearing nothing back, the problem is almost certainly your resume — not your experience. Here are the most common mistakes that cause qualified candidates to get rejected before anyone reads their application." },
      { type: "h2", text: "1. Not Tailoring for Each Role" },
      { type: "p", text: "Sending the same generic CV to 50 different jobs is the single biggest mistake in job searching. ATS systems rank applications by keyword match. A resume that scores 40% against a job description will never reach a recruiter, even if you're the best candidate in the pool." },
      { type: "h2", text: "2. Listing Duties Instead of Achievements" },
      { type: "p", text: "'Responsible for managing a team of 5' tells a recruiter nothing. 'Led a team of 5 to deliver a £2M product launch 3 weeks ahead of schedule' is memorable and distinctive. Every bullet should show what you did and what resulted from it." },
      { type: "h2", text: "3. Generic Opening Summary" },
      { type: "p", text: "'Motivated professional seeking a challenging role…' — this opening gets skipped by every recruiter. Your summary should be 2–3 sentences that directly address the job you're applying for, using the employer's own language." },
      { type: "h2", text: "4. ATS-Incompatible Formatting" },
      { type: "ul", items: [
        "Tables and columns — ATS parsers often read these left-to-right as one merged line",
        "Text inside images or graphics — invisible to ATS",
        "Headers and footers — frequently missed by parsers",
        "Fancy fonts and heavy styling — can corrupt parsed output",
      ]},
      { type: "h2", text: "5. Missing Critical Keywords" },
      { type: "p", text: "If the job description mentions 'Salesforce CRM' and your CV says 'CRM tools', that's often scored as no match. Specific tool names, certifications, and methodologies need to appear verbatim." },
      { type: "cta" },
      { type: "h2", text: "6. Weak or Missing Skills Section" },
      { type: "p", text: "Many ATS systems extract skills from a dedicated section separately from your work history. A clear Skills section with job-relevant terms significantly improves your match score." },
      { type: "h2", text: "7. Gaps Without Context" },
      { type: "p", text: "Employment gaps aren't automatically disqualifying — but unexplained gaps create questions. A brief parenthetical (e.g. 'Career break — family care / freelance work / retraining') removes ambiguity." },
      { type: "h2", text: "8. No Cover Letter or a Generic One" },
      { type: "p", text: "A tailored cover letter that directly addresses the role's key requirements and explains why you want this specific job — not just any job — meaningfully increases response rates. Generic letters have zero impact." },
      { type: "p", text: "The good news: all of these mistakes are fixable. ResuOne identifies which ones apply to your CV and fixes them in under 60 seconds." },
    ],
  },
  {
    slug: "how-recruiters-scan-cvs",
    title: "How Recruiters Scan CVs",
    description: "Recruiters spend an average of 7 seconds on a first CV scan. Here's exactly what they look for, what makes them stop reading, and how to structure your resume to pass the scan.",
    date: "March 15, 2026",
    readTime: "4 min read",
    content: [
      { type: "p", text: "Eye-tracking studies show that recruiters spend an average of 6–7 seconds on the initial scan of a CV. In that time, they're making a pass/fail decision. Understanding what they're looking at — and in what order — changes how you should structure your resume." },
      { type: "h2", text: "The 7-Second Scan Pattern" },
      { type: "p", text: "Recruiter eye-tracking research consistently shows the same pattern: they start with your name and current title, move to your most recent role (job title and company name), then scan for dates, then look at education. The summary and everything else comes later — if you make the first cut." },
      { type: "ul", items: [
        "Name and current/most recent job title — immediately visible at the top",
        "Current or most recent employer — must be recognisable or clearly described",
        "Employment dates — checked for gaps and recency",
        "Education and credentials — scanned for relevance",
        "Skills section — specifically for keyword confirmation",
      ]},
      { type: "h2", text: "What Makes a Recruiter Stop Reading" },
      { type: "ul", items: [
        "A generic job title that doesn't match the role they're hiring for",
        "A company name they don't recognise with no context (add industry/size/description in one line)",
        "A long paragraph instead of scannable bullet points",
        "Duties instead of achievements — no quantified impact",
        "Poor formatting that makes the page feel dense and hard to navigate",
      ]},
      { type: "h2", text: "The ATS Layer Before Human Review" },
      { type: "p", text: "Before a recruiter ever sees your CV, it's already been scored by an ATS. Only applications above a certain threshold score get opened at all. This means you're actually facing two filters: the algorithm and the human. Most candidates optimise for neither." },
      { type: "cta" },
      { type: "h2", text: "How to Structure Your CV for Both Filters" },
      { type: "ul", items: [
        "Put your most important credentials at the top — title, current employer, years of experience",
        "Use bullet points (not paragraphs) for every role — 3–5 bullets per position",
        "Lead each bullet with an action verb and end with a quantified result where possible",
        "Keep formatting clean, single-column, and readable in 7 seconds",
        "Tailor the top third of your CV for each application — this is what gets read first",
      ]},
      { type: "h2", text: "The Summary Section" },
      { type: "p", text: "A well-written professional summary — 2–3 sentences that directly address the role — significantly improves recruiter engagement. It's the one part of your CV where you can speak directly to the employer. Use it to say: here's why I'm right for this specific job, in the employer's own language." },
      { type: "p", text: "ResuOne rewrites your CV summary for each application based on the job description, so it speaks directly to what the recruiter is looking for." },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return blogPosts.find(p => p.slug === slug);
}
