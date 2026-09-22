const uuid =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const routes = new RegExp(
  `^(?:/home(?:/(?:guide|ask|repairs(?:/(?:new|${uuid}))?))?|/manage(?:/properties/${uuid}(?:/(?:content|invites|questions|maintenance|settings))?)?|/onboarding/manager|/onboarding/resident/${uuid})$`,
);
/** An explicit allowlist prevents auth callbacks from becoming open redirects. */
export function authDestination(next?: string | null, role?: string | null) {
  if (next && /^\/invite\/[A-Za-z0-9_-]{32,200}$/.test(next)) return next;
  if (next && !/[\\\r\n#]/.test(next)) {
    const [path, query] = next.split("?");
    if (routes.test(path)) {
      const room = new URLSearchParams(query).get("room");
      return (
        path +
        (room && new RegExp(`^${uuid}$`).test(room) ? `?room=${room}` : "")
      );
    }
  }
  return role === "manager" ? "/manage" : "/home";
}
export function authReturnPath(
  destination: string,
  state: "authentication" | "validation" | "email",
) {
  const params = new URLSearchParams({ next: destination });
  params.set(state === "email" ? "check" : "error", state);
  return `/sign-in?${params}`;
}
