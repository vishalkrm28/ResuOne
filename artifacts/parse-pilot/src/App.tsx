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
import HelpPage from "@/pages/help";
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
import RecruiterJobs from "@/pages/recruiter/jobs";
import RecruiterJobDetail from "@/pages/recruiter/job-detail";
import RecruiterJobRanking from "@/pages/recruiter/job-ranking";
import JobRecommendations from "@/pages/jobs/recommendations";
import GlobalJobDiscover from "@/pages/jobs/discover";
import ExclusiveJobs from "@/pages/jobs/exclusive";
import RecruiterExclusiveJobs from "@/pages/recruiter/exclusive-jobs";
import TailoredCvsPage from "@/pages/application/tailored-cvs";
import TailoredCvDetailPage from "@/pages/application/tailored-cv-detail";
import CoverLettersPage from "@/pages/application/cover-letters";
import InviteResponse from "@/pages/invite-response";
import CvMatchScore from "@/pages/seo/cv-match-score";
import AtsResumeChecker from "@/pages/seo/ats-resume-checker";
import ResumeKeywordOptimizer from "@/pages/seo/resume-keyword-optimizer";
import ResumeJobMatch from "@/pages/seo/resume-job-match";
import WhyResumeRejected from "@/pages/seo/why-resume-rejected";
import DynamicSeoPage from "@/pages/seo/dynamic";
import PricingPage from "@/pages/marketing/pricing";
import ForCandidatesPage from "@/pages/marketing/for-candidates";
import ForRecruitersPage from "@/pages/marketing/for-recruiters";
import WaitlistPage from "@/pages/marketing/waitlist";
import FeaturesPage from "@/pages/marketing/features";
import FeatureDetailPage from "@/pages/marketing/feature-detail";
import UseCasePage from "@/pages/marketing/use-case";
import BlogIndex from "@/pages/blog/index";
import BlogPost from "@/pages/blog/post";
import TrackerPipeline from "@/pages/tracker/pipeline";
import SavedJobsPage from "@/pages/tracker/saved-jobs";
import AppDetailPage from "@/pages/tracker/app-detail";
import InterviewPrepsPage from "@/pages/tracker/interview-preps";
import InterviewPrepDetailPage from "@/pages/tracker/interview-prep-detail";
import GenerateInterviewPrepPage from "@/pages/tracker/generate-interview-prep";
import EmailsPage from "@/pages/emails/index";
import MockInterviewListPage from "@/pages/mock-interview/index";
import MockInterviewSessionPage from "@/pages/mock-interview/session";
import NotificationsPage from "@/pages/notifications/index";
import NotificationSettingsPage from "@/pages/settings/notifications";
import IntegrationsPage from "@/pages/integrations/index";
import WorkspacesPage from "@/pages/workspaces/index";
import WorkspaceDetailPage from "@/pages/workspaces/workspace-detail";
import AcceptInvitePage from "@/pages/workspaces/accept-invite";
import BillingPage from "@/pages/billing/index";

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
      <Route path="/jobs/recommendations" component={JobRecommendations} />
      <Route path="/jobs/discover" component={GlobalJobDiscover} />
      <Route path="/jobs/exclusive" component={ExclusiveJobs} />
      <Route path="/recruiter/exclusive-jobs" component={RecruiterExclusiveJobs} />
      <Route path="/application/tailored-cvs/:id" component={TailoredCvDetailPage} />
      <Route path="/application/tailored-cvs" component={TailoredCvsPage} />
      <Route path="/application/cover-letters" component={CoverLettersPage} />
      <Route path="/bulk" component={BulkPricing} />
      <Route path="/bulk/success" component={BulkSuccess} />
      <Route path="/bulk/session" component={BulkSession} />
      <Route path="/bulk/history" component={BulkHistory} />
      <Route path="/bulk/sessions/:id" component={BulkSessionDetail} />
      <Route path="/recruiter/dashboard" component={RecruiterDashboard} />
      <Route path="/recruiter/pipeline" component={RecruiterPipeline} />
      <Route path="/recruiter/pricing" component={RecruiterPricing} />
      <Route path="/recruiter/jobs/:jobId/ranking" component={RecruiterJobRanking} />
      <Route path="/recruiter/jobs/:jobId" component={RecruiterJobDetail} />
      <Route path="/recruiter/jobs" component={RecruiterJobs} />
      <Route path="/candidate/:id" component={CandidateDetail} />
      <Route path="/tracker/saved" component={SavedJobsPage} />
      <Route path="/tracker/interview-prep/generate" component={GenerateInterviewPrepPage} />
      <Route path="/tracker/interview-prep/:id" component={InterviewPrepDetailPage} />
      <Route path="/tracker/interview-preps" component={InterviewPrepsPage} />
      <Route path="/tracker/:id" component={AppDetailPage} />
      <Route path="/tracker" component={TrackerPipeline} />
      <Route path="/emails" component={EmailsPage} />
      <Route path="/mock-interview/:id" component={MockInterviewSessionPage} />
      <Route path="/mock-interview" component={MockInterviewListPage} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/settings/notifications" component={NotificationSettingsPage} />
      <Route path="/integrations" component={IntegrationsPage} />
      <Route path="/billing" component={BillingPage} />
      <Route path="/workspaces/accept" component={AcceptInvitePage} />
      <Route path="/workspaces/:id" component={WorkspaceDetailPage} />
      <Route path="/workspaces" component={WorkspacesPage} />
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
              <Route path="/help" component={HelpPage} />
              {/* Marketing pages */}
              <Route path="/pricing" component={PricingPage} />
              <Route path="/for-candidates" component={ForCandidatesPage} />
              <Route path="/for-recruiters" component={ForRecruitersPage} />
              <Route path="/waitlist" component={WaitlistPage} />
              <Route path="/features" component={FeaturesPage} />
              <Route path="/features/:slug" component={FeatureDetailPage} />
              <Route path="/use-cases/:slug" component={UseCasePage} />
              {/* SEO landing pages — static */}
              <Route path="/cv-match-score" component={CvMatchScore} />
              <Route path="/ats-resume-checker" component={AtsResumeChecker} />
              <Route path="/resume-keyword-optimizer" component={ResumeKeywordOptimizer} />
              <Route path="/resume-job-match" component={ResumeJobMatch} />
              <Route path="/why-resume-rejected" component={WhyResumeRejected} />
              {/* SEO landing pages — dynamic DB-backed */}
              <Route path="/seo/:slug" component={DynamicSeoPage} />
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
