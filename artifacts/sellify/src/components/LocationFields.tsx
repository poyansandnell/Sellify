import { useState } from "react";
import { LocateFixed } from "lucide-react";
import { ISO_COUNTRY_CODES, getCountryName } from "@workspace/api-client-react";
import { getBrowserLocation, type ListingLocation } from "@/lib/location";

type LocationFieldsProps = {
  value: ListingLocation;
  onChange: (value: ListingLocation) => void;
  language: string;
  idPrefix: string;
  allowAnyCountry?: boolean;
};

export function LocationFields({
  value,
  onChange,
  language,
  idPrefix,
  allowAnyCountry = false,
}: LocationFieldsProps) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const isSwedish = language === "sv";
  const update = (field: keyof ListingLocation, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    setError("");
    try {
      onChange(await getBrowserLocation());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {isSwedish ? "Land" : "Country"}
          <select
            data-testid={`${idPrefix}-country`}
            value={value.country}
            onChange={(event) => update("country", event.target.value)}
            className="h-12 px-3 rounded-xl border border-border bg-background text-foreground font-medium normal-case tracking-normal"
          >
            {allowAnyCountry ? (
              <option value="">{isSwedish ? "Alla länder" : "Any country"}</option>
            ) : null}
            {ISO_COUNTRY_CODES.map((code) => (
              <option key={code} value={code}>
                {getCountryName(code, isSwedish ? "sv" : "en")} ({code})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {isSwedish ? "Stad" : "City"}
          <input
            data-testid={`${idPrefix}-city`}
            value={value.city}
            onChange={(event) => update("city", event.target.value)}
            placeholder={isSwedish ? "Till exempel Stockholm" : "For example, Chicago"}
            className="h-12 px-3 rounded-xl border border-border bg-background text-foreground font-medium normal-case tracking-normal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {isSwedish ? "Region eller delstat" : "Region or state"}
          <input
            data-testid={`${idPrefix}-region`}
            value={value.region}
            onChange={(event) => update("region", event.target.value)}
            placeholder={isSwedish ? "Till exempel Kalifornien" : "For example, California"}
            className="h-12 px-3 rounded-xl border border-border bg-background text-foreground font-medium normal-case tracking-normal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {isSwedish ? "Postnummer" : "Postal code"}
          <input
            data-testid={`${idPrefix}-postal-code`}
            value={value.postalCode}
            onChange={(event) => update("postalCode", event.target.value)}
            className="h-12 px-3 rounded-xl border border-border bg-background text-foreground font-medium normal-case tracking-normal"
          />
        </label>
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          data-testid={`${idPrefix}-use-location`}
          onClick={useCurrentLocation}
          disabled={locating}
          className="inline-flex items-center gap-2 self-start text-sm font-semibold text-primary disabled:opacity-60"
        >
          <LocateFixed className="h-4 w-4" />
          {locating
            ? isSwedish ? "Hämtar plats…" : "Finding location…"
            : isSwedish ? "Använd min plats" : "Use my location"}
        </button>
        <p className="text-xs text-muted-foreground">
          {isSwedish
            ? "Plats används bara när du trycker. Exakta koordinater sparas inte. © OpenStreetMap-bidragsgivare."
            : "Location is used only after you tap. Exact coordinates are not stored. © OpenStreetMap contributors."}
        </p>
        {error ? (
          <p role="status" data-testid={`${idPrefix}-location-error`} className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}