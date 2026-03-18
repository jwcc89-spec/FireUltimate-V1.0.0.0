/**
 * Create or promote a user to Super Admin for a tenant (e.g. production).
 * Use when the Super Admin option is hidden in the UI and you need to add one via the database.
 *
 * Usage:
 *   npx tsx scripts/create-superadmin.ts --tenantSlug cifpdil --username you --password "YourSecurePassword"
 *
 * For production: set DATABASE_URL to your production database URL (e.g. from Render Environment),
 * then run the command. Do not commit production DATABASE_URL to the repo.
 */
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const BCRYPT_SALT_ROUNDS = 12;
const SUPER_ADMIN_LABEL = "Super Admin";

function loadEnv() {
  const envCandidates = [".env", ".env.server"];
  for (const envFile of envCandidates) {
    const absolutePath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(absolutePath)) {
      dotenv.config({ path: absolutePath, override: false });
    }
  }
}

function parseArgv(): Record<string, string> {
  const out: Record<string, string> = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg?.startsWith("--") && arg.length > 2) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

function trim(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

async function main() {
  loadEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is missing. Set it to your production DB URL (e.g. in .env.server or as an env var) before running.",
    );
  }

  const args = parseArgv();
  const tenantSlug = trim(args.tenantSlug).toLowerCase();
  const username = trim(args.username).toLowerCase();
  const password = trim(args.password);

  if (!tenantSlug || !/^[a-z0-9-]+$/.test(tenantSlug)) {
    throw new Error("--tenantSlug is required (e.g. cifpdil) and must be lowercase letters, numbers, hyphens only.");
  }
  if (!username) {
    throw new Error("--username is required.");
  }
  if (!password) {
    throw new Error("--password is required.");
  }

  const adapter = new PrismaPg(new Pool({ connectionString: databaseUrl }));
  const prisma = new PrismaClient({ adapter });

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });
  if (!tenant) {
    throw new Error(`Tenant with slug "${tenantSlug}" not found.`);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const existingUser = await prisma.user.findUnique({
    where: {
      tenantId_username: {
        tenantId: tenant.id,
        username,
      },
    },
  });

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { role: "superadmin", passwordHash },
    });
    console.log(`Updated user "${username}" to Super Admin and set new password.`);
  } else {
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        username,
        passwordHash,
        role: "superadmin",
      },
    });
    console.log(`Created Super Admin user "${username}".`);
  }

  const details = await prisma.departmentDetails.findUnique({
    where: { tenantId: tenant.id },
  });
  const payload =
    details?.payloadJson && typeof details.payloadJson === "object" ? (details.payloadJson as Record<string, unknown>) : {};
  const currentLabels =
    payload.userTypeLabels && typeof payload.userTypeLabels === "object" && !Array.isArray(payload.userTypeLabels)
      ? (payload.userTypeLabels as Record<string, string>)
      : {};
  const nextLabels = { ...currentLabels, [username]: SUPER_ADMIN_LABEL };
  const nextPayload = { ...payload, userTypeLabels: nextLabels };

  await prisma.departmentDetails.upsert({
    where: { tenantId: tenant.id },
    update: { payloadJson: nextPayload },
    create: { tenantId: tenant.id, departmentName: tenant.name ?? "", payloadJson: nextPayload },
  });
  console.log(`Set user type label to "${SUPER_ADMIN_LABEL}" in Department Details.`);

  console.log("\nDone. You can now log in at your production URL (e.g. https://cifpdil.fireultimate.app) with:");
  console.log(`  Username: ${username}`);
  console.log(`  Password: (the one you passed to --password)`);
  console.log("\nChange the password after first login if you used a temporary one.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
