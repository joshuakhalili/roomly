"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import type { View } from "@/lib/domain";
import { EmptyState, GuideSections } from "./primitives";
import { AgreementList, FirstWeek } from "./Onboarding";
import { HumanHelp, WorkspaceContext } from "./WorkspaceContext";

const topics = [
  { label: "Everything", kinds: [] },
  { label: "Essentials", kinds: ["essential", "access", "safety"] },
  { label: "Around home", kinds: ["faq", "welcome", "first_week"] },
  { label: "Places & people", kinds: ["local_place", "person", "resource"] },
];
export function GuidePage({
  view,
  refresh,
}: {
  view: View;
  refresh: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState(0);
  const blocks = view.blocks.filter(
    (b) =>
      (!topic || topics[topic].kinds.includes(b.kind)) &&
      `${b.title} ${b.body}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <>
      <div className="guide-toolbar">
        <label className="search-field">
          <Search size={19} aria-hidden />
          <span className="sr-only">Search your guide</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find something in your home guide"
          />
        </label>
        <div className="filter-bar" aria-label="Guide topics">
          {topics.map((t, i) => (
            <button
              key={t.label}
              aria-pressed={i === topic}
              onClick={() => setTopic(i)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="workspace-layout">
        <div>
          <div className="section-heading">
            <h2>In your handbook</h2>
            <small role="status">
              {blocks.length} {blocks.length === 1 ? "section" : "sections"}
            </small>
          </div>
          {blocks.length ? (
            <>
              <AgreementList blocks={blocks} view={view} refresh={refresh} />
              <GuideSections
                blocks={blocks.filter((b) => b.kind !== "agreement")}
              />
            </>
          ) : (
            <EmptyState
              title="Nothing here matches yet."
              description="Try another word, or ask your manager for the information you need."
            >
              <button
                className="button secondary"
                onClick={() => {
                  setQuery("");
                  setTopic(0);
                }}
              >
                Clear filters
              </button>
            </EmptyState>
          )}
        </div>
        <WorkspaceContext title="Your home, kept clear.">
          <p>
            This handbook contains the information your manager has published
            for your home. Open a section to see when it was last checked.
          </p>
          <HumanHelp view={view} />
          <FirstWeek view={view} refresh={refresh} />
        </WorkspaceContext>
      </div>
    </>
  );
}
