/**
 * Create a trial (or other) tenant with primary domain and admin user.
 * Usage: npm run tenant:create -- --slug kankdemo --name "Kankakee Trial" --hostname kankdemo.fireultimate.app --status trial --adminUsername admin --adminPassword <temp>
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const BCRYPT_SALT_ROUNDS = 12;
const ALLOWED_STATUSES = new Set(["sandbox", "trial", "active", "suspended", "archived"]);

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
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing. Add it to .env before running tenant:create.");
  }

  const args = parseArgv();
  const slug = trim(args.slug).toLowerCase();
  const name = trim(args.name);
  const hostname = trim(args.hostname).toLowerCase();
  const status = trim(args.status).toLowerCase() || "trial";
  const adminUsername = trim(args.adminUsername).toLowerCase();
  const adminPassword = trim(args.adminPassword);

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    throw new Error("--slug is required and must be lowercase letters, numbers, hyphens only.");
  }
  if (!name) throw new Error("--name is required.");
  if (!hostname) throw new Error("--hostname is required.");
  if (!ALLOWED_STATUSES.has(status)) {
    throw new Error(`--status must be one of: ${[...ALLOWED_STATUSES].join(", ")}`);
  }
  if (!adminUsername) throw new Error("--adminUsername is required.");
  if (!adminPassword) throw new Error("--adminPassword is required.");

  const adapter = new PrismaPg(new Pool({ connectionString: databaseUrl }));
  const prisma = new PrismaClient({ adapter });

  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) {
    throw new Error(`Tenant with slug "${slug}" already exists.`);
  }
  const existingDomain = await prisma.tenantDomain.findUnique({ where: { hostname } });
  if (existingDomain) {
    throw new Error(`Hostname "${hostname}" is already assigned to another tenant.`);
  }

  const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_SALT_ROUNDS);

  const tenant = await prisma.tenant.create({
    data: { slug, name, status },
  });

  await prisma.tenantDomain.create({
    data: { tenantId: tenant.id, hostname, isPrimary: true },
  });

  await prisma.departmentDetails.create({
    data: {
      tenantId: tenant.id,
      departmentName: name,
      payloadJson: {},
    },
  });

  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      username: adminUsername,
      passwordHash,
      role: "admin",
    },
  });

  console.log("Tenant created successfully.");
  console.log(JSON.stringify({ tenantId: tenant.id, slug: tenant.slug, name: tenant.name, status: tenant.status, hostname }, null, 2));
  return prisma;
}

main()
  .then((prisma) => prisma?.$disconnect())
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
