import React from "react";
import { Dialog } from "./Dialog.jsx";
import { Button } from "../core/Button.jsx";
import { Input } from "../forms/Input.jsx";
import { KeyValue } from "../core/KeyValue.jsx";

/* Destructive-action gate. Three deliberate frictions:
   1. it names the exact entity being affected,
   2. it lists what will happen, in plain words,
   3. irreversible actions require typing the entity name. */
export function ConfirmDialog({
  open = true, title, entity, consequences, confirmLabel = "Confirm",
  confirmPhrase, tone = "danger", auditNote = true, onConfirm, onClose, children
}) {
  const [typed, setTyped] = React.useState("");
  const ready = !confirmPhrase || typed.trim() === confirmPhrase;
  return (
    <Dialog
      open={open}
      tone={tone}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} disabled={!ready} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      {entity ? <KeyValue items={entity} /> : null}
      {consequences && consequences.length ? (
        <ul style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 5, fontSize: "var(--fs-app-sm)", color: "var(--text-body)" }}>
          {consequences.map((c) => <li key={c}>{c}</li>)}
        </ul>
      ) : null}
      {children}
      {confirmPhrase ? (
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: "var(--fs-app-sm)", color: "var(--text-body)" }}>
            Type <strong className="numu-id" style={{ fontWeight: 600 }}>{confirmPhrase}</strong> to continue
          </span>
          <Input mono value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={confirmPhrase} autoFocus />
        </label>
      ) : null}
      {auditNote ? (
        <p style={{ fontFamily: "var(--ff-mono)", fontSize: "var(--fs-app-mono-sm)", color: "var(--text-muted)", letterSpacing: "var(--ls-mono)" }}>
          This action is recorded in the audit log against your account.
        </p>
      ) : null}
    </Dialog>
  );
}
