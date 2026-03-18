import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ChevronDown, Pencil, Trash2, Users } from "lucide-react";
import {
  getIncidentCallDetail,
  type IncidentCallSummary,
  type UserRole,
} from "../appData";
import { isAdminOrHigher } from "../roleHierarchy";
import {
  NERIS_REQUIRED_FIELD_MATRIX,
  NERIS_FORM_SECTIONS,
  createDefaultNerisFormValues,
  getNerisFieldsForSection,
  getNerisValueOptions,
  isNerisFieldRequired,
  validateNerisSection,
  type NerisFieldMetadata,
  type NerisFormValues,
  type NerisSectionId,
  type NerisValueOption,
} from "../nerisMetadata";
import {
  NerisFlatMultiOptionSelect,
  NerisFlatSingleOptionSelect,
} from "../NerisFlatSelects";
import { NerisGroupedOptionSelect } from "../NerisGroupedOptionSelect";

type PrintSummaryRow = { label: string; value: string };
type PrintSummarySection = { id: string; title: string; rows: PrintSummaryRow[] };

export interface NerisExportSettings {
  exportUrl: string;
  vendorCode: string;
  vendorHeaderName: string;
  secretKey: string;
  authHeaderName: string;
  authScheme: string;
  contentType: string;
  apiVersionHeaderName: string;
  apiVersionHeaderValue: string;
}

export interface NerisReportFormPageProps {
  callNumber: string;
  role: UserRole;
  username: string;
  incidentCalls: IncidentCallSummary[];
  onUpdateIncidentCall: (
    callNumber: string,
    patch: Partial<IncidentCallSummary>,
  ) => void;
  onDeleteIncidentCall: (callNumber: string, reason?: string) => void | Promise<void>;
  nerisExportSettings: NerisExportSettings;
  readNerisDraft: (callNumber: string) => NerisStoredDraft | null;
  writeNerisDraft: (callNumber: string, draft: NerisStoredDraft) => void;
  appendNerisExportRecord: (record: NerisExportRecord) => void;
  parseAssignedUnits: (value: string) => string[];
  inferResourceUnitTypeValue: (
    unitId: string,
    hintedUnitType: string | undefined,
    unitTypeOptions: NerisValueOption[],
  ) => string;
  getStaffingValueForUnit: (unitId: string, personnelCsv: string) => string;
  nextEmergingHazardItemId: (prefix: string) => string;
  nextRiskReductionSuppressionId: () => string;
  dedupeAndCleanStrings: (values: string[]) => string[];
  normalizeNerisEnumValue: (raw: string) => string;
  parseImportedLocationValues: (
    value: string,
    stateOptionValues: Set<string>,
    countryOptionValues: Set<string>,
  ) => ParsedImportedLocationValues;
  toResourceSummaryTime: (value: string) => string;
  toResourceDateTimeInputValue: (value: string, fallbackDate: string) => string;
  toResourceDateOnlyInputValue: (value: string, fallbackDate: string) => string;
  formatResourceDatePart: (value: string) => string;
  formatResourceTimePart: (value: string) => string;
  parseTimeInput24h: (value: string) => string;
  combineResourceDateTimeFromParts: (datePart: string, timePart: string) => string;
  toResourceDateTimeTimestamp: (value: string, fallbackDate: string) => number | null;
  addMinutesToResourceDateTime: (value: string, minutesToAdd: number) => string;
  resourceUnitValidationErrorKey: (
    unitEntryId: string,
    field:
      | "personnel"
      | "dispatchTime"
      | "enrouteTime"
      | "stagedTime"
      | "onSceneTime"
      | "canceledTime"
      | "clearTime",
  ) => string;
  countSelectedPersonnel: (personnelCsv: string) => number;
  readNerisExportHistory: () => NerisExportRecord[];
  toToneClass: (tone: "positive" | "warning" | "critical" | "neutral") => string;
  toneFromNerisStatus: (status: string) => "positive" | "warning" | "critical" | "neutral";
  togglePillValue: (currentValue: string, nextValue: string) => string;
  resourcePersonnelOptions: NerisValueOption[];
  riskReductionYesNoUnknownOptions: NerisValueOption[];
  riskReductionYesNoOptions: NerisValueOption[];
  riskReductionSmokeAlarmTypeOptions: NerisValueOption[];
  riskReductionFireAlarmTypeOptions: NerisValueOption[];
  riskReductionOtherAlarmTypeOptions: NerisValueOption[];
  riskReductionCookingSuppressionTypeOptions: NerisValueOption[];
  riskReductionSuppressionCoverageOptions: NerisValueOption[];
  nerisIncidentIdPattern: RegExp;
  nerisAidDepartmentIdPattern: RegExp;
  nerisProxyMappedFormFieldIds: Set<string>;
  getDefaultNerisExportSettings: () => NerisExportSettings;
  /** Apparatus from Admin Department Details (unit + unitType) for Resources unit-type auto-fill when incident has no apparatus. */
  apparatusFromDepartmentDetails?: { unit: string; unitType: string }[];
}

interface IncidentCompareRow {
  id: string;
  label: string;
  submittedValue: string;
  retrievedValue: string;
  status: "match" | "different";
  helpText?: string;
}

interface NerisDraftAidEntry {
  aidDirection: string;
  aidType: string;
  aidDepartment: string;
}

interface NerisDraftNonFdAidEntry {
  aidType: string;
}

interface NerisStoredDraft {
  formValues: NerisFormValues;
  reportStatus: string;
  lastSavedAt: string;
  additionalAidEntries: NerisDraftAidEntry[];
  additionalNonFdAidEntries: NerisDraftNonFdAidEntry[];
}

interface NerisExportRecord {
  id: string;
  callNumber: string;
  incidentType: string;
  address: string;
  exportedAtIso: string;
  exportedAtLabel: string;
  attemptStatus: "success" | "failed";
  httpStatus: number;
  httpStatusText: string;
  statusLabel: string;
  reportStatusAtExport: string;
  validatorName: string;
  reportWriterName: string;
  submittedEntityId: string;
  submittedDepartmentNerisId: string;
  nerisId: string;
  responseSummary: string;
  responseDetail: string;
  submittedPayloadPreview: string;
}

interface ParsedImportedLocationValues {
  locationState: string;
  locationCountry: string;
  locationPostalCode: string;
  locationCounty: string;
}

interface ResourceUnitEntry {
  id: string;
  unitId: string;
  unitType: string;
  staffing: string;
  responseMode: string;
  transportMode: string;
  dispatchTime: string;
  enrouteTime: string;
  stagedTime: string;
  onSceneTime: string;
  canceledTime: string;
  clearTime: string;
  isCanceledEnroute: boolean;
  isComplete: boolean;
  isExpanded: boolean;
  showTimesEditor: boolean;
  personnel: string;
  showPersonnelSelector: boolean;
  reportWriter: string;
  unitNarrative: string;
}

interface EmergingElectrocutionItem {
  id: string;
  electricalHazardType: string;
  suppressionMethods: string;
}

interface EmergingPowerGenerationItem {
  id: string;
  photovoltaicHazardType: string;
  pvSourceTarget: string;
  suppressionMethods: string;
}

interface FireSuppressionSystemEntry {
  id: string;
  suppressionType: string;
  suppressionCoverage: string;
}

const CORE_SECTION_FIELD_HEADERS: Record<string, string> = {
  incident_neris_id: "INCIDENT",
  fd_neris_id: "DISPATCH",
  incident_people_present: "PEOPLE / DISPLACEMENT",
  incident_has_aid: "AID GIVEN / RECEIVED",
};

interface AidEntry {
  aidDirection: string;
  aidType: string;
  aidDepartment: string;
}

interface NonFdAidEntry {
  aidType: string;
}

interface ValidationModalState {
  mode: "issues" | "checkSuccess" | "adminConfirm" | "adminSuccess";
  issues: string[];
}

const EMPTY_AID_ENTRY: AidEntry = {
  aidDirection: "",
  aidType: "",
  aidDepartment: "",
};

const EMPTY_NONFD_AID_ENTRY: NonFdAidEntry = {
  aidType: "",
};

function AddUnitControl({
  apparatusFromDept,
  resourceUnits,
  onAdd,
}: {
  apparatusFromDept: { unit: string; unitType: string }[];
  resourceUnits: ResourceUnitEntry[];
  onAdd: (unitId: string) => void;
}) {
  const existing = new Set(resourceUnits.map((r) => r.unitId.trim()).filter(Boolean));
  const available = apparatusFromDept.filter((a) => a.unit.trim() && !existing.has(a.unit.trim()));
  const [selectedUnit, setSelectedUnit] = useState("");
  const [customUnit, setCustomUnit] = useState("");
  const handleAdd = () => {
    const toAdd = (selectedUnit || customUnit.trim()).trim();
    if (!toAdd) return;
    onAdd(toAdd);
    setSelectedUnit("");
    setCustomUnit("");
  };
  return (
    <div className="neris-resource-add-unit-control">
      <select
        id="neris-add-unit-select"
        value={selectedUnit}
        onChange={(e) => setSelectedUnit(e.target.value)}
        className="neris-resource-add-unit-select"
      >
        <option value="">Select unit…</option>
        {available.map((a) => (
          <option key={a.unit} value={a.unit}>
            {a.unit} {a.unitType ? `(${a.unitType})` : ""}
          </option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Or type unit ID"
        value={customUnit}
        onChange={(e) => setCustomUnit(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
        className="neris-resource-add-unit-input"
      />
      <button type="button" className="primary-button compact-button" onClick={handleAdd}>
        Add
      </button>
    </div>
  );
}

function NerisReportFormPage({
  callNumber,
  role,
  username,
  incidentCalls,
  onUpdateIncidentCall,
  onDeleteIncidentCall,
  nerisExportSettings,
  readNerisDraft,
  writeNerisDraft,
  appendNerisExportRecord,
  parseAssignedUnits,
  inferResourceUnitTypeValue,
  getStaffingValueForUnit,
  nextEmergingHazardItemId,
  nextRiskReductionSuppressionId,
  dedupeAndCleanStrings,
  normalizeNerisEnumValue,
  parseImportedLocationValues,
  toResourceSummaryTime,
  toResourceDateTimeInputValue,
  formatResourceDatePart,
  formatResourceTimePart,
  parseTimeInput24h,
  combineResourceDateTimeFromParts,
  toResourceDateTimeTimestamp,
  addMinutesToResourceDateTime,
  resourceUnitValidationErrorKey,
  countSelectedPersonnel,
  readNerisExportHistory,
  toToneClass,
  toneFromNerisStatus,
  togglePillValue,
  resourcePersonnelOptions: RESOURCE_PERSONNEL_OPTIONS,
  riskReductionYesNoUnknownOptions: RISK_REDUCTION_YES_NO_UNKNOWN_OPTIONS,
  riskReductionYesNoOptions: RISK_REDUCTION_YES_NO_OPTIONS,
  riskReductionSmokeAlarmTypeOptions: RISK_REDUCTION_SMOKE_ALARM_TYPE_OPTIONS,
  riskReductionFireAlarmTypeOptions: RISK_REDUCTION_FIRE_ALARM_TYPE_OPTIONS,
  riskReductionOtherAlarmTypeOptions: RISK_REDUCTION_OTHER_ALARM_TYPE_OPTIONS,
  riskReductionCookingSuppressionTypeOptions: RISK_REDUCTION_COOKING_SUPPRESSION_TYPE_OPTIONS,
  riskReductionSuppressionCoverageOptions: RISK_REDUCTION_SUPPRESSION_COVERAGE_OPTIONS,
  nerisIncidentIdPattern: NERIS_INCIDENT_ID_PATTERN,
  nerisAidDepartmentIdPattern: NERIS_AID_DEPARTMENT_ID_PATTERN,
  nerisProxyMappedFormFieldIds: NERIS_PROXY_MAPPED_FORM_FIELD_IDS,
  getDefaultNerisExportSettings,
  apparatusFromDepartmentDetails,
}: NerisReportFormPageProps) {
  const navigate = useNavigate();
  const detail =
    getIncidentCallDetail(callNumber) ??
    (() => {
      const summary = incidentCalls.find(
        (entry) => entry.callNumber === callNumber && !entry.deletedAt,
      );
      if (!summary) {
        return null;
      }
      const assignedList = summary.assignedUnits
        ? parseAssignedUnits(summary.assignedUnits)
        : [];
      const apparatusFromAssigned = assignedList.map((unit) => ({
        unit,
        unitType: "",
        status: "",
        crew: "",
        eta: "",
      }));
      return {
        ...summary,
        mapReference: "Pending GIS sync",
        reportedBy: "Manual entry",
        callbackNumber: "",
        apparatus: apparatusFromAssigned,
        dispatchNotes: [],
      };
    })();
  const detailForSideEffects = detail ?? {
    callNumber,
    incidentType: "",
    address: "",
    receivedAt: "",
    assignedUnits: "",
  };
  const persistedDraft = useMemo(() => readNerisDraft(callNumber), [callNumber, readNerisDraft]);
  const defaultFormValues = useMemo(
    () =>
      createDefaultNerisFormValues({
        callNumber: String(detail?.callNumber ?? callNumber).trim() || callNumber,
        incidentInternalId:
          String(
            detail?.incident_internal_id ??
              detail?.incidentNumber ??
              detail?.callNumber ??
              callNumber,
          ).trim() || callNumber,
        dispatchInternalId:
          String(detail?.dispatch_internal_id ?? detail?.dispatchNumber ?? "").trim() || "",
        incidentType: detail?.incidentType,
        receivedAt: detail?.receivedAt,
        address: detail?.address,
      }),
    [
      callNumber,
      detail?.incidentType,
      detail?.receivedAt,
      detail?.address,
      detail?.callNumber,
      detail?.incident_internal_id,
      detail?.incidentNumber,
      detail?.dispatch_internal_id,
      detail?.dispatchNumber,
    ],
  );
  const [activeSectionId, setActiveSectionId] = useState<NerisSectionId>("core");
  const [reportStatus, setReportStatus] = useState<string>(() =>
    persistedDraft?.reportStatus ?? "Draft",
  );
  const isLocked =
    reportStatus === "In Review" || reportStatus === "Exported";
  const canEdit = !isLocked || isAdminOrHigher(role);
  const [formValues, setFormValues] = useState<NerisFormValues>(() => ({
    ...defaultFormValues,
    ...(persistedDraft?.formValues ?? {}),
  }));
  const lastSyncedIncidentIdPair = useRef("");
  const previousIncidentIdPair = useRef("");
  const hasInitializedIncidentIdSync = useRef(false);

  useEffect(() => {
    const incidentInternalId = String(formValues.incident_internal_id ?? "").trim();
    const dispatchInternalId = String(formValues.dispatch_internal_id ?? "").trim();
    const syncPair = `${incidentInternalId}::${dispatchInternalId}`;
    if (!hasInitializedIncidentIdSync.current) {
      hasInitializedIncidentIdSync.current = true;
      previousIncidentIdPair.current = syncPair;
      lastSyncedIncidentIdPair.current = syncPair;
      return;
    }
    if (previousIncidentIdPair.current === syncPair) {
      return;
    }
    previousIncidentIdPair.current = syncPair;
    if (lastSyncedIncidentIdPair.current === syncPair) {
      return;
    }
    const detailIncidentInternalId = String(
      detail?.incident_internal_id ?? detail?.incidentNumber ?? "",
    ).trim();
    const detailDispatchInternalId = String(
      detail?.dispatch_internal_id ?? detail?.dispatchNumber ?? "",
    ).trim();
    if (
      detailIncidentInternalId === incidentInternalId &&
      detailDispatchInternalId === dispatchInternalId
    ) {
      lastSyncedIncidentIdPair.current = syncPair;
      return;
    }
    onUpdateIncidentCall(callNumber, {
      incident_internal_id: incidentInternalId,
      dispatch_internal_id: dispatchInternalId,
      incidentNumber: incidentInternalId,
      dispatchNumber: dispatchInternalId,
    });
    lastSyncedIncidentIdPair.current = syncPair;
  }, [
    callNumber,
    detail?.dispatchNumber,
    detail?.dispatch_internal_id,
    detail?.incidentNumber,
    detail?.incident_internal_id,
    formValues.dispatch_internal_id,
    formValues.incident_internal_id,
    onUpdateIncidentCall,
  ]);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [validationModal, setValidationModal] = useState<ValidationModalState | null>(
    null,
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [printSummaryOpen, setPrintSummaryOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isFetchingIncidentTest, setIsFetchingIncidentTest] = useState(false);
  const [incidentTestResponseDetail, setIncidentTestResponseDetail] = useState("");
  const [incidentCompareRows, setIncidentCompareRows] = useState<IncidentCompareRow[]>([]);
  const [unmappedFilledFieldLabels, setUnmappedFilledFieldLabels] = useState<string[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<string>(
    () => persistedDraft?.lastSavedAt ?? "Not saved",
  );
  const [additionalAidEntries, setAdditionalAidEntries] = useState<AidEntry[]>(() =>
    (persistedDraft?.additionalAidEntries ?? []).map((entry) => ({
      aidDirection: entry.aidDirection,
      aidType: entry.aidType,
      aidDepartment: entry.aidDepartment,
    })),
  );
  const [additionalNonFdAidEntries, setAdditionalNonFdAidEntries] = useState<NonFdAidEntry[]>(() =>
    (persistedDraft?.additionalNonFdAidEntries ?? []).map((entry) => ({
      aidType: entry.aidType,
    })),
  );
  const [pendingAdditionalAid, setPendingAdditionalAid] = useState<"fd" | "nonfd" | null>(null);
  const [personnelOptionsFromApi, setPersonnelOptionsFromApi] = useState<NerisValueOption[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; users?: Array<{ id?: string; username?: string; name?: string }> } | null) => {
        if (cancelled || !data?.ok || !data?.users || !Array.isArray(data.users)) {
          return;
        }
        const options: NerisValueOption[] = data.users
          .filter((u) => String(u?.username ?? "").trim().length > 0)
          .map((u) => ({
            value: String(u.username ?? u.id ?? "").trim(),
            label: String(u.name ?? u.username ?? "").trim() || String(u.username ?? "").trim(),
          }))
          .filter((o) => o.value.length > 0);
        setPersonnelOptionsFromApi(options);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const effectivePersonnelOptions = personnelOptionsFromApi ?? RESOURCE_PERSONNEL_OPTIONS;
  const [aidDepartmentOptions, setAidDepartmentOptions] = useState<NerisValueOption[]>(() =>
    getNerisValueOptions("aid_department"),
  );
  const [showDirectionOfTravelField, setShowDirectionOfTravelField] = useState<boolean>(
    () =>
      (persistedDraft?.formValues.location_direction_of_travel ?? "").trim().length >
      0,
  );
  const [showCrossStreetTypeField, setShowCrossStreetTypeField] = useState<boolean>(
    () =>
      (persistedDraft?.formValues.location_cross_street_type ?? "").trim().length > 0 ||
      (persistedDraft?.formValues.location_cross_street_name ?? "").trim().length > 0,
  );
  const locationStateOptionValues = useMemo(
    () => new Set(getNerisValueOptions("state").map((option) => option.value)),
    [],
  );
  const locationCountryOptionValues = useMemo(
    () => new Set(getNerisValueOptions("country").map((option) => option.value)),
    [],
  );
  const responseModeOptions = useMemo(() => getNerisValueOptions("response_mode"), []);
  const unitTypeOptions = useMemo(() => getNerisValueOptions("unit_type"), []);
  const resourceFallbackDate = (formValues.incident_onset_date ?? "").trim() || "2026-02-18";
  const apparatusFromDept = useMemo(
    () => apparatusFromDepartmentDetails ?? [],
    [apparatusFromDepartmentDetails],
  );
  const availableResourceUnitOptions = useMemo(() => {
    const fromDetail =
      detail?.apparatus?.map((a) => a.unit) ?? [];
    const fromAssigned = detail ? parseAssignedUnits(detail.assignedUnits) : [];
    const fromDept = apparatusFromDept.map((a) => a.unit);
    const units = dedupeAndCleanStrings([...fromDetail, ...fromAssigned, ...fromDept]);
    return units.map((unitId) => ({
      value: unitId,
      label: unitId,
    }));
  }, [dedupeAndCleanStrings, detail, parseAssignedUnits, apparatusFromDept]);
  const apparatusByResourceUnitId = useMemo(() => {
    const map = new Map<string, { unitType: string }>();
    for (const a of apparatusFromDept) {
      map.set(a.unit, { unitType: a.unitType });
    }
    if (detail?.apparatus) {
      for (const apparatus of detail.apparatus) {
        map.set(apparatus.unit, { unitType: apparatus.unitType });
      }
    }
    return map;
  }, [detail, apparatusFromDept]);
  const defaultResourceUnits = useMemo<ResourceUnitEntry[]>(() => {
    if (!availableResourceUnitOptions.length) {
      return [];
    }

    return availableResourceUnitOptions.map((option, index) => {
      const source = apparatusByResourceUnitId.get(option.value);
      return {
        id: `resource-${index}-${option.value.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
        unitId: option.value,
        unitType: inferResourceUnitTypeValue(option.value, source?.unitType, unitTypeOptions),
        staffing: getStaffingValueForUnit(option.value, ""),
        responseMode: "",
        transportMode: "",
        dispatchTime: toResourceDateTimeInputValue(detail?.receivedAt ?? "", resourceFallbackDate),
        enrouteTime: "",
        stagedTime: "",
        onSceneTime: "",
        canceledTime: "",
        clearTime: "",
        isCanceledEnroute: false,
        isComplete: false,
        isExpanded: index === 0,
        showTimesEditor: false,
        personnel: "",
        showPersonnelSelector: false,
        reportWriter: "",
        unitNarrative: "",
      };
    });
  }, [
    availableResourceUnitOptions,
    apparatusByResourceUnitId,
    unitTypeOptions,
    detail?.receivedAt,
    resourceFallbackDate,
    inferResourceUnitTypeValue,
    getStaffingValueForUnit,
    toResourceDateTimeInputValue,
  ]);
  const persistedResourceUnits = useMemo<ResourceUnitEntry[]>(() => {
    const rawValue = persistedDraft?.formValues.resource_units_json;
    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue) as Array<Partial<ResourceUnitEntry>>;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map((item, index) => {
        const unitId = item.unitId?.trim() ?? "";
        const personnel = item.personnel?.trim() ?? "";
        const normalizedUnitType =
          item.unitType?.trim() ??
          inferResourceUnitTypeValue(unitId, undefined, unitTypeOptions);
        return {
          id:
            item.id?.trim() ||
            `resource-persisted-${index}-${unitId.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
          unitId,
          unitType: normalizedUnitType,
          staffing: getStaffingValueForUnit(unitId, personnel),
          responseMode: item.responseMode?.trim() ?? "",
          transportMode: item.transportMode?.trim() ?? "",
          dispatchTime: toResourceDateTimeInputValue(
            item.dispatchTime?.trim() ?? detail?.receivedAt ?? "",
            resourceFallbackDate,
          ),
          enrouteTime: toResourceDateTimeInputValue(
            item.enrouteTime?.trim() ?? "",
            resourceFallbackDate,
          ),
          stagedTime: toResourceDateTimeInputValue(
            item.stagedTime?.trim() ?? "",
            resourceFallbackDate,
          ),
          onSceneTime: toResourceDateTimeInputValue(
            item.onSceneTime?.trim() ?? "",
            resourceFallbackDate,
          ),
          canceledTime: toResourceDateTimeInputValue(
            item.canceledTime?.trim() ?? "",
            resourceFallbackDate,
          ),
          clearTime: toResourceDateTimeInputValue(item.clearTime?.trim() ?? "", resourceFallbackDate),
          isCanceledEnroute: Boolean(item.isCanceledEnroute),
          isComplete: Boolean(item.isComplete),
          isExpanded: Boolean(item.isExpanded),
          showTimesEditor: Boolean(item.showTimesEditor),
          personnel,
          showPersonnelSelector: Boolean(item.showPersonnelSelector),
          reportWriter: item.reportWriter?.trim() ?? "",
          unitNarrative: item.unitNarrative ?? "",
        };
      });
    } catch {
      return [];
    }
  }, [
    persistedDraft?.formValues.resource_units_json,
    detail?.receivedAt,
    unitTypeOptions,
    resourceFallbackDate,
    inferResourceUnitTypeValue,
    getStaffingValueForUnit,
    toResourceDateTimeInputValue,
  ]);
  const [resourceUnits, setResourceUnits] = useState<ResourceUnitEntry[]>(
    () => (persistedResourceUnits.length ? persistedResourceUnits : defaultResourceUnits),
  );
  const [emergingElectrocutionItems, setEmergingElectrocutionItems] = useState<
    EmergingElectrocutionItem[]
  >(() => {
    const stored = persistedDraft?.formValues.emerging_haz_electrocution_items_json;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Array<{
          electricalHazardType?: string;
          suppressionMethods?: string;
        }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item) => ({
            id: nextEmergingHazardItemId("electrocution"),
            electricalHazardType: item.electricalHazardType?.trim() ?? "",
            suppressionMethods: item.suppressionMethods?.trim() ?? "",
          }));
        }
      } catch {
        // Ignore malformed persisted values and fall back to legacy fields.
      }
    }

    const legacyElectricalHazardType =
      persistedDraft?.formValues.emerg_haz_electric_type?.trim() ?? "";
    const legacySuppressionMethods =
      persistedDraft?.formValues.emerg_haz_suppression_methods?.trim() ?? "";
    if (legacyElectricalHazardType || legacySuppressionMethods) {
      return [
        {
          id: nextEmergingHazardItemId("electrocution"),
          electricalHazardType: legacyElectricalHazardType,
          suppressionMethods: legacySuppressionMethods,
        },
      ];
    }

    return [];
  });
  const [emergingPowerGenerationItems, setEmergingPowerGenerationItems] = useState<
    EmergingPowerGenerationItem[]
  >(() => {
    const stored = persistedDraft?.formValues.emerging_haz_power_generation_items_json;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Array<{
          photovoltaicHazardType?: string;
          pvSourceTarget?: string;
          suppressionMethods?: string;
        }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item) => ({
            id: nextEmergingHazardItemId("power-generation"),
            photovoltaicHazardType: item.photovoltaicHazardType?.trim() ?? "",
            pvSourceTarget: item.pvSourceTarget?.trim() ?? "",
            suppressionMethods: item.suppressionMethods?.trim() ?? "",
          }));
        }
      } catch {
        // Ignore malformed persisted values and fall back to legacy fields.
      }
    }

    const legacyPvHazardType = persistedDraft?.formValues.emerg_haz_pv_type?.trim() ?? "";
    const legacyPvSourceTarget =
      persistedDraft?.formValues.emerg_haz_pv_source_target?.trim() ?? "";
    const legacySuppressionMethods =
      persistedDraft?.formValues.emerg_haz_suppression_methods?.trim() ?? "";
    if (legacyPvHazardType || legacyPvSourceTarget || legacySuppressionMethods) {
      return [
        {
          id: nextEmergingHazardItemId("power-generation"),
          photovoltaicHazardType: legacyPvHazardType,
          pvSourceTarget: legacyPvSourceTarget,
          suppressionMethods: legacySuppressionMethods,
        },
      ];
    }

    return [];
  });
  const pvSourceTargetOptions = useMemo(
    () =>
      getNerisValueOptions("source_target").filter((option) =>
        ["SOURCE", "TARGET", "UNKNOWN"].includes(option.value),
      ),
    [],
  );
  const [riskReductionSuppressionSystems, setRiskReductionSuppressionSystems] = useState<
    FireSuppressionSystemEntry[]
  >(() => {
    const stored = persistedDraft?.formValues.risk_reduction_fire_suppression_systems_json;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Array<{
          suppressionType?: string;
          suppressionCoverage?: string;
        }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item) => ({
            id: nextRiskReductionSuppressionId(),
            suppressionType: item.suppressionType?.trim() ?? "",
            suppressionCoverage: item.suppressionCoverage?.trim() ?? "",
          }));
        }
      } catch {
        // Ignore malformed persisted values and fall back to legacy fields.
      }
    }

    const legacySuppressionType = persistedDraft?.formValues.fire_suppression_types?.trim() ?? "";
    const legacySuppressionCoverage =
      persistedDraft?.formValues.fire_suppression_operation?.trim() ?? "";
    if (legacySuppressionType || legacySuppressionCoverage) {
      return [
        {
          id: nextRiskReductionSuppressionId(),
          suppressionType: legacySuppressionType,
          suppressionCoverage: legacySuppressionCoverage,
        },
      ];
    }

    return [];
  });
  const riskReductionCompletedValue = (formValues.risk_reduction_completed ?? "").trim();
  const riskReductionFollowUpValue = (formValues.risk_reduction_follow_up_required ?? "").trim();
  const riskReductionContactMadeValue = (formValues.risk_reduction_contacts_made ?? "").trim();
  const riskReductionSmokeAlarmPresentValue = (
    formValues.risk_reduction_smoke_alarm_present ?? ""
  ).trim();
  const riskReductionSmokeAlarmWorkingValue = (
    formValues.risk_reduction_smoke_alarm_working ?? ""
  ).trim();
  const riskReductionFireAlarmPresentValue = (
    formValues.risk_reduction_fire_alarm_present ?? ""
  ).trim();
  const riskReductionOtherAlarmPresentValue = (
    formValues.risk_reduction_other_alarm_present ?? ""
  ).trim();
  const riskReductionFireSuppressionPresentValue = (
    formValues.risk_reduction_fire_suppression_present ?? ""
  ).trim();
  const riskReductionCookingSuppressionPresentValue = (
    formValues.risk_reduction_cooking_suppression_present ?? ""
  ).trim();
  const [activeResourcePersonnelUnitId, setActiveResourcePersonnelUnitId] = useState<string | null>(
    null,
  );
  /** While user is typing a resource time, hold raw value so cursor doesn't jump (parse on blur). */
  const [resourceTimeDraft, setResourceTimeDraft] = useState<{ key: string; value: string } | null>(
    null,
  );
  const activeResourcePersonnelUnit = useMemo(
    () =>
      activeResourcePersonnelUnitId
        ? resourceUnits.find((unit) => unit.id === activeResourcePersonnelUnitId) ?? null
        : null,
    [activeResourcePersonnelUnitId, resourceUnits],
  );
  const personnelAssignedToOtherUnits = useMemo(() => {
    if (!activeResourcePersonnelUnitId) {
      return new Set<string>();
    }
    const assigned = new Set<string>();
    resourceUnits.forEach((unit) => {
      if (unit.id === activeResourcePersonnelUnitId) {
        return;
      }
      unit.personnel
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .forEach((entry) => assigned.add(entry));
    });
    return assigned;
  }, [activeResourcePersonnelUnitId, resourceUnits]);

  useEffect(() => {
    if (persistedResourceUnits.length) {
      return;
    }
    setResourceUnits(defaultResourceUnits);
  }, [defaultResourceUnits, persistedResourceUnits.length]);

  useEffect(() => {
    if (activeResourcePersonnelUnitId && !activeResourcePersonnelUnit) {
      setActiveResourcePersonnelUnitId(null);
    }
  }, [activeResourcePersonnelUnitId, activeResourcePersonnelUnit]);

  useEffect(() => {
    const className = "resource-personnel-modal-open";
    if (activeResourcePersonnelUnitId) {
      document.body.classList.add(className);
    } else {
      document.body.classList.remove(className);
    }
    return () => {
      document.body.classList.remove(className);
    };
  }, [activeResourcePersonnelUnitId]);

  useEffect(() => {
    const serializedElectrocutionItems = JSON.stringify(
      emergingElectrocutionItems.map((item) => ({
        electricalHazardType: item.electricalHazardType,
        suppressionMethods: item.suppressionMethods,
      })),
    );
    const serializedPowerGenerationItems = JSON.stringify(
      emergingPowerGenerationItems.map((item) => ({
        photovoltaicHazardType: item.photovoltaicHazardType,
        pvSourceTarget: item.pvSourceTarget,
        suppressionMethods: item.suppressionMethods,
      })),
    );
    const primaryElectrocutionItem = emergingElectrocutionItems[0];
    const primaryPowerGenerationItem = emergingPowerGenerationItems[0];
    const defaultSuppressionMethods =
      primaryElectrocutionItem?.suppressionMethods ||
      primaryPowerGenerationItem?.suppressionMethods ||
      "";

    setFormValues((previous) => {
      if (
        (previous.emerging_haz_electrocution_items_json ?? "") ===
          serializedElectrocutionItems &&
        (previous.emerging_haz_power_generation_items_json ?? "") ===
          serializedPowerGenerationItems &&
        (previous.emerg_haz_electric_type ?? "") ===
          (primaryElectrocutionItem?.electricalHazardType ?? "") &&
        (previous.emerg_haz_pv_type ?? "") ===
          (primaryPowerGenerationItem?.photovoltaicHazardType ?? "") &&
        (previous.emerg_haz_pv_source_target ?? "") ===
          (primaryPowerGenerationItem?.pvSourceTarget ?? "") &&
        (previous.emerg_haz_suppression_methods ?? "") === defaultSuppressionMethods
      ) {
        return previous;
      }

      return {
        ...previous,
        emerging_haz_electrocution_items_json: serializedElectrocutionItems,
        emerging_haz_power_generation_items_json: serializedPowerGenerationItems,
        emerg_haz_electric_type: primaryElectrocutionItem?.electricalHazardType ?? "",
        emerg_haz_pv_type: primaryPowerGenerationItem?.photovoltaicHazardType ?? "",
        emerg_haz_pv_source_target: primaryPowerGenerationItem?.pvSourceTarget ?? "",
        emerg_haz_suppression_methods: defaultSuppressionMethods,
      };
    });
  }, [emergingElectrocutionItems, emergingPowerGenerationItems]);

  useEffect(() => {
    const serializedSuppressionSystems = JSON.stringify(
      riskReductionSuppressionSystems.map((system) => ({
        suppressionType: system.suppressionType,
        suppressionCoverage: system.suppressionCoverage,
      })),
    );
    const primarySuppressionSystem = riskReductionSuppressionSystems[0];

    setFormValues((previous) => {
      if (
        (previous.risk_reduction_fire_suppression_systems_json ?? "") ===
          serializedSuppressionSystems &&
        (previous.fire_suppression_types ?? "") ===
          (primarySuppressionSystem?.suppressionType ?? "") &&
        (previous.fire_suppression_operation ?? "") ===
          (primarySuppressionSystem?.suppressionCoverage ?? "")
      ) {
        return previous;
      }

      return {
        ...previous,
        risk_reduction_fire_suppression_systems_json: serializedSuppressionSystems,
        fire_suppression_types: primarySuppressionSystem?.suppressionType ?? "",
        fire_suppression_operation: primarySuppressionSystem?.suppressionCoverage ?? "",
      };
    });
  }, [riskReductionSuppressionSystems]);

  const primaryIncidentCategory = useMemo(() => {
    const normalizedPrimaryIncidentType = normalizeNerisEnumValue(
      formValues.primary_incident_type ?? "",
    );
    return (
      normalizedPrimaryIncidentType
        .split("||")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0)[0] ?? ""
    );
  }, [formValues.primary_incident_type, normalizeNerisEnumValue]);
  const visibleNerisSections = useMemo(
    () =>
      NERIS_FORM_SECTIONS.filter((section) => {
        if (section.id === "fire") {
          return primaryIncidentCategory === "FIRE";
        }
        if (section.id === "medical") {
          return primaryIncidentCategory === "MEDICAL";
        }
        if (section.id === "hazards") {
          return (
            primaryIncidentCategory === "HAZSIT" || primaryIncidentCategory === "HAZMAT"
          );
        }
        return true;
      }),
    [primaryIncidentCategory],
  );
  const activeVisibleSectionId =
    visibleNerisSections.find((section) => section.id === activeSectionId)?.id ??
    visibleNerisSections[0]?.id ??
    "core";
  const currentSection =
    visibleNerisSections.find((section) => section.id === activeVisibleSectionId) ??
    visibleNerisSections[0] ??
    NERIS_FORM_SECTIONS[0]!;
  const sectionFields = useMemo(
    () => getNerisFieldsForSection(currentSection.id),
    [currentSection.id],
  );
  const displayedSectionFields = useMemo(() => {
    if (currentSection.id !== "location") {
      return sectionFields;
    }

    const locationFieldOrder = new Map<string, number>([
      ["location_state", 1],
      ["location_country", 2],
      ["location_postal_code", 3],
      ["location_county", 4],
      ["location_place_type", 5],
      ["location_use_primary", 6],
      ["location_use_secondary", 7],
      ["location_in_use", 8],
      ["location_used_as_intended", 9],
      ["location_vacancy_cause", 10],
      ["location_direction_of_travel", 11],
      ["location_cross_street_type", 12],
      ["location_cross_street_name", 13],
      ["location_notes", 14],
    ]);

    return [...sectionFields].sort((left, right) => {
      const leftOrder = locationFieldOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = locationFieldOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    });
  }, [currentSection.id, sectionFields]);
  const allNerisFields = useMemo(
    () => NERIS_FORM_SECTIONS.flatMap((section) => getNerisFieldsForSection(section.id)),
    [],
  );
  const nerisFieldLabelById = useMemo(
    () =>
      Object.fromEntries(allNerisFields.map((field) => [field.id, field.label])) as Record<
        string,
        string
      >,
    [allNerisFields],
  );
  const nerisFieldSectionById = useMemo(
    () =>
      Object.fromEntries(
        allNerisFields.map((field) => [field.id, field.sectionId]),
      ) as Record<string, NerisSectionId>,
    [allNerisFields],
  );
  const nerisSectionLabelById = useMemo(
    () =>
      Object.fromEntries(
        NERIS_FORM_SECTIONS.map((section) => [section.id, section.label.toUpperCase()]),
      ) as Record<NerisSectionId, string>,
    [],
  );
  const requiredMatrixRows = useMemo(() => {
    const coreRows = NERIS_REQUIRED_FIELD_MATRIX.coreMinimum.map((fieldId) => ({
      fieldId,
      label: nerisFieldLabelById[fieldId] ?? fieldId,
    }));
    const familyRows =
      primaryIncidentCategory in NERIS_REQUIRED_FIELD_MATRIX.byIncidentFamily
        ? NERIS_REQUIRED_FIELD_MATRIX.byIncidentFamily[
            primaryIncidentCategory as keyof typeof NERIS_REQUIRED_FIELD_MATRIX.byIncidentFamily
          ].map((fieldId) => ({
            fieldId,
            label: nerisFieldLabelById[fieldId] ?? fieldId,
          }))
        : [];
    return {
      coreRows,
      familyRows,
    };
  }, [nerisFieldLabelById, primaryIncidentCategory]);
  const sectionIndex = visibleNerisSections.findIndex(
    (section) => section.id === currentSection.id,
  );
  const hasNextSection =
    sectionIndex >= 0 && sectionIndex < visibleNerisSections.length - 1;
  const importedLocationAddress =
    (formValues.incident_location_address ?? "").trim() ||
    (formValues.dispatch_location_address ?? "").trim() ||
    detail?.address ||
    "No imported address available.";
  const parsedImportedLocation = useMemo(
    () =>
      parseImportedLocationValues(
        importedLocationAddress,
        locationStateOptionValues,
        locationCountryOptionValues,
      ),
    [
      importedLocationAddress,
      locationStateOptionValues,
      locationCountryOptionValues,
      parseImportedLocationValues,
    ],
  );

  useEffect(() => {
    let isCancelled = false;
    const fallbackOptions = getNerisValueOptions("aid_department");
    const exportUrl = (nerisExportSettings.exportUrl ?? "").trim();
    if (!exportUrl.startsWith("/api/neris/")) {
      setAidDepartmentOptions(fallbackOptions);
      return () => {
        isCancelled = true;
      };
    }

    const loadAidDepartmentOptions = async () => {
      try {
        const response = await fetch("/api/neris/debug/entities");
        const responseText = await response.text();
        if (!response.ok) {
          if (!isCancelled) {
            setAidDepartmentOptions(fallbackOptions);
          }
          return;
        }

        const parsed = (() => {
          if (!responseText) {
            return null;
          }
          try {
            return JSON.parse(responseText) as Record<string, unknown>;
          } catch {
            return null;
          }
        })();
        const neris =
          parsed?.neris && typeof parsed.neris === "object"
            ? (parsed.neris as Record<string, unknown>)
            : null;
        const entities = Array.isArray(neris?.entities) ? (neris?.entities as unknown[]) : [];
        const apiOptions = entities
          .map((entry) => {
            if (!entry || typeof entry !== "object") {
              return null;
            }
            const candidate = entry as Record<string, unknown>;
            const departmentId =
              typeof candidate.neris_id === "string" ? candidate.neris_id.trim() : "";
            if (!NERIS_AID_DEPARTMENT_ID_PATTERN.test(departmentId)) {
              return null;
            }
            const departmentName =
              typeof candidate.name === "string" && candidate.name.trim().length > 0
                ? candidate.name.trim()
                : departmentId;
            return {
              value: departmentId,
              label: `${departmentId} - ${departmentName}`,
            } as NerisValueOption;
          })
          .filter((option): option is NerisValueOption => Boolean(option));

        const requestedEntityId = (nerisExportSettings.vendorCode ?? "").trim();
        if (
          NERIS_AID_DEPARTMENT_ID_PATTERN.test(requestedEntityId) &&
          !apiOptions.some((option) => option.value === requestedEntityId)
        ) {
          apiOptions.unshift({
            value: requestedEntityId,
            label: `${requestedEntityId} - Current export department`,
          });
        }

        const dedupedOptions = Array.from(
          new Map(
            [...apiOptions, ...fallbackOptions].map((option) => [option.value, option]),
          ).values(),
        );
        if (!isCancelled) {
          setAidDepartmentOptions(dedupedOptions);
        }
      } catch {
        if (!isCancelled) {
          setAidDepartmentOptions(fallbackOptions);
        }
      }
    };

    void loadAidDepartmentOptions();

    return () => {
      isCancelled = true;
    };
  }, [nerisExportSettings.exportUrl, nerisExportSettings.vendorCode, NERIS_AID_DEPARTMENT_ID_PATTERN]);

  useEffect(() => {
    const vendorDepartmentCode = (nerisExportSettings.vendorCode ?? "").trim();
    if (!vendorDepartmentCode) {
      return;
    }
    if ((formValues.fd_neris_id ?? "").trim() === vendorDepartmentCode) {
      return;
    }
    setFormValues((previous) => {
      if ((previous.fd_neris_id ?? "").trim() === vendorDepartmentCode) {
        return previous;
      }
      return {
        ...previous,
        fd_neris_id: vendorDepartmentCode,
      };
    });
  }, [nerisExportSettings.vendorCode, formValues.fd_neris_id]);

  const updateFieldValue = (fieldId: string, value: string) => {
    const sanitizedValue =
      fieldId === "incident_displaced_number" ? value.replace(/[^\d]/g, "") : value;
    const shouldClearNoAction =
      fieldId === "incident_actions_taken" && sanitizedValue.trim().length > 0;
    const shouldClearActions =
      fieldId === "incident_noaction" && sanitizedValue.trim().length > 0;
    const shouldClearDisplacementCause =
      (fieldId === "incident_displaced_number" &&
        (sanitizedValue.trim().length === 0 ||
          Number.parseInt(sanitizedValue, 10) <= 0)) ||
      (fieldId === "incident_people_present" && sanitizedValue === "NO");
    const shouldClearLocationUsedAsIntended =
      fieldId === "location_in_use" && sanitizedValue !== "YES";
    const shouldClearAidFields =
      (fieldId === "incident_has_aid" && sanitizedValue === "NO") ||
      (fieldId === "incident_aid_agency_type" && sanitizedValue === "NON_FD_AID") ||
      (fieldId === "incident_aid_agency_type" && sanitizedValue === "FIRE_DEPARTMENT");
    setFormValues((previous) => {
      const nextValues: NerisFormValues = {
        ...previous,
        [fieldId]: sanitizedValue,
      };
      if (shouldClearNoAction) {
        nextValues.incident_noaction = "";
      }
      if (shouldClearActions) {
        nextValues.incident_actions_taken = "";
      }
      if (shouldClearDisplacementCause) {
        nextValues.incident_displaced_cause = "";
      }
      if (fieldId === "incident_people_present" && sanitizedValue === "NO") {
        nextValues.incident_displaced_number = "";
      }
      if (shouldClearLocationUsedAsIntended) {
        nextValues.location_used_as_intended = "";
      }
      if (fieldId === "incident_has_aid" && sanitizedValue === "NO") {
        nextValues.incident_aid_agency_type = "";
        nextValues.incident_aid_direction = "";
        nextValues.incident_aid_type = "";
        nextValues.incident_aid_department_name = "";
        nextValues.incident_aid_nonfd = "";
      }
      if (fieldId === "incident_aid_agency_type" && sanitizedValue === "NON_FD_AID") {
        nextValues.incident_aid_direction = "";
        nextValues.incident_aid_type = "";
        nextValues.incident_aid_department_name = "";
      }
      if (fieldId === "incident_aid_agency_type" && sanitizedValue === "FIRE_DEPARTMENT") {
        nextValues.incident_aid_nonfd = "";
      }
      return nextValues;
    });

    if (
      (fieldId === "incident_has_aid" && sanitizedValue === "NO") ||
      (fieldId === "incident_aid_agency_type" && sanitizedValue === "NON_FD_AID")
    ) {
      setAdditionalAidEntries([]);
      setPendingAdditionalAid(null);
    }
    if (
      (fieldId === "incident_has_aid" && sanitizedValue === "NO") ||
      (fieldId === "incident_aid_agency_type" && sanitizedValue === "FIRE_DEPARTMENT")
    ) {
      setAdditionalNonFdAidEntries([]);
      setPendingAdditionalAid(null);
    }

    setSectionErrors((previous) => {
      const hasPrimaryError = Boolean(previous[fieldId]);
      const hasNoActionError = shouldClearNoAction && Boolean(previous.incident_noaction);
      const hasActionsError = shouldClearActions && Boolean(previous.incident_actions_taken);
      const hasDisplacementCauseError =
        shouldClearDisplacementCause && Boolean(previous.incident_displaced_cause);
      const hasDisplacementNumberError =
        fieldId === "incident_people_present" &&
        sanitizedValue === "NO" &&
        Boolean(previous.incident_displaced_number);
      const hasLocationUsedAsIntendedError =
        shouldClearLocationUsedAsIntended && Boolean(previous.location_used_as_intended);
      const hasAidErrors =
        shouldClearAidFields &&
        (Boolean(previous.incident_aid_agency_type) ||
          Boolean(previous.incident_aid_direction) ||
          Boolean(previous.incident_aid_type) ||
          Boolean(previous.incident_aid_department_name) ||
          Boolean(previous.incident_aid_nonfd));
      if (
        !hasPrimaryError &&
        !hasNoActionError &&
        !hasActionsError &&
        !hasDisplacementCauseError &&
        !hasDisplacementNumberError &&
        !hasLocationUsedAsIntendedError &&
        !hasAidErrors
      ) {
        return previous;
      }
      const next = { ...previous };
      delete next[fieldId];
      if (shouldClearNoAction) {
        delete next.incident_noaction;
      }
      if (shouldClearActions) {
        delete next.incident_actions_taken;
      }
      if (shouldClearDisplacementCause) {
        delete next.incident_displaced_cause;
      }
      if (fieldId === "incident_people_present" && sanitizedValue === "NO") {
        delete next.incident_displaced_number;
      }
      if (shouldClearLocationUsedAsIntended) {
        delete next.location_used_as_intended;
      }
      if (shouldClearAidFields) {
        delete next.incident_aid_agency_type;
        delete next.incident_aid_direction;
        delete next.incident_aid_type;
        delete next.incident_aid_department_name;
        delete next.incident_aid_nonfd;
      }
      return next;
    });
    setSaveMessage("");
    setErrorMessage("");
    setValidationIssues([]);
    setValidationModal(null);
    if (reportStatus !== "Draft") {
      setReportStatus("Draft");
    }
  };

  useEffect(() => {
    const locationUpdates: Record<string, string> = {};
    if (
      (formValues.location_state ?? "").trim().length === 0 &&
      parsedImportedLocation.locationState
    ) {
      locationUpdates.location_state = parsedImportedLocation.locationState;
    }
    if (
      (formValues.location_country ?? "").trim().length === 0 &&
      parsedImportedLocation.locationCountry
    ) {
      locationUpdates.location_country = parsedImportedLocation.locationCountry;
    }
    if (
      (formValues.location_postal_code ?? "").trim().length === 0 &&
      parsedImportedLocation.locationPostalCode
    ) {
      locationUpdates.location_postal_code = parsedImportedLocation.locationPostalCode;
    }
    if (
      (formValues.location_county ?? "").trim().length === 0 &&
      parsedImportedLocation.locationCounty
    ) {
      locationUpdates.location_county = parsedImportedLocation.locationCounty;
    }

    if (Object.keys(locationUpdates).length === 0) {
      return;
    }

    setFormValues((previous) => ({
      ...previous,
      ...locationUpdates,
    }));
  }, [
    formValues.location_state,
    formValues.location_country,
    formValues.location_postal_code,
    formValues.location_county,
    parsedImportedLocation.locationState,
    parsedImportedLocation.locationCountry,
    parsedImportedLocation.locationPostalCode,
    parsedImportedLocation.locationCounty,
  ]);

  const handlePullLocationFromImportedAddress = () => {
    const locationUpdates: Record<string, string> = {};
    if (
      parsedImportedLocation.locationState &&
      parsedImportedLocation.locationState !== (formValues.location_state ?? "")
    ) {
      locationUpdates.location_state = parsedImportedLocation.locationState;
    }
    if (
      parsedImportedLocation.locationCountry &&
      parsedImportedLocation.locationCountry !== (formValues.location_country ?? "")
    ) {
      locationUpdates.location_country = parsedImportedLocation.locationCountry;
    }
    if (
      parsedImportedLocation.locationPostalCode &&
      parsedImportedLocation.locationPostalCode !== (formValues.location_postal_code ?? "")
    ) {
      locationUpdates.location_postal_code = parsedImportedLocation.locationPostalCode;
    }
    if (
      parsedImportedLocation.locationCounty &&
      parsedImportedLocation.locationCounty !== (formValues.location_county ?? "")
    ) {
      locationUpdates.location_county = parsedImportedLocation.locationCounty;
    }

    if (Object.keys(locationUpdates).length === 0) {
      setSaveMessage(
        "No additional state, country, postal code, or county details were found to apply.",
      );
      setErrorMessage("");
      return;
    }

    setFormValues((previous) => ({
      ...previous,
      ...locationUpdates,
    }));
    setSectionErrors((previous) => {
      const next = { ...previous };
      delete next.location_state;
      delete next.location_country;
      delete next.location_postal_code;
      delete next.location_county;
      return next;
    });
    setSaveMessage("Location details pulled from imported address.");
    setErrorMessage("");
    setValidationIssues([]);
    setValidationModal(null);
    if (reportStatus !== "Draft") {
      setReportStatus("Draft");
    }
  };

  const markNerisFormDirty = () => {
    setSaveMessage("");
    setErrorMessage("");
    setValidationIssues([]);
    setValidationModal(null);
    if (reportStatus !== "Draft") {
      setReportStatus("Draft");
    }
  };

  const clearResourceUnitValidationErrors = (unitEntryId: string) => {
    const keyPrefix = `resource_unit_validation_${unitEntryId}_`;
    setSectionErrors((previous) => {
      let hasMatch = false;
      const next: Record<string, string> = {};
      Object.entries(previous).forEach(([key, value]) => {
        if (key.startsWith(keyPrefix)) {
          hasMatch = true;
          return;
        }
        next[key] = value;
      });
      return hasMatch ? next : previous;
    });
  };

  const toValidationIssueLabel = (
    fieldId: string,
    customIssueLabelsByFieldId: Record<string, string>,
  ): string => {
    const customLabel = customIssueLabelsByFieldId[fieldId];
    if (customLabel) {
      return customLabel;
    }
    const sectionId = nerisFieldSectionById[fieldId];
    const sectionLabel = sectionId ? nerisSectionLabelById[sectionId] : "UNKNOWN";
    return `${sectionLabel} - ${nerisFieldLabelById[fieldId] ?? fieldId}`;
  };

  const validateResourceUnit = (unitEntry: ResourceUnitEntry, unitIndex: number) => {
    const unitLabel = unitEntry.unitId.trim() || `Unit ${unitIndex + 1}`;
    const errors: Record<string, string> = {};
    const customIssueLabelsByFieldId: Record<string, string> = {};
    const addResourceError = (
      field:
        | "personnel"
        | "dispatchTime"
        | "enrouteTime"
        | "stagedTime"
        | "onSceneTime"
        | "canceledTime"
        | "clearTime",
      fieldLabel: string,
      message: string,
    ) => {
      const errorKey = resourceUnitValidationErrorKey(unitEntry.id, field);
      errors[errorKey] = message;
      customIssueLabelsByFieldId[errorKey] = `Resources - ${unitLabel}: ${fieldLabel}`;
    };
    const addTimelineError = (
      entry: {
        key: string;
        label: string;
        customIssueLabel?: string;
      },
      message: string,
    ) => {
      errors[entry.key] = message;
      if (entry.customIssueLabel) {
        customIssueLabelsByFieldId[entry.key] = entry.customIssueLabel;
      }
    };

    if (countSelectedPersonnel(unitEntry.personnel) < 1) {
      addResourceError(
        "personnel",
        "Personnel",
        "At least one personnel member is required for each unit.",
      );
    }
    if (!unitEntry.dispatchTime.trim()) {
      addResourceError("dispatchTime", "Dispatch time", "Dispatch time is required.");
    }
    if (!unitEntry.clearTime.trim()) {
      addResourceError("clearTime", "Clear time", "Clear time is required.");
    }
    if (!unitEntry.isCanceledEnroute) {
      if (!unitEntry.enrouteTime.trim()) {
        addResourceError(
          "enrouteTime",
          "Enroute time",
          "Enroute time is required unless dispatched and canceled en route.",
        );
      }
      if (!unitEntry.onSceneTime.trim()) {
        addResourceError(
          "onSceneTime",
          "On Scene time",
          "On Scene time is required unless dispatched and canceled en route.",
        );
      }
    } else {
      if (!unitEntry.canceledTime.trim()) {
        addResourceError(
          "canceledTime",
          "Canceled time",
          "Canceled time is required when dispatched and canceled en route.",
        );
      }
      if (unitEntry.canceledTime.trim() && unitEntry.clearTime.trim()) {
        const canceledTs = toResourceDateTimeTimestamp(
          unitEntry.canceledTime,
          resourceFallbackDate,
        );
        const clearTs = toResourceDateTimeTimestamp(
          unitEntry.clearTime,
          resourceFallbackDate,
        );
        if (
          canceledTs !== null &&
          clearTs !== null &&
          canceledTs !== clearTs
        ) {
          addResourceError(
            "canceledTime",
            "Canceled time",
            "When dispatched and canceled en route, Canceled and Clear times must be the same.",
          );
          addResourceError(
            "clearTime",
            "Clear time",
            "When dispatched and canceled en route, Canceled and Clear times must be the same.",
          );
        }
      }
    }

    const timelineEntries = [
      {
        key: "incident_time_call_create",
        label: "Call created time",
        value: formValues.incident_time_call_create ?? "",
      },
      {
        key: "incident_time_call_answered",
        label: "Call answered time",
        value: formValues.incident_time_call_answered ?? "",
      },
      {
        key: "incident_time_call_arrival",
        label: "Call arrival time",
        value: formValues.incident_time_call_arrival ?? "",
      },
      {
        key: resourceUnitValidationErrorKey(unitEntry.id, "dispatchTime"),
        label: "Unit dispatched time",
        customIssueLabel: `Resources - ${unitLabel}: Dispatch time`,
        value: unitEntry.dispatchTime,
      },
      {
        key: resourceUnitValidationErrorKey(unitEntry.id, "enrouteTime"),
        label: "Unit enroute time",
        customIssueLabel: `Resources - ${unitLabel}: Enroute time`,
        value: unitEntry.enrouteTime,
      },
      {
        key: resourceUnitValidationErrorKey(unitEntry.id, "onSceneTime"),
        label: "Unit on scene time",
        customIssueLabel: `Resources - ${unitLabel}: On Scene time`,
        value: unitEntry.onSceneTime,
      },
      {
        key: resourceUnitValidationErrorKey(unitEntry.id, "stagedTime"),
        label: "Unit staged time",
        customIssueLabel: `Resources - ${unitLabel}: Staged time`,
        value: unitEntry.stagedTime,
      },
      {
        key: resourceUnitValidationErrorKey(unitEntry.id, "canceledTime"),
        label: "Unit canceled time",
        customIssueLabel: `Resources - ${unitLabel}: Canceled time`,
        value: unitEntry.canceledTime,
      },
      {
        key: resourceUnitValidationErrorKey(unitEntry.id, "clearTime"),
        label: "Unit clear time",
        customIssueLabel: `Resources - ${unitLabel}: Clear time`,
        value: unitEntry.clearTime,
      },
      {
        key: "incident_time_clear",
        label: "Incident clear time",
        value: formValues.incident_time_clear ?? formValues.time_incident_clear ?? "",
      },
    ];

    let previousTimelineEntry: { label: string; timestamp: number } | null = null;
    timelineEntries.forEach((entry) => {
      const trimmedValue = entry.value.trim();
      if (!trimmedValue) {
        return;
      }
      const timestamp = toResourceDateTimeTimestamp(trimmedValue, resourceFallbackDate);
      if (timestamp === null) {
        addTimelineError(entry, `${entry.label} has an invalid date/time value.`);
        return;
      }
      if (previousTimelineEntry && timestamp < previousTimelineEntry.timestamp) {
        addTimelineError(
          entry,
          `${entry.label} cannot be earlier than ${previousTimelineEntry.label}.`,
        );
      }
      previousTimelineEntry = {
        label: entry.label,
        timestamp,
      };
    });

    return {
      errors,
      customIssueLabelsByFieldId,
    };
  };

  useEffect(() => {
    const primaryUnit = resourceUnits[0];
    const primaryUnitId = primaryUnit?.unitId ?? "";
    const primaryUnitType = primaryUnit?.unitType ?? "";
    const primaryUnitStaffing = primaryUnit
      ? getStaffingValueForUnit(primaryUnit.unitId, primaryUnit.personnel)
      : "";
    const primaryUnitResponseMode = primaryUnit?.responseMode ?? "";
    const additionalUnits = resourceUnits
      .slice(1)
      .map((unit) => unit.unitId.trim())
      .filter((unitId) => unitId.length > 0)
      .join(", ");
    const serializedResourceUnits = JSON.stringify(
      resourceUnits.map((unit) => ({
        id: unit.id,
        unitId: unit.unitId,
        unitType: unit.unitType,
        staffing: getStaffingValueForUnit(unit.unitId, unit.personnel),
        responseMode: unit.responseMode,
        transportMode: unit.transportMode,
        dispatchTime: unit.dispatchTime,
        enrouteTime: unit.enrouteTime,
        stagedTime: unit.stagedTime,
        onSceneTime: unit.onSceneTime,
        canceledTime: unit.canceledTime,
        clearTime: unit.clearTime,
        isCanceledEnroute: unit.isCanceledEnroute,
        isComplete: unit.isComplete,
        isExpanded: unit.isExpanded,
        showTimesEditor: unit.showTimesEditor,
        personnel: unit.personnel,
        showPersonnelSelector: unit.showPersonnelSelector,
        reportWriter: unit.reportWriter,
        unitNarrative: unit.unitNarrative,
      })),
    );

    setFormValues((previous) => {
      if (
        (previous.resource_primary_unit_id ?? "") === primaryUnitId &&
        (previous.resource_primary_unit_type ?? "") === primaryUnitType &&
        (previous.resource_primary_unit_staffing ?? "") === primaryUnitStaffing &&
        (previous.resource_primary_unit_response_mode ?? "") === primaryUnitResponseMode &&
        (previous.resource_additional_units ?? "") === additionalUnits &&
        (previous.resource_units_json ?? "") === serializedResourceUnits
      ) {
        return previous;
      }

      return {
        ...previous,
        resource_primary_unit_id: primaryUnitId,
        resource_primary_unit_type: primaryUnitType,
        resource_primary_unit_staffing: primaryUnitStaffing,
        resource_primary_unit_response_mode: primaryUnitResponseMode,
        resource_additional_units: additionalUnits,
        resource_units_json: serializedResourceUnits,
      };
    });
  }, [getStaffingValueForUnit, resourceUnits]);

  const toggleResourceUnitExpanded = (unitEntryId: string) => {
    setResourceUnits((previous) =>
      previous.map((entry) =>
        entry.id === unitEntryId
          ? {
              ...entry,
              isExpanded: !entry.isExpanded,
            }
          : entry,
      ),
    );
    markNerisFormDirty();
  };

  const toggleResourceUnitComplete = (unitEntryId: string) => {
    setResourceUnits((previous) =>
      previous.map((entry) =>
        entry.id === unitEntryId
          ? {
              ...entry,
              isComplete: !entry.isComplete,
            }
          : entry,
      ),
    );
    markNerisFormDirty();
  };

  const syncResourceUnitsToIncident = (unitIds: string[]) => {
    const next = dedupeAndCleanStrings(unitIds).filter((id) => id.length > 0);
    onUpdateIncidentCall(callNumber, { assignedUnits: next.join(", ") });
  };

  const addResourceUnitAndSyncToIncident = (unitId: string) => {
    const trimmed = unitId.trim();
    if (!trimmed) return;
    const existingIds = resourceUnits.map((r) => r.unitId.trim()).filter(Boolean);
    if (existingIds.includes(trimmed)) return;
    const source = apparatusByResourceUnitId.get(trimmed);
    const newEntry: ResourceUnitEntry = {
      id: `resource-add-${Date.now()}-${trimmed.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
      unitId: trimmed,
      unitType: inferResourceUnitTypeValue(trimmed, source?.unitType, unitTypeOptions),
      staffing: getStaffingValueForUnit(trimmed, ""),
      responseMode: "",
      transportMode: "",
      dispatchTime: toResourceDateTimeInputValue(detail?.receivedAt ?? "", resourceFallbackDate),
      enrouteTime: "",
      stagedTime: "",
      onSceneTime: "",
      canceledTime: "",
      clearTime: "",
      isCanceledEnroute: false,
      isComplete: false,
      isExpanded: true,
      showTimesEditor: false,
      personnel: "",
      showPersonnelSelector: false,
      reportWriter: "",
      unitNarrative: "",
    };
    setResourceUnits((prev) => [...prev, newEntry]);
    syncResourceUnitsToIncident([...existingIds, trimmed]);
    markNerisFormDirty();
  };

  const deleteResourceUnit = (unitEntryId: string) => {
    const removed = resourceUnits.find((e) => e.id === unitEntryId);
    setResourceUnits((previous) =>
      previous.filter((entry) => entry.id !== unitEntryId),
    );
    if (removed?.unitId) {
      const remaining = resourceUnits
        .filter((e) => e.id !== unitEntryId)
        .map((r) => r.unitId.trim())
        .filter(Boolean);
      syncResourceUnitsToIncident(remaining);
    }
    clearResourceUnitValidationErrors(unitEntryId);
    if (activeResourcePersonnelUnitId === unitEntryId) {
      setActiveResourcePersonnelUnitId(null);
    }
    markNerisFormDirty();
  };

  const updateResourceUnitField = (
    unitEntryId: string,
    field:
      | "unitId"
      | "unitType"
      | "staffing"
      | "responseMode"
      | "transportMode"
      | "dispatchTime"
      | "enrouteTime"
      | "stagedTime"
      | "onSceneTime"
      | "canceledTime"
      | "clearTime"
      | "personnel"
      | "reportWriter"
      | "unitNarrative",
    value: string,
  ) => {
    setResourceUnits((previous) =>
      previous.map((entry) =>
        entry.id === unitEntryId
          ? (() => {
              if (field === "personnel") {
                const nextStaffing = getStaffingValueForUnit(entry.unitId, value);
                return {
                  ...entry,
                  personnel: value,
                  staffing: nextStaffing,
                };
              }
              if (field === "dispatchTime") {
                const normalizedDispatch = toResourceDateTimeInputValue(value, resourceFallbackDate);
                const normalizedClear = toResourceDateTimeInputValue(
                  entry.clearTime,
                  resourceFallbackDate,
                );
                const normalizedCanceled = toResourceDateTimeInputValue(
                  entry.canceledTime,
                  resourceFallbackDate,
                );
                const sameTime = entry.isCanceledEnroute && normalizedDispatch
                  ? normalizedCanceled || normalizedClear || addMinutesToResourceDateTime(normalizedDispatch, 1)
                  : undefined;
                return {
                  ...entry,
                  dispatchTime: normalizedDispatch,
                  ...(sameTime !== undefined
                    ? { canceledTime: sameTime, clearTime: sameTime }
                    : {
                        canceledTime: normalizedCanceled,
                        clearTime: normalizedClear,
                      }),
                };
              }
              if (
                field === "enrouteTime" ||
                field === "stagedTime" ||
                field === "onSceneTime" ||
                field === "canceledTime" ||
                field === "clearTime"
              ) {
                const normalized = toResourceDateTimeInputValue(value, resourceFallbackDate);
                if (entry.isCanceledEnroute && (field === "canceledTime" || field === "clearTime")) {
                  return {
                    ...entry,
                    canceledTime: normalized,
                    clearTime: normalized,
                  };
                }
                return {
                  ...entry,
                  [field]: normalized,
                };
              }
              return {
                ...entry,
                [field]: value,
              };
            })()
          : entry,
      ),
    );
    clearResourceUnitValidationErrors(unitEntryId);
    markNerisFormDirty();
  };

  const handleResourceUnitIdChange = (unitEntryId: string, nextUnitId: string) => {
    const source = apparatusByResourceUnitId.get(nextUnitId);
    const inferredUnitType = inferResourceUnitTypeValue(
      nextUnitId,
      source?.unitType,
      unitTypeOptions,
    );
    setResourceUnits((previous) =>
      previous.map((entry) =>
        entry.id === unitEntryId
          ? {
              ...entry,
              unitId: nextUnitId,
              unitType: inferredUnitType || entry.unitType,
              staffing: getStaffingValueForUnit(nextUnitId, entry.personnel),
            }
          : entry,
      ),
    );
    clearResourceUnitValidationErrors(unitEntryId);
    markNerisFormDirty();
  };

  const openResourcePersonnelModal = (unitEntryId: string) => {
    setActiveResourcePersonnelUnitId(unitEntryId);
  };

  const closeResourcePersonnelModal = () => {
    setActiveResourcePersonnelUnitId(null);
  };

  const removeResourcePersonnel = (unitEntryId: string, personnelValue: string) => {
    setResourceUnits((previous) =>
      previous.map((entry) => {
        if (entry.id !== unitEntryId) {
          return entry;
        }

        const nextPersonnelValues = entry.personnel
          .split(",")
          .map((value) => value.trim())
          .filter((value) => value.length > 0 && value !== personnelValue);
        const nextPersonnelCsv = nextPersonnelValues.join(",");
        const nextStaffing = getStaffingValueForUnit(entry.unitId, nextPersonnelCsv);
        const nextReportWriter =
          entry.reportWriter === personnelValue ? "" : entry.reportWriter;

        return {
          ...entry,
          personnel: nextPersonnelCsv,
          staffing: nextStaffing,
          reportWriter: nextReportWriter,
        };
      }),
    );
    clearResourceUnitValidationErrors(unitEntryId);
    markNerisFormDirty();
  };

  const toggleResourceTimesEditor = (unitEntryId: string) => {
    setResourceUnits((previous) =>
      previous.map((entry) =>
        entry.id === unitEntryId
          ? {
              ...entry,
              showTimesEditor: !entry.showTimesEditor,
            }
          : entry,
      ),
    );
    markNerisFormDirty();
  };

  const toggleResourceCanceledEnroute = (unitEntryId: string) => {
    setResourceUnits((previous) =>
      previous.map((entry) =>
        entry.id === unitEntryId
          ? (() => {
              const nextCanceledEnroute = !entry.isCanceledEnroute;
              if (!nextCanceledEnroute) {
                return {
                  ...entry,
                  isCanceledEnroute: false,
                  canceledTime: "",
                };
              }

              const normalizedDispatch = toResourceDateTimeInputValue(
                entry.dispatchTime,
                resourceFallbackDate,
              );
              const normalizedClear = toResourceDateTimeInputValue(
                entry.clearTime,
                resourceFallbackDate,
              );
              const normalizedCanceled = toResourceDateTimeInputValue(
                entry.canceledTime,
                resourceFallbackDate,
              );
              const sameTime =
                normalizedClear ||
                normalizedCanceled ||
                (normalizedDispatch
                  ? addMinutesToResourceDateTime(normalizedDispatch, 1)
                  : "");
              return {
                ...entry,
                isCanceledEnroute: true,
                dispatchTime: normalizedDispatch,
                canceledTime: sameTime,
                clearTime: sameTime,
              };
            })()
          : entry,
      ),
    );
    clearResourceUnitValidationErrors(unitEntryId);
    markNerisFormDirty();
  };

  const populateResourceTimesFromDispatch = (unitEntryId: string) => {
    // Prefer Incident Onset Date (Core), then dispatch/call-create date, then fallback
    const onsetDate = (formValues.incident_onset_date ?? "").trim();
    const populateDatePart =
      onsetDate && /^\d{4}-\d{2}-\d{2}$/.test(onsetDate)
        ? onsetDate
        : formatResourceDatePart(
            toResourceDateTimeInputValue(
              formValues.incident_time_unit_dispatched ??
                formValues.incident_time_call_create ??
                "",
              resourceFallbackDate,
            ),
          ) || resourceFallbackDate;
    if (!populateDatePart || !/^\d{4}-\d{2}-\d{2}$/.test(populateDatePart)) {
      return;
    }
    setResourceUnits((previous) =>
      previous.map((entry) => {
        if (entry.id !== unitEntryId) {
          return entry;
        }
        // Update only the date part for each field; preserve existing times
        const withDate = (
          field:
            | "dispatchTime"
            | "enrouteTime"
            | "stagedTime"
            | "onSceneTime"
            | "canceledTime"
            | "clearTime",
        ) =>
          combineResourceDateTimeFromParts(
            populateDatePart,
            formatResourceTimePart(entry[field]),
          ) || entry[field];
        return {
          ...entry,
          dispatchTime: withDate("dispatchTime"),
          enrouteTime: withDate("enrouteTime"),
          stagedTime: withDate("stagedTime"),
          onSceneTime: withDate("onSceneTime"),
          canceledTime: withDate("canceledTime"),
          clearTime: withDate("clearTime"),
        };
      }),
    );
    clearResourceUnitValidationErrors(unitEntryId);
    markNerisFormDirty();
  };

  const completeAndCollapseResourceUnit = (unitEntryId: string) => {
    const unitIndex = resourceUnits.findIndex((entry) => entry.id === unitEntryId);
    if (unitIndex < 0) {
      return;
    }
    const unitEntry = resourceUnits[unitIndex]!;
    const { errors, customIssueLabelsByFieldId } = validateResourceUnit(unitEntry, unitIndex);
    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) {
      const unitErrorKeyPrefix = `resource_unit_validation_${unitEntryId}_`;
      setSectionErrors((previous) => {
        const next: Record<string, string> = {};
        Object.entries(previous).forEach(([key, value]) => {
          if (key.startsWith(unitErrorKeyPrefix)) {
            return;
          }
          next[key] = value;
        });
        return {
          ...next,
          ...errors,
        };
      });
      setValidationIssues(
        Array.from(
          new Set(
            Object.keys(errors).map((fieldId) =>
              toValidationIssueLabel(fieldId, customIssueLabelsByFieldId),
            ),
          ),
        ),
      );
      setValidationModal(null);
      setSaveMessage("");
      setErrorMessage(
        "Unit requirements are incomplete or out of sequence. Fix highlighted fields before completing.",
      );
      setResourceUnits((previous) =>
        previous.map((entry) =>
          entry.id === unitEntryId
            ? {
                ...entry,
                isExpanded: true,
                showTimesEditor: true,
                isComplete: false,
              }
            : entry,
        ),
      );
      return;
    }

    clearResourceUnitValidationErrors(unitEntryId);
    setResourceUnits((previous) =>
      previous.map((entry) =>
        entry.id === unitEntryId
          ? {
              ...entry,
              isComplete: true,
              isExpanded: false,
              showTimesEditor: false,
            }
          : entry,
      ),
    );
    markNerisFormDirty();
  };

  const collapseResourceUnit = (unitEntryId: string) => {
    setResourceUnits((previous) =>
      previous.map((entry) =>
        entry.id === unitEntryId
          ? {
              ...entry,
              isExpanded: false,
              showTimesEditor: false,
            }
          : entry,
      ),
    );
    markNerisFormDirty();
  };

  const addEmergingElectrocutionItem = () => {
    setEmergingElectrocutionItems((previous) => [
      ...previous,
      {
        id: nextEmergingHazardItemId("electrocution"),
        electricalHazardType: "",
        suppressionMethods: "",
      },
    ]);
    markNerisFormDirty();
  };

  const updateEmergingElectrocutionItem = (
    itemId: string,
    field: "electricalHazardType" | "suppressionMethods",
    value: string,
  ) => {
    setEmergingElectrocutionItems((previous) =>
      previous.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
    markNerisFormDirty();
  };

  const deleteEmergingElectrocutionItem = (itemId: string) => {
    setEmergingElectrocutionItems((previous) =>
      previous.filter((item) => item.id !== itemId),
    );
    markNerisFormDirty();
  };

  const addEmergingPowerGenerationItem = () => {
    setEmergingPowerGenerationItems((previous) => [
      ...previous,
      {
        id: nextEmergingHazardItemId("power-generation"),
        photovoltaicHazardType: "",
        pvSourceTarget: "",
        suppressionMethods: "",
      },
    ]);
    markNerisFormDirty();
  };

  const updateEmergingPowerGenerationItem = (
    itemId: string,
    field: "photovoltaicHazardType" | "pvSourceTarget" | "suppressionMethods",
    value: string,
  ) => {
    setEmergingPowerGenerationItems((previous) =>
      previous.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
    markNerisFormDirty();
  };

  const deleteEmergingPowerGenerationItem = (itemId: string) => {
    setEmergingPowerGenerationItems((previous) =>
      previous.filter((item) => item.id !== itemId),
    );
    markNerisFormDirty();
  };

  const addRiskReductionSuppressionSystem = () => {
    setRiskReductionSuppressionSystems((previous) => [
      ...previous,
      {
        id: nextRiskReductionSuppressionId(),
        suppressionType: "",
        suppressionCoverage: "",
      },
    ]);
    markNerisFormDirty();
  };

  const updateRiskReductionSuppressionSystem = (
    systemId: string,
    field: "suppressionType" | "suppressionCoverage",
    value: string,
  ) => {
    setRiskReductionSuppressionSystems((previous) =>
      previous.map((system) =>
        system.id === systemId
          ? {
              ...system,
              [field]: value,
            }
          : system,
      ),
    );
    markNerisFormDirty();
  };

  const deleteRiskReductionSuppressionSystem = (systemId: string) => {
    setRiskReductionSuppressionSystems((previous) =>
      previous.filter((system) => system.id !== systemId),
    );
    markNerisFormDirty();
  };

  const stampSavedAt = (
    mode: "manual" | "auto",
    nextStatus: string = reportStatus,
    messageOverride?: string,
    formValuesOverride?: Partial<NerisFormValues>,
  ) => {
    const savedAt = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const valuesToWrite: NerisFormValues =
      formValuesOverride != null && Object.keys(formValuesOverride).length > 0
        ? ({ ...formValues, ...formValuesOverride } as NerisFormValues)
        : formValues;
    writeNerisDraft(callNumber, {
      formValues: valuesToWrite,
      reportStatus: nextStatus,
      lastSavedAt: savedAt,
      additionalAidEntries: additionalAidEntries.map((entry) => ({
        aidDirection: entry.aidDirection,
        aidType: entry.aidType,
        aidDepartment: entry.aidDepartment,
      })),
      additionalNonFdAidEntries: additionalNonFdAidEntries.map((entry) => ({
        aidType: entry.aidType,
      })),
    });
    if (formValuesOverride != null && Object.keys(formValuesOverride).length > 0) {
      setFormValues((prev) => ({ ...prev, ...formValuesOverride } as NerisFormValues));
    }
    setReportStatus(nextStatus);
    setLastSavedAt(savedAt);
    setSaveMessage(
      messageOverride ??
        (mode === "auto"
          ? `Draft auto-saved for ${detailForSideEffects.callNumber} at ${savedAt}.`
          : `Draft saved for ${detailForSideEffects.callNumber} at ${savedAt}.`),
    );
  };

  const buildValidationSnapshot = () => {
    const mergedErrors: Record<string, string> = {};
    const customIssueLabelsByFieldId: Record<string, string> = {};
    for (const section of NERIS_FORM_SECTIONS) {
      const validation = validateNerisSection(section.id, formValues);
      Object.assign(mergedErrors, validation.errors);
    }

    resourceUnits.forEach((unitEntry, unitIndex) => {
      const unitValidation = validateResourceUnit(unitEntry, unitIndex);
      Object.assign(mergedErrors, unitValidation.errors);
      Object.assign(customIssueLabelsByFieldId, unitValidation.customIssueLabelsByFieldId);
    });

    setSectionErrors(mergedErrors);
    const issueLabels = Array.from(
      new Set(
        Object.keys(mergedErrors).map((fieldId) =>
          toValidationIssueLabel(fieldId, customIssueLabelsByFieldId),
        ),
      ),
    );
    return {
      mergedErrors,
      issueLabels,
    };
  };

  const buildStoredAdditionalAidEntries = () =>
    additionalAidEntries.map((entry) => ({
      aidDirection: entry.aidDirection,
      aidType: entry.aidType,
      aidDepartment: entry.aidDepartment,
    }));

  const buildStoredAdditionalNonFdAidEntries = () =>
    additionalNonFdAidEntries.map((entry) => ({
      aidType: entry.aidType,
    }));

  const buildReportWriterName = () => {
    const narrativeWriter = (formValues.narrative_report_writer ?? "").trim();
    const rawReportWriter =
      narrativeWriter ||
      resourceUnits
        .map((unit) => unit.reportWriter.trim())
        .find((candidate) => candidate.length > 0) ||
      username.trim();
    if (!rawReportWriter) {
      return "";
    }
    if (!rawReportWriter.includes("_")) {
      return rawReportWriter;
    }
    return rawReportWriter
      .toLowerCase()
      .split("_")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  };

  const applyValidationFailure = (issueLabels: string[]) => {
    if (issueLabels.length === 0) {
      return;
    }
    const serializedAidEntries = buildStoredAdditionalAidEntries();
    const serializedNonFdAidEntries = buildStoredAdditionalNonFdAidEntries();
    writeNerisDraft(callNumber, {
      formValues,
      reportStatus: "Draft",
      lastSavedAt,
      additionalAidEntries: serializedAidEntries,
      additionalNonFdAidEntries: serializedNonFdAidEntries,
    });
    setReportStatus("Draft");
    setSaveMessage("");
    setErrorMessage(
      "Validation incomplete. Complete the required fields listed below.",
    );
    setValidationModal({
      mode: "issues",
      issues: issueLabels,
    });
  };

  const handleCheckForErrors = () => {
    const { mergedErrors, issueLabels } = buildValidationSnapshot();
    setSectionErrors(mergedErrors);
    setValidationIssues(issueLabels);

    if (issueLabels.length > 0) {
      applyValidationFailure(issueLabels);
      return;
    }

    setErrorMessage("");
    setValidationIssues([]);
    setValidationModal({
      mode: "checkSuccess",
      issues: [],
    });
    stampSavedAt(
      "manual",
      "In Review",
      "Check for Errors passed. Status updated to In Review.",
    );
  };

  type ExportRequestConfig = {
    exportUrl: string;
    isProxyRequest: boolean;
    headers: Record<string, string>;
    payload: Record<string, unknown>;
  };

  type ExportExecutionResult = {
    exportedAtIso: string;
    exportedAtLabel: string;
    attemptStatus: "success" | "failed";
    httpStatus: number;
    httpStatusText: string;
    nerisId: string;
    submittedEntityId: string;
    submittedDepartmentNerisId: string;
    statusLabel: string;
    responseSummary: string;
    responseDetail: string;
    submittedPayloadPreview: string;
  };

  type ExportRequestError = Error & {
    httpStatus?: number;
    httpStatusText?: string;
    submittedEntityId?: string;
    submittedDepartmentNerisId?: string;
    responseSummary?: string;
    responseDetail?: string;
    submittedPayloadPreview?: string;
  };

  const toPrettyJson = (value: unknown): string => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "";
    }
  };

  const extractSubmittedDepartmentFromResponse = (
    responseJson: Record<string, unknown> | null,
  ): string => {
    if (
      responseJson?.submittedPayload &&
      typeof responseJson.submittedPayload === "object" &&
      (responseJson.submittedPayload as Record<string, unknown>).base &&
      typeof (responseJson.submittedPayload as Record<string, unknown>).base === "object" &&
      typeof (
        (responseJson.submittedPayload as Record<string, unknown>).base as Record<string, unknown>
      ).department_neris_id === "string"
    ) {
      return ((responseJson.submittedPayload as Record<string, unknown>).base as Record<
        string,
        unknown
      >).department_neris_id as string;
    }
    return (formValues.fd_neris_id ?? "").trim();
  };

  const extractExportResponseSummary = (
    response: Response,
    responseJson: Record<string, unknown> | null,
    responseText: string,
  ): string => {
    if (typeof responseJson?.message === "string" && responseJson.message.trim().length > 0) {
      return responseJson.message.trim();
    }
    const fallback =
      responseJson?.fallback && typeof responseJson.fallback === "object"
        ? (responseJson.fallback as Record<string, unknown>)
        : null;
    if (typeof fallback?.reason === "string" && fallback.reason.trim().length > 0) {
      const updateStatus =
        typeof fallback.updateStatus === "number" ? fallback.updateStatus : null;
      const updateStatusText =
        typeof fallback.updateStatusText === "string" ? fallback.updateStatusText : "";
      if (updateStatus !== null) {
        return `Fallback ${fallback.succeeded ? "succeeded" : "failed"} (${updateStatus} ${updateStatusText}). ${fallback.reason}`.trim();
      }
      return fallback.reason;
    }
    const detailFromNeris =
      responseJson?.neris && typeof responseJson.neris === "object"
        ? (responseJson.neris as Record<string, unknown>).detail
        : null;
    if (typeof detailFromNeris === "string" && detailFromNeris.trim().length > 0) {
      return detailFromNeris.trim();
    }
    if (Array.isArray(detailFromNeris) && detailFromNeris.length > 0) {
      return toPrettyJson(detailFromNeris);
    }
    if (responseText.trim().length > 0) {
      return responseText.slice(0, 280);
    }
    return `${response.status} ${response.statusText}`;
  };

  const createExportRequestError = (
    message: string,
    metadata: Omit<ExportExecutionResult, "exportedAtIso" | "exportedAtLabel" | "attemptStatus" | "nerisId" | "statusLabel"> & {
      httpStatus: number;
      httpStatusText: string;
    },
  ): ExportRequestError => {
    const error = new Error(message) as ExportRequestError;
    error.httpStatus = metadata.httpStatus;
    error.httpStatusText = metadata.httpStatusText;
    error.submittedEntityId = metadata.submittedEntityId;
    error.submittedDepartmentNerisId = metadata.submittedDepartmentNerisId;
    error.responseSummary = metadata.responseSummary;
    error.responseDetail = metadata.responseDetail;
    error.submittedPayloadPreview = metadata.submittedPayloadPreview;
    return error;
  };

  const getExistingIncidentNerisIdHint = () => {
    const fromForm = (formValues.incident_neris_id ?? "").trim();
    if (NERIS_INCIDENT_ID_PATTERN.test(fromForm)) {
      return fromForm;
    }
    const fromHistory = readNerisExportHistory().find(
      (entry) =>
        entry.callNumber === callNumber &&
        entry.attemptStatus === "success" &&
        NERIS_INCIDENT_ID_PATTERN.test(entry.nerisId),
    );
    return fromHistory?.nerisId ?? "";
  };

  const buildExportRequestConfig = (): ExportRequestConfig => {
    const defaultExportSettings = getDefaultNerisExportSettings();
    const exportUrl =
      nerisExportSettings.exportUrl.trim() ||
      String(import.meta.env.VITE_NERIS_EXPORT_URL ?? "").trim() ||
      defaultExportSettings.exportUrl;
    const vendorCode =
      nerisExportSettings.vendorCode.trim() ||
      String(import.meta.env.VITE_NERIS_VENDOR_CODE ?? "").trim();
    const secretKey =
      nerisExportSettings.secretKey.trim() ||
      String(import.meta.env.VITE_NERIS_SECRET_KEY ?? "").trim();
    const vendorHeaderName =
      nerisExportSettings.vendorHeaderName.trim() ||
      String(import.meta.env.VITE_NERIS_VENDOR_HEADER_NAME ?? "").trim() ||
      defaultExportSettings.vendorHeaderName;
    const authHeaderName =
      nerisExportSettings.authHeaderName.trim() ||
      String(import.meta.env.VITE_NERIS_AUTH_HEADER_NAME ?? "").trim() ||
      defaultExportSettings.authHeaderName;
    const authScheme =
      nerisExportSettings.authScheme.trim() ||
      String(import.meta.env.VITE_NERIS_AUTH_SCHEME ?? "").trim() ||
      defaultExportSettings.authScheme;
    const contentType =
      nerisExportSettings.contentType.trim() ||
      String(import.meta.env.VITE_NERIS_CONTENT_TYPE ?? "").trim() ||
      defaultExportSettings.contentType;
    const apiVersionHeaderName = nerisExportSettings.apiVersionHeaderName.trim();
    const apiVersionHeaderValue = nerisExportSettings.apiVersionHeaderValue.trim();
    const isProxyRequest = exportUrl.startsWith("/api/neris/");
    const existingIncidentNerisId = getExistingIncidentNerisIdHint();
    if (!exportUrl) {
      throw new Error(
        "Export is not configured. Add Export URL in Admin Functions > Customization > NERIS Export Configuration.",
      );
    }

    const timezoneSourceDate = (() => {
      const dispatchTime = (formValues.incident_time_call_create ?? "").trim();
      if (!dispatchTime) {
        return new Date();
      }
      const parsed = new Date(dispatchTime);
      if (Number.isNaN(parsed.getTime())) {
        return new Date();
      }
      return parsed;
    })();
    const clientUtcOffsetMinutes = timezoneSourceDate.getTimezoneOffset();

    const payload = {
      callNumber: detailForSideEffects.callNumber,
      reportStatus,
      exportedAt: new Date().toISOString(),
      source: "Fire Ultimate Prototype",
      formValues,
      incidentSnapshot: {
        incidentType: detailForSideEffects.incidentType,
        address: detailForSideEffects.address,
        receivedAt: detailForSideEffects.receivedAt,
        assignedUnits: detailForSideEffects.assignedUnits,
      },
      integration: {
        entityId: vendorCode,
        contentType,
        apiVersionHeaderName,
        apiVersionHeaderValue,
        existingIncidentNerisId,
        allowUpdateFallback: true,
        clientUtcOffsetMinutes,
      },
      additionalAidEntries: buildStoredAdditionalAidEntries(),
      additionalNonFdAidEntries: buildStoredAdditionalNonFdAidEntries(),
    };
    const headers: Record<string, string> = {
      "Content-Type": contentType,
    };
    if (vendorCode && vendorHeaderName) {
      headers[vendorHeaderName] = vendorCode;
    }
    if (!isProxyRequest && secretKey) {
      headers[authHeaderName] = authScheme
        ? `${authScheme} ${secretKey}`
        : secretKey;
    }
    if (apiVersionHeaderName && apiVersionHeaderValue) {
      headers[apiVersionHeaderName] = apiVersionHeaderValue;
    }
    return {
      exportUrl,
      isProxyRequest,
      headers,
      payload,
    };
  };

  const parseJsonResponseText = (responseText: string): Record<string, unknown> | null => {
    if (!responseText) {
      return null;
    }
    try {
      return JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const readPathValue = (source: unknown, path: Array<string | number>): unknown => {
    let current: unknown = source;
    for (const segment of path) {
      if (typeof segment === "number") {
        if (!Array.isArray(current) || segment < 0 || segment >= current.length) {
          return undefined;
        }
        current = current[segment];
        continue;
      }
      if (!current || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    return current;
  };

  const toComparableText = (value: unknown): string => {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "boolean") {
      return value ? "YES" : "NO";
    }
    if (typeof value === "number") {
      return String(value);
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
        const parsedTimestamp = Date.parse(trimmed);
        if (!Number.isNaN(parsedTimestamp)) {
          return `DT:${parsedTimestamp}`;
        }
      }
      return trimmed.toUpperCase();
    }
    if (Array.isArray(value)) {
      return value
        .map((entry) => toComparableText(entry))
        .filter((entry) => entry.length > 0)
        .sort()
        .join("|");
    }
    return "";
  };

  const toFriendlyValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return "Not provided";
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
    if (typeof value === "number") {
      return String(value);
    }
    if (typeof value === "string") {
      return value.trim() || "Not provided";
    }
    if (Array.isArray(value)) {
      const flattened = value
        .map((entry) => {
          if (typeof entry === "string") {
            return entry.trim();
          }
          if (typeof entry === "number") {
            return String(entry);
          }
          return "";
        })
        .filter((entry) => entry.length > 0);
      return flattened.length > 0 ? flattened.join(", ") : "Not provided";
    }
    return "Not provided";
  };

  const isCompareMatch = (submittedValue: unknown, retrievedValue: unknown): boolean =>
    toComparableText(submittedValue) === toComparableText(retrievedValue);

  const extractPrimaryIncidentType = (value: unknown): string => {
    if (!Array.isArray(value)) {
      return "";
    }
    const primaryEntry = value.find(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        (entry as Record<string, unknown>).primary === true &&
        typeof (entry as Record<string, unknown>).type === "string",
    ) as Record<string, unknown> | undefined;
    if (!primaryEntry) {
      return "";
    }
    return String(primaryEntry.type).replaceAll("||", " > ").trim();
  };

  const extractAdditionalIncidentTypes = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          (entry as Record<string, unknown>).primary !== true &&
          typeof (entry as Record<string, unknown>).type === "string",
      )
      .map((entry) => String((entry as Record<string, unknown>).type).replaceAll("||", " > ").trim())
      .filter((entry) => entry.length > 0)
      .sort((left, right) => left.localeCompare(right));
  };

  const extractUnitSummaries = (
    value: unknown,
  ): {
    units: string[];
    staffing: string[];
  } => {
    if (!Array.isArray(value)) {
      return { units: [], staffing: [] };
    }
    const units: string[] = [];
    const staffing: string[] = [];
    value.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      const candidate = entry as Record<string, unknown>;
      const reportedUnitId =
        typeof candidate.reported_unit_id === "string" ? candidate.reported_unit_id.trim() : "";
      const unitNerisId =
        typeof candidate.unit_neris_id === "string" ? candidate.unit_neris_id.trim() : "";
      const unitLabel = reportedUnitId || unitNerisId;
      if (!unitLabel) {
        return;
      }
      units.push(unitLabel);
      const staffingValue =
        typeof candidate.staffing === "number"
          ? String(candidate.staffing)
          : typeof candidate.staffing === "string"
            ? candidate.staffing.trim()
            : "";
      staffing.push(staffingValue ? `${unitLabel} (${staffingValue})` : `${unitLabel} (Not provided)`);
    });
    return {
      units: dedupeAndCleanStrings(units).sort((left, right) => left.localeCompare(right)),
      staffing: dedupeAndCleanStrings(staffing).sort((left, right) => left.localeCompare(right)),
    };
  };

  const extractAidSummaries = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
      return [];
    }
    const summaries = value
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return "";
        }
        const candidate = entry as Record<string, unknown>;
        const department =
          typeof candidate.department_neris_id === "string"
            ? candidate.department_neris_id.trim()
            : "";
        const aidType = typeof candidate.aid_type === "string" ? candidate.aid_type.trim() : "";
        const direction =
          typeof candidate.aid_direction === "string" ? candidate.aid_direction.trim() : "";
        const parts = [direction, aidType, department].filter((part) => part.length > 0);
        return parts.join(" | ");
      })
      .filter((entry) => entry.length > 0);
    return dedupeAndCleanStrings(summaries).sort((left, right) => left.localeCompare(right));
  };

  const extractUnitFieldSummaries = (
    value: unknown,
    field: "response_mode" | "transport_mode" | "dispatch" | "enroute_to_scene" | "staging" | "on_scene" | "canceled_enroute" | "unit_clear",
  ): string[] => {
    if (!Array.isArray(value)) {
      return [];
    }
    const summaries = value
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return "";
        }
        const candidate = entry as Record<string, unknown>;
        const reportedUnitId =
          typeof candidate.reported_unit_id === "string" ? candidate.reported_unit_id.trim() : "";
        const unitNerisId =
          typeof candidate.unit_neris_id === "string" ? candidate.unit_neris_id.trim() : "";
        const unitLabel = reportedUnitId || unitNerisId || "Unknown unit";
        const rawFieldValue = candidate[field];
        if (typeof rawFieldValue !== "string" || rawFieldValue.trim().length === 0) {
          return "";
        }
        return `${unitLabel}: ${rawFieldValue.trim()}`;
      })
      .filter((entry) => entry.length > 0);
    return dedupeAndCleanStrings(summaries).sort((left, right) => left.localeCompare(right));
  };

  const extractActionNoActionSummary = (value: unknown): string => {
    if (!value || typeof value !== "object") {
      return "";
    }
    const actionNoAction =
      (value as Record<string, unknown>).action_noaction &&
      typeof (value as Record<string, unknown>).action_noaction === "object"
        ? ((value as Record<string, unknown>).action_noaction as Record<string, unknown>)
        : null;
    if (!actionNoAction) {
      return "";
    }
    const type = typeof actionNoAction.type === "string" ? actionNoAction.type.trim() : "";
    if (type === "ACTION") {
      const actions = Array.isArray(actionNoAction.actions)
        ? (actionNoAction.actions as unknown[])
            .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
            .map((entry) => entry.trim())
        : [];
      return actions.length > 0 ? actions.join(", ") : "Action selected";
    }
    if (type === "NOACTION") {
      const noActionType =
        typeof actionNoAction.noaction_type === "string"
          ? actionNoAction.noaction_type.trim()
          : "";
      return noActionType ? `No Action: ${noActionType}` : "No Action selected";
    }
    return "";
  };

  const extractLocationUseSummary = (value: unknown): string[] => {
    if (!value || typeof value !== "object") {
      return [];
    }
    const candidate = value as Record<string, unknown>;
    const summary: string[] = [];
    const useType = typeof candidate.use_type === "string" ? candidate.use_type.trim() : "";
    const secondaryUse =
      typeof candidate.secondary_use === "string" ? candidate.secondary_use.trim() : "";
    const vacancyCause =
      typeof candidate.vacancy_cause === "string" ? candidate.vacancy_cause.trim() : "";
    if (useType) {
      summary.push(`Primary: ${useType}`);
    }
    if (secondaryUse) {
      summary.push(`Secondary: ${secondaryUse}`);
    }
    if (vacancyCause) {
      summary.push(`Vacancy: ${vacancyCause}`);
    }
    const inUse =
      candidate.in_use && typeof candidate.in_use === "object"
        ? (candidate.in_use as Record<string, unknown>)
        : null;
    if (inUse && typeof inUse.in_use === "boolean") {
      summary.push(`In Use: ${inUse.in_use ? "Yes" : "No"}`);
    }
    if (inUse && typeof inUse.intended === "boolean") {
      summary.push(`As Intended: ${inUse.intended ? "Yes" : "No"}`);
    }
    return summary;
  };

  const buildCompareRow = (
    id: string,
    label: string,
    submittedValue: unknown,
    retrievedValue: unknown,
    helpText?: string,
  ): IncidentCompareRow => ({
    id,
    label,
    submittedValue: toFriendlyValue(submittedValue),
    retrievedValue: toFriendlyValue(retrievedValue),
    status: isCompareMatch(submittedValue, retrievedValue) ? "match" : "different",
    helpText,
  });

  const readLatestSubmittedPayloadForCompare = (): Record<string, unknown> | null => {
    const latestSuccessfulEntry = readNerisExportHistory().find(
      (entry) =>
        entry.callNumber === callNumber &&
        entry.attemptStatus === "success" &&
        entry.submittedPayloadPreview.trim().length > 0,
    );
    if (!latestSuccessfulEntry) {
      return null;
    }
    const parsed = parseJsonResponseText(latestSuccessfulEntry.submittedPayloadPreview);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const hasNerisPayloadShape =
      parsed.base &&
      typeof parsed.base === "object" &&
      parsed.dispatch &&
      typeof parsed.dispatch === "object";
    return hasNerisPayloadShape ? parsed : null;
  };

  const collectUnmappedFilledFieldLabels = (): string[] => {
    const labels = Object.entries(formValues)
      .filter(([fieldId, fieldValue]) => {
        if (NERIS_PROXY_MAPPED_FORM_FIELD_IDS.has(fieldId)) {
          return false;
        }
        return typeof fieldValue === "string" && fieldValue.trim().length > 0;
      })
      .map(([fieldId]) => nerisFieldLabelById[fieldId] ?? fieldId);
    return dedupeAndCleanStrings(labels).sort((left, right) => left.localeCompare(right));
  };

  const buildIncidentCompareRows = (
    submittedPayload: Record<string, unknown>,
    retrievedIncident: Record<string, unknown>,
  ): IncidentCompareRow[] => {
    const submittedIncidentTypes = readPathValue(submittedPayload, ["incident_types"]);
    const retrievedIncidentTypes = readPathValue(retrievedIncident, ["incident_types"]);
    const submittedPrimaryType = extractPrimaryIncidentType(submittedIncidentTypes);
    const retrievedPrimaryType = extractPrimaryIncidentType(retrievedIncidentTypes);
    const submittedAdditionalTypes = extractAdditionalIncidentTypes(submittedIncidentTypes);
    const retrievedAdditionalTypes = extractAdditionalIncidentTypes(retrievedIncidentTypes);
    const submittedDispatchUnits = extractUnitSummaries(
      readPathValue(submittedPayload, ["dispatch", "unit_responses"]),
    );
    const retrievedDispatchUnits = extractUnitSummaries(
      readPathValue(retrievedIncident, ["dispatch", "unit_responses"]),
    );
    const submittedDispatchUnitResponses = readPathValue(submittedPayload, ["dispatch", "unit_responses"]);
    const retrievedDispatchUnitResponses = readPathValue(retrievedIncident, ["dispatch", "unit_responses"]);
    const submittedResponseModes = extractUnitFieldSummaries(
      submittedDispatchUnitResponses,
      "response_mode",
    );
    const retrievedResponseModes = extractUnitFieldSummaries(
      retrievedDispatchUnitResponses,
      "response_mode",
    );
    const submittedTransportModes = extractUnitFieldSummaries(
      submittedDispatchUnitResponses,
      "transport_mode",
    );
    const retrievedTransportModes = extractUnitFieldSummaries(
      retrievedDispatchUnitResponses,
      "transport_mode",
    );
    const submittedStagedTimes = extractUnitFieldSummaries(
      submittedDispatchUnitResponses,
      "staging",
    );
    const retrievedStagedTimes = extractUnitFieldSummaries(
      retrievedDispatchUnitResponses,
      "staging",
    );
    const submittedCanceledTimes = extractUnitFieldSummaries(
      submittedDispatchUnitResponses,
      "canceled_enroute",
    );
    const retrievedCanceledTimes = extractUnitFieldSummaries(
      retrievedDispatchUnitResponses,
      "canceled_enroute",
    );
    const submittedActionSummary = extractActionNoActionSummary(
      readPathValue(submittedPayload, ["actions_tactics"]),
    );
    const retrievedActionSummary = extractActionNoActionSummary(
      readPathValue(retrievedIncident, ["actions_tactics"]),
    );
    const submittedAidSummary = extractAidSummaries(readPathValue(submittedPayload, ["aids"]));
    const retrievedAidSummary = extractAidSummaries(readPathValue(retrievedIncident, ["aids"]));
    const submittedLocationUseSummary = extractLocationUseSummary(
      readPathValue(submittedPayload, ["base", "location_use"]),
    );
    const retrievedLocationUseSummary = extractLocationUseSummary(
      readPathValue(retrievedIncident, ["base", "location_use"]),
    );

    return [
      buildCompareRow(
        "department-id",
        "Department NERIS ID",
        readPathValue(submittedPayload, ["base", "department_neris_id"]),
        readPathValue(retrievedIncident, ["base", "department_neris_id"]),
      ),
      buildCompareRow(
        "incident-number",
        "Incident Number",
        readPathValue(submittedPayload, ["base", "incident_number"]),
        readPathValue(retrievedIncident, ["base", "incident_number"]),
      ),
      buildCompareRow("primary-incident-type", "Primary Incident Type", submittedPrimaryType, retrievedPrimaryType),
      buildCompareRow(
        "additional-incident-types",
        "Additional Incident Type(s)",
        submittedAdditionalTypes,
        retrievedAdditionalTypes,
      ),
      buildCompareRow(
        "special-modifiers",
        "Special Incident Modifier(s)",
        readPathValue(submittedPayload, ["special_modifiers"]),
        readPathValue(retrievedIncident, ["special_modifiers"]),
        "Some special modifiers are incident-type dependent and may be ignored by NERIS.",
      ),
      buildCompareRow("actions-or-no-action", "Actions / No Action", submittedActionSummary, retrievedActionSummary),
      buildCompareRow(
        "people-present",
        "Were people present?",
        readPathValue(submittedPayload, ["base", "people_present"]),
        readPathValue(retrievedIncident, ["base", "people_present"]),
      ),
      buildCompareRow(
        "displaced-count",
        "Number of People Displaced",
        readPathValue(submittedPayload, ["base", "displacement_count"]),
        readPathValue(retrievedIncident, ["base", "displacement_count"]),
      ),
      buildCompareRow(
        "displacement-causes",
        "Displacement Cause(s)",
        readPathValue(submittedPayload, ["base", "displacement_causes"]),
        readPathValue(retrievedIncident, ["base", "displacement_causes"]),
      ),
      buildCompareRow(
        "narrative-outcome",
        "Narrative - Outcome",
        readPathValue(submittedPayload, ["base", "outcome_narrative"]),
        readPathValue(retrievedIncident, ["base", "outcome_narrative"]),
      ),
      buildCompareRow(
        "narrative-obstacles",
        "Narrative - Obstacles",
        readPathValue(submittedPayload, ["base", "impediment_narrative"]),
        readPathValue(retrievedIncident, ["base", "impediment_narrative"]),
      ),
      buildCompareRow(
        "incident-address-street",
        "Incident Address - Street",
        readPathValue(submittedPayload, ["base", "location", "street"]),
        readPathValue(retrievedIncident, ["base", "location", "street"]),
      ),
      buildCompareRow(
        "incident-address-city",
        "Incident Address - City",
        readPathValue(submittedPayload, ["base", "location", "incorporated_municipality"]),
        readPathValue(retrievedIncident, ["base", "location", "incorporated_municipality"]),
      ),
      buildCompareRow(
        "incident-address-state",
        "Incident Address - State",
        readPathValue(submittedPayload, ["base", "location", "state"]),
        readPathValue(retrievedIncident, ["base", "location", "state"]),
      ),
      buildCompareRow(
        "incident-address-postal",
        "Incident Address - Postal Code",
        readPathValue(submittedPayload, ["base", "location", "postal_code"]),
        readPathValue(retrievedIncident, ["base", "location", "postal_code"]),
      ),
      buildCompareRow(
        "incident-address-county",
        "Incident Address - County",
        readPathValue(submittedPayload, ["base", "location", "county"]),
        readPathValue(retrievedIncident, ["base", "location", "county"]),
      ),
      buildCompareRow(
        "incident-place-type",
        "Incident Place Type",
        readPathValue(submittedPayload, ["base", "location", "place_type"]),
        readPathValue(retrievedIncident, ["base", "location", "place_type"]),
      ),
      buildCompareRow(
        "incident-location-use",
        "Incident Location Use",
        submittedLocationUseSummary,
        retrievedLocationUseSummary,
      ),
      buildCompareRow(
        "dispatch-incident-number",
        "Dispatch Incident Number",
        readPathValue(submittedPayload, ["dispatch", "incident_number"]),
        readPathValue(retrievedIncident, ["dispatch", "incident_number"]),
      ),
      buildCompareRow(
        "dispatch-code",
        "Dispatch Code",
        readPathValue(submittedPayload, ["dispatch", "incident_code"]),
        readPathValue(retrievedIncident, ["dispatch", "incident_code"]),
      ),
      buildCompareRow(
        "dispatch-center-id",
        "Dispatch Center ID",
        readPathValue(submittedPayload, ["dispatch", "center_id"]),
        readPathValue(retrievedIncident, ["dispatch", "center_id"]),
      ),
      buildCompareRow(
        "dispatch-clear-time",
        "Incident Clear Time",
        readPathValue(submittedPayload, ["dispatch", "incident_clear"]),
        readPathValue(retrievedIncident, ["dispatch", "incident_clear"]),
      ),
      buildCompareRow(
        "dispatch-auto-alarm",
        "Automatic Alarm",
        readPathValue(submittedPayload, ["dispatch", "automatic_alarm"]),
        readPathValue(retrievedIncident, ["dispatch", "automatic_alarm"]),
      ),
      buildCompareRow(
        "dispatch-units",
        "Dispatch Units",
        submittedDispatchUnits.units,
        retrievedDispatchUnits.units,
      ),
      buildCompareRow(
        "dispatch-unit-staffing",
        "Dispatch Unit Staffing",
        submittedDispatchUnits.staffing,
        retrievedDispatchUnits.staffing,
      ),
      buildCompareRow(
        "dispatch-unit-response-mode",
        "Dispatch Unit Response Mode",
        submittedResponseModes,
        retrievedResponseModes,
      ),
      buildCompareRow(
        "dispatch-unit-transport-mode",
        "Dispatch Unit Transport Mode",
        submittedTransportModes,
        retrievedTransportModes,
      ),
      buildCompareRow(
        "dispatch-unit-staged-time",
        "Dispatch Unit Staged Time",
        submittedStagedTimes,
        retrievedStagedTimes,
      ),
      buildCompareRow(
        "dispatch-unit-canceled-time",
        "Dispatch Unit Canceled Time",
        submittedCanceledTimes,
        retrievedCanceledTimes,
      ),
      buildCompareRow(
        "dispatch-location-street",
        "Dispatch Location - Street",
        readPathValue(submittedPayload, ["dispatch", "location", "street"]),
        readPathValue(retrievedIncident, ["dispatch", "location", "street"]),
      ),
      buildCompareRow(
        "dispatch-location-city",
        "Dispatch Location - City",
        readPathValue(submittedPayload, ["dispatch", "location", "incorporated_municipality"]),
        readPathValue(retrievedIncident, ["dispatch", "location", "incorporated_municipality"]),
      ),
      buildCompareRow(
        "dispatch-location-state",
        "Dispatch Location - State",
        readPathValue(submittedPayload, ["dispatch", "location", "state"]),
        readPathValue(retrievedIncident, ["dispatch", "location", "state"]),
      ),
      buildCompareRow(
        "dispatch-location-postal",
        "Dispatch Location - Postal Code",
        readPathValue(submittedPayload, ["dispatch", "location", "postal_code"]),
        readPathValue(retrievedIncident, ["dispatch", "location", "postal_code"]),
      ),
      buildCompareRow(
        "dispatch-location-county",
        "Dispatch Location - County",
        readPathValue(submittedPayload, ["dispatch", "location", "county"]),
        readPathValue(retrievedIncident, ["dispatch", "location", "county"]),
      ),
      buildCompareRow("aid-fire-department", "Aid (Fire Department)", submittedAidSummary, retrievedAidSummary),
      buildCompareRow(
        "aid-non-fd",
        "Aid (Non FD)",
        readPathValue(submittedPayload, ["nonfd_aids"]),
        readPathValue(retrievedIncident, ["nonfd_aids"]),
      ),
    ];
  };

  const getRequestedEntityId = (requestConfig: ExportRequestConfig): string => {
    const integration =
      requestConfig.payload.integration && typeof requestConfig.payload.integration === "object"
        ? (requestConfig.payload.integration as Record<string, unknown>)
        : null;
    return integration && typeof integration.entityId === "string" ? integration.entityId : "";
  };

  const executeExport = async (
    requestConfig: ExportRequestConfig,
  ): Promise<ExportExecutionResult> => {
    const isProxyRequest = requestConfig.isProxyRequest;
    const serializedAidEntries = buildStoredAdditionalAidEntries();
    const serializedNonFdAidEntries = buildStoredAdditionalNonFdAidEntries();
    writeNerisDraft(callNumber, {
      formValues,
      reportStatus,
      lastSavedAt,
      additionalAidEntries: serializedAidEntries,
      additionalNonFdAidEntries: serializedNonFdAidEntries,
    });

    const requestController = new AbortController();
    const timeoutId = window.setTimeout(() => requestController.abort(), 20_000);

    try {
      const response = await fetch(requestConfig.exportUrl, {
        method: "POST",
        headers: requestConfig.headers,
        body: JSON.stringify(requestConfig.payload),
        signal: requestController.signal,
      });
      const responseText = await response.text();
      const responseJson = parseJsonResponseText(responseText);
      const submittedEntityId =
        typeof responseJson?.submittedEntityId === "string"
          ? responseJson.submittedEntityId
          : getRequestedEntityId(requestConfig);
      const submittedDepartmentNerisId = extractSubmittedDepartmentFromResponse(responseJson);
      const submittedPayloadPreview =
        toPrettyJson(responseJson?.submittedPayload ?? requestConfig.payload) ||
        toPrettyJson(requestConfig.payload);
      const responseDetail = responseJson ? toPrettyJson(responseJson) : responseText;
      const responseSummary = extractExportResponseSummary(response, responseJson, responseText);
      if (!response.ok) {
        if (response.status === 403) {
          const troubleshooting =
            responseJson?.troubleshooting &&
            typeof responseJson.troubleshooting === "object"
              ? (responseJson.troubleshooting as Record<string, unknown>)
              : null;
          const accessibleEntityIds = Array.isArray(troubleshooting?.accessibleEntityIds)
            ? (troubleshooting?.accessibleEntityIds as unknown[])
                .filter((value): value is string => typeof value === "string")
                .slice(0, 8)
            : [];
          const submittedDepartmentFromTroubleshooting =
            typeof troubleshooting?.submittedDepartmentNerisId === "string"
              ? troubleshooting.submittedDepartmentNerisId
              : submittedDepartmentNerisId;
          const troubleshootingMessage =
            typeof troubleshooting?.message === "string" ? troubleshooting.message : "";
          const detailedMessage =
            accessibleEntityIds.length
              ? `Export denied (403). ${
                  troubleshootingMessage ||
                  `Submitted entity ID ${submittedEntityId} is not authorized for this token.`
                } Submitted entity ID: ${submittedEntityId}. ${
                  submittedDepartmentFromTroubleshooting
                    ? `Submitted Department NERIS ID: ${submittedDepartmentFromTroubleshooting}. `
                    : ""
                }Accessible entity IDs: ${accessibleEntityIds.join(", ")}`
              : `Export denied (403). ${
                  troubleshootingMessage ||
                  `Submitted entity ID ${submittedEntityId} is not authorized for this token.`
                } Submitted entity ID: ${submittedEntityId}. ${
                  submittedDepartmentFromTroubleshooting
                    ? `Submitted Department NERIS ID: ${submittedDepartmentFromTroubleshooting}.`
                    : ""
                }`;
          throw createExportRequestError(detailedMessage, {
            httpStatus: response.status,
            httpStatusText: response.statusText,
            submittedEntityId,
            submittedDepartmentNerisId: submittedDepartmentFromTroubleshooting,
            responseSummary:
              troubleshootingMessage ||
              responseSummary ||
              "Export denied by NERIS authorization checks.",
            responseDetail,
            submittedPayloadPreview,
          });
        }
        throw createExportRequestError(
          `Export failed (${response.status} ${response.statusText}). ${
            responseSummary || "No response details."
          }`,
          {
            httpStatus: response.status,
            httpStatusText: response.statusText,
            submittedEntityId,
            submittedDepartmentNerisId,
            responseSummary: responseSummary || `${response.status} ${response.statusText}`,
            responseDetail,
            submittedPayloadPreview,
          },
        );
      }

      const exportedAtDate = new Date();
      const exportedAtIso = exportedAtDate.toISOString();
      const exportedAtLabel = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(exportedAtDate);
      const nerisIdFromNeris =
        typeof responseJson?.neris === "object" &&
        responseJson.neris &&
        typeof (responseJson.neris as Record<string, unknown>).neris_id === "string"
          ? String((responseJson.neris as Record<string, unknown>).neris_id).trim()
          : "";
      const nerisIdFromCreateResult =
        responseJson?.createResult &&
        typeof responseJson.createResult === "object" &&
        typeof (responseJson.createResult as Record<string, unknown>).neris === "object" &&
        (responseJson.createResult as Record<string, unknown>).neris &&
        typeof ((responseJson.createResult as Record<string, unknown>).neris as Record<string, unknown>).neris_id === "string"
          ? String(((responseJson.createResult as Record<string, unknown>).neris as Record<string, unknown>).neris_id).trim()
          : "";
      const nerisIdFromFallback =
        responseJson?.fallback &&
        typeof responseJson.fallback === "object" &&
        typeof (responseJson.fallback as Record<string, unknown>).usedIncidentNerisId === "string"
          ? String((responseJson.fallback as Record<string, unknown>).usedIncidentNerisId).trim()
          : "";
      const nerisId =
        nerisIdFromNeris ||
        nerisIdFromCreateResult ||
        nerisIdFromFallback ||
        "";

      return {
        exportedAtIso,
        exportedAtLabel,
        attemptStatus: "success",
        httpStatus: response.status,
        httpStatusText: response.statusText,
        nerisId,
        submittedEntityId,
        submittedDepartmentNerisId,
        statusLabel: `${response.status} ${response.statusText}`.trim(),
        responseSummary: responseSummary || "Export submitted successfully.",
        responseDetail,
        submittedPayloadPreview,
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw createExportRequestError(
          "Export timed out after 20 seconds. If using local proxy, confirm `npm run proxy` is running, then retry.",
          {
            httpStatus: 0,
            httpStatusText: "Timeout",
            submittedEntityId: getRequestedEntityId(requestConfig),
            submittedDepartmentNerisId: (formValues.fd_neris_id ?? "").trim(),
            responseSummary: "Request timed out before receiving response from export endpoint.",
            responseDetail: "",
            submittedPayloadPreview: toPrettyJson(requestConfig.payload),
          },
        );
      }
      const reason = error instanceof Error ? error.message : "Unknown export error.";
      if (reason.includes("Failed to fetch")) {
        throw createExportRequestError(
          isProxyRequest
            ? "Export request could not reach local proxy. Start it with `npm run proxy`, then retry."
            : "Export request could not reach the endpoint (network/CORS/proxy issue). Check endpoint URL and server logs.",
          {
            httpStatus: 0,
            httpStatusText: "Network Error",
            submittedEntityId: getRequestedEntityId(requestConfig),
            submittedDepartmentNerisId: (formValues.fd_neris_id ?? "").trim(),
            responseSummary: "Network failure (no response body).",
            responseDetail: "",
            submittedPayloadPreview: toPrettyJson(requestConfig.payload),
          },
        );
      }
      if (
        error &&
        typeof error === "object" &&
        "httpStatus" in error
      ) {
        throw error as ExportRequestError;
      }
      throw createExportRequestError(reason, {
        httpStatus: 0,
        httpStatusText: "Unexpected Error",
        submittedEntityId: getRequestedEntityId(requestConfig),
        submittedDepartmentNerisId: (formValues.fd_neris_id ?? "").trim(),
        responseSummary: reason,
        responseDetail: "",
        submittedPayloadPreview: toPrettyJson(requestConfig.payload),
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const appendExportHistoryRecord = (
    exportResult: ExportExecutionResult,
    validatorNameOverride: string,
    statusAtExport: string,
  ) => {
    appendNerisExportRecord({
      id: `${detailForSideEffects.callNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      callNumber: detailForSideEffects.callNumber,
      incidentType: detailForSideEffects.incidentType,
      address: detailForSideEffects.address,
      exportedAtIso: exportResult.exportedAtIso,
      exportedAtLabel: exportResult.exportedAtLabel,
      attemptStatus: exportResult.attemptStatus,
      httpStatus: exportResult.httpStatus,
      httpStatusText: exportResult.httpStatusText,
      statusLabel: exportResult.statusLabel || "Submitted",
      reportStatusAtExport: statusAtExport,
      validatorName: validatorNameOverride.trim(),
      reportWriterName: buildReportWriterName(),
      submittedEntityId: exportResult.submittedEntityId,
      submittedDepartmentNerisId: exportResult.submittedDepartmentNerisId,
      nerisId: exportResult.nerisId,
      responseSummary: exportResult.responseSummary,
      responseDetail: exportResult.responseDetail,
      submittedPayloadPreview: exportResult.submittedPayloadPreview,
    });
  };

  const appendFailedExportHistoryRecord = (
    error: unknown,
    validatorNameOverride: string,
    statusAtExport: string,
  ) => {
    const metadata =
      error && typeof error === "object" ? (error as ExportRequestError) : null;
    const exportedAtDate = new Date();
    const exportedAtIso = exportedAtDate.toISOString();
    const exportedAtLabel = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(exportedAtDate);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown export error.";
    const httpStatus = typeof metadata?.httpStatus === "number" ? metadata.httpStatus : 0;
    const httpStatusText =
      typeof metadata?.httpStatusText === "string" ? metadata.httpStatusText : "Error";
    appendNerisExportRecord({
      id: `${detailForSideEffects.callNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      callNumber: detailForSideEffects.callNumber,
      incidentType: detailForSideEffects.incidentType,
      address: detailForSideEffects.address,
      exportedAtIso,
      exportedAtLabel,
      attemptStatus: "failed",
      httpStatus,
      httpStatusText,
      statusLabel: `${httpStatus || "Error"} ${httpStatusText}`.trim(),
      reportStatusAtExport: statusAtExport,
      validatorName: validatorNameOverride.trim(),
      reportWriterName: buildReportWriterName(),
      submittedEntityId:
        typeof metadata?.submittedEntityId === "string" ? metadata.submittedEntityId : "",
      submittedDepartmentNerisId:
        typeof metadata?.submittedDepartmentNerisId === "string"
          ? metadata.submittedDepartmentNerisId
          : (formValues.fd_neris_id ?? "").trim(),
      nerisId: "",
      responseSummary:
        typeof metadata?.responseSummary === "string" && metadata.responseSummary.trim().length > 0
          ? metadata.responseSummary
          : errorMessage,
      responseDetail:
        typeof metadata?.responseDetail === "string" ? metadata.responseDetail : "",
      submittedPayloadPreview:
        typeof metadata?.submittedPayloadPreview === "string"
          ? metadata.submittedPayloadPreview
          : "",
    });
  };

  const handleExportReport = async () => {
    setValidationModal(null);
    setErrorMessage("");
    setSaveMessage("Export in progress...");
    setIsExporting(true);
    try {
      const requestConfig = buildExportRequestConfig();
      const exportResult = await executeExport(requestConfig);
      appendExportHistoryRecord(exportResult, "", reportStatus);
      const successMessage =
        exportResult.nerisId
          ? `Report export accepted for ${detailForSideEffects.callNumber} at ${exportResult.exportedAtLabel}. NERIS ID: ${exportResult.nerisId}`
          : `Report export submitted for ${detailForSideEffects.callNumber} at ${exportResult.exportedAtLabel}.`;
      const formValuesOverride =
        exportResult.nerisId?.trim()
          ? { incident_neris_id: exportResult.nerisId.trim() }
          : undefined;
      stampSavedAt("manual", "Exported", successMessage, formValuesOverride);
      setSaveMessage(successMessage);
    } catch (error) {
      appendFailedExportHistoryRecord(error, "", reportStatus);
      setSaveMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Unknown export error.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleGetIncidentTest = async () => {
    setValidationModal(null);
    setErrorMessage("");
    setSaveMessage("Get Incident test in progress...");
    setIncidentTestResponseDetail("");
    setIncidentCompareRows([]);
    setUnmappedFilledFieldLabels([]);
    setIsFetchingIncidentTest(true);
    try {
      const requestConfig = buildExportRequestConfig();
      if (!requestConfig.isProxyRequest || !requestConfig.exportUrl.includes("/api/neris/export")) {
        throw new Error(
          "Get Incident test requires proxy mode. Set Export URL to /api/neris/export, then retry.",
        );
      }

      const requestedEntityId = getRequestedEntityId(requestConfig).trim();
      if (!requestedEntityId) {
        throw new Error(
          "Missing NERIS entity ID. Set this tenant's NERIS entity in Department Details or pass integration.entityId.",
        );
      }

      const incidentNerisId = getExistingIncidentNerisIdHint();
      if (!NERIS_INCIDENT_ID_PATTERN.test(incidentNerisId)) {
        throw new Error(
          "No valid incident NERIS ID is available yet. Export this report once, then run Get Incident.",
        );
      }

      const getIncidentUrl = requestConfig.exportUrl.replace(
        "/api/neris/export",
        "/api/neris/debug/incident",
      );
      const query = new URLSearchParams({
        entityId: requestedEntityId,
        incidentNerisId,
      });
      const response = await fetch(`${getIncidentUrl}?${query.toString()}`, {
        method: "GET",
      });
      const responseText = await response.text();
      const responseJson = parseJsonResponseText(responseText);
      const responseDetail = responseJson ? toPrettyJson(responseJson) : responseText;
      setIncidentTestResponseDetail(responseDetail);

      if (!response.ok) {
        const summary =
          typeof responseJson?.message === "string" && responseJson.message.trim().length > 0
            ? responseJson.message.trim()
            : `${response.status} ${response.statusText}`;
        throw new Error(`Get Incident failed (${response.status} ${response.statusText}). ${summary}`);
      }

      const responseIncidentId =
        typeof responseJson?.incidentNerisId === "string" &&
        responseJson.incidentNerisId.trim().length > 0
          ? responseJson.incidentNerisId.trim()
          : incidentNerisId;
      const retrievedIncident =
        responseJson?.neris && typeof responseJson.neris === "object"
          ? (responseJson.neris as Record<string, unknown>)
          : null;
      if (retrievedIncident) {
        const submittedPayload = readLatestSubmittedPayloadForCompare();
        if (submittedPayload) {
          setIncidentCompareRows(buildIncidentCompareRows(submittedPayload, retrievedIncident));
        }
      }
      setUnmappedFilledFieldLabels(collectUnmappedFilledFieldLabels());
      setSaveMessage(
        `Get Incident succeeded for ${responseIncidentId}. Full response is shown below.`,
      );
    } catch (error) {
      setSaveMessage("");
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected Get Incident test error.",
      );
    } finally {
      setIsFetchingIncidentTest(false);
    }
  };

  const handleValidationModalClose = () => {
    setValidationModal(null);
  };

  const handleDeleteConfirmClose = () => {
    setDeleteConfirmOpen(false);
  };

  const handleDeleteIncident = async () => {
    try {
      await onDeleteIncidentCall(callNumber, "Deleted from NERIS report form.");
    } finally {
      setDeleteConfirmOpen(false);
      navigate("/reporting/neris");
    }
  };

  const printSummarySections = useMemo((): PrintSummarySection[] => {
    const normalizeForOptionLookup = (value: string) =>
      value.trim().replace(/\s+/g, "_").replace(/\//g, "_").toUpperCase();

    const formatFieldValueForPrint = (field: NerisFieldMetadata, raw: string): string => {
      const value = raw.trim();
      if (!value) return "";
      if (!field.optionsKey) return value;
      const options = getNerisValueOptions(field.optionsKey);
      const byValue = new Map(
        options.map((option) => [normalizeForOptionLookup(option.value), option.label] as const),
      );
      const parts =
        field.inputKind === "multiselect"
          ? value
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean)
          : [value];
      const mapped = parts.map((part) => byValue.get(normalizeForOptionLookup(part)) ?? part);
      return mapped.join(", ");
    };

    const sections: PrintSummarySection[] = [];
    for (const section of NERIS_FORM_SECTIONS) {
      const fields = getNerisFieldsForSection(section.id);
      const rows: PrintSummaryRow[] = [];
      for (const field of fields) {
        const raw = String(formValues[field.id] ?? "");
        const formatted = formatFieldValueForPrint(field, raw);
        if (!formatted) continue;
        rows.push({ label: field.label, value: formatted });
      }
      if (rows.length > 0) {
        sections.push({ id: section.id, title: section.label, rows });
      }
    }

    const aidRows: PrintSummaryRow[] = [];
    additionalAidEntries.forEach((entry, index) => {
      const bits = [entry.aidDirection, entry.aidType, entry.aidDepartment]
        .map((value) => value.trim())
        .filter(Boolean);
      if (bits.length > 0) {
        aidRows.push({ label: `Aid (FD) #${index + 1}`, value: bits.join(" • ") });
      }
    });
    additionalNonFdAidEntries.forEach((entry, index) => {
      const value = entry.aidType.trim();
      if (value) {
        aidRows.push({ label: `Aid (Non-FD) #${index + 1}`, value });
      }
    });
    if (aidRows.length > 0) {
      sections.push({ id: "aidSummary", title: "Aid Given / Received", rows: aidRows });
    }

    const resourceRows: PrintSummaryRow[] = [];
    resourceUnits.forEach((unit, index) => {
      const unitBits: string[] = [];
      const unitIdLabel = unit.unitId.trim() || `Unit ${index + 1}`;
      if (unit.unitType.trim()) unitBits.push(`Type: ${unit.unitType.trim()}`);
      if (unit.staffing.trim()) unitBits.push(`Staffing: ${unit.staffing.trim()}`);
      if (unit.responseMode.trim()) unitBits.push(`Response: ${unit.responseMode.trim()}`);
      if (unit.transportMode.trim()) unitBits.push(`Transport: ${unit.transportMode.trim()}`);
      if (unit.dispatchTime.trim()) unitBits.push(`Dispatched: ${unit.dispatchTime.trim()}`);
      if (unit.enrouteTime.trim()) unitBits.push(`Enroute: ${unit.enrouteTime.trim()}`);
      if (unit.stagedTime.trim()) unitBits.push(`Staged: ${unit.stagedTime.trim()}`);
      if (unit.onSceneTime.trim()) unitBits.push(`On Scene: ${unit.onSceneTime.trim()}`);
      if (unit.canceledTime.trim()) unitBits.push(`Canceled: ${unit.canceledTime.trim()}`);
      if (unit.clearTime.trim()) unitBits.push(`Clear: ${unit.clearTime.trim()}`);
      if (unit.personnel.trim()) unitBits.push(`Personnel: ${unit.personnel.trim()}`);
      if (unit.reportWriter.trim()) unitBits.push(`Writer: ${unit.reportWriter.trim()}`);
      if (unit.unitNarrative.trim()) unitBits.push(`Narrative: ${unit.unitNarrative.trim()}`);
      if (unitBits.length > 0) {
        resourceRows.push({ label: unitIdLabel, value: unitBits.join(" | ") });
      }
    });
    if (resourceRows.length > 0) {
      sections.push({ id: "resourceSummary", title: "Resources", rows: resourceRows });
    }

    return sections;
  }, [additionalAidEntries, additionalNonFdAidEntries, formValues, resourceUnits]);

  const handlePrintSummary = () => {
    if (typeof window === "undefined") return;
    setPrintSummaryOpen(true);
    document.body.classList.add("printing-neris");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  };

  useEffect(() => {
    if (!printSummaryOpen || typeof window === "undefined") {
      return;
    }
    const cleanup = () => {
      document.body.classList.remove("printing-neris");
      setPrintSummaryOpen(false);
    };
    window.addEventListener("afterprint", cleanup);
    const fallback = window.setTimeout(cleanup, 8_000);
    return () => {
      window.removeEventListener("afterprint", cleanup);
      window.clearTimeout(fallback);
    };
  }, [printSummaryOpen]);

  const handleValidationModalReturn = () => {
    setValidationModal(null);
    navigate("/reporting/neris");
  };

  const handleValidationModalFixIssues = () => {
    setValidationModal(null);
    setActiveSectionId("core");
  };

  const handleSaveDraft = () => {
    setSectionErrors({});
    setErrorMessage("");
    setValidationIssues([]);
    setValidationModal(null);
    stampSavedAt("manual");
  };

  const handleUnlock = () => {
    setSectionErrors({});
    setErrorMessage("");
    setSaveMessage("");
    stampSavedAt("manual", "Draft", "Report unlocked. You can edit again.");
  };

  const goToNextSection = () => {
    if (!hasNextSection) {
      return;
    }
    setSectionErrors({});
    setErrorMessage("");
    setValidationIssues([]);
    setValidationModal(null);
    stampSavedAt("auto");
    const nextSection = visibleNerisSections[sectionIndex + 1];
    if (nextSection) {
      setActiveSectionId(nextSection.id);
    }
  };

  const handleBack = () => {
    if (sectionIndex > 0) {
      const previousSection = visibleNerisSections[sectionIndex - 1];
      if (previousSection) {
        setActiveSectionId(previousSection.id);
      }
      return;
    }
    navigate("/reporting/neris");
  };

  const addAdditionalAidEntry = () => {
    setPendingAdditionalAid("fd");
    setValidationModal(null);
  };

  const updateAdditionalAidEntry = (
    index: number,
    field: keyof AidEntry,
    nextValue: string,
  ) => {
    setAdditionalAidEntries((previous) =>
      previous.map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              [field]: nextValue,
            }
          : entry,
      ),
    );
    setSaveMessage("");
    setErrorMessage("");
    setValidationIssues([]);
    setValidationModal(null);
    if (reportStatus !== "Draft") {
      setReportStatus("Draft");
    }
  };

  const addAdditionalNonFdAidEntry = () => {
    setPendingAdditionalAid("nonfd");
    setValidationModal(null);
  };

  const commitPendingAdditionalAidAs = (kind: "FIRE_DEPARTMENT" | "NON_FD_AID") => {
    if (kind === "FIRE_DEPARTMENT") {
      setAdditionalAidEntries((previous) => [...previous, { ...EMPTY_AID_ENTRY }]);
    } else {
      setAdditionalNonFdAidEntries((previous) => [...previous, { ...EMPTY_NONFD_AID_ENTRY }]);
    }
    setPendingAdditionalAid(null);
    setValidationModal(null);
  };

  const updateAdditionalNonFdAidEntry = (index: number, nextValue: string) => {
    setAdditionalNonFdAidEntries((previous) =>
      previous.map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              aidType: nextValue,
            }
          : entry,
      ),
    );
    setSaveMessage("");
    setErrorMessage("");
    setValidationIssues([]);
    setValidationModal(null);
    if (reportStatus !== "Draft") {
      setReportStatus("Draft");
    }
  };

  const renderNerisField = (field: NerisFieldMetadata, fieldKey?: string) => {
    const inputId = `neris-field-${field.id}`;
    const value = formValues[field.id] ?? "";
    const isRequired = isNerisFieldRequired(field, formValues);
    const options = field.optionsKey ? getNerisValueOptions(field.optionsKey) : [];
    const error = sectionErrors[field.id];
    const wrapperClassName = field.layout === "full" ? "field-span-two" : undefined;
    const normalizedSingleValue = normalizeNerisEnumValue(value);
    const isPrimaryIncidentTypeField =
      field.id === "primary_incident_type" &&
      field.inputKind === "select" &&
      field.optionsKey === "incident_type";
    const isAdditionalIncidentTypesField =
      field.id === "additional_incident_types" &&
      field.inputKind === "multiselect" &&
      field.optionsKey === "incident_type";
    const isActionsTakenField =
      field.id === "incident_actions_taken" &&
      field.inputKind === "multiselect" &&
      field.optionsKey === "action_tactic";
    const isSpecialIncidentModifiersField =
      field.id === "special_incident_modifiers" &&
      field.inputKind === "multiselect" &&
      field.optionsKey === "incident_modifier";
    const isLocationUseField =
      (field.id === "location_use_primary" || field.id === "location_use_secondary") &&
      field.inputKind === "select" &&
      field.optionsKey === "location_use";
    const isLocationInUseField =
      field.id === "location_in_use" &&
      field.inputKind === "select" &&
      field.optionsKey === "yes_no";
    const isLocationUsedAsIntendedField =
      field.id === "location_used_as_intended" &&
      field.inputKind === "select" &&
      field.optionsKey === "yes_no";
    const isNoActionReasonField =
      field.id === "incident_noaction" &&
      field.inputKind === "select" &&
      field.optionsKey === "no_action";
    const isAutomaticAlarmField =
      field.id === "dispatch_automatic_alarm" &&
      field.inputKind === "select" &&
      field.optionsKey === "yes_no";
    const isPeoplePresentField =
      field.id === "incident_people_present" &&
      field.inputKind === "select" &&
      field.optionsKey === "yes_no";
    const isDisplacedNumberField =
      field.id === "incident_displaced_number" && field.inputKind === "text";
    const isDisplacementCauseField =
      field.id === "incident_displaced_cause" &&
      field.inputKind === "multiselect" &&
      field.optionsKey === "displace_cause_incident";
    const isAidGivenQuestionField =
      field.id === "incident_has_aid" &&
      field.inputKind === "select" &&
      field.optionsKey === "yes_no";
    const isAidAgencyTypeField =
      field.id === "incident_aid_agency_type" &&
      field.inputKind === "select" &&
      field.optionsKey === "aid_agency_type";
    const isAidDirectionField =
      field.id === "incident_aid_direction" &&
      field.inputKind === "select" &&
      field.optionsKey === "aid_direction";
    const isAidTypeField =
      field.id === "incident_aid_type" &&
      field.inputKind === "select" &&
      field.optionsKey === "aid_type";
    const isAidDepartmentField =
      field.id === "incident_aid_department_name" &&
      field.inputKind === "select" &&
      field.optionsKey === "aid_department";
    const isAidNonFdField =
      field.id === "incident_aid_nonfd" &&
      field.inputKind === "multiselect" &&
      field.optionsKey === "aid_nonfd";
    const isAidManagedHiddenField =
      isAidAgencyTypeField ||
      isAidDirectionField ||
      isAidTypeField ||
      isAidDepartmentField ||
      isAidNonFdField;
    const hasNoActionSelected = (formValues.incident_noaction ?? "").trim().length > 0;
    const isNoActionReasonDisabled = (formValues.incident_actions_taken ?? "").trim().length > 0;
    const isActionsTakenDisabled = hasNoActionSelected;
    const isSingleChoiceButtonField =
      isNoActionReasonField ||
      isAutomaticAlarmField ||
      isPeoplePresentField ||
      isLocationInUseField ||
      isLocationUsedAsIntendedField;
    const displacedNumberValue = Number.parseInt(
      (formValues.incident_displaced_number ?? "").trim(),
      10,
    );
    const selectedPrimaryAidDepartment = (formValues.incident_aid_department_name ?? "").trim();
    const selectedAdditionalAidDepartments = additionalAidEntries
      .map((entry) => entry.aidDepartment.trim())
      .filter((entry) => entry.length > 0);
    const selectedPrimaryNonFdAidTypes = (formValues.incident_aid_nonfd ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    const selectedAdditionalNonFdAidTypes = additionalNonFdAidEntries
      .map((entry) => entry.aidType.trim())
      .filter((entry) => entry.length > 0);

    if (
      field.id === "incident_displaced_cause" &&
      (Number.isNaN(displacedNumberValue) || displacedNumberValue <= 0)
    ) {
      return null;
    }
    if (isDisplacedNumberField && (formValues.incident_people_present ?? "") !== "YES") {
      return null;
    }
    if (isAidManagedHiddenField) {
      return null;
    }
    if (field.id === "location_direction_of_travel" && !showDirectionOfTravelField) {
      return null;
    }
    if (field.id === "location_cross_street_type" && !showCrossStreetTypeField) {
      return null;
    }
    if (field.id === "location_cross_street_name" && !showCrossStreetTypeField) {
      return null;
    }
    if (
      isLocationUsedAsIntendedField &&
      (formValues.location_in_use ?? "").trim() !== "YES"
    ) {
      return null;
    }
    if (
      field.id === "location_vacancy_cause" &&
      (formValues.location_in_use ?? "").trim() !== "NO"
    ) {
      return null;
    }
    if (currentSection.id === "resources" && field.id.startsWith("resource_")) {
      return null;
    }
    if (currentSection.id === "riskReduction") {
      return null;
    }
    if (
      currentSection.id === "emergingHazards" &&
      [
        "emerg_haz_electric_type",
        "emerg_haz_pv_type",
        "emerg_haz_pv_source_target",
        "emerg_haz_suppression_methods",
      ].includes(field.id)
    ) {
      return null;
    }

    return (
      <div key={fieldKey} className={wrapperClassName}>
        {!isAidGivenQuestionField ? (
          <label
            htmlFor={inputId}
            className={isNoActionReasonField ? "neris-field-label-italic" : undefined}
          >
            {field.label}
            {isRequired ? " *" : ""}
          </label>
        ) : null}

        {field.inputKind === "textarea" ? (
          <textarea
            id={inputId}
            rows={field.rows ?? 6}
            value={value}
            placeholder={field.placeholder}
            onChange={(event) => updateFieldValue(field.id, event.target.value)}
          />
        ) : null}

        {(field.inputKind === "text" ||
          field.inputKind === "date" ||
          field.inputKind === "time" ||
          field.inputKind === "datetime" ||
          field.inputKind === "readonly") ? (
          (() => {
            const allowAdminEditReadonly =
              field.id === "incident_neris_id" && isAdminOrHigher(role);
            const isReadonlyField = field.inputKind === "readonly" && !allowAdminEditReadonly;
            return (
          <input
            id={inputId}
            type={
              field.inputKind === "readonly"
                ? "text"
                : field.inputKind === "datetime"
                  ? "datetime-local"
                  : field.inputKind
            }
            step={field.inputKind === "time" ? 1 : undefined}
            readOnly={isReadonlyField}
            value={value}
            placeholder={field.placeholder}
            onChange={(event) => updateFieldValue(field.id, event.target.value)}
          />
            );
          })()
        ) : null}

        {isAidGivenQuestionField ? (
          <div className="neris-aid-block">
            <div className="neris-aid-question">
              <label>Was aid given or received?</label>
              <div className="neris-single-choice-row" role="group" aria-label="Was aid given or received?">
                {getNerisValueOptions("yes_no").map((option) => {
                  const isSelected = option.value === (formValues.incident_has_aid ?? "");
                  return (
                    <button
                      key={`incident-has-aid-${option.value}`}
                      type="button"
                      className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                      aria-pressed={isSelected}
                      onClick={() =>
                        updateFieldValue(
                          "incident_has_aid",
                          togglePillValue(formValues.incident_has_aid ?? "", option.value),
                        )
                      }
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {sectionErrors.incident_has_aid ? (
                <small className="field-error">{sectionErrors.incident_has_aid}</small>
              ) : null}
            </div>

            {(formValues.incident_has_aid ?? "") === "YES" ? (
              <div className="neris-aid-question">
                <label>Aid Type</label>
                <div className="neris-single-choice-row" role="group" aria-label="Aid Type">
                  {getNerisValueOptions("aid_agency_type").map((option) => {
                    const isSelected = option.value === (formValues.incident_aid_agency_type ?? "");
                    return (
                      <button
                        key={`incident-aid-agency-${option.value}`}
                        type="button"
                        className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                        aria-pressed={isSelected}
                        onClick={() =>
                          updateFieldValue(
                            "incident_aid_agency_type",
                            togglePillValue(
                              formValues.incident_aid_agency_type ?? "",
                              option.value,
                            ),
                          )
                        }
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {sectionErrors.incident_aid_agency_type ? (
                  <small className="field-error">{sectionErrors.incident_aid_agency_type}</small>
                ) : null}
              </div>
            ) : null}

            {(formValues.incident_has_aid ?? "") === "YES" &&
            (formValues.incident_aid_agency_type ?? "") === "NON_FD_AID" ? (
              <div className="neris-aid-question">
                <label>Non FD Aid</label>
                <NerisFlatMultiOptionSelect
                  inputId={`${inputId}-nonfd`}
                  value={formValues.incident_aid_nonfd ?? ""}
                  options={getNerisValueOptions("aid_nonfd")}
                  onChange={(nextValue) => updateFieldValue("incident_aid_nonfd", nextValue)}
                  placeholder="Select non FD aid"
                  searchPlaceholder="Search non FD aid..."
                />
                {sectionErrors.incident_aid_nonfd ? (
                  <small className="field-error">{sectionErrors.incident_aid_nonfd}</small>
                ) : null}
                {additionalNonFdAidEntries.map((entry, entryIndex) => (
                  <div
                    key={`additional-nonfd-aid-${entryIndex}`}
                    className="neris-additional-aid-entry"
                  >
                    <label className="neris-aid-subfield-label">Aid Type</label>
                    <NerisFlatSingleOptionSelect
                      inputId={`${inputId}-additional-nonfd-aid-type-${entryIndex}`}
                      value={entry.aidType}
                      options={getNerisValueOptions("aid_nonfd")}
                      onChange={(nextValue) =>
                        updateAdditionalNonFdAidEntry(entryIndex, nextValue)
                      }
                      placeholder="Select non FD aid type"
                      searchPlaceholder="Search non FD aid types..."
                      isOptionDisabled={(optionValue) => {
                        if (optionValue === entry.aidType) {
                          return false;
                        }
                        if (selectedPrimaryNonFdAidTypes.includes(optionValue)) {
                          return true;
                        }
                        return selectedAdditionalNonFdAidTypes.includes(optionValue);
                      }}
                    />
                  </div>
                ))}
                {pendingAdditionalAid === "nonfd" ? (
                  <div className="neris-additional-aid-entry neris-additional-aid-pending">
                    <label className="neris-aid-subfield-label">Aid Type</label>
                    <div className="neris-single-choice-row" role="group" aria-label="Additional aid type">
                      {getNerisValueOptions("aid_agency_type").map((option) => (
                        <button
                          key={`pending-aid-type-${option.value}`}
                          type="button"
                          className="neris-single-choice-button"
                          onClick={() => commitPendingAdditionalAidAs(option.value as "FIRE_DEPARTMENT" | "NON_FD_AID")}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="neris-link-button"
                  onClick={addAdditionalNonFdAidEntry}
                >
                  Add Additional Aid Type -&gt; RL
                </button>
              </div>
            ) : null}

            {(formValues.incident_has_aid ?? "") === "YES" &&
            (formValues.incident_aid_agency_type ?? "") === "FIRE_DEPARTMENT" ? (
              <div className="neris-aid-question">
                <label>Aid direction</label>
                <div className="neris-single-choice-row" role="group" aria-label="Aid direction">
                  {getNerisValueOptions("aid_direction").map((option) => {
                    const isSelected = option.value === (formValues.incident_aid_direction ?? "");
                    return (
                      <button
                        key={`incident-aid-direction-${option.value}`}
                        type="button"
                        className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                        aria-pressed={isSelected}
                        onClick={() =>
                          updateFieldValue(
                            "incident_aid_direction",
                            togglePillValue(
                              formValues.incident_aid_direction ?? "",
                              option.value,
                            ),
                          )
                        }
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {sectionErrors.incident_aid_direction ? (
                  <small className="field-error">{sectionErrors.incident_aid_direction}</small>
                ) : null}

                <label className="neris-aid-subfield-label">Aid Type</label>
                <NerisFlatSingleOptionSelect
                  inputId={`${inputId}-aid-type`}
                  value={formValues.incident_aid_type ?? ""}
                  options={getNerisValueOptions("aid_type")}
                  onChange={(nextValue) => updateFieldValue("incident_aid_type", nextValue)}
                  placeholder="Select aid type"
                  searchPlaceholder="Search aid types..."
                />
                {sectionErrors.incident_aid_type ? (
                  <small className="field-error">{sectionErrors.incident_aid_type}</small>
                ) : null}

                <label className="neris-aid-subfield-label">Aid department name(s)</label>
                <NerisFlatSingleOptionSelect
                  inputId={`${inputId}-aid-department`}
                  value={formValues.incident_aid_department_name ?? ""}
                  options={aidDepartmentOptions}
                  onChange={(nextValue) =>
                    updateFieldValue("incident_aid_department_name", nextValue)
                  }
                  placeholder="Select aid department"
                  searchPlaceholder="Search aid departments..."
                  isOptionDisabled={(optionValue) =>
                    optionValue !== selectedPrimaryAidDepartment &&
                    selectedAdditionalAidDepartments.includes(optionValue)
                  }
                />
                {sectionErrors.incident_aid_department_name ? (
                  <small className="field-error">{sectionErrors.incident_aid_department_name}</small>
                ) : null}

                <>
                  {additionalAidEntries.map((entry, entryIndex) => (
                    <div key={`additional-aid-${entryIndex}`} className="neris-additional-aid-entry">
                      <label className="neris-aid-subfield-label">Aid direction</label>
                      <div
                        className="neris-single-choice-row"
                        role="group"
                        aria-label="Additional aid direction"
                      >
                        {getNerisValueOptions("aid_direction").map((option) => {
                          const isSelected = option.value === entry.aidDirection;
                          return (
                            <button
                              key={`additional-aid-direction-${entryIndex}-${option.value}`}
                              type="button"
                              className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                              aria-pressed={isSelected}
                              onClick={() =>
                                updateAdditionalAidEntry(
                                  entryIndex,
                                  "aidDirection",
                                  togglePillValue(entry.aidDirection, option.value),
                                )
                              }
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>

                      <label className="neris-aid-subfield-label">Aid Type</label>
                      <NerisFlatSingleOptionSelect
                        inputId={`${inputId}-additional-aid-type-${entryIndex}`}
                        value={entry.aidType}
                        options={getNerisValueOptions("aid_type")}
                        onChange={(nextValue) =>
                          updateAdditionalAidEntry(entryIndex, "aidType", nextValue)
                        }
                        placeholder="Select aid type"
                        searchPlaceholder="Search aid types..."
                      />

                      <label className="neris-aid-subfield-label">Aid department name(s)</label>
                      <NerisFlatSingleOptionSelect
                        inputId={`${inputId}-additional-aid-department-${entryIndex}`}
                        value={entry.aidDepartment}
                        options={aidDepartmentOptions}
                        onChange={(nextValue) =>
                          updateAdditionalAidEntry(entryIndex, "aidDepartment", nextValue)
                        }
                        placeholder="Select aid department"
                        searchPlaceholder="Search aid departments..."
                        isOptionDisabled={(optionValue) => {
                          if (optionValue === entry.aidDepartment) {
                            return false;
                          }
                          if (selectedPrimaryAidDepartment === optionValue) {
                            return true;
                          }
                          return additionalAidEntries.some(
                            (candidateEntry, candidateIndex) =>
                              candidateIndex !== entryIndex &&
                              candidateEntry.aidDepartment.trim() === optionValue,
                          );
                        }}
                      />
                    </div>
                  ))}

                  {pendingAdditionalAid === "fd" ? (
                    <div className="neris-additional-aid-entry neris-additional-aid-pending">
                      <label className="neris-aid-subfield-label">Aid Type</label>
                      <div className="neris-single-choice-row" role="group" aria-label="Additional aid type">
                        {getNerisValueOptions("aid_agency_type").map((option) => (
                          <button
                            key={`pending-aid-type-fd-${option.value}`}
                            type="button"
                            className="neris-single-choice-button"
                            onClick={() => commitPendingAdditionalAidAs(option.value as "FIRE_DEPARTMENT" | "NON_FD_AID")}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="neris-link-button"
                    onClick={addAdditionalAidEntry}
                  >
                    Add Additional Aid Type -&gt; RL
                  </button>
                </>
              </div>
            ) : null}
          </div>
        ) : null}

        {field.inputKind === "select" ? (
          isAidGivenQuestionField ? null : isSingleChoiceButtonField ? (
            <div
              className={`neris-single-choice-row${
                isNoActionReasonField && isNoActionReasonDisabled ? " disabled" : ""
              }`}
              role="group"
              aria-label={field.label}
              aria-disabled={isNoActionReasonField && isNoActionReasonDisabled}
            >
              {options.map((option) => {
                const isSelected = option.value === normalizedSingleValue;
                const isDisabled = isNoActionReasonField && isNoActionReasonDisabled;
                return (
                  <button
                    key={`${field.id}-${option.value}`}
                    type="button"
                    className={`neris-single-choice-button${isSelected ? " selected" : ""}${
                      isDisabled ? " disabled" : ""
                    }`}
                    aria-pressed={isSelected}
                    disabled={isDisabled}
                    onClick={() => {
                      if (isDisabled) {
                        return;
                      }
                      updateFieldValue(
                        field.id,
                        togglePillValue(normalizedSingleValue, option.value),
                      );
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : isPrimaryIncidentTypeField ? (
            <NerisGroupedOptionSelect
              inputId={inputId}
              value={normalizedSingleValue}
              options={options}
              onChange={(nextValue) => updateFieldValue(field.id, nextValue)}
              mode="single"
              variant="incidentType"
              placeholder=""
              searchPlaceholder="Search incident types..."
            />
          ) : isLocationUseField ? (
            <NerisGroupedOptionSelect
              inputId={inputId}
              value={normalizedSingleValue}
              options={options}
              onChange={(nextValue) => updateFieldValue(field.id, nextValue)}
              mode="single"
              variant="incidentType"
              placeholder={`Select ${field.label.toLowerCase()}`}
              searchPlaceholder={`Search ${field.label.toLowerCase()}...`}
            />
          ) : (
            <NerisFlatSingleOptionSelect
              inputId={inputId}
              value={normalizedSingleValue}
              options={options}
              onChange={(nextValue) => updateFieldValue(field.id, nextValue)}
              placeholder={`Select ${field.label.toLowerCase()}`}
              searchPlaceholder={`Search ${field.label.toLowerCase()}...`}
              allowClear={!isRequired}
            />
          )
        ) : null}

        {field.inputKind === "multiselect" ? (
          isAdditionalIncidentTypesField ? (
            <NerisGroupedOptionSelect
              inputId={inputId}
              value={value}
              options={options}
              onChange={(nextValue) => updateFieldValue(field.id, nextValue)}
              mode="multi"
              variant="incidentType"
              placeholder="Select up to 2 incident types"
              searchPlaceholder="Search incident types..."
              maxSelections={2}
              showCheckboxes
            />
          ) : isSpecialIncidentModifiersField ? (
            <NerisFlatMultiOptionSelect
              inputId={inputId}
              value={value}
              options={options}
              onChange={(nextValue) => updateFieldValue(field.id, nextValue)}
              placeholder="Select special incident modifier(s)"
              searchPlaceholder="Search special modifiers..."
            />
          ) : isDisplacementCauseField ? (
            <NerisFlatMultiOptionSelect
              inputId={inputId}
              value={value}
              options={options}
              onChange={(nextValue) => updateFieldValue(field.id, nextValue)}
              placeholder="Select displacement cause(s)"
              searchPlaceholder="Search displacement causes..."
            />
          ) : isActionsTakenField ? (
            <NerisGroupedOptionSelect
              inputId={inputId}
              value={value}
              options={options}
              onChange={(nextValue) => updateFieldValue(field.id, nextValue)}
              mode="multi"
              variant="actionTactic"
              placeholder="Select action(s) taken"
              searchPlaceholder="Search actions..."
              showCheckboxes
              disabled={isActionsTakenDisabled}
            />
          ) : (
            <NerisFlatMultiOptionSelect
              inputId={inputId}
              value={value}
              options={options}
              onChange={(nextValue) => updateFieldValue(field.id, nextValue)}
              placeholder={`Select ${field.label.toLowerCase()}`}
              searchPlaceholder={`Search ${field.label.toLowerCase()}...`}
            />
          )
        ) : null}

        {field.helperText ? <small className="field-hint">{field.helperText}</small> : null}

        {field.maxLength ? (
          <small className="field-hint">
            {value.length} / {field.maxLength} characters
          </small>
        ) : null}

        {error ? <small className="field-error">{error}</small> : null}
      </div>
    );
  };

  const compareMatchedCount = incidentCompareRows.filter((row) => row.status === "match").length;
  const compareNeedsReviewCount = incidentCompareRows.length - compareMatchedCount;
  const visibleUnmappedFieldLabels = unmappedFilledFieldLabels.slice(0, 8);
  const hiddenUnmappedFieldCount = Math.max(
    0,
    unmappedFilledFieldLabels.length - visibleUnmappedFieldLabels.length,
  );

  if (!detail) {
    return (
      <section className="page-section">
        <header className="page-header">
          <div>
            <h1>NERIS report not found</h1>
            <p>No matching incident exists for report ID {callNumber}.</p>
          </div>
          <div className="header-actions">
            <NavLink className="secondary-button button-link" to="/reporting/neris">
              Back to NERIS Queue
            </NavLink>
          </div>
        </header>
      </section>
    );
  }

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>{detail.callNumber}</h1>
          <p>
            <strong>{detail.incidentType}</strong> at {detail.address}
          </p>
          <div className="neris-incident-meta">
            <span>
              Incident date <strong>{formValues.incident_onset_date || "Not set"}</strong>
            </span>
            <span>
              Last saved <strong>{lastSavedAt}</strong>
            </span>
            <span>
              Status{" "}
              <strong className={toToneClass(toneFromNerisStatus(reportStatus))}>
                {reportStatus}
              </strong>
            </span>
          </div>
          {saveMessage ? <p className="save-message neris-header-feedback">{saveMessage}</p> : null}
          {errorMessage ? <p className="auth-error neris-header-feedback">{errorMessage}</p> : null}
          {incidentCompareRows.length > 0 ? (
            <section className="neris-incident-compare panel" aria-live="polite">
              <div className="neris-incident-compare-header">
                <h2>Submitted vs Retrieved</h2>
                <p>
                  {compareMatchedCount} matched • {compareNeedsReviewCount} need review
                </p>
              </div>
              <div className="neris-incident-compare-list">
                {incidentCompareRows.map((row) => (
                  <article
                    key={row.id}
                    className={`neris-incident-compare-row neris-incident-compare-row-${row.status}`}
                  >
                    <div className="neris-incident-compare-row-top">
                      <h3>{row.label}</h3>
                      <span
                        className={`neris-incident-compare-badge neris-incident-compare-badge-${row.status}`}
                      >
                        {row.status === "match" ? "Matched" : "Needs review"}
                      </span>
                    </div>
                    <div className="neris-incident-compare-values">
                      <div>
                        <span>Submitted</span>
                        <p>{row.submittedValue}</p>
                      </div>
                      <div>
                        <span>Retrieved</span>
                        <p>{row.retrievedValue}</p>
                      </div>
                    </div>
                    {row.helpText ? (
                      <p className="neris-incident-compare-help-text">{row.helpText}</p>
                    ) : null}
                  </article>
                ))}
              </div>
              {visibleUnmappedFieldLabels.length > 0 ? (
                <div className="neris-incident-compare-unmapped">
                  <h3>Form fields with values not yet sent to NERIS</h3>
                  <p>
                    These fields currently have values in Fire Ultimate, but are not mapped into
                    the export payload yet.
                  </p>
                  <div className="neris-incident-compare-unmapped-list">
                    {visibleUnmappedFieldLabels.map((label) => (
                      <span key={`unmapped-${label}`} className="neris-incident-compare-unmapped-pill">
                        {label}
                      </span>
                    ))}
                    {hiddenUnmappedFieldCount > 0 ? (
                      <span className="neris-incident-compare-unmapped-pill">
                        +{hiddenUnmappedFieldCount} more
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
          {incidentTestResponseDetail ? (
            <details className="neris-incident-test-response">
              <summary>Get Incident test response</summary>
              <pre className="export-attempt-json">{incidentTestResponseDetail}</pre>
            </details>
          ) : null}
        </div>
        <div className="header-actions">
          {isAdminOrHigher(role) ? (
            <>
              <button
                type="button"
                className="secondary-button compact-button"
                disabled
                title="Import is not implemented yet."
              >
                Import
              </button>
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={handleGetIncidentTest}
                disabled={isExporting || isFetchingIncidentTest}
              >
                {isFetchingIncidentTest ? "Getting..." : "Get Incident (Test)"}
              </button>
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={handlePrintSummary}
              >
                Print
              </button>
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={isExporting || isFetchingIncidentTest}
              >
                Delete
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="primary-button compact-button"
            onClick={handleCheckForErrors}
            disabled={isExporting || !canEdit}
          >
            Validate
          </button>
          {isAdminOrHigher(role) ? (
            <>
              <button
                type="button"
                className="primary-button compact-button"
                onClick={handleExportReport}
                disabled={isExporting}
              >
                {isExporting ? "Exporting..." : "Export"}
              </button>
              {isLocked ? (
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={handleUnlock}
                >
                  Unlock
                </button>
              ) : null}
            </>
          ) : null}
          <span className={`neris-status-pill ${toToneClass(toneFromNerisStatus(reportStatus))}`}>
            {reportStatus}
          </span>
        </div>
      </header>

      {validationModal ? (
        <div className="validation-modal-backdrop" role="dialog" aria-modal="true">
          <div className="validation-modal panel">
            {validationModal.mode === "checkSuccess" ? (
              <>
                <h2>Check complete</h2>
                <p>
                  No required-field issues were found. Status has been updated to
                  In Review.
                </p>
                <div className="validation-modal-actions">
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    onClick={handleValidationModalClose}
                  >
                    Continue Editing
                  </button>
                  <button
                    type="button"
                    className="primary-button compact-button"
                    onClick={handleValidationModalReturn}
                  >
                    Return to Incidents
                  </button>
                </div>
              </>
            ) : null}
            {validationModal.mode === "issues" ? (
              <>
                <h2>Validation requires updates</h2>
                <p>The following required fields still need values:</p>
                <ul>
                  {validationModal.issues.map((issue: string) => (
                    <li key={`validation-modal-${issue}`}>{issue}</li>
                  ))}
                </ul>
                <div className="validation-modal-actions">
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    onClick={handleValidationModalClose}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="primary-button compact-button"
                    onClick={handleValidationModalFixIssues}
                  >
                    Fix issues now
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {deleteConfirmOpen ? (
        <div
          className="validation-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleDeleteConfirmClose();
            }
          }}
        >
          <div className="validation-modal panel">
            <h2>Delete incident?</h2>
            <p>
              This will remove the incident from Fire Ultimate for this tenant (including the NERIS
              workflow entry). This cannot be undone.
            </p>
            <div className="validation-modal-actions">
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={handleDeleteConfirmClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button compact-button"
                onClick={handleDeleteIncident}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {printSummaryOpen ? (
        <div className="neris-print-root" aria-hidden>
          <div className="neris-print-header">
            <h1>NERIS Report Summary</h1>
            <p>
              {detailForSideEffects.callNumber}
              {detailForSideEffects.address ? ` • ${detailForSideEffects.address}` : ""}
            </p>
          </div>

          {printSummarySections.length > 0 ? (
            <div className="neris-print-sections">
              {printSummarySections.map((section) => (
                <section key={`print-${section.id}`} className="neris-print-section">
                  <h2>{section.title}</h2>
                  <dl>
                    {section.rows.map((row) => (
                      <div key={`${section.id}-${row.label}`} className="neris-print-row">
                        <dt>{row.label}</dt>
                        <dd>{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          ) : (
            <p>No report fields have values yet.</p>
          )}
        </div>
      ) : null}

      {!canEdit ? (
        <div className="neris-lock-banner" role="status">
          This report is locked. Only an admin can unlock it for editing.
        </div>
      ) : null}
      <section className="neris-report-layout">
        <aside className="panel neris-sidebar">
          <div className="neris-sidebar-header">
            <h2>Fire Incidents</h2>
            <p>NERIS sections</p>
          </div>
          <nav className="neris-section-nav" aria-label="NERIS section navigation">
            {visibleNerisSections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={section.id === currentSection.id ? "active" : ""}
                onClick={() => setActiveSectionId(section.id)}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </aside>

        <article
          className={`panel neris-form-panel${!canEdit ? " neris-form-locked" : ""}`}
        >
          {currentSection.id !== "core" &&
          currentSection.id !== "location" &&
          currentSection.id !== "emergingHazards" &&
          currentSection.id !== "riskReduction" ? (
            <div className="panel-header">
              <h2>{currentSection.label}</h2>
            </div>
          ) : null}
          {currentSection.id !== "core" && currentSection.helper.trim().length > 0 ? (
            <p className="panel-description">{currentSection.helper}</p>
          ) : null}
          <div className="settings-form neris-field-grid">
            {currentSection.id === "emergingHazards" ? (
              <section className="field-span-two neris-emerging-hazard-layout">
                <div className="neris-core-field-heading">EMERGING HAZARDS</div>

                <article className="neris-emerging-hazard-group">
                  <div className="neris-emerging-hazard-group-header">
                    <h3 className="neris-core-field-heading">ELECTROCUTION</h3>
                    <button
                      type="button"
                      className="rl-box-button"
                      onClick={addEmergingElectrocutionItem}
                    >
                      + Add item
                    </button>
                  </div>

                  {emergingElectrocutionItems.length ? (
                    <div className="neris-emerging-hazard-item-list">
                      {emergingElectrocutionItems.map((item, itemIndex) => (
                        <div key={item.id} className="neris-emerging-hazard-item-card">
                          <div className="neris-emerging-hazard-item-title">
                            <span>Hazard {itemIndex + 1}</span>
                            <button
                              type="button"
                              className="neris-emerging-hazard-delete-button"
                              aria-label={`Delete electrocution hazard ${itemIndex + 1}`}
                              onClick={() => deleteEmergingElectrocutionItem(item.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="neris-emerging-hazard-field-grid">
                            <div className="neris-emerging-hazard-field">
                              <label>Electrical Hazard Type</label>
                              <NerisGroupedOptionSelect
                                inputId={`${item.id}-electrical-type`}
                                value={item.electricalHazardType}
                                options={getNerisValueOptions("emerg_haz_elec")}
                                onChange={(nextValue) =>
                                  updateEmergingElectrocutionItem(
                                    item.id,
                                    "electricalHazardType",
                                    nextValue,
                                  )
                                }
                                mode="single"
                                variant="incidentType"
                                placeholder="Select electrical hazard type"
                                searchPlaceholder="Search electrical hazard types..."
                              />
                            </div>
                            <div className="neris-emerging-hazard-field">
                              <label>Emerging Hazard Suppression Method(s)</label>
                              <NerisFlatMultiOptionSelect
                                inputId={`${item.id}-electrical-suppression`}
                                value={item.suppressionMethods}
                                options={getNerisValueOptions("emerg_haz_suppression")}
                                onChange={(nextValue) =>
                                  updateEmergingElectrocutionItem(
                                    item.id,
                                    "suppressionMethods",
                                    nextValue,
                                  )
                                }
                                placeholder="Select suppression method(s)"
                                searchPlaceholder="Search suppression methods..."
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>

                <article className="neris-emerging-hazard-group">
                  <div className="neris-emerging-hazard-group-header">
                    <h3 className="neris-core-field-heading">POWER GENERATION</h3>
                    <button
                      type="button"
                      className="rl-box-button"
                      onClick={addEmergingPowerGenerationItem}
                    >
                      + Add item
                    </button>
                  </div>

                  {emergingPowerGenerationItems.length ? (
                    <div className="neris-emerging-hazard-item-list">
                      {emergingPowerGenerationItems.map((item, itemIndex) => (
                        <div key={item.id} className="neris-emerging-hazard-item-card">
                          <div className="neris-emerging-hazard-item-title">
                            <span>Hazard {itemIndex + 1}</span>
                            <button
                              type="button"
                              className="neris-emerging-hazard-delete-button"
                              aria-label={`Delete power generation hazard ${itemIndex + 1}`}
                              onClick={() => deleteEmergingPowerGenerationItem(item.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="neris-emerging-hazard-field-grid">
                            <div className="neris-emerging-hazard-field">
                              <label>Photovoltaic Hazard Type</label>
                              <NerisFlatSingleOptionSelect
                                inputId={`${item.id}-pv-type`}
                                value={item.photovoltaicHazardType}
                                options={getNerisValueOptions("emerg_haz_pv")}
                                onChange={(nextValue) =>
                                  updateEmergingPowerGenerationItem(
                                    item.id,
                                    "photovoltaicHazardType",
                                    nextValue,
                                  )
                                }
                                placeholder="Select photovoltaic hazard type"
                                searchPlaceholder="Search photovoltaic hazard types..."
                              />
                            </div>
                            <div className="neris-emerging-hazard-field">
                              <label>Was PV the Source or Target?</label>
                              <div className="neris-single-choice-row" role="group" aria-label="Was PV the Source or Target?">
                                {pvSourceTargetOptions.map((option) => {
                                  const isSelected = option.value === item.pvSourceTarget;
                                  return (
                                    <button
                                      key={`${item.id}-pv-source-target-${option.value}`}
                                      type="button"
                                      className={`neris-single-choice-button${
                                        isSelected ? " selected" : ""
                                      }`}
                                      aria-pressed={isSelected}
                                      onClick={() =>
                                        updateEmergingPowerGenerationItem(
                                          item.id,
                                          "pvSourceTarget",
                                          togglePillValue(item.pvSourceTarget, option.value),
                                        )
                                      }
                                    >
                                      {option.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="neris-emerging-hazard-field field-span-two">
                              <label>Emerging Hazard Suppression Method(s)</label>
                              <NerisFlatMultiOptionSelect
                                inputId={`${item.id}-power-suppression`}
                                value={item.suppressionMethods}
                                options={getNerisValueOptions("emerg_haz_suppression")}
                                onChange={(nextValue) =>
                                  updateEmergingPowerGenerationItem(
                                    item.id,
                                    "suppressionMethods",
                                    nextValue,
                                  )
                                }
                                placeholder="Select suppression method(s)"
                                searchPlaceholder="Search suppression methods..."
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              </section>
            ) : null}
            {currentSection.id === "riskReduction" ? (
              <section className="field-span-two neris-risk-reduction-layout">
                <div className="neris-core-field-heading">RISK REDUCTION</div>

                <div className="neris-risk-reduction-grid">
                  <div className="neris-risk-reduction-field">
                    <label>Risk reduction completed</label>
                    <div className="neris-single-choice-row" role="group" aria-label="Risk reduction completed">
                      {RISK_REDUCTION_YES_NO_UNKNOWN_OPTIONS.map((option) => {
                        const isSelected = option.value === riskReductionCompletedValue;
                        return (
                          <button
                            key={`risk-reduction-completed-${option.value}`}
                            type="button"
                            className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                            aria-pressed={isSelected}
                            onClick={() =>
                              updateFieldValue(
                                "risk_reduction_completed",
                                togglePillValue(riskReductionCompletedValue, option.value),
                              )
                            }
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="neris-risk-reduction-field">
                    <label>Follow-up required</label>
                    <div className="neris-single-choice-row" role="group" aria-label="Follow-up required">
                      {RISK_REDUCTION_YES_NO_UNKNOWN_OPTIONS.map((option) => {
                        const isSelected = option.value === riskReductionFollowUpValue;
                        return (
                          <button
                            key={`risk-reduction-follow-up-${option.value}`}
                            type="button"
                            className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                            aria-pressed={isSelected}
                            onClick={() =>
                              updateFieldValue(
                                "risk_reduction_follow_up_required",
                                togglePillValue(riskReductionFollowUpValue, option.value),
                              )
                            }
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="neris-risk-reduction-field">
                    <label>Contact Made?</label>
                    <div className="neris-single-choice-row" role="group" aria-label="Contact made">
                      {RISK_REDUCTION_YES_NO_OPTIONS.map((option) => {
                        const isSelected = option.value === riskReductionContactMadeValue;
                        return (
                          <button
                            key={`risk-reduction-contact-made-${option.value}`}
                            type="button"
                            className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                            aria-pressed={isSelected}
                            onClick={() =>
                              updateFieldValue(
                                "risk_reduction_contacts_made",
                                togglePillValue(riskReductionContactMadeValue, option.value),
                              )
                            }
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {riskReductionContactMadeValue === "YES" ? (
                  <section className="neris-risk-reduction-contact-box">
                    <div className="neris-risk-reduction-contact-grid">
                      <label>
                        Full Name
                        <input
                          type="text"
                          value={formValues.risk_reduction_contact_full_name ?? ""}
                          onChange={(event) =>
                            updateFieldValue(
                              "risk_reduction_contact_full_name",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label>
                        Phone Number
                        <input
                          type="text"
                          value={formValues.risk_reduction_contact_phone_number ?? ""}
                          onChange={(event) =>
                            updateFieldValue(
                              "risk_reduction_contact_phone_number",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label>
                        Street
                        <input
                          type="text"
                          value={formValues.risk_reduction_contact_street ?? ""}
                          onChange={(event) =>
                            updateFieldValue("risk_reduction_contact_street", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        City
                        <input
                          type="text"
                          value={formValues.risk_reduction_contact_city ?? ""}
                          onChange={(event) =>
                            updateFieldValue("risk_reduction_contact_city", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        State
                        <input
                          type="text"
                          value={formValues.risk_reduction_contact_state ?? ""}
                          onChange={(event) =>
                            updateFieldValue("risk_reduction_contact_state", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Zip Code
                        <input
                          type="text"
                          value={formValues.risk_reduction_contact_zip_code ?? ""}
                          onChange={(event) =>
                            updateFieldValue("risk_reduction_contact_zip_code", event.target.value)
                          }
                        />
                      </label>
                    </div>
                  </section>
                ) : null}

                {riskReductionCompletedValue === "YES" ? (
                  <div className="neris-risk-reduction-conditional-layout">
                    <section className="neris-risk-reduction-question-card">
                      <label>Was there at least one smoke alarm present?</label>
                      <div
                        className="neris-single-choice-row"
                        role="group"
                        aria-label="Was there at least one smoke alarm present?"
                      >
                        {RISK_REDUCTION_YES_NO_UNKNOWN_OPTIONS.map((option) => {
                          const isSelected = option.value === riskReductionSmokeAlarmPresentValue;
                          return (
                            <button
                              key={`risk-reduction-smoke-alarm-present-${option.value}`}
                              type="button"
                              className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                              aria-pressed={isSelected}
                              onClick={() =>
                                updateFieldValue(
                                  "risk_reduction_smoke_alarm_present",
                                  togglePillValue(riskReductionSmokeAlarmPresentValue, option.value),
                                )
                              }
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>

                      {riskReductionSmokeAlarmPresentValue === "YES" ? (
                        <div className="neris-risk-reduction-subfields">
                          <div>
                            <label>
                              Was there at least one working or successfully test smoke alarm?
                            </label>
                            <div
                              className="neris-single-choice-row"
                              role="group"
                              aria-label="Was there at least one working or successfully test smoke alarm?"
                            >
                              {RISK_REDUCTION_YES_NO_OPTIONS.map((option) => {
                                const isSelected =
                                  option.value === riskReductionSmokeAlarmWorkingValue;
                                return (
                                  <button
                                    key={`risk-reduction-smoke-working-${option.value}`}
                                    type="button"
                                    className={`neris-single-choice-button${
                                      isSelected ? " selected" : ""
                                    }`}
                                    aria-pressed={isSelected}
                                    onClick={() =>
                                      updateFieldValue(
                                        "risk_reduction_smoke_alarm_working",
                                        togglePillValue(
                                          riskReductionSmokeAlarmWorkingValue,
                                          option.value,
                                        ),
                                      )
                                    }
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <label>Smoke Alarm Type(s)</label>
                            <NerisFlatMultiOptionSelect
                              inputId="risk-reduction-smoke-alarm-types"
                              value={formValues.risk_reduction_smoke_alarm_types ?? ""}
                              options={RISK_REDUCTION_SMOKE_ALARM_TYPE_OPTIONS}
                              onChange={(nextValue) =>
                                updateFieldValue("risk_reduction_smoke_alarm_types", nextValue)
                              }
                              placeholder="Select smoke alarm type(s)"
                              searchPlaceholder="Search smoke alarm types..."
                            />
                          </div>
                        </div>
                      ) : null}
                    </section>

                    <section className="neris-risk-reduction-question-card">
                      <label>Was there at least one fire alarm present?</label>
                      <div
                        className="neris-single-choice-row"
                        role="group"
                        aria-label="Was there at least one fire alarm present?"
                      >
                        {RISK_REDUCTION_YES_NO_UNKNOWN_OPTIONS.map((option) => {
                          const isSelected = option.value === riskReductionFireAlarmPresentValue;
                          return (
                            <button
                              key={`risk-reduction-fire-alarm-present-${option.value}`}
                              type="button"
                              className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                              aria-pressed={isSelected}
                              onClick={() =>
                                updateFieldValue(
                                  "risk_reduction_fire_alarm_present",
                                  togglePillValue(riskReductionFireAlarmPresentValue, option.value),
                                )
                              }
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      {riskReductionFireAlarmPresentValue === "YES" ? (
                        <div className="neris-risk-reduction-subfields">
                          <div>
                            <label>Fire Alarm Type(s)</label>
                            <NerisFlatMultiOptionSelect
                              inputId="risk-reduction-fire-alarm-types"
                              value={formValues.risk_reduction_fire_alarm_types ?? ""}
                              options={RISK_REDUCTION_FIRE_ALARM_TYPE_OPTIONS}
                              onChange={(nextValue) =>
                                updateFieldValue("risk_reduction_fire_alarm_types", nextValue)
                              }
                              placeholder="Select fire alarm type(s)"
                              searchPlaceholder="Search fire alarm types..."
                            />
                          </div>
                        </div>
                      ) : null}
                    </section>

                    <section className="neris-risk-reduction-question-card">
                      <label>Were there any other alarms present?</label>
                      <div
                        className="neris-single-choice-row"
                        role="group"
                        aria-label="Were there any other alarms present?"
                      >
                        {RISK_REDUCTION_YES_NO_UNKNOWN_OPTIONS.map((option) => {
                          const isSelected = option.value === riskReductionOtherAlarmPresentValue;
                          return (
                            <button
                              key={`risk-reduction-other-alarm-present-${option.value}`}
                              type="button"
                              className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                              aria-pressed={isSelected}
                              onClick={() =>
                                updateFieldValue(
                                  "risk_reduction_other_alarm_present",
                                  togglePillValue(riskReductionOtherAlarmPresentValue, option.value),
                                )
                              }
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      {riskReductionOtherAlarmPresentValue === "YES" ? (
                        <div className="neris-risk-reduction-subfields">
                          <div>
                            <label>Other Alarm Type(s)</label>
                            <NerisFlatMultiOptionSelect
                              inputId="risk-reduction-other-alarm-types"
                              value={formValues.risk_reduction_other_alarm_types ?? ""}
                              options={RISK_REDUCTION_OTHER_ALARM_TYPE_OPTIONS}
                              onChange={(nextValue) =>
                                updateFieldValue("risk_reduction_other_alarm_types", nextValue)
                              }
                              placeholder="Select other alarm type(s)"
                              searchPlaceholder="Search other alarm types..."
                            />
                          </div>
                        </div>
                      ) : null}
                    </section>

                    <section className="neris-risk-reduction-question-card">
                      <label>Were there any fire suppresion systems present?</label>
                      <div
                        className="neris-single-choice-row"
                        role="group"
                        aria-label="Were there any fire suppression systems present?"
                      >
                        {RISK_REDUCTION_YES_NO_UNKNOWN_OPTIONS.map((option) => {
                          const isSelected =
                            option.value === riskReductionFireSuppressionPresentValue;
                          return (
                            <button
                              key={`risk-reduction-fire-suppression-present-${option.value}`}
                              type="button"
                              className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                              aria-pressed={isSelected}
                              onClick={() => {
                                const nextValue = togglePillValue(
                                  riskReductionFireSuppressionPresentValue,
                                  option.value,
                                );
                                updateFieldValue(
                                  "risk_reduction_fire_suppression_present",
                                  nextValue,
                                );
                                if (
                                  nextValue === "YES" &&
                                  riskReductionSuppressionSystems.length === 0
                                ) {
                                  addRiskReductionSuppressionSystem();
                                }
                              }}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>

                      {riskReductionFireSuppressionPresentValue === "YES" ? (
                        <div className="neris-risk-reduction-subfields">
                          {riskReductionSuppressionSystems.map((system, systemIndex) => (
                            <div
                              key={system.id}
                              className="neris-risk-reduction-suppression-system-card"
                            >
                              <div className="neris-risk-reduction-suppression-system-header">
                                <strong>Fire Suppression System {systemIndex + 1}</strong>
                                <button
                                  type="button"
                                  className="neris-emerging-hazard-delete-button"
                                  aria-label={`Delete fire suppression system ${systemIndex + 1}`}
                                  onClick={() => deleteRiskReductionSuppressionSystem(system.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              <div className="neris-risk-reduction-subfield-grid">
                                <label>
                                  Fire Suppression Type
                                  <input
                                    type="text"
                                    value={system.suppressionType}
                                    onChange={(event) =>
                                      updateRiskReductionSuppressionSystem(
                                        system.id,
                                        "suppressionType",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </label>
                                <div>
                                  <label>Suppression System Coverage</label>
                                  <div
                                    className="neris-single-choice-row"
                                    role="group"
                                    aria-label="Suppression system coverage"
                                  >
                                    {RISK_REDUCTION_SUPPRESSION_COVERAGE_OPTIONS.map((option) => {
                                      const isSelected =
                                        option.value === system.suppressionCoverage;
                                      return (
                                        <button
                                          key={`${system.id}-coverage-${option.value}`}
                                          type="button"
                                          className={`neris-single-choice-button${
                                            isSelected ? " selected" : ""
                                          }`}
                                          aria-pressed={isSelected}
                                          onClick={() =>
                                            updateRiskReductionSuppressionSystem(
                                              system.id,
                                              "suppressionCoverage",
                                              togglePillValue(
                                                system.suppressionCoverage,
                                                option.value,
                                              ),
                                            )
                                          }
                                        >
                                          {option.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}

                          <button
                            type="button"
                            className="fl-link-button"
                            onClick={addRiskReductionSuppressionSystem}
                          >
                            + Add Another Fire Suppression System
                          </button>
                        </div>
                      ) : null}
                    </section>

                    <section className="neris-risk-reduction-question-card">
                      <label>
                        Was there at least one cooking fire suppression system present?
                      </label>
                      <div
                        className="neris-single-choice-row"
                        role="group"
                        aria-label="Was there at least one cooking fire suppression system present?"
                      >
                        {RISK_REDUCTION_YES_NO_UNKNOWN_OPTIONS.map((option) => {
                          const isSelected =
                            option.value === riskReductionCookingSuppressionPresentValue;
                          return (
                            <button
                              key={`risk-reduction-cooking-suppression-present-${option.value}`}
                              type="button"
                              className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                              aria-pressed={isSelected}
                              onClick={() =>
                                updateFieldValue(
                                  "risk_reduction_cooking_suppression_present",
                                  togglePillValue(
                                    riskReductionCookingSuppressionPresentValue,
                                    option.value,
                                  ),
                                )
                              }
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      {riskReductionCookingSuppressionPresentValue === "YES" ? (
                        <div className="neris-risk-reduction-subfields">
                          <div>
                            <label>Cooking Fire Suppression Type(s)</label>
                            <NerisFlatMultiOptionSelect
                              inputId="risk-reduction-cooking-suppression-types"
                              value={formValues.risk_reduction_cooking_suppression_types ?? ""}
                              options={RISK_REDUCTION_COOKING_SUPPRESSION_TYPE_OPTIONS}
                              onChange={(nextValue) =>
                                updateFieldValue(
                                  "risk_reduction_cooking_suppression_types",
                                  nextValue,
                                )
                              }
                              placeholder="Select cooking fire suppression type(s)"
                              searchPlaceholder="Search cooking suppression types..."
                            />
                          </div>
                        </div>
                      ) : null}
                    </section>
                  </div>
                ) : null}
              </section>
            ) : null}
            {currentSection.id === "resources" ? (
              <section className="field-span-two neris-resource-unit-list">
                <div className="neris-resource-add-unit-row">
                  <AddUnitControl
                    apparatusFromDept={apparatusFromDept}
                    resourceUnits={resourceUnits}
                    onAdd={addResourceUnitAndSyncToIncident}
                  />
                </div>
                {resourceUnits.length ? (
                  resourceUnits.map((unitEntry) => {
                    const selectedPersonnelValues = unitEntry.personnel
                      .split(",")
                      .map((entry) => entry.trim())
                      .filter((entry) => entry.length > 0);
                    const selectedPersonnelOptions = selectedPersonnelValues
                      .map((value) =>
                        effectivePersonnelOptions.find((option) => option.value === value),
                      )
                      .filter((option): option is NerisValueOption => Boolean(option));
                    const reportWriterOptions = selectedPersonnelOptions.length
                      ? selectedPersonnelOptions
                      : effectivePersonnelOptions;
                    const staffingDisplay = getStaffingValueForUnit(
                      unitEntry.unitId,
                      unitEntry.personnel,
                    );
                    const unitTypeDisplayLabel =
                      unitTypeOptions.find((option) => option.value === unitEntry.unitType)?.label ??
                      unitEntry.unitType;
                    const personnelError =
                      sectionErrors[resourceUnitValidationErrorKey(unitEntry.id, "personnel")] ?? "";
                    const dispatchTimeError =
                      sectionErrors[resourceUnitValidationErrorKey(unitEntry.id, "dispatchTime")] ??
                      "";
                    const enrouteTimeError =
                      sectionErrors[resourceUnitValidationErrorKey(unitEntry.id, "enrouteTime")] ??
                      "";
                    const stagedTimeError =
                      sectionErrors[resourceUnitValidationErrorKey(unitEntry.id, "stagedTime")] ?? "";
                    const onSceneTimeError =
                      sectionErrors[resourceUnitValidationErrorKey(unitEntry.id, "onSceneTime")] ??
                      "";
                    const canceledTimeError =
                      sectionErrors[resourceUnitValidationErrorKey(unitEntry.id, "canceledTime")] ?? "";
                    const clearTimeError =
                      sectionErrors[resourceUnitValidationErrorKey(unitEntry.id, "clearTime")] ?? "";

                    return (
                      <article key={unitEntry.id} className="neris-resource-unit-card">
                        <header className="neris-resource-unit-header">
                          <div className="neris-resource-unit-summary">
                            <strong className="neris-resource-unit-name">
                              {unitEntry.unitId || "Unassigned unit"}
                            </strong>
                            <button
                              type="button"
                              className={`neris-resource-complete-chip ${
                                unitEntry.isComplete ? "complete" : "incomplete"
                              }`}
                              onClick={() => toggleResourceUnitComplete(unitEntry.id)}
                            >
                              <span className="neris-resource-complete-check">
                                {unitEntry.isComplete ? "x" : ""}
                              </span>
                              {unitEntry.isComplete ? "Complete" : "Incomplete"}
                            </button>
                            <span className="neris-resource-personnel-indicator">
                              <Users size={14} />
                              <strong>{staffingDisplay || "0"}</strong>
                            </span>
                            <div className="neris-resource-time-grid">
                              <div className="neris-resource-time-item">
                                <span>Dispatch</span>
                                <strong>{toResourceSummaryTime(unitEntry.dispatchTime)}</strong>
                              </div>
                              <div className="neris-resource-time-item">
                                <span>Enroute</span>
                                <strong>{toResourceSummaryTime(unitEntry.enrouteTime)}</strong>
                              </div>
                              <div className="neris-resource-time-item">
                                <span>Staged</span>
                                <strong>{toResourceSummaryTime(unitEntry.stagedTime)}</strong>
                              </div>
                              <div className="neris-resource-time-item">
                                <span>On Scene</span>
                                <strong>{toResourceSummaryTime(unitEntry.onSceneTime)}</strong>
                              </div>
                              <div className="neris-resource-time-item">
                                <span>Canceled</span>
                                <strong>{toResourceSummaryTime(unitEntry.canceledTime)}</strong>
                              </div>
                              <div className="neris-resource-time-item">
                                <span>Clear</span>
                                <strong>{toResourceSummaryTime(unitEntry.clearTime)}</strong>
                              </div>
                            </div>
                          </div>
                          <div className="neris-resource-unit-actions">
                            <button
                              type="button"
                              className="neris-resource-delete-button"
                              onClick={() => deleteResourceUnit(unitEntry.id)}
                              aria-label={`Delete ${unitEntry.unitId || "unit"} block`}
                            >
                              <Trash2 size={14} />
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={
                                unitEntry.isExpanded
                                  ? "Collapse unit details"
                                  : "Expand unit details"
                              }
                              onClick={() => toggleResourceUnitExpanded(unitEntry.id)}
                            >
                              <ChevronDown
                                size={14}
                                className={`neris-resource-expand-icon${
                                  unitEntry.isExpanded ? " open" : ""
                                }`}
                              />
                            </button>
                          </div>
                        </header>
                        {unitEntry.isExpanded ? (
                          <div className="neris-resource-unit-body">
                            <div className="neris-resource-field-grid">
                              <div className="neris-resource-field field-span-two">
                                <label>Unit Response Mode</label>
                                <div className="neris-single-choice-row" role="group" aria-label="Unit response mode">
                                  {responseModeOptions.map((option) => {
                                    const isSelected = option.value === unitEntry.responseMode;
                                    return (
                                      <button
                                        key={`${unitEntry.id}-response-mode-${option.value}`}
                                        type="button"
                                        className={`neris-single-choice-button${
                                          isSelected ? " selected" : ""
                                        }`}
                                        aria-pressed={isSelected}
                                        onClick={() =>
                                          updateResourceUnitField(
                                            unitEntry.id,
                                            "responseMode",
                                            isSelected ? "" : option.value,
                                          )
                                        }
                                      >
                                        {option.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="neris-resource-field field-span-two">
                                <label>Transport Mode (to hospital)</label>
                                <div className="neris-single-choice-row" role="group" aria-label="Unit transport mode">
                                  {responseModeOptions.map((option) => {
                                    const isSelected = option.value === unitEntry.transportMode;
                                    return (
                                      <button
                                        key={`${unitEntry.id}-transport-mode-${option.value}`}
                                        type="button"
                                        className={`neris-single-choice-button${
                                          isSelected ? " selected" : ""
                                        }`}
                                        aria-pressed={isSelected}
                                        onClick={() =>
                                          updateResourceUnitField(
                                            unitEntry.id,
                                            "transportMode",
                                            isSelected ? "" : option.value,
                                          )
                                        }
                                      >
                                        {option.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="neris-resource-field">
                                <label>Responding Unit ID</label>
                                <NerisFlatSingleOptionSelect
                                  inputId={`${unitEntry.id}-unit-id`}
                                  value={unitEntry.unitId}
                                  options={availableResourceUnitOptions}
                                  onChange={(nextValue) =>
                                    handleResourceUnitIdChange(unitEntry.id, nextValue)
                                  }
                                  isOptionDisabled={(optionValue) =>
                                    optionValue !== unitEntry.unitId &&
                                    resourceUnits.some(
                                      (otherUnit) =>
                                        otherUnit.id !== unitEntry.id &&
                                        otherUnit.unitId.trim() === optionValue,
                                    )
                                  }
                                  placeholder="Select responding unit"
                                  searchPlaceholder="Search responding units..."
                                />
                              </div>
                              <div className="neris-resource-field">
                                <label>Unit Type</label>
                                <input
                                  type="text"
                                  value={unitTypeDisplayLabel}
                                  readOnly
                                  className="neris-resource-unit-type-input"
                                  placeholder="Auto-populates from unit setup"
                                />
                              </div>
                            </div>

                            <div className="neris-resource-inline-links">
                              <button
                                type="button"
                                className="link-button"
                                aria-expanded={unitEntry.showTimesEditor}
                                onClick={() => toggleResourceTimesEditor(unitEntry.id)}
                              >
                                Edit Times
                              </button>
                              <label className="neris-resource-canceled-enroute-inline">
                                <input
                                  type="checkbox"
                                  checked={unitEntry.isCanceledEnroute}
                                  onChange={() => toggleResourceCanceledEnroute(unitEntry.id)}
                                />
                                <span>Dispatched and canceled en route</span>
                              </label>
                            </div>

                            {unitEntry.showTimesEditor ? (
                              <div className="neris-resource-times-editor">
                                <div className="neris-resource-times-editor-grid">
                                  <label className="neris-resource-datetime-label">
                                    <span className="neris-resource-datetime-header">
                                      Dispatch
                                      <button
                                        type="button"
                                        className="link-button neris-resource-time-clear"
                                        onClick={() => {
                                          updateResourceUnitField(unitEntry.id, "dispatchTime", "");
                                          clearResourceUnitValidationErrors(unitEntry.id);
                                          setResourceTimeDraft(null);
                                          markNerisFormDirty();
                                        }}
                                      >
                                        Clear
                                      </button>
                                    </span>
                                    <span className="neris-resource-datetime-inputs">
                                      <input
                                        type="date"
                                        value={formatResourceDatePart(unitEntry.dispatchTime)}
                                        onChange={(e) =>
                                          updateResourceUnitField(
                                            unitEntry.id,
                                            "dispatchTime",
                                            combineResourceDateTimeFromParts(
                                              e.target.value,
                                              formatResourceTimePart(unitEntry.dispatchTime),
) || (e.target.value ? e.target.value + "T00:00:00" : "")
                                            )
                                        }
                                      />
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="HH:mm:ss (24h)"
                                        value={
                                          resourceTimeDraft?.key === `${unitEntry.id}:dispatchTime`
                                            ? resourceTimeDraft.value
                                            : formatResourceTimePart(unitEntry.dispatchTime)
                                        }
                                        onFocus={() =>
                                          setResourceTimeDraft({
                                            key: `${unitEntry.id}:dispatchTime`,
                                            value: formatResourceTimePart(unitEntry.dispatchTime),
                                          })
                                        }
                                        onChange={(e) =>
                                          setResourceTimeDraft((prev) =>
                                            prev?.key === `${unitEntry.id}:dispatchTime`
                                              ? { ...prev, value: e.target.value }
                                              : { key: `${unitEntry.id}:dispatchTime`, value: e.target.value },
                                          )
                                        }
                                        onBlur={() => {
                                          const raw =
                                            resourceTimeDraft?.key === `${unitEntry.id}:dispatchTime`
                                              ? resourceTimeDraft.value
                                              : formatResourceTimePart(unitEntry.dispatchTime);
                                          const v = parseTimeInput24h(raw);
                                          updateResourceUnitField(
                                            unitEntry.id,
                                            "dispatchTime",
                                            combineResourceDateTimeFromParts(
                                              formatResourceDatePart(unitEntry.dispatchTime) ||
                                                resourceFallbackDate,
                                              v,
                                            ) || unitEntry.dispatchTime,
                                          );
                                          setResourceTimeDraft(null);
                                        }}
                                      />
                                    </span>
                                    {dispatchTimeError ? (
                                      <small className="field-error">{dispatchTimeError}</small>
                                    ) : null}
                                  </label>
                                  <label className="neris-resource-datetime-label">
                                    <span className="neris-resource-datetime-header">
                                      Enroute
                                      <button
                                        type="button"
                                        className="link-button neris-resource-time-clear"
                                        onClick={() => {
                                          updateResourceUnitField(unitEntry.id, "enrouteTime", "");
                                          clearResourceUnitValidationErrors(unitEntry.id);
                                          setResourceTimeDraft(null);
                                          markNerisFormDirty();
                                        }}
                                      >
                                        Clear
                                      </button>
                                    </span>
                                    <span className="neris-resource-datetime-inputs">
                                      <input
                                        type="date"
                                        value={formatResourceDatePart(unitEntry.enrouteTime)}
                                        onChange={(e) =>
                                          updateResourceUnitField(
                                            unitEntry.id,
                                            "enrouteTime",
                                            combineResourceDateTimeFromParts(
                                              e.target.value,
                                              formatResourceTimePart(unitEntry.enrouteTime),
) || (e.target.value ? e.target.value + "T00:00:00" : "")
                                            )
                                        }
                                      />
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="HH:mm:ss (24h)"
                                        value={
                                          resourceTimeDraft?.key === `${unitEntry.id}:enrouteTime`
                                            ? resourceTimeDraft.value
                                            : formatResourceTimePart(unitEntry.enrouteTime)
                                        }
                                        onFocus={() =>
                                          setResourceTimeDraft({
                                            key: `${unitEntry.id}:enrouteTime`,
                                            value: formatResourceTimePart(unitEntry.enrouteTime),
                                          })
                                        }
                                        onChange={(e) =>
                                          setResourceTimeDraft((prev) =>
                                            prev?.key === `${unitEntry.id}:enrouteTime`
                                              ? { ...prev, value: e.target.value }
                                              : { key: `${unitEntry.id}:enrouteTime`, value: e.target.value },
                                          )
                                        }
                                        onBlur={() => {
                                          const raw =
                                            resourceTimeDraft?.key === `${unitEntry.id}:enrouteTime`
                                              ? resourceTimeDraft.value
                                              : formatResourceTimePart(unitEntry.enrouteTime);
                                          const v = parseTimeInput24h(raw);
                                          updateResourceUnitField(
                                            unitEntry.id,
                                            "enrouteTime",
                                            combineResourceDateTimeFromParts(
                                              formatResourceDatePart(unitEntry.enrouteTime) ||
                                                resourceFallbackDate,
                                              v,
                                            ) || unitEntry.enrouteTime,
                                          );
                                          setResourceTimeDraft(null);
                                        }}
                                      />
                                    </span>
                                    {enrouteTimeError ? (
                                      <small className="field-error">{enrouteTimeError}</small>
                                    ) : null}
                                  </label>
                                  <label className="neris-resource-datetime-label">
                                    <span className="neris-resource-datetime-header">
                                      Staged
                                      <button
                                        type="button"
                                        className="link-button neris-resource-time-clear"
                                        onClick={() => {
                                          updateResourceUnitField(unitEntry.id, "stagedTime", "");
                                          clearResourceUnitValidationErrors(unitEntry.id);
                                          setResourceTimeDraft(null);
                                          markNerisFormDirty();
                                        }}
                                      >
                                        Clear
                                      </button>
                                    </span>
                                    <span className="neris-resource-datetime-inputs">
                                      <input
                                        type="date"
                                        value={formatResourceDatePart(unitEntry.stagedTime)}
                                        onChange={(e) =>
                                          updateResourceUnitField(
                                            unitEntry.id,
                                            "stagedTime",
                                            combineResourceDateTimeFromParts(
                                              e.target.value,
                                              formatResourceTimePart(unitEntry.stagedTime),
                                            ) || (e.target.value ? e.target.value + "T00:00:00" : "")
                                            )
                                          }
                                      />
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="HH:mm:ss (24h)"
                                        value={
                                          resourceTimeDraft?.key === `${unitEntry.id}:stagedTime`
                                            ? resourceTimeDraft.value
                                            : formatResourceTimePart(unitEntry.stagedTime)
                                        }
                                        onFocus={() =>
                                          setResourceTimeDraft({
                                            key: `${unitEntry.id}:stagedTime`,
                                            value: formatResourceTimePart(unitEntry.stagedTime),
                                          })
                                        }
                                        onChange={(e) =>
                                          setResourceTimeDraft((prev) =>
                                            prev?.key === `${unitEntry.id}:stagedTime`
                                              ? { ...prev, value: e.target.value }
                                              : { key: `${unitEntry.id}:stagedTime`, value: e.target.value },
                                          )
                                        }
                                        onBlur={() => {
                                          const raw =
                                            resourceTimeDraft?.key === `${unitEntry.id}:stagedTime`
                                              ? resourceTimeDraft.value
                                              : formatResourceTimePart(unitEntry.stagedTime);
                                          const v = parseTimeInput24h(raw);
                                          updateResourceUnitField(
                                            unitEntry.id,
                                            "stagedTime",
                                            combineResourceDateTimeFromParts(
                                              formatResourceDatePart(unitEntry.stagedTime) ||
                                                resourceFallbackDate,
                                              v,
                                            ) || unitEntry.stagedTime,
                                          );
                                          setResourceTimeDraft(null);
                                        }}
                                      />
                                    </span>
                                    {stagedTimeError ? (
                                      <small className="field-error">{stagedTimeError}</small>
                                    ) : null}
                                  </label>
                                  <label className="neris-resource-datetime-label">
                                    <span className="neris-resource-datetime-header">
                                      On Scene
                                      <button
                                        type="button"
                                        className="link-button neris-resource-time-clear"
                                        onClick={() => {
                                          updateResourceUnitField(unitEntry.id, "onSceneTime", "");
                                          clearResourceUnitValidationErrors(unitEntry.id);
                                          setResourceTimeDraft(null);
                                          markNerisFormDirty();
                                        }}
                                      >
                                        Clear
                                      </button>
                                    </span>
                                    <span className="neris-resource-datetime-inputs">
                                      <input
                                        type="date"
                                        value={formatResourceDatePart(unitEntry.onSceneTime)}
                                        onChange={(e) =>
                                          updateResourceUnitField(
                                            unitEntry.id,
                                            "onSceneTime",
                                            combineResourceDateTimeFromParts(
                                              e.target.value,
                                              formatResourceTimePart(unitEntry.onSceneTime),
) || (e.target.value ? e.target.value + "T00:00:00" : "")
                                            )
                                        }
                                      />
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="HH:mm:ss (24h)"
                                        value={
                                          resourceTimeDraft?.key === `${unitEntry.id}:onSceneTime`
                                            ? resourceTimeDraft.value
                                            : formatResourceTimePart(unitEntry.onSceneTime)
                                        }
                                        onFocus={() =>
                                          setResourceTimeDraft({
                                            key: `${unitEntry.id}:onSceneTime`,
                                            value: formatResourceTimePart(unitEntry.onSceneTime),
                                          })
                                        }
                                        onChange={(e) =>
                                          setResourceTimeDraft((prev) =>
                                            prev?.key === `${unitEntry.id}:onSceneTime`
                                              ? { ...prev, value: e.target.value }
                                              : { key: `${unitEntry.id}:onSceneTime`, value: e.target.value },
                                          )
                                        }
                                        onBlur={() => {
                                          const raw =
                                            resourceTimeDraft?.key === `${unitEntry.id}:onSceneTime`
                                              ? resourceTimeDraft.value
                                              : formatResourceTimePart(unitEntry.onSceneTime);
                                          const v = parseTimeInput24h(raw);
                                          updateResourceUnitField(
                                            unitEntry.id,
                                            "onSceneTime",
                                            combineResourceDateTimeFromParts(
                                              formatResourceDatePart(unitEntry.onSceneTime) ||
                                                resourceFallbackDate,
                                              v,
                                            ) || unitEntry.onSceneTime,
                                          );
                                          setResourceTimeDraft(null);
                                        }}
                                      />
                                    </span>
                                    {onSceneTimeError ? (
                                      <small className="field-error">{onSceneTimeError}</small>
                                    ) : null}
                                  </label>
                                  <label className="neris-resource-datetime-label">
                                    <span className="neris-resource-datetime-header">
                                      Canceled
                                      <button
                                        type="button"
                                        className="link-button neris-resource-time-clear"
                                        onClick={() => {
                                          updateResourceUnitField(unitEntry.id, "canceledTime", "");
                                          clearResourceUnitValidationErrors(unitEntry.id);
                                          setResourceTimeDraft(null);
                                          markNerisFormDirty();
                                        }}
                                      >
                                        Clear
                                      </button>
                                    </span>
                                    <span className="neris-resource-datetime-inputs">
                                      <input
                                        type="date"
                                        value={formatResourceDatePart(unitEntry.canceledTime)}
                                        onChange={(e) =>
                                          updateResourceUnitField(
                                            unitEntry.id,
                                            "canceledTime",
                                            combineResourceDateTimeFromParts(
                                              e.target.value,
                                              formatResourceTimePart(unitEntry.canceledTime),
) || (e.target.value ? e.target.value + "T00:00:00" : "")
                                            )
                                        }
                                      />
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="HH:mm:ss (24h)"
                                        value={
                                          resourceTimeDraft?.key === `${unitEntry.id}:canceledTime`
                                            ? resourceTimeDraft.value
                                            : formatResourceTimePart(unitEntry.canceledTime)
                                        }
                                        onFocus={() =>
                                          setResourceTimeDraft({
                                            key: `${unitEntry.id}:canceledTime`,
                                            value: formatResourceTimePart(unitEntry.canceledTime),
                                          })
                                        }
                                        onChange={(e) =>
                                          setResourceTimeDraft((prev) =>
                                            prev?.key === `${unitEntry.id}:canceledTime`
                                              ? { ...prev, value: e.target.value }
                                              : { key: `${unitEntry.id}:canceledTime`, value: e.target.value },
                                          )
                                        }
                                        onBlur={() => {
                                          const raw =
                                            resourceTimeDraft?.key === `${unitEntry.id}:canceledTime`
                                              ? resourceTimeDraft.value
                                              : formatResourceTimePart(unitEntry.canceledTime);
                                          const v = parseTimeInput24h(raw);
                                          updateResourceUnitField(
                                            unitEntry.id,
                                            "canceledTime",
                                            combineResourceDateTimeFromParts(
                                              formatResourceDatePart(unitEntry.canceledTime) ||
                                                resourceFallbackDate,
                                              v,
                                            ) || unitEntry.canceledTime,
                                          );
                                          setResourceTimeDraft(null);
                                        }}
                                      />
                                    </span>
                                    {canceledTimeError ? (
                                      <small className="field-error">{canceledTimeError}</small>
                                    ) : null}
                                  </label>
                                  <label className="neris-resource-datetime-label">
                                    <span className="neris-resource-datetime-header">
                                      Clear
                                      <button
                                        type="button"
                                        className="link-button neris-resource-time-clear"
                                        onClick={() => {
                                          updateResourceUnitField(unitEntry.id, "clearTime", "");
                                          clearResourceUnitValidationErrors(unitEntry.id);
                                          setResourceTimeDraft(null);
                                          markNerisFormDirty();
                                        }}
                                      >
                                        Clear
                                      </button>
                                    </span>
                                    <span className="neris-resource-datetime-inputs">
                                      <input
                                        type="date"
                                        value={formatResourceDatePart(unitEntry.clearTime)}
                                        onChange={(e) =>
                                          updateResourceUnitField(
                                            unitEntry.id,
                                            "clearTime",
                                            combineResourceDateTimeFromParts(
                                              e.target.value,
                                              formatResourceTimePart(unitEntry.clearTime),
) || (e.target.value ? e.target.value + "T00:00:00" : "")
                                            )
                                        }
                                      />
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="HH:mm:ss (24h)"
                                        value={
                                          resourceTimeDraft?.key === `${unitEntry.id}:clearTime`
                                            ? resourceTimeDraft.value
                                            : formatResourceTimePart(unitEntry.clearTime)
                                        }
                                        onFocus={() =>
                                          setResourceTimeDraft({
                                            key: `${unitEntry.id}:clearTime`,
                                            value: formatResourceTimePart(unitEntry.clearTime),
                                          })
                                        }
                                        onChange={(e) =>
                                          setResourceTimeDraft((prev) =>
                                            prev?.key === `${unitEntry.id}:clearTime`
                                              ? { ...prev, value: e.target.value }
                                              : { key: `${unitEntry.id}:clearTime`, value: e.target.value },
                                          )
                                        }
                                        onBlur={() => {
                                          const raw =
                                            resourceTimeDraft?.key === `${unitEntry.id}:clearTime`
                                              ? resourceTimeDraft.value
                                              : formatResourceTimePart(unitEntry.clearTime);
                                          const v = parseTimeInput24h(raw);
                                          updateResourceUnitField(
                                            unitEntry.id,
                                            "clearTime",
                                            combineResourceDateTimeFromParts(
                                              formatResourceDatePart(unitEntry.clearTime) ||
                                                resourceFallbackDate,
                                              v,
                                            ) || unitEntry.clearTime,
                                          );
                                          setResourceTimeDraft(null);
                                        }}
                                      />
                                    </span>
                                    {clearTimeError ? (
                                      <small className="field-error">{clearTimeError}</small>
                                    ) : null}
                                  </label>
                                </div>
                                <button
                                  type="button"
                                  className={`neris-resource-canceled-enroute-button${
                                    unitEntry.isCanceledEnroute ? " active" : ""
                                  }`}
                                  aria-pressed={unitEntry.isCanceledEnroute}
                                  onClick={() => toggleResourceCanceledEnroute(unitEntry.id)}
                                >
                                  Dispatched and canceled en route
                                </button>
                                <button
                                  type="button"
                                  className="secondary-button compact-button"
                                  onClick={() => populateResourceTimesFromDispatch(unitEntry.id)}
                                >
                                  Populate Date
                                </button>
                              </div>
                            ) : null}

                            <section className="neris-resource-personnel-panel">
                              <div className="neris-resource-personnel-header-row">
                                <h4>Personnel</h4>
                                <button
                                  type="button"
                                  className="link-button"
                                  onClick={() => openResourcePersonnelModal(unitEntry.id)}
                                >
                                  Add Personnel
                                </button>
                              </div>
                              <div className="neris-resource-personnel-table-head">
                                <span>Name</span>
                              </div>
                              {selectedPersonnelOptions.length ? (
                                <ul className="neris-resource-personnel-list">
                                  {selectedPersonnelOptions.map((option) => (
                                    <li key={`${unitEntry.id}-personnel-${option.value}`}>
                                      <span>{option.label}</span>
                                      <div className="neris-resource-personnel-row-actions">
                                        <button
                                          type="button"
                                          className="icon-button"
                                          aria-label={`Edit ${option.label} assignment`}
                                        >
                                          <Pencil size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          className="icon-button"
                                          aria-label={`Remove ${option.label} from this unit`}
                                          onClick={() =>
                                            removeResourcePersonnel(unitEntry.id, option.value)
                                          }
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="neris-resource-personnel-empty">
                                  <Users size={24} className="neris-resource-personnel-empty-icon" />
                                  <p>No personnel assigned to this unit.</p>
                                  <small>Add personnel using the Add Personnel link above.</small>
                                </div>
                              )}
                              {personnelError ? (
                                <small className="field-error neris-resource-personnel-error">
                                  {personnelError}
                                </small>
                              ) : null}
                            </section>

                            <div className="neris-resource-field">
                              <label>Unit Report Writer</label>
                              <NerisFlatSingleOptionSelect
                                inputId={`${unitEntry.id}-report-writer`}
                                value={unitEntry.reportWriter}
                                options={reportWriterOptions}
                                onChange={(nextValue) =>
                                  updateResourceUnitField(
                                    unitEntry.id,
                                    "reportWriter",
                                    nextValue,
                                  )
                                }
                                placeholder="Select report writer"
                                searchPlaceholder="Search personnel..."
                                allowClear
                              />
                            </div>

                            <div className="neris-resource-unit-narrative">
                              <div className="neris-core-field-heading neris-resource-unit-narrative-heading">
                                UNIT NARRATIVE
                              </div>
                              <textarea
                                rows={6}
                                value={unitEntry.unitNarrative}
                                placeholder="Insert text here..."
                                onChange={(event) =>
                                  updateResourceUnitField(
                                    unitEntry.id,
                                    "unitNarrative",
                                    event.target.value,
                                  )
                                }
                              />
                            </div>

                            <div className="neris-resource-footer-actions">
                              <button
                                type="button"
                                className="primary-button compact-button neris-resource-complete-collapse-button"
                                onClick={() => completeAndCollapseResourceUnit(unitEntry.id)}
                              >
                                Complete and Collapse
                              </button>
                              <button
                                type="button"
                                className="primary-button compact-button"
                                onClick={() => collapseResourceUnit(unitEntry.id)}
                              >
                                Collapse
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <div className="neris-resource-empty-state">
                    No responding units are available for this incident yet.
                  </div>
                )}
              </section>
            ) : null}
            {currentSection.id === "resources" && activeResourcePersonnelUnit ? (
              <div
                className="neris-resource-personnel-modal-backdrop"
                role="dialog"
                aria-modal="true"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    closeResourcePersonnelModal();
                  }
                }}
              >
                <section
                  className="panel neris-resource-personnel-modal"
                  onWheel={(event) => event.stopPropagation()}
                >
                  <div className="neris-resource-personnel-modal-header">
                    <h3>
                      Add Personnel
                      {activeResourcePersonnelUnit.unitId
                        ? ` - ${activeResourcePersonnelUnit.unitId}`
                        : ""}
                    </h3>
                    <button
                      type="button"
                      className="secondary-button compact-button"
                      onClick={closeResourcePersonnelModal}
                    >
                      Close
                    </button>
                  </div>
                  <NerisFlatMultiOptionSelect
                    inputId={`resource-personnel-modal-${activeResourcePersonnelUnit.id}`}
                    value={activeResourcePersonnelUnit.personnel}
                    options={effectivePersonnelOptions}
                    onChange={(nextValue) =>
                      updateResourceUnitField(activeResourcePersonnelUnit.id, "personnel", nextValue)
                    }
                    placeholder="Select personnel"
                    searchPlaceholder="Search personnel..."
                    isOptionDisabled={(optionValue) =>
                      personnelAssignedToOtherUnits.has(optionValue)
                    }
                  />
                  <small className="field-hint">
                    Select one or more personnel. Click outside this dialog to close.
                  </small>
                </section>
              </div>
            ) : null}
            {displayedSectionFields.flatMap((field) => {
              const nodes: ReactNode[] = [];
              const headingLabel =
                currentSection.id === "core" ? CORE_SECTION_FIELD_HEADERS[field.id] : undefined;
              if (headingLabel) {
                nodes.push(
                  <div key={`heading-${field.id}`} className="field-span-two neris-core-field-heading">
                    {headingLabel}
                  </div>,
                );
              }
              if (currentSection.id === "location" && field.id === "location_state") {
                nodes.push(
                  <div
                    key="heading-location-usage"
                    className="field-span-two neris-core-field-heading"
                  >
                    LOCATION / USAGE
                  </div>,
                );
                nodes.push(
                  <div
                    key="location-imported-address"
                    className="field-span-two neris-imported-address-block"
                  >
                    <div className="neris-imported-address-header">
                      <label htmlFor="location-imported-address-box">Imported address</label>
                      <button
                        type="button"
                        className="secondary-button compact-button neris-imported-address-sync-button"
                        onClick={handlePullLocationFromImportedAddress}
                      >
                        Pull location data
                      </button>
                    </div>
                    <div id="location-imported-address-box" className="neris-imported-address">
                      {importedLocationAddress}
                    </div>
                  </div>,
                );
              }
              if (currentSection.id === "location" && field.id === "location_direction_of_travel") {
                nodes.push(
                  <div
                    key="location-direction-of-travel-link"
                    className="field-span-two neris-location-add-links"
                  >
                    <button
                      type="button"
                      className="link-button"
                      aria-expanded={showDirectionOfTravelField}
                      onClick={() =>
                        setShowDirectionOfTravelField((previous) => !previous)
                      }
                    >
                      Add Direction of Travel
                    </button>
                  </div>,
                );
              }
              if (currentSection.id === "location" && field.id === "location_cross_street_type") {
                nodes.push(
                  <div
                    key="location-cross-street-link"
                    className="field-span-two neris-location-add-links"
                  >
                    <button
                      type="button"
                      className="link-button"
                      aria-expanded={showCrossStreetTypeField}
                      onClick={() =>
                        setShowCrossStreetTypeField((previous) => !previous)
                      }
                    >
                      Add Cross Street -&gt; RL
                    </button>
                  </div>,
                );
              }
              nodes.push(renderNerisField(field, `field-${field.id}`));
              return nodes;
            })}
          </div>

          {validationIssues.length ? (
            <div className="validation-issue-list">
              <p>Required fields to complete:</p>
              <ul>
                {validationIssues.map((fieldLabel) => (
                  <li key={`validation-issue-${fieldLabel}`}>{fieldLabel}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <details className="neris-required-matrix">
            <summary>NERIS required field matrix (minimum + incident-family)</summary>
            <div className="neris-required-matrix-grid">
              <div>
                <strong>Core minimum</strong>
                <ul>
                  {requiredMatrixRows.coreRows.map((row) => (
                    <li key={`required-core-${row.fieldId}`}>{row.label}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>
                  Incident family: {primaryIncidentCategory || "Select Primary Incident Type"}
                </strong>
                <ul>
                  {requiredMatrixRows.familyRows.length ? (
                    requiredMatrixRows.familyRows.map((row) => (
                      <li key={`required-family-${row.fieldId}`}>{row.label}</li>
                    ))
                  ) : (
                    <li>No additional family-specific requirements yet.</li>
                  )}
                </ul>
              </div>
            </div>
          </details>

          <div className="neris-form-actions">
            <button type="button" className="secondary-button compact-button" onClick={handleBack}>
              Back
            </button>
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={handleSaveDraft}
              disabled={!canEdit}
            >
              Save
            </button>
            <button
              type="button"
              className="primary-button compact-button"
              onClick={goToNextSection}
              disabled={!hasNextSection}
            >
              Next
            </button>
          </div>
        </article>
      </section>
    </section>
  );
}


export { NerisReportFormPage };
