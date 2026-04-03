import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useAuth } from "@workspace/replit-auth-web";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { registerClerkTokenGetter } from "@/lib/authed-fetch";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import NewApplication from "@/pages/new-application";
import ApplicationDetail from "@/pages/application-detail";
import BillingSuccess from "@/pages/billing-success";
import BillingCancel from "@/pages/billing-cancel";
import UnlockSuccess from "@/pages/unlock-success";
import Settings from "@/pages/settings";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import Contact from "@/pages/contact";
import BulkPricing from "@/pages/bulk-pricing";
import BulkSuccess from "@/pages/bulk-success";
import BulkSession from "@/pages/bulk-session";
import BulkHistory from "@/pages/bulk-history";
import BulkSessionDetail from "@/pages/bulk-session-detail";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";
import RecruiterDashboard from "@/pages/recruiter/dashboard";
import RecruiterPipeline from "@/pages/recruiter/pipeline";
import CandidateDetail from "@/pages/recruiter/candidate-detail";
import RecruiterPricing from "@/pages/recruiter/pricing";
import TeamJoin from "@/pages/recruiter/team-join";
import InviteResponse from "@/pages/invite-response";
import CvMatchScore from "@/pages/seo/cv-match-score";
import AtsResumeChecker from "@/pages/seo/ats-resume-checker";
import ResumeKeywordOptimizer from "@/pages/seo/resume-keyword-optimizer";
import ResumeJobMatch from "@/pages/seo/resume-job-match";
import WhyResumeRejected from "@/pages/seo/why-resume-rejected";
import BlogIndex from "@/pages/blog/index";
import BlogPost from "@/pages/blog/post";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is not set");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ClerkTokenSync() {
  const { getToken } = useClerkAuth();
  useEffect(() => {
    registerClerkTokenGetter(getToken);
    return () => registerClerkTokenGetter(null);
  }, [getToken]);
  return null;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, login } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  return <>{children}</>;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/new" component={NewApplication} />
      <Route path="/applications/:id" component={ApplicationDetail} />
      <Route path="/billing/success" component={BillingSuccess} />
      <Route path="/billing/cancel" component={BillingCancel} />
      <Route path="/billing/unlock-success" component={UnlockSuccess} />
      <Route path="/settings" component={Settings} />
      <Route path="/bulk" component={BulkPricing} />
      <Route path="/bulk/success" component={BulkSuccess} />
      <Route path="/bulk/session" component={BulkSession} />
      <Route path="/bulk/history" component={BulkHistory} />
      <Route path="/bulk/sessions/:id" component={BulkSessionDetail} />
      <Route path="/recruiter/dashboard" component={RecruiterDashboard} />
      <Route path="/recruiter/pipeline" component={RecruiterPipeline} />
      <Route path="/recruiter/pricing" component={RecruiterPricing} />
      <Route path="/candidate/:id" component={CandidateDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <ClerkTokenSync />
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Switch>
              {/* Public routes — no auth required */}
              <Route path="/terms" component={Terms} />
              <Route path="/privacy" component={Privacy} />
              <Route path="/contact" component={Contact} />
              {/* SEO landing pages */}
              <Route path="/cv-match-score" component={CvMatchScore} />
              <Route path="/ats-resume-checker" component={AtsResumeChecker} />
              <Route path="/resume-keyword-optimizer" component={ResumeKeywordOptimizer} />
              <Route path="/resume-job-match" component={ResumeJobMatch} />
              <Route path="/why-resume-rejected" component={WhyResumeRejected} />
              {/* Blog */}
              <Route path="/blog" component={BlogIndex} />
              <Route path="/blog/:slug" component={BlogPost} />
              {/* Public invite response (candidates, no auth) */}
              <Route path="/invite/:id" component={InviteResponse} />
              {/* Team invite join (requires sign-in inside the page) */}
              <Route path="/recruiter/team/join/:token" component={TeamJoin} />
              {/* Admin — own token-based auth */}
              <Route path="/admin" component={AdminPage} />
              {/* Everything else goes through the auth gate */}
              <Route>
                <AuthGate>
                  <AppRouter />
                </AuthGate>
              </Route>
            </Switch>
            <Toaster />
          </WouterRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
