import { useState } from "react";
import { Link } from "react-router-dom";
import { lookupDistrict, type DistrictMatch, type Geofence } from "../../api/maps";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import { useMyPermissions } from "../../useMyPermissions";
import { errorText } from "../maintenance/maintenanceUtils";
import { kindLabel } from "./mapUtils";
import { MapCanvas } from "./MapCanvas";
import { useMapLibrary } from "./useMapLibrary";

/** Operational map: layers, search, measure, and a district check that does not use Google's coordinates. */
export function MapViewPage() {
  const grants = useMyPermissions();
  const canManage = grants?.["maps.manage"] === true;
  const library = useMapLibrary();

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Map View</h1>
          <p>Department map with hydrants, markers, stations, areas and recent calls. Call pins are looked up and are not saved.</p>
        </div>
        {canManage ? (
          <div className="header-actions">
            <Link className="primary-button compact-button" to="/incidents-mapping/map-markers">Edit markers</Link>
          </div>
        ) : null}
      </header>
      {library.error ? <p className="field-error">{library.error}</p> : null}
      {library.loading ? <p className="field-hint">Loading...</p> : null}
      <MapCanvas
        mode="view"
        markers={library.markers}
        types={library.types}
        geofences={library.geofences}
        canManage={canManage}
        focus={null}
        onReload={library.reload}
      />
      <DistrictPanel geofences={library.geofences} />
    </section>
  );
}

function DistrictPanel({ geofences }: { geofences: Geofence[] }) {
  const districts = geofences.filter((area) => area.kind === "district");
  const [address, setAddress] = useState("");
  const [pickedId, setPickedId] = useState("");
  const [matches, setMatches] = useState<DistrictMatch[] | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    setError("");
    setNote("");
    try {
      const result = await lookupDistrict({ address });
      setMatches(result.matches);
      setNote(
        result.matchedAddress
          ? `Looked up with the US Census geocoder: ${result.matchedAddress}`
          : "Checked the point you entered.",
      );
    } catch (checkError) {
      setMatches(null);
      setError(errorText(checkError, "Could not check the district. Pick one by hand."));
    } finally {
      setChecking(false);
    }
  };

  const picked = districts.find((area) => area.id === pickedId);

  return (
    <article className="panel">
      <div className="panel-header">
        <h3>District</h3>
      </div>
      <p className="field-hint">
        The check uses the free US Census lookup, then sees which saved areas contain that point. It does not use a Google coordinate, and it does not change an incident. You can also pick a district by hand.
      </p>
      <div className="department-edit-grid">
        <label className="map-span">
          Address
          <input type="text" value={address} placeholder="123 Main St, city, state" onChange={(event) => setAddress(event.target.value)} />
        </label>
        <label className="map-span">
          Or pick a district
          <NerisFlatSingleOptionSelect
            inputId="map-district-pick"
            value={pickedId}
            options={districts.map((area) => ({ value: area.id, label: area.name }))}
            usePortal
            allowClear
            placeholder={districts.length === 0 ? "No district areas yet" : "Choose a district"}
            onChange={setPickedId}
          />
        </label>
      </div>
      <div className="header-actions">
        <button type="button" className="primary-button compact-button" disabled={checking || address.trim().length < 5} onClick={() => void check()}>
          {checking ? "Checking..." : "Check district"}
        </button>
      </div>
      {error ? <p className="field-error">{error}</p> : null}
      {note ? <p className="field-hint">{note}</p> : null}
      {matches ? (
        <p>
          {matches.length === 0
            ? "That point is not inside a saved area."
            : `Inside: ${matches.map((match) => `${match.name} (${kindLabel(match.kind)})`).join(", ")}.`}
        </p>
      ) : null}
      {picked ? <p>District picked by hand: <strong>{picked.name}</strong></p> : null}
    </article>
  );
}
