# Department Details Field Reference

This file lists the current fields in `Admin Functions > Department Details` so mapping can be done quickly later.

## Single Fillable Fields

| UI Field Label | Suggested Field Key |
| --- | --- |
| Department Name | `departmentName` |
| Department Address - Street | `departmentAddressStreet` |
| Department Address - City | `departmentAddressCity` |
| Department Address - State | `departmentAddressState` |
| Department Address - Zip Code | `departmentAddressZipCode` |
| Department Time Zone (DD-S) | `departmentTimeZone` (US-only: Eastern, Central, Mountain, Pacific) |
| Main Contact Name | `mainContactName` |
| Main Contact Phone Number | `mainContactPhoneNumber` |
| Secondary Contact Name | `secondaryContactName` |
| Secondary Contact Phone | `secondaryContactPhoneNumber` |
| Department Logo / Image Upload | `departmentLogoImage` |

## Multi Fillable Fields

| UI Field Label | Suggested Collection Key | Current Interaction |
| --- | --- | --- |
| Personnel | `personnel` | Use **Edit Personnel** button to open add/update screen |
| Apparatus | `apparatus` | Use **Edit Apparatus** button to open add/update screen |
| Stations | `stations` | Use **Edit Stations** button; CLICKABLE-LIST with click-to-edit |
| Personnel Qualifications | `personnelQualifications` | Use **Edit Personnel Qualifications**; list view, click row to edit, drag handle to reorder (order = hierarchy for scheduling) |
| Mutual Aid Departments | `mutualAidDepartments` | Use **Edit Mutual Aid Departments** button to open add/update screen |
| Shift Information | `shiftInformation` | Use **Edit Shift Information**; CLICKABLE-LIST with click-to-edit |
| User Type | `userType` | Use **Edit User Type** for defaults and custom role values |

## Shift Information Entry Fields

| UI Field Label | Suggested Field Key |
| --- | --- |
| Shift Type | `shiftType` |
| Shift Duration (number-only) | `shiftDuration` |
| Recurrence | `recurrence` |
| Recurrence Custom Value | `recurrenceCustomValue` |
| Location | `location` |

## Station Fields

| UI Field Label | Suggested Field Key |
| --- | --- |
| Station Name | `stationName` |
| Address | `address` |
| City | `city` |
| State | `state` |
| Phone | `phone` |
| Mobile Phone | `mobilePhone` |

## Apparatus Fields

| UI Field Label | Suggested Field Key |
| --- | --- |
| Unit ID | `unitId` |
| Unit Type | `unitType` |
| Minimum Personnel | `minimumPersonnel` |
| Personnel Requirements (DD-M) | `personnelRequirements` (must match `minimumPersonnel` selection count) |
| Station (DD-S) | `station` |

## Personnel Assignment Fields (Edit Screen)

| UI Field Label | Suggested Field Key | Source |
| --- | --- | --- |
| Shift (DD-S) | `assignedShift` | `shiftInformation` values |
| Apparatus Assignment (DD-S) | `assignedApparatus` | `apparatus` values |
| Station (DD-S) | `assignedStation` | `stations` values |
| User Type (DD-S) | `assignedUserType` | `userType` values |
| Qualifications (DD-M) | `qualifications` | `personnelQualifications` values |

## Notes

- Personnel records include a `qualifications` array (DD-M) linking to `personnelQualifications`. Legacy records without this field are migrated on load.
- DD-M fields (Personnel Requirements, Personnel Qualifications, Mutual Aid Departments) use the same pill-style dropdown as Additional Incident Types in NERIS Core Tab (`NerisFlatMultiOptionSelect`).
- Personnel/Apparatus/Stations editors support DD-S and DD-M interaction modes.
- Personnel add/edit popup now includes core assignment fields to avoid blank personnel records.
- Personnel assignment timezone is removed; personnel inherit department timezone.
- Mutual Aid Departments are sourced from `/api/neris/debug/entities` when available and fall back to valid FD ID options if unavailable.
- Clicking save actions stores values to browser localStorage (`fire-ultimate-department-details`), including **Save Department Details** and editor save buttons.
- When the proxy server is running (`npm run proxy`), the app also syncs to `/api/department-details` (GET on load, POST on save). Data is stored in `data/department-details.json` on the server.
