import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FileText, Settings, Sparkles } from "lucide-react";
import { Button } from "@/components/Button";

export function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/new", label: "New Application", icon: FileText },
  ];

  return (
    <div className="flex h-screen w-72 flex-col bg-sidebar border-r border-sidebar-border text-sidebar-foreground shadow-2xl z-10 hidden md:flex fixed left-0 top-0">
      <div className="flex h-20 items-center px-8 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-3 transition-transform hover:scale-105 active:scale-95">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
            ParsePilot AI
          </span>
        </Link>
      </div>
      
      <div className="flex-1 py-8 px-4 flex flex-col gap-2">
        <div className="px-4 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
          Menu
        </div>
        {navItems.map((item) => {
          const isActive = location === item.href || (location.startsWith('/applications/') && item.href === '/');
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant="sidebar"
                className={cn(
                  "w-full justify-start gap-4 px-4 py-6 font-medium text-base rounded-xl transition-all duration-300",
                  isActive 
                    ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary border border-primary/20 shadow-inner" 
                    : "text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "")} />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </div>
      
      <div className="p-6 border-t border-sidebar-border">
        <div className="flex items-center gap-4 bg-sidebar-accent/50 p-4 rounded-xl border border-sidebar-accent">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
            U
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Local User</p>
            <p className="text-xs text-sidebar-foreground/60">Pro Plan</p>
          </div>
        </div>
      </div>
    </div>
  );
}
