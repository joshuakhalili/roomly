"use client";
import Link from "next/link";
import { HomeLink } from "./HomeLink";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpRight,
  Check,
  Home,
  BookOpen,
  MessageCircle,
  Wrench,
  LayoutDashboard,
  FileText,
  Mail,
  Settings,
  X,
  ArrowRight,
  DoorOpen,
  ShieldCheck,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import type { Block, RepairEvent } from "@/lib/model";
import type { View } from "@/lib/domain";
export function RoomlyLogo() {
  return (
    <Link className="logo" href="/" aria-label="Roomly home">
      <DoorOpen strokeWidth={2.5} aria-hidden />
      <span>
        roomly<span className="logo-dot">.</span>
      </span>
    </Link>
  );
}
export function ResidentNav() {
  const path = usePathname();
  return (
    <nav className="resident-nav" aria-label="Resident navigation">
      {[
        [Home, "Home", "/home"],
        [BookOpen, "Guide", "/home/guide"],
        [MessageCircle, "Ask", "/home/ask"],
        [Wrench, "Repairs", "/home/repairs"],
      ].map(([Icon, label, href]) => {
        const I = Icon as typeof Home;
        return (
          <HomeLink
            key={String(href)}
            href={String(href)}
            aria-current={
              path === href ||
              (href != "/home" && path.startsWith(String(href)))
                ? "page"
                : undefined
            }
          >
            <I aria-hidden size={20} />
            <span>{String(label)}</span>
          </HomeLink>
        );
      })}
    </nav>
  );
}
export function ManagerNav({ propertyId }: { propertyId?: string }) {
  const path = usePathname();
  const root = propertyId ? `/manage/properties/${propertyId}` : "/manage";
  return (
    <nav className="manager-nav" aria-label="Manager navigation">
      {[
        [LayoutDashboard, "Overview", ""],
        [FileText, "Content", "/content"],
        [Mail, "Invites", "/invites"],
        [MessageCircle, "Questions", "/questions"],
        [Wrench, "Maintenance", "/maintenance"],
        [Settings, "Settings", "/settings"],
      ].map(([Icon, label, suffix]) => {
        const I = Icon as typeof Home;
        const href = root + suffix;
        return (
          <Link
            key={String(label)}
            href={href}
            aria-current={
              path === href || (!suffix && path === "/manage")
                ? "page"
                : undefined
            }
          >
            <I size={19} aria-hidden />
            <span>{String(label)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
export function AppShell({
  view,
  manager,
  children,
}: {
  view: View;
  manager: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`app-shell ${manager ? "manager-shell" : "resident-shell"}`}
    >
      <aside className="sidebar">
        <RoomlyLogo />
        <div className="home-label">
          <span className="eyebrow">{manager ? "Workspace" : "Your home"}</span>
          <strong>{view.property?.name || "Roomly Homes"}</strong>
          <small>{view.room?.name || "A place to begin"}</small>
        </div>
        {manager ? (
          <ManagerNav propertyId={view.property?.id} />
        ) : (
          <ResidentNav />
        )}
        <div className="sidebar-bottom">
          <span className="avatar">
            {(view.profile.preferred_name || view.profile.display_name).charAt(
              0,
            )}
          </span>
          <div>
            <strong>
              {view.profile.preferred_name || view.profile.display_name}
            </strong>
            <small>{manager ? "Home manager" : "Resident"}</small>
          </div>
          <Link className="icon-button" href="/sign-in" aria-label="Account">
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="workspace-breadcrumb">
            <span>{manager ? "Manager workspace" : "Roomly Home"}</span>
            <span aria-hidden>/</span>
            <strong>{view.room?.name || "Welcome"}</strong>
          </span>
          <span className="topbar-meta">
            <ShieldCheck size={16} aria-hidden /> Private to your home
          </span>
        </header>
        <main id="main" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>Made for feeling at home.</span>
          <a
            href={`tel:${view.room?.manager_contact_json.phone.replace(/\s/g, "") || ""}`}
          >
            Contact {view.room?.manager_contact_json.name || "your manager"}{" "}
            <ArrowUpRight size={15} aria-hidden />
          </a>
        </footer>
      </div>
    </div>
  );
}
export function SaveStatus({ state }: { state: string }) {
  return (
    <span className="save-status" role="status">
      {state === "Saved" ? <Check size={15} aria-hidden /> : null}
      {state}
    </span>
  );
}
export function StatusMessage({
  busy,
  error,
  message,
}: {
  busy?: boolean;
  error?: string;
  message?: string;
}) {
  return (
    <div aria-live="polite" className="status-message">
      {busy && <p role="status">Working…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && !busy && <p className="success">{message}</p>}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-mark">
        <Home aria-hidden />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function PermissionBadge({ visibility }: { visibility: string }) {
  return (
    <span className="badge">
      {visibility === "scheduled"
        ? "Scheduled release"
        : visibility === "manager_only"
          ? "Managers only"
          : visibility === "invitee"
            ? "Welcome information"
            : "Members only"}
    </span>
  );
}
export function OnboardingProgress({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <>
      <div className="progress-top">
        <span className="eyebrow">
          Step {Math.min(current + 1, steps.length)} of {steps.length}
        </span>
        <span>{Math.round((current / steps.length) * 100)}% complete</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={current}
      >
        {steps.map((s, i) => (
          <span key={s} className={i <= current ? "filled" : ""} />
        ))}
      </div>
      <ol className="step-list">
        {steps.map((s, i) => (
          <li key={s} aria-current={current === i ? "step" : undefined}>
            <span>
              {i < current ? <Check size={13} aria-label="Complete" /> : i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </>
  );
}
export function ReadinessChecklist({
  value,
}: {
  value: NonNullable<View["readiness"]>;
}) {
  return (
    <section className="readiness">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Ready to welcome</span>
          <h2>Home readiness</h2>
        </div>
        <strong className="score">
          {value.score}
          <small>%</small>
        </strong>
      </div>
      <div className="readiness-bar">
        <span style={{ width: `${value.score}%` }} />
      </div>
      <ul className="check-list">
        {value.checks.map((c) => (
          <li key={c.name}>
            <span className={c.pass ? "checked" : "unchecked"}>
              {c.pass ? (
                <Check size={15} aria-label="Complete" />
              ) : (
                <span aria-label="Missing">—</span>
              )}
            </span>
            <span>
              {c.name}
              {c.required && !c.pass && <small>Required to publish</small>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
export function EssentialList({ blocks }: { blocks: Block[] }) {
  return (
    <dl className="essential-list">
      {blocks
        .filter((b) => ["essential", "access", "safety"].includes(b.kind))
        .map((b) => (
          <div key={b.id} id={b.id}>
            <dt>{b.title}</dt>
            <dd>
              {b.body}
              {b.visibility === "scheduled" && (
                <PermissionBadge visibility={b.visibility} />
              )}
            </dd>
          </div>
        ))}
    </dl>
  );
}
export function GuideSections({ blocks }: { blocks: Block[] }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reveal = () => {
      const id = window.location.hash.slice(1);
      for (const detail of root.current?.querySelectorAll("details") || []) {
        if (detail.id === id) {
          detail.open = true;
          detail.scrollIntoView({ block: "start" });
        }
      }
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, [blocks]);
  return (
    <div className="guide-sections" ref={root}>
      {blocks.map((b) => (
        <details key={b.id} id={b.id}>
          <summary>
            <span>
              <small>{b.kind.replace("_", " ")}</small>
              <strong>{b.title}</strong>
            </span>
            <span className="expand" aria-hidden>
              +
            </span>
          </summary>
          <div className="guide-body">
            <p>{b.body}</p>
            <small>
              Last checked{" "}
              {b.verified_at
                ? new Date(b.verified_at).toLocaleDateString("en-GB")
                : "Not yet checked"}
            </small>
          </div>
        </details>
      ))}
    </div>
  );
}
export function ResidentPreviewSheet({
  blocks,
  home,
}: {
  blocks: Block[];
  home: string;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="button secondary">
        Resident preview <ArrowUpRight size={16} aria-hidden />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="preview-sheet">
          <div className="sheet-heading">
            <div>
              <Dialog.Title>Resident preview</Dialog.Title>
              <Dialog.Description>
                Currently published information, with resident permissions
                applied.
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close preview">
              <X size={22} />
            </Dialog.Close>
          </div>
          <div className="resident-preview">
            <span className="eyebrow">{home}</span>
            <h2>A little more at home.</h2>
            <EssentialList blocks={blocks} />
            <GuideSections
              blocks={blocks.filter(
                (b) => !["essential", "access", "safety"].includes(b.kind),
              )}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function MaintenanceTimeline({ events }: { events: RepairEvent[] }) {
  return (
    <ol className="timeline">
      {events.map((e) => (
        <li key={e.id}>
          <span className="timeline-dot" />
          <div>
            <strong>{e.event_type.replaceAll("_", " ")}</strong>
            <small>{new Date(e.created_at).toLocaleString("en-GB")}</small>
            <p>{e.note}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}
export function ContinueButton({
  children = "Continue",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="button primary" {...props}>
      {children}
      <ArrowRight size={18} aria-hidden />
    </button>
  );
}
