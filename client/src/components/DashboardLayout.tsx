/**
 * The application shell: rail, topbar, page header, scroll region.
 *
 * Every page gets the same three-part frame from the design system — where
 * you are (breadcrumbs + title), what you can do to it (actions scoped to
 * the entity in the title), and the facts that identify it (the mono meta
 * line). Pages supply those as props instead of drawing their own heading,
 * so headings cannot drift apart from screen to screen.
 */

import { Breadcrumbs, PageHeader } from "@/ds";
import { navTrailForPath } from "@/lib/adminNav";
import { useEffect, useState, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/useMobile";
import { useLocation } from "wouter";
import AdminCommandPalette from "./AdminCommandPalette";
import Header from "./Header";
import Sidebar from "./Sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
  title: ReactNode;
  /** Sits in the mono meta line under the title, not as a second heading. */
  subtitle?: ReactNode;
  /** StatusBadges belonging to the entity in the title. */
  badges?: ReactNode;
  /** Actions scoped to this page's entity level only. */
  actions?: ReactNode;
  /** Extra mono facts — IDs, plan, created date. Rendered after `subtitle`. */
  meta?: ReactNode;
  /**
   * Overrides the automatic trail. Pass this on entity detail pages, where
   * the hierarchy (org → store → order) is the point and cannot be derived
   * from the URL alone.
   */
  breadcrumbs?: { label: string; href?: string }[];
  /** A <Tabs> element, pinned directly under the header. */
  tabs?: ReactNode;
  /** Renders children edge to edge — for a page that is one full-bleed table. */
  flush?: boolean;
}

export default function DashboardLayout({
  children,
  title,
  subtitle,
  badges,
  actions,
  meta,
  breadcrumbs,
  tabs,
  flush = false,
}: DashboardLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [location, navigate] = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isDrawer = useIsMobile(900);
  const trail = breadcrumbs ?? navTrailForPath(location);

  return (
    <div className="ak-shell">
      {/* First focusable element of the shell, per the design system. */}
      <a className="numu-skip" href="#ak-main">
        Skip to main content
      </a>

      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

      <div className="ak-main">
        <Header
          onSearchOpen={() => setPaletteOpen(true)}
          // Only wire the hamburger where the rail is actually a drawer.
          // Passing it unconditionally puts a dead button on every desktop.
          onOpenMobileNav={isDrawer ? () => setMobileNavOpen(true) : undefined}
        />

        {/* The page header scrolls with the content rather than pinning above
            it. Only the topbar stays put: it holds search and the operator's
            identity, which are needed from anywhere on the page. A title and
            its actions are not, and pinning them costs a band of vertical
            space on every screen. */}
        <main id="ak-main" className="ak-scroll">
          <PageHeader
            title={title}
            badges={badges}
            actions={actions}
            breadcrumbs={
              trail.length > 1 ? (
                <Breadcrumbs
                  items={trail.map((t, i) => ({ id: String(i), label: t.label }))}
                  onNavigate={(id) => {
                    const target = trail[Number(id)];
                    if (target?.href) navigate(target.href);
                  }}
                />
              ) : undefined
            }
            meta={
              subtitle || meta ? (
                <>
                  {subtitle ? <span>{subtitle}</span> : null}
                  {meta}
                </>
              ) : undefined
            }
          />
          {tabs}
          <div className={flush ? undefined : "ak-page"}>{children}</div>
        </main>
      </div>

      <AdminCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
