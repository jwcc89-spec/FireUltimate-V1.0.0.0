import type { ScheduleRowIconId } from "./scheduleUtils";

export function ScheduleRowLabelIcon({ icon }: { icon: ScheduleRowIconId }) {
  if (icon === "engine") {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <rect x="2" y="7" width="10" height="5" rx="1" fill="#dc2626" />
        <rect x="8" y="4" width="4" height="3" rx="0.5" fill="#b91c1c" />
        <circle cx="5" cy="12" r="1.4" fill="#1e293b" />
        <circle cx="11" cy="12" r="1.4" fill="#1e293b" />
      </svg>
    );
  }
  if (icon === "medic") {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <rect x="2" y="3" width="12" height="10" rx="2" fill="#059669" />
        <rect x="7" y="5" width="2" height="6" fill="#ffffff" />
        <rect x="5" y="7" width="6" height="2" fill="#ffffff" />
      </svg>
    );
  }
  if (icon === "info") {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <circle cx="8" cy="8" r="6" fill="none" stroke="#0f172a" strokeWidth="1.5" />
        <circle cx="8" cy="5" r="1" fill="#0f172a" />
        <rect x="7.2" y="7" width="1.6" height="5" rx="0.6" fill="#0f172a" />
      </svg>
    );
  }
  if (icon === "sick") {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <rect x="3" y="3" width="10" height="10" rx="2" fill="#dc2626" />
        <rect x="7" y="5" width="2" height="6" fill="#ffffff" />
        <rect x="5" y="7" width="6" height="2" fill="#ffffff" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M3 6h8M9 4l2 2-2 2M13 10H5M7 8l-2 2 2 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
