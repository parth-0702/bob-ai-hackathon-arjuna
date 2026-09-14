/**
 * PortSentinel Nexus — Weather Service
 *
 * Data source : Open-Meteo public forecast API  https://open-meteo.com
 * Location    : Deendayal Port (Kandla), Gujarat, India
 * Coordinates : 23.03 °N / 70.22 °E  (same reference used by port state)
 *
 * ✅  simulated: false — this is REAL external weather data.
 *
 * Error policy
 * ─────────────
 * If Open-Meteo is unreachable or returns an unexpected payload, this service
 * throws a typed WeatherFetchError. It will NEVER silently return fake/simulated
 * weather in place of a failed real fetch.
 */

import type {
  WeatherResponse,
  WeatherStressResult,
  CurrentWeather,
  HourlySlot,
  WmoDescription,
  WeatherRiskLevel,
} from "../types/weatherTypes.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const KANDLA_LAT = 22.9833;
const KANDLA_LON = 70.2167;
const FORECAST_DAYS = 3; // gives 72 hourly slots

const OPEN_METEO_URL = new URL("https://api.open-meteo.com/v1/forecast");
OPEN_METEO_URL.searchParams.set("latitude", String(KANDLA_LAT));
OPEN_METEO_URL.searchParams.set("longitude", String(KANDLA_LON));
OPEN_METEO_URL.searchParams.set(
  "current",
  [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
    "weather_code",
    "wind_speed_10m",
    "wind_direction_10m",
    "visibility",
  ].join(",")
);
OPEN_METEO_URL.searchParams.set(
  "hourly",
  [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation_probability",
    "precipitation",
    "weather_code",
    "wind_speed_10m",
    "wind_direction_10m",
    "visibility",
  ].join(",")
);
OPEN_METEO_URL.searchParams.set("forecast_days", String(FORECAST_DAYS));
OPEN_METEO_URL.searchParams.set("timezone", "Asia/Kolkata");

// ─── WMO Code lookup table ────────────────────────────────────────────────────
// Source: WMO code table 4677 / Open-Meteo documentation

const WMO_TABLE: WmoDescription[] = [
  { code: 0,  label: "Clear sky",                       severity: "clear" },
  { code: 1,  label: "Mainly clear",                    severity: "clear" },
  { code: 2,  label: "Partly cloudy",                   severity: "cloudy" },
  { code: 3,  label: "Overcast",                        severity: "cloudy" },
  { code: 45, label: "Foggy",                           severity: "fog" },
  { code: 48, label: "Icy fog (depositing rime)",       severity: "fog" },
  { code: 51, label: "Light drizzle",                   severity: "drizzle" },
  { code: 53, label: "Moderate drizzle",                severity: "drizzle" },
  { code: 55, label: "Dense drizzle",                   severity: "drizzle" },
  { code: 61, label: "Slight rain",                     severity: "rain" },
  { code: 63, label: "Moderate rain",                   severity: "rain" },
  { code: 65, label: "Heavy rain",                      severity: "rain" },
  { code: 71, label: "Slight snowfall",                 severity: "snow" },
  { code: 73, label: "Moderate snowfall",               severity: "snow" },
  { code: 75, label: "Heavy snowfall",                  severity: "snow" },
  { code: 77, label: "Snow grains",                     severity: "snow" },
  { code: 80, label: "Slight rain showers",             severity: "shower" },
  { code: 81, label: "Moderate rain showers",           severity: "shower" },
  { code: 82, label: "Violent rain showers",            severity: "shower" },
  { code: 85, label: "Slight snow showers",             severity: "snow" },
  { code: 86, label: "Heavy snow showers",              severity: "snow" },
  { code: 95, label: "Thunderstorm",                    severity: "thunderstorm" },
  { code: 96, label: "Thunderstorm with slight hail",   severity: "thunderstorm" },
  { code: 99, label: "Thunderstorm with heavy hail",    severity: "thunderstorm" },
];

function describeWmo(code: number): WmoDescription {
  // Exact match first, then nearest lower code
  const exact = WMO_TABLE.find((w) => w.code === code);
  if (exact) return exact;
  const fallback = [...WMO_TABLE].reverse().find((w) => w.code <= code);
  return fallback ?? { code, label: `Weather code ${code}`, severity: "cloudy" };
}

// ─── Wind direction label ─────────────────────────────────────────────────────

function windLabel(deg: number): string {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ─── Shape normalizers ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeCurrent(raw: any): CurrentWeather {
  const wmo = describeWmo(raw.weather_code);
  return {
    time: raw.time,
    temperatureC: raw.temperature_2m,
    relativeHumidityPct: raw.relative_humidity_2m,
    precipitationMm: raw.precipitation,
    weatherCode: raw.weather_code,
    weatherDescription: wmo.label,
    windSpeedKmh: raw.wind_speed_10m,
    windDirectionDeg: raw.wind_direction_10m,
    windDirectionLabel: windLabel(raw.wind_direction_10m),
    visibilityM: raw.visibility,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeHourly(raw: any): HourlySlot[] {
  const times: string[]  = raw.time;
  const slots: HourlySlot[] = [];

  for (let i = 0; i < times.length; i++) {
    const wmo = describeWmo(raw.weather_code[i]);
    slots.push({
      time: times[i],
      temperatureC: raw.temperature_2m[i],
      relativeHumidityPct: raw.relative_humidity_2m[i],
      precipitationProbabilityPct: raw.precipitation_probability[i],
      precipitationMm: raw.precipitation[i],
      weatherCode: raw.weather_code[i],
      weatherDescription: wmo.label,
      windSpeedKmh: raw.wind_speed_10m[i],
      windDirectionDeg: raw.wind_direction_10m[i],
      windDirectionLabel: windLabel(raw.wind_direction_10m[i]),
      visibilityM: raw.visibility[i],
    });
  }
  return slots;
}

// ─── Main fetch function ──────────────────────────────────────────────────────

export async function fetchWeather(): Promise<WeatherResponse> {
  const fetchedAt = new Date().toISOString();

  let raw: Response;
  try {
    raw = await fetch(OPEN_METEO_URL.toString(), {
      signal: AbortSignal.timeout(10_000), // 10 s hard timeout
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new WeatherFetchError(
      `Open-Meteo is unreachable: ${msg}`,
      fetchedAt
    );
  }

  if (!raw.ok) {
    throw new WeatherFetchError(
      `Open-Meteo returned HTTP ${raw.status}: ${raw.statusText}`,
      fetchedAt
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await raw.json();
  } catch {
    throw new WeatherFetchError(
      "Open-Meteo returned unparseable JSON.",
      fetchedAt
    );
  }

  // Minimal shape validation — guard against silent API changes
  if (!body?.current || !body?.hourly?.time) {
    throw new WeatherFetchError(
      "Open-Meteo response is missing expected fields (current / hourly.time).",
      fetchedAt
    );
  }

  return {
    source: "open-meteo",
    simulated: false,
    location: "Deendayal Port, Kandla",
    resolvedLat: body.latitude,
    resolvedLon: body.longitude,
    elevationM: body.elevation,
    timezone: body.timezone,
    current: normalizeCurrent(body.current),
    hourly: normalizeHourly(body.hourly),
    fetchedAt,
  };
}

// ─── Custom error class ───────────────────────────────────────────────────────

export class WeatherFetchError extends Error {
  public readonly fetchedAt: string;
  constructor(message: string, fetchedAt: string) {
    super(message);
    this.name = "WeatherFetchError";
    this.fetchedAt = fetchedAt;
  }
}

// ─── Weather Stress Index ─────────────────────────────────────────────────────
//
// Deterministic rule-based score — NOT an ML prediction.
//
// FOUR weighted components (0–100 each, before weighting):
//   Wind        35 %   (wind_speed_10m km/h)
//   Precipitation 25 % (precipitation mm)
//   WMO severity  25 % (weather interpretation code)
//   Visibility    15 % (visibility metres)
//
// Wind score (km/h → 0-100):
//   < 20   → 0     (negligible)
//   20–40  → 15    (light operational awareness)
//   40–55  → 35    (moderate; crane & vessel caution)
//   55–70  → 55    (high; elevated risk)
//   ≥ 70   → 75    (severe; significant operational risk)
//
// Precipitation score (mm → 0-100):
//   0      → 0
//   < 2    → 10    (light; minimal impact)
//   < 5    → 30    (moderate; surface and cargo risk)
//   < 15   → 55    (heavy; may delay outdoor operations)
//   ≥ 15   → 75    (very heavy; high operational risk)
//
// WMO severity score (0-100):
//   clear/cloudy   → 0
//   drizzle        → 10
//   rain           → 25
//   fog            → 30   (navigation / pilotage risk)
//   shower         → 35
//   snow           → 40
//   thunderstorm   → 80   (electrical + extreme wind + hail risk)
//
// Visibility score (metres → 0-100):
//   ≥ 10 000   → 0    (clear)
//   < 10 000   → 15   (slightly reduced)
//   <  5 000   → 30   (reduced; pilot caution)
//   <  1 000   → 55   (poor; vessel approach review)
//   <    500   → 75   (very poor; significant navigation hazard)
//
// Composite (before override):
//   raw = wind×0.35 + precip×0.25 + wmo×0.25 + visibility×0.15
//   base = clamp(round(raw), 0, 100)
//
// Severe-weather FLOOR overrides (applied after composite):
//   WMO thunderstorm with heavy hail (code 99)          → min floor 70 (HIGH)
//   WMO thunderstorm / thunderstorm+hail (codes 95, 96) → min floor 56 (HIGH)
//   WMO violent showers (code 82) or heavy snow (75,86) → min floor 40 (MEDIUM)
//   WMO fog (codes 45, 48) + visibility < 500 m         → min floor 30 (MEDIUM)
//
// Final = clamp(max(base, floorFromSevereWx), 0, 100)
// Risk level: 0–25 LOW | 26–55 MEDIUM | 56–100 HIGH

function windComponentScore(kmh: number): number {
  if (kmh < 20)  return 0;
  if (kmh < 40)  return 15;
  if (kmh < 55)  return 35;
  if (kmh < 70)  return 55;
  return 75;
}

function precipComponentScore(mm: number): number {
  if (mm === 0)  return 0;
  if (mm < 2)    return 10;
  if (mm < 5)    return 30;
  if (mm < 15)   return 55;
  return 75;
}

function wmoComponentScore(code: number): number {
  const { severity } = describeWmo(code);
  const map: Record<string, number> = {
    clear:        0,
    cloudy:       0,
    drizzle:     10,
    rain:        25,
    fog:         30,
    shower:      35,
    snow:        40,
    thunderstorm: 80,
  };
  return map[severity] ?? 0;
}

function visibilityComponentScore(m: number): number {
  if (m < 500)     return 75;
  if (m < 1_000)   return 55;
  if (m < 5_000)   return 30;
  if (m < 10_000)  return 15;
  return 0;
}

/**
 * Returns the minimum index floor imposed by severe WMO conditions.
 * 0 means no override applies.
 */
function severeWeatherFloor(code: number, visibilityM: number): number {
  // Thunderstorm with heavy hail — strongest override → HIGH
  if (code === 99) return 70;
  // Thunderstorm (with or without slight hail) → HIGH
  if (code === 95 || code === 96) return 56;
  // Violent rain showers, heavy snow showers, heavy snowfall → MEDIUM
  if (code === 82 || code === 86 || code === 75) return 40;
  // Dense fog + critically low visibility → MEDIUM
  if ((code === 45 || code === 48) && visibilityM < 500) return 30;
  return 0;
}

function riskFromIndex(index: number): WeatherRiskLevel {
  if (index <= 25) return "LOW";
  if (index <= 55) return "MEDIUM";
  return "HIGH";
}

function buildOperationalImpacts(
  current: CurrentWeather,
  index: number,
  floor: number
): string[] {
  const impacts: string[] = [];
  const wmo = describeWmo(current.weatherCode);

  if (current.windSpeedKmh >= 55) {
    impacts.push(
      `Wind speed ${current.windSpeedKmh.toFixed(1)} km/h — elevated risk to crane operations and mooring stability. Verify crane operating envelopes.`
    );
  } else if (current.windSpeedKmh >= 40) {
    impacts.push(
      `Wind speed ${current.windSpeedKmh.toFixed(1)} km/h — monitor crane load limits and exposed cargo.`
    );
  }

  if (current.visibilityM < 500) {
    impacts.push(
      `Visibility ${current.visibilityM.toFixed(0)} m — critically low (< 500 m). Vessel approach, pilotage, and tug operations require immediate assessment.`
    );
  } else if (current.visibilityM < 1_000) {
    impacts.push(
      `Visibility ${current.visibilityM.toFixed(0)} m — below 1 km. Vessel approach and pilotage may require additional assessment.`
    );
  } else if (current.visibilityM < 5_000) {
    impacts.push(
      `Visibility ${current.visibilityM.toFixed(0)} m — reduced. Pilots and tug operators should exercise caution.`
    );
  }

  if (wmo.severity === "thunderstorm") {
    impacts.push(
      `Thunderstorm currently active (WMO ${current.weatherCode}: ${wmo.label}). Outdoor electrical equipment and open-deck operations should be reviewed. Stress floor override applied.`
    );
  }

  if (current.precipitationMm >= 5) {
    impacts.push(
      `Precipitation ${current.precipitationMm.toFixed(1)} mm — heavy rainfall may affect open-stack cargo, deck operations, and vehicle access.`
    );
  } else if (current.precipitationMm >= 2) {
    impacts.push(
      `Precipitation ${current.precipitationMm.toFixed(1)} mm — moderate rainfall. Monitor surface drainage at berths.`
    );
  }

  if (current.relativeHumidityPct >= 95) {
    impacts.push(
      `Relative humidity ${current.relativeHumidityPct} % — condensation risk for sensitive cargo and electrical equipment.`
    );
  }

  if (floor > 0 && index === floor) {
    impacts.push(
      `Note: WMO code ${current.weatherCode} (${wmo.label}) triggered a severe-weather floor override — stress index floored to ${floor}.`
    );
  }

  if (index === 0) {
    impacts.push("Current weather conditions are favourable for port operations.");
  }

  return impacts;
}

export function calculateWeatherStress(current: CurrentWeather): WeatherStressResult {
  const windScore       = windComponentScore(current.windSpeedKmh);
  const precipScore     = precipComponentScore(current.precipitationMm);
  const wmoScore        = wmoComponentScore(current.weatherCode);
  const visibilityScore = visibilityComponentScore(current.visibilityM);

  // Weighted composite
  const raw = (
    windScore       * 0.35 +
    precipScore     * 0.25 +
    wmoScore        * 0.25 +
    visibilityScore * 0.15
  );
  const base = Math.min(100, Math.max(0, Math.round(raw)));

  // Severe-weather floor — prevents calm wind+rain from diluting severe WMO
  const floor = severeWeatherFloor(current.weatherCode, current.visibilityM);
  const weatherStressIndex = Math.min(100, Math.max(base, floor));

  const weatherRiskLevel   = riskFromIndex(weatherStressIndex);
  const operationalImpacts = buildOperationalImpacts(current, weatherStressIndex, floor);

  return {
    weatherStressIndex,
    weatherRiskLevel,
    components: { windScore, precipitationScore: precipScore, wmoScore, visibilityScore } as WeatherStressResult["components"],
    operationalImpacts,
    weatherRulesSummary:
      "Score = clamp(max(base, severeFloor), 0, 100). " +
      "base = round(windScore×0.35 + precipScore×0.25 + wmoScore×0.25 + visibilityScore×0.15). " +
      "Wind: <20km/h=0, 20–40=15, 40–55=35, 55–70=55, ≥70=75. " +
      "Precip: 0mm=0, <2=10, <5=30, <15=55, ≥15=75. " +
      "WMO: clear/cloudy=0, drizzle=10, rain=25, fog=30, shower=35, snow=40, thunderstorm=80. " +
      "Visibility: ≥10000m=0, <10000=15, <5000=30, <1000=55, <500=75. " +
      "Severe-weather floors (override if base < floor): " +
      "WMO99(heavy hail)=70, WMO95/96(thunderstorm)=56, WMO82/75/86(violent showers/snow)=40, WMO45/48+vis<500m=30. " +
      "Risk: 0–25=LOW, 26–55=MEDIUM, 56–100=HIGH. NOT an ML prediction.",
    basedOn: current,
    calculatedAt: new Date().toISOString(),
  };
}
