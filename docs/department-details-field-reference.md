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
| Stations | `stations` | Use **Edit Stations** button to open add/update screen |
| Mutual Aid Departments | `mutualAidDepartments` | Use **Edit Mutual Aid Departments** button to open add/update screen |
| Shift Information | `shiftInformation` | Use **Edit Shift Information** for Shift Type, Shift Duration, Recurrence, and Location |
| User Type | `userType` | Use **Edit User Type** for defaults and custom role values |

## Shift Information Entry Fields

| UI Field Label | Suggested Field Key |
| --- | --- |
| Shift Type | `shiftType` |
| Shift Duration | `shiftDuration` |
| Recurrence | `recurrence` |
| Recurrence Custom Value | `recurrenceCustomValue` |
| Location | `location` |

## Personnel Assignment Fields (Edit Screen)

| UI Field Label | Suggested Field Key | Source |
| --- | --- | --- |
| Shift (DD-S) | `assignedShift` | `shiftInformation` values |
| Apparatus Assignment (DD-S) | `assignedApparatus` | `apparatus` values |
| Station (DD-S) | `assignedStation` | `stations` values |
| User Type (DD-S) | `assignedUserType` | `userType` values |

## Notes

- Personnel/Apparatus/Stations editors now support DD-S and DD-M interaction modes.
- Detailed credentials schema for personnel is planned for the next phase.
