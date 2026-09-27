import { Platform } from "react-native";
import * as Location from "expo-location";

export type DetectedLocation = {
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

async function detectInBrowser(): Promise<DetectedLocation> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Platsbestämning stöds inte i den här webbläsaren.");
  }
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      () => reject(new Error("Platsåtkomst nekades eller kunde inte hämtas.")),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
    );
  });
  const delay = Math.max(0, 1_000 - (Date.now() - lastNominatimRequestAt));
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(position.coords.latitude),
    lon: String(position.coords.longitude),
    zoom: "10",
    addressdetails: "1",
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
    {
      headers: {
        "Accept-Language":
          document.documentElement.lang ||
          (typeof navigator !== "undefined" ? navigator.language : "en"),
      },
    },
  );
  lastNominatimRequestAt = Date.now();
  if (!response.ok) throw new Error("Platsuppslaget misslyckades.");
  const address = ((await response.json()) as NominatimReverseResult).address;
  const city =
    address?.city ??
    address?.town ??
    address?.village ??
    address?.municipality ??
    address?.county ??
    "";
  const country = address?.country_code?.toUpperCase() ?? "";
  if (!city || !country) throw new Error("Stad eller land kunde inte hittas.");
  return {
    country,
    region: address?.state ?? address?.province ?? address?.region ?? address?.state_district ?? "",
    city,
    postalCode: address?.postcode ?? "",
  };
}

export async function detectDeviceLocation(): Promise<DetectedLocation> {
  if (Platform.OS === "web") return detectInBrowser();

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Platsåtkomst nekades. Du kan fortfarande ange platsen manuellt.");
  }
  const position =
    (await Location.getLastKnownPositionAsync()) ??
    (await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }));
  if (!position) throw new Error("Kunde inte läsa av din plats.");

  const [place] = await Location.reverseGeocodeAsync({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  });
  const city = place?.city || place?.subregion || place?.region || "";
  const country = place?.isoCountryCode?.toUpperCase() || "";
  if (!city || !country) throw new Error("Stad eller land kunde inte hittas.");
  return {
    country,
    region: place?.region ?? place?.subregion ?? "",
    city,
    postalCode: place?.postalCode ?? "",
  };
}