export type Json =
  string | number | boolean | null | Json[] | { [key: string]: Json };
export type Kind =
  | "welcome"
  | "essential"
  | "agreement"
  | "person"
  | "first_week"
  | "resource"
  | "faq"
  | "local_place"
  | "safety"
  | "access";
export type Visibility = "invitee" | "member" | "scheduled" | "manager_only";
export type Base = { id: string; created_at: string; updated_at?: string };
export type Profile = Base & {
  display_name: string;
  preferred_name: string | null;
  pronouns: string | null;
  locale: string;
  notification_preference: string;
};
export type Organisation = Base & {
  name: string;
  slug: string;
  created_by: string;
};
export type OrgMember = Base & {
  organisation_id: string;
  profile_id: string;
  role: "owner" | "manager" | "staff";
};
export type Property = Base & {
  organisation_id: string;
  name: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  postcode: string;
  country_code: string;
  timezone: string;
  property_type: "shared_house" | "student_house" | "coliving" | "other";
  published_at: string | null;
};
export type Room = Base & {
  property_id: string;
  name: string;
  capacity: number;
  manager_contact_json: { name: string; phone: string };
  emergency_contact_json: { phone: string };
  default_locale: string;
  supported_locales: string[];
  languages_reviewed: boolean;
};
export type Membership = Base & {
  room_id: string;
  profile_id: string;
  status: "invited" | "active" | "ended";
  move_in_at: string | null;
  move_out_at: string | null;
  onboarding_completed_at: string | null;
  onboarding_step: number;
};
export type Invite = Base & {
  room_id: string;
  created_by: string;
  invitee_email: string | null;
  token_hash: string;
  expires_at: string;
  claimed_at: string | null;
  revoked_at: string | null;
};
export type BlockContent = {
  kind: Kind;
  title: string;
  body: string;
  data: Record<string, string | number | boolean | null>;
  position: number;
  visibility: Visibility;
  visible_from: string | null;
  required_acknowledgement: boolean;
  status: "draft" | "published" | "archived";
  source_type: "manual" | "imported" | "ai_draft" | "approved_answer";
  source_excerpt: string | null;
  owner_id: string;
  verified_at: string | null;
  published_at: string | null;
  version: number;
};
export type Block = Base &
  BlockContent & {
    room_id: string;
    published_snapshot: BlockContent | null;
    published_version: number | null;
  };
export type Version = Base & {
  content_block_id: string;
  version: number;
  snapshot: BlockContent;
  changed_by: string;
  change_reason: string;
};
export type Translation = Base & {
  content_block_id: string;
  locale: string;
  title: string;
  body: string;
  data: BlockContent["data"];
  status: "draft" | "reviewed" | "published";
  reviewed_by: string | null;
  source_version: number;
  published_snapshot: {
    title: string;
    body: string;
    data: BlockContent["data"];
    source_version: number;
  } | null;
};
export type Acknowledgement = Base & {
  membership_id: string;
  content_block_id: string;
  content_version: number;
  acknowledged_at: string;
};
export type Task = Base & {
  room_id: string;
  title: string;
  description: string;
  position: number;
  required: boolean;
  completion_kind: "manual" | "acknowledgement" | "visit" | "manager_confirmed";
};
export type Completion = Base & {
  membership_id: string;
  onboarding_task_id: string;
  completed_at: string;
};
export type Question = Base & {
  membership_id: string;
  room_id: string;
  question_redacted: string;
  category: string;
  outcome: "answered" | "unknown" | "escalated" | "blocked";
  cited_block_ids: string[];
  feedback: "helpful" | "not_helpful" | null;
};
export type AiRun = Base & {
  organisation_id: string;
  room_id: string;
  actor_id: string;
  purpose:
    | "content_extract"
    | "rewrite"
    | "translate"
    | "answer"
    | "maintenance_triage";
  provider: string;
  model: string;
  input_hash: string;
  status: string;
  latency_ms: number;
  result_metadata: Record<string, Json>;
  error_code: string | null;
};
export type Suggestion = Base & {
  ai_run_id: string;
  room_id: string;
  kind: Kind;
  proposed_data: {
    kind: Kind;
    title: string;
    body: string;
    data: BlockContent["data"];
    visibility: Visibility;
    sourceExcerpt: string;
    warnings: string[];
  };
  source_excerpt: string;
  status: "pending" | "accepted" | "edited" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
};
export type RepairStatus =
  | "draft"
  | "submitted"
  | "acknowledged"
  | "scheduled"
  | "in_progress"
  | "resolved"
  | "closed";
export type Repair = Base & {
  room_id: string;
  membership_id: string;
  title: string;
  description: string;
  location: string;
  category:
    | "plumbing"
    | "electrical"
    | "heating"
    | "appliance"
    | "access"
    | "safety"
    | "other";
  priority: "low" | "normal" | "high" | "emergency";
  status: RepairStatus;
  availability_json: { notes: string };
  assigned_to: string | null;
};
export type Attachment = Base & {
  maintenance_request_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  name: string;
};
export type RepairEvent = Base & {
  maintenance_request_id: string;
  actor_id: string | null;
  event_type: string;
  note: string;
  resident_visible: boolean;
};
export type ManagerProgress = Base & {
  profile_id: string;
  step: number;
  organisation_id: string | null;
  property_id: string | null;
  room_id: string | null;
  values: Record<string, string>;
  completed: boolean;
};
export type State = {
  profiles: Profile[];
  organisations: Organisation[];
  organisation_members: OrgMember[];
  properties: Property[];
  rooms: Room[];
  memberships: Membership[];
  invites: Invite[];
  content_blocks: Block[];
  content_versions: Version[];
  translations: Translation[];
  acknowledgements: Acknowledgement[];
  onboarding_tasks: Task[];
  onboarding_task_completions: Completion[];
  question_logs: Question[];
  ai_runs: AiRun[];
  ai_suggestions: Suggestion[];
  maintenance_requests: Repair[];
  maintenance_attachments: Attachment[];
  maintenance_events: RepairEvent[];
  manager_onboarding: ManagerProgress[];
};
export type Table = keyof State;
export type Actor = { id: string; email?: string };
export type Result<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        fieldErrors?: Record<string, string[]>;
      };
    };
export const TABLES: Table[] = [
  "profiles",
  "organisations",
  "organisation_members",
  "properties",
  "rooms",
  "memberships",
  "invites",
  "content_blocks",
  "content_versions",
  "translations",
  "acknowledgements",
  "onboarding_tasks",
  "onboarding_task_completions",
  "question_logs",
  "ai_runs",
  "ai_suggestions",
  "maintenance_requests",
  "maintenance_attachments",
  "maintenance_events",
  "manager_onboarding",
];
export function emptyState(): State {
  return Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as State;
}
