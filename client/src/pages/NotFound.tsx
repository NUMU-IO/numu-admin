/**
 * 404.
 *
 * Most hits here are not broken links: an idle tab comes back, the session
 * refresh redirects, and the landing path is one wouter does not match. So
 * the page returns to the overview on its own after three seconds and says
 * that it is doing so, rather than presenting a dead end.
 */

import { Button, Card, EmptyState } from "@/ds";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const id = setTimeout(() => setLocation("/"), 3000);
    return () => clearTimeout(id);
  }, [setLocation]);

  return (
    <div className="ak-notfound">
      <Card className="ak-notfound__card">
        <EmptyState
          kind="error"
          icon="alertCircle"
          title="No page at this address"
          body={
            <>
              <span className="numu-mono">{location}</span> does not match any
              admin route. Returning to the overview in three seconds.
            </>
          }
          action={
            <Button size="sm" icon="layout" onClick={() => setLocation("/")}>
              Go to overview
            </Button>
          }
        />
      </Card>
    </div>
  );
}
