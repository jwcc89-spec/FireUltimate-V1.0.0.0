# Seed and Tenant Reference

This note explains what seed does, how to list tenants, and how to test tenant isolation locally.

## What seed does

Run:

```bash
npm run db:seed
```

`db:seed` ensures baseline records exist in the DB from `.env.server`:

- Tenants: `cifpdil`, `demo`
- Domains:
  - `cifpdil.staging.fireultimate.app`
  - `demo.staging.fireultimate.app`
- DepartmentDetails shells for those tenants
- Admin users:
  - `cifpdil` -> `admin / admin`
  - `demo` -> `demo / demo`

Important:

- Seed **creates/updates** known baseline rows.
- Seed does **not** print every tenant in DB by default.
- Tenants created later (for example `local2`, `kankdemo`) remain and are not fully shown by the seed output.

## List all tenants and domains

Use this command to print all tenants with domains and users:

```bash
node --env-file=.env.server --input-type=module -e "import { PrismaPg } from '@prisma/adapter-pg'; import pkg from '@prisma/client'; import { Pool } from 'pg'; const { PrismaClient } = pkg; const prisma=new PrismaClient({ adapter:new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }))}); const tenants=await prisma.tenant.findMany({ select:{ slug:true,name:true,status:true, domains:{ select:{ hostname:true,isPrimary:true }}, users:{ select:{ username:true,role:true }} }, orderBy:{ slug:'asc' }}); console.log(JSON.stringify(tenants,null,2)); await prisma.\$disconnect();"
```
Use this command to print all tenants with domains (No Users)

```bash
node --env-file=.env.server --input-type=module -e "import { PrismaPg } from '@prisma/adapter-pg'; import pkg from '@prisma/client'; import { Pool } from 'pg'; const { PrismaClient } = pkg; const prisma=new PrismaClient({ adapter:new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }))}); const tenants=await prisma.tenant.findMany({ select:{ slug:true,name:true,status:true, domains:{ select:{ hostname:true,isPrimary:true }} }, orderBy:{ slug:'asc' }}); console.log(JSON.stringify(tenants,null,2)); await prisma.\$disconnect();"

```

Use this command to print all tenants in table view

```bash
node --env-file=.env.server --input-type=module -e "import { PrismaPg } from '@prisma/adapter-pg'; import pkg from '@prisma/client'; import { Pool } from 'pg'; const { PrismaClient } = pkg; const prisma=new PrismaClient({ adapter:new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }))}); const tenants=await prisma.tenant.findMany({ select:{ id:true,slug:true,name:true,status:true,createdAt:true,updatedAt:true }, orderBy:{ slug:'asc' }}); console.log(JSON.stringify(tenants,null,2)); await prisma.\$disconnect();"
```

## Create a second local tenant

```bash
npm run tenant:create -- --slug local2 --name "Local Tenant 2" --hostname local2.localhost --status trial --adminUsername admin --adminPassword admin
```

## Why localhost and local2.localhost can appear to mirror each other

When Vite proxy is configured with `changeOrigin: true`, backend may receive `Host: localhost:8787` for both frontend URLs. If that happens, tenant resolution uses `demo` context for both tabs.

## Step-by-step isolation test (API-level, always reliable)

1. Start proxy:

```bash
npm run proxy
```

2. Write schedule data to Tenant A (`demo`) using default localhost host:

```bash
curl -X POST http://localhost:8787/api/schedule-assignments \
  -H "Content-Type: application/json" \
  -d '{"assignments":{"A Shift::2026-03-08":{"Engine 1":["DemoOnly"]}},"overtimeSplit":{}}'
```

3. Read Tenant A data:

```bash
curl http://localhost:8787/api/schedule-assignments
```

4. Read Tenant B (`local2`) by overriding Host header:

```bash
curl http://localhost:8787/api/schedule-assignments \
  -H "Host: local2.localhost:8787"
```

Expected:

- Step 3 contains `DemoOnly`.
- Step 4 does not contain `DemoOnly` unless you explicitly wrote it to Tenant B.

5. Optional cleanup of Tenant A test row:

```bash
curl -X POST http://localhost:8787/api/schedule-assignments \
  -H "Content-Type: application/json" \
  -d '{"assignments":{},"overtimeSplit":{}}'
```

## Optional UI-level isolation test

If you want browser URL host to drive backend host during local dev, ensure Vite proxy preserves host instead of rewriting it. Then restart `npm run dev` and test:

- Tenant A: `http://localhost:5173`
- Tenant B: `http://local2.localhost:5173`

Use this endpoint in each tab to confirm tenant context:

```js
fetch("/api/tenant/context").then(r => r.json()).then(console.log)
```
