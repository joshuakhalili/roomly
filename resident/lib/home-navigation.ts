/** Keep a resident's selected membership context on every home route. */
export function homeHref(path: string, roomId?: string | null) {
  if (!roomId || !/^\/home(?:[/?#]|$)/.test(path)) return path;
  const [beforeHash, hash] = path.split("#");
  const [pathname, query] = beforeHash.split("?");
  const params = new URLSearchParams(query);
  params.set("room", roomId);
  return `${pathname}?${params}${hash === undefined ? "" : `#${hash}`}`;
}
