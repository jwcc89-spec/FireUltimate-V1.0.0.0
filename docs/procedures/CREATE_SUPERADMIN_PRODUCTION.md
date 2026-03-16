# Create a Super Admin user in production

**When to use:** You need a Super Admin on **production** (e.g. **cifpdil.fireultimate.app**), but the app hides the “Super Admin” user type in the UI there (by design, so only you can add super admins). This guide walks you through creating one using the project script and your **production** database.

---

## What you need

- **Production database URL** — The same `DATABASE_URL` your production app uses (e.g. from Render → your service → Environment). You will use it only on your machine to run the script; **do not commit it to the repo.**
- **Tenant slug** — For CIFPD IL production this is `cifpdil`.
- **Username** — The login name for the new Super Admin (e.g. your email or a short username).
- **Password** — A strong password. You can change it after first login in the app.

---

## Step 1 — Get your production database URL

1. Open **Render** (or wherever your production API is hosted).
2. Open the **service** that runs the production app (e.g. the one serving **cifpdil.fireultimate.app**).
3. Go to **Environment** (or **Env**).
4. Find `**DATABASE_URL`** and copy its value.
  - It usually looks like: `postgresql://user:password@host/database?sslmode=require`  
  - If you can’t see the value, use “Reveal” or your team’s way to access production env vars.

**Important:** This URL is secret. Don’t paste it into chat, commit it, or share it. Use it only in the next step on your own machine.

---

## Step 2 — Open the project on your computer

1. Open a terminal.
2. Go to the Fire Ultimate project folder, for example:
  ```bash
   cd /path/to/FireUltimate-V1.0.0.0
  ```
   (Use your actual path.)

---

## Step 3 — Set the production database URL for this run

**Option A — One-time run (recommended)**  
Set the variable only for this command (no file change):

- **macOS / Linux:**
  ```bash
  export DATABASE_URL="paste-your-production-URL-here"
  ```
  Replace `paste-your-production-URL-here` with the real value (keep the quotes).
- **Windows (Command Prompt):**
  ```cmd
  set DATABASE_URL=paste-your-production-URL-here
  ```
- **Windows (PowerShell):**
  ```powershell
  $env:DATABASE_URL="paste-your-production-URL-here"
  ```

**Option B — Use a local file (do not commit)**  
Create a file like `.env.production` in the project root with one line:

```bash
DATABASE_URL=postgresql://...
```

Then load it only when you run the script, for example:

```bash
export $(grep -v '^#' .env.production | xargs)
```

Do **not** commit `.env.production` to Git. Add `.env.production` to `.gitignore` if it isn’t already.

---

## Step 4 — Run the create-superadmin script

From the project root, run (replace the placeholder values):

```bash
npx tsx scripts/create-superadmin.ts --tenantSlug cifpdil --username YOUR_USERNAME --password "YOUR_SECURE_PASSWORD
```

Or use the npm script (same arguments after `--`):

```bash
npm run superadmin:create -- --tenantSlug cifpdil --username YOUR_USERNAME --password 'YOUR_SECURE_PASSWORD'
```

- `**--tenantSlug**` — Use `cifpdil` for CIFPD IL production.
- `**--username**` — The login name (e.g. `you` or `admin`). Stored in lowercase.
- `**--password**` — The password. Use quotes if it contains spaces or special characters.

**Examples:**

- New Super Admin user:
  ```bash
  npx tsx scripts/create-superadmin.ts --tenantSlug cifpdil --username you --password "MyStr0ngP@ss"
  ```
- Promote an existing user to Super Admin and set a new password:
  ```bash
  npx tsx scripts/create-superadmin.ts --tenantSlug cifpdil --username existinguser --password "NewP@ssw0rd"
  ```

You should see output like:

```
Created Super Admin user "you".
Set user type label to "Super Admin" in Department Details.

Done. You can now log in at your production URL (e.g. https://cifpdil.fireultimate.app) with:
  Username: you
  Password: (the one you passed to --password)

Change the password after first login if you used a temporary one.
```

If the user already existed, you’ll see “Updated user …” instead of “Created …”.

---

## Step 5 — Log in on production

1. Open **[https://cifpdil.fireultimate.app](https://cifpdil.fireultimate.app)** (or your production URL).
2. Sign in with the **username** and **password** you used in the script.
3. You should have Super Admin access (e.g. beta sections clickable, super-admin-only options visible).
4. **Change your password** after first login if you used a temporary one: use the in-app change-password flow if available.

---

## Troubleshooting


| Issue                                                | What to do                                                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `**DATABASE_URL is missing`**                        | Set `DATABASE_URL` in your shell (Step 3) or in a loaded `.env` file before running the script.                                                                                 |
| `**Tenant with slug "cifpdil" not found**`           | The production database doesn’t have a tenant with that slug. Confirm you’re using the **production** `DATABASE_URL` and that the cifpdil tenant exists there.                  |
| `**Can't reach database server`**                    | Check that `DATABASE_URL` is correct and that your network allows connections to the DB (e.g. Neon allows connections from anywhere by default; some setups use IP allowlists). |
| **Login works but I don’t see Super Admin features** | Hard-refresh the page (Ctrl+Shift+R or Cmd+Shift+R) or log out and log in again so the app picks up the new user type.                                                          |


---

## What the script does (for reference)

1. Connects to the database using `DATABASE_URL`.
2. Finds the tenant by slug (e.g. `cifpdil`).
3. **Creates** a new user with role `superadmin` and the given password (hashed with bcrypt), or **updates** an existing user to `superadmin` and sets the new password.
4. Updates that tenant’s **Department Details** so the username is mapped to the “Super Admin” user type label. The app uses this so login returns the correct role and Super Admin–only features are shown.

No changes are made to staging or other tenants; only the database you point to with `DATABASE_URL` is modified.