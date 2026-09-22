import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
describe.skipIf(process.env.ROOMLY_LIVE_AI !== "true")(
  "opt-in OpenAI contract",
  () => {
    it("extracts only structured reviewable suggestions", async () => {
      const { OpenAIProvider } = await import("../../lib/ai/openai");
      const { suggestionSchema } = await import("../../lib/ai/provider");
      const suggestions = await new OpenAIProvider().extract(
        "Recycling bins are collected on Tuesday. Keep the shared hallway clear.",
      );
      expect(suggestions.length).toBeGreaterThan(0);
      for (const s of suggestions)
        expect(suggestionSchema.safeParse(s).success).toBe(true);
    });
  },
);

describe("OpenAI wire format without network access", () => {
  it("uses a closed schema for every extraction data field", async () => {
    const { extractionWireSchema } = await import("../../lib/ai/openai");
    const { zodResponseFormat } = await import("openai/helpers/zod");
    const format = zodResponseFormat(extractionWireSchema, "extraction");
    const schema = format.json_schema.schema as {
      properties: {
        suggestions: {
          items: {
            properties: {
              data: { additionalProperties: boolean; required: string[] };
            };
          };
        };
      };
    };
    expect(
      schema.properties.suggestions.items.properties.data.additionalProperties,
    ).toBe(false);
    expect(
      schema.properties.suggestions.items.properties.data.required,
    ).toContain("sensitive");
  });
});
