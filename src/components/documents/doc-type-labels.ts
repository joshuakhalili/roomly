import type { DocumentType } from "@/lib/types";

/**
 * Translation keys for every document type, shared by the tenant, tenancy
 * and property panels so a label can't drift between them.
 */
export const DOC_TYPE_KEYS: Record<DocumentType, string> = {
  // Follow the person
  passport: "documents.passport",
  right_to_rent: "documents.rightToRent",
  reference_check: "documents.referenceCheck",
  // Belong to the letting
  tenancy_agreement: "documents.tenancyAgreement",
  deposit_certificate: "documents.depositCertificate",
  deposit_prescribed_info: "documents.depositPrescribedInfo",
  renters_rights_info: "documents.rentersRightsInfo",
  inventory_report: "documents.inventoryReport",
  handbook: "documents.handbook",
  // Belong to the property
  gas_safety: "documents.gasSafety",
  epc: "documents.epc",
  eicr: "documents.eicr",
  hmo_licence: "documents.hmoLicence",
  legionella_assessment: "documents.legionellaAssessment",
  fire_safety: "documents.fireSafety",
  other: "documents.other",
};
