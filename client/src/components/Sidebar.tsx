/**
 * Primary navigation — the Navy rail from the NUMU design system.
 *
 * Three things it does that a plain link list does not: it groups pages by
 * operational domain, it carries live queue depths so an operator can see
 * where the work is without opening anything, and it collapses to an icon
 * rail on tablet rather than disappearing.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { IconButton, SidebarNav, type NavSection } from "@/ds";
import { ADMIN_NAV, navIdForPath, navItemById } from "@/lib/adminNav";
import { getCurrentEnv } from "@/lib/env";
import { getQueueCounts } from "@/services/dashboardService";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/useMobile";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface SidebarProps {
  /** Mobile drawer state — owned by DashboardLayout. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps = {}) {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  // Below 1180px the rail collapses to icons; below 900px it becomes an
  // overlay drawer and goes back to full width, because an icon-only rail
  // floating over the page is a puzzle rather than a shortcut.
  const isDrawer = useIsMobile(900);
  const collapsed = useIsMobile(1180) && !isDrawer;

  // Tapping a nav item navigates and dismisses the drawer in one gesture.
  useEffect(() => {
    if (mobileOpen) onMobileClose?.();
    // Only the route matters here; the callback is stable from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const { data: queues } = useQuery({
    queryKey: ["dashboard", "queues"],
    queryFn: getQueueCounts,
    // Queue depths are the one number on screen that goes stale while an
    // operator reads it, so they refresh on their own.
    refetchInterval: 60_000,
  });

  const sections: NavSection[] = ADMIN_NAV.map((section) => ({
    label: section.label,
    items: section.items.map((item) => {
      const count = item.queueKey ? queues?.[item.queueKey] : undefined;
      return {
        id: item.id,
        label: item.label,
        icon: item.icon,
        // A zero-depth queue shows no badge at all. "0 waiting" is not
        // information an operator needs, and it dilutes the ones that are.
        count: count ? count : undefined,
        alert: Boolean(count) && item.alertQueue,
      };
    }),
  }));

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      toast.success("Signed out");
    } catch {
      toast.error("Sign out failed");
    } finally {
      setLoggingOut(false);
    }
  };

  const rail = (
    <SidebarNav
      sections={sections}
      active={navIdForPath(location)}
      onNavigate={(id) => {
        const item = navItemById(id);
        if (item) navigate(item.href);
      }}
      env={getCurrentEnv()}
      collapsed={collapsed}
      className={isDrawer ? "ak-drawer" : undefined}
      footer={
        collapsed ? (
          <IconButton
            icon="logOut"
            label="Sign out"
            tone="onNav"
            size="sm"
            disabled={loggingOut}
            onClick={handleLogout}
          />
        ) : (
          <>
            <span
              className="nsb__env"
              style={{ background: "transparent", padding: 0, opacity: 0.7 }}
              title={user?.email ?? undefined}
            >
              {user?.email ?? "signed in"}
            </span>
            <IconButton
              icon="logOut"
              label="Sign out"
              tone="onNav"
              size="sm"
              disabled={loggingOut}
              onClick={handleLogout}
              style={{ marginInlineStart: "auto" }}
            />
          </>
        )
      }
    />
  );

  if (!isDrawer) return rail;

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onMobileClose}
          className="ak-scrim"
        />
      ) : null}
      <div className={`ak-drawer-wrap${mobileOpen ? " is-open" : ""}`}>{rail}</div>
    </>
  );
}
