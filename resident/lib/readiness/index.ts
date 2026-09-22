import type { Block, Room } from "../model";
export const CHECK_NAMES = [
  "Address published",
  "Manager contact published",
  "Emergency contact published",
  "Wi-Fi or not provided",
  "Access guidance with safe visibility",
  "Bin and recycling guidance",
  "Repair reporting guidance",
  "Required agreement or none",
  "Supported languages reviewed",
  "Content checked within 180 days",
];
export function readiness(blocks: Block[], room: Room, now = Date.now()) {
  const b = blocks.filter((b) => b.status !== "archived");
  const key = (k: string) => b.some((b) => b.data.key === k && !!b.body.trim());
  const values = [
    key("address"),
    key("manager"),
    key("emergency"),
    key("wifi"),
    b.some(
      (b) =>
        b.kind === "access" &&
        ["member", "scheduled"].includes(b.visibility) &&
        !!b.body.trim() &&
        (b.visibility !== "scheduled" || !!b.visible_from),
    ),
    key("bins"),
    key("repairs"),
    b.some(
      (b) =>
        b.kind === "agreement" &&
        (b.required_acknowledgement || b.data.none === true),
    ),
    room.languages_reviewed,
    b.length > 0 &&
      b.every(
        (b) =>
          b.verified_at && now - Date.parse(b.verified_at) <= 180 * 86400000,
      ),
  ];
  return {
    score: values.filter(Boolean).length * 10,
    checks: CHECK_NAMES.map((name, i) => ({
      name,
      pass: !!values[i],
      required: [0, 1, 2, 4, 6].includes(i),
    })),
    canPublish: [0, 1, 2, 4, 6].every((i) => values[i]),
  };
}
