import { z } from "zod";
import { kinds } from "./ai/provider";
const id = z.string().uuid();
const text = z.string().trim().min(1).max(6000);
export const contentInput = z.object({
  roomId: id,
  id: id.optional(),
  title: text.max(160),
  body: text,
  kind: z.enum(kinds),
  visibility: z.enum(["invitee", "member", "scheduled", "manager_only"]),
  visible_from: z.string().datetime({ offset: true }).nullable().optional(),
  required_acknowledgement: z.boolean().default(false),
  data: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    )
    .default({}),
  expectedVersion: z.number().int().positive().optional(),
});
export const contracts = {
  createOrganisation: z.object({ name: text.max(120) }),
  createProperty: z.object({
    organisationId: id,
    name: text.max(160),
    address: text,
    city: text,
    postcode: text,
    type: z.enum(["shared_house", "student_house", "coliving", "other"]),
    timezone: z.string().default("Europe/London"),
  }),
  createRoom: z.object({
    propertyId: id,
    name: text.max(120),
    capacity: z.number().int().min(1).max(100),
    managerName: text,
    managerPhone: text,
    emergencyPhone: text,
    locales: z.array(z.enum(["en-GB", "zh-CN", "tr-TR"])).min(1),
  }),
  saveManagerOnboardingStep: z.object({
    step: z.number().int().min(0).max(6),
    values: z.record(z.string(), z.string().max(20000)),
    advance: z.boolean().default(true),
  }),
  createInvite: z.object({
    roomId: id,
    email: z.union([z.email(), z.literal("")]).optional(),
    expiresInDays: z.number().int().min(1).max(30).default(7),
  }),
  revokeInvite: z.object({ inviteId: id }),
  resolveInvite: z.object({ rawToken: z.string().min(32).max(200) }),
  claimInvite: z.object({ rawToken: z.string().min(32).max(200) }),
  saveResidentPreferences: z.object({
    membershipId: id,
    preferredName: text.max(120),
    locale: z.enum(["en-GB", "zh-CN", "tr-TR"]),
    pronouns: z.string().max(80).default(""),
    notification: z.enum(["email", "none"]),
  }),
  advanceResident: z.object({
    membershipId: id,
    step: z.number().int().min(2).max(7),
  }),
  acknowledgeBlock: z.object({
    membershipId: id,
    blockId: id,
    version: z.number().int().positive(),
  }),
  completeOnboardingTask: z.object({ membershipId: id, taskId: id }),
  createContentBlock: contentInput,
  updateContentBlock: contentInput.extend({
    id,
    expectedVersion: z.number().int().positive(),
  }),
  reorderContentBlocks: z.object({ roomId: id, orderedIds: z.array(id) }),
  publishContentChanges: z.object({ roomId: id }),
  archiveBlock: z.object({ blockId: id, expectedVersion: z.number().int() }),
  undoArchive: z.object({ blockId: id, expectedVersion: z.number().int() }),
  runContentExtraction: z.object({ roomId: id, notes: text.max(20000) }),
  reviewAiSuggestion: z.object({
    suggestionId: id,
    decision: z.enum(["accepted", "edited", "rejected"]),
    editedData: z.object({ title: text.max(160), body: text }).optional(),
  }),
  translateBlock: z.object({ blockId: id, locale: z.enum(["zh-CN", "tr-TR"]) }),
  reviewTranslation: z.object({
    translationId: id,
    title: text.max(160),
    body: text,
  }),
  askRoomly: z.object({ roomId: id, question: text.max(2000) }),
  submitQuestionFeedback: z.object({
    questionLogId: id,
    feedback: z.enum(["helpful", "not_helpful"]),
  }),
  questionToFaq: z.object({ questionId: id, answer: text }),
  createMaintenanceDraft: z.object({
    roomId: id,
    title: text.max(160),
    description: text,
    location: text.max(200),
    availability: text.max(1000),
  }),
  submitMaintenanceRequest: z.object({ requestId: id }),
  appendMaintenanceEvent: z.object({
    requestId: id,
    status: z.enum([
      "acknowledged",
      "scheduled",
      "in_progress",
      "resolved",
      "closed",
    ]),
    note: text,
    residentVisible: z.boolean().default(true),
  }),
  saveSettings: z.object({
    roomId: id,
    name: text,
    managerPhone: text,
    emergencyPhone: text,
    languagesReviewed: z.boolean(),
  }),
};
export type Operation = keyof typeof contracts;
