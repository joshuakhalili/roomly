"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Plus, Copy, Check } from "lucide-react";
import type { View } from "@/lib/domain";
import { FlowSteps, WorkspaceContext } from "./WorkspaceContext";
import { command, useAction } from "./client";
import {
  EmptyState,
  PageHeading,
  ReadinessChecklist,
  ResidentPreviewSheet,
  StatusMessage,
} from "./primitives";
export function ManagerOverview({ view }: { view: View }) {
  const root = `/manage/properties/${view.property!.id}`;
  return (
    <>
      <PageHeading
        eyebrow="Your workspace / Overview"
        title="Your home at a glance"
        description={`${view.property!.name} · ${view.room!.name}`}
      >
        <ResidentPreviewSheet
          blocks={view.preview}
          home={view.property!.name}
        />
        <Link className="button primary" href={`${root}/invites`}>
          <Plus size={16} aria-hidden />
          Invite a resident
        </Link>
      </PageHeading>
      <div className="overview-counts">
        <Link href={`${root}/content`}>
          <strong>
            {view.blocks.filter((b) => b.published_version).length}
          </strong>
          <small>Published guide sections</small>
        </Link>
        <Link href={`${root}/questions`}>
          <strong>{view.questions.length}</strong>
          <small>Questions to review</small>
        </Link>
        <Link href={`${root}/maintenance`}>
          <strong>
            {
              view.repairs.filter(
                (r) => !["closed", "resolved", "draft"].includes(r.status),
              ).length
            }
          </strong>
          <small>Open repairs</small>
        </Link>
      </div>
      <div className="two-column">
        <section>
          <div className="section-heading">
            <div>
              <span className="eyebrow">The next useful thing</span>
              <h2>Next actions</h2>
            </div>
          </div>
          <ul className="work-list">
            <li>
              <div>
                <strong>Review your home content</strong>
                <p>
                  {
                    view.suggestions.filter((s) => s.status === "pending")
                      .length
                  }{" "}
                  suggestions are ready for your review.
                </p>
              </div>
              <Link
                className="icon-button"
                aria-label="Review home content"
                href={`${root}/content`}
              >
                <ArrowRight size={18} />
              </Link>
            </li>
            <li>
              <div>
                <strong>Welcome someone new</strong>
                <p>Create a private invitation with a seven-day expiry.</p>
              </div>
              <Link
                className="icon-button"
                aria-label="Manage invitations"
                href={`${root}/invites`}
              >
                <ArrowRight size={18} />
              </Link>
            </li>
            <li>
              <div>
                <strong>Update open repairs</strong>
                <p>Review reports and add a useful update.</p>
              </div>
              <Link
                className="icon-button"
                aria-label="Manage maintenance"
                href={`${root}/maintenance`}
              >
                <ArrowRight size={18} />
              </Link>
            </li>
          </ul>
          <div className="divider-section">
            <span className="eyebrow">Your properties</span>
            <ul className="work-list">
              {view.properties.map((p) => (
                <li key={p.id}>
                  <div>
                    <strong>{p.name}</strong>
                    <small>
                      {p.city} · {p.property_type.replaceAll("_", " ")}
                    </small>
                  </div>
                  <Link
                    className="button secondary"
                    href={`/manage/properties/${p.id}`}
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <aside>
          <ReadinessChecklist value={view.readiness!} />
        </aside>
      </div>
    </>
  );
}
export function InvitesPage({
  view,
  refresh,
}: {
  view: View;
  refresh: () => Promise<void>;
}) {
  const [invite, setInvite] = useState<{
    id: string;
    token: string;
    expiresAt: string;
  } | null>(null);
  const action = useAction(refresh);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const currentInvite = view.invites.find((i) => i.id === invite?.id);
  const shareable =
    !!invite &&
    (!currentInvite ||
      (!currentInvite.claimed_at &&
        !currentInvite.revoked_at &&
        Date.parse(currentInvite.expires_at) > view.serverTime));
  return (
    <>
      <PageHeading
        eyebrow="Welcome someone home"
        title="Invitations"
        description="Private, expiring links. Share each invitation directly with its resident."
      />
      <FlowSteps
        steps={[
          "Create a private link",
          "Share with your resident",
          "Resident joins your home",
        ]}
        current={shareable ? 1 : 0}
      />
      <div className="workspace-layout">
        <div>
          <h2 className="section-heading">Create an invitation</h2>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void action
                .run(
                  () =>
                    command<{ id: string; token: string; expiresAt: string }>(
                      "createInvite",
                      {
                        roomId: view.room!.id,
                        email: f.get("email"),
                        expiresInDays: Number(f.get("days")),
                      },
                    ),
                  "Invitation created",
                )
                .then((r) => {
                  if (r) {
                    setInvite(r);
                    setCopied(false);
                    setCopyError("");
                  }
                });
            }}
          >
            <label>
              Resident email (optional)
              <input
                name="email"
                type="email"
                placeholder="resident@example.com"
              />
            </label>
            <label>
              Expires after
              <select name="days">
                <option value="7">7 days</option>
                <option value="1">1 day</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </label>
            <div>
              <button className="button primary" disabled={action.busy}>
                Create invitation
                <Plus size={17} aria-hidden />
              </button>
            </div>
          </form>
          {invite && shareable && (
            <div className="publish-review">
              <h2>Your invitation is ready.</h2>
              <p>
                Expires {new Date(invite.expiresAt).toLocaleString("en-GB")}.
                This link is shown only when created.
              </p>
              <label className="section">
                Private invitation link
                <input
                  readOnly
                  value={`${window.location.origin}/invite/${invite.token}`}
                />
              </label>
              <div className="form-actions">
                <button
                  className="button primary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        `${window.location.origin}/invite/${invite.token}`,
                      );
                      setCopied(true);
                      setCopyError("");
                    } catch {
                      setCopyError(
                        "Copy the link from the field above; your browser could not access the clipboard.",
                      );
                    }
                  }}
                >
                  {copied ? (
                    <Check size={16} aria-hidden />
                  ) : (
                    <Copy size={16} aria-hidden />
                  )}
                  {copied ? "Copied" : "Copy invitation link"}
                </button>
                <Link className="text-button" href={`/invite/${invite.token}`}>
                  Open invitation
                  <ArrowRight size={16} aria-hidden />
                </Link>
              </div>
              <StatusMessage
                message={copied ? "Invitation link copied" : ""}
                error={copyError}
              />
            </div>
          )}
          <StatusMessage {...action} />
        </div>
        <WorkspaceContext title="A welcome, just for them.">
          <p>
            Leave the email blank for a link anyone with the invitation can
            claim. Add an email to restrict it to that account.
          </p>
          <p>
            Each link works once. Share it privately before it expires. You can
            revoke an unused invitation below.
          </p>
          <p>
            After joining, your resident sees their essentials, house agreements
            and first-week steps.
          </p>
        </WorkspaceContext>
      </div>
      <div className="section-heading divider-section">
        <h2>Invitation history</h2>
        <small>{view.invites.length} created</small>
      </div>
      <ul className="work-list invitation-list">
        {view.invites.map((i) => (
          <li key={i.id}>
            <div>
              <strong>{i.invitee_email || "Unassigned invitation"}</strong>
              <small>
                Expires {new Date(i.expires_at).toLocaleString("en-GB")}
              </small>
              <span className="badge">
                {i.claimed_at
                  ? "Claimed"
                  : i.revoked_at
                    ? "Revoked"
                    : Date.parse(i.expires_at) < view.serverTime
                      ? "Expired"
                      : "Ready to share"}
              </span>
            </div>
            {!i.claimed_at && !i.revoked_at && (
              <button
                className="button secondary"
                disabled={action.busy}
                onClick={() =>
                  action.run(
                    () => command("revokeInvite", { inviteId: i.id }),
                    "Invitation revoked",
                  )
                }
              >
                Revoke
              </button>
            )}
          </li>
        ))}
      </ul>
      {!view.invites.length && (
        <EmptyState
          title="Your first welcome is one link away."
          description="Create an invitation above, then share it directly."
        />
      )}
    </>
  );
}
export function QuestionsPage({
  view,
  refresh,
}: {
  view: View;
  refresh: () => Promise<void>;
}) {
  return (
    <>
      <PageHeading
        eyebrow="Ask Roomly / Human handoff"
        title="Questions that need you."
        description="Fill a gap in your handbook with a checked answer."
      />
      <div className="workspace-layout">
        <div>
          <div className="section-heading">
            <h2>Waiting for an answer</h2>
            <small>{view.questions.length} questions</small>
          </div>
          {!view.questions.length ? (
            <EmptyState
              title="You’re all caught up."
              description="Unsupported questions will arrive here for your review."
            />
          ) : (
            view.questions.map((q) => (
              <QuestionItem
                key={q.id}
                question={q}
                refresh={refresh}
                contentHref={`/manage/properties/${view.property!.id}/content`}
              />
            ))
          )}
        </div>
        <WorkspaceContext title="Turn a gap into a useful answer.">
          <FlowSteps
            steps={[
              "Check the question",
              "Write a verified answer",
              "Review and publish in Content",
            ]}
            current={0}
          />
          <p>
            Creating an FAQ saves a draft. Residents see it after you review and
            publish the handbook.
          </p>
        </WorkspaceContext>
      </div>
    </>
  );
}
function QuestionItem({
  question: q,
  refresh,
  contentHref,
}: {
  question: View["questions"][number];
  refresh: () => Promise<void>;
  contentHref: string;
}) {
  const [answer, setAnswer] = useState("");
  const action = useAction(refresh);
  return (
    <section className="divider-section">
      <span className="badge">
        {q.outcome} · {q.category.replaceAll("_", " ")}
      </span>
      <h2 className="section">{q.question_redacted}</h2>
      <form
        className="form-stack section"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(
            () => command("questionToFaq", { questionId: q.id, answer }),
            "FAQ draft created. Review and publish from Content.",
          );
        }}
      >
        <label>
          Your checked answer
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            required
          />
        </label>
        <div>
          <button
            className="button primary"
            disabled={action.busy || !!action.message}
          >
            Create FAQ draft
          </button>
        </div>
      </form>
      <StatusMessage {...action} />
      {action.message && (
        <Link className="text-button" href={contentHref}>
          Review the draft in Content <ArrowRight size={16} aria-hidden />
        </Link>
      )}
    </section>
  );
}
export function SettingsPage({
  view,
  refresh,
}: {
  view: View;
  refresh: () => Promise<void>;
}) {
  const r = view.room!;
  const action = useAction(refresh);
  return (
    <>
      <PageHeading
        eyebrow="Home details"
        title="Settings"
        description="Keep your operational contacts and language review up to date."
      />
      <div className="workspace-layout">
        <form
          className="form-stack settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget));
            void action.run(
              () =>
                command("saveSettings", {
                  roomId: r.id,
                  name: f.name,
                  managerPhone: f.managerPhone,
                  emergencyPhone: f.emergencyPhone,
                  languagesReviewed: f.languagesReviewed === "on",
                }),
              "Settings saved. Edit and publish contact blocks to update the resident guide.",
            );
          }}
        >
          <fieldset>
            <legend>Home details</legend>
            <label>
              Room or unit name
              <input name="name" defaultValue={r.name} required />
            </label>
          </fieldset>
          <fieldset>
            <legend>People to contact</legend>
            <p className="field-help">
              Use numbers residents can rely on for this home.
            </p>
            <div className="form-grid">
              <label>
                Manager phone
                <input
                  name="managerPhone"
                  defaultValue={r.manager_contact_json.phone}
                  required
                />
              </label>
              <label>
                Emergency phone
                <input
                  name="emergencyPhone"
                  defaultValue={r.emergency_contact_json.phone}
                  required
                />
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Languages and review</legend>
            <label>
              <input
                type="checkbox"
                name="languagesReviewed"
                defaultChecked={r.languages_reviewed}
              />
              I have reviewed the supported languages and translation coverage
            </label>
            <small>
              Supported languages: {r.supported_locales.join(", ")}. Only
              reviewed and published translations are shown to residents.
            </small>
          </fieldset>
          <div>
            <button className="button primary" disabled={action.busy}>
              Save settings
            </button>
          </div>
        </form>
        <WorkspaceContext title={view.property!.name}>
          <p>
            {r.name} · {view.property!.city}
          </p>
          <p>
            Changes here update the home’s operational details. To change the
            wording in the resident guide, edit the contact sections in Content
            and publish them.
          </p>
          <Link
            className="text-button"
            href={`/manage/properties/${view.property!.id}/content`}
          >
            Edit resident guide <ArrowRight size={16} aria-hidden />
          </Link>
        </WorkspaceContext>
      </div>
      <StatusMessage {...action} />
    </>
  );
}
