import { AlertTriangle, Droplets, FileText, House, Lock, Plane, X } from "lucide-react";

/** The small colored badge drawn on the map for a marker type. */
export function MapPin({ icon, color, selected }: { icon: string; color: string; selected?: boolean }) {
  return (
    <span className={selected ? "map-pin map-pin-selected" : "map-pin"} style={{ background: color }}>
      <MapPinGlyph icon={icon} />
    </span>
  );
}

function MapPinGlyph({ icon }: { icon: string }) {
  if (icon === "hydrant") return <Droplets size={14} aria-hidden="true" />;
  if (icon === "knox") return <Lock size={14} aria-hidden="true" />;
  if (icon === "hazard") return <AlertTriangle size={14} aria-hidden="true" />;
  if (icon === "firehouse") return <House size={14} aria-hidden="true" />;
  if (icon === "preplan") return <FileText size={14} aria-hidden="true" />;
  if (icon === "landing") return <Plane size={14} aria-hidden="true" />;
  if (icon === "donotenter") return <X size={14} aria-hidden="true" />;
  if (icon === "fdc") return <span>FDC</span>;
  if (icon === "shutoff") return <span>SO</span>;
  if (icon === "standpipe") return <span>SP</span>;
  return <span>+</span>;
}
