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
export type ChecklistType = "check_in" | "check_out";
export type ChecklistStatus = "draft" | "completed";
export type DocumentType =
  | "passport"
  | "right_to_rent"
  | "tenancy_agreement"
  | "deposit_certificate"
  | "handbook"
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

/**
 * Documents a live tenancy is expected to have on file. Drives the
 * "missing documents" count on the dashboard.
 *
 * Right-to-rent is a legal requirement for UK lettings; deposit protection
 * must be evidenced within 30 days of taking a deposit.
 */
export const REQUIRED_DOCUMENT_TYPES: DocumentType[] = [
  "right_to_rent",
  "tenancy_agreement",
  "deposit_certificate",
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
  created_at: string;
}

export interface Occupant {
  id: string;
  tenancy_id: string;
  first_name: string;
  surname: string;
  email: string | null;
  phone: string | null;
  wechat_id: string | null;
  country_of_origin: string | null;
  preferred_language: AppLanguage;
  is_lead_tenant: boolean;
  notes: string | null;
  created_at: string;
}

export interface DocumentRecord {
  id: string;
  occupant_id: string | null;
  tenancy_id: string;
  doc_type: DocumentType;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  notes: string | null;
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
  tenancy_id: string;
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
  tenancy: (Tenancy & { occupants: Occupant[] }) | null;
}
