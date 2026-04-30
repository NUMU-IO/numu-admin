/**
 * Dashboard Layout Component - NUMU Admin Dashboard
 *
 * Design: Sidebar + Main content area layout
 * Features: Fixed sidebar on desktop, slide-in drawer on mobile.
 *
 * The sidebar is fixed and 256 px wide on lg+; below that breakpoint
 * it collapses off-screen and the Header renders a hamburger that
 * toggles the drawer state owned here. ``lg:ml-64`` keeps the main
 * content column out from under the desktop sidebar without leaving
 * a 256 px dead zone on phones.
 */

import { useState } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export default function DashboardLayout({
  children,
  title,
  subtitle,
}: DashboardLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="lg:ml-64">
        <Header
          title={title}
          subtitle={subtitle}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
