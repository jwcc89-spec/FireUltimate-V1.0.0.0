import { useEffect, useState } from "react";

const PERMISSIONS_CHANGED = "fire-ultimate:permissions-changed";

export type PermissionGrants = Record<string, boolean>;

export function notifyPermissionsChanged() {
  window.dispatchEvent(new Event(PERMISSIONS_CHANGED));
}

export function useMyPermissions(): PermissionGrants | null {
  const [grants, setGrants] = useState<PermissionGrants | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => {
      fetch("/api/permissions")
        .then(async (response) => {
          if (!response.ok) return null;
          return (await response.json()) as { grants?: PermissionGrants };
        })
        .then((payload) => {
          if (active) setGrants(payload?.grants ?? {});
        })
        .catch(() => {
          if (active) setGrants({});
        });
    };
    load();
    window.addEventListener(PERMISSIONS_CHANGED, load);
    return () => {
      active = false;
      window.removeEventListener(PERMISSIONS_CHANGED, load);
    };
  }, []);
  return grants;
}
