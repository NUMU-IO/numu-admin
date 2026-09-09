import { Button, Card } from "@/ds";
import { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Sentry.captureException(error, {
      extra: { componentStack: errorInfo.componentStack },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="ak-notfound">
          <Card className="ak-notfound__card" title="Something broke" subtitle="Unhandled error">
            <div className="ak-stack">
              <p style={{ fontSize: "var(--fs-app-sm)" }}>
                The page stopped rendering. The error was reported automatically;
                reloading usually recovers the session.
              </p>
              {/* The stack is the one thing an operator can usefully paste into
                  a bug report, so it stays visible rather than hidden. */}
              <pre className="ak-stacktrace">{this.state.error?.stack}</pre>
              <div>
                <Button icon="refresh" onClick={() => window.location.reload()}>
                  Reload the page
                </Button>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
