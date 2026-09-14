import { getPortState } from "./portStateService.js";
import { fetchWeather, calculateWeatherStress } from "./weatherService.js";
import type { WeatherStressResult } from "../types/weatherTypes.js";
import type { Asset } from "../types/portTypes.js";

function getDeterministicNumber(str: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const normalized = Math.abs(hash) / 2147483648; // 0 to 1
  return min + normalized * (max - min);
}

function getDeterministicType(str: string): "H" | "L" | "M" {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const mod = Math.abs(hash) % 3;
  if (mod === 0) return "H";
  if (mod === 1) return "L";
  return "M";
}

export async function getPredictionsForAssets() {
  const portState = getPortState();
  
  let current;
  try {
    const weatherResult = await fetchWeather();
    current = weatherResult.current;
  } catch (err) {
      // fallback just in case, but prompt says not to silently ignore. We need weather to match exactly.
      throw new Error(`Failed to fetch weather: ${err}`);
  }

  const stressResult = calculateWeatherStress(current);

  const predictions: any[] = [];

  for (const asset of portState.assets) {
    const pred = await computePrediction(asset, current, stressResult);
    predictions.push(pred);
  }

  return predictions;
}

export async function getPredictionForAsset(assetId: string) {
  const portState = getPortState();
  const asset = portState.assets.find(a => a.id === assetId);
  if (!asset) {
    throw new Error(`Asset not found: ${assetId}`);
  }
  
  let current;
  try {
    const weatherResult = await fetchWeather();
    current = weatherResult.current;
  } catch (err) {
      throw new Error(`Failed to fetch weather: ${err}`);
  }

  const stressResult = calculateWeatherStress(current);
  return await computePrediction(asset, current, stressResult);
}

async function computePrediction(asset: Asset, weather: any, stress: WeatherStressResult) {
  // Operational limits 
  const Air_temperature = getDeterministicNumber(asset.id + "air", 295, 305);
  const Process_temperature = getDeterministicNumber(asset.id + "proc", 305, 315);
  const Rotational_speed = getDeterministicNumber(asset.id + "rpm", 1400, 2800);
  const Torque = getDeterministicNumber(asset.id + "trq", 20, 70);
  const Tool_wear = getDeterministicNumber(asset.id + "wear", 0, 200);

  const Temp_diff = Process_temperature - Air_temperature;
  const Torque_x_Speed = Torque * Rotational_speed;
  const Power_est = Torque * Rotational_speed * 0.1047; // approx power equation

  const type = getDeterministicType(asset.id);
  const Type_H = type === "H" ? 1.0 : 0.0;
  const Type_L = type === "L" ? 1.0 : 0.0;
  const Type_M = type === "M" ? 1.0 : 0.0;

  // Weather mapping
  const Wind_speed_kmh = weather.windSpeedKmh;
  const Rainfall_mm = weather.precipitationMm;
  const WMO_Code = weather.weatherCode;
  let Storm_flag = 0.0;
  if ([95, 96, 99].includes(WMO_Code) || weather.windSpeedKmh > 70) {
      Storm_flag = 1.0;
  }
  const Weather_stress_index = stress.weatherStressIndex;

  const payload = {
    Air_temperature,
    Process_temperature,
    Rotational_speed,
    Torque,
    Tool_wear,
    Temp_diff,
    Torque_x_Speed,
    Power_est,
    Type_H,
    Type_L,
    Type_M,
    Ambient_temp_C: weather.temperatureC,
    Wind_speed_kmh,
    Rainfall_mm,
    Storm_flag,
    Weather_stress_index
  };

  // call python service
  try {
    const response = await fetch("http://127.0.0.1:8000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
       const err = await response.json().catch(() => ({}));
       throw new Error(`Python service error: ${response.status} - ${JSON.stringify(err)}`);
    }

    const data = await response.json();
    
    return {
      assetId: asset.id,
      assetName: asset.name,
      probability: data.riskProbability,
      riskLevel: data.riskLevel,
      model: data.model,
      inputProvenance: "Simulated operational values; Real weather from Open-Meteo",
      weatherInformationUsed: {
          windSpeedKmh: Wind_speed_kmh,
          precipitationMm: Rainfall_mm,
          wmoCode: WMO_Code,
          stressIndex: Weather_stress_index,
          isStorm: Storm_flag === 1.0
      },
      calculatedAt: new Date().toISOString()
    };
  } catch (error: any) {
    throw new Error(`Service Unavailable: ${error.message}`);
  }
}
