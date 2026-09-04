/**
 * Application types mirroring the database schema in
 * supabase/migrations/0001_init.sql. Keep the two in step.
 */

export type TenancyStatus = "upcoming" | "active" | "ended" | "archived";

/**
 * What a tenant actually rents. Distinct from an area type — a kitchen is
 * never let on its own, it's only a space inside one of these.
 */
export type UnitType = "studio" | "flat";

/**
 * How a letting is shaped, which is not the same question as what is let.
 *
 * A long-term tenancy recurs: one amount, repeating on a cadence, until it
 * ends. A short stay does not — it is a fixed number of nights with one total
 * price. Everything downstream that has to behave differently (rent rows,
 * which documents are required) branches on this rather than guessing from
 * the dates.
 */
export type LettingType = "long_term" | "short_stay";

/**
 * "total" is the short-stay case: one price for the whole booking rather than
 * a repeating charge. It lives in the same field as the recurring cadences so
 * that every existing "sum rent_amount for active tenancies" query keeps
 * working without learning about a second price column.
 */
export type RentFrequency =
  | "weekly"
  | "fortnightly"
  | "four_weekly"
  | "monthly"
  | "total";
export type RentPaymentStatus = "due" | "paid" | "late" | "waived";
export type ConditionRating =
  | "excellent"
  | "good"
  | "fair"
  | "poor"
  | "unacceptable";
/**
 * "baseline" is the room's own standing inventory, set up once with photos.
 * A tenancy's check_in is seeded from it.
 */
export type ChecklistType = "baseline" | "check_in" | "check_out";
export type ChecklistStatus = "draft" | "completed";
/**
 * Document types as UK letting actually requires them, verified against
 * gov.uk in August 2026. Grouped by who they belong to — see the three
 * constants below.
 */
export type DocumentType =
  // Follow the person
  | "id_document"
  | "right_to_rent"
  | "reference_check"
  // Belong to the letting
  | "tenancy_agreement"
  | "deposit_certificate"
  | "deposit_prescribed_info"
  | "renters_rights_info"
  | "inventory_report"
  | "handbook"
  // The business's own paperwork — the document library
  | "gas_safety"
  | "epc"
  | "eicr"
  | "hmo_licence"
  | "legionella_assessment"
  | "fire_safety"
  | "maintenance_invoice"
  | "insurance"
  | "business_licence"
  | "warranty"
  | "receipt"
  | "other";
/**
 * The language a tenant is written to in, which is not the language the admin
 * is reading the app in — a Turkish-speaking landlord may have a Chinese
 * tenant. Kept separate from the UI locale for exactly that reason.
 */
export type AppLanguage = "en" | "zh" | "tr";

/** Every language a message can be sent in, for building pickers. */
export const APP_LANGUAGES: AppLanguage[] = ["en", "zh", "tr"];

/** Named in itself, so someone finds their own language by recognising it. */
export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  en: "English",
  zh: "简体中文",
  tr: "Türkçe",
};

/**
 * Reads a language off a form, falling back to English.
 *
 * Both places that did this checked for one language and assumed English
 * otherwise, which quietly turns every language added afterwards into
 * English. Checking against the list means adding a fourth needs no edits
 * here at all.
 */
export function toAppLanguage(value: unknown): AppLanguage {
  return APP_LANGUAGES.includes(value as AppLanguage)
    ? (value as AppLanguage)
    : "en";
}
export type LeavingReason =
  | "end_of_term"
  | "tenant_gave_notice"
  | "given_notice_by_admin"
  | "other";

/** Ordered worst→best so ratings can be compared numerically. */
export const CONDITION_ORDER: ConditionRating[] = [
  "unacceptable",
  "poor",
  "fair",
  "good",
  "excellent",
];

/** Identity and vetting — reused whenever the same person rents again. */
export const TENANT_DOCUMENT_TYPES: DocumentType[] = [
  "id_document",
  "right_to_rent",
  "reference_check",
];

/** Paperwork for one specific letting. */
export const TENANCY_DOCUMENT_TYPES: DocumentType[] = [
  "tenancy_agreement",
  "deposit_certificate",
  "deposit_prescribed_info",
  "renters_rights_info",
  "inventory_report",
  "handbook",
  "other",
];

/**
 * The business's own paperwork, kept apart from anything tenant-facing.
 * These survive tenant turnover and apply to whoever lives there next.
 */
export const LIBRARY_DOCUMENT_TYPES: DocumentType[] = [
  "gas_safety",
  "eicr",
  "epc",
  "hmo_licence",
  "legionella_assessment",
  "fire_safety",
  "maintenance_invoice",
  "insurance",
  "business_licence",
  "warranty",
  "receipt",
  "other",
];

/** Statutory safety certificates, which expire and must be kept current. */
export const CERTIFICATE_TYPES: DocumentType[] = [
  "gas_safety",
  "eicr",
  "epc",
  "hmo_licence",
  "legionella_assessment",
  "fire_safety",
];

/** Types where a supplier and cost are worth recording alongside the file. */
export const INVOICE_TYPES: DocumentType[] = [
  "maintenance_invoice",
  "insurance",
  "warranty",
  "receipt",
];

/* What a live letting must have on file used to be a constant here. It is now
   the document_requirements table — see @/lib/queries/document-requirements —
   because the answer depends on whether the letting is a tenancy or a short
   stay, and a constant cannot express that. Leaving a copy behind would be a
   second answer to the same question, one table away from the real one. */

/**
 * One document a letting of a given type must have on file.
 *
 * Lives in the database rather than in this file because the answer differs
 * by what kind of letting it is, and because the list moves by statute — a
 * requirement should be addable without a deploy. See migration 0017.
 */
export interface DocumentRequirement {
  id: string;
  letting_type: LettingType;
  doc_type: DocumentType;
  /** Identity documents follow the person; agreements belong to the letting. */
  owner_scope: "tenant" | "tenancy";
  legal_basis: string | null;
  sort_order: number;
}

/**
 * Certificates the property must hold, with how long each lasts.
 * A lapsed gas safety record is a criminal offence, not an oversight.
 */
export const PROPERTY_CERTIFICATES: {
  type: DocumentType;
  validMonths: number;
}[] = [
  { type: "gas_safety", validMonths: 12 },
  { type: "eicr", validMonths: 60 },
  { type: "epc", validMonths: 120 },
];

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  preferred_language: AppLanguage;
  calendar_feed_token: string;
  email_digest_opt_in: boolean;
  created_at: string;
}

export interface Property {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
  /**
   * A photograph of the building, stored as "<bucket>/<path>".
   *
   * On a list of houses the picture is what someone recognises — they have it
   * before they have finished reading the name.
   */
  banner_path: string | null;
  created_at: string;
}

/** A kind of space inspected on a checklist: Kitchen, Bathroom, Bedroom… */
export interface AreaType {
  id: string;
  name: string;
  sort_order: number;
}

export interface Room {
  id: string;
  property_id: string;
  unit_type: UnitType;
  name: string;
  is_common_area: boolean;
  is_lettable: boolean;
  notes: string | null;
  created_at: string;
}

/** One area on a checklist, e.g. "Bedroom 1". */
export interface ChecklistArea {
  id: string;
  checklist_id: string;
  area_type_id: string | null;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Tenancy {
  id: string;
  room_id: string;
  bank_account_id: string | null;
  status: TenancyStatus;
  letting_type: LettingType;
  start_date: string;
  end_date: string | null;
  rent_amount: number;
  rent_frequency: RentFrequency;
  rent_due_day: number | null;
  /**
   * When a short stay's balance falls due. Null on a long tenancy, where
   * rent_due_day governs instead, and null on a stay paid in full up front.
   */
  balance_due_date: string | null;
  /**
   * Utilities are covered by the rent rather than billed to the tenant.
   * What makes the utility-spend comparison worth drawing at all.
   */
  bills_included: boolean;
  deposit_amount: number | null;
  deposit_scheme_name: string | null;
  deposit_scheme_ref: string | null;
  reason_for_leaving: LeavingReason | null;
  reason_notes: string | null;
  notes: string | null;
  archived_at: string | null;
  /** Suspends the retention clock while a dispute or claim is live. */
  legal_hold: boolean;
  legal_hold_reason: string | null;
  created_at: string;
}

/**
 * A person, independent of any letting.
 *
 * Created once and assigned to rooms over time — when a tenancy ends the
 * profile remains and can be placed elsewhere, so their details and identity
 * documents are never re-entered.
 */
export interface Tenant {
  id: string;
  first_name: string;
  surname: string;
  email: string | null;
  phone: string | null;
  wechat_id: string | null;
  country_of_origin: string | null;
  preferred_language: AppLanguage;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
}

/** Links a person to one letting, and says who leads it. */
export interface TenancyTenant {
  tenancy_id: string;
  tenant_id: string;
  is_lead_tenant: boolean;
  created_at: string;
}

/** A tenant as they appear within a particular tenancy. */
export interface TenantOnTenancy extends Tenant {
  is_lead_tenant: boolean;
}

export interface DocumentRecord {
  id: string;
  /**
   * Exactly one of these is set: identity documents hang off the person,
   * agreements off the letting, certificates off the property.
   */
  tenant_id: string | null;
  tenancy_id: string | null;
  property_id: string | null;
  room_id: string | null;
  /** Business paperwork covering the whole operation, not one building. */
  is_company_wide: boolean;
  doc_type: DocumentType;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  notes: string | null;
  issued_at: string | null;
  /** Certificates lapse; null for documents that never expire. */
  expires_at: string | null;
  /** Who did the work or issued the policy — invoices and warranties. */
  supplier_name: string | null;
  amount: number | null;
  /** Filed from inside Maintenance: the job's invoice, the purchase receipt. */
  maintenance_job_id: string | null;
  asset_id: string | null;
  uploaded_at: string;
}

export interface RentPayment {
  id: string;
  tenancy_id: string;
  due_date: string;
  amount_due: number;
  status: RentPaymentStatus;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface InventoryChecklist {
  id: string;
  /** Set for check_in/check_out; null on a room baseline. */
  tenancy_id: string | null;
  /** Set on a room baseline; null otherwise. */
  room_id: string | null;
  type: ChecklistType;
  status: ChecklistStatus;
  assessor_name: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ChecklistSection {
  id: string;
  checklist_area_id: string;
  section_template_id: string | null;
  /** Added by hand for this room rather than coming from the template. */
  is_custom: boolean;
  section_name: string;
  sort_order: number;
  condition_rating: ConditionRating | null;
  cleanliness_rating: ConditionRating | null;
  description: string | null;
  flagged_for_maintenance: boolean;
  entry_date: string;
  created_at: string;
}

export interface ChecklistPhoto {
  id: string;
  checklist_section_id: string;
  storage_path: string;
  caption: string | null;
  taken_at: string;
  file_size: number | null;
  sort_order: number;
  created_at: string;
}

export interface ChecklistMeter {
  id: string;
  checklist_id: string;
  meter_type: "electricity" | "gas" | "water";
  reading: string | null;
  reading_date: string | null;
  location: string | null;
  serial_number: string | null;
}

export interface ChecklistKey {
  id: string;
  checklist_id: string;
  description: string;
  quantity: number;
  comments: string | null;
}

export interface ChecklistDetector {
  id: string;
  checklist_id: string;
  detector_type: "smoke" | "co";
  location: string | null;
  tested: boolean;
  comments: string | null;
}

export interface ChecklistDeclaration {
  id: string;
  checklist_id: string;
  role: "assessor" | "tenant";
  typed_name: string;
  email: string | null;
  signed_at: string;
}

export interface ChecklistPdfExport {
  id: string;
  checklist_id: string;
  storage_path: string;
  file_size: number | null;
  generated_at: string;
  photos_purged_at: string | null;
}

/** A room joined with whatever tenancy currently applies to it. */
export interface RoomWithTenancy extends Room {
  property_name?: string;
  tenancy: (Tenancy & { tenants: TenantOnTenancy[] }) | null;
}

// ── Money out ──────────────────────────────────────────────────────────────

export type MeterType = "electricity" | "gas" | "water";

/**
 * One utility bill, covering a period.
 *
 * Period-based rather than dated because it exists to be set against the rent
 * collected over the same weeks — a bill has a span, and so does the income
 * it is being compared with.
 */
export interface UtilityBill {
  id: string;
  property_id: string;
  meter_type: MeterType;
  period_start: string;
  period_end: string;
  amount: number;
  supplier_name: string | null;
  notes: string | null;
  created_at: string;
}

/** An editable category, seeded but extendable. Mirrors ServiceType. */
export interface ExpenseCategory {
  id: string;
  name: string;
  slug: string | null;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
}

/**
 * Spend that has nowhere else to live.
 *
 * Deliberately not everything that costs money: work is a maintenance job,
 * equipment is an asset, utilities are a bill. This is the lamp, the light
 * bulbs, the accountant. Allocations nest rather than exclude — a room
 * implies its property — and all of them are optional, because a software
 * subscription belongs to the business rather than to any one building.
 */
export interface Expense {
  id: string;
  property_id: string | null;
  room_id: string | null;
  tenancy_id: string | null;
  category_id: string | null;
  description: string;
  amount: number;
  spent_on: string;
  supplier_name: string | null;
  /** Bought because a tenant broke it, and intended to go on their bill. */
  is_recharged: boolean;
  notes: string | null;
  created_at: string;
}

/** Where a line in the ledger came from. */
export type ExpenseSource = "expense" | "maintenance" | "asset" | "utility";

/**
 * A row of the `expense_ledger` view: the four sources of outgoing money,
 * unioned. Read-only — each row is owned by the table it came from.
 */
export interface ExpenseLedgerRow {
  id: string;
  source: ExpenseSource;
  spent_on: string;
  amount: number;
  description: string | null;
  supplier_name: string | null;
  property_id: string | null;
  room_id: string | null;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
}

// ── Maintenance ────────────────────────────────────────────────────────────

export type JobStatus = "booked" | "done" | "cancelled";
export type JobSource = "manual" | "recurring" | "tenancy_end";
export type RecurrenceFrequency = "weekly" | "fortnightly" | "monthly";

/**
 * A category of work — and, on a contact, the work that person does.
 *
 * `slug` is set only on the seeded rows. Code looks a category up by slug
 * rather than by name, so renaming "Cleaning" does not break the turnaround
 * trigger, and the UI translates seeded names through it while showing
 * custom ones exactly as typed.
 */
export interface ServiceType {
  id: string;
  name: string;
  slug: string | null;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
}

export interface Contact {
  id: string;
  name: string;
  company: string | null;
  service_type_id: string | null;
  phone: string | null;
  email: string | null;
  usual_property_id: string | null;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
}

export interface Asset {
  id: string;
  property_id: string;
  room_id: string | null;
  name: string;
  make_model: string | null;
  serial_number: string | null;
  purchased_on: string | null;
  cost: number | null;
  supplier_name: string | null;
  warranty_expires_on: string | null;
  notes: string | null;
  is_disposed: boolean;
  created_at: string;
}

export interface JobRecurrence {
  id: string;
  property_id: string;
  room_id: string | null;
  service_type_id: string | null;
  contact_id: string | null;
  title: string;
  frequency: RecurrenceFrequency;
  day_of_week: number | null;
  day_of_month: number | null;
  cost: number | null;
  starts_on: string;
  ends_on: string | null;
  is_active: boolean;
  created_at: string;
}

export interface MaintenanceJob {
  id: string;
  property_id: string;
  room_id: string | null;
  service_type_id: string | null;
  contact_id: string | null;
  title: string;
  description: string | null;
  scheduled_for: string;
  scheduled_time: string | null;
  status: JobStatus;
  completed_on: string | null;
  cost: number | null;
  is_paid: boolean;
  paid_on: string | null;
  source: JobSource;
  recurrence_id: string | null;
  checklist_section_id: string | null;
  asset_id: string | null;
  tenancy_id: string | null;
  notes: string | null;
  created_at: string;
}

/** A job with the names it needs to be readable on its own. */
export interface JobWithContext extends MaintenanceJob {
  property_name: string | null;
  room_name: string | null;
  service_type_name: string | null;
  service_type_slug: string | null;
  contact_name: string | null;
}
