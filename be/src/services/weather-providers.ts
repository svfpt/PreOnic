// Adapter pattern cho 2 nhà cung cấp dữ liệu thời tiết: OpenWeatherMap và Open-Meteo.
// WeatherService chọn provider chính, fallback sang Open-Meteo nếu API key vắng hoặc OWM lỗi.
// Tách ra file riêng để dễ thêm provider mới (VNDMS, AccuWeather) trong tương lai.

import axios from 'axios';
import { WEATHER_API } from '../constants';
import { WeatherData } from '../types';

const OWM_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const WIND_MS_TO_KMH = 3.6;
const RAIN_3H_TO_24H_FACTOR = 8;
const FORECAST_DAYS = 5;
const NOON_HOUR_KEY = '12:00:00';

export type ForecastSummary = {
  date: string;
  temp: number;
  tempMin: number;
  tempMax: number;
  humidity: number;
  description: string;
  icon: string;
  windSpeed: number;
  rain: number;
};

export interface WeatherProvider {
  readonly name: string;
  isAvailable(): boolean;
  fetchCurrent(lat: number, lng: number): Promise<WeatherData>;
  fetchForecast(lat: number, lng: number): Promise<ForecastSummary[]>;
}

// ===== Open-Meteo (free, không cần API key) =====

type OpenMeteoCurrentResp = {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
    rain?: number;
    is_day?: number;
  };
};

type OpenMeteoForecastResp = {
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
  };
};

// Map weather code Open-Meteo sang format icon tương thích OWM (01d, 02n, ...).
function mapOpenMeteoCode(code: number | undefined, isDay: boolean = true) {
  const suffix = isDay ? 'd' : 'n';
  if (code === 0) return { description: 'Trời quang', icon: `01${suffix}` };
  if (code === 1 || code === 2) return { description: 'Ít mây', icon: `02${suffix}` };
  if (code === 3) return { description: 'Nhiều mây', icon: `04${suffix}` };
  if ([45, 48].includes(code ?? -1)) return { description: 'Sương mù', icon: `50${suffix}` };
  if ([51, 53, 55, 56, 57].includes(code ?? -1)) return { description: 'Mưa phùn', icon: `09${suffix}` };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code ?? -1)) return { description: 'Mưa', icon: `10${suffix}` };
  if ([71, 73, 75, 77, 85, 86].includes(code ?? -1)) return { description: 'Tuyết', icon: `13${suffix}` };
  if ([95, 96, 99].includes(code ?? -1)) return { description: 'Mưa giông', icon: `11${suffix}` };
  return { description: 'Thời tiết biến đổi', icon: `03${suffix}` };
}

export const openMeteoProvider: WeatherProvider = {
  name: 'OpenMeteo',
  isAvailable: () => true,

  async fetchCurrent(lat, lng) {
    const response = await axios.get<OpenMeteoCurrentResp>(OPEN_METEO_BASE_URL, {
      params: {
        latitude: lat,
        longitude: lng,
        current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,rain,is_day',
        timezone: 'auto',
      },
      timeout: WEATHER_API.TIMEOUT_MS,
    });
    const data = response.data;
    const code = data.current?.weather_code;
    const isDay = data.current?.is_day !== 0;
    const mapped = mapOpenMeteoCode(code, isDay);
    return {
      temp: data.current?.temperature_2m ?? 0,
      humidity: data.current?.relative_humidity_2m ?? 0,
      windSpeed: data.current?.wind_speed_10m ?? 0,
      rain1h: data.current?.rain ?? 0,
      rain24h: 0,
      description: mapped.description,
      icon: mapped.icon,
    };
  },

  async fetchForecast(lat, lng) {
    const response = await axios.get<OpenMeteoForecastResp>(OPEN_METEO_BASE_URL, {
      params: {
        latitude: lat,
        longitude: lng,
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
        timezone: 'auto',
        forecast_days: FORECAST_DAYS,
      },
      timeout: WEATHER_API.TIMEOUT_MS,
    });
    const days = response.data.daily?.time || [];
    const codes = response.data.daily?.weather_code || [];
    const tempMax = response.data.daily?.temperature_2m_max || [];
    const tempMin = response.data.daily?.temperature_2m_min || [];
    const rain = response.data.daily?.precipitation_sum || [];
    return days.slice(0, FORECAST_DAYS).map((date, index) => {
      const mapped = mapOpenMeteoCode(codes[index], true);
      const lo = tempMin[index] ?? 0;
      const hi = tempMax[index] ?? lo;
      return {
        date,
        temp: (lo + hi) / 2,
        tempMin: lo,
        tempMax: hi,
        humidity: 0,
        description: mapped.description,
        icon: mapped.icon,
        windSpeed: 0,
        rain: rain[index] ?? 0,
      };
    });
  },
};

// ===== OpenWeatherMap (chính, cần OPENWEATHER_API_KEY) =====

type OwmCurrentResp = {
  main?: { temp?: number; humidity?: number };
  wind?: { speed?: number };
  rain?: { '1h'?: number; '3h'?: number };
  weather?: Array<{ description?: string; icon?: string }>;
};

type OwmForecastItem = {
  dt_txt: string;
  main: { temp: number; temp_min: number; temp_max: number; humidity: number };
  weather: Array<{ description: string; icon: string }>;
  wind?: { speed?: number };
  rain?: { '3h'?: number };
};

type OwmForecastResp = { list: OwmForecastItem[] };

function getOwmApiKey(): string | null {
  return (
    process.env.OPENWEATHER_API_KEY
    || process.env.OWM_API_KEY
    || process.env.WEATHER_API_KEY
    || null
  );
}

export const openWeatherMapProvider: WeatherProvider = {
  name: 'OpenWeatherMap',
  isAvailable: () => Boolean(getOwmApiKey()),

  async fetchCurrent(lat, lng) {
    const apiKey = getOwmApiKey();
    if (!apiKey) throw new Error('OWM API key chưa cấu hình');
    const response = await axios.get<OwmCurrentResp>(`${OWM_BASE_URL}/weather`, {
      params: { lat, lon: lng, appid: apiKey, units: 'metric', lang: 'vi' },
      timeout: WEATHER_API.TIMEOUT_MS,
    });
    const data = response.data;
    return {
      temp: data.main?.temp ?? 0,
      humidity: data.main?.humidity ?? 0,
      windSpeed: (data.wind?.speed ?? 0) * WIND_MS_TO_KMH,
      rain1h: data.rain?.['1h'] ?? 0,
      rain24h: data.rain?.['3h'] ? data.rain['3h'] * RAIN_3H_TO_24H_FACTOR : 0,
      description: data.weather?.[0]?.description ?? '',
      icon: data.weather?.[0]?.icon ?? '01d',
    };
  },

  async fetchForecast(lat, lng) {
    const apiKey = getOwmApiKey();
    if (!apiKey) throw new Error('OWM API key chưa cấu hình');
    const response = await axios.get<OwmForecastResp>(`${OWM_BASE_URL}/forecast`, {
      params: {
        lat, lon: lng, appid: apiKey, units: 'metric', lang: 'vi',
        cnt: WEATHER_API.FORECAST_ITEM_COUNT,
      },
      timeout: WEATHER_API.TIMEOUT_MS,
    });
    const byDay = new Map<string, ForecastSummary>();
    for (const item of response.data.list) {
      const day = item.dt_txt.split(' ')[0];
      const hour = item.dt_txt.split(' ')[1];
      if (!byDay.has(day) || hour === NOON_HOUR_KEY) {
        byDay.set(day, {
          date: day,
          temp: item.main.temp,
          tempMin: item.main.temp_min,
          tempMax: item.main.temp_max,
          humidity: item.main.humidity,
          description: item.weather[0].description,
          icon: item.weather[0].icon,
          windSpeed: (item.wind?.speed ?? 0) * WIND_MS_TO_KMH,
          rain: item.rain?.['3h'] ?? 0,
        });
      }
    }
    return Array.from(byDay.values()).slice(0, FORECAST_DAYS);
  },
};
