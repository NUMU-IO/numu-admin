/**
 * Topbar — global search entry, environment, and who you are acting as.
 *
 * The search field is a button, not an input: there is one search surface in
 * this admin and it is the command palette. The operator's role is always
 * visible next to their name because every destructive action on the next
 * screen is gated on it.
 */

import { IconButton, Topbar } from "@/ds";
import {
  ADMIN_ENVS,
  getCurrentEnv,
  getEnvLabel,
  setCurrentEnv,
  type AdminEnv,
} from "@/lib/env";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/_core/hooks/useAuth";
import NotificationsMenu from "./NotificationsMenu";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useState } from "react";

interface HeaderProps {
  onSearchOpen?: () => void;
  /** Below 900px the sidebar is a drawer and this opens it. */
  onOpenMobileNav?: () => void;
}

function initials(name?: string | null): string {
  if (!name) return "AD";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** `super_admin` → `Super admin`. Sentence case, per the admin copy rules. */
function roleLabel(role?: string | null): string {
  if (!role) return "Operator";
  const words = role.replace(/[_-]+/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export default function Header({ onSearchOpen, onOpenMobileNav }: HeaderProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [env, setEnv] = useState<AdminEnv>(getCurrentEnv);

  const handleEnvChange = (next: AdminEnv) => {
    if (next === env) return;
    const ok = window.confirm(
      `Switch to ${getEnvLabel(next)}? You will be signed out and sent to the ` +
        `${getEnvLabel(next).toLowerCase()} API's login.`,
    );
    if (!ok) return;
    setCurrentEnv(next);
    setEnv(next);
    // Hard reload so no in-memory state (CSRF token, query cache) survives
    // into a different stack.
    window.location.href = "/login";
  };

  return (
    <Topbar
      onSearchOpen={onSearchOpen}
      onMenu={onOpenMobileNav}
      user={{
        name: user?.name || "Admin",
        initials: initials(user?.name),
        role: roleLabel(user?.role),
      }}
      actions={
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="nbg nbg--neutral numu-focus-ring"
                aria-label={`Environment: ${getEnvLabel(env)}. Activate to switch.`}
              >
                {env}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Switch environment</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ADMIN_ENVS.map((e) => (
                <DropdownMenuItem
                  key={e}
                  onSelect={() => handleEnvChange(e)}
                  className="flex items-center justify-between"
                >
                  <span>{getEnvLabel(e)}</span>
                  {e === env ? <Check className="w-3.5 h-3.5 text-muted-foreground" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <NotificationsMenu />
          <IconButton
            icon="refresh"
            label="Refresh data"
            onClick={() => queryClient.invalidateQueries()}
          />
          {/* The palette has a keyboard shortcut and the search field next to
              it opens the same surface, so on a phone this is the third route
              to one place and the first thing to go. */}
          <span className="ak-hide-phone">
            <IconButton icon="command" label="Open command palette" onClick={onSearchOpen} />
          </span>
        </>
      }
    />
  );
}
