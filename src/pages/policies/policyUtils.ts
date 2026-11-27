import type { PolicyKind, PolicySummary } from "../../api/policies";
import { formatDateKey, isoToLocalParts } from "../maintenance/maintenanceUtils";

export const POLICY_KIND_LABEL: Record<PolicyKind, string> = { policy: "Policy", dtb: "DTB" };

export function libraryPath(kind: PolicyKind, policyId = ""): string {
  const base = kind === "dtb" ? "/policies/dtbs" : "/policies/manual";
  return policyId ? `${base}?policy=${encodeURIComponent(policyId)}` : base;
}

export function issuedText(iso: string): string {
  return iso ? formatDateKey(isoToLocalParts(iso).date) : "";
}

export function statusText(policy: Pick<PolicySummary, "status" | "hasDraft">): string {
  const base = policy.status === "published" ? "Published" : policy.status === "archived" ? "Archived" : "Draft";
  return policy.status !== "draft" && policy.hasDraft ? `${base} · unpublished changes` : base;
}

/** Opens a PDF data URL in a new tab. Browsers block data URLs in new tabs, so it goes through a blob. */
export async function openPdfDataUrl(dataUrl: string): Promise<void> {
  const blob = await (await fetch(dataUrl)).blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Prints only the policy (see .policy-printing in App.css), so "Save as PDF" gives a clean copy. */
export function printPolicy(): void {
  document.body.classList.add("policy-printing");
  const done = () => {
    document.body.classList.remove("policy-printing");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

export function readPdfFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}
