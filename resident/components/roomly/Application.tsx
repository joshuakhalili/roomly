"use client";
import { useCallback, useSyncExternalStore, useState } from "react";
import { HomeLink as Link } from "./HomeLink";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { View } from "@/lib/domain";
import {
  AppShell,
  EmptyState,
  EssentialList,
  PageHeading,
  StatusMessage,
} from "./primitives";
import { GuidePage } from "./GuidePage";
import { HumanHelp, WorkspaceContext } from "./WorkspaceContext";
import { AskRoomly } from "./AskRoomly";
import { ContentEditor } from "./ContentEditor";
import { FirstWeek, ManagerOnboarding, ResidentOnboarding } from "./Onboarding";
import {
  InvitesPage,
  ManagerOverview,
  QuestionsPage,
  SettingsPage,
} from "./ManagerPages";
import { NewRepair, RepairDetail, RepairList } from "./Maintenance";
import { command, useAction } from "./client";
export function Application({
  initial,
  path,
}: {
  initial: View;
  path: string;
}) {
  const [view, setView] = useState(initial);
  const offline = useSyncExternalStore(
    (notify) => {
      window.addEventListener("online", notify);
      window.addEventListener("offline", notify);
      return () => {
        window.removeEventListener("online", notify);
        window.removeEventListener("offline", notify);
      };
    },
    () => !navigator.onLine,
    () => false,
  );
  const refresh = useCallback(async () => {
    const response = await fetch(
      `/api/state${initial.room ? `?room=${initial.room.id}` : ""}`,
      { cache: "no-store" },
    );
    const r = await response.json();
    if (!r.ok) throw new Error(r.error.message);
    setView(r.data);
  }, [initial.room]);
  if (path === "/onboarding/manager")
    return <ManagerOnboarding view={view} refresh={refresh} />;
  if (path.startsWith("/onboarding/resident/"))
    return view.member ? (
      <ResidentOnboarding view={view} refresh={refresh} />
    ) : (
      <EmptyState
        title="Membership unavailable"
        description="Sign in with the account that claimed this home."
      />
    );
  const manager = path.startsWith("/manage");
  let content;
  if (manager && !view.manager)
    content = (
      <EmptyState
        title="Start with your first home."
        description="Create your organisation and property in a few short steps."
      >
        <Link href="/onboarding/manager" className="button primary">
          Set up a home
        </Link>
      </EmptyState>
    );
  else if (!manager && !view.member)
    content = (
      <EmptyState
        title="Your home is waiting."
        description="Use the private invitation from your manager to join a home."
      >
        <Link href="/onboarding/manager" className="button secondary">
          I manage a home
        </Link>
      </EmptyState>
    );
  else if (manager) {
    if (path.endsWith("/content"))
      content = <ContentEditor view={view} refresh={refresh} />;
    else if (path.endsWith("/invites"))
      content = <InvitesPage view={view} refresh={refresh} />;
    else if (path.endsWith("/questions"))
      content = <QuestionsPage view={view} refresh={refresh} />;
    else if (path.endsWith("/maintenance"))
      content = <RepairList view={view} manager refresh={refresh} />;
    else if (path.endsWith("/settings"))
      content = <SettingsPage view={view} refresh={refresh} />;
    else content = <ManagerOverview view={view} />;
  } else if (path === "/home")
    content = <ResidentHome view={view} refresh={refresh} />;
  else if (path === "/home/guide")
    content = (
      <>
        <PageHeading
          eyebrow="Your home handbook"
          title="Your home guide"
          description="The everyday details, checked and kept in one place."
        >
          <LocaleSelect view={view} refresh={refresh} />
        </PageHeading>
        <GuidePage view={view} refresh={refresh} />
      </>
    );
  else if (path === "/home/ask")
    content = (
      <>
        <PageHeading
          eyebrow="Ask Roomly"
          title="A little help, when you need it."
          description="Answers from your checked home guide, with a person to turn to."
        />
        <div className="workspace-layout ask-workspace">
          <AskRoomly
            roomId={view.room!.id}
            contact={view.room!.manager_contact_json.phone}
          />
          <WorkspaceContext title="A source for every answer.">
            <p>
              Roomly uses your published home guide. Open the sources below an
              answer to check the details.
            </p>
            <p>
              If your guide doesn’t have an answer, your question goes to your
              manager for review.
            </p>
            <Link className="text-button" href="/home/guide">
              Browse your home guide <ArrowUpRight size={16} aria-hidden />
            </Link>
            <HumanHelp view={view} />
          </WorkspaceContext>
        </div>
      </>
    );
  else if (path === "/home/repairs")
    content = <RepairList view={view} manager={false} refresh={refresh} />;
  else if (path === "/home/repairs/new")
    content = <NewRepair view={view} refresh={refresh} />;
  else {
    const r = view.repairs.find((r) => r.id === path.split("/").pop());
    content = r ? (
      <>
        <PageHeading eyebrow="Your repair" title={r.title}>
          <Link className="button secondary" href="/home/repairs">
            All repairs
          </Link>
        </PageHeading>
        <RepairDetail
          view={view}
          repair={r}
          manager={false}
          refresh={refresh}
        />
      </>
    ) : (
      <EmptyState
        title="Report unavailable"
        description="This report does not belong to your active membership."
      />
    );
  }
  return (
    <>
      {offline && (
        <div className="offline-banner" role="alert">
          You’re offline. Keep your entries here, reconnect, and retry.
        </div>
      )}
      <AppShell view={view} manager={manager}>
        {content}
      </AppShell>
    </>
  );
}
function LocaleSelect({
  view,
  refresh,
}: {
  view: View;
  refresh: () => Promise<void>;
}) {
  const action = useAction(refresh);
  return (
    <>
      <label className="sr-only" htmlFor="content-language">
        Content language
      </label>
      <select
        id="content-language"
        className="locale-selector"
        value={view.profile.locale}
        disabled={action.busy}
        onChange={(e) =>
          action.run(
            () =>
              command("saveResidentPreferences", {
                membershipId: view.member!.id,
                preferredName:
                  view.profile.preferred_name || view.profile.display_name,
                locale: e.target.value,
                pronouns: view.profile.pronouns || "",
                notification: view.profile.notification_preference,
              }),
            "",
          )
        }
      >
        <option value="en-GB">English</option>
        <option value="zh-CN">简体中文</option>
        <option value="tr-TR">Türkçe</option>
      </select>
      <StatusMessage {...action} />
    </>
  );
}
function ResidentHome({
  view,
  refresh,
}: {
  view: View;
  refresh: () => Promise<void>;
}) {
  const router = useRouter();
  const name = view.profile.preferred_name || view.profile.display_name;
  const incomplete = view.tasks.find(
    (t) => !view.completions.some((c) => c.onboarding_task_id === t.id),
  );
  const onboarding = !view.member!.onboarding_completed_at;
  const pendingAgreement = view.blocks.some(
    (b) =>
      b.required_acknowledgement &&
      !view.acknowledgements.some(
        (a) => a.content_block_id === b.id && a.content_version === b.version,
      ),
  );
  const today = onboarding
    ? "A few steps to feel at home"
    : pendingAgreement
      ? "Review your house agreements"
      : incomplete?.title;
  const reviewed = view.blocks
    .map((b) => b.verified_at)
    .filter(Boolean) as string[];
  return (
    <>
      {view.memberships.length > 1 && (
        <label>
          Choose your home
          <select
            value={view.member!.room_id}
            onChange={(e) => router.push(`/home?room=${e.target.value}`)}
          >
            {view.memberships.map((m) => (
              <option key={m.id} value={m.room_id}>
                {m.homeName}
              </option>
            ))}
          </select>
        </label>
      )}
      <header className="resident-header">
        <div className="header-top">
          <span className="eyebrow">
            {view.property!.name} · {view.room!.name}
          </span>
          <small>
            Active resident
            <br />
            {reviewed.length
              ? `Checked ${new Date(Math.min(...reviewed.map(Date.parse))).toLocaleDateString("en-GB")}`
              : "Awaiting review"}
          </small>
        </div>
        <h1>
          Good to have you
          <br />
          home, {name}.
        </h1>
        <p>Your people. Your essentials. Your place.</p>
        <div className="door-art" aria-hidden />
      </header>
      <div className="resident-columns">
        <div>
          {today && (
            <section className="today">
              <div>
                <span className="eyebrow">Today · one small thing</span>
                <h2>{today}</h2>
              </div>
              <Link
                className="button secondary"
                href={
                  onboarding
                    ? `/onboarding/resident/${view.member!.id}`
                    : "/home/guide"
                }
              >
                Let’s go
                <ArrowRight size={17} aria-hidden />
              </Link>
            </section>
          )}
          <div className="section-heading">
            <h2>The essentials</h2>
            <LocaleSelect view={view} refresh={refresh} />
          </div>
          <EssentialList blocks={view.blocks} />
          <AskRoomly
            roomId={view.room!.id}
            contact={view.room!.manager_contact_json.phone}
          />
        </div>
        <aside className="resident-aside">
          {incomplete && <FirstWeek view={view} refresh={refresh} />}
          <section className="section">
            <span className="eyebrow">We’re on it</span>
            <h2 className="section-heading">Repair updates</h2>
            {view.repairs
              .filter(
                (r) => !["draft", "closed", "resolved"].includes(r.status),
              )
              .map((r) => (
                <Link
                  className="repair-update-link"
                  key={r.id}
                  href={`/home/repairs/${r.id}`}
                >
                  <strong>{r.title}</strong>
                  <small>{r.status.replaceAll("_", " ")}</small>
                  <ArrowUpRight size={17} aria-hidden />
                </Link>
              ))}
            {!view.repairs.some(
              (r) => !["draft", "closed", "resolved"].includes(r.status),
            ) && <p>No active repair requests.</p>}
            <Link className="text-button" href="/home/repairs/new">
              Report a repair
              <ArrowUpRight size={16} aria-hidden />
            </Link>
          </section>
          <section className="section">
            <span className="eyebrow">The home handbook</span>
            <h2>Get to know your home.</h2>
            <div className="shortcut-list">
              {[
                "House agreements",
                "Bins & recycling",
                "Guests",
                "Local area",
                "Documents",
                "People",
              ].map((label, i) => {
                const key = [
                  "rules",
                  "bins",
                  "guests",
                  "local",
                  "documents",
                  "people",
                ][i];
                return (
                  <Link
                    key={label}
                    href={`/home/guide#${view.blocks.find((b) => b.data.key === key)?.id || ""}`}
                  >
                    {label}
                    <ArrowUpRight size={16} aria-hidden />
                  </Link>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
