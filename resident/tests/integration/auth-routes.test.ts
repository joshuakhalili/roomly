import { beforeEach, describe, expect, it, vi } from "vitest";
import { authDestination } from "../../lib/auth/destination";
import { homeHref } from "../../lib/home-navigation";
const mock = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));
vi.mock("../../lib/supabase/server", () => ({
  supabase: async () => ({ auth: mock }),
}));
import { POST } from "../../app/api/auth/route";
import { GET } from "../../app/auth/callback/route";
const invitation = "/invite/" + "a".repeat(43);
function request(fields: Record<string, string>) {
  return new Request("https://roomly.example/api/auth", {
    method: "POST",
    headers: { origin: "https://roomly.example", host: "roomly.example" },
    body: new URLSearchParams({
      email: "resident@example.com",
      password: "long-password",
      mode: "sign-up",
      next: invitation,
      ...fields,
    }),
  });
}
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://roomly.example");
  vi.clearAllMocks();
  mock.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mock.signInWithPassword.mockResolvedValue({
    data: { session: {} },
    error: null,
  });
  mock.exchangeCodeForSession.mockResolvedValue({ error: null });
});
describe("production authentication continuation without external messages", () => {
  it("carries the invite through sign-up email and the confirmation callback", async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(303);
    expect(
      new URL(response.headers.get("location")!).searchParams.get("next"),
    ).toBe(invitation);
    const callback = new URL(
      mock.signUp.mock.calls[0][0].options.emailRedirectTo,
    );
    expect(callback.searchParams.get("next")).toBe(invitation);
    callback.searchParams.set("code", "test-confirmation-code");
    const confirmed = await GET(new Request(callback));
    expect(confirmed.headers.get("location")).toBe(
      "https://roomly.example" + invitation,
    );
  });
  it("returns a new manager to manager setup after confirmation", async () => {
    await POST(request({ next: "", role: "manager" }));
    expect(
      new URL(
        mock.signUp.mock.calls[0][0].options.emailRedirectTo,
      ).searchParams.get("next"),
    ).toBe("/manage");
  });
  it("preserves the invitation after authentication failure", async () => {
    mock.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid credentials" },
    });
    const response = await POST(request({ mode: "sign-in" }));
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("next")).toBe(invitation);
    expect(location.searchParams.get("error")).toBe("authentication");
  });
  it("requires ten characters for new accounts but permits existing shorter passwords", async () => {
    const invalid = await POST(request({ password: "short" }));
    expect(
      new URL(invalid.headers.get("location")!).searchParams.get("error"),
    ).toBe("validation");
    expect(mock.signUp).not.toHaveBeenCalled();
    const signedIn = await POST(
      request({ password: "short", mode: "sign-in" }),
    );
    expect(signedIn.headers.get("location")).toBe(
      "https://roomly.example" + invitation,
    );
  });
  it("handles signup sessions without requiring an unnecessary email loop", async () => {
    mock.signUp.mockResolvedValue({ data: { session: {} }, error: null });
    const response = await POST(request({}));
    expect(response.headers.get("location")).toBe(
      "https://roomly.example" + invitation,
    );
  });
  it("preserves destination when a confirmation code expires", async () => {
    mock.exchangeCodeForSession.mockResolvedValue({ error: {} });
    const url = new URL("https://roomly.example/auth/callback");
    url.searchParams.set("code", "expired");
    url.searchParams.set("next", invitation);
    const response = await GET(new Request(url));
    expect(
      new URL(response.headers.get("location")!).searchParams.get("next"),
    ).toBe(invitation);
  });
  it.each([
    "https://evil.example",
    "//evil.example",
    "/invite/../../evil",
    "/home\\evil",
    "/home%0d%0aevil",
    "/home#//evil",
    "/manage/unknown",
  ])("does not redirect to %s", (next) => {
    expect(authDestination(next)).toBe("/home");
  });
  it("keeps only a valid room selector on allowlisted destinations", () => {
    const room = "30000000-0000-4000-8000-000000000001";
    expect(authDestination(`/home/guide?room=${room}&next=//evil`)).toBe(
      `/home/guide?room=${room}`,
    );
    expect(authDestination("/home?room=bad")).toBe("/home");
  });
  it("keeps room context before source hashes and leaves non-home URLs alone", () => {
    expect(homeHref("/home/guide#bins", "second-room")).toBe(
      "/home/guide?room=second-room#bins",
    );
    expect(homeHref("/home?room=old", "new")).toBe("/home?room=new");
    expect(homeHref("/invite/token", "new")).toBe("/invite/token");
  });
});
