/**
 * Routes for the operations modules (maintenance, maps, displays, inventory, policies, prevention, timesheets).
 * The sign-in, tenant and permission middleware in neris-proxy.mjs runs before these.
 * Every query must filter on request.tenant.id, and each route needs a line in permissionForRequest.
 */
import { register as registerChecklists } from "./checklists.mjs";
import { register as registerDashboard } from "./dashboard.mjs";
import { register as registerDisplays } from "./displays.mjs";
import { register as registerInspections } from "./inspections.mjs";
import { register as registerMaintenance } from "./maintenance.mjs";
import { register as registerMaps } from "./maps.mjs";
import { register as registerParts } from "./parts.mjs";
import { register as registerPolicies } from "./policies.mjs";
import { register as registerPrevention } from "./prevention.mjs";

export function registerModuleRoutes(app, prisma) {
  app.get("/api/modules/health", (request, response) => {
    const tenantSlug = request.tenant?.slug;
    if (!tenantSlug) {
      response.status(400).json({ ok: false, message: "Department not found for this address." });
      return;
    }
    response.json({ ok: true, tenant: tenantSlug });
  });

  registerMaintenance(app, prisma);
  registerParts(app, prisma);
  registerInspections(app, prisma);
  registerMaps(app, prisma);
  registerDisplays(app, prisma);
  registerChecklists(app, prisma);
  registerDashboard(app, prisma);
  registerPolicies(app, prisma);
  registerPrevention(app, prisma);
}
