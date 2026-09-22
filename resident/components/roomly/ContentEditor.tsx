"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2 } from "lucide-react";
import type { Block, Suggestion, Translation } from "@/lib/model";
import type { View } from "@/lib/domain";
import { kinds } from "@/lib/ai/provider";
import { command, useAction } from "./client";
import {
  PageHeading,
  PermissionBadge,
  ReadinessChecklist,
  ResidentPreviewSheet,
  SaveStatus,
  StatusMessage,
} from "./primitives";
export function RoomlyAssistComposer({
  roomId,
  refresh,
}: {
  roomId: string;
  refresh: () => Promise<void>;
}) {
  const [notes, setNotes] = useState("");
  const action = useAction(refresh);
  return (
    <section className="assist-composer">
      <span className="eyebrow">
        <Sparkles size={15} aria-hidden /> Roomly Assist
      </span>
      <h2>From rough notes to a clear guide.</h2>
      <p>
        Paste your home notes. Review each suggestion before it becomes a draft.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            const r = await command<{ providerUnavailable?: boolean }>(
              "runContentExtraction",
              { roomId, notes },
            );
            if (r.providerUnavailable)
              throw new Error(
                "Provider unavailable. Your notes are kept here. Please retry.",
              );
          }, "Suggestions ready for your review");
        }}
      >
        <label htmlFor="assist-notes" className="sr-only">
          Home notes
        </label>
        <textarea
          id="assist-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Recycling goes out on Monday evening. Please keep the hallway clear…"
          required
        />
        <div className="form-actions">
          <small>Nothing is applied or published automatically.</small>
          <button className="button primary" disabled={action.busy}>
            {action.busy ? "Extracting…" : "Prepare suggestions"}
            <Sparkles size={16} aria-hidden />
          </button>
        </div>
      </form>
      <StatusMessage {...action} />
    </section>
  );
}
export function AiSuggestionReview({
  suggestions,
  refresh,
}: {
  suggestions: Suggestion[];
  refresh: () => Promise<void>;
}) {
  return (
    <div>
      {suggestions.length > 0 && (
        <div className="section-heading">
          <h2>Review suggestions</h2>
          <small>
            {suggestions.filter((s) => s.status === "pending").length} awaiting
            review ·{" "}
            {
              suggestions.filter((s) =>
                ["accepted", "edited"].includes(s.status),
              ).length
            }{" "}
            applied to draft
          </small>
        </div>
      )}
      {suggestions.map((s) => (
        <SuggestionItem key={s.id} suggestion={s} refresh={refresh} />
      ))}
    </div>
  );
}
function SuggestionItem({
  suggestion: s,
  refresh,
}: {
  suggestion: Suggestion;
  refresh: () => Promise<void>;
}) {
  const [title, setTitle] = useState(s.proposed_data.title);
  const [body, setBody] = useState(s.proposed_data.body);
  const action = useAction(refresh);
  return (
    <details className="suggestion" open={s.status === "pending"}>
      <summary>
        <strong>{s.proposed_data.title}</strong>
        <span className="badge">
          {s.status === "pending" ? "Ready to review" : s.status}
        </span>
      </summary>
      <div className="suggestion-body">
        <PermissionBadge visibility={s.proposed_data.visibility} />
        <small> · {s.kind}</small>
        <blockquote>
          <small>Source excerpt</small>
          <br />
          {s.source_excerpt}
        </blockquote>
        {s.status === "pending" ? (
          <>
            <div className="form-stack">
              <label>
                Suggested title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Suggested text
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
            </div>
            {s.proposed_data.warnings.map((w) => (
              <p className="error" key={w}>
                {w}
              </p>
            ))}
            <div className="form-actions">
              <button
                type="button"
                className="button primary"
                disabled={action.busy}
                onClick={() =>
                  action.run(
                    () =>
                      command("reviewAiSuggestion", {
                        suggestionId: s.id,
                        decision: "accepted",
                      }),
                    "Accepted into draft",
                  )
                }
              >
                Accept original
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={action.busy}
                onClick={() =>
                  action.run(
                    () =>
                      command("reviewAiSuggestion", {
                        suggestionId: s.id,
                        decision: "edited",
                        editedData: { title, body },
                      }),
                    "Edited suggestion applied to draft",
                  )
                }
              >
                Apply edited version
              </button>
              <button
                type="button"
                className="text-button"
                disabled={action.busy}
                onClick={() =>
                  action.run(
                    () =>
                      command("reviewAiSuggestion", {
                        suggestionId: s.id,
                        decision: "rejected",
                      }),
                    "Suggestion skipped",
                  )
                }
              >
                Skip
              </button>
            </div>
          </>
        ) : (
          <p>
            {s.status === "rejected"
              ? "Skipped. No content was created."
              : "Saved as a manager draft. Review and publish to make it visible to residents."}
          </p>
        )}
        <StatusMessage {...action} />
      </div>
    </details>
  );
}
export function ContentEditor({
  view,
  refresh,
}: {
  view: View;
  refresh: () => Promise<void>;
}) {
  const action = useAction(refresh);
  const [adding, setAdding] = useState(false);
  const [undo, setUndo] = useState<{ id: string; version: number } | null>(
    null,
  );
  const [confirm, setConfirm] = useState(false);
  const assist = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 10000);
    return () => clearTimeout(t);
  }, [undo]);
  const room = view.room!;
  const blocks = view.blocks.filter((b) => b.status !== "archived");
  return (
    <>
      <PageHeading
        eyebrow="The home handbook"
        title="Your home content"
        description="Save your working draft, then review and publish for residents."
      >
        <ResidentPreviewSheet
          blocks={view.preview}
          home={view.property!.name}
        />
        <button className="button primary" onClick={() => setConfirm(!confirm)}>
          Review and publish
        </button>
      </PageHeading>
      <nav className="editor-jump-links" aria-label="Content workflow">
        <a href="#content-drafts">
          Edit your guide <span>{blocks.length} sections</span>
        </a>
        <a
          href="#content-assist"
          onClick={() => {
            if (assist.current) assist.current.open = true;
          }}
        >
          Roomly Assist{" "}
          <span>
            {view.suggestions.filter((s) => s.status === "pending").length} to
            review
          </span>
        </a>
        <a href="#content-readiness">
          Check readiness <span>{view.readiness?.score}% complete</span>
        </a>
      </nav>
      {confirm && (
        <section className="publish-review">
          <h2>Publish these changes?</h2>
          <p>
            Residents will see this draft, including removals and reviewed
            translations.{" "}
            {view.readiness?.checks
              .filter((c) => c.required && !c.pass)
              .map((c) => c.name)
              .join(", ")}
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setConfirm(false)}
            >
              Keep editing
            </button>
            <button
              type="button"
              className="button primary"
              disabled={action.busy}
              onClick={() =>
                action
                  .run(
                    () => command("publishContentChanges", { roomId: room.id }),
                    "Published. Residents now see this version.",
                  )
                  .then((r) => {
                    if (r) setConfirm(false);
                  })
              }
            >
              Publish to residents
            </button>
          </div>
        </section>
      )}
      <StatusMessage {...action} />
      <div className="two-column content-layout">
        <div>
          <details
            className="assist-disclosure"
            id="content-assist"
            ref={assist}
          >
            <summary>
              <span>
                <Sparkles size={18} aria-hidden /> Roomly Assist
              </span>
              <small>
                {view.suggestions.filter((s) => s.status === "pending").length}{" "}
                suggestions to review
              </small>
            </summary>
            <div className="assist-disclosure-body">
              <RoomlyAssistComposer roomId={room.id} refresh={refresh} />
              <AiSuggestionReview
                suggestions={view.suggestions}
                refresh={refresh}
              />
            </div>
          </details>
          <div className="section-heading section" id="content-drafts">
            <h2>Your content</h2>
            <button
              className="button secondary"
              onClick={() => setAdding(!adding)}
            >
              <Plus size={16} aria-hidden />
              Add block
            </button>
          </div>
          {adding && (
            <NewBlock
              roomId={room.id}
              refresh={refresh}
              close={() => setAdding(false)}
            />
          )}
          {blocks.map((b, i) => (
            <EditorBlock
              key={b.id}
              block={b}
              view={view}
              refresh={refresh}
              onArchive={async () => {
                const r = await action.run(
                  () =>
                    command<{ version: number }>("archiveBlock", {
                      blockId: b.id,
                      expectedVersion: b.version,
                    }),
                  "Archived from draft",
                );
                if (r) setUndo({ id: b.id, version: r.version });
              }}
              onMove={async (direction: number) => {
                const ids = blocks.map((b) => b.id);
                const index = i + direction;
                if (index < 0 || index >= ids.length) return;
                [ids[i], ids[index]] = [ids[index], ids[i]];
                await action.run(
                  () =>
                    command("reorderContentBlocks", {
                      roomId: room.id,
                      orderedIds: ids,
                    }),
                  `${b.title} moved ${direction < 0 ? "up" : "down"}`,
                );
              }}
              first={i === 0}
              last={i === blocks.length - 1}
            />
          ))}
          {view.blocks.some((b) => b.status === "archived") && (
            <details className="content-history">
              <summary>Archived blocks and recovery</summary>
              {view.blocks
                .filter((b) => b.status === "archived")
                .map((b) => (
                  <div className="work-list" key={b.id}>
                    <div>
                      {b.title} · version {b.version}
                    </div>
                    <button
                      className="text-button"
                      onClick={() =>
                        action.run(
                          () =>
                            command("undoArchive", {
                              blockId: b.id,
                              expectedVersion: b.version,
                            }),
                          "Restored into draft",
                        )
                      }
                    >
                      Restore block
                    </button>
                  </div>
                ))}
            </details>
          )}
        </div>
        <aside className="sticky-context" id="content-readiness">
          <ReadinessChecklist value={view.readiness!} />
          <p className="welcome-note">
            Your residents see the last published version while you work.
          </p>
          <div className="section">
            <ResidentPreviewSheet
              blocks={view.preview}
              home={view.property!.name}
            />
          </div>
        </aside>
      </div>
      {undo && (
        <div className="toast" role="status">
          Block archived
          <button
            onClick={() =>
              action
                .run(
                  () =>
                    command("undoArchive", {
                      blockId: undo.id,
                      expectedVersion: undo.version,
                    }),
                  "Archive undone",
                )
                .then(() => setUndo(null))
            }
          >
            Undo
          </button>
        </div>
      )}
    </>
  );
}
function NewBlock({
  roomId,
  refresh,
  close,
}: {
  roomId: string;
  refresh: () => Promise<void>;
  close: () => void;
}) {
  const action = useAction(refresh);
  return (
    <form
      className="form-stack suggestion"
      onSubmit={(e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        void action
          .run(
            () =>
              command("createContentBlock", {
                roomId,
                ...f,
                data: { key: f.key },
                required_acknowledgement: f.required === "on",
              }),
            "Draft created",
          )
          .then((r) => {
            if (r) close();
          });
      }}
    >
      <label>
        Title
        <input name="title" required />
      </label>
      <label>
        Text
        <textarea name="body" required />
      </label>
      <div className="form-grid">
        <label>
          Category
          <select name="kind">
            {kinds.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Visibility
          <select name="visibility">
            <option value="member">Members only</option>
            <option value="manager_only">Managers only</option>
            <option value="invitee">Welcome information</option>
          </select>
        </label>
        <label>
          Essential key
          <select name="key">
            {[
              "",
              "address",
              "manager",
              "emergency",
              "wifi",
              "access",
              "bins",
              "repairs",
              "guests",
            ].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          <input name="required" type="checkbox" />
          Requires acknowledgement
        </label>
      </div>
      <button className="button primary" disabled={action.busy}>
        Create draft block
      </button>
      <StatusMessage {...action} />
    </form>
  );
}
function EditorBlock({
  block: b,
  view,
  refresh,
  onArchive,
  onMove,
  first,
  last,
}: {
  block: Block;
  view: View;
  refresh: () => Promise<void>;
  onArchive: () => Promise<void>;
  onMove: (d: number) => Promise<void>;
  first: boolean;
  last: boolean;
}) {
  const [form, setForm] = useState({
    title: b.title,
    body: b.body,
    kind: b.kind,
    visibility: b.visibility,
    visible_from: b.visible_from || "",
    required_acknowledgement: b.required_acknowledgement,
    data: b.data,
  });
  const [status, setStatus] = useState("Saved");
  const [savedVersion, setSavedVersion] = useState(b.version);
  const [error, setError] = useState("");
  const version = useRef(b.version);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef(Promise.resolve());
  const action = useAction(refresh);
  useEffect(() => {
    if (
      status === "Saved" &&
      form.title === b.title &&
      form.body === b.body &&
      form.visibility === b.visibility
    )
      version.current = b.version;
  }, [
    b.version,
    b.title,
    b.body,
    b.visibility,
    form.title,
    form.body,
    form.visibility,
    status,
  ]);
  const save = (next: typeof form) => {
    setStatus(navigator.onLine ? "Saving…" : "Offline");
    queue.current = queue.current.then(async () => {
      try {
        const updated = await command<Block>("updateContentBlock", {
          ...next,
          visible_from: next.visible_from
            ? new Date(next.visible_from).toISOString()
            : null,
          id: b.id,
          roomId: b.room_id,
          expectedVersion: version.current,
        });
        version.current = updated.version;
        setSavedVersion(updated.version);
        setStatus("Saved");
        setError("");
        await refresh();
      } catch (e) {
        setStatus(navigator.onLine ? "Failed" : "Offline");
        setError(e instanceof Error ? e.message : "Save failed. Retry.");
      }
    });
  };
  const change = (patch: Partial<typeof form>) => {
    const next = { ...form, ...patch };
    setForm(next);
    setStatus("Saving…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(next), 600);
  };
  return (
    <article className="editor-block">
      <div className="editor-block-top">
        <div>
          <span className="badge">{b.kind}</span>
          <SaveStatus state={status} />
        </div>
        <div className="editor-controls">
          <button
            className="icon-button"
            disabled={first}
            aria-label={`Move ${b.title} up`}
            onClick={() => void onMove(-1)}
          >
            <ArrowUp size={16} />
          </button>
          <button
            className="icon-button"
            disabled={last}
            aria-label={`Move ${b.title} down`}
            onClick={() => void onMove(1)}
          >
            <ArrowDown size={16} />
          </button>
          <button
            className="icon-button"
            aria-label={`Archive ${b.title}`}
            onClick={() => void onArchive()}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <details className="editor-fields">
        <summary>
          <strong>{b.title}</strong>
          <span>Edit section</span>
        </summary>
        <div className="form-stack">
          <label>
            Title
            <input
              value={form.title}
              onChange={(e) => change({ title: e.target.value })}
            />
          </label>
          <label>
            Content
            <textarea
              value={form.body}
              onChange={(e) => change({ body: e.target.value })}
            />
          </label>
          <div className="form-grid">
            <label>
              Visibility
              <select
                value={form.visibility}
                onChange={(e) =>
                  change({ visibility: e.target.value as Block["visibility"] })
                }
              >
                {["member", "scheduled", "manager_only", "invitee"].map((v) => (
                  <option value={v} key={v}>
                    {v.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            {form.visibility === "scheduled" && (
              <label>
                Visible from
                <input
                  type="datetime-local"
                  value={form.visible_from.slice(0, 16)}
                  onChange={(e) => change({ visible_from: e.target.value })}
                />
              </label>
            )}
            <label>
              <input
                type="checkbox"
                checked={form.required_acknowledgement}
                onChange={(e) =>
                  change({ required_acknowledgement: e.target.checked })
                }
              />
              Require acknowledgement
            </label>
          </div>
        </div>
        {error && (
          <div role="alert">
            <p className="error">{error}</p>
            <button className="text-button" onClick={() => save(form)}>
              Retry save
            </button>
            <button className="text-button" onClick={() => void refresh()}>
              Load current version history
            </button>
            <button
              className="text-button"
              onClick={() => {
                version.current = b.version;
                save(form);
              }}
            >
              Apply my text over the displayed saved version
            </button>
            <p>
              Your unsaved text remains in this form. Current saved text:{" "}
              {b.body}
            </p>
          </div>
        )}
        <div className="content-meta">
          <PermissionBadge visibility={form.visibility} />
          <small>
            Draft v{savedVersion} · Published{" "}
            {b.published_version ? `v${b.published_version}` : "never"}
          </small>
        </div>
        <details className="content-history">
          <summary>Version history and translations</summary>
          <ol>
            {view.versions
              .filter((v) => v.content_block_id === b.id)
              .slice(-5)
              .reverse()
              .map((v) => (
                <li key={v.id}>
                  <strong>
                    Version {v.version} ·{" "}
                    {v.change_reason === "Initial checked demo content"
                      ? "Initial verified content"
                      : v.change_reason}
                  </strong>
                  <p>{v.snapshot.body}</p>
                </li>
              ))}
          </ol>
          <div className="form-actions">
            {["zh-CN", "tr-TR"].map((locale) => (
              <button
                key={locale}
                className="button secondary"
                disabled={action.busy}
                onClick={() =>
                  action.run(async () => {
                    const r = await command<{ providerUnavailable?: boolean }>(
                      "translateBlock",
                      { blockId: b.id, locale },
                    );
                    if (r.providerUnavailable)
                      throw new Error(
                        "Translation provider unavailable. Please retry.",
                      );
                    return r;
                  }, "Translation draft ready for review")
                }
              >
                Draft {locale === "zh-CN" ? "Chinese" : "Turkish"}
              </button>
            ))}
          </div>
          {view.translations
            .filter((t) => t.content_block_id === b.id)
            .map((t) => (
              <TranslationReview
                key={`${t.id}-${t.source_version}-${t.status}`}
                translation={t}
                refresh={refresh}
              />
            ))}
          <StatusMessage {...action} />
        </details>
      </details>
    </article>
  );
}
function TranslationReview({
  translation: t,
  refresh,
}: {
  translation: Translation;
  refresh: () => Promise<void>;
}) {
  const [title, setTitle] = useState(t.title);
  const [body, setBody] = useState(t.body);
  const action = useAction(refresh);
  return (
    <div className="translation">
      <strong>
        {t.locale} · {t.status}
      </strong>
      <small> · Source v{t.source_version}</small>
      <div className="form-stack">
        <label>
          Translated title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Translated text
          <textarea value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <small>
          Check the meaning and all names, numbers, addresses and safety facts
          before approving.
        </small>
        <button
          type="button"
          className="button secondary"
          disabled={action.busy}
          onClick={() =>
            action.run(
              () =>
                command("reviewTranslation", {
                  translationId: t.id,
                  title,
                  body,
                }),
              "Translation reviewed. Publish content to release it.",
            )
          }
        >
          Approve translation
        </button>
      </div>
      <StatusMessage {...action} />
    </div>
  );
}
