# Admin API: Very Detailed Beginner Guide

This guide assumes you have never used things like "environment variables," "API," or "curl." We’ll go step by step.

---

## What you’re doing in plain English

You have a **secret password** that only your app and you know. When you want to create a new "trial tenant" (like a new demo account for Kankakee) over the internet instead of running a script on your computer, you’ll send that **same secret** with your request. The server checks: "Does this secret match what I have on file?" If yes, it does the work. If no, it says "not allowed."

- The secret is stored in a **file** on your computer (`.env.server`).
- The server reads that file **only when it starts**. So if you add or change the secret, you must **restart the server**.
- When you "call the Admin API," you’re sending a **request** (like a form submit) to a **URL**. That request must **include the secret** in a special place called a **header** (explained below).

---

## Words we’ll use

- **Project root** = the main folder of your app (e.g. `wt-departmentdetails-ui`). When someone says "in the project root," they mean inside that folder, not inside `src` or `server` or `docs`.
- **`.env.server`** = a file that lives in the project root. It holds **environment variables** (settings) that only the **server** (the proxy) reads. It’s like a small config file. **Do not commit real secrets to Git** if this file is tracked; often it’s in `.gitignore`.
- **Environment variable** = one line in that file: `NAME=value`. The server can read `NAME` and get `value`. So `PLATFORM_ADMIN_KEY=my-secret-123` means "the name is PLATFORM_ADMIN_KEY, the value is my-secret-123."
- **Restart the proxy** = stop the running server (e.g. press `Ctrl+C` in the terminal where it’s running), then start it again with `npm run proxy`. The server only reads `.env.server` when it **starts**, so changes to that file don’t apply until you restart.
- **API** = a URL your server listens on. When you "call" it, you send an HTTP request (GET, POST, etc.) to that URL. The server does something and sends back a response (e.g. JSON).
- **Admin API** = a few special URLs (like `/api/admin/tenants`) that **only work if you send the secret**. Without the secret, the server responds with "403 Forbidden."
- **Header** = an extra piece of information you send with a request. It’s not the main "body" of the request; it’s a name + value the server reads to know who you are or what you want. We’ll put the secret in a header called `X-Platform-Admin-Key`.
- **curl** = a command-line tool (already on Mac/Linux; on Windows you may use PowerShell or install curl) that lets you send a request to a URL from the terminal. You’ll paste a long line that includes the URL, the header with the secret, and the JSON body.

---

## Step-by-step (do exactly this)

### Step 1: Find the project root

- Open your project in Cursor (or your editor).
- In the left file tree, the **top folder** (e.g. `wt-departmentdetails-ui`) is the project root.
- All paths in this guide are from that folder.

### Step 2: Open or create `.env.server`

- In the file tree, click the project root and look for a file named **`.env.server`**.
- If you don’t see it:
  - Look for **`.env.server.example`**.
  - Copy it and name the copy **`.env.server`** (same folder as the example).
- **Open `.env.server`** in the editor (double-click it). You’ll see lines like `NERIS_PROXY_PORT=8787` and maybe `DATABASE_URL=...`.

### Step 3: Add your secret (the "platform admin key")

- Scroll to the bottom of `.env.server` (or find the line `PLATFORM_ADMIN_KEY=` if it already exists).
- Add **one new line** (or change the existing one) so it says exactly:
  ```text
  PLATFORM_ADMIN_KEY=my-secret-key-123
  ```
- **You** choose the right-hand side. Replace `my-secret-key-123` with any long, random string you like. For example:
  - `PLATFORM_ADMIN_KEY=fire-ultimate-admin-xyz-789`
  - Don’t use spaces. Don’t put quotes around it unless the rest of your env file uses quotes.
- **Save the file** (Cmd+S or Ctrl+S). Leave it open or close it—doesn’t matter. The important thing is the file on disk now contains that line.

### Step 4: Restart the proxy so it reads the new secret

- Find the **terminal** where you ran **`npm run proxy`** (the one that says something like "NERIS proxy listening on http://localhost:8787").
- Click in that terminal so it’s focused.
- Press **`Ctrl+C`** (or Cmd+C on Mac, if that stops the process). The server stops and you get your prompt back.
- Type exactly: **`npm run proxy`** and press Enter.
- Wait until you see again: "NERIS proxy listening on http://localhost:8787."
- Now the server has **read** `.env.server` again and knows your `PLATFORM_ADMIN_KEY`. If you don’t restart, it would still be using the old value (or no value).

### Step 5: Call the Admin API with the secret in the "header"

- You need to send a **request** to the server that includes:
  - The **URL** of the admin endpoint (e.g. `http://localhost:8787/api/admin/tenants`).
  - The **secret**, in a **header** named `X-Platform-Admin-Key`.
  - The **body** (for creating a tenant: slug, name, hostname, etc.) as JSON.

**What is a "header"?**  
When you send a request to a URL, you can attach extra name/value pairs. One of them might be `Content-Type: application/json` (so the server knows the body is JSON). Another is **`X-Platform-Admin-Key: your-secret-here`**. The server looks at that second one and compares `your-secret-here` to the value it read from `PLATFORM_ADMIN_KEY` in `.env.server`. If they match, it allows the request.

**Using curl (one line):**

- Open a **new** terminal (don’t stop the proxy). You’ll run curl in this second terminal.
- **Replace** these two things in the command below:
  - `your-secret-here` → the **exact** value you put after `PLATFORM_ADMIN_KEY=` in `.env.server` (e.g. `my-secret-key-123` or `fire-ultimate-admin-xyz-789`).
  - The JSON body if you want different slug/name/hostname (otherwise the example creates a tenant named "Kankakee Trial" with slug `kankdemo`).

Paste this into the **new** terminal (all one line, or use the backslash `\` to break lines), then press Enter:

```bash
curl -X POST http://localhost:8787/api/admin/tenants -H "Content-Type: application/json" -H "X-Platform-Admin-Key: your-secret-here" -d '{"slug":"kankdemo","name":"Kankakee Trial","hostname":"kankdemo.staging.fireultimate.app","status":"trial","adminUsername":"admin","adminPassword":"Kankakee123!"}'
```

- **If the secret is correct:** You’ll see a JSON response that includes `"ok":true` and something like `"tenant":{"id":"...","slug":"kankdemo",...}`. The tenant was created.
- **If the secret is wrong or missing:** You’ll see `{"ok":false,"message":"Platform admin key required."}` and the server will return a 403 status. Nothing is created. Fix the secret in `.env.server` (and restart the proxy) or fix the value after `X-Platform-Admin-Key:` in the curl command so they match exactly.

### Step 6: Add a domain to that tenant (optional)

- The response from creating a tenant includes `"tenant":{"id":"cmmf...", ...}`. That `id` is the **tenant id**.
- To add another domain (e.g. `kankdemo.fireultimate.app`) to that tenant, run another curl. Replace:
  - `TENANT_ID` with the real id (e.g. `cmmfchqi50000h5fjmd4vjqf9`).
  - `your-secret-here` with your actual `PLATFORM_ADMIN_KEY` value.

```bash
curl -X POST http://localhost:8787/api/admin/tenants/TENANT_ID/domains -H "Content-Type: application/json" -H "X-Platform-Admin-Key: your-secret-here" -d '{"hostname":"kankdemo.fireultimate.app","isPrimary":false}'
```

Again: if the key is correct, you get a success response; if not, you get 403.

---

## Quick checklist

1. Put one line in `.env.server`: `PLATFORM_ADMIN_KEY=<your-secret>`.
2. Save the file.
3. Restart the proxy (`Ctrl+C`, then `npm run proxy`).
4. When calling the Admin API, send the **same** secret in the header: `X-Platform-Admin-Key: <your-secret>`.
5. If you get 403, the key doesn’t match or wasn’t sent—check the file, restart, and check the curl header.

---

## See also

- **Task 2 plan:** `docs/task-2-multitenant-domain-plan.md` (Operator Runbook) for the short version and endpoint reference.
- **Creating a tenant from the command line (no API):** use `npm run tenant:create -- --slug ... --name "..." ...` as in the Operator Runbook; no `.env.server` key or curl needed for that.
