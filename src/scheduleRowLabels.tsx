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
  if (icon === "ambulance") {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <rect x="1.4" y="6.2" width="13.2" height="5.4" rx="1" fill="#f8fafc" stroke="#64748b" strokeWidth="0.7" />
        <rect x="1.4" y="8.3" width="13.2" height="1.2" fill="#dc2626" />
        <path d="M9.2 6.2 V4.6 h4.2 V6.2" fill="#e2e8f0" stroke="#64748b" strokeWidth="0.6" />
        <circle cx="4.3" cy="12.1" r="1.25" fill="#1e293b" />
        <circle cx="11.4" cy="12.1" r="1.25" fill="#1e293b" />
      </svg>
    );
  }
  if (icon === "maltese") {
    return (
      <svg viewBox="0 0 100 100" width="18" height="18" aria-hidden="true">
        {/* Fire-department Florian cross: flared arms with concave scoops */}
        <path
          fill="#0f172a"
          d="M36 40 L16 10 Q50 32 84 10 L64 40 L90 20 Q70 50 90 80 L64 60 L84 90 Q50 68 16 90 L36 60 L10 80 Q30 50 10 20 Z"
        />
        <circle cx="50" cy="50" r="17" fill="#ffffff" />
        <circle cx="50" cy="50" r="17" fill="none" stroke="#0f172a" strokeWidth="2.8" />
        <circle cx="50" cy="50" r="13" fill="none" stroke="#0f172a" strokeWidth="1.4" />
      </svg>
    );
  }
  if (icon === "medic") {
    const starBorder = [
      "M 39.5,6.0 L 60.5,6.0 L 60.5,94.0 L 39.5,94.0 Z",
      "M 82.9,18.9 L 93.4,37.1 L 17.1,81.1 L 6.6,62.9 Z",
      "M 93.4,62.9 L 82.9,81.1 L 6.6,37.1 L 17.1,18.9 Z",
    ];
    const starFill = [
      "M 41.8,9.0 L 58.2,9.0 L 58.2,91.0 L 41.8,91.0 Z",
      "M 81.4,22.4 L 89.6,36.6 L 18.6,77.6 L 10.4,63.4 Z",
      "M 89.6,63.4 L 81.4,77.6 L 10.4,36.6 L 18.6,22.4 Z",
    ];
    return (
      <svg viewBox="0 0 100 100" width="18" height="18" aria-hidden="true">
        {/* Star of Life: three flat-ended bars, not pointed tips */}
        {starBorder.map((d) => (
          <path key={`border-${d.slice(0, 12)}`} fill="#93c5fd" d={d} />
        ))}
        {starFill.map((d) => (
          <path key={`fill-${d.slice(0, 12)}`} fill="#1d4ed8" d={d} />
        ))}
        <path
          d="M50 27 v46"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <path
          d="M43 66 C34 58 64 58 45 50 C34 44 64 40 47 34 C44 31 56 30 54 25"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="55" cy="24" r="2.3" fill="#ffffff" />
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
