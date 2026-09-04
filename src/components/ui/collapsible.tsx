"use client"

import * as React from "react"
import { Collapsible as CollapsiblePrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * A section that opens and closes.
 *
 * Used where a page holds several groups that are each long enough to bury
 * the next one — properties on the inventory page, a filter panel that is
 * mostly closed. The chevron is the affordance; it rotates rather than
 * swapping icon, so the control stays the same object through the change.
 */
function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={cn(
        "group/collapsible-trigger flex w-full items-center gap-3 rounded-lg text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

/**
 * The panel itself.
 *
 * `overflow-hidden` is not decoration — the open/close animation works by
 * changing height, and without it the content spills out of a box that is
 * mid-way through collapsing.
 */
function CollapsibleContent({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Content>) {
  return (
    <CollapsiblePrimitive.Content
      data-slot="collapsible-content"
      className={cn(
        "overflow-hidden data-[state=closed]:collapsible-up data-[state=open]:collapsible-down",
        className
      )}
      {...props}
    />
  )
}

/**
 * The chevron that belongs to a CollapsibleTrigger.
 *
 * Kept here rather than repeated at each call site so every collapsible in
 * the app turns the same way, at the same speed, from the same starting
 * angle.
 */
function CollapsibleChevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn(
        "size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration) ease-(--ease-out) group-data-[state=open]/collapsible-trigger:rotate-180",
        className
      )}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  CollapsibleChevron,
}
