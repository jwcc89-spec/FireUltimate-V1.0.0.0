import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import type { Geofence, MapMarker } from "../../api/maps";
import type { LatLng } from "./mapUtils";

const MIN_GOOGLE_CHARS = 3;
const BIAS_METERS = 30000;

interface PlacePrediction {
  text: { text: string };
  toPlace(): {
    fetchFields(request: { fields: string[] }): Promise<unknown>;
    location?: { lat(): number; lng(): number } | null;
    formattedAddress?: string | null;
  };
}

interface Suggestion {
  key: string;
  label: string;
  detail: string;
  pick: () => void;
}

/**
 * Map search with suggestions while typing: the department's markers and areas first, then Google address
 * suggestions (Places API). A Google point only moves the map; it is never saved.
 * Must sit inside APIProvider.
 */
export function MapSearch({
  markers,
  geofences,
  bias,
  onSearch,
  onMarker,
  onArea,
  onPlace,
}: {
  markers: MapMarker[];
  geofences: Geofence[];
  bias: LatLng;
  onSearch: (text: string) => void;
  onMarker: (marker: MapMarker) => void;
  onArea: (area: Geofence) => void;
  onPlace: (point: LatLng, label: string) => void;
}) {
  const places = useMapsLibrary("places");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [google, setGoogle] = useState<{ term: string; items: PlacePrediction[] }>({ term: "", items: [] });
  const [placesOff, setPlacesOff] = useState(false);
  const tokenRef = useRef<unknown>(null);
  const term = query.trim();
  const { lat: biasLat, lng: biasLng } = bias;

  useEffect(() => {
    if (!places || placesOff || term.length < MIN_GOOGLE_CHARS) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (!tokenRef.current) tokenRef.current = new places.AutocompleteSessionToken();
      void places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: term,
        sessionToken: tokenRef.current,
        includedRegionCodes: ["us"],
        locationBias: { center: { lat: biasLat, lng: biasLng }, radius: BIAS_METERS },
      })
        .then(({ suggestions }: { suggestions: { placePrediction: PlacePrediction | null }[] }) => {
          if (!active) return;
          const items = suggestions.flatMap((entry) => (entry.placePrediction ? [entry.placePrediction] : []));
          setGoogle({ term, items: items.slice(0, 5) });
        })
        .catch(() => {
          if (active) setPlacesOff(true);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [biasLat, biasLng, places, placesOff, term]);

  const close = () => {
    setOpen(false);
    setHighlight(-1);
  };

  const pickPlace = (prediction: PlacePrediction) => {
    const label = prediction.text.text;
    setQuery(label);
    close();
    const place = prediction.toPlace();
    tokenRef.current = null;
    void place
      .fetchFields({ fields: ["location", "formattedAddress"] })
      .then(() => {
        const location = place.location;
        if (location) onPlace({ lat: location.lat(), lng: location.lng() }, place.formattedAddress || label);
        else onSearch(label);
      })
      .catch(() => onSearch(label));
  };

  const lower = term.toLowerCase();
  const local: Suggestion[] =
    lower.length < 2
      ? []
      : [
          ...markers
            .filter((marker) => [marker.label, marker.address].some((value) => value.toLowerCase().includes(lower)))
            .slice(0, 4)
            .map((marker) => ({
              key: `marker-${marker.id}`,
              label: marker.label,
              detail: [marker.typeName, marker.address].filter(Boolean).join(" · "),
              pick: () => {
                setQuery(marker.label);
                close();
                onMarker(marker);
              },
            })),
          ...geofences
            .filter((area) => area.name.toLowerCase().includes(lower))
            .slice(0, 2)
            .map((area) => ({
              key: `area-${area.id}`,
              label: area.name,
              detail: "Area",
              pick: () => {
                setQuery(area.name);
                close();
                onArea(area);
              },
            })),
        ];
  const fromGoogle: Suggestion[] =
    google.term === term && term.length >= MIN_GOOGLE_CHARS
      ? google.items.map((prediction, index) => ({
          key: `google-${index}-${prediction.text.text}`,
          label: prediction.text.text,
          detail: "Address",
          pick: () => pickPlace(prediction),
        }))
      : [];
  const suggestions = [...local, ...fromGoogle];

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setHighlight((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setHighlight((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Enter" && open && highlight >= 0 && suggestions[highlight]) {
      event.preventDefault();
      suggestions[highlight].pick();
    } else if (event.key === "Escape") {
      close();
    }
  };

  return (
    <form
      className="map-search"
      onSubmit={(event) => {
        event.preventDefault();
        if (!term) return;
        close();
        onSearch(term);
      }}
    >
      <div className="map-search-field">
        <input
          type="text"
          className="maintenance-search"
          value={query}
          placeholder="Search a marker name or an address"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-autocomplete="list"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={close}
          onKeyDown={onKeyDown}
        />
        {open && (suggestions.length > 0 || (placesOff && term.length >= MIN_GOOGLE_CHARS)) ? (
          <ul className="map-search-list" role="listbox">
            {placesOff && term.length >= MIN_GOOGLE_CHARS ? (
              <li className="map-search-off">Address suggestions need the Places API (New) turned on for the Google key. Search still works.</li>
            ) : null}
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.key}
                role="option"
                aria-selected={index === highlight}
                className={index === highlight ? "map-search-option map-search-option-active" : "map-search-option"}
                onMouseDown={(event) => event.preventDefault()}
                onClick={suggestion.pick}
              >
                <strong>{suggestion.label}</strong>
                {suggestion.detail ? <span>{suggestion.detail}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <button type="submit" className="secondary-button compact-button">Search</button>
    </form>
  );
}
