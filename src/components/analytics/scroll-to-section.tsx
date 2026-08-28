"use client";

import { useEffect } from "react";

/**
 * Scrolls to the section named in the URL fragment, once the page has settled.
 *
 * The browser already does this for free, and here it lands in the wrong
 * place: it jumps the moment the server HTML arrives, then the occupancy chart
 * hydrates, changes height, and every section below it slides out from under
 * the position it just scrolled to. Arriving at `#turnover` and finding
 * `#money` on screen is worse than not scrolling at all, because it looks like
 * the link is wrong rather than early.
 *
 * Two frames of waiting is enough — one for React to commit, one for the
 * browser to lay the result out — after which the offset is correct.
 * `scroll-margin-top` on each section keeps the heading clear of the header.
 */
export function ScrollToSection() {
  useEffect(() => {
    function go() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;

      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          target.scrollIntoView({ behavior: "smooth", block: "start" }),
        ),
      );
    }

    go();
    // Following a second tile without leaving the page changes only the hash,
    // which does not remount this component.
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, []);

  return null;
}
