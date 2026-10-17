"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "@/app/actions";
import type { ReactNode } from "react";

export function Submit({ children, className = "btn", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} style={style} disabled={pending} aria-busy={pending}>
      {pending ? "Please wait…" : children}
    </button>
  );
}

/** Wraps a server action; shows its error/success message in an accessible live region. */
export function ActionForm({
  action, children, className, id, encType, confirm, style,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
  id?: string;
  encType?: string;
  confirm?: string;
  style?: React.CSSProperties;
}) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form
      id={id}
      action={formAction}
      className={className}
      encType={encType}
      style={style}
      onSubmit={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
    >
      {children}
      <div aria-live="polite" role="status">
        {state?.error && <p className="msg msg-error">{state.error}</p>}
        {state?.ok && <p className="msg msg-ok">{state.ok}</p>}
      </div>
    </form>
  );
}
