"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Open state for a "create" dialog that can also be opened from a link.
 *
 * The header's New menu links to `/tenants?new=1` rather than rendering a
 * second copy of every form. The page's own Add button reads that flag once,
 * opens, and removes it so a refresh or a back button does not reopen it.
 */
export function useAutoOpen(enabled?: boolean) {
  const params = useSearchParams();
  const requested = Boolean(enabled) && params.get("new") === "1";
  const [open, setOpen] = useState(requested);
  // Arriving again while already on the page (New menu clicked from here)
  // does not remount the dialog, so the flag is also watched as it changes.
  const [seen, setSeen] = useState(requested);
  if (requested !== seen) {
    setSeen(requested);
    if (requested) setOpen(true);
  }

  useEffect(() => {
    if (!requested) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    window.history.replaceState(window.history.state, "", url);
  }, [requested]);

  return [open, setOpen] as const;
}
