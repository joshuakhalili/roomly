import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* "Room 2" before "Room 10". The database sorts names as plain text, which
   puts every two-digit room ahead of the single digits after it. */
const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

export function naturalCompare(a: string, b: string) {
  return nameCollator.compare(a, b)
}

export function byName<T extends { name: string }>(rows: T[] | null | undefined): T[] {
  return [...(rows ?? [])].sort((a, b) => naturalCompare(a.name, b.name))
}
