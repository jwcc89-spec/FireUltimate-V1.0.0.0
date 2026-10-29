import {
  Callout, Card, CardBody, CardHeader, Divider, Grid, H1, H2, H3,
  Pill, Row, Stack, Stat, Table, Text, useHostTheme, useState,
} from "cursor/canvas";

const today = [
  ["Login", "The login screen hides the app's pages, but the server checks the password and then forgets you. Nothing proves later requests for data came from a logged-in person.", "Anyone who asks the server directly can read or change a department's data without logging in. Confirmed Oct 29 (read-only check): the live Crescent site returned its list of 21 accounts to a request that was not signed in."],
  ["Role", "Stored in the browser and trusted. At login the server also prefers a 'user type' label from department settings over the real role in the user table.", "Anyone who can edit browser storage or department settings can make themselves admin."],
  ["Change password", "The browser says which username to change.", "Works only because the current password is also required; still identifies the person from the browser, not the server."],
  ["Logout", "Only clears the browser's copy.", "Nothing to revoke on the server; a copied login cannot be cancelled."],
  ["Failed logins", "Unlimited attempts.", "Passwords can be guessed by trying many times."],
];

const flow = [
  ["1. Log in", "You enter username and password as today. The server checks them against the user table for this department's web address."],
  ["2. Sign-in pass issued", "The server creates a long random pass (like a one-time ticket number), stores only a scrambled fingerprint of it in the database, and hands the pass to the browser in a protected cookie."],
  ["3. Every request", "The browser automatically sends the cookie. The server looks up the fingerprint, confirms it is not expired or cancelled, confirms it belongs to this department, and loads the person's current role from the user table."],
  ["4. Idle for 60 minutes or browser closed", "If the pass has not been used for 60 minutes, the server refuses it and the app shows a sign-in box over the current screen with 'Your session expired'. Signing back in continues where you were."],
  ["5. Log out", "The server cancels the pass immediately and the browser clears cached department data."],
  ["6. Password changed or reset", "All other passes for that person are cancelled, so a lost or shared login stops working everywhere."],
];

const cookie = [
  ["HttpOnly", "Page scripts cannot read the pass, so a malicious script cannot copy it."],
  ["Secure", "Sent only over HTTPS (relaxed automatically for localhost development)."],
  ["SameSite=Strict", "Other websites cannot make your browser use the pass."],
  ["Host-only (no Domain)", "A pass for cifpdil.fireultimate.app is never sent to demo.fireultimate.app or any other department."],
  ["Stored as a fingerprint", "The database holds only a SHA-256 fingerprint. A database leak does not reveal usable passes, and no new secret key is needed in Render."],
  ["Bound to the department", "A pass created on one department's address is refused on every other department's address."],
  ["Ends when the browser closes", "The pass has no expiry date in the browser, so closing the browser throws it away. Some browsers restore it when 'continue where you left off' is on; the server's 60-minute inactivity limit still applies."],
];

const sessionColumns = [
  ["Pass fingerprint", "A scrambled copy of the pass the browser holds. Like keeping a photo of a key instead of the key itself: it can confirm a match, but cannot be used to open the door."],
  ["Department", "Which department's address the person signed in on. The pass only works there."],
  ["Person", "Which user account signed in (a link to the existing user list)."],
  ["Signed in at", "Date and time of login."],
  ["Last active", "Updated as the person uses the app. Used for the 60-minute inactivity limit."],
  ["Expires at", "When the pass stops working if unused."],
  ["Cancelled at", "Filled in on logout, password change or account removal. A cancelled pass is refused immediately."],
];

const publicRoutes = [
  ["POST /api/auth/login", "Needed to log in.", "Failed-attempt lockout added."],
  ["GET /api/tenant/context", "Login page shows the department name.", "Unchanged."],
  ["POST /api/cad/inbound-email", "Called by the Cloudflare email Worker, not a person.", "Keeps its shared secret header; sender rules come in Step 23."],
  ["/api/admin/*", "Program-owner tools.", "Keeps the platform admin key."],
  ["Web pages and images", "The app itself must load to show the login screen.", "Unchanged."],
];

const newRoutes = [
  ["GET /api/auth/session", "Who am I? Returns username, display name and role from the server. The app uses this on every page load instead of trusting browser storage."],
  ["POST /api/auth/logout", "Cancels the current pass."],
];

const capabilities = [
  ["users.manage", "Create, edit, reset, delete accounts", "Admin", "Today: no login needed. Superadmin accounts protected from admins (existing plan)."],
  ["settings.department", "Save Department Details", "Admin", "Saving settings will no longer create, change or delete accounts."],
  ["incidents.view", "See the Incidents tab", "User", "Decided Oct 28: admin chooses roles. Default keeps today's behavior."],
  ["incidents.create", "Create incidents by hand", "Open question", "Decided Oct 28: admin chooses roles."],
  ["incidents.delete", "Delete incidents", "Admin", "Decided Oct 28."],
  ["reports.edit", "Edit run reports (NERIS drafts)", "User", "Locked reports enforced in Step 9A."],
  ["neris.export", "Export to NERIS", "Open question", "Today anyone can."],
  ["neris.settings", "NERIS settings and entity refresh", "Admin", ""],
  ["neris.debug", "NERIS debug tools", "Superadmin", "Troubleshooting only."],
  ["billing.submit", "Send to Fire Recovery", "Admin", "Decided Oct 29."],
  ["billing.settings", "Fire Recovery settings", "Admin", "Decided Oct 29."],
  ["cad.rules", "CAD parsing rules and allowed senders", "Admin", "Decided Oct 29."],
  ["cad.emails.view", "Raw CAD emails (contain caller names and phones)", "Admin", "Privacy."],
  ["schedule.edit", "Change the schedule", "User", "Scheduling review comes later; keeps today's behavior."],
];

const files = [
  ["prisma/schema.prisma + one new migration", "Add a Session table (add-only; nothing existing changes).", "Built. Not applied to staging or production."],
  ["server/auth/sessions.mjs (new)", "Create, look up and cancel passes; cookie handling; request-origin check; failed-login lockout.", "New"],
  ["server/neris-proxy.mjs", "Turn on the sign-in check for every route except the public list; login sets the cookie; add session and logout routes; change-password uses the signed-in person; password reset and account delete cancel passes; login returns the role from the user table only.", "Built"],
  ["src/App.tsx", "Ask the server 'who am I' on load; logout calls the server; show a sign-in box over the current screen on any refused request.", "Changed"],
  ["src/api/http.ts (new) or src/main.tsx", "One place that notices a refused request and opens the sign-in box.", "New"],
  ["server/auth/sessions.test.mjs (new) + package.json test list", "Automated tests.", "New"],
  ["docs/system_architecture.md, handoff notes, plan canvas", "Document the new sign-in model.", "Docs"],
];

const tests = [
  ["Every protected route without a pass", "Refused (401)", "Route list test fails if a new route is added without protection"],
  ["Pass from another department's address", "Refused (401)", "Proves department separation for sign-in"],
  ["Expired, idle or logged-out pass", "Refused (401)", ""],
  ["Changed password", "Other devices' passes refused", ""],
  ["Role changed in the user table", "Takes effect on the next request", "No re-login needed"],
  ["Request from another website", "Refused (403)", "Origin check"],
  ["6 wrong passwords", "Locked for 15 minutes", "Approved Oct 29"],
  ["Browser closed and reopened", "Sign-in box shown", "Approved Oct 29"],
  ["Normal login, browse, save, logout", "Works", "Manual check on staging"],
];

const decisions = [
  ["1", "Approve adding a Session table to the database (add-only migration; rehearsed on a copy of production before any release).", "Approved Oct 29. Built on the practice branch. Not applied to staging or production."],
  ["2", "How long may someone stay signed in?", "Approved Oct 29: signed out after 60 minutes with no activity."],
  ["3", "Lock an account for 15 minutes after 5 wrong passwords in a row?", "Approved Oct 29: Yes"],
  ["4", "On logout, clear cached department data from the browser (protects shared station computers)?", "Approved Oct 29: Yes, and closing the browser also signs the person out"],
  ["5", "Approve the server and app changes in 'What changes' (they touch authentication logic).", "Approved Oct 29 and built on the practice branch."],
];

const later = [
  ["Who may export to NERIS by default: all users, or admins only?", "Step 6"],
  ["Who may create incidents by hand by default: all users, or admins only?", "Step 6"],
  ["Approve a table for each department's role permissions and a table for the account-change log (both add-only).", "Step 6"],
];

function Overview() {
  return (
    <Stack gap={16}>
      <Callout tone="info" title="The short version">
        After a correct password, the server hands the browser a sign-in pass that cannot be read by page scripts, cannot be used on another department's address, and can be cancelled at any time. Every request must show a valid pass, and the server — not the browser — decides who you are and what role you have. Step 6 then checks permissions for each action on the server.
      </Callout>
      <Row gap={24}>
        <Stat value="45" label="API routes" />
        <Stat value="All others" label="require a signed-in person on the practice branch" tone="success" />
        <Stat value="5" label="groups stay public" />
      </Row>
      <H2>What is still wrong on the live site</H2>
      <Text>The practice branch has the fix. The live Crescent site stays the same until a planned release.</Text>
      <Table headers={["Area", "How it works now", "Risk"]} rows={today} striped />
      <H2>What changes for people using the app</H2>
      <Grid columns={3} gap={12}>
        <Card><CardHeader>Same login screen</CardHeader><CardBody><Text size="small">Username and password as today. Everyone signs in once after the change is released.</Text></CardBody></Card>
        <Card><CardHeader>Signed out after inactivity</CardHeader><CardBody><Text size="small">After 60 minutes with no activity, or after closing the browser, a sign-in box appears over the current screen with a clear message. Signing back in continues where they were, so unsaved typing is not lost.</Text></CardBody></Card>
        <Card><CardHeader>Logout really logs out</CardHeader><CardBody><Text size="small">Important on shared station and apparatus computers.</Text></CardBody></Card>
      </Grid>
    </Stack>
  );
}

function SignIn() {
  return (
    <Stack gap={16}>
      <H2>How sign-in will work</H2>
      <Table headers={["Moment", "What happens"]} rows={flow} />
      <H2>What the Session table is</H2>
      <Text>A new list in the database, like a sign-in sheet at the station door. Each time someone logs in, one line is added. Nothing already in the database changes.</Text>
      <Table
        headers={["Column", "Plain meaning"]}
        rows={sessionColumns}
        striped
      />
      <Text tone="secondary" size="small">It holds no passwords and nothing personal beyond which account signed in. Old lines are removed automatically after they expire.</Text>
      <H2>Protections on the sign-in pass</H2>
      <Table headers={["Protection", "Plain meaning"]} rows={cookie} striped />
      <H2>Secure by default</H2>
      <Text>The sign-in check runs in front of every route automatically. Only the routes below skip it, so a route added later is protected unless someone deliberately adds it to this list — and a test fails if they do without updating the list.</Text>
      <Table headers={["Stays public", "Why", "Protection"]} rows={publicRoutes} striped />
      <H3>New routes</H3>
      <Table headers={["Route", "Purpose"]} rows={newRoutes} />
      <H3>Changes from other websites</H3>
      <Text>Any request that changes data must come from the department's own address (checked with the browser's Origin header). Combined with SameSite=Strict, a malicious website cannot trick a signed-in browser into saving or deleting anything.</Text>
      <H3>Why a stored pass instead of a self-contained token</H3>
      <Text>A self-contained token (JWT) cannot be cancelled before it expires, so logout, password resets and removed accounts would keep working until expiry. A stored pass can be cancelled instantly, and needs no new secret key in Render. The cost is one small database lookup per request and one new table.</Text>
    </Stack>
  );
}

function Access() {
  return (
    <Stack gap={16}>
      <H2>Who can do what (Step 6, designed now)</H2>
      <Text>Step 5 proves who you are. Step 6 checks what you may do, on the server, for every action. It follows the capability plan already in the repo (docs/plans/TENANT_ROLES_AND_PERMISSIONS_PLAN.md): each action has a named permission, each department's admin grants permissions to roles in Admin Functions, and the server enforces the same choices.</Text>
      <Callout tone="warning" title="Role comes only from the user table">
        From Step 5 on, the server reads the role from the user table on every request. Browser storage and the 'user type' labels in department settings no longer grant access.
      </Callout>
      <H3>Starting permissions (role levels: User, Subadmin, Admin, Superadmin)</H3>
      <Table headers={["Permission", "Covers", "Default minimum role", "Notes"]} rows={capabilities} striped />
      <Text tone="secondary" size="small">Higher roles always include lower ones. Each department admin can widen or narrow these later. Superadmin and the program owner's platform key keep their current special powers.</Text>
      <H3>Safety rules carried over from the existing roles plan</H3>
      <Table
        headers={["Rule", "Why"]}
        rows={[
          ["Every department keeps at least one admin and one superadmin", "Nobody can lock the department out."],
          ["Admins cannot change or delete superadmins", "Prevents takeover."],
          ["Nobody can raise their own role", "Prevents self-promotion."],
          ["Every account change is logged (who, what, when)", "Audit trail."],
        ]}
      />
    </Stack>
  );
}

function Changes() {
  return (
    <Stack gap={16}>
      <H2>What changes in Step 5</H2>
      <Table headers={["File", "Change", "Type"]} rows={files} striped />
      <H2>Not in Step 5</H2>
      <Table
        headers={["Item", "Where it happens"]}
        rows={[
          ["Permission checks per action, account-change log, department settings no longer changing accounts", "Step 6"],
          ["Trusting only Render's address information (X-Forwarded-Host)", "Step 7"],
          ["Server tests against a temporary database on every GitHub change", "Step 9"],
          ["Render or production settings", "Not touched; production keeps running main until a planned release"],
        ]}
      />
      <H2>Risks and how they are handled</H2>
      <Table
        headers={["Risk", "Handling"]}
        rows={[
          ["A screen calls the server before sign-in and breaks", "Every page load is tested signed out and signed in; refused requests show the sign-in box instead of errors."],
          ["Everyone is signed out at release", "Expected once; announce it."],
          ["Someone loses unsaved report typing when the session expires", "The sign-in box appears over the current screen, so the form stays filled in; after signing in, the person saves again."],
          ["Database addition fails in production", "Add-only table, rehearsed on a copy of production, fresh backup first (Data safety rules)."],
        ]}
        striped
      />
    </Stack>
  );
}

function Testing() {
  return (
    <Stack gap={16}>
      <H2>How we prove it works</H2>
      <Table headers={["Test", "Expected", "Notes"]} rows={tests} striped />
      <Text>Automated tests run the real server against a throwaway local database on the build machine (never Neon). Step 9 later runs the same tests on every GitHub change.</Text>
      <H2>Rollout</H2>
      <Table
        headers={["Stage", "What happens", "Data touched"]}
        rows={[
          ["Practice branch", "Build and test; you review the pull request.", "None"],
          ["Staging", "After your approval: backup, add the Session table to staging, combine into the staging branch, everyone signs in again, you run a short checklist.", "Staging database: one new empty table"],
          ["Production", "Only in the planned release (Step 18) with a fresh backup and a rehearsal on a copy.", "Production database: one new empty table"],
        ]}
      />
    </Stack>
  );
}

function Decisions() {
  return (
    <Stack gap={16}>
      <H2>Decisions — all answered</H2>
      <Table headers={["#", "Question", "Status"]} rows={decisions} striped />
      <H2>Can wait until Step 6</H2>
      <Table headers={["Question", "Step"]} rows={later} />
    </Stack>
  );
}

export default function Design() {
  const theme = useHostTheme();
  const tabs = ["Overview", "How sign-in works", "Who can do what", "What changes", "Testing & rollout", "Decisions"] as const;
  type T = typeof tabs[number];
  const [tab, setTab] = useState<T>("Overview");
  return (
    <Stack gap={18} style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 24px 64px", background: theme.bg.editor }}>
      <Stack gap={6}>
        <Text size="small" tone="tertiary">Step 5 built on the practice branch October 29, 2026 · Not on staging or production · Step 6 not started · Practice copy: cursor/stage-b-foundation-b5ff · Saved in repo: docs/plans/canvases/step-5-6-secure-sessions-design.canvas.tsx</Text>
        <H1>Secure sessions and access controls — design</H1>
      </Stack>
      <Row gap={6} wrap>{tabs.map((t) => <Pill key={t} active={t === tab} onClick={() => setTab(t)}>{t}</Pill>)}</Row>
      <Divider />
      {tab === "Overview" && <Overview />}
      {tab === "How sign-in works" && <SignIn />}
      {tab === "Who can do what" && <Access />}
      {tab === "What changes" && <Changes />}
      {tab === "Testing & rollout" && <Testing />}
      {tab === "Decisions" && <Decisions />}
    </Stack>
  );
}
