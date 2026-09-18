import { initCSRF } from "@/lib/csrf";
import { registerServiceWorker } from "@/lib/serviceWorker";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { toast } from "sonner";
import App from "./App";
import "./index.css";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
  release: import.meta.env.VITE_SENTRY_RELEASE,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,

  beforeSend(event) {
    if (event.request?.headers) {
      const sensitiveHeaders = [
        "Authorization", "authorization",
        "Cookie", "cookie",
        "Set-Cookie", "set-cookie",
        "X-CSRF-Token", "x-csrf-token",
      ];
      for (const header of sensitiveHeaders) {
        delete event.request.headers[header];
      }
    }
    if (event.request?.cookies) {
      event.request.cookies = {};
    }
    if (event.user?.email) {
      delete event.user.email;
    }
    if (event.breadcrumbs) {
      for (const breadcrumb of event.breadcrumbs) {
        if (breadcrumb.data) {
          delete breadcrumb.data["Authorization"];
          delete breadcrumb.data["authorization"];
          delete breadcrumb.data["Cookie"];
          delete breadcrumb.data["cookie"];
          if (typeof breadcrumb.data.url === "string") {
            breadcrumb.data.url = breadcrumb.data.url.replace(
              /([?&])(token|session_id|access_token|refresh_token)=[^&]*/gi,
              "$1$2=[REDACTED]",
            );
          }
        }
      }
    }
    return event;
  },
});

// Load Umami analytics conditionally (only when env vars are configured)
if (import.meta.env.VITE_ANALYTICS_ENDPOINT && import.meta.env.VITE_ANALYTICS_WEBSITE_ID) {
  const script = document.createElement("script");
  script.defer = true;
  script.src = `${import.meta.env.VITE_ANALYTICS_ENDPOINT}/umami`;
  script.dataset.websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;
  document.body.appendChild(script);
}

const queryClient = new QueryClient();

// Fetch CSRF token before rendering — non-blocking on failure
initCSRF().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );

  // After the render call, so installing the worker never competes with first
  // paint. The update is offered rather than applied: activating silently
  // would drop the old chunks under an operator who is mid-review.
  registerServiceWorker((activate) => {
    toast("A new version is ready", {
      description: "Reload to pick it up. Nothing on this screen is lost.",
      duration: Infinity,
      action: { label: "Reload", onClick: activate },
    });
  });
});
