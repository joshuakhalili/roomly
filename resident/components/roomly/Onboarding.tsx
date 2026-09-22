"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { homeHref } from "@/lib/home-navigation";
import { useRouter } from "next/navigation";
import { Check, DoorOpen, FileCheck, Users } from "lucide-react";
import type { View } from "@/lib/domain";
import type { Block } from "@/lib/model";
import { command, useAction } from "./client";
import {
  ContinueButton,
  EssentialList,
  OnboardingProgress,
  PageHeading,
  ReadinessChecklist,
  ResidentPreviewSheet,
  RoomlyLogo,
  SaveStatus,
  StatusMessage,
} from "./primitives";
import { AiSuggestionReview } from "./ContentEditor";
const MANAGER_STEPS = [
  "Welcome",
  "Organisation",
  "Property",
  "Home",
  "Source material",
  "Assist review",
  "Publish & invite",
];
const RESIDENT_STEPS = [
  "Invitation",
  "Identity",
  "Preferences",
  "Essentials",
  "Agreements",
  "First week",
  "Welcome home",
];
export function ManagerOnboarding({
  view,
  refresh,
}: {
  view: View;
  refresh: () => Promise<void>;
}) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(view.progress?.step || 0, 6));
  const [values, setValues] = useState<Record<string, string>>(
    view.progress?.values || {
      propertyType: "shared_house",
      timezone: "Europe/London",
      capacity: "4",
      locales: "en-GB,zh-CN,tr-TR",
    },
  );
  const [saveState, setSaveState] = useState("Saved");
  const [invite, setInvite] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef(Promise.resolve());
  const action = useAction(refresh);
  function update(key: string, value: string) {
    const next = { ...values, [key]: value };
    setValues(next);
    setSaveState("Saving…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      queue.current = queue.current.then(async () => {
        try {
          await command("saveManagerOnboardingStep", {
            step,
            values: next,
            advance: false,
          });
          setSaveState("Saved");
        } catch {
          setSaveState(navigator.onLine ? "Failed" : "Offline");
        }
      });
    }, 600);
  }
  async function advance() {
    if (timer.current) clearTimeout(timer.current);
    await queue.current;
    const r = await action.run(
      () =>
        command<{ providerUnavailable?: boolean; invite?: { token: string } }>(
          "saveManagerOnboardingStep",
          { step, values, advance: true },
        ),
      "Progress saved",
    );
    if (r) {
      if (r.providerUnavailable) {
        setSaveState("Provider unavailable. Retry or revise your notes.");
        return;
      }
      if (step === 6) {
        setInvite(r.invite?.token || null);
      } else setStep(step + 1);
    }
  }
  const field = (key: string, label: string, type = "text") => (
    <label key={key}>
      {label}
      <input
        name={key}
        type={type}
        value={values[key] || ""}
        onChange={(e) => update(key, e.target.value)}
        required
      />
    </label>
  );
  const headings = [
    "A good welcome starts here.",
    "Who’s welcoming them?",
    "Give your home a name.",
    "The practical essentials.",
    "Your knowledge, organised.",
    "A human check makes it yours.",
    "Ready for your first resident.",
  ];
  return (
    <div className="onboarding-page">
      <div className="onboarding-top">
        <RoomlyLogo />
        <SaveStatus state={saveState} />
      </div>
      <div className="onboarding-layout">
        <aside>
          <OnboardingProgress steps={MANAGER_STEPS} current={step} />
          <p className="welcome-note">
            About seven minutes.
            <br />
            Your progress saves as you go.
          </p>
        </aside>
        <main id="main" className="onboarding-main">
          <PageHeading eyebrow="Set up your home" title={headings[step]} />
          {invite ? (
            <>
              <div className="welcome-illustration">
                <Check aria-hidden />
              </div>
              <h2>Your home is published.</h2>
              <p>
                Share this invitation directly with your resident. It is valid
                for seven days and can be claimed once.
              </p>
              <label>
                First invitation
                <input
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/invite/${invite}`}
                />
              </label>
              <Link className="button secondary" href={`/invite/${invite}`}>
                Open invitation
              </Link>
              <button
                className="button primary"
                onClick={() => router.push("/manage")}
              >
                Go to manager overview
              </button>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void advance();
              }}
            >
              {step === 0 && (
                <>
                  <p>
                    Create one clear place for the things your residents need to
                    know.
                  </p>
                  <div className="welcome-illustration">
                    <DoorOpen aria-hidden />
                  </div>
                  <div className="welcome-points">
                    <div>
                      <Users size={22} aria-hidden />
                      <div>
                        <strong>Start with your home</strong>
                        <p>Add a few details and the people to contact.</p>
                      </div>
                    </div>
                    <div>
                      <FileCheck size={22} aria-hidden />
                      <div>
                        <strong>Turn your notes into a guide</strong>
                        <p>
                          Roomly Assist prepares suggestions for you to review.
                        </p>
                      </div>
                    </div>
                    <div>
                      <Check size={22} aria-hidden />
                      <div>
                        <strong>Welcome your first resident</strong>
                        <p>
                          Publish the essentials and share a secure invitation.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {step === 1 && (
                <div className="form-stack">
                  {field("organisationName", "Organisation name")}
                  {field("managerName", "Your display name")}
                </div>
              )}
              {step === 2 && (
                <div className="form-grid">
                  <div className="span-two">
                    {field("propertyName", "Property name")}
                  </div>
                  <div className="span-two">
                    {field("address", "Street address")}
                  </div>
                  {field("city", "City")}
                  {field("postcode", "Postcode")}
                  <label>
                    Property type
                    <select
                      value={values.propertyType}
                      onChange={(e) => update("propertyType", e.target.value)}
                    >
                      <option value="shared_house">Shared house</option>
                      <option value="student_house">Student house</option>
                      <option value="coliving">Co-living</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    Timezone
                    <select
                      value={values.timezone}
                      onChange={(e) => update("timezone", e.target.value)}
                    >
                      <option>Europe/London</option>
                    </select>
                  </label>
                </div>
              )}
              {step === 3 && (
                <div className="form-grid">
                  {field("roomName", "Room or unit name")}
                  {field("capacity", "Resident capacity", "number")}
                  {field("managerPhone", "Manager phone", "tel")}
                  {field("emergencyPhone", "Home emergency phone", "tel")}
                  <label className="span-two">
                    Preferred languages
                    <select
                      value={values.locales}
                      onChange={(e) => update("locales", e.target.value)}
                    >
                      <option value="en-GB,zh-CN,tr-TR">
                        English, 简体中文, Türkçe
                      </option>
                      <option value="en-GB">English</option>
                    </select>
                  </label>
                </div>
              )}
              {step === 4 && (
                <>
                  <p>
                    Paste the notes you would normally send before move-in.
                    Leave passwords and access codes out; add those directly in
                    your content editor.
                  </p>
                  <label className="section">
                    Home notes
                    <textarea
                      value={values.notes || ""}
                      onChange={(e) => update("notes", e.target.value)}
                      required
                      rows={9}
                      placeholder="Bins are collected on Tuesday. Keep shared spaces clean. Quiet hours start at 22:00…"
                    />
                  </label>
                  <p>
                    <small>
                      Roomly prepares drafts. You decide what to keep.
                    </small>
                  </p>
                </>
              )}
              {step === 5 && (
                <>
                  <p>
                    Accept the original, edit before applying, or skip. These
                    choices are saved separately.
                  </p>
                  <AiSuggestionReview
                    suggestions={view.suggestions}
                    refresh={refresh}
                  />
                </>
              )}
              {step === 6 && (
                <>
                  <p>
                    Your contact, address, access and repair guidance are ready.
                    Review the checklist before publishing.
                  </p>
                  {view.readiness && (
                    <ReadinessChecklist value={view.readiness} />
                  )}
                  <ResidentPreviewSheet
                    blocks={view.preview}
                    home={view.property?.name || "Your home"}
                  />
                  <p>
                    <small>
                      The preview shows the current published version.
                      Publishing releases the setup draft.
                    </small>
                  </p>
                </>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={step === 0 || action.busy}
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </button>
                <ContinueButton disabled={action.busy}>
                  {step === 6
                    ? "Publish and create invitation"
                    : step === 4
                      ? "Prepare suggestions"
                      : step === 0
                        ? "Let’s begin"
                        : "Continue"}
                </ContinueButton>
              </div>
              <StatusMessage {...action} />
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
export function AgreementList({
  blocks,
  view,
  refresh,
}: {
  blocks: Block[];
  view: View;
  refresh: () => Promise<void>;
}) {
  const action = useAction(refresh);
  return (
    <div>
      {blocks
        .filter((b) => b.kind === "agreement")
        .map((b) => {
          const done = view.acknowledgements.some(
            (a) =>
              a.content_block_id === b.id && a.content_version === b.version,
          );
          return (
            <article className="agreement" id={b.id} key={b.id}>
              <h2>{b.title}</h2>
              <p>{b.body}</p>
              <small>
                Version {b.version} ·{" "}
                {b.required_acknowledgement
                  ? "Acknowledgement required"
                  : "Guidance only"}
              </small>
              {b.required_acknowledgement && (
                <label>
                  <input
                    type="checkbox"
                    checked={done}
                    disabled={done || action.busy}
                    onChange={() =>
                      action.run(
                        () =>
                          command("acknowledgeBlock", {
                            membershipId: view.member!.id,
                            blockId: b.id,
                            version: b.version,
                          }),
                        "Acknowledgement saved",
                      )
                    }
                  />
                  I have read and agree to this house agreement
                </label>
              )}
            </article>
          );
        })}
      <StatusMessage {...action} />
    </div>
  );
}
export function FirstWeek({
  view,
  refresh,
}: {
  view: View;
  refresh: () => Promise<void>;
}) {
  const action = useAction(refresh);
  return (
    <div className="first-week">
      <div className="section-heading">
        <h2>Your first week</h2>
        <small>
          {view.completions.length}/{view.tasks.length}
        </small>
      </div>
      <ul className="task-list">
        {view.tasks.map((t) => {
          const done = view.completions.some(
            (c) => c.onboarding_task_id === t.id,
          );
          return (
            <li key={t.id} className={done ? "done" : ""}>
              <button
                type="button"
                aria-pressed={done}
                disabled={done || action.busy}
                onClick={() =>
                  action.run(
                    () =>
                      command("completeOnboardingTask", {
                        membershipId: view.member!.id,
                        taskId: t.id,
                      }),
                    "First-week action saved",
                  )
                }
              >
                <span className="task-circle">
                  {done && <Check size={13} aria-hidden />}
                </span>
                {t.title}
              </button>
            </li>
          );
        })}
      </ul>
      <StatusMessage {...action} />
    </div>
  );
}
export function ResidentOnboarding({
  view,
  refresh,
}: {
  view: View;
  refresh: () => Promise<void>;
}) {
  const m = view.member!;
  const router = useRouter();
  const [step, setStep] = useState(Math.min(m.onboarding_step, 6));
  const action = useAction(refresh);
  const [name, setName] = useState(
    view.profile.preferred_name || view.profile.display_name,
  );
  const [locale, setLocale] = useState(view.profile.locale);
  const [pronouns, setPronouns] = useState(view.profile.pronouns || "");
  const [notification, setNotification] = useState(
    view.profile.notification_preference,
  );
  async function advance() {
    const r = await action.run(
      () =>
        step === 2
          ? command("saveResidentPreferences", {
              membershipId: m.id,
              preferredName: name,
              locale,
              pronouns,
              notification,
            })
          : command("advanceResident", { membershipId: m.id, step: step + 1 }),
      "Progress saved",
    );
    if (r) {
      if (step === 6)
        router.push(
          homeHref(
            "/home",
            view.memberships.length > 1 ? m.room_id : undefined,
          ),
        );
      else setStep(step + 1);
    }
  }
  const titles: Record<number, string> = {
    2: "Make yourself at home.",
    3: "A few things to know.",
    4: "How we share this home.",
    5: "Small steps. A good start.",
    6: `You’re home, ${name}.`,
  };
  return (
    <div className="onboarding-page">
      <div className="onboarding-top">
        <RoomlyLogo />
        <span className="badge">{view.property?.name}</span>
      </div>
      <div className="onboarding-layout">
        <aside>
          <OnboardingProgress steps={RESIDENT_STEPS} current={step} />
          <p className="onboarding-help">
            A few steps, at your pace.
            <br />
            Your progress is saved for this home.
          </p>
        </aside>
        <main id="main" className="onboarding-main">
          <PageHeading
            eyebrow={view.room?.name}
            title={titles[step]}
            description={
              {
                2: "Choose how you’d like to be welcomed.",
                3: "Your contacts and essentials, ready when you need them.",
                4: "Read each agreement and acknowledge it individually.",
                5: "A few useful things to help you settle in.",
                6: "Your guide, questions and repair updates are always in Roomly Home.",
              }[step]
            }
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void advance();
            }}
          >
            {step === 2 && (
              <div className="form-stack">
                <label>
                  What should we call you?
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Preferred language
                  <select
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                  >
                    <option value="en-GB">English</option>
                    <option value="zh-CN">简体中文</option>
                    <option value="tr-TR">Türkçe</option>
                  </select>
                </label>
                <label>
                  Pronouns (optional)
                  <input
                    value={pronouns}
                    onChange={(e) => setPronouns(e.target.value)}
                  />
                </label>
                <label>
                  Notifications
                  <select
                    value={notification}
                    onChange={(e) => setNotification(e.target.value)}
                  >
                    <option value="email">Email</option>
                    <option value="none">No notifications</option>
                  </select>
                </label>
              </div>
            )}
            {step === 3 && (
              <>
                <p>
                  Move-in date:{" "}
                  {m.move_in_at
                    ? new Date(m.move_in_at).toLocaleDateString("en-GB")
                    : "Arrange with your manager"}
                  . Your membership is active.
                </p>
                <EssentialList blocks={view.blocks} />
              </>
            )}
            {step === 4 && (
              <>
                <AgreementList
                  blocks={view.blocks}
                  view={view}
                  refresh={refresh}
                />
                {!view.blocks.some((b) => b.kind === "agreement") && (
                  <p>
                    No required agreements have been published for this home.
                  </p>
                )}
              </>
            )}
            {step === 5 && (
              <>
                <p>You can return to these actions from Roomly Home.</p>
                <FirstWeek view={view} refresh={refresh} />
              </>
            )}
            {step === 6 && (
              <>
                <div className="welcome-illustration">
                  <DoorOpen aria-hidden />
                </div>
                <p>
                  Your guide, questions and repair updates now have a permanent
                  home. Come back whenever you need them.
                </p>
              </>
            )}
            <div className="form-actions">
              {step > 2 && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={action.busy}
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </button>
              )}
              <ContinueButton disabled={action.busy}>
                {step === 6 ? "Go to Roomly Home" : "Continue"}
              </ContinueButton>
            </div>
            <StatusMessage {...action} />
          </form>
        </main>
      </div>
    </div>
  );
}
