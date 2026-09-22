"use client";
import { useState } from "react";
import type { Operation } from "@/lib/contracts";
import type { Result } from "@/lib/model";
export async function command<T = unknown>(
  operation: Operation,
  input: unknown,
): Promise<T> {
  const response = await fetch("/api/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation, input }),
  });
  const result: Result<T> = await response.json();
  if (!result.ok)
    throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.data;
}
export function useAction(refresh?: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function run<T>(task: () => Promise<T>, success = "Saved") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await task();
      if (refresh) await refresh();
      setMessage(success);
      return result;
    } catch (e) {
      setError(
        typeof navigator !== "undefined" && !navigator.onLine
          ? "Offline. Your entries are kept here. Reconnect and retry."
          : e instanceof Error
            ? e.message
            : "Something went wrong. Please retry.",
      );
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, message, run };
}
