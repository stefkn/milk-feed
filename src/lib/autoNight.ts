const RAD = Math.PI / 180;
const SUNRISE_SUNSET_ZENITH_DEGREES = 90.833;
const MS_PER_DAY = 86400000;

export interface AutoNightLocation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
}

interface GeocodeResult {
  name?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  admin1?: string;
}

interface GeocodeResponse {
  results?: GeocodeResult[];
}

function dayOfYear(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const startOfDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  return Math.round(
    (startOfDay.getTime() - startOfYear.getTime()) / MS_PER_DAY,
  );
}

/**
 * Calculates sunrise and sunset times (as UTC instants) for a given date and
 * location, using the NOAA solar equations. The results are returned as
 * absolute instants, so they can be compared against `Date.now()` directly
 * regardless of the local timezone.
 */
export function calcSunTimes(
  date: Date,
  latitude: number,
  longitude: number,
): SunTimes {
  const n = dayOfYear(date);

  // Fractional year in radians, centred on the given day.
  const gamma = ((2 * Math.PI) / 365) * (n - 1);

  // Equation of time, in minutes.
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  // Solar declination, in radians.
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const latRad = latitude * RAD;
  const cosHourAngle =
    Math.cos(SUNRISE_SUNSET_ZENITH_DEGREES * RAD) /
      (Math.cos(latRad) * Math.cos(decl)) -
    Math.tan(latRad) * Math.tan(decl);

  let hourAngleDeg: number;
  if (cosHourAngle > 1) {
    // Polar night: the sun never rises.
    hourAngleDeg = 0;
  } else if (cosHourAngle < -1) {
    // Polar day: the sun never sets.
    hourAngleDeg = 180;
  } else {
    hourAngleDeg = Math.acos(cosHourAngle) / RAD;
  }

  const sunriseMinutes = 720 - 4 * (longitude + hourAngleDeg) - eqTime;
  const sunsetMinutes = 720 - 4 * (longitude - hourAngleDeg) - eqTime;

  const base = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return {
    sunrise: new Date(base + sunriseMinutes * 60000),
    sunset: new Date(base + sunsetMinutes * 60000),
  };
}

export function isNight(now: Date, sunrise: Date, sunset: Date): boolean {
  return now < sunrise || now >= sunset;
}

/**
 * Resolves a place name to coordinates using the free, keyless Open-Meteo
 * geocoding API. Returns null when the place cannot be found.
 */
export async function geocodeLocation(
  query: string,
): Promise<AutoNightLocation | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString());
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as GeocodeResponse;
  const result = data.results?.[0];
  if (
    !result ||
    result.latitude === undefined ||
    result.longitude === undefined
  ) {
    return null;
  }

  const name = [result.name, result.admin1, result.country]
    .filter(Boolean)
    .join(", ");

  return {
    name,
    latitude: result.latitude,
    longitude: result.longitude,
  };
}
