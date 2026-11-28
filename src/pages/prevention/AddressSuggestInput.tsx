import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import type { LatLng } from "../maps/mapUtils";

const MIN_CHARS = 4;
const BIAS_METERS = 40000;

interface PlacePrediction {
  text: { text: string };
  mainText?: { text: string } | null;
  secondaryText?: { text: string } | null;
}

export interface PickedAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
}

/** "Kankakee, IL, USA" or "Kankakee, IL 60901, USA" into city, state and ZIP. */
function splitSecondary(secondary: string): Omit<PickedAddress, "street"> {
  const parts = secondary
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !/^(USA|United States)$/i.test(part));
  const city = parts[0] ?? "";
  const stateZip = (parts[1] ?? "").match(/^([A-Za-z]{2})(?:\s+(\d{5}))?/);
  return { city, state: stateZip?.[1]?.toUpperCase() ?? "", postalCode: stateZip?.[2] ?? "" };
}

/**
 * Street address box with Google suggestions while typing (Places API, suggestions only; no place details
 * are requested). Picking one fills the text fields; the pin still comes from the Census lookup.
 * Must sit inside APIProvider.
 */
export function AddressSuggestInput({
  value,
  bias,
  onChange,
  onPick,
  onBlur,
}: {
  value: string;
  bias: LatLng | null;
  onChange: (value: string) => void;
  onPick: (address: PickedAddress) => void;
  onBlur: () => void;
}) {
  const places = useMapsLibrary("places");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [found, setFound] = useState<{ term: string; items: PlacePrediction[] }>({ term: "", items: [] });
  const tokenRef = useRef<unknown>(null);
  const term = value.trim();
  const biasLat = bias?.lat;
  const biasLng = bias?.lng;

  useEffect(() => {
    if (!places || !open || term.length < MIN_CHARS) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (!tokenRef.current) tokenRef.current = new places.AutocompleteSessionToken();
      void places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: term,
        sessionToken: tokenRef.current,
        includedRegionCodes: ["us"],
        ...(biasLat != null && biasLng != null
          ? { locationBias: { center: { lat: biasLat, lng: biasLng }, radius: BIAS_METERS } }
          : {}),
      })
        .then(({ suggestions }: { suggestions: { placePrediction: PlacePrediction | null }[] }) => {
          if (!active) return;
          const items = suggestions.flatMap((entry) => (entry.placePrediction ? [entry.placePrediction] : []));
          setFound({ term, items: items.slice(0, 5) });
        })
        .catch(() => {
          if (active) setFound({ term, items: [] });
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [biasLat, biasLng, open, places, term]);

  const items = found.term === term && term.length >= MIN_CHARS ? found.items : [];

  const close = () => {
    setOpen(false);
    setHighlight(-1);
  };

  const pick = (prediction: PlacePrediction) => {
    const street = prediction.mainText?.text || prediction.text.text.split(",")[0];
    tokenRef.current = null;
    close();
    onPick({ street, ...splitSecondary(prediction.secondaryText?.text ?? "") });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && items.length > 0) {
      event.preventDefault();
      setOpen(true);
      setHighlight((current) => (current + 1) % items.length);
    } else if (event.key === "ArrowUp" && items.length > 0) {
      event.preventDefault();
      setHighlight((current) => (current <= 0 ? items.length - 1 : current - 1));
    } else if (event.key === "Enter" && open && highlight >= 0 && items[highlight]) {
      event.preventDefault();
      pick(items[highlight]);
    } else if (event.key === "Escape") {
      close();
    }
  };

  return (
    <div className="map-search-field property-address-suggest">
      <input
        type="text"
        value={value}
        placeholder="Start typing the street address"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-autocomplete="list"
        autoComplete="off"
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          close();
          onBlur();
        }}
        onKeyDown={onKeyDown}
      />
      {open && items.length > 0 ? (
        <ul className="map-search-list" role="listbox">
          {items.map((prediction, index) => (
            <li
              key={`${index}-${prediction.text.text}`}
              role="option"
              aria-selected={index === highlight}
              className={index === highlight ? "map-search-option map-search-option-active" : "map-search-option"}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(prediction)}
            >
              <strong>{prediction.mainText?.text || prediction.text.text}</strong>
              {prediction.secondaryText?.text ? <span>{prediction.secondaryText.text}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
