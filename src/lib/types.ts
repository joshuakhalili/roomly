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
export type RentFrequency = "weekly" | "fortnightly" | "four_weekly" | "monthly";
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
  | "other";
export type AppLanguage = "en" | "zh";
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
];

/**
 * What a live tenancy must have on file, driving the dashboard's
 * "missing documents" count.
 *
 * Right-to-rent is required under the Immigration Act 2014. Deposit
 * protection must be evidenced, with the prescribed information served,
 * within 30 days of taking a deposit. Since 1 May 2026 the Renters' Rights
 * Act Information Sheet replaced the withdrawn "How to Rent" guide.
 */
export const REQUIRED_DOCUMENT_TYPES: DocumentType[] = [
  "right_to_rent",
  "tenancy_agreement",
  "deposit_certificate",
  "deposit_prescribed_info",
  "renters_rights_info",
];

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
  start_date: string;
  end_date: string | null;
  rent_amount: number;
  rent_frequency: RentFrequency;
  rent_due_day: number | null;
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
