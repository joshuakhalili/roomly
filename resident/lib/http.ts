import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "./permissions";
export function failure(e: unknown) {
  if (e instanceof ZodError)
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Please check your entries.",
          fieldErrors: e.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  const code =
    e instanceof DomainError
      ? e.code
      : e instanceof Error && e.message === "CONTENT_VERSION_CONFLICT"
        ? "CONTENT_VERSION_CONFLICT"
        : "SERVER_ERROR";
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message:
          e instanceof DomainError
            ? e.message
            : code === "CONTENT_VERSION_CONFLICT"
              ? "The saved version changed. Your edits remain in the form."
              : "We could not complete that action. Your entries are preserved; please retry.",
      },
    },
    {
      status:
        code === "UNAUTHENTICATED"
          ? 401
          : code === "PERMISSION_DENIED"
            ? 403
            : code === "CONTENT_VERSION_CONFLICT"
              ? 409
              : 400,
    },
  );
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const sameSite = req.headers.get("sec-fetch-site") === "same-origin";
  if (
    !origin || origin === "null"
      ? !sameSite
      : new URL(origin).host !== req.headers.get("host")
  )
    throw new DomainError(
      "PERMISSION_DENIED",
      "This request did not originate from Roomly.",
    );
}
export function requestBase(req: Request) {
  return new URL(req.url).protocol + "//" + req.headers.get("host");
}
