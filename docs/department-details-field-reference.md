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

## Notes

- The edit popup currently supports adding, updating (inline), and removing simple text entries.
- Detailed field schemas for Personnel, Apparatus, Stations, and Mutual Aid Departments will be added in the next implementation phase.
