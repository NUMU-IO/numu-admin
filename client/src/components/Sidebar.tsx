/**
 * Sidebar Component - NUMU Admin Dashboard
 * 
 * Design: Soft Minimalist with floating sidebar
 * Features: Icon navigation with labels, user profile with logout
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  Globe,
  Home,
  LogOut,
  Mail,
  Menu,
  Scale,
  Settings,
  ShoppingCart,
  Users,
  Ticket,
  X,
  Zap,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useEffect, useState } from "react";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: number;
}

const mainNavItems: NavItem[] = [
  { icon: Home, label: "Overview", href: "/" },
  { icon: Building2, label: "Merchants", href: "/merchants" },
  { icon: ShoppingCart, label: "Orders", href: "/orders" },
  { icon: Users, label: "Customers", href: "/customers" },
  { icon: BarChart3, label: "Analytics", href: "/analytics" },
  { icon: CreditCard, label: "Billing", href: "/billing" },
  { icon: Globe, label: "Landing Page", href: "/landing-page" },
  { icon: CreditCard, label: "Pricing Plans", href: "/pricing-plans" },
  { icon: Ticket, label: "Beta Program", href: "/beta-program" },
];

const secondaryNavItems: NavItem[] = [
  { icon: Scale, label: "Reconciliation", href: "/reconciliation" },
  { icon: FileText, label: "Reports", href: "/reports" },
  { icon: Menu, label: "Merchant Hub Nav", href: "/merchant-hub-nav" },
  { icon: Mail, label: "Email Templates", href: "/email-templates" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

interface SidebarProps {
  /** Mobile drawer state — controlled by DashboardLayout. Desktop
   *  ignores this and always renders the sidebar inline. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps = {}) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  // Auto-close the drawer on route change so tapping a nav item
  // navigates AND dismisses the drawer in the same gesture.
  useEffect(() => {
    if (mobileOpen) onMobileClose?.();
    // We intentionally don't include onMobileClose in the deps — it's
    // expected to be stable from the parent. Only the route matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      toast.success("Logged out successfully");
    } catch {
      toast.error("Failed to logout");
    } finally {
      setLoggingOut(false);
    }
  };

  // Get user initials
  const getInitials = (name?: string | null) => {
    if (!name) return "AD";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Mobile backdrop — click to dismiss. ``lg:hidden`` so the
          desktop layout never sees it. */}
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onMobileClose}
          className="lg:hidden fixed inset-0 z-30 bg-foreground/40 backdrop-blur-[2px]"
        />
      ) : null}

      <aside
        className={cn(
          // Drawer transform: hidden off-screen on mobile, visible
          // when ``mobileOpen``. On lg+ the sidebar is always
          // ``translate-x-0`` regardless of the prop.
          "fixed left-0 top-0 z-40 h-screen w-64 bg-card border-r border-border/50 shadow-soft flex flex-col transition-transform duration-200 ease-out",
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border/50">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
          <Zap className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg text-foreground">NUMU</h1>
          <p className="text-xs text-muted-foreground">Admin Backoffice</p>
        </div>
        {/* Close button — mobile only. Desktop never has the drawer
            state to "close". */}
        <button
          type="button"
          onClick={onMobileClose}
          className="lg:hidden p-1.5 -mr-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Close navigation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Main Menu
        </p>
        {mainNavItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive && "text-primary")} />
                <span className="text-sm">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}

        <div className="pt-4">
          <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            System
          </p>
          {secondaryNavItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive && "text-primary")} />
                  <span className="text-sm">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User Profile */}
      <div className="border-t border-border/50 p-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary">
              {getInitials(user?.name)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.name || "Admin User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email || "admin@numueg.app"}
            </p>
          </div>
          <button 
            onClick={handleLogout}
            disabled={loggingOut}
            className="p-2 rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
            title="Logout"
          >
            <LogOut className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
