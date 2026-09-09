import React from "react";
import { Button } from "../core/Button.jsx";
import { Select } from "../forms/Select.jsx";

export function Pagination({ page = 1, pageSize = 50, total = 0, onPageChange, onPageSizeChange, pageSizes = [25, 50, 100, 250], className = "", ...rest }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const last = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className={["npg", className].filter(Boolean).join(" ")} {...rest}>
      <span className="npg__info">{from}–{to} of {total.toLocaleString("en-US")}</span>
      <div className="npg__ctrl">
        {onPageSizeChange ? (
          <Select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            options={pageSizes.map((n) => ({ value: String(n), label: n + " / page" }))}
            style={{ height: 32, width: 120, fontSize: "var(--fs-app-sm)" }}
            aria-label="Rows per page"
          />
        ) : null}
        <Button variant="subtle" size="sm" icon="chevronLeft" disabled={page <= 1} onClick={() => onPageChange && onPageChange(page - 1)}>Prev</Button>
        <span className="npg__info" style={{ padding: "0 var(--sp-2)" }}>{page} / {last}</span>
        <Button variant="subtle" size="sm" iconEnd="chevronRight" disabled={page >= last} onClick={() => onPageChange && onPageChange(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
