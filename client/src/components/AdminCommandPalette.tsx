/**
 * ⌘K — one search surface for the whole backoffice.
 *
 * An operator arrives holding a phone number, an order number or half a
 * domain and does not know which list page owns it. The palette searches
 * every entity type at once against `/admin/dashboard/search`, and mixes in
 * the navigation itself so it doubles as a jump-to.
 */

import { CommandPalette, type PaletteGroup, type PaletteItem } from "@/ds";
import { ADMIN_NAV } from "@/lib/adminNav";
import { adminSearch, type AdminSearchHit } from "@/services/dashboardService";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const KIND_ICON = {
  merchant: "building",
  store: "store",
  order: "cart",
  customer: "user",
} as const;

const KIND_GROUP: Record<AdminSearchHit["kind"], string> = {
  merchant: "Merchants",
  store: "Stores",
  order: "Orders",
  customer: "Customers",
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AdminCommandPalette({ open, onClose }: Props) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  // Typing fires one request per keystroke otherwise; 200ms is below the
  // point where the list feels like it lags behind the field.
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setCursor(0);
    }
  }, [open]);

  const { data: hits = [] } = useQuery({
    queryKey: ["admin", "search", debounced],
    queryFn: () => adminSearch(debounced),
    enabled: open && debounced.trim().length >= 2,
  });

  const groups = useMemo<PaletteGroup[]>(() => {
    const out: PaletteGroup[] = [];

    for (const kind of ["merchant", "store", "order", "customer"] as const) {
      const items = hits
        .filter((h) => h.kind === kind)
        .map<PaletteItem>((h) => ({
          id: `${h.kind}:${h.id}`,
          label: h.label,
          icon: KIND_ICON[h.kind],
          meta: h.meta ?? undefined,
          kind: h.kind,
        }));
      if (items.length) out.push({ label: KIND_GROUP[kind], items });
    }

    // Navigation is always searchable, so the palette never comes back
    // empty-handed on a term that happens to match no data.
    const needle = query.trim().toLowerCase();
    const pages = ADMIN_NAV.flatMap((s) => s.items)
      .filter((i) => !needle || i.label.toLowerCase().includes(needle))
      .slice(0, needle ? 6 : 8)
      .map<PaletteItem>((i) => ({
        id: `page:${i.id}`,
        label: `Go to ${i.label}`,
        icon: i.icon,
        kind: "action",
      }));
    if (pages.length) out.push({ label: "Pages", items: pages });

    return out;
  }, [hits, query]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") return;
      if (!flat.length) return;
      if (e.key === "Enter") {
        e.preventDefault();
        select(flat[cursor]);
        return;
      }
      e.preventDefault();
      setCursor((c) => (c + (e.key === "ArrowDown" ? 1 : flat.length - 1)) % flat.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // `select` is defined below and closes over `navigate`/`onClose`, both stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, flat, cursor]);

  // Results shrink as the query narrows; a stale cursor would point past the end.
  useEffect(() => {
    setCursor((c) => (c < flat.length ? c : 0));
  }, [flat.length]);

  function select(item?: PaletteItem) {
    if (!item) return;
    onClose();
    if (item.id.startsWith("page:")) {
      const id = item.id.slice("page:".length);
      const page = ADMIN_NAV.flatMap((s) => s.items).find((i) => i.id === id);
      if (page) navigate(page.href);
      return;
    }
    const hit = hits.find((h) => `${h.kind}:${h.id}` === item.id);
    if (hit) navigate(hit.href);
  }

  return (
    <CommandPalette
      open={open}
      query={query}
      onQueryChange={setQuery}
      groups={groups}
      cursor={cursor}
      onSelect={select}
      onClose={onClose}
      placeholder="Search merchants, stores, orders, customers, phone…"
    />
  );
}
