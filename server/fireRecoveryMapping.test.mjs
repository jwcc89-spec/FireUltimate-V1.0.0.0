import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFireRecoveryPayload, missingFireRecoveryFields } from "./fireRecoveryMapping.mjs";

const nerisCode = "MEDICAL: INJURY: MOTOR_VEHICLE_COLLISION";

function sampleFormValues() {
  return {
    primary_incident_type: nerisCode,
    incident_onset_date: "2026-11-01",
    incident_time_call_arrival: "14:05",
    incident_time_clear: "15:10",
    incident_time_unit_on_scene: "2026-11-01T14:12:00",
    incident_internal_id: "26-079",
    incident_location_address: "1 Main, Crescent, IL 60922",
    location_state: "IL",
    location_postal_code: "60922",
    narrative_outcome: "Two cars stopped.",
    incident_actions_taken: "PROVIDE_BASIC_LIFE_SUPPORT",
    person_owner_vehicles_json: JSON.stringify([{ policeReportFileNumber: "LE-9" }]),
    resource_units_json: JSON.stringify([
      {
        unitId: "1871",
        unitType: "ENGINE",
        onSceneTime: "2026-11-01T14:12:00",
        clearTime: "2026-11-01T15:00:00",
        personnel: "Ada Lane, Bo Kim",
        isCanceledEnroute: false,
      },
      { unitId: "1881", unitType: "CHIEF", personnel: "Cam Ortiz", isCanceledEnroute: true },
    ]),
    fire_recovery_billing_json: JSON.stringify({
      version: 1,
      runType: "COMMERCIAL_TRUCKING",
      lawEnforcementReportNumber: "PD-100",
      nerisCode,
      parties: [
        {
          firstName: "Ada",
          lastName: "Lane",
          street: "1 Main",
          city: "Crescent",
          state: "IL",
          zip: "60922",
          phone: "555-0100",
          email: "",
          isResident: "YES",
          uninsured: true,
          insuranceCompany: "Should be blank",
          policyNumber: "",
          insuranceContactNumber: "",
          vehicleMake: "Ford",
          vehicleModel: "Focus",
          vehicleYear: "2018",
          licensePlate: "ABC123",
          vin: "VIN1",
          otherVehicleDetails: "",
          atFault: "NO",
          commercialVehicle: false,
          dotNumber: "",
          companyName: "",
        },
        {
          firstName: "Bo",
          lastName: "Kim",
          street: "2 Oak",
          city: "Crescent",
          state: "IL",
          zip: "60922",
          phone: "",
          email: "bo@example.com",
          isResident: "NO",
          uninsured: false,
          insuranceCompany: "Acme",
          policyNumber: "P1",
          insuranceContactNumber: "555-0199",
          vehicleMake: "Peterbilt",
          vehicleModel: "389",
          vehicleYear: "2020",
          licensePlate: "",
          vin: "",
          otherVehicleDetails: "Box truck",
          atFault: "YES",
          commercialVehicle: true,
          dotNumber: "1234567",
          companyName: "Kim Hauling",
        },
      ],
    }),
  };
}

describe("fire recovery mapping", () => {
  it("builds the vendor JSON for a two-party motor-vehicle bill", () => {
    const payload = buildFireRecoveryPayload(
      sampleFormValues(),
      { nerisId: "FD33333333|2026|1", reportWriterName: "Ada Lane", callNumber: "call-26-079" },
      { departmentId: "FD12345678", departmentName: "Crescent Fire" },
      { submittedAt: "2026-11-01T20:48:00" },
    );
    const incident = payload.IncidentToBillPayload.IncidentsToBill.incident;
    assert.equal(payload.IncidentToBillPayload.NERISDepartmentId, "FD12345678");
    assert.equal(payload.IncidentToBillPayload.DepartmentName, "Crescent Fire");
    assert.equal(incident.IncidentID, "26-079");
    assert.equal(incident.IncidentType, nerisCode);
    assert.equal(incident.IncidentTypeDescription, nerisCode);
    assert.equal(incident.CostRecovery.PrincipleIncidentType, nerisCode);
    assert.equal(incident.CostRecovery.PrincipleIncidentType.includes(":"), true);
    assert.equal(incident.AlarmDateTime, "2026-11-01T14:05:00");
    assert.equal(incident.FirstUnitOnSceneDateTime, "2026-11-01T14:12:00");
    assert.equal(incident.ClearedDateTime, "2026-11-01T15:10:00");
    assert.equal(incident.CanceledInRoute, false);
    assert.equal(incident.Narrative, "Two cars stopped.");
    assert.equal(incident.Location.LocationID, "call-26-079");
    assert.equal(incident.Location.City, "Crescent");
    assert.equal(incident.CostRecovery.NerisIdIncident, "FD33333333|2026|1");
    assert.equal(incident.CostRecovery.IncidentNumber, "26-079");
    assert.equal(incident.CostRecovery.LawEnforcementNumber, "PD-100");
    assert.equal(incident.CostRecovery.CatchCreated, "2026-11-01T20:48:00");
    assert.equal(incident.CostRecovery.TotalPersonnelOnScene, 2);
    assert.deepEqual(incident.CostRecovery.FiledBy, { First: "Ada", Last: "Lane", Middle: "" });
    assert.equal(incident.CostRecovery.Parties.length, 2);
    assert.equal(incident.CostRecovery.Parties[0].Party.Vehicle.InsuranceCompanyName, "");
    assert.equal(incident.CostRecovery.Parties[0].Party.Isresident, true);
    assert.equal(incident.CostRecovery.Parties[1].Party.Vehicle.CommercialVehicle, true);
    assert.equal(incident.CostRecovery.Parties[1].Party.Vehicle.DOTNumber, "1234567");
    assert.equal(incident.CostRecovery.Parties[1].Party.Vehicle.CompanyName, "Kim Hauling");
    assert.equal(incident.CostRecovery.Parties[1].Party.Vehicle.InsuranceCompanyName, "Acme");
    assert.equal(incident.CostRecovery.Parties[1].Party.AtFault, true);
    assert.equal(incident.RespondingUnits[1].UnitCanceledEnRoute, true);
    assert.equal(incident.IncidentActionsTaken[0].IncidentActionsTakenCode, "PROVIDE_BASIC_LIFE_SUPPORT");
  });

  it("uses the vehicle police report number when the billing number is blank", () => {
    const formValues = sampleFormValues();
    const billing = JSON.parse(formValues.fire_recovery_billing_json);
    billing.lawEnforcementReportNumber = "";
    formValues.fire_recovery_billing_json = JSON.stringify(billing);
    const payload = buildFireRecoveryPayload(formValues, { nerisId: "N", reportWriterName: "Ada Lane", callNumber: "c" }, { departmentId: "FD12345678", departmentName: "Crescent Fire" }, { submittedAt: "2026-11-01T20:48:00" });
    assert.equal(payload.IncidentToBillPayload.IncidentsToBill.incident.CostRecovery.LawEnforcementNumber, "LE-9");
  });

  it("refuses a bill that is missing a required party field and lets Uninsured waive insurance", () => {
    const formValues = sampleFormValues();
    const billing = JSON.parse(formValues.fire_recovery_billing_json);
    billing.parties[1].insuranceCompany = "";
    billing.parties[1].uninsured = false;
    formValues.fire_recovery_billing_json = JSON.stringify(billing);
    const missing = missingFireRecoveryFields(formValues, null, "Ada Lane");
    assert.equal(missing.some((label) => label.includes("Insurance")), true);
    billing.parties[1].uninsured = true;
    billing.parties[1].isResident = "";
    formValues.fire_recovery_billing_json = JSON.stringify(billing);
    const waived = missingFireRecoveryFields(formValues, { "fr.party.isResident": "required" }, "Ada Lane");
    assert.equal(waived.some((label) => label.includes("Insurance")), false);
    assert.equal(waived.some((label) => label.includes("Is Resident")), true);
  });
});
