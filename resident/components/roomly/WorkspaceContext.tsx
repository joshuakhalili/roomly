import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import type { View } from "@/lib/domain";

export function WorkspaceContext({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className="workspace-context">
      <span className="eyebrow">Good to know</span>
      <h2>{title}</h2>
      {children}
    </aside>
  );
}
export function HumanHelp({ view }: { view: View }) {
  const contact = view.room?.manager_contact_json;
  return (
    <div className="human-help">
      <span className="avatar" aria-hidden>
        {(contact?.name || "M").charAt(0)}
      </span>
      <div>
        <strong>{contact?.name || "Your manager"}</strong>
        <small>Your person for this home</small>
        <a
          className="text-button"
          href={`tel:${contact?.phone?.replace(/\s/g, "") || ""}`}
        >
          Contact your manager <ArrowUpRight size={16} aria-hidden />
        </a>
      </div>
    </div>
  );
}
export function FlowSteps({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="flow-steps" aria-label="Your next steps">
      {steps.map((step, i) => (
        <li
          key={step}
          aria-current={current === i ? "step" : undefined}
          className={i < current ? "completed" : ""}
        >
          <span aria-hidden>{String(i + 1).padStart(2, "0")}</span>
          <strong>{step}</strong>
        </li>
      ))}
    </ol>
  );
}
