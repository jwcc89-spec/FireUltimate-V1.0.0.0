import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const BCRYPT_SALT_ROUNDS = 12;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing. Add it to your .env file before running db:seed.");
}

const adapter = new PrismaPg(
  new Pool({
    connectionString: databaseUrl,
  }),
);

const prisma = new PrismaClient({ adapter });

async function main() {
  // Remove legacy tenant slug from earlier setup so reruns stay clean.
  await prisma.tenant.deleteMany({
    where: { slug: "crescent" },
  });

  // 1) Tenants
  const cifpdil = await prisma.tenant.upsert({
    where: { slug: "cifpdil" },
    update: { name: "Crescent-Iroquois Fire Protection District", status: "active" },
    create: {
      slug: "cifpdil",
      name: "Crescent-Iroquois Fire Protection District",
      status: "active",
    },
  });

  const demo = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: { name: "DEMO", status: "active" },
    create: {
      slug: "demo",
      name: "DEMO",
      status: "active",
    },
  });

  // 2) Domain mappings (staging placeholders for now)
  await prisma.tenantDomain.upsert({
    where: { hostname: "cifpdil.staging.fireultimate.app" },
    update: { tenantId: cifpdil.id, isPrimary: true },
    create: {
      tenantId: cifpdil.id,
      hostname: "cifpdil.staging.fireultimate.app",
      isPrimary: true,
    },
  });

  await prisma.tenantDomain.upsert({
    where: { hostname: "demo.staging.fireultimate.app" },
    update: { tenantId: demo.id, isPrimary: true },
    create: {
      tenantId: demo.id,
      hostname: "demo.staging.fireultimate.app",
      isPrimary: true,
    },
  });

  // 3) Initial DepartmentDetails rows (empty payload shell)
  await prisma.departmentDetails.upsert({
    where: { tenantId: cifpdil.id },
    update: {},
    create: {
      tenantId: cifpdil.id,
      departmentName: "Crescent-Iroquois Fire Protection District",
      payloadJson: {},
    },
  });

  await prisma.departmentDetails.upsert({
    where: { tenantId: demo.id },
    update: {},
    create: {
      tenantId: demo.id,
      departmentName: "DEMO",
      payloadJson: {
        note: "Demo tenant seed data placeholder",
      },
    },
  });

  // 4) Starter users (passwords hashed with bcrypt)
  const adminHash = await bcrypt.hash("admin", BCRYPT_SALT_ROUNDS);
  const demoHash = await bcrypt.hash("demo", BCRYPT_SALT_ROUNDS);

  await prisma.user.upsert({
    where: {
      tenantId_username: {
        tenantId: cifpdil.id,
        username: "admin",
      },
    },
    update: {
      role: "admin",
      passwordHash: adminHash,
    },
    create: {
      tenantId: cifpdil.id,
      username: "admin",
      passwordHash: adminHash,
      role: "admin",
    },
  });

  await prisma.user.upsert({
    where: {
      tenantId_username: {
        tenantId: demo.id,
        username: "demo",
      },
    },
    update: {
      role: "admin",
      passwordHash: demoHash,
    },
    create: {
      tenantId: demo.id,
      username: "demo",
      passwordHash: demoHash,
      role: "admin",
    },
  });

  console.log("Seed complete.");
  console.log({ cifpdilTenantId: cifpdil.id, demoTenantId: demo.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });