"use client";
import { HomeLink as Link, useHomeHref } from "./HomeLink";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, ArrowRight, Paperclip } from "lucide-react";
import type { View } from "@/lib/domain";
import type { Repair } from "@/lib/model";
import {
  emergency,
  EMERGENCY_GUIDANCE,
  repairTransitions,
} from "@/lib/maintenance";
import { FlowSteps, HumanHelp, WorkspaceContext } from "./WorkspaceContext";
import { command, useAction } from "./client";
import {
  EmptyState,
  MaintenanceTimeline,
  PageHeading,
  StatusMessage,
} from "./primitives";
export function RepairList({
  view,
  manager,
  refresh,
}: {
  view: View;
  manager: boolean;
  refresh: () => Promise<void>;
}) {
  const [filter, setFilter] = useState("All");
  const eligible = view.repairs.filter((r) => !manager || r.status !== "draft");
  const repairs = eligible.filter(
    (r) =>
      filter === "All" ||
      (filter === "Resolved"
        ? ["resolved", "closed"].includes(r.status)
        : !["resolved", "closed", "draft"].includes(r.status)),
  );
  return (
    <>
      <PageHeading
        eyebrow={manager ? "Operations" : "Help with your home"}
        title={manager ? "Maintenance" : "Your repairs"}
        description={
          manager
            ? "Clear reports. One shared record of what happens next."
            : "Report a problem and keep track of the next step."
        }
      >
        {!manager && (
          <Link className="button primary" href="/home/repairs/new">
            <Plus size={17} aria-hidden />
            Report a repair
          </Link>
        )}
      </PageHeading>
      <div className="section-heading repair-toolbar">
        <div className="filter-bar" aria-label="Repair status">
          {["All", "Open", "Resolved"].map((label) => (
            <button
              key={label}
              aria-pressed={filter === label}
              onClick={() => setFilter(label)}
            >
              {label}
            </button>
          ))}
        </div>
        <small role="status">
          {repairs.length} {repairs.length === 1 ? "report" : "reports"}
        </small>
      </div>
      {repairs.length === 0 ? (
        <EmptyState
          title={
            filter === "All"
              ? "Nothing to repair right now."
              : `No ${filter.toLowerCase()} repairs.`
          }
          description={
            manager
              ? "Resident reports will appear here when submitted."
              : "When something needs attention, let your manager know."
          }
        />
      ) : manager ? (
        <div>
          {repairs.map((r) => (
            <details className="suggestion" key={r.id}>
              <summary>
                <strong>{r.title}</strong>
                <span className="badge repair-status" data-status={r.status}>
                  {r.status.replaceAll("_", " ")}
                </span>
              </summary>
              <div className="suggestion-body">
                <RepairDetail
                  view={view}
                  repair={r}
                  manager
                  refresh={refresh}
                />
              </div>
            </details>
          ))}
        </div>
      ) : (
        <ul className="work-list">
          {repairs.map((r) => (
            <li key={r.id}>
              <div>
                <strong>{r.title}</strong>
                <small>
                  {r.location} ·{" "}
                  {new Date(r.created_at).toLocaleDateString("en-GB")}
                </small>
                <span className="badge repair-status" data-status={r.status}>
                  {r.status.replaceAll("_", " ")}
                </span>
              </div>
              <Link className="button secondary" href={`/home/repairs/${r.id}`}>
                View report
                <ArrowRight size={16} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
export function RepairDetail({
  view,
  repair: r,
  manager,
  refresh,
}: {
  view: View;
  repair: Repair;
  manager: boolean;
  refresh: () => Promise<void>;
}) {
  const action = useAction(refresh);
  return (
    <>
      <FlowSteps
        steps={
          r.status === "draft"
            ? [
                "Describe the problem",
                "Check your report",
                "Send to your manager",
              ]
            : ["Report received", "Being handled", "Resolved"]
        }
        current={
          r.status === "draft"
            ? 1
            : ["closed", "resolved"].includes(r.status)
              ? 2
              : r.status === "submitted"
                ? 0
                : 1
        }
      />
      <div className="repair-detail">
        <span className="badge">
          {r.priority} priority · {r.status.replaceAll("_", " ")}
        </span>
        <p>{r.description}</p>
        <dl className="essential-list">
          <div>
            <dt>Location</dt>
            <dd>{r.location}</dd>
          </div>
          <div>
            <dt>Availability</dt>
            <dd>{r.availability_json.notes}</dd>
          </div>
        </dl>
        {r.priority === "emergency" && (
          <p className="emergency">{EMERGENCY_GUIDANCE}</p>
        )}
        {view.attachments
          .filter((f) => f.maintenance_request_id === r.id)
          .map((f) => (
            <a className="text-button" key={f.id} href={`/api/files/${f.id}`}>
              <Paperclip size={16} aria-hidden />
              {f.name}
            </a>
          ))}
      </div>
      <h2 className="section-heading divider-section">Updates</h2>
      <MaintenanceTimeline
        events={view.events.filter((e) => e.maintenance_request_id === r.id)}
      />
      {r.status === "draft" && !manager && (
        <div className="repair-confirm">
          <h2>Confirm your report</h2>
          <p>
            Submit this report to your manager? They will review it. No
            appointment or response time has been promised.
          </p>
          <button
            className="button primary"
            disabled={action.busy}
            onClick={() =>
              action.run(
                () => command("submitMaintenanceRequest", { requestId: r.id }),
                "Report submitted",
              )
            }
          >
            Confirm and submit repair
          </button>
        </div>
      )}
      {manager && repairTransitions[r.status].length > 0 && (
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void action.run(
              () =>
                command("appendMaintenanceEvent", {
                  requestId: r.id,
                  status: f.get("status"),
                  note: f.get("note"),
                  residentVisible: f.get("visible") === "on",
                }),
              "Update added to the repair timeline",
            );
          }}
        >
          <label>
            Next status
            <select name="status">
              {repairTransitions[r.status].map((s) => (
                <option value={s} key={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Update note
            <textarea
              name="note"
              required
              placeholder="Explain what happens next without promising an unconfirmed time."
            />
          </label>
          <label>
            <input name="visible" type="checkbox" defaultChecked />
            Share this update with the resident
          </label>
          <button className="button primary" disabled={action.busy}>
            Save status update
          </button>
        </form>
      )}
      <StatusMessage {...action} />
    </>
  );
}
export function NewRepair({
  view,
  refresh,
}: {
  view: View;
  refresh: () => Promise<void>;
}) {
  const router = useRouter();
  const destination = useHomeHref();
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<Repair | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const action = useAction(refresh);
  return (
    <>
      <PageHeading
        eyebrow="Maintenance"
        title="What needs attention?"
        description="Tell us what’s happening. Your manager will review your report."
      >
        <Link className="text-button" href="/home/repairs">
          All repairs <ArrowRight size={16} aria-hidden />
        </Link>
      </PageHeading>
      <FlowSteps
        steps={[
          "Describe the problem",
          "Review the details",
          "Confirm and send",
        ]}
        current={draft ? 1 : 0}
      />
      <div className="workspace-layout">
        <div>
          {!draft ? (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = Object.fromEntries(new FormData(e.currentTarget));
                void action.run(async () => {
                  const result = await command<{ request: Repair }>(
                    "createMaintenanceDraft",
                    { roomId: view.room!.id, ...f },
                  );
                  setDraft(result.request);
                  if (file) {
                    const upload = new FormData();
                    upload.set("requestId", result.request.id);
                    upload.set("file", file);
                    const response = await fetch("/api/files", {
                      method: "POST",
                      body: upload,
                    });
                    const data = await response.json();
                    if (!data.ok) throw new Error(data.error.message);
                    setUploaded(true);
                  }
                  return result;
                }, "Draft saved. Review and confirm below.");
              }}
            >
              <label>
                Short title
                <input
                  name="title"
                  required
                  maxLength={160}
                  placeholder="For example, kitchen tap dripping"
                />
              </label>
              <label>
                What’s happening?
                <textarea
                  name="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  placeholder="Describe the problem and when you first noticed it."
                />
              </label>
              {emergency(description) && (
                <div className="emergency" role="alert">
                  <strong>Get help now</strong>
                  <p>{EMERGENCY_GUIDANCE}</p>
                  <a className="button danger" href="tel:999">
                    Call 999
                  </a>
                </div>
              )}
              <div className="form-grid">
                <label>
                  Where in your home?
                  <input
                    name="location"
                    required
                    placeholder="Shared kitchen"
                  />
                </label>
                <label>
                  When are you available?
                  <input
                    name="availability"
                    required
                    placeholder="Weekdays after 16:00"
                  />
                </label>
              </div>
              <label>
                Photo or document (optional)
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <small>
                  JPG, PNG or PDF · up to 5 MB · private to you and your manager
                </small>
              </label>
              <button className="button primary" disabled={action.busy}>
                Review repair report
                <ArrowRight size={18} aria-hidden />
              </button>
            </form>
          ) : (
            <div className="repair-confirm">
              <h2>Review before sending</h2>
              <h3 className="section">{draft.title}</h3>
              <p>{draft.description}</p>
              <p>
                {draft.location} · {draft.availability_json.notes}
              </p>
              <p>
                <span className="badge">
                  Suggested category: {draft.category}
                </span>{" "}
                <span className="badge">{draft.priority} priority</span>
              </p>
              {draft.priority === "emergency" && (
                <div className="emergency">
                  <strong>Do not wait for a Roomly update</strong>
                  <p>{EMERGENCY_GUIDANCE}</p>
                </div>
              )}
              <p>
                Your manager will receive this report when you confirm. No visit
                is scheduled automatically.
              </p>
              {file && uploaded && (
                <p className="attachment-status">
                  <Paperclip size={16} aria-hidden /> {file.name} · attached
                </p>
              )}
              {file && !uploaded && (
                <button
                  className="text-button"
                  onClick={() =>
                    action.run(async () => {
                      const f = new FormData();
                      f.set("requestId", draft.id);
                      f.set("file", file);
                      const r = await fetch("/api/files", {
                        method: "POST",
                        body: f,
                      });
                      const j = await r.json();
                      if (!j.ok) throw new Error(j.error.message);
                      setUploaded(true);
                    }, "Attachment saved")
                  }
                >
                  Retry attachment upload
                </button>
              )}
              <button
                className="button primary"
                disabled={action.busy}
                onClick={() =>
                  action
                    .run(
                      () =>
                        command("submitMaintenanceRequest", {
                          requestId: draft.id,
                        }),
                      "Report submitted",
                    )
                    .then((r) => {
                      if (r)
                        router.push(destination(`/home/repairs/${draft.id}`));
                    })
                }
              >
                Confirm and submit repair
              </button>
            </div>
          )}
          <StatusMessage {...action} />
        </div>
        <WorkspaceContext title="What happens next">
          <p>
            Check the details before sending. Your manager will review the
            report and post updates in your repair timeline.
          </p>
          <p>
            A clear description and a photo can help them understand the issue.
            Only you and your manager can see the attachment.
          </p>
          <HumanHelp view={view} />
          <p className="field-help">
            If anyone is in immediate danger, call 999. Don’t wait for a repair
            update.
          </p>
        </WorkspaceContext>
      </div>
    </>
  );
}
