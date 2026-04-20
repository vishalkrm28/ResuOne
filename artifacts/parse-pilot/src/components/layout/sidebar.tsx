import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
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
} from "lucide-react";
import { LogoBrand } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/new", label: "New Application", icon: FilePlus2 },
  { href: "/bulk/history", label: "Bulk Mode", icon: Users },
  { href: "/jobs/recommendations", label: "Find Jobs", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings2 },
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

const recruiterItems = [
  { href: "/recruiter/dashboard", label: "Candidates", icon: BriefcaseBusiness },
  { href: "/recruiter/pipeline", label: "Pipeline", icon: LayoutGrid },
  { href: "/recruiter/pricing", label: "Recruiter Plans", icon: CreditCard },
];

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

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email?.split("@")[0] ||
    "User";

  return (
    <aside className="w-64 h-screen sticky top-0 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-sidebar-border">
        <Link href="/">
          <LogoBrand size="md" className="cursor-pointer text-sidebar-foreground" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Menu
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            location === href ||
            (href === "/" && location === "/dashboard") ||
            (href === "/bulk/history" && location.startsWith("/bulk"));
          return (
            <Link key={href} href={href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors group",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 flex-shrink-0",
                    isActive
                      ? "text-primary"
                      : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground",
                  )}
                />
                <span className="flex-1">{label}</span>
                {isActive && (
                  <ChevronRight className="w-3.5 h-3.5 text-primary/60" />
                )}
              </div>
            </Link>
          );
        })}

        {/* Application section */}
        <div className="pt-3">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Applications
          </p>
          {applicationItems.map(({ href, label, icon: Icon }) => {
            const isActive = location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors group",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      isActive
                        ? "text-primary"
                        : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground",
                    )}
                  />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary/60" />}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Job Tracker section */}
        <div className="pt-3">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Job Tracker
          </p>
          {trackerItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/tracker"
                ? location === "/tracker" || location.startsWith("/tracker/") && !location.startsWith("/tracker/saved") && !location.startsWith("/tracker/interview")
                : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors group",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      isActive
                        ? "text-primary"
                        : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground",
                    )}
                  />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary/60" />}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Recruiter section */}
        <div className="pt-3">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Recruiter
          </p>
          {recruiterItems.map(({ href, label, icon: Icon }) => {
            const isRecruiterActive =
              href === "/recruiter/dashboard"
                ? location.startsWith("/recruiter") && !location.startsWith("/recruiter/pricing")
                : location === href;
            return (
              <Link key={href} href={href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors group",
                    isRecruiterActive
                      ? "bg-primary/15 text-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      isRecruiterActive
                        ? "text-primary"
                        : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground",
                    )}
                  />
                  <span className="flex-1">{label}</span>
                  {isRecruiterActive && (
                    <ChevronRight className="w-3.5 h-3.5 text-primary/60" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-sidebar-border">
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
