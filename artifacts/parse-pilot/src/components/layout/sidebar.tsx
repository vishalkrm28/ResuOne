import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useBillingStatus } from "@/hooks/use-billing-status";
import {
  LayoutDashboard,
  FilePlus2,
  LogOut,
  ChevronRight,
  Settings2,
  Users,
  BriefcaseBusiness,
  LayoutGrid,
  CreditCard,
  Sparkles,
  FileText,
  MailOpen,
  Bookmark,
  Mail,
  Mic,
  Bell,
  Link2,
  Building2,
  Globe,
  Star,
  MessageSquare,
  Video,
  ChevronDown,
} from "lucide-react";
import { LogoBrand } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

// ─── Nav data ─────────────────────────────────────────────────────────────────

const coreItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/new", label: "New Application", icon: FilePlus2 },
  { href: "/bulk/history", label: "Bulk Mode", icon: Users },
];

const jobsItems = [
  { href: "/jobs/recommendations", label: "Find Jobs", icon: Sparkles },
  { href: "/jobs/discover", label: "Global Jobs", icon: Globe },
];

// Exclusive jobs shown as an expandable group
const exclusiveJobsParent = { href: "/jobs/exclusive", label: "Resuone Jobs", icon: Star };
const exclusiveJobsChildren = [
  { href: "/jobs/exclusive/messages", label: "Messages", icon: MessageSquare },
  { href: "/jobs/exclusive/interviews", label: "Interviews", icon: Video },
];

const applicationItems = [
  { href: "/application/tailored-cvs", label: "Tailored CVs", icon: FileText },
  { href: "/application/cover-letters", label: "Cover Letters", icon: MailOpen },
];

const trackerItems = [
  { href: "/tracker", label: "Pipeline", icon: LayoutGrid },
  { href: "/tracker/saved", label: "Saved Jobs", icon: Bookmark },
  { href: "/tracker/interview-preps", label: "Interview Preps", icon: Sparkles },
  { href: "/emails", label: "Email Drafts", icon: Mail },
  { href: "/mock-interview", label: "Mock Interviews", icon: Mic },
];

const accountItems = [
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/billing", label: "Billing & Plan", icon: CreditCard },
  { href: "/workspaces", label: "Workspaces", icon: Building2 },
  { href: "/integrations", label: "Integrations", icon: Link2 },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

// Exclusive recruiter items shown as sub-items of "Exclusive Jobs"
const recruiterCoreItems = [
  { href: "/recruiter/dashboard", label: "Candidates", icon: BriefcaseBusiness },
  { href: "/recruiter/pipeline", label: "Pipeline", icon: LayoutGrid },
];
const recruiterExclusiveParent = { href: "/recruiter/exclusive-jobs", label: "Exclusive Jobs", icon: Star };
const recruiterExclusiveChildren = [
  { href: "/recruiter/exclusive-messages", label: "Messages", icon: MessageSquare },
  { href: "/recruiter/exclusive-interviews", label: "Schedule", icon: Video },
];
const recruiterTailItems = [
  { href: "/recruiter/pricing", label: "Recruiter Plans", icon: CreditCard },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function UserAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/20 flex-shrink-0"
      />
    );
  }
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold ring-2 ring-primary/20 flex-shrink-0">
      {initials}
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  indent = false,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  indent?: boolean;
}) {
  return (
    <Link href={href}>
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg text-sm font-medium cursor-pointer transition-colors group",
          indent ? "px-3 py-1.5 ml-4" : "px-3 py-2.5",
          isActive
            ? "bg-primary/15 text-primary"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
      >
        <Icon
          className={cn(
            "flex-shrink-0",
            indent ? "w-3.5 h-3.5" : "w-4 h-4",
            isActive
              ? "text-primary"
              : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground",
          )}
        />
        <span className="flex-1">{label}</span>
        {isActive && !indent && (
          <ChevronRight className="w-3.5 h-3.5 text-primary/60" />
        )}
      </div>
    </Link>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
      {label}
    </p>
  );
}

// ─── Main sidebar ──────────────────────────────────────────────────────────────

export function Sidebar() {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { status: billingStatus } = useBillingStatus();
  const isRecruiter = billingStatus?.isRecruiter ?? false;

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email?.split("@")[0] ||
    "User";

  // Expandable group state — auto-open when entering the area, but user can collapse manually
  const [exclusiveOpen, setExclusiveOpen] = useState(() => location.startsWith("/jobs/exclusive"));
  const [recruiterExclusiveOpen, setRecruiterExclusiveOpen] = useState(() => location.startsWith("/recruiter/exclusive"));

  const inExclusive = location.startsWith("/jobs/exclusive");
  const inRecruiterExclusive = location.startsWith("/recruiter/exclusive");

  return (
    <aside className="w-56 h-screen sticky top-0 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <Link href="/">
          <LogoBrand size="md" className="cursor-pointer text-sidebar-foreground" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">

        {/* Core */}
        <SectionLabel label="Menu" />
        {coreItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            location === href ||
            (href === "/" && location === "/dashboard") ||
            (href === "/bulk/history" && location.startsWith("/bulk"));
          return <NavItem key={href} href={href} label={label} icon={Icon} isActive={isActive} />;
        })}

        {/* Jobs */}
        <SectionLabel label="Jobs" />
        {jobsItems.map(({ href, label, icon: Icon }) => (
          <NavItem key={href} href={href} label={label} icon={Icon} isActive={location.startsWith(href)} />
        ))}

        {/* Resuone Jobs — expandable group */}
        <div
          role="button"
          onClick={() => {
            if (inExclusive) {
              setExclusiveOpen((o) => !o);
            } else {
              navigate(exclusiveJobsParent.href);
              setExclusiveOpen(true);
            }
          }}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors group",
            inExclusive
              ? "bg-primary/15 text-primary"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
          )}
        >
          <Star
            className={cn(
              "w-4 h-4 flex-shrink-0",
              inExclusive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground",
            )}
          />
          <span className="flex-1">{exclusiveJobsParent.label}</span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 transition-transform flex-shrink-0",
              exclusiveOpen ? "rotate-0 text-primary/60" : "-rotate-90 text-sidebar-foreground/30",
            )}
          />
        </div>
        {exclusiveOpen && exclusiveJobsChildren.map(({ href, label, icon: Icon }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            icon={Icon}
            isActive={location === href}
            indent
          />
        ))}

        {/* Applications */}
        <SectionLabel label="Applications" />
        {applicationItems.map(({ href, label, icon: Icon }) => (
          <NavItem key={href} href={href} label={label} icon={Icon} isActive={location.startsWith(href)} />
        ))}

        {/* Job Tracker */}
        <SectionLabel label="Job Tracker" />
        {trackerItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/tracker"
              ? location === "/tracker" ||
                (location.startsWith("/tracker/") &&
                  !location.startsWith("/tracker/saved") &&
                  !location.startsWith("/tracker/interview"))
              : href === "/tracker/interview-preps"
                ? location.startsWith("/tracker/interview-preps") ||
                  location.startsWith("/tracker/interview-prep/")
                : location.startsWith(href);
          return <NavItem key={href} href={href} label={label} icon={Icon} isActive={isActive} />;
        })}

        {/* Account */}
        <SectionLabel label="Account" />
        {accountItems.map(({ href, label, icon: Icon }) => (
          <NavItem key={href} href={href} label={label} icon={Icon} isActive={location === href} />
        ))}

        {/* Recruiter — only shown to recruiter subscribers */}
        {isRecruiter && (
          <>
            <SectionLabel label="Recruiter" />
            {recruiterCoreItems.map(({ href, label, icon: Icon }) => {
              const isActive =
                href === "/recruiter/dashboard"
                  ? location.startsWith("/recruiter") &&
                    !location.startsWith("/recruiter/pricing") &&
                    !location.startsWith("/recruiter/exclusive") &&
                    !location.startsWith("/recruiter/pipeline")
                  : location.startsWith(href);
              return <NavItem key={href} href={href} label={label} icon={Icon} isActive={isActive} />;
            })}

            {/* Recruiter exclusive jobs — expandable */}
            <div
              role="button"
              onClick={() => {
                if (inRecruiterExclusive) {
                  setRecruiterExclusiveOpen((o) => !o);
                } else {
                  navigate(recruiterExclusiveParent.href);
                  setRecruiterExclusiveOpen(true);
                }
              }}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors group",
                inRecruiterExclusive
                  ? "bg-primary/15 text-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <Star
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  inRecruiterExclusive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground",
                )}
              />
              <span className="flex-1">{recruiterExclusiveParent.label}</span>
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 transition-transform flex-shrink-0",
                  recruiterExclusiveOpen ? "rotate-0 text-primary/60" : "-rotate-90 text-sidebar-foreground/30",
                )}
              />
            </div>
            {recruiterExclusiveOpen && recruiterExclusiveChildren.map(({ href, label, icon: Icon }) => (
              <NavItem
                key={href}
                href={href}
                label={label}
                icon={Icon}
                isActive={location === href}
                indent
              />
            ))}

            {recruiterTailItems.map(({ href, label, icon: Icon }) => (
              <NavItem key={href} href={href} label={label} icon={Icon} isActive={location === href} />
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-sidebar-accent/50">
          <UserAvatar name={displayName} imageUrl={user?.profileImageUrl} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">
              {displayName}
            </p>
            {user?.email && (
              <p className="text-xs text-sidebar-foreground/50 truncate">{user.email}</p>
            )}
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-border/60 transition-colors flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
