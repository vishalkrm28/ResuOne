import { Sidebar } from "./sidebar";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Link } from "wouter";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 flex">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-40 bg-background border-b border-border flex items-center justify-between px-4 h-14">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center">
            <img src="/resuone-logo.png" alt="ResuOne" className="h-7 w-auto object-contain" />
          </div>
          <div className="w-9" /> {/* spacer */}
        </header>

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8">
          {children}
        </main>

        {/* Subtle legal footer for authenticated users */}
        <div className="border-t border-border/30 px-6 py-4 flex items-center justify-center gap-5 text-xs text-muted-foreground/50">
          <Link href="/terms" className="hover:text-muted-foreground transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-muted-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/contact" className="hover:text-muted-foreground transition-colors">
            Contact
          </Link>
          <span>© {new Date().getFullYear()} ResuOne</span>
        </div>
      </div>
    </div>
  );
}
