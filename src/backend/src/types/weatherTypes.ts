/**
 * PortSentinel Nexus — Weather Type Definitions
 *
 * Data source : Open-Meteo public forecast API (https://open-meteo.com)
 * Location    : Deendayal Port, Kandla  (23.03 °N / 70.22 °E)
 *
 * This module represents REAL external weather data — it is NOT simulated.
 * simulated: false is mandated on WeatherResponse.
 */

// ─── WMO weather-code description ────────────────────────────────────────────

export interface WmoDescription {
  code: number;
  label: string;
  severity: "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "shower" | "thunderstorm";
}

// ─── Current conditions (one observation slot from Open-Meteo) ────────────────

export interface CurrentWeather {
  /** ISO-8601 observation time (local, IST) */
  time: string;
  /** Degrees Celsius */
  temperatureC: number;
  /** Percent */
  relativeHumidityPct: number;
  /** mm in the last measurement interval */
  precipitationMm: number;
  /** WMO weather interpretation code */
  weatherCode: number;
  /** Human-readable description of the WMO code */
  weatherDescription: string;
  /** km/h */
  windSpeedKmh: number;
  /** Degrees (0 = North, 90 = East, …) */
  windDirectionDeg: number;
  /** Compass label e.g. "SW" */
  windDirectionLabel: string;
  /** Metres */
  visibilityM: number;
}

// ─── One hourly slot ──────────────────────────────────────────────────────────

export interface HourlySlot {
  time: string;
  temperatureC: number;
  relativeHumidityPct: number;
  precipitationProbabilityPct: number;
  precipitationMm: number;
  weatherCode: number;
  weatherDescription: string;
  windSpeedKmh: number;
  windDirectionDeg: number;
  windDirectionLabel: string;
  visibilityM: number;
}

// ─── Normalized weather response (returned by weatherService) ─────────────────

export interface WeatherResponse {
  /** Always "open-meteo" */
  source: "open-meteo";
  /** Always false — this is real external weather data */
  simulated: false;
  location: "Deendayal Port, Kandla";
  /** Resolved lat from Open-Meteo (may differ slightly from requested) */
  resolvedLat: number;
  resolvedLon: number;
  /** Elevation in metres */
  elevationM: number;
  timezone: string;
  current: CurrentWeather;
  /** Up to 72 hourly slots (3-day forecast) */
  hourly: HourlySlot[];
  /** ISO-8601 timestamp of when this data was fetched */
  fetchedAt: string;
}

// ─── Weather stress index ─────────────────────────────────────────────────────

export type WeatherRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface WeatherStressResult {
  /** 0–100 deterministic score derived from rules; NOT an ML prediction */
  weatherStressIndex: number;
  weatherRiskLevel: WeatherRiskLevel;
  /**
   * Component scores (0–100 each, before weighting) for transparency.
   * wind: 35 %, precipitation: 25 %, wmoCode: 25 %, visibility: 15 %
   * Severe-weather floor overrides are applied after the weighted sum.
   */
  components: {
    windScore: number;           // based on wind_speed_10m km/h
    precipitationScore: number;  // based on precipitation mm
    wmoScore: number;            // based on WMO weather code severity
    visibilityScore: number;     // based on visibility metres
  };
  /** Plain-English operational observations derived from current conditions */
  operationalImpacts: string[];
  weatherRulesSummary: string;
  basedOn: CurrentWeather;
  calculatedAt: string;
}

// ─── Error shape returned when Open-Meteo is unavailable ────────────────────

export interface WeatherError {
  error: true;
  message: string;
  source: "open-meteo";
  fetchedAt: string;
}
