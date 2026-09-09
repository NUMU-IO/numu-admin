/**
 * The NUMU design system, vendored.
 *
 * `client/src/ds/` is a verbatim copy of the design-system package: the
 * token layers, `numu.css`, and the 42 React components that read them.
 * Nine edits were needed to make it build here and they are the only
 * differences from upstream:
 *
 *   - the remote font `@import` moved to a <link> in client/index.html,
 *     so the bundler does not have to hoist it;
 *   - a malformed `border-radius(--nav-item-radius)` declaration removed
 *     from `numu.css` (the correct one sits on the next line);
 *   - `import type { JSX } from "react"` added to the `.d.ts` files,
 *     since React 19 dropped the global JSX namespace;
 *   - `BarChart`'s gridlines set `bottom` and then `inset: "auto 0 auto 0"`,
 *     whose `auto` overwrote the `bottom` that had just been set, so every
 *     gridline and axis label collapsed onto the top of the chart. Replaced
 *     with `insetInline: 0` before `bottom`;
 *   - `ButtonProps` gained `href`/`target`/`rel`, which `as="a"` needs and
 *     which the component already forwards;
 *   - `SoukDivider` built its background URL as a relative string, which
 *     resolves against the document rather than the module and 404s once
 *     bundled. It imports the two SVGs instead;
 *   - Lucide's `menu` glyph added to the icon registry, and used for the
 *     topbar's drawer control in place of `moreHorizontal`, which reads as
 *     "more actions" rather than "open navigation";
 *   - `Topbar`'s name/role block moved from an inline style to a class
 *     (`.ntp__whoName`), so a media query can hide it on a phone — an
 *     inline style cannot be overridden by a stylesheet;
 *   - Lucide's `userPlus` glyph added to the registry for the Leads page —
 *     a lead is a person who is not a customer yet, and nothing in the set
 *     said that.
 *
 * Everything is re-exported from here so app code has one import path and
 * upgrading the system means replacing the folder.
 */

export { Icon, NUMU_ICONS } from "./components/core/Icon";
export type { IconProps, NumuIconName } from "./components/core/Icon";
export { Button } from "./components/core/Button";
export type { ButtonProps } from "./components/core/Button";
export { IconButton } from "./components/core/IconButton";
export type { IconButtonProps } from "./components/core/IconButton";
export { Badge } from "./components/core/Badge";
export type { BadgeProps } from "./components/core/Badge";
export { StatusBadge, NUMU_STATUS } from "./components/core/StatusBadge";
export type { StatusBadgeProps } from "./components/core/StatusBadge";
export { Chip } from "./components/core/Chip";
export type { ChipProps } from "./components/core/Chip";
export { Card } from "./components/core/Card";
export type { CardProps } from "./components/core/Card";
export { MetricCard } from "./components/core/MetricCard";
export type { MetricCardProps } from "./components/core/MetricCard";
export { KeyValue } from "./components/core/KeyValue";
export type { KeyValueProps, KeyValueItem } from "./components/core/KeyValue";
export { Wordmark } from "./components/core/Wordmark";
export type { WordmarkProps } from "./components/core/Wordmark";

export { FormField } from "./components/forms/FormField";
export { Input } from "./components/forms/Input";
export { Select } from "./components/forms/Select";
export { Textarea } from "./components/forms/Textarea";
export { Checkbox } from "./components/forms/Checkbox";
export { Switch } from "./components/forms/Switch";

export { DataTable } from "./components/data/DataTable";
export type { DataTableProps, DataTableColumn } from "./components/data/DataTable";
export { FilterBar } from "./components/data/FilterBar";
export type { FilterBarProps, SavedView } from "./components/data/FilterBar";
export { Pagination } from "./components/data/Pagination";
export { AuditTimeline } from "./components/data/AuditTimeline";
export type { AuditEntry } from "./components/data/AuditTimeline";
export { RiskScore, levelForScore } from "./components/data/RiskScore";
export { EmptyState } from "./components/data/EmptyState";
export type { EmptyStateProps } from "./components/data/EmptyState";
export { Skeleton } from "./components/data/Skeleton";

export { Banner } from "./components/feedback/Banner";
export type { BannerProps } from "./components/feedback/Banner";
export { Dialog } from "./components/feedback/Dialog";
export { ConfirmDialog } from "./components/feedback/ConfirmDialog";
export type { ConfirmDialogProps } from "./components/feedback/ConfirmDialog";
export { Drawer } from "./components/feedback/Drawer";
export { Toast, ToastStack } from "./components/feedback/Toast";
export { Tooltip } from "./components/feedback/Tooltip";

export { SidebarNav } from "./components/navigation/SidebarNav";
export type { NavItem, NavSection } from "./components/navigation/SidebarNav";
export { Topbar } from "./components/navigation/Topbar";
export { Breadcrumbs } from "./components/navigation/Breadcrumbs";
export { Tabs } from "./components/navigation/Tabs";
export { CommandPalette } from "./components/navigation/CommandPalette";
export type { PaletteItem, PaletteGroup } from "./components/navigation/CommandPalette";
export { PageHeader } from "./components/navigation/PageHeader";
export type { PageHeaderProps } from "./components/navigation/PageHeader";

export { SoukDivider } from "./components/editorial/SoukDivider";

export { Sparkline } from "./components/charts/Sparkline";
export { BarChart } from "./components/charts/BarChart";
export type { BarDatum } from "./components/charts/BarChart";
