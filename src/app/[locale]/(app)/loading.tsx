import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * What the app shows while a page's data is on its way.
 *
 * This file existing is most of the fix for "there's a delay between the nav
 * items". There was no delay to speak of on some of those pages — Properties
 * answered in about 300ms — but without a loading boundary the App Router
 * holds the *old* page on screen until the server responds, and changes
 * nothing at all in the meantime. Not the heading, not the highlight in the
 * sidebar. For those 300ms you cannot tell whether your click registered,
 * which reads as a broken app rather than a loading one.
 *
 * With this here, the shell swaps instantly: the nav highlight moves, the old
 * content goes, and the shape of what is coming appears. The wait is the same
 * length and stops being a wait.
 *
 * It also makes prefetching useful. Next can prefetch this shell for a link it
 * expects you to click, which it cannot do for a fully dynamic page.
 *
 * Deliberately generic, and deliberately the *shape* of a page rather than a
 * spinner: every screen in this app opens with a header and a row of cards, so
 * a skeleton in that shape means nothing jumps when the real content lands.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-live="polite">
      <header className="flex flex-col gap-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-64" />
      </header>

      {/* The bento's proportions: one wide tile, two beside it, three below. */}
      <section className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-7 lg:row-span-2">
          <CardContent className="flex flex-col gap-4 p-6">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-14 w-56" />
            <Skeleton className="h-4 w-40" />
          </CardContent>
        </Card>

        {[0, 1].map((i) => (
          <Card key={i} className="col-span-6 lg:col-span-5">
            <CardContent className="flex flex-col gap-4 p-5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}

        {[0, 1, 2].map((i) => (
          <Card key={i} className="col-span-6 lg:col-span-4">
            <CardContent className="flex flex-col gap-3 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-32" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-3 p-5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
