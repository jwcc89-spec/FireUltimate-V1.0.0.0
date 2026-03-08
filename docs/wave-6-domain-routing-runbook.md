# Wave 6 Domain Routing Runbook

This runbook covers Phase 6 external infrastructure steps: DNS + SSL + tenant-domain verification.

## Scope

- Configure tenant domain routing for staging/prod.
- Validate host-based tenant resolution end-to-end.
- Keep tenant isolation behavior consistent with app middleware.

## Preconditions

- Phase 5 complete (`/api/schedule-assignments`, `/api/department-details`, `/api/users` tenant-scoped).
- App/API deployed and reachable.
- Domain/DNS provider access available (Cloudflare in current plan).
- TenantDomain rows exist for planned hostnames.

## Target domains

- Staging examples:
  - `demo.staging.fireultimate.app`
  - `cifpdil.staging.fireultimate.app`
- Prod examples:
  - `demo.fireultimate.app`
  - `cifpdil.fireultimate.app`

## Step-by-step

### 1) Confirm tenant-domain mappings in DB

Run:

```bash
node --env-file=.env.server --input-type=module -e "import { PrismaPg } from '@prisma/adapter-pg'; import pkg from '@prisma/client'; import { Pool } from 'pg'; const { PrismaClient } = pkg; const prisma=new PrismaClient({ adapter:new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }))}); const domains=await prisma.tenantDomain.findMany({ select:{ hostname:true,isPrimary:true,tenant:{select:{slug:true,name:true,status:true}}}, orderBy:{ hostname:'asc' }}); console.log(JSON.stringify(domains,null,2)); await prisma.\$disconnect();"
```

Expected:
- Each planned hostname exists.
- Each hostname maps to the intended tenant slug.

### 2) Configure DNS records

In DNS provider:

- Add wildcard CNAME for staging:
  - `*.staging.fireultimate.app` -> `<your-staging-app-host>`
- Add wildcard CNAME for prod:
  - `*.fireultimate.app` -> `<your-prod-app-host>`

If wildcard is not desired, create explicit records per tenant hostname.

### 3) Enable SSL

- Ensure certificate coverage for wildcard/tenant hosts.
- Confirm HTTPS works for sample tenant hostnames.

### 4) Host routing verification (backend)

Use API endpoint from each hostname:

```bash
curl https://demo.staging.fireultimate.app/api/tenant/context
curl https://cifpdil.staging.fireultimate.app/api/tenant/context
```

Expected:
- `tenant.slug` differs correctly per host.
- No cross-tenant mismatch.

### 5) Login verification per host

- Sign in on each tenant host using that tenant’s credentials.
- Confirm role behavior and menu visibility remains correct.

### 6) Data isolation verification

For each host pair (A/B):

1. On host A, change Department Details value and save.
2. On host B, refresh and confirm value did not change.
3. On host A/B, create distinct scheduler assignment data.
4. Confirm each host sees only its own scheduler data.

### 7) Failure-path verification

- Unknown host:
  - request to unmapped host should return `Unknown tenant domain`.
- Mapped host:
  - must resolve tenant and return context.

## Wave 6 completion checklist

- [ ] TenantDomain rows verified.
- [ ] DNS records configured for target environment.
- [ ] SSL valid on tenant hostnames.
- [ ] `/api/tenant/context` returns correct tenant per host.
- [ ] Login works per host with expected role behavior.
- [ ] Data isolation confirmed between at least two tenants.
- [ ] Unknown host rejection confirmed.

## Now vs Later

### Now
- Complete staging DNS + SSL + routing verification.
- Capture evidence (commands/results/screenshots) for handoff.

### Later
- Automate host/tenant verification as a CI smoke script.
- Add synthetic monitoring for tenant host availability and cert expiry.
