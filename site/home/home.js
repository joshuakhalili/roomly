// Roomly homepage behaviour: reveal on scroll, the hero screen settling flat
// as you scroll, the sticky walkthrough, and the billing toggle. Everything
// degrades to a readable static page without it.
(() => {
  const root = document.documentElement;
  root.classList.add("js");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Nav gains a surface once the page moves.
  const nav = document.querySelector("[data-nav]");
  const onScroll = () => nav?.classList.toggle("is-scrolled", scrollY > 24);
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });

  // Close the phone menu after choosing a destination.
  document.querySelectorAll(".nav-sheet a").forEach((a) =>
    a.addEventListener("click", () => a.closest("details")?.removeAttribute("open")),
  );

  // Reveal: staggered within each parent, once.
  const reveals = [...document.querySelectorAll(".reveal")];
  const siblings = new Map();
  for (const el of reveals) {
    const i = siblings.get(el.parentElement) ?? 0;
    el.style.setProperty("--delay", `${Math.min(i, 5) * 70}ms`);
    siblings.set(el.parentElement, i + 1);
  }
  if (reduced || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("is-in"));
  } else {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    reveals.forEach((el) => io.observe(el));
  }

  // Hero screen: tilted back on arrival, flattens as it scrolls into view.
  const tilt = document.querySelector("[data-tilt]");
  if (tilt && !reduced) {
    let ticking = false;
    const update = () => {
      ticking = false;
      const r = tilt.getBoundingClientRect();
      const progress = Math.min(Math.max(1 - (r.top - innerHeight * 0.18) / (innerHeight * 0.6), 0), 1);
      tilt.style.setProperty("--tilt", `${(14 * (1 - progress)).toFixed(2)}deg`);
      tilt.style.setProperty("--scale", (0.94 + 0.06 * progress).toFixed(3));
    };
    update();
    addEventListener("scroll", () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
  }

  // Walkthrough: whichever step sits in the middle of the screen drives the
  // picture beside it.
  const steps = [...document.querySelectorAll("[data-step]")];
  const shots = [...document.querySelectorAll(".story-shots img")];
  if (steps.length && "IntersectionObserver" in window) {
    const activate = (index) => {
      steps.forEach((s, i) => s.classList.toggle("is-active", i === index));
      shots.forEach((s, i) => s.classList.toggle("is-active", i === index));
    };
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) activate(Number(e.target.dataset.step));
        }),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    steps.forEach((s) => io.observe(s));
  }

  // Billing period.
  const toggle = document.querySelector("[data-billing]");
  toggle?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-period]");
    if (!button) return;
    const period = button.dataset.period;
    toggle.querySelectorAll("button").forEach((b) =>
      b.setAttribute("aria-pressed", String(b === button)),
    );
    document.querySelectorAll(`[data-${period}]`).forEach((el) => {
      el.textContent = el.dataset[period];
    });
  });
})();
