# Click by Click Checks

Use this list when the priority file status is **Waiting on click check**.

Each check has an ID, the item, and numbered steps. After you run a check, tell the agent pass or fail so the priority status can move to Done or back to Open.

**Updated:** 2026-11-22, afternoon America/Chicago. N19 is waiting on a click check after the next staging deploy.

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
