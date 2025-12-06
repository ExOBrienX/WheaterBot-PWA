// ============================================
// TIPOS PARA MENSAJES DEL CHAT
// ============================================

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  weatherData?: WeatherData | ForecastData; 
}
interface CityWithCountry {
  city: string;
  country?: string;
  fullName: string;
}
// ============================================
// TIPOS PARA DATOS DEL CLIMA
// ============================================

export interface WeatherData {
  city: string;
  country: string;
  coord: {
    lat: number;
    lon: number;
  };
  temp: number;
  feels_like: number;
  temp_min: number;
  temp_max: number;
  humidity: number;
  pressure: number;
  wind_speed: number;
  wind_deg: number;
  clouds: number;
  visibility: number;
  description: string;
  icon: string;
  sunrise: number;
  sunset: number;
  timezone: number;
  dt: number; // timestamp
}

// ============================================
// TIPOS PARA PRONÓSTICO EXTENDIDO
// ============================================

export interface ForecastData {
  city: string;
  country: string;
  list: ForecastDay[];
}

export interface ForecastDay {
  dt: number;
  temp: {
    day: number;
    night: number;
    min: number;
    max: number;
    eve: number;
    morn: number;
  };
  feels_like: {
    day: number;
    night: number;
    eve: number;
    morn: number;
  };
  pressure: number;
  humidity: number;
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  speed: number; // wind speed
  deg: number; // wind direction
  gust?: number; // wind gust
  clouds: number;
  pop: number; // probability of precipitation (0-100)
  rain?: number;
  snow?: number;
}

// ============================================
// TIPOS PARA RESPUESTAS DE LA API
// ============================================

export interface ChatAPIRequest {
  message: string;
  history: Message[];
  location?: {
    lat: number;
    lon: number;
  };
  cache?: {
    lastCities: string[];
    weatherHistory: Array<{
      city: string;
      timestamp: number;
      type: 'current' | 'forecast';
      forecastType?: 'day' | 'week' | 'week-future'; // 🆕 Para diferenciar pronósticos
    }>;
    userPreferences?: {
      timezone?: number;
      language?: string;
    };
    // 🆕 Pregunta pendiente
    pendingQuestion?: {
      type: 'city_confirmation';
      city: string;
      timestamp: number;
    };
  };
}

export interface ChatAPIResponse {
  message: string;
  needsWeather?: boolean;
  weatherData?: WeatherData;
  error?: string;
}

export interface WeatherAPIRequest {
  city?: string;
  lat?: number;
  lon?: number;
  type?: 'current' | 'forecast';
  days?: number;
  startFrom?: number;  // ← AGREGAR ESTA LÍNEA

}

export interface WeatherAPIResponse {
  success: boolean;
  data?: WeatherData | ForecastData;
  error?: string;
}

// ============================================
// TIPOS PARA WEATHERAPI.COM
// ============================================

export interface WeatherAPICurrentResponse {
  location: {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    tz_id: string;
    localtime: string;
  };
  current: {
    temp_c: number;
    condition: {
      text: string;
      icon: string;
      code: number;
    };
    wind_kph: number;
    wind_degree: number;
    pressure_mb: number;
    humidity: number;
    cloud: number;
    feelslike_c: number;
    vis_km: number;
    uv: number;
  };
}

export interface WeatherAPIForecastResponse {
  location: {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
  };
  current: {
    temp_c: number;
    condition: {
      text: string;
      icon: string;
    };
    humidity: number;
    wind_kph: number;
    feelslike_c: number;
  };
  forecast: {
    forecastday: Array<{
      date: string;
      date_epoch: number;
      day: {
        maxtemp_c: number;
        mintemp_c: number;
        avgtemp_c: number;
        maxwind_kph: number;
        totalprecip_mm: number;
        avgvis_km: number;
        avghumidity: number;
        daily_chance_of_rain: number;
        condition: {
          text: string;
          icon: string;
          code: number;
        };
      };
      astro: {
        sunrise: string;
        sunset: string;
      };
      hour: Array<{
        time: string;
        time_epoch: number;
        temp_c: number;
        condition: {
          text: string;
          icon: string;
        };
        wind_kph: number;
        humidity: number;
        feelslike_c: number;
        chance_of_rain: number;
      }>;
    }>;
  };
}

// ============================================
// TIPOS PARA GEOLOCALIZACIÓN
// ============================================

export interface GeolocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface GeolocationPosition {
  coords: GeolocationCoords;
  timestamp: number;
}

// ============================================
// TIPOS AUXILIARES
// ============================================

export type WeatherCondition = 
  | 'clear'
  | 'clouds'
  | 'rain'
  | 'drizzle'
  | 'thunderstorm'
  | 'snow'
  | 'mist'
  | 'fog'
  | 'haze';

export interface WeatherIconMap {
  [key: string]: string;
}

// ============================================
// TIPOS PARA CACHÉ LOCAL (IndexedDB)
// ============================================

export interface CachedLocation {
  id: string; // "city,country" - clave compuesta
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timestamp: number; // cuándo se guardó
  lastQueried: number; // última consulta
}

export interface CachedWeather {
  id: string; // "city,country,date" - clave compuesta
  city: string;
  country: string;
  date: string; // YYYY-MM-DD
  weatherData: WeatherData;
  timestamp: number;
  expiresAt: number; // cuándo expira (24 horas después)
}

export interface CachedForecast {
  id: string; // "city,country,startDate" - clave compuesta
  city: string;
  country: string;
  startDate: string; // YYYY-MM-DD
  forecastData: ForecastData;
  timestamp: number;
  expiresAt: number; // cuándo expira (6 horas después)
}