function trimValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * NERIS base.incident_number is the department incident number (27-001).
 * NERIS dispatch.incident_number is the CAD dispatch number.
 * A report field that still holds the dispatch number does not replace a saved incident number.
 */
export function chooseNerisIncidentNumbers({
  formIncidentNumber = "",
  formDispatchNumber = "",
  recordIncidentNumber = "",
  recordDispatchNumber = "",
  callNumber = "",
} = {}) {
  const formIncident = trimValue(formIncidentNumber);
  const formDispatch = trimValue(formDispatchNumber);
  const recordIncident = trimValue(recordIncidentNumber);
  const recordDispatch = trimValue(recordDispatchNumber);
  const call = trimValue(callNumber);
  const dispatchNumber = formDispatch || recordDispatch;
  const incidentChoices = [formIncident, recordIncident].filter(Boolean);
  const distinctIncident = incidentChoices.find(
    (value) => value !== dispatchNumber && value !== call,
  );
  const incidentNumber =
    distinctIncident ||
    incidentChoices.find((value) => value !== dispatchNumber) ||
    formIncident ||
    recordIncident ||
    call;
  return {
    incidentNumber,
    dispatchNumber: dispatchNumber || incidentNumber || call,
  };
}
