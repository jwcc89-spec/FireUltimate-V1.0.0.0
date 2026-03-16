# Later Tasks: Validate/Export by Role, Super Admin, and Admin Show/Hide Mode

**Branch:** `submenu/neris-golive-cifpd`  
**Created:** 2026-03-12  
**Purpose:** A detailed, step-by-step, beginner-friendly plan for future work. **Do not implement these yet**—use this as a roadmap when you’re ready.

---

## Summary of “Later” Work

1. **Validate vs Export by role**  
   - Validate: allowed for **all users**.  
   - Export: **admin only**; hide the Export button for non-admin users.

2. **Super admin**  
   - **Purpose:** You (platform owner) can go in and control certain aspects/functions of the tenant’s account.  
   - **Staging only:** The “Super Admin” user type is **visible** in the user type dropdown **only in staging environments** (e.g. `import.meta.env.DEV` or hostname contains `staging`), so you can assign super admins.  
   - **Production:** In production, “Super Admin” is **not visible** in the dropdown and must not be assignable by tenant admins.  
   - Each account has **1–2 super admins**, assigned by you only.  
   - Certain fields/buttons are **only for super admins**; hidden for other users.  
   - Used in **sandbox/staging** for testing and tenant control.

3. **Admin show/hide mode**  
   - A button to enter **“admin show/hide mode”**.  
   - In this mode, click **fields** to toggle **show** or **hide** (e.g. greyed out = hidden) **per user type**.  
   - Same idea for **menus and submenus**: in this mode, click to set visibility (show/hide) by user type.  
   - Example: on Department Details, the view looks the same in this mode, but clicking a field marks it show/hide for the selected user type.

---

## Part 1: Validate for All Users, Export for Admin Only (Hide Export for Non-Admin)

### Goal

- **Validate:** Any logged-in user can click **Validate**. It runs validation only and sets status to **In Review**.  
- **Export:** Only **admin** users can export. The **Export** button is **hidden** for non-admin users.

### Step-by-Step Plan

1. **Identify where role is used**
   - In `NerisReportFormPage.tsx`, the Export button is already inside `{role === "admin" ? ( ... ) : null}`.  
   - Confirm that `role` comes from session/context (e.g. `session.role` or auth context).  
   - Ensure there is a single source of truth for “is this user an admin?” (e.g. `role === "admin"` or `user.role === "admin"`).

2. **Keep Validate visible for everyone**
   - **Validate** (and **Check for Errors**) should be visible to **all** authenticated users.  
   - If **Validate** is currently only shown when `role === "admin"`, change the condition so that **Validate** is shown for all users, and only **Export** is wrapped in `role === "admin"`.

3. **Ensure Validate does not export**
   - Already done in the current implementation: **Validate** runs `handleAdminValidateOnly` (validation only, sets “In Review”).  
   - **Export** is a separate button that runs `handleExportReport`.  
   - No further change needed for “validate only” behavior.

4. **Hide Export for non-admin**
   - Ensure the **Export** button is rendered only when `role === "admin"`.  
   - If both Validate and Export are in the same `role === "admin"` block, split them:  
     - Render **Check for Errors** and **Validate** for everyone.  
     - Render **Export** only when `role === "admin"`.

5. **Optional: API guard for export**
   - If the app has a backend export endpoint (e.g. proxy that submits to NERIS), add a server-side check so that non-admin users receive **403 Forbidden** if they somehow trigger export.  
   - This protects against tampering (e.g. calling the export API from the browser console).

6. **Test**
   - Log in as **admin**: you should see **Check for Errors**, **Validate**, and **Export**.  
   - Log in as **non-admin**: you should see **Check for Errors** and **Validate**, but **not** **Export**.  
   - As non-admin, run **Validate** and confirm status becomes **In Review** and no export occurs.

---

## Part 2: Super Admin (Hidden User Type, 1–2 Per Account, Special Visibility)

### Goal

- **Super admin** is not a user type that can be selected when creating/editing users.  
- Each account has **1–2 super admins**, assigned by you only (e.g. via database or a separate admin tool).  
- Super admins see **extra** fields/buttons that are **hidden** for other users (including normal admins).  
   - Used in sandbox/testing environments.

### Step-by-Step Plan

1. **Define “super admin” in the data model**
   - Decide how super admin is stored:  
     - Option A: A flag on the User table (e.g. `is_super_admin: boolean`).  
     - Option B: A separate table or config (e.g. “account_super_admins” with user id and tenant id).  
   - **Constraint:** Do not change Prisma schema or auth logic without explicit user approval (per agent-execution-contract).  
   - So: **first step** is to propose the schema/field (e.g. `User.isSuperAdmin` or a small config table) and get approval before implementing.

2. **Restrict how super admins are assigned**
   - Super admins are **assigned by you only** (not via the normal “Edit user” / “User type” UI).  
   - Implementation options:  
     - Manual DB update (e.g. set `is_super_admin = true` for 1–2 users per tenant).  
     - A dedicated “Platform” or “Super Admin” UI that only you can access (e.g. protected by platform admin key or separate auth).  
   - Do **not** expose “Super Admin” as a selectable role in the normal user type dropdown.

3. **Hide “Super Admin” from user type list in production**
   - Wherever user types/roles are listed (e.g. Department Users, Create User, Edit User), **filter out** “Super Admin” from the dropdown/options **in production only**.  
   - In **staging** (e.g. dev server or hostname containing `staging`), show “Super Admin” so you can assign super admins.  
   - So in production, tenant admins cannot assign “Super Admin”; in staging, you can.

4. **Use super admin for visibility rules**
   - For any feature that should be “super admin only” (e.g. a button or field):  
     - Check both `role === "admin"` and `user.isSuperAdmin` (or equivalent).  
     - Render the button/field only if the user is a super admin.  
   - Start with a small set of such features (e.g. one “sandbox-only” button or section) and expand later.

5. **Sandbox usage**
   - Document that super admin–only features are for **sandbox/testing** environments.  
   - No schema or auth change should weaken tenant isolation (super admin is per-tenant or per-account, not global god-mode unless explicitly designed that way).

6. **Test**
   - As a normal admin: you do **not** see super-admin–only UI.  
   - As a super admin (after assignment): you **do** see the extra buttons/fields.  
   - User type dropdown never shows “Super Admin” as an option.

---

## Part 3: Admin Show/Hide Mode (Click to Set Field/Menu Visibility by User Type)

### Goal

- A button (e.g. **“Admin show/hide mode”**) that toggles a special mode.  
- In this mode:  
  - The page looks the same (e.g. Department Details), but you can **click** on a **field** to toggle whether it is **visible** or **hidden** for a chosen **user type**.  
  - Hidden can be shown as **greyed out** or clearly marked.  
  - You can do the same for **menus and submenus**: click to set visibility per user type.  
- Visibility is stored (e.g. per tenant, per page/section, per user type) and applied when not in “show/hide mode.”

### Step-by-Step Plan

1. **Decide where visibility is stored**
   - Options:  
     - **A.** Backend: e.g. a table `field_visibility` or a JSON column in `department_details` / tenant config: `{ "DepartmentDetails": { "field_xyz": { "admin": true, "user": false } } }`.  
     - **B.** Frontend only (e.g. localStorage per tenant) for an MVP, then move to backend.  
   - Recommendation: backend (tenant-scoped) so that visibility rules are consistent across devices and users.  
   - **Constraint:** Do not store auth secrets in `DepartmentDetails.payloadJson` (per project rules). Use a dedicated table or a safe config structure.

2. **Define the data model for visibility**
   - For **fields**: e.g.  
     - `pageId` (or “DepartmentDetails”, “NerisReportForm”, etc.),  
     - `fieldId` (e.g. “incident_onset_date”, “fd_neris_id”),  
     - `userType` (e.g. “admin”, “user”, “super_admin”),  
     - `visible: boolean`.  
   - For **menus/submenus**: e.g.  
     - `menuId` / `submenuId`,  
     - `userType`,  
     - `visible: boolean`.  
   - Get approval for any new tables or columns before implementing.

3. **Implement “Admin show/hide mode” toggle**
   - Add a button (e.g. in the shell or on the relevant admin page) that only **admin** (or **super admin**) can see.  
   - Clicking it toggles a global state (e.g. React context or URL param): `isAdminShowHideMode: boolean`.  
   - When `isAdminShowHideMode` is true, the UI enters the special mode (see next step).

4. **Render fields (and menus) in show/hide mode**
   - When in show/hide mode:  
     - Render the page as usual, but each **field** (and each **menu/submenu** item) is **clickable** to toggle visibility for a **selected user type**.  
     - Provide a way to **select the user type** you’re editing (e.g. dropdown: Admin, User, Super Admin).  
     - On click:  
       - If the field is currently “visible” for that user type → mark it “hidden” (e.g. grey it out and persist).  
       - If “hidden” → mark it “visible” and persist.  
     - Persist to backend (or to your chosen store) immediately or on “Save visibility” so that when the mode is off, the correct visibility is applied.

5. **Apply visibility when not in show/hide mode**
   - When `isAdminShowHideMode` is false:  
     - Before rendering a field (or menu item), look up the current user’s type and the stored visibility for that field (and user type).  
     - If the field is marked **hidden** for that user type, **do not render** it (or render a placeholder/hidden state).  
   - Use a small helper or context so that every field and menu doesn’t duplicate the same logic.

6. **Menus and submenus**
   - Apply the same idea: each **menu item** and **submenu item** has an associated visibility rule per user type.  
   - In show/hide mode, clicking a menu/submenu toggles its visibility for the selected user type.  
   - When not in show/hide mode, the shell (e.g. `App.tsx` or wherever nav is built) filters menu/submenu items by the current user type and visibility rules.

7. **UX details**
   - **Greyed out** in show/hide mode can mean “hidden for this user type.”  
   - Tooltip or label: “Visible for Admin” / “Hidden for User” so the admin knows what they’re setting.  
   - Consider a “Reset to default” for a page or for all visibility rules (optional).

8. **Test**
   - Enter show/hide mode, select “User,” click a field to hide it.  
   - Exit mode, log in as a normal user: that field should not appear.  
   - Log in as admin: the field should still appear (unless you hid it for admin too).  
   - Same for a menu item: hide it for “User,” then as user the menu item should be gone.

---

## NERIS Report Writer (Already Addressed)

- **Question:** Is a “report writer” field or value required by NERIS on export?  
- **In this codebase:** `src/nerisMetadata.ts` defines `NERIS_REQUIRED_FIELD_MATRIX`. It does **not** include any “report writer” or `report_writer` field in `coreMinimum` or in the incident-family-specific lists.  
- **Conclusion:** NERIS required-field documentation in the app does **not** require report writer on export.  
- **Implemented:** For **validation**, when running validate-only, the app now fills the **currently logged-in user** as report writer for any resource unit that has an empty report writer (so validation can succeed without the user picking one). Export still uses whatever report writer is in the form (no forced override).

---

## Now vs Later

| Done now (this session) | Do later |
|------------------------|----------|
| Validate button = validate only; status “In Review” after validate, “Exported” (green) after export | Validate for all users; Export admin-only and hidden for non-admin |
| Report writer filled with current user for validation when empty | Super admin: hidden user type, 1–2 per account, special visibility |
| — | Admin show/hide mode: toggle field and menu visibility per user type |

---

## Blocker / Assumptions

- **Super admin** and **admin show/hide mode** require decisions on:  
  - Where to store visibility (table vs JSON, tenant-scoped).  
  - Schema changes (new columns or tables) and explicit user approval before changing Prisma/auth.  
- **Admin show/hide mode** assumes you want to drive visibility by **user type** (admin, user, super_admin). If you prefer role names from your auth system, the same plan applies with those names.

---

**Agent used for this response:** Auto (Cursor).
