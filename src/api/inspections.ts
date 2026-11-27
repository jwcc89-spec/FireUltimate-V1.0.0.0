/** Apparatus inspections API client. */
import { apiJson, send, type MaintenanceReadings } from "./maintenance";

export type InspectionResult = "OK" | "X" | "O" | "NA";

export const INSPECTION_RESULTS: { value: InspectionResult; label: string; title: string }[] = [
  { value: "OK", label: "OK", title: "OK" },
  { value: "X", label: "X", title: "Repair Needed" },
  { value: "O", label: "O", title: "Repair Made" },
  { value: "NA", label: "N/A", title: "Not Applicable" },
];

export interface InspectionSection {
  id: string;
  title: string;
  defaultNa?: boolean;
  items: InspectionItem[];
}

export interface InspectionItem {
  id: string;
  label: string;
  /** Set on Special Equipment rows that come from the Equipment List. */
  equipmentId?: string;
}

export interface InspectionTemplate {
  templateId: string;
  versionId: string;
  version: number;
  name: string;
  sections: InspectionSection[];
}

export interface InspectionItemResult {
  result: InspectionResult;
  note: string;
  /** Maintenance record opened for an X result. */
  recordId: string;
}

export type InspectionReadings = MaintenanceReadings & { generatorHours: number | null };

export interface InspectionDetails {
  officer: string;
  station: string;
  vehicleMake: string;
  readings: InspectionReadings;
  lastServiceMileage: number | null;
  lastServiceEngineHours: number | null;
  comments: string;
}

export interface InspectionSummary {
  id: string;
  submissionNumber: string;
  subjectRef: string;
  completedOn: string;
  completedByName: string;
  repairCount: number;
  status: string;
  readings: InspectionReadings;
  createdAt: string;
  createdBy: string;
}

export interface InspectionDetail extends InspectionSummary {
  details: InspectionDetails;
  results: Record<string, InspectionItemResult>;
  sections?: InspectionSection[];
}

export interface InspectionInput {
  subjectRef: string;
  completedOn: string;
  completedByName: string;
  results: Record<string, InspectionItemResult>;
  details: InspectionDetails;
  /** true = Save for later (bay iPad). false/omitted = Submit when everything required is filled. */
  draft?: boolean;
}

export interface OpenDeficiency {
  recordId: string;
  recordNumber: string;
  description: string;
  assetKind: "apparatus" | "equipment";
}

export const getInspectionTemplate = () => apiJson<InspectionTemplate>("/api/inspections/template");
export const getInspections = (unit?: string) =>
  apiJson<InspectionSummary[]>(`/api/inspections${unit ? `?unit=${encodeURIComponent(unit)}` : ""}`);
export const getInspection = (id: string) => apiJson<InspectionDetail>(`/api/inspections/${encodeURIComponent(id)}`);
export const createInspection = (input: InspectionInput) =>
  apiJson<InspectionDetail>("/api/inspections", send("POST", input));
export const updateInspection = (id: string, input: InspectionInput) =>
  apiJson<InspectionDetail>(`/api/inspections/${encodeURIComponent(id)}`, send("PATCH", input));
export const deleteInspection = (id: string) => apiJson<void>(`/api/inspections/${encodeURIComponent(id)}`, send("DELETE"));
export const getUnitEquipment = (unit: string) =>
  apiJson<InspectionItem[]>(`/api/inspections/unit-equipment?unit=${encodeURIComponent(unit)}`);
export const getOpenDeficiencies = (unit: string) =>
  apiJson<{ byItem: Record<string, OpenDeficiency>; deficiencies: OpenDeficiency[] }>(
    `/api/inspections/open-deficiencies?unit=${encodeURIComponent(unit)}`,
  );
