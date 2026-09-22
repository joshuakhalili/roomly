import { z } from "zod";
import type { Block } from "../model";
import { emergency, EMERGENCY_GUIDANCE, triage } from "../maintenance";
export const kinds = [
  "welcome",
  "essential",
  "agreement",
  "person",
  "first_week",
  "resource",
  "faq",
  "local_place",
  "safety",
  "access",
] as const;
export const dataKeys = [
  "key",
  "value",
  "url",
  "phone",
  "name",
  "none",
  "not_provided",
  "sensitive",
  "glossary",
] as const;
const dataSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .refine(
    (v) =>
      Object.keys(v).every((k) => (dataKeys as readonly string[]).includes(k)),
    "Unknown structured data key",
  );
export const suggestionSchema = z
  .object({
    kind: z.enum(kinds),
    title: z.string().min(1).max(160),
    body: z.string().min(1).max(6000),
    data: dataSchema,
    visibility: z.enum(["invitee", "member", "scheduled", "manager_only"]),
    sourceExcerpt: z.string().max(2000),
    warnings: z.array(z.string()),
  })
  .strict();
export type ExtractedSuggestion = z.infer<typeof suggestionSchema>;
export const answerSchema = z
  .object({
    status: z.enum(["answered", "unknown", "escalate", "emergency"]),
    answer: z.string().max(6000),
    sourceIds: z.array(z.string().uuid()).max(8),
    suggestedAction: z.enum([
      "none",
      "open_block",
      "contact_manager",
      "report_repair",
      "call_emergency",
    ]),
    category: z.string(),
  })
  .strict();
export type Answer = z.infer<typeof answerSchema>;
export const unknown = (): Answer => ({
  status: "unknown",
  answer:
    "I do not have a checked source for that. Please contact your manager; your question has been added to their inbox.",
  sourceIds: [],
  suggestedAction: "contact_manager",
  category: "missing_information",
});
export const emergencyAnswer = (): Answer => ({
  status: "emergency",
  answer: EMERGENCY_GUIDANCE,
  sourceIds: [],
  suggestedAction: "call_emergency",
  category: "emergency",
});
export function redact(text: string) {
  return text
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[token removed]")
    .replace(/\b\d{4,8}\b/g, "[number removed]")
    .replace(/https?:\/\/\S*invite\S*/gi, "[invite removed]")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[email]")
    .replace(/(?:\+?\d[\d ()-]{8,}\d)/g, "[phone or number]")
    .replace(
      /\b\d+[A-Za-z]?\s+(?:[A-Za-z]+\s+){0,4}(?:Street|Road|Lane|Avenue|Close|Drive|Way|St|Rd)\b/gi,
      "[address]",
    )
    .replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, "[postcode]")
    .replace(
      /\b(?:code|password|token|secret|account|sort code)\s*[:=]?\s*\S+/gi,
      "[secret removed]",
    );
}
export function safeForAI(b: Block) {
  return (
    b.kind !== "access" &&
    !/(?:access|entry|door)\s*(?:code|pin)|password|secret|bank details|sort code|account number/i.test(
      b.title + " " + b.body,
    ) &&
    !b.data.sensitive &&
    !["wifi", "address", "manager", "emergency", "payment"].includes(
      String(b.data.key),
    )
  );
}
export function retrieve(blocks: Block[], question: string): Block[] {
  const words =
    question
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter(
        (w) =>
          w.length > 2 &&
          ![
            "the",
            "can",
            "how",
            "what",
            "where",
            "this",
            "are",
            "for",
            "and",
            "does",
            "please",
            "about",
            "you",
            "your",
            "who",
            "has",
            "have",
            "with",
            "from",
            "that",
            "this",
            "help",
            "could",
            "would",
            "should",
            "there",
            "home",
            "house",
            "tell",
            "know",
            "when",
            "after",
            "before",
          ].includes(w),
      ) || [];
  const synonyms = /垃圾|çöp/i.test(question)
    ? ["bins"]
    : /客人|misafir/i.test(question)
      ? ["guests"]
      : /维修|tamir/i.test(question)
        ? ["repairs"]
        : [];
  return blocks
    .map((b) => ({
      b,
      score: [...words, ...synonyms].reduce(
        (n, w) =>
          n +
          (b.title.toLowerCase().includes(w) ? 5 : 0) +
          (b.body.toLowerCase().includes(w) ? 1 : 0) +
          (String(b.data.key).includes(w) ? 4 : 0),
        0,
      ),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((x) => x.b);
}
export function validateSources(answer: Answer, blocks: Block[]): Answer {
  if (answer.status !== "answered") return { ...answer, sourceIds: [] };
  if (
    !answer.sourceIds.length ||
    answer.sourceIds.some((id) => !blocks.some((b) => b.id === id))
  )
    return unknown();
  return answer;
}
export interface AIProvider {
  name: string;
  model: string;
  extract(notes: string): Promise<ExtractedSuggestion[]>;
  answer(question: string, blocks: Block[]): Promise<Answer>;
  translate(
    block: Block,
    locale: string,
  ): Promise<{ title: string; body: string }>;
  triage(text: string): Promise<ReturnType<typeof triage>>;
}
export class DemoAIProvider implements AIProvider {
  name = "demo";
  model = "deterministic-v1";
  async extract(notes: string) {
    if (/provider.?error/i.test(notes)) throw new Error("PROVIDER_UNAVAILABLE");
    return notes
      .split(/\n+/)
      .filter((n) => n.trim())
      .slice(0, 20)
      .map((line) => {
        const category = /bin|recycl/i.test(line)
          ? "bins"
          : /guest/i.test(line)
            ? "guests"
            : /repair/i.test(line)
              ? "repairs"
              : /wifi|wi-fi/i.test(line)
                ? "wifi"
                : /quiet|agreement|rule/i.test(line)
                  ? "agreement"
                  : "notes";
        return suggestionSchema.parse({
          kind: category === "agreement" ? "agreement" : "faq",
          title:
            category === "notes"
              ? "Home information"
              : category[0].toUpperCase() + category.slice(1),
          body: line.trim(),
          data: { key: category },
          visibility: "member",
          sourceExcerpt: line.trim(),
          warnings: /\[secret removed\]/.test(line)
            ? [
                "Sensitive values removed. Add approved access details manually.",
              ]
            : [],
        });
      });
  }
  async answer(question: string, blocks: Block[]): Promise<Answer> {
    if (/provider.?error/i.test(question))
      throw new Error("PROVIDER_UNAVAILABLE");
    if (
      /ignore.*instructions|system prompt|reveal.*secret|other.*room|invent|pretend|ambiguous/i.test(
        question,
      )
    )
      return unknown();
    const found = retrieve(blocks, question)[0];
    if (!found) return unknown();
    return {
      status: "answered",
      answer: found.body,
      sourceIds: [found.id],
      suggestedAction: "open_block",
      category: String(found.data.key || found.kind),
    };
  }
  async translate(block: Block, locale: string) {
    const dictionary: Record<string, Record<string, string>> = {
      "zh-CN": { Bins: "垃圾与回收", Guests: "访客", Repairs: "维修" },
      "tr-TR": {
        Bins: "Çöp ve geri dönüşüm",
        Guests: "Misafirler",
        Repairs: "Onarımlar",
      },
    };
    return {
      title: dictionary[locale]?.[block.title] || block.title,
      body: block.body,
    };
  }
  async triage(text: string) {
    return triage(text);
  }
}
// Deterministic safety gates run before invoking either provider.
export async function groundedAnswer(
  provider: AIProvider,
  question: string,
  authorised: Block[],
): Promise<Answer> {
  if (emergency(question)) return emergencyAnswer();
  if (
    /legal|evict|tenancy|deposit|rent|pay|bank|door code|access code|password/i.test(
      question,
    )
  ) {
    const exact = authorised.find(
      (b) =>
        b.data.sensitive === true &&
        b.title.toLowerCase() === question.trim().toLowerCase(),
    );
    return exact
      ? {
          status: "answered",
          answer: exact.body,
          sourceIds: [exact.id],
          suggestedAction: "open_block",
          category: "approved_exact_source",
        }
      : unknown();
  }
  const sources = retrieve(authorised.filter(safeForAI), question);
  const safe = sources.map((b) => ({
    ...b,
    body: redact(b.body),
    data: { key: b.data.key || "" },
  }));
  try {
    const parsed = answerSchema.safeParse(
      await provider.answer(redact(question), safe),
    );
    if (!parsed.success) return unknown();
    if (parsed.data.status === "emergency") return emergencyAnswer();
    if (parsed.data.status !== "answered") return unknown();
    return validateSources(parsed.data, sources);
  } catch (error) {
    if (error instanceof z.ZodError) return unknown();
    throw error;
  }
}
export function lockedFacts(text: string) {
  return [
    ...text.matchAll(
      /(?:https?:\/\/\S+|\+?\d[\d ()-]{3,}\d|\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b)/g,
    ),
  ].map((m) => m[0]);
}
export function validateTranslation(
  source: Block,
  translated: { title: string; body: string },
) {
  if (!lockedFacts(source.body).every((f) => translated.body.includes(f)))
    throw new Error("LOCKED_FACT_CHANGED");
}
