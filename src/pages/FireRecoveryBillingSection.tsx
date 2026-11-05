import { useMemo, useState } from "react";
import { NerisFlatSingleOptionSelect } from "../NerisFlatSelects";
import { getNerisValueOptions } from "../nerisMetadata";
import {
  copyIntoParty,
  createParty,
  callClearedValue,
  displayClock,
  displayRunDate,
  incidentLocationParts,
  onScenePersonnel,
  parseBilling,
  requirementLevel,
  serializeBilling,
  type CopyContact,
  type FireRecoveryBilling,
  type FireRecoveryParty,
  type FireRecoveryRequirementKey,
  type RequirementLevel,
} from "../fireRecovery/billingRequirements";

type FireRecoveryBillingSectionProps = {
  rawJson: string;
  formValues: Record<string, string>;
  readOnly: boolean;
  persons: CopyContact[];
  owners: CopyContact[];
  onChange: (json: string) => void;
  requirementSettings: Partial<Record<FireRecoveryRequirementKey, RequirementLevel>>;
};

function requiredMark(level: RequirementLevel): string {
  return level === "required" ? " *" : "";
}

export function FireRecoveryBillingSection({
  rawJson,
  formValues,
  readOnly,
  persons,
  owners,
  onChange,
  requirementSettings,
}: FireRecoveryBillingSectionProps) {
  const billing = useMemo(() => parseBilling(rawJson), [rawJson]);
  const [deleteAskId, setDeleteAskId] = useState("");
  const [copyNote, setCopyNote] = useState("");
  const [copyTargetId, setCopyTargetId] = useState("");
  const [collapsedPartyIds, setCollapsedPartyIds] = useState<string[]>([]);

  const location = incidentLocationParts(formValues);
  const personnel = onScenePersonnel(formValues.resource_units_json ?? "");
  const stateOptions = useMemo(() => getNerisValueOptions("state"), []);
  const stateLabel = stateOptions.find((option) => option.value === location.state)?.label ?? location.state;

  const write = (next: FireRecoveryBilling) => {
    onChange(serializeBilling(next));
  };

  const updateParty = (partyId: string, patch: Partial<FireRecoveryParty>) => {
    write({
      ...billing,
      parties: billing.parties.map((party) => (party.id === partyId ? { ...party, ...patch } : party)),
    });
  };

  const copyChoices = useMemo(() => {
    const personChoices = persons.map((person, index) => ({
      value: `person:${index}`,
      label: [person.firstName, person.lastName].filter((part) => part.trim()).join(" ") || `Person ${index + 1}`,
    }));
    const ownerChoices = owners.map((owner, index) => ({
      value: `owner:${index}`,
      label: [owner.firstName, owner.lastName].filter((part) => part.trim()).join(" ") || `Owner ${index + 1}`,
    }));
    return [...personChoices, ...ownerChoices];
  }, [owners, persons]);

  const copySelectionIntoParty = (partyId: string, ref: string) => {
    const [kind, rawIndex] = ref.split(":");
    const index = Number.parseInt(rawIndex ?? "", 10);
    const contact = kind === "owner" ? owners[index] : persons[index];
    if (!contact) return;
    write({
      ...billing,
      parties: billing.parties.map((party) =>
        party.id === partyId ? copyIntoParty(party, contact) : party,
      ),
    });
    setCopyTargetId("");
    setCopyNote("");
  };

  const level = (key: FireRecoveryRequirementKey) => requirementLevel(key, requirementSettings);
  const toggleParty = (partyId: string) => {
    setCollapsedPartyIds((current) =>
      current.includes(partyId) ? current.filter((id) => id !== partyId) : [...current, partyId],
    );
  };

  return (
    <div className="field-span-two neris-person-owner-module">
      {readOnly ? (
        <p className="neris-lock-banner">This report is locked. An admin can unlock it to edit billing.</p>
      ) : null}

      <div className="fr-run-type" role="group" aria-label="Incident type">
        <button
          type="button"
          className={billing.runType === "MOTOR_VEHICLE" ? "primary-button compact-button" : "secondary-button compact-button"}
          aria-pressed={billing.runType === "MOTOR_VEHICLE"}
          disabled={readOnly}
          onClick={() => write({ ...billing, runType: "MOTOR_VEHICLE" })}
        >
          Motor Vehicle Incident
        </button>
        <button
          type="button"
          className={billing.runType === "COMMERCIAL_TRUCKING" ? "primary-button compact-button" : "secondary-button compact-button"}
          aria-pressed={billing.runType === "COMMERCIAL_TRUCKING"}
          disabled={readOnly}
          onClick={() => write({ ...billing, runType: "COMMERCIAL_TRUCKING" })}
        >
          Commercial Trucking Incident
        </button>
      </div>

      <div className="fr-call-grid">
        <ReadBox label="Run Date" value={displayRunDate(formValues.incident_onset_date ?? "")} required />
        <ReadBox label="Time Alarm Received" value={displayClock(formValues.incident_time_call_arrival ?? "")} required />
        <ReadBox label="Time Call Cleared" value={displayClock(callClearedValue(formValues))} required />
        <ReadBox label="Run Number" value={formValues.incident_internal_id ?? ""} required />
        <ReadBox
          label="Total Personnel On-Scene"
          value={String(personnel.count)}
          title={personnel.names.join(", ")}
          required
        />
        <div className="fr-bill-bar">
          <label htmlFor="fr-law-number">
            Law Enforcement Agency Report Number{requiredMark(level("fr.lawEnforcementNumber"))}
          </label>
          <input
            id="fr-law-number"
            type="text"
            value={billing.lawEnforcementReportNumber}
            disabled={readOnly}
            onChange={(event) => write({ ...billing, lawEnforcementReportNumber: event.target.value })}
          />
        </div>
      </div>
      <div className="fr-location-row">
        <ReadBox label="Street" value={location.street} required />
        <ReadBox label="City" value={location.city} required />
        <ReadBox label="State" value={stateLabel} required />
        <ReadBox label="Zip" value={location.zip} required />
      </div>

      <div className="fr-party-actions">
        <button
          type="button"
          className="primary-button compact-button fr-add-party"
          disabled={readOnly}
          onClick={() => write({ ...billing, parties: [...billing.parties, createParty()] })}
        >
          Add Party
        </button>
      </div>
      {copyNote ? <p className="field-hint">{copyNote}</p> : null}

      {billing.parties.map((party, index) => {
        const collapsed = collapsedPartyIds.includes(party.id);
        return (
        <article key={party.id} className={`fr-party-card${collapsed ? " is-collapsed" : ""}`}>
          <div className="fr-party-heading">
            <button
              type="button"
              className="fr-party-toggle"
              aria-expanded={!collapsed}
              aria-controls={`fr-party-body-${party.id}`}
              onClick={() => toggleParty(party.id)}
            >
              <span className="fr-party-chevron" aria-hidden="true">
                {collapsed ? "▸" : "▾"}
              </span>
              <span>PARTY {index + 1}</span>
              {collapsed ? <span className="fr-party-summary">{partySummary(party)}</span> : null}
            </button>
            {collapsed ? null : (
              <button
                type="button"
                className="secondary-button compact-button"
                disabled={readOnly}
                onClick={() => {
                  if (copyChoices.length === 0) {
                    setCopyNote("No people were found on Person.");
                    setCopyTargetId("");
                    return;
                  }
                  setCopyNote("");
                  setCopyTargetId(party.id);
                }}
              >
                Copy from Person
              </button>
            )}
          </div>
          {collapsed ? null : (
          <div id={`fr-party-body-${party.id}`}>
          {copyTargetId === party.id ? (
            <NerisFlatSingleOptionSelect
              inputId={`fr-copy-${party.id}`}
              value=""
              options={copyChoices}
              disabled={readOnly}
              usePortal
              placeholder="Select a person or owner"
              searchPlaceholder="Search people"
              onChange={(nextValue) => copySelectionIntoParty(party.id, nextValue)}
            />
          ) : null}
          <div className="fr-party-columns">
            <div>
              <PartyText party={party} field="firstName" label="First Name" level={level("fr.party.firstName")} readOnly={readOnly} onChange={updateParty} />
              <PartyText party={party} field="lastName" label="Last Name" level={level("fr.party.lastName")} readOnly={readOnly} onChange={updateParty} />
              <PartyText party={party} field="street" label="Street" level={level("fr.party.address")} readOnly={readOnly} onChange={updateParty} />
              <PartyText party={party} field="city" label="City" level={level("fr.party.address")} readOnly={readOnly} onChange={updateParty} />
              <PartyText party={party} field="state" label="State" level={level("fr.party.address")} readOnly={readOnly} onChange={updateParty} />
              <PartyText party={party} field="zip" label="Zip" level={level("fr.party.address")} readOnly={readOnly} onChange={updateParty} />
              <PartyText party={party} field="phone" label="Party Phone" level={level("fr.party.phone")} readOnly={readOnly} onChange={updateParty} />
              <PartyText party={party} field="email" label="Party Email" level={level("fr.party.email")} readOnly={readOnly} onChange={updateParty} />
              <div className="fr-bill-bar">
                <label htmlFor={`fr-resident-${party.id}`}>
                  Is Resident?{requiredMark(level("fr.party.isResident"))}
                </label>
                <NerisFlatSingleOptionSelect
                  inputId={`fr-resident-${party.id}`}
                  value={party.isResident}
                  options={[
                    { value: "YES", label: "Yes" },
                    { value: "NO", label: "No" },
                  ]}
                  disabled={readOnly}
                  usePortal
                  allowClear
                  placeholder="Yes or No"
                  onChange={(nextValue) =>
                    updateParty(party.id, { isResident: nextValue === "NO" ? "NO" : nextValue === "YES" ? "YES" : "" })
                  }
                />
              </div>
            </div>
            <div>
              <label className="fr-bill-bar">
                <input
                  type="checkbox"
                  checked={party.uninsured}
                  disabled={readOnly}
                  onChange={(event) => updateParty(party.id, { uninsured: event.target.checked })}
                />{" "}
                Uninsured
              </label>
              <PartyText
                party={party}
                field="insuranceCompany"
                label="Insurance Company / Liable Party"
                level={party.uninsured ? "optional" : level("fr.party.insuranceCompany")}
                readOnly={readOnly}
                onChange={updateParty}
              />
              <PartyText party={party} field="policyNumber" label="Policy Number" level={level("fr.party.policyNumber")} readOnly={readOnly} onChange={updateParty} />
              <PartyText party={party} field="insuranceContactNumber" label="Insurance Contact Number" level={level("fr.party.insuranceContact")} readOnly={readOnly} onChange={updateParty} />
            </div>
            <div>
              <p className="field-hint">Vehicle Make &amp; Model</p>
              <PartyText party={party} field="vehicleMake" label="Vehicle Make" level={level("fr.party.vehicleMake")} readOnly={readOnly} onChange={updateParty} />
              <PartyText party={party} field="vehicleModel" label="Vehicle Model" level={level("fr.party.vehicleModel")} readOnly={readOnly} onChange={updateParty} />
              <PartyText party={party} field="vehicleYear" label="Vehicle Year" level="optional" readOnly={readOnly} onChange={updateParty} />
              <PartyText party={party} field="licensePlate" label="License Plate" level={level("fr.party.licensePlate")} readOnly={readOnly} onChange={updateParty} />
              <PartyText party={party} field="vin" label="VIN" level={level("fr.party.vin")} readOnly={readOnly} onChange={updateParty} />
              <PartyText party={party} field="otherVehicleDetails" label="Other Vehicle Details" level="optional" readOnly={readOnly} onChange={updateParty} />
              <div className="fr-bill-bar">
                <label htmlFor={`fr-fault-${party.id}`}>
                  At Fault Party{requiredMark(level("fr.party.atFault"))}
                </label>
                <NerisFlatSingleOptionSelect
                  inputId={`fr-fault-${party.id}`}
                  value={party.atFault}
                  options={[
                    { value: "YES", label: "Yes" },
                    { value: "NO", label: "No" },
                  ]}
                  disabled={readOnly}
                  usePortal
                  allowClear
                  placeholder="Yes, No, or blank"
                  onChange={(nextValue) =>
                    updateParty(party.id, { atFault: nextValue === "NO" ? "NO" : nextValue === "YES" ? "YES" : "" })
                  }
                />
              </div>
              <label className="fr-bill-bar">
                <input
                  type="checkbox"
                  checked={party.commercialVehicle}
                  disabled={readOnly}
                  onChange={(event) => updateParty(party.id, { commercialVehicle: event.target.checked })}
                />{" "}
                Commercial vehicle
              </label>
              {party.commercialVehicle ? (
                <>
                  <PartyText party={party} field="dotNumber" label="DOT Number" level="optional" readOnly={readOnly} onChange={updateParty} />
                  <PartyText party={party} field="companyName" label="Company Name" level="optional" readOnly={readOnly} onChange={updateParty} />
                </>
              ) : null}
            </div>
          </div>
          {deleteAskId === party.id ? (
            <p>
              Delete this party?{" "}
              <button
                type="button"
                className="primary-button compact-button"
                onClick={() => {
                  write({ ...billing, parties: billing.parties.filter((entry) => entry.id !== party.id) });
                  setDeleteAskId("");
                }}
              >
                Delete This Party
              </button>{" "}
              <button type="button" className="secondary-button compact-button" onClick={() => setDeleteAskId("")}>
                Cancel
              </button>
            </p>
          ) : (
            <button
              type="button"
              className="secondary-button compact-button fr-delete-party"
              disabled={readOnly}
              onClick={() => setDeleteAskId(party.id)}
            >
              Delete This Party
            </button>
          )}
          </div>
          )}
        </article>
        );
      })}
    </div>
  );
}

function partySummary(party: FireRecoveryParty): string {
  const name = [party.firstName, party.lastName].filter((part) => part.trim()).join(" ");
  const vehicle = [party.vehicleYear, party.vehicleMake, party.vehicleModel]
    .filter((part) => part.trim())
    .join(" ");
  return [name || "No name yet", vehicle].filter(Boolean).join(" · ");
}

function ReadBox({
  label,
  value,
  title,
  required = false,
}: {
  label: string;
  value: string;
  title?: string;
  required?: boolean;
}) {
  return (
    <div className="fr-bill-bar" title={title}>
      <label>
        {label}
        {required ? " *" : ""}
      </label>
      <input type="text" value={value} readOnly />
    </div>
  );
}

type PartyTextField = {
  [Key in keyof FireRecoveryParty]: FireRecoveryParty[Key] extends string ? Key : never;
}[keyof FireRecoveryParty];

function PartyText({
  party,
  field,
  label,
  level,
  readOnly,
  onChange,
}: {
  party: FireRecoveryParty;
  field: PartyTextField;
  label: string;
  level: RequirementLevel;
  readOnly: boolean;
  onChange: (partyId: string, patch: Partial<FireRecoveryParty>) => void;
}) {
  return (
    <div className="fr-bill-bar">
      <label htmlFor={`fr-${field}-${party.id}`}>
        {label}
        {requiredMark(level)}
      </label>
      <input
        id={`fr-${field}-${party.id}`}
        type="text"
        value={party[field]}
        disabled={readOnly}
        onChange={(event) => onChange(party.id, { [field]: event.target.value })}
      />
    </div>
  );
}
