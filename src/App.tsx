import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { AuthProvider } from "@/hooks/useAuth";
import { ModulesProvider } from "@/hooks/useModules";
import { OrganizationProvider } from "@/hooks/useOrganization";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AIAgentButton } from "@/components/ai/AIAgentButton";
import { Loader2 } from "lucide-react";

// Retry wrapper for dynamic imports – handles stale chunk hashes after deploys
function lazyRetry(importFn: () => Promise<any>) {
  return lazy(() =>
    importFn().catch((err) => {
      // If we haven't already retried, do a hard reload to get fresh chunks
      const key = "chunk-retry";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return new Promise(() => {}); // never resolves; page is reloading
      }
      sessionStorage.removeItem(key);
      throw err;
    })
  );
}

// Lazy-loaded pages
const LoginPage = lazyRetry(() => import("./pages/LoginPage"));
const RegisterPage = lazyRetry(() => import("./pages/RegisterPage"));
const OnboardingPage = lazyRetry(() => import("./pages/OnboardingPage"));
const DashboardPage = lazyRetry(() => import("./pages/DashboardPage"));
const CustomersPage = lazyRetry(() => import("./pages/CustomersPage"));
const TasksPage = lazyRetry(() => import("./pages/TasksPage"));
const LeadsPage = lazyRetry(() => import("./pages/LeadsPage"));
const LeadDetailPage = lazyRetry(() => import("./pages/LeadDetailPage"));
const WebAnalysisPage = lazyRetry(() => import("./pages/WebAnalysisPage"));

const MailPage = lazyRetry(() => import("./pages/MailPage"));
const ReportsPage = lazyRetry(() => import("./pages/ReportsPage"));
const PipelinePage = lazyRetry(() => import("./pages/PipelinePage"));
const SettingsPage = lazyRetry(() => import("./pages/SettingsPage"));
const MeetingsPage = lazyRetry(() => import("./pages/MeetingsPage"));
const PublicBookingPage = lazyRetry(() => import("./pages/PublicBookingPage"));
const PublicOfferPage = lazyRetry(() => import("./pages/PublicOfferPage"));
const OffersPage = lazyRetry(() => import("./pages/OffersPage"));
const QuotesPage = lazyRetry(() => import("./pages/QuotesPage"));
const PublicQuotePage = lazyRetry(() => import("./pages/PublicQuotePage"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));
const ReportViewPage = lazyRetry(() => import("./pages/ReportViewPage"));
const PublicReportPage = lazyRetry(() => import("./pages/PublicReportPage"));
const PublicGeoReportPage = lazyRetry(() => import("./pages/PublicGeoReportPage"));
const TemplatesPage = lazyRetry(() => import("./pages/TemplatesPage"));
const StatisticsPage = lazyRetry(() => import("./pages/StatisticsPage"));
const OutreachProPage = lazyRetry(() => import("./pages/OutreachProPage"));
const PowerCallListsPage = lazyRetry(() => import("./pages/PowerCallListsPage"));
const PowerCallSessionPage = lazyRetry(() => import("./pages/PowerCallSessionPage"));
const ProspectingPage = lazyRetry(() => import("./pages/ProspectingPage"));
const TicketsPage = lazyRetry(() => import("./pages/TicketsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes – cached data shown instantly on revisit
      gcTime: 10 * 60 * 1000, // keep unused cache for 10 min
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ModulesProvider>
              <OrganizationProvider>
              <Suspense fallback={<PageFallback />}>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/book/:userId" element={<PublicBookingPage />} />
                
                <Route path="/offer/:token" element={<PublicOfferPage />} />
                <Route path="/r/geo/:token" element={<PublicGeoReportPage />} />
                <Route path="/r/:token" element={<PublicReportPage />} />
                <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />

                {/* Protected routes */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={
                  <ProtectedRoute><DashboardPage /></ProtectedRoute>
                } />
                <Route path="/customers" element={
                  <ProtectedRoute><CustomersPage /></ProtectedRoute>
                } />
                <Route path="/customers/*" element={
                  <ProtectedRoute><CustomersPage /></ProtectedRoute>
                } />
                <Route path="/pipeline" element={
                  <ProtectedRoute><PipelinePage /></ProtectedRoute>
                } />
                <Route path="/leads" element={
                  <ProtectedRoute><LeadsPage /></ProtectedRoute>
                } />
                <Route path="/leads/:id" element={
                  <ProtectedRoute><LeadDetailPage /></ProtectedRoute>
                } />
                <Route path="/tasks" element={
                  <ProtectedRoute><TasksPage /></ProtectedRoute>
                } />
                <Route path="/tasks/*" element={
                  <ProtectedRoute><TasksPage /></ProtectedRoute>
                } />
                <Route path="/web-analysis" element={
                  <ProtectedRoute><WebAnalysisPage /></ProtectedRoute>
                } />
                <Route path="/web-analysis/*" element={
                  <ProtectedRoute><WebAnalysisPage /></ProtectedRoute>
                } />
                <Route path="/outreach" element={<Navigate to="/mail" replace />} />
                <Route path="/outreach/*" element={<Navigate to="/mail" replace />} />
                <Route path="/mail" element={
                  <ProtectedRoute><MailPage /></ProtectedRoute>
                } />
                <Route path="/reports" element={
                  <ProtectedRoute><ReportsPage /></ProtectedRoute>
                } />
                <Route path="/reports/:reportId" element={
                  <ProtectedRoute><ReportViewPage /></ProtectedRoute>
                } />
                <Route path="/reports/*" element={
                  <ProtectedRoute><ReportsPage /></ProtectedRoute>
                } />
                <Route path="/settings" element={
                  <ProtectedRoute><SettingsPage /></ProtectedRoute>
                } />
                <Route path="/settings/*" element={
                  <ProtectedRoute><SettingsPage /></ProtectedRoute>
                } />
                <Route path="/quotes" element={
                  <ProtectedRoute><QuotesPage /></ProtectedRoute>
                } />
                <Route path="/quotes/*" element={
                  <ProtectedRoute><QuotesPage /></ProtectedRoute>
                } />
                <Route path="/quote/:token" element={<PublicQuotePage />} />
                <Route path="/settings/templates/:id" element={
                  <ProtectedRoute><SettingsPage /></ProtectedRoute>
                } />
                <Route path="/offers" element={
                  <ProtectedRoute><OffersPage /></ProtectedRoute>
                } />
                <Route path="/offers/*" element={
                  <ProtectedRoute><OffersPage /></ProtectedRoute>
                } />
                <Route path="/meetings" element={
                  <ProtectedRoute><MeetingsPage /></ProtectedRoute>
                } />
                <Route path="/statistics" element={
                  <ProtectedRoute><StatisticsPage /></ProtectedRoute>
                } />
                <Route path="/outreach-pro" element={
                  <ProtectedRoute><OutreachProPage /></ProtectedRoute>
                } />
                <Route path="/outreach-pro/lists" element={
                  <ProtectedRoute><PowerCallListsPage /></ProtectedRoute>
                } />
                <Route path="/outreach-pro/power-call" element={
                  <ProtectedRoute><PowerCallSessionPage /></ProtectedRoute>
                } />
                <Route path="/prospecting" element={
                  <ProtectedRoute><ProspectingPage /></ProtectedRoute>
                } />
                <Route path="/tickets" element={
                  <ProtectedRoute><TicketsPage /></ProtectedRoute>
                } />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              
              {/* Global floating AI Agent button */}
              <AIAgentButton />
              </OrganizationProvider>
            </ModulesProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;