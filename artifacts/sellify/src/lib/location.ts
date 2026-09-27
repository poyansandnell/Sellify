export type ListingLocation = {
  country: string;
  region: string;
  city: string;
  postalCode: string;
};

type NominatimReverseResult = {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    province?: string;
    region?: string;
    state_district?: string;
    postcode?: string;
    country_code?: string;
  };
};

let lastNominatimRequestAt = 0;

export async function getBrowserLocation(): Promise<ListingLocation> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Platsbestämning stöds inte i den här webbläsaren.");
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? "Du har inte tillåtit platsåtkomst. Du kan fylla i platsen manuellt."
              : "Kunde inte läsa av din plats. Fyll i den manuellt.",
          ),
        );
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60_000 },
    );
  });

  const delay = Math.max(0, 1_000 - (Date.now() - lastNominatimRequestAt));
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(position.coords.latitude),
    lon: String(position.coords.longitude),
    zoom: "10",
    addressdetails: "1",
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
    { headers: { "Accept-Language": document.documentElement.lang || navigator.language } },
  );
  lastNominatimRequestAt = Date.now();

  if (!response.ok) {
    throw new Error("Platsuppslaget misslyckades. Fyll i platsen manuellt.");
  }

  const result = (await response.json()) as NominatimReverseResult;
  const address = result.address;
  const city =
    address?.city ??
    address?.town ??
    address?.village ??
    address?.municipality ??
    address?.county ??
    "";
  const country = address?.country_code?.toUpperCase() ?? "";

  if (!city || !country) {
    throw new Error("Kunde inte hitta stad och land. Fyll i platsen manuellt.");
  }

  return {
    country,
    region: address?.state ?? address?.province ?? address?.region ?? address?.state_district ?? "",
    city,
    postalCode: address?.postcode ?? "",
  };
}