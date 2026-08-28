import type { AppLanguage } from "./types";

export type TemplateKey =
  | "rent_reminder"
  | "rent_overdue"
  | "cleaning_reminder"
  | "move_in_welcome"
  | "move_out_reminder";

export interface MessageTemplate {
  template_key: string;
  language: AppLanguage;
  body_text: string;
}

/**
 * Substitutes {{placeholders}} in a template.
 *
 * Anything left unfilled is stripped rather than shown raw — a tenant
 * receiving "Hi {{name}}" is worse than one receiving "Hi".
 */
export function renderTemplate(
  body: string,
  values: Record<string, string | number | null | undefined>,
): string {
  return body
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const v = values[key];
      return v === null || v === undefined ? "" : String(v);
    })
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function pickTemplate(
  templates: MessageTemplate[],
  key: TemplateKey,
  language: AppLanguage,
): string | null {
  return (
    templates.find((t) => t.template_key === key && t.language === language)
      ?.body_text ??
    // Fall back to English rather than sending nothing.
    templates.find((t) => t.template_key === key && t.language === "en")
      ?.body_text ??
    null
  );
}

/**
 * A wa.me link that opens the tenant's chat with the message already typed.
 *
 * The number must be E.164 with no punctuation — wa.me silently fails on
 * anything else rather than erroring, which is why phone numbers are
 * normalised on save.
 */
export function whatsappLink(phone: string, message: string): string | null {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * WeChat has no equivalent of wa.me.
 *
 * There is no public URL scheme — for anyone, including verified business
 * accounts — that opens a specific person's chat with pre-filled text from
 * outside the app. Its deep links reach Official Account profiles and
 * mini-programs, not arbitrary 1:1 conversations, and there is no
 * number-to-chat lookup.
 *
 * So the honest ceiling is: copy the message, show the WeChat ID, let the
 * admin paste. Presenting a button that looked like WhatsApp's but silently
 * did nothing would be worse than admitting the limitation.
 */
export const WECHAT_HAS_NO_DEEP_LINK = true;
