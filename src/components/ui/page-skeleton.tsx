import { Skeleton } from "@/components/ui/skeleton";

/**
 * The shape of a list screen while it loads: title, toolbar, rows. Matching
 * the real layout means nothing jumps when the content arrives.
 */
export function ListPageSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </header>
      <div className="flex gap-3 border-b pb-5">
        <Skeleton className="h-10 flex-1 max-w-md rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
      <div className="flex flex-col">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-5 border-b py-5" style={{ opacity: 1 - i * 0.09 }}>
            <Skeleton className="size-12 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="hidden h-4 w-24 sm:block" />
            <Skeleton className="hidden h-4 w-20 md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
