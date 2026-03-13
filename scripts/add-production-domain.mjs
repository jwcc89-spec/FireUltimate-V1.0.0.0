/**
 * One-off: add production hostname for cifpdil so cifpdil.fireultimate.app resolves to cifpdil tenant.
 * Usage: node --env-file=.env.production scripts/add-production-domain.mjs
 *        (or set DATABASE_URL in .env.production; do not commit that file)
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing. Use --env-file=.env.production or set DATABASE_URL.");
}

const adapter = new PrismaPg(new Pool({ connectionString: databaseUrl }));
const prisma = new PrismaClient({ adapter });

async function main() {
  const hostname = "cifpdil.fireultimate.app";
  const tenant = await prisma.tenant.findUnique({ where: { slug: "cifpdil" } });
  if (!tenant) {
    throw new Error("cifpdil tenant not found. Run db:seed first.");
  }
  const existing = await prisma.tenantDomain.findUnique({ where: { hostname } });
  if (existing) {
    console.log("Domain already exists:", hostname);
    return;
  }
  await prisma.tenantDomain.create({
    data: { tenantId: tenant.id, hostname, isPrimary: false },
  });
  console.log("Added TenantDomain:", hostname, "-> cifpdil");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
