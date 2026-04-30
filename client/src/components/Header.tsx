/**
 * Header Component - NUMU Admin Dashboard
 * 
 * Design: Clean top bar with search and quick actions
 * Features: Global search, notifications, user menu
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Calendar, Menu, Search } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  /** Mobile-only: opens the sidebar drawer. Hidden on lg+ where the
   *  sidebar is always visible. */
  onOpenMobileNav?: () => void;
}

export default function Header({ title, subtitle, onOpenMobileNav }: HeaderProps) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border/50">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4">
        {/* Left: Hamburger (mobile) + Title */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileNav}
            className="lg:hidden p-2 -ml-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search merchants, orders..."
              className="w-56 lg:w-72 pl-10 bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
            />
          </div>

          {/* Date */}
          <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{today}</span>
          </div>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
          </Button>
        </div>
      </div>
    </header>
  );
}
