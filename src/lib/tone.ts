/**
 * Where colour is allowed to appear.
 *
 * The rule, after a version that got this wrong: **colour marks something a
 * person has to act on. It never marks a category.**
 *
 * Giving every metric its own hue seemed helpful — money green, occupancy
 * violet, rooms amber — and it made the dashboard exhausting. Six coloured
 * cards is six things shouting, so nothing is louder than anything else, which
 * is the same problem as six white cards but harder to look at. Occupancy is
 * not good or bad, it is just a number; it does not need a colour to be read.
 *
 * So a tone is set only when the answer to "does someone need to do something
 * about this?" is yes — overdue rent, missing documents, a payment late. Every
 * other figure is plain foreground, and the page stays quiet until something
 * is actually wrong.
 *
 * Colour is also confined to *small* things: a figure, a chip, a meter fill.
 * Never a whole card. A tinted surface is a shout no matter how pale it is.
 */
export type Tone = "neutral" | "brand" | "success" | "info" | "warning" | "danger";

/** The CSS variable behind each tone, for SVG fills and meter widths. */
export const TONE_VAR: Record<Tone, string> = {
  neutral: "var(--muted-foreground)",
  brand: "var(--brand)",
  success: "var(--success)",
  info: "var(--info)",
  warning: "var(--warning)",
  danger: "var(--destructive)",
};

/** Text colour for a figure that needs attention. Neutral leaves it alone. */
export const TONE_TEXT: Record<Tone, string> = {
  neutral: "",
  brand: "text-brand",
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  danger: "text-destructive",
};

/**
 * The soft chip behind a small label or icon.
 *
 * Still used where the colour is carrying the *kind* of thing — an alert card
 * saying "this one is rent, that one is a move-in" — because there the reader
 * genuinely is sorting between categories at a glance.
 */
export const TONE_CHIP: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-brand/12 text-brand",
  success: "bg-success-muted text-success",
  info: "bg-info-muted text-info",
  warning: "bg-warning-muted text-warning",
  danger: "bg-destructive-muted text-destructive",
};
