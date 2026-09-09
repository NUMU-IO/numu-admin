import React from "react";
import { Icon } from "../core/Icon.jsx";
import { Checkbox } from "../forms/Checkbox.jsx";
import { Skeleton } from "./Skeleton.jsx";

/* Dense, configurable operational table. Columns declare their own alignment
   and type so numbers stay tabular and IDs stay LTR-isolated without the
   screen having to remember. */
export function DataTable({
  columns, rows, dense = false, rowKey = (r, i) => r.id || i,
  selectable = false, selected = [], onSelect, onSelectAll,
  sort, onSort, loading = false, skeletonRows = 6, empty, caption,
  isFlagged, onRowClick, className = "", ...rest
}) {
  const allOn = selectable && rows.length > 0 && selected.length === rows.length;
  const someOn = selectable && selected.length > 0 && !allOn;

  if (loading) {
    return (
      <div className="ntb-wrap">
        <table className={["ntb", dense ? "ntb--dense" : ""].join(" ")}>
          <thead><tr>{selectable ? <th className="ntb__check" /> : null}{columns.map((c) => <th key={c.key} className={c.align === "end" ? "is-num" : ""}>{c.header}</th>)}</tr></thead>
          <tbody>
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={i}>
                {selectable ? <td className="ntb__check" /> : null}
                {columns.map((c) => <td key={c.key}><Skeleton width={c.skeletonWidth || "70%"} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!rows.length && empty) return <div className="ntb-wrap">{empty}</div>;

  return (
    <div className="ntb-wrap">
      <table className={["ntb", dense ? "ntb--dense" : "", className].filter(Boolean).join(" ")} {...rest}>
        {caption ? <caption className="numu-sr">{caption}</caption> : null}
        <thead>
          <tr>
            {selectable ? (
              <th className="ntb__check">
                <Checkbox compact checked={allOn} indeterminate={someOn} onChange={(e) => onSelectAll && onSelectAll(e.target.checked)} aria-label="Select all rows" />
              </th>
            ) : null}
            {columns.map((c) => {
              const isSorted = sort && sort.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  style={c.width ? { width: c.width } : undefined}
                  className={[c.align === "end" ? "is-num" : "", c.sortable ? "is-sortable" : "", isSorted ? "is-sorted" : ""].filter(Boolean).join(" ")}
                  aria-sort={isSorted ? (sort.dir === "asc" ? "ascending" : "descending") : c.sortable ? "none" : undefined}
                  onClick={c.sortable && onSort ? () => onSort(c.key) : undefined}
                >
                  {c.header}
                  {c.sortable ? (
                    <span className="ntb__sort"><Icon name={isSorted && sort.dir === "asc" ? "chevronUp" : "chevronDown"} size={12} /></span>
                  ) : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const k = rowKey(r, i);
            const on = selected.includes(k);
            return (
              <tr
                key={k}
                className={[on ? "is-selected" : "", isFlagged && isFlagged(r) ? "is-flagged" : ""].filter(Boolean).join(" ")}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                style={onRowClick ? { cursor: "pointer" } : undefined}
              >
                {selectable ? (
                  <td className="ntb__check" onClick={(e) => e.stopPropagation()}>
                    <Checkbox compact checked={on} onChange={() => onSelect && onSelect(k)} aria-label={"Select row " + k} />
                  </td>
                ) : null}
                {columns.map((c) => (
                  <td key={c.key} className={[c.align === "end" ? "is-num" : "", c.mono ? "is-mono" : "", c.cellClassName || ""].filter(Boolean).join(" ")}>
                    {c.render ? c.render(r, i) : r[c.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
