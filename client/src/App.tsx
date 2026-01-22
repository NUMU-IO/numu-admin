import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Customers from "./pages/Customers";
import Home from "./pages/Home";
import Merchants from "./pages/Merchants";
import Orders from "./pages/Orders";
import Settings from "./pages/Settings";
import { toast } from "sonner";

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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/merchants" component={Merchants} />
      <Route path="/orders" component={Orders} />
      <Route path="/customers" component={Customers} />
      <Route path="/analytics">
        {() => <ComingSoon title="Analytics" />}
      </Route>
      <Route path="/billing">
        {() => <ComingSoon title="Billing" />}
      </Route>
      <Route path="/reports">
        {() => <ComingSoon title="Reports" />}
      </Route>
      <Route path="/settings" component={Settings} />
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
