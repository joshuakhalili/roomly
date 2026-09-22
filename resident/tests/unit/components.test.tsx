// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { seed, ID } from "../../lib/demo/seed";
import { viewState } from "../../lib/domain";
import {
  ReadinessChecklist,
  ResidentPreviewSheet,
} from "../../components/roomly/primitives";
import {
  AiSuggestionReview,
  ContentEditor,
} from "../../components/roomly/ContentEditor";
import { GroundedAnswer } from "../../components/roomly/AskRoomly";
import { ManagerOnboarding } from "../../components/roomly/Onboarding";
import { unknown, emergencyAnswer } from "../../lib/ai/provider";
const { mockCommand } = vi.hoisted(() => ({
  mockCommand: vi.fn().mockResolvedValue({ version: 2 }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/manage",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../../components/roomly/client", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../components/roomly/client")>();
  return { ...original, command: mockCommand };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const view = () => viewState(seed(), { id: ID.manager });
describe("Roomly interactive components", () => {
  it("readiness names incomplete mandatory items", () => {
    const v = view();
    v.readiness!.checks[0].pass = false;
    render(<ReadinessChecklist value={v.readiness!} />);
    expect(screen.getByText("Address published")).toBeInTheDocument();
    expect(screen.getByText("Required to publish")).toBeInTheDocument();
  });
  it("AI review keeps accept, edited apply and skip distinct", async () => {
    const v = view();
    render(
      <AiSuggestionReview
        suggestions={[v.suggestions[0]]}
        refresh={async () => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("Suggested text"), {
      target: { value: "Reviewed text" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Apply edited version" }),
    );
    await waitFor(() =>
      expect(mockCommand).toHaveBeenCalledWith(
        "reviewAiSuggestion",
        expect.objectContaining({
          decision: "edited",
          editedData: expect.objectContaining({ body: "Reviewed text" }),
        }),
      ),
    );
    expect(
      screen.getByRole("button", { name: "Accept original" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
  });
  it("unknown answer offers manager handoff without a citation", () => {
    render(
      <GroundedAnswer
        result={{
          answer: unknown(),
          providerUnavailable: false,
          questionLogId: ID.room,
          sources: [],
        }}
        contact="07700 900123"
      />,
    );
    expect(screen.getByText("Let’s ask your manager")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Contact your manager/ }),
    ).toHaveAttribute("href", "tel:07700900123");
    expect(screen.queryByText("Last checked")).not.toBeInTheDocument();
  });
  it("emergency shows a direct emergency call", () => {
    render(
      <GroundedAnswer
        result={{
          answer: emergencyAnswer(),
          providerUnavailable: false,
          questionLogId: ID.room,
          sources: [],
        }}
        contact="07700 900123"
      />,
    );
    expect(screen.getByRole("link", { name: "Call 999" })).toHaveAttribute(
      "href",
      "tel:999",
    );
  });
  it("mobile preview has a named dialog, closes on Escape and restores trigger focus", async () => {
    const v = view();
    render(
      <ResidentPreviewSheet blocks={v.preview} home="Cambridge City House" />,
    );
    const trigger = screen.getByRole("button", { name: /Resident preview/ });
    trigger.focus();
    fireEvent.click(trigger);
    expect(
      screen.getByRole("dialog", { name: "Resident preview" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it("manager onboarding starts at persisted incomplete step", () => {
    const v = view();
    v.progress = {
      id: ID.room,
      created_at: new Date().toISOString(),
      profile_id: ID.manager,
      step: 2,
      organisation_id: ID.org,
      property_id: null,
      room_id: null,
      values: { propertyName: "A saved home" },
      completed: false,
    };
    render(<ManagerOnboarding view={v} refresh={async () => {}} />);
    expect(screen.getByLabelText("Property name")).toHaveValue("A saved home");
    expect(screen.getByText("Step 3 of 7")).toBeInTheDocument();
  });
  it("archive exposes the ten-second Undo control and restores through the contract", async () => {
    const v = view();
    render(<ContentEditor view={v} refresh={async () => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Archive Bins" }));
    const undo = await screen.findByRole("button", { name: "Undo" });
    fireEvent.click(undo);
    await waitFor(() =>
      expect(mockCommand).toHaveBeenCalledWith("undoArchive", {
        blockId: v.blocks[5].id,
        expectedVersion: 2,
      }),
    );
  });
});
