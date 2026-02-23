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
import Home from "./pages/Home";
import Login from "./pages/Login";
import Merchants from "./pages/Merchants";
import Orders from "./pages/Orders";
import LandingPage from "./pages/LandingPage";
import Settings from "./pages/Settings";

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
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
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
      <Route path="/merchants">{() => <ProtectedRoute component={Merchants} />}</Route>
      <Route path="/orders">{() => <ProtectedRoute component={Orders} />}</Route>
      <Route path="/customers">{() => <ProtectedRoute component={Customers} />}</Route>
      <Route path="/analytics">{() => <ProtectedRoute component={() => <ComingSoon title="Analytics" />} />}</Route>
      <Route path="/billing">{() => <ProtectedRoute component={() => <ComingSoon title="Billing" />} />}</Route>
      <Route path="/reports">{() => <ProtectedRoute component={() => <ComingSoon title="Reports" />} />}</Route>
      <Route path="/settings">{() => <ProtectedRoute component={Settings} />}</Route>
      <Route path="/landing-page">{() => <ProtectedRoute component={LandingPage} />}</Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
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
