import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        /* Status variants.
           Every one of these existed before as a hardcoded Tailwind class
           repeated across components — `text-amber-600 dark:text-amber-500`,
           `bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300` and
           so on. They read from tokens now, so light and dark stay in step and
           a colour can be changed in one place.

           Tinted rather than solid: a page with six solid status chips on it
           reads as an emergency. The solid tones are reserved for the one
           thing that genuinely needs shouting. */
        destructive:
          "bg-destructive-muted text-destructive [a]:hover:brightness-95",
        success: "bg-success-muted text-success [a]:hover:brightness-95",
        warning: "bg-warning-muted text-warning [a]:hover:brightness-95",
        caution: "bg-caution-muted text-caution [a]:hover:brightness-95",
        info: "bg-info-muted text-info [a]:hover:brightness-95",
        /* Solid, for the rare chip that has to carry across a busy card. */
        "destructive-solid":
          "bg-destructive text-destructive-foreground [a]:hover:bg-destructive/90",
        "success-solid":
          "bg-success text-success-foreground [a]:hover:bg-success/90",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
