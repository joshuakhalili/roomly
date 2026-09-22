"use client";
import { useState } from "react";
import { HomeLink } from "./HomeLink";
import { ArrowUpRight, ArrowUp, Sparkles } from "lucide-react";
import { command, useAction } from "./client";
import { StatusMessage } from "./primitives";
import { emergency } from "@/lib/maintenance";
import { emergencyAnswer } from "@/lib/ai/provider";
import type { Answer } from "@/lib/ai/provider";
export type AnswerResult = {
  answer: Answer | null;
  providerUnavailable: boolean;
  questionLogId: string;
  sources: { id: string; title: string; verified_at: string | null }[];
};
export function SourceChip({
  source,
}: {
  source: AnswerResult["sources"][number];
}) {
  return (
    <HomeLink className="source-chip" href={`/home/guide#${source.id}`}>
      {source.title}
      <ArrowUpRight size={14} aria-hidden />
    </HomeLink>
  );
}
export function GroundedAnswer({
  result,
  contact,
}: {
  result: AnswerResult;
  contact: string;
}) {
  const action = useAction();
  return (
    <div
      className={`answer ${result.answer?.status === "emergency" ? "emergency" : ""}`}
      role="status"
    >
      <strong>
        {result.providerUnavailable
          ? "Roomly is temporarily unavailable"
          : result.answer?.status === "answered"
            ? "From your home guide"
            : result.answer?.status === "emergency"
              ? "Get help now"
              : "Let’s ask your manager"}
      </strong>
      <p>
        {result.answer?.answer ||
          "Please retry, or contact your manager directly. Your question is in their inbox."}
      </p>
      <div className="source-row">
        {result.sources.map((s) => (
          <SourceChip key={s.id} source={s} />
        ))}
      </div>
      {result.sources.length > 0 && (
        <small>
          Last checked{" "}
          {result.sources.every((s) => s.verified_at)
            ? new Date(
                Math.min(
                  ...result.sources.map((s) => Date.parse(s.verified_at!)),
                ),
              ).toLocaleDateString("en-GB")
            : "Not available"}
        </small>
      )}
      {result.answer?.status === "emergency" && (
        <a className="button danger" href="tel:999">
          Call 999
        </a>
      )}
      <div className="answer-footer">
        <a href={`tel:${contact.replace(/\s/g, "")}`}>
          Contact your manager <ArrowUpRight size={15} aria-hidden />
        </a>
        {result.answer?.status === "answered" && (
          <div>
            <button
              disabled={action.busy || !!action.message}
              onClick={() =>
                action.run(
                  () =>
                    command("submitQuestionFeedback", {
                      questionLogId: result.questionLogId,
                      feedback: "helpful",
                    }),
                  "Thanks for your feedback",
                )
              }
            >
              Helpful
            </button>
            <button
              disabled={action.busy || !!action.message}
              onClick={() =>
                action.run(
                  () =>
                    command("submitQuestionFeedback", {
                      questionLogId: result.questionLogId,
                      feedback: "not_helpful",
                    }),
                  "Thanks for your feedback",
                )
              }
            >
              Not helpful
            </button>
          </div>
        )}
      </div>
      <StatusMessage {...action} />
    </div>
  );
}
export function AskRoomly({
  roomId,
  contact,
}: {
  roomId: string;
  contact: string;
}) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AnswerResult | null>(null);
  const action = useAction();
  async function ask(q: string) {
    setQuestion(q);
    if (emergency(q))
      setResult({
        answer: emergencyAnswer(),
        providerUnavailable: false,
        questionLogId: "",
        sources: [],
      });
    const r = await action.run(
      () => command<AnswerResult>("askRoomly", { roomId, question: q }),
      "",
    );
    if (r) setResult(r);
  }
  return (
    <section className="ask-surface">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            <Sparkles size={14} aria-hidden /> Checked sources. Clear answers.
          </span>
          <h2>Ask Roomly</h2>
        </div>
      </div>
      <p>Something about home on your mind?</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <label className="sr-only" htmlFor="home-question">
          Your question
        </label>
        <div className="question-input">
          <input
            id="home-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Where do the recycling bins go?"
            required
            maxLength={2000}
          />
          <button aria-label="Ask your question" disabled={action.busy}>
            <ArrowUp size={22} aria-hidden />
          </button>
        </div>
      </form>
      <div className="suggested-questions">
        {[
          "When are the bins collected?",
          "Can I have a guest?",
          "How do I report a repair?",
        ].map((q) => (
          <button key={q} onClick={() => void ask(q)} disabled={action.busy}>
            {q}
            <ArrowUpRight size={14} aria-hidden />
          </button>
        ))}
      </div>
      <StatusMessage busy={action.busy} error={action.error} />
      {result && <GroundedAnswer result={result} contact={contact} />}
    </section>
  );
}
