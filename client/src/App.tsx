import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { getLoginUrl } from "./const";
import Customers from "./pages/Customers";
import EmailTemplateEditor from "./pages/EmailTemplateEditor";
import EmailTemplates from "./pages/EmailTemplates";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Merchants from "./pages/Merchants";
import Orders from "./pages/Orders";
import LandingPage from "./pages/LandingPage";
import Settings from "./pages/Settings";
import Analytics from "./pages/Analytics";
import Billing from "./pages/Billing";
import Reports from "./pages/Reports";
import Reconciliation from "./pages/Reconciliation";
import BetaProgram from "./pages/BetaProgram";
import PlanLimits from "./pages/PlanLimits";
import PricingPlans from "./pages/PricingPlans";
import MerchantHubNav from "./pages/MerchantHubNav";
import Themes from "./pages/Themes";
import MarketplaceReviews from "./pages/MarketplaceReviews";
import MarketplaceReview from "./pages/MarketplaceReview";
import ThemesPage from "./pages/marketplace/ThemesPage";
import ThemeDetailPage from "./pages/marketplace/ThemeDetailPage";
import StoreSnapshotsPage from "./pages/marketplace/StoreSnapshotsPage";
import PlatformSettingsPage from "./pages/platform/SettingsPage";

// Placeholder page for features not yet implemented
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-muted-foreground">This feature is coming soon</p>
      </div>
    </div>
  );
}

/**
 * Wraps a page component with auth protection.
 * - While loading: shows skeleton
 * - Unauthenticated + OAuth configured: redirect to external OAuth
 * - Unauthenticated + no OAuth (dev mode): redirect to /login
 * - Authenticated: render the page
 */
function ProtectedRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (isAuthenticated) return;

    const oauthUrl = getLoginUrl();
    if (oauthUrl) {
      window.location.href = oauthUrl;
    } else {
      navigate("/login");
    }
  }, [loading, isAuthenticated, navigate]);

  if (loading || !isAuthenticated) return <DashboardLayoutSkeleton />;

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">{() => <ProtectedRoute component={Home} />}</Route>
      <Route path="/merchants">
        {() => <ProtectedRoute component={Merchants} />}
      </Route>
      <Route path="/orders">
        {() => <ProtectedRoute component={Orders} />}
      </Route>
      <Route path="/customers">
        {() => <ProtectedRoute component={Customers} />}
      </Route>
      <Route path="/analytics">
        {() => <ProtectedRoute component={Analytics} />}
      </Route>
      <Route path="/billing">
        {() => <ProtectedRoute component={Billing} />}
      </Route>
      <Route path="/reports">
        {() => <ProtectedRoute component={Reports} />}
      </Route>
      <Route path="/reconciliation">
        {() => <ProtectedRoute component={Reconciliation} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={Settings} />}
      </Route>
      <Route path="/landing-page">
        {() => <ProtectedRoute component={LandingPage} />}
      </Route>
      <Route path="/beta-program">
        {() => <ProtectedRoute component={BetaProgram} />}
      </Route>
      <Route path="/pricing-plans">
        {() => <ProtectedRoute component={PricingPlans} />}
      </Route>
      <Route path="/plan-limits">
        {() => <ProtectedRoute component={PlanLimits} />}
      </Route>
      <Route path="/merchant-hub-nav">
        {() => <ProtectedRoute component={MerchantHubNav} />}
      </Route>
      <Route path="/email-templates">
        {() => <ProtectedRoute component={EmailTemplates} />}
      </Route>
      <Route path="/email-templates/:eventType/:language">
        {(params) => (
          <ProtectedRoute
            component={() => (
              <EmailTemplateEditor
                eventType={params.eventType}
                language={(params.language === "ar" ? "ar" : "en") as "en" | "ar"}
              />
            )}
          />
        )}
      </Route>
      <Route path="/themes">
        {() => <ProtectedRoute component={Themes} />}
      </Route>
      <Route path="/marketplace-reviews">
        {() => <ProtectedRoute component={MarketplaceReviews} />}
      </Route>
      <Route path="/marketplace/review">
        {() => <ProtectedRoute component={MarketplaceReview} />}
      </Route>
      <Route path="/marketplace/themes">
        {() => <ProtectedRoute component={ThemesPage} />}
      </Route>
      <Route path="/marketplace/themes/:slug">
        {() => <ProtectedRoute component={ThemeDetailPage} />}
      </Route>
      <Route path="/marketplace/snapshots/:storeId">
        {() => <ProtectedRoute component={StoreSnapshotsPage} />}
      </Route>
      {/* Bare /marketplace/snapshots without a storeId — render the
          page anyway so it can prompt the admin for a store. */}
      <Route path="/marketplace/snapshots">
        {() => <ProtectedRoute component={StoreSnapshotsPage} />}
      </Route>
      {/* Legacy URL — Session B renamed /marketplace/flags →
          /marketplace/themes. Kept as a one-shot redirect so saved
          bookmarks + admin runbook links don't 404. */}
      <Route path="/marketplace/flags">
        {() => <RedirectTo path="/marketplace/themes" />}
      </Route>
      <Route path="/platform/settings">
        {() => <ProtectedRoute component={PlatformSettingsPage} />}
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * Tiny inline redirect helper. wouter ships `Redirect` only as a
 * declarative component, so we use it via `useLocation` for explicit
 * navigation. Keeps the route table readable.
 */
function RedirectTo({ path }: { path: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(path, { replace: true });
  }, [navigate, path]);
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
