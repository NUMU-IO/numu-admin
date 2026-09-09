import React from "react";
import { Icon } from "../core/Icon.jsx";
import { IconButton } from "../core/IconButton.jsx";

export function Topbar({ onSearchOpen, searchPlaceholder = "Search merchants, stores, users, orders, phone…", shortcut = "⌘K", actions, user, onMenu, className = "", ...rest }) {
  return (
    <header className={["ntp", className].filter(Boolean).join(" ")} {...rest}>
      {onMenu ? <IconButton icon="menu" label="Open navigation" size="sm" onClick={onMenu} /> : null}
      <button
        type="button"
        onClick={onSearchOpen}
        className="ntp__search nb nb--subtle"
        style={{ justifyContent: "flex-start", height: 34, fontWeight: 400, color: "var(--text-faint)", gap: "var(--sp-2)" }}
      >
        <Icon name="search" size={15} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{searchPlaceholder}</span>
        <span className="ntp__kbd" style={{ marginInlineStart: "auto" }}>{shortcut}</span>
      </button>
      <div className="ntp__spacer" />
      {actions}
      {user ? (
        <div className="ntp__who">
          <span className="ntp__avatar">{user.initials}</span>
          <span className="ntp__whoName">
            <span style={{ fontSize: "var(--fs-app-xs)", fontWeight: 500 }}>{user.name}</span>
            <span className="ntp__role">{user.role}</span>
          </span>
        </div>
      ) : null}
    </header>
  );
}
