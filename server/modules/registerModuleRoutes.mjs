/**
 * Routes for the operations modules (maintenance, maps, displays, inventory, policies, prevention, timesheets).
 * The sign-in, tenant and permission middleware in neris-proxy.mjs runs before these.
 * Every query must filter on request.tenant.id, and each route needs a line in permissionForRequest.
 */
import { register as registerInspections } from "./inspections.mjs";
import { register as registerMaintenance } from "./maintenance.mjs";
import { register as registerParts } from "./parts.mjs";

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
}
