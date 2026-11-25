# Click by Click Checks

Use this list when the priority file status is **Waiting on click check**.

Each check has an ID, the item, and numbered steps. After you run a check, tell the agent pass or fail so the priority status can move to Done or back to Open.

**Updated:** 2026-11-25, afternoon America/Chicago. C1, C3, C4, and C7 are waiting on a click check. This work is on `feature/demo-modules`. Staging builds `submenu/neris-golive-cifpd`, so these steps will not show on staging until that branch has this commit.

---

## N6 — NERIS export incident number

**Item:** Export sends the department incident number, such as `27-001`. The dispatch number stays on the dispatch field. The form still shows both.

1. Wait until Render finishes this branch, then hard-refresh `https://cifpdil.staging.fireultimate.app`.
2. Open a Draft NERIS report whose incident number is `27-001` and whose dispatch number is the CAD number, such as `26017731`.
3. On the Core section, confirm **Incident Number** still shows `27-001` and **Dispatch Number** still shows the CAD number.
4. Export the report.
5. In the comparison list, confirm **Incident Number** is `27-001` and **Dispatch Incident Number** is the CAD number.

**Pass:** NERIS receives `27-001` as the incident number and the CAD number as the dispatch incident number. The two boxes on the form are unchanged.  
**Fail:** Incident Number in the comparison is the CAD number, or the form boxes swapped.

---

## C1, C3, C4, C7 — CAD email is stored once, fills blanks, and shows a problem

**Item:** A repeated CAD email does not create a second row or change the incident again. A later email fills only blank fields. A deleted dispatch number is not recreated. A failed email shows its reason on Raw Email.

1. Wait until Render is building `feature/demo-modules` (or `submenu/neris-golive-cifpd` after this commit is on that branch). Hard-refresh `https://cifpdil.staging.fireultimate.app`.
2. Open **Dispatch Parsing → Raw Email**. Note the newest row’s time and that the list has one row for that email.
3. Have dispatch resend that same email, or wait if Cloudflare delivers it again. Hard-refresh Raw Email.
4. Confirm there is still one row for that email, and the incident’s address and notes did not gain a second copy.
5. Open the matching incident. Type a different address, such as `1 TEST ST`, and save.
6. Have dispatch send a follow-up for that same CAD number with a different address. Hard-refresh the incident.
7. Confirm the address is still `1 TEST ST`. On Raw Email, that follow-up row says CAD has newer information for address.
8. Delete that incident from the incident number table. Have dispatch send another email for the same CAD number. Confirm Raw Email says the dispatch number was deleted and no new incident appears for it.
9. Restore the row when you are done.

**Pass:** One email stays one row. A filled address stays. A deleted call is not recreated. The reason is visible on Raw Email.  
**Fail:** A second row appears, the typed address is replaced, a deleted call comes back, or Raw Email stays silent when the email could not update the incident.

---

## E2 — Who can do what

**Item:** Department role permissions save and apply. Roles are User, Subadmin, Admin, and Superadmin. A department cannot invent a new role name such as secretary.

1. Sign in as an admin.
2. Go to **Admin Functions → Department Details → Access / Restrictions**.
3. Find **Who can do what**.
4. Change one action to a lower role. You should see **Saved.**
5. Sign out and sign in as a person with that lower role.
6. Try that action.
7. Sign back in as admin and set the action back to the original role.

**Pass:** The lower role can or cannot do the action in line with the choice you saved, and the only role names are User, Subadmin, Admin, and Superadmin.  
**Fail:** The save does not stick, the wrong role can still do it, or you can type a new role name.

---

## N19 — Structure-fire protection answers

**Item:** A structure fire cannot be validated until the four fire-protection answers are filled. Those answers show an asterisk and stay visible when Show Required Fields Only is on. Was aid given or received is required. Back, Save, and Next on Risk Reduction are normal height.

1. On staging, open a NERIS report whose incident type is a structure fire.
2. Check **Show Required Fields Only**.
3. Open **Risk Reduction**.
4. Confirm the four questions (smoke alarm, fire alarm, other alarm, fire suppression) are visible and each label ends with *.
5. Confirm **Back**, **Save**, and **Next** are short buttons. Also confirm **Yes**, **No**, and **Unknown** under Risk reduction completed, Follow-up required, and Contact Made are short before any answer is chosen.
6. Open the main incident section and confirm **Was aid given or received?** has * and Validate complains if it is empty.
7. Answer the four protection questions (No or Unknown is enough) and answer the aid question.
8. Click **Validate**.

**Pass:** Validate no longer lists those four protection questions or the aid question. The buttons look like the buttons on other NERIS sections.  
**Fail:** A structure fire validates with those answers blank, the questions hide when Show Required Fields Only is on, or the buttons are still tall.

Do not click **Export** or **Confirm and send** unless you mean to send the report.
