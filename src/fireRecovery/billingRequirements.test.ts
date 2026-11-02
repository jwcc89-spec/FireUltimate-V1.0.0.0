import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  billingValidationIssueLabels,
  callClearedValue,
  copyPartiesFromPersonOwner,
  displayClock,
  findBillingGaps,
  incidentLocationParts,
  isFireRecoveryBillable,
  onScenePersonnel,
  createParty,
  parseBilling,
  parseRequirementSettings,
  requirementLevel,
  serializeBilling,
  type FireRecoveryBilling,
} from "./billingRequirements.ts";

const person = {
  firstName: "Ada",
  lastName: "Lane",
  phone: "555-0100",
  street: "1 Main",
  city: "Crescent",
  state: "IL",
  zip: "60922",
};

describe("fire recovery billing requirements", () => {
  it("matches a motor-vehicle type on the primary or an additional type", () => {
    assert.equal(
      isFireRecoveryBillable("MEDICAL: INJURY: MOTOR_VEHICLE_COLLISION", ""),
      true,
    );
    assert.equal(
      isFireRecoveryBillable("FIRE", "MEDICAL||INJURY||MOTOR_VEHICLE_COLLISION"),
      true,
    );
    assert.equal(isFireRecoveryBillable("MEDICAL: ILLNESS", ""), false);
  });

  it("copies the person's name at copy time and does not store a list position", () => {
    const parties = copyPartiesFromPersonOwner(
      [person],
      [],
      [
        {
          personsInvolved: ["person:0"],
          vehicleMake: "Ford",
          model: "Focus",
          year: "2018",
          vin: "VIN1",
          licensePlate: "ABC123",
          uninsured: false,
          insuranceCompanyName: "Acme",
          policyNumber: "P1",
          insuranceCompanyPhone: "555-0199",
        },
        {
          personsInvolved: [],
          vehicleMake: "Skip",
          model: "Me",
          year: "",
          vin: "",
          licensePlate: "",
          uninsured: false,
          insuranceCompanyName: "",
          policyNumber: "",
          insuranceCompanyPhone: "",
        },
      ],
    );
    assert.equal(parties.length, 1);
    assert.equal(parties[0]?.firstName, "Ada");
    assert.equal(parties[0]?.lastName, "Lane");
    assert.equal(parties[0]?.vehicleMake, "Ford");
    assert.equal(parties[0]?.insuranceCompany, "Acme");
    assert.equal(JSON.stringify(parties).includes("person:"), false);
  });

  it("counts distinct people selected on Resources and skips a canceled unit", () => {
    const result = onScenePersonnel(
      JSON.stringify([
        { onSceneTime: "10:01", personnel: "Ada Lane, Bo Kim", isCanceledEnroute: false },
        { personnel: "Ada Lane", isCanceledEnroute: false },
        { personnel: "Cam Ortiz", isCanceledEnroute: false },
        { onSceneTime: "10:02", personnel: "Canceled", isCanceledEnroute: true },
      ]),
    );
    assert.deepEqual(result.names, ["Ada Lane", "Bo Kim", "Cam Ortiz"]);
    assert.equal(result.count, 3);
  });

  it("reads Time Call Cleared from Incident Times, then the latest Resources clear time", () => {
    assert.equal(
      displayClock(
        callClearedValue({
          incident_time_clear: "2026-11-01T15:10:00",
          resource_units_json: JSON.stringify([{ clearTime: "2026-11-01T16:00:00" }]),
        }),
      ),
      "15:10",
    );
    assert.equal(
      displayClock(
        callClearedValue({
          resource_units_json: JSON.stringify([
            { clearTime: "2026-11-01T14:00:00", isCanceledEnroute: false },
            { clearTime: "2026-11-01T16:40:00", isCanceledEnroute: false },
            { clearTime: "2026-11-01T18:00:00", isCanceledEnroute: true },
          ]),
        }),
      ),
      "16:40",
    );
    assert.equal(
      displayClock(callClearedValue({ incident_time_unit_clear: "2026-11-01T17:05:00" })),
      "17:05",
    );
  });

  it("reads city from a street, city, state address", () => {
    assert.deepEqual(
      incidentLocationParts({
        incident_location_address: "1 Main, Crescent, IL 60922",
        location_state: "IL",
        location_postal_code: "60922",
      }),
      { street: "1 Main", city: "Crescent", state: "IL", zip: "60922" },
    );
  });

  it("lets Uninsured waive the insurance company and lets a department require Is Resident", () => {
    const settings = parseRequirementSettings({ "fr.party.isResident": "required", ignored: "required" });
    assert.equal(requirementLevel("fr.party.isResident", settings), "required");
    assert.equal(requirementLevel("fr.party.phone", settings), "recommended");
    const billing: FireRecoveryBilling = {
      version: 1,
      runType: "MOTOR_VEHICLE",
      lawEnforcementReportNumber: "",
      nerisCode: "MEDICAL: INJURY: MOTOR_VEHICLE_COLLISION",
      parties: [
        {
          ...createParty("p1"),
          firstName: "Ada",
          lastName: "Lane",
          street: "1 Main",
          city: "Crescent",
          state: "IL",
          zip: "60922",
          isResident: "YES",
          uninsured: true,
          vehicleMake: "Ford",
          vehicleModel: "Focus",
        },
      ],
    };
    const formValues = {
      incident_onset_date: "2026-11-01",
      incident_time_call_arrival: "14:05",
      incident_time_clear: "15:10",
      incident_internal_id: "26-079",
      incident_location_address: "1 Main, Crescent, IL 60922",
      location_state: "IL",
      location_postal_code: "60922",
      primary_incident_type: "MEDICAL: INJURY: MOTOR_VEHICLE_COLLISION",
      resource_units_json: JSON.stringify([{ onSceneTime: "14:10", personnel: "Ada Lane" }]),
    };
    const gaps = findBillingGaps(billing, formValues, settings, "Chief");
    assert.equal(gaps.required.some((entry) => entry.label.includes("Insurance")), false);
    assert.equal(gaps.recommended.some((entry) => entry.label.includes("Phone")), true);
    const roundTrip = parseBilling(serializeBilling(billing));
    assert.equal(roundTrip.parties[0]?.uninsured, true);
    assert.equal(roundTrip.parties[0]?.id, "p1");
  });

  it("lists required Fire Recovery fields for Validate and skips Form Filed By", () => {
    const settings = parseRequirementSettings(null);
    const motorVehicle = {
      primary_incident_type: "MEDICAL: INJURY: MOTOR_VEHICLE_COLLISION",
      incident_onset_date: "2026-11-01",
      incident_time_call_arrival: "14:05",
      incident_time_clear: "15:10",
      incident_internal_id: "26-079",
      incident_location_address: "1 Main, Crescent, IL 60922",
      location_state: "IL",
      location_postal_code: "60922",
      resource_units_json: JSON.stringify([{ onSceneTime: "14:10", personnel: "Ada Lane" }]),
    };
    const empty = billingValidationIssueLabels(motorVehicle, settings);
    assert.equal(empty.some((label) => label.includes("Form Filed By")), false);
    assert.equal(empty.some((label) => label.includes("At least one party")), true);
    const withParty = billingValidationIssueLabels(
      {
        ...motorVehicle,
        fire_recovery_billing_json: serializeBilling({
          version: 1,
          runType: "MOTOR_VEHICLE",
          lawEnforcementReportNumber: "",
          nerisCode: "",
          parties: [createParty("p1")],
        }),
      },
      settings,
    );
    assert.equal(withParty.some((label) => label.includes("First Name")), true);
    assert.equal(withParty.some((label) => label.includes("Party Phone")), false);
    assert.equal(
      billingValidationIssueLabels(
        { primary_incident_type: "FIRE: STRUCTURE_FIRE: STRUCTURAL_INVOLVEMENT_FIRE" },
        settings,
      ).length,
      0,
    );
  });

  it("keeps the billing JSON out of the NERIS export builder", () => {
    const source = readFileSync(new URL("../../server/neris-proxy.mjs", import.meta.url), "utf8");
    assert.equal(source.includes("fire_recovery_billing_json"), false);
  });
});
