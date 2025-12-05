import { NextRequest, NextResponse } from 'next/server';
import type { 
  WeatherAPIRequest, 
  WeatherAPIResponse, 
  WeatherData,
  ForecastData
} from '@/app/lib/types';
// Nota: El caché se gestiona desde el cliente (IndexedDB)
// Este servidor solo registra logs para debugging

// URLs de Open-Meteo (sin API key necesaria!)
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

// ============================================
// MAPEO DE CÓDIGOS METEOROLÓGICOS
// ============================================

const WEATHER_CODES: { [key: number]: { es: string, icon: string } } = {
  0: { es: 'Despejado', icon: '01d' },
  1: { es: 'Mayormente despejado', icon: '02d' },
  2: { es: 'Parcialmente nublado', icon: '03d' },
  3: { es: 'Nublado', icon: '04d' },
  45: { es: 'Niebla', icon: '50d' },
  48: { es: 'Niebla con escarcha', icon: '50d' },
  51: { es: 'Llovizna ligera', icon: '09d' },
  53: { es: 'Llovizna moderada', icon: '09d' },
  55: { es: 'Llovizna densa', icon: '09d' },
  61: { es: 'Lluvia ligera', icon: '10d' },
  63: { es: 'Lluvia moderada', icon: '10d' },
  65: { es: 'Lluvia intensa', icon: '10d' },
  71: { es: 'Nevada ligera', icon: '13d' },
  73: { es: 'Nevada moderada', icon: '13d' },
  75: { es: 'Nevada intensa', icon: '13d' },
  77: { es: 'Granizo', icon: '13d' },
  80: { es: 'Chubascos ligeros', icon: '09d' },
  81: { es: 'Chubascos moderados', icon: '09d' },
  82: { es: 'Chubascos violentos', icon: '09d' },
  85: { es: 'Nevada ligera', icon: '13d' },
  86: { es: 'Nevada intensa', icon: '13d' },
  95: { es: 'Tormenta', icon: '11d' },
  96: { es: 'Tormenta con granizo ligero', icon: '11d' },
  99: { es: 'Tormenta con granizo intenso', icon: '11d' }
};

function getWeatherDescription(code: number): { es: string, icon: string } {
  return WEATHER_CODES[code] || { es: 'Desconocido', icon: '01d' };
}

// ============================================
// HANDLER PRINCIPAL
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body: WeatherAPIRequest = await request.json();
    const { city, lat, lon, type = 'current', days = 7, startFrom = 0 } = body;

    // Si no tenemos coordenadas, buscarlas por ciudad
    let finalLat = lat;
    let finalLon = lon;
    let cityName = city;
    let countryName = '';

    if (!finalLat || !finalLon) {
      if (!city) {
        return NextResponse.json<WeatherAPIResponse>(
          { success: false, error: 'Debes proporcionar una ciudad o coordenadas' },
          { status: 400 }
        );
      }

      // Obtener coordenadas mediante geocoding
      const geocode = await getCoordinates(city);
      if (!geocode) {
        return NextResponse.json<WeatherAPIResponse>(
          { 
            success: false, 
            error: `No se encontró la ciudad "${city}". Intenta con "Ciudad, País"` 
          },
          { status: 404 }
        );
      }

      finalLat = geocode.latitude;
      finalLon = geocode.longitude;
      cityName = geocode.name;
      countryName = geocode.country;
    }

    // Obtener datos del clima
    if (type === 'forecast') {
      // SIEMPRE obtener 7 días completos de la API
      const fullForecast = await getForecast(finalLat, finalLon, cityName || city || '', countryName, 7);
      
      // Filtrar según cuántos días se pidieron
      // days = 1 significa solo mañana (índice 1)
      // days = 2 significa hoy y mañana (índices 0, 1)
      // days = 7 significa toda la semana
      
      const filteredForecast: ForecastData = {
        ...fullForecast,
        list: fullForecast.list.slice(startFrom, startFrom + days)
      };
      
      // ✅ LOG: Indicar que el pronóstico debería guardarse en caché desde el cliente
      console.log(`💾 [Cliente debe guardar] Pronóstico para ${fullForecast.city}, ${fullForecast.country} en IndexedDB (6 horas expiry)`);
      
      return NextResponse.json<WeatherAPIResponse>({ 
        success: true, 
        data: filteredForecast 
      });
    } else {
      const weatherData = await getCurrentWeather(finalLat, finalLon, cityName || city || '', countryName);
      
      // ✅ LOG: Indicar que el clima actual debería guardarse en caché desde el cliente
      console.log(`💾 [Cliente debe guardar] Clima actual para ${weatherData.city}, ${weatherData.country} en IndexedDB (24 horas expiry)`);
      
      return NextResponse.json<WeatherAPIResponse>({ success: true, data: weatherData });
    }

  } catch (error) {
    console.error('Error en weather API:', error);
    return NextResponse.json<WeatherAPIResponse>(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error al obtener el clima' 
      },
      { status: 500 }
    );
  }
}

// ============================================
// GEOCODING: Obtener coordenadas de ciudad
// ============================================

async function getCoordinates(city: string): Promise<{ 
  latitude: number; 
  longitude: number; 
  name: string; 
  country: string 
} | null> {
  const url = `${GEOCODING_URL}?name=${encodeURIComponent(city)}&count=10&language=es&format=json`;
  
  console.log(`🔍 Buscando coordenadas de: ${city}`);

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  
  if (!data.results || data.results.length === 0) {
    console.log(`❌ No se encontraron resultados para: ${city}`);
    return null;
  }

  // Retornar el primer resultado (más probable por población)
  // pero registrar todos los resultados para análisis
  const result = data.results[0];
  
  console.log(`✅ Encontrado: ${result.name}, ${result.country} (${result.latitude}, ${result.longitude})`);
  
  // Log de alternativas (para debug)
  if (data.results.length > 1) {
    console.log(`📍 Alternativas encontradas:`);
    data.results.slice(0, 5).forEach((r: any, i: number) => {
      console.log(`   ${i + 1}. ${r.name}, ${r.country} (${r.latitude}, ${r.longitude})`);
    });
  }

  return {
    latitude: result.latitude,
    longitude: result.longitude,
    name: result.name,
    country: result.country
  };
}

// ============================================
// OBTENER CLIMA ACTUAL
// ============================================

async function getCurrentWeather(
  lat: number,
  lon: number,
  city: string,
  country: string
): Promise<WeatherData> {
  
  const url = `${WEATHER_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m&timezone=auto`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Error al obtener datos del clima');
  }

  const data = await response.json();
  const current = data.current;

  const weatherInfo = getWeatherDescription(current.weather_code);

  const weatherData: WeatherData = {
    city: city,
    country: country,
    coord: { lat, lon },
    temp: Math.round(current.temperature_2m),
    feels_like: Math.round(current.apparent_temperature),
    temp_min: Math.round(current.temperature_2m),
    temp_max: Math.round(current.temperature_2m),
    humidity: current.relative_humidity_2m,
    pressure: Math.round(current.pressure_msl),
    wind_speed: Math.round(current.wind_speed_10m),
    wind_deg: current.wind_direction_10m,
    clouds: current.cloud_cover,
    visibility: 10000,
    description: weatherInfo.es,
    icon: weatherInfo.icon,
    sunrise: 0,
    sunset: 0,
    timezone: 0,
    dt: Math.floor(Date.now() / 1000)
  };

  return weatherData;
}

// ============================================
// OBTENER PRONÓSTICO
// ============================================

async function getForecast(
  lat: number,
  lon: number,
  city: string,
  country: string,
  days: number = 7
): Promise<ForecastData> {
  
  const url = `${WEATHER_URL}?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto&forecast_days=${days}`;

  console.log('\n🌤️ Obteniendo pronóstico de Open-Meteo...');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Error al obtener pronóstico');
  }

  const data = await response.json();

  // LOG DETALLADO
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              DATOS DE OPEN-METEO (GRATIS - SIN LÍMITES)       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`Ciudad: ${city}, ${country}`);
  console.log(`Coordenadas: ${lat}, ${lon}`);
  console.log(`Total de días: ${data.daily.time.length}`);
  console.log('');

  // Procesar cada día
  const forecastList = data.daily.time.map((date: string, index: number) => {
    // Parsear correctamente la fecha YYYY-MM-DD
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day); // month - 1 porque enero es 0
    
    const dayName = dateObj.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });

    const minTemp = Math.round(data.daily.temperature_2m_min[index]);
    const maxTemp = Math.round(data.daily.temperature_2m_max[index]);
    const weatherCode = data.daily.weather_code[index];
    const weatherInfo = getWeatherDescription(weatherCode);
    const precipProb = data.daily.precipitation_probability_max[index];
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📅 ${dayName.toUpperCase()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Min: ${minTemp}°C | Max: ${maxTemp}°C`);
    console.log(`  ${weatherInfo.es}`);
    console.log(`  Prob. lluvia: ${precipProb}%`);
    console.log('');

    // Obtener temperaturas por período del día de los datos horarios
    const dayStart = index * 24;
    const hourlyTemps = data.hourly.temperature_2m.slice(dayStart, dayStart + 24);
    
    const mornTemp = Math.round((hourlyTemps[6] + hourlyTemps[9]) / 2) || minTemp;
    const dayTemp = Math.round(Math.max(hourlyTemps[12], hourlyTemps[15])) || maxTemp;
    const eveTemp = Math.round(Math.max(hourlyTemps[18], hourlyTemps[21])) || Math.round((maxTemp + minTemp) / 2);
    const nightTemp = Math.round(Math.min(hourlyTemps[0], hourlyTemps[3])) || minTemp;

    console.log(`  📊 Temperaturas por período:`);
    console.log(`     Mañana: ${mornTemp}°C | Tarde: ${dayTemp}°C | Noche: ${eveTemp}°C | Madrugada: ${nightTemp}°C`);
    console.log('');

    return {
      dt: Math.floor(dateObj.getTime() / 1000),
      temp: {
        day: dayTemp,
        night: nightTemp,
        min: minTemp,
        max: maxTemp,
        eve: eveTemp,
        morn: mornTemp
      },
      feels_like: {
        day: dayTemp,
        night: nightTemp,
        eve: eveTemp,
        morn: mornTemp
      },
      pressure: 1013,
      humidity: 50,
      weather: [{
        id: weatherCode,
        main: weatherInfo.es,
        description: weatherInfo.es,
        icon: weatherInfo.icon
      }],
      speed: Math.round(data.daily.wind_speed_10m_max[index]),
      deg: data.daily.wind_direction_10m_dominant[index],
      clouds: 0,
      pop: precipProb,
      rain: data.daily.precipitation_sum[index],
      snow: 0
    };
  });

  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  return {
    city,
    country,
    list: forecastList
  };
}

// ============================================
// ENDPOINT GET
// ============================================

export async function GET() {
  return NextResponse.json({
    message: 'Weather API funcionando con Open-Meteo',
    provider: 'Open-Meteo (100% gratis, sin límites)',
    features: [
      'No requiere API key',
      'Pronóstico hasta 7 días',
      'Cobertura mundial excelente',
      'Sin límites de uso'
    ],
    endpoints: {
      POST: {
        description: 'Obtener datos del clima',
        body: {
          city: 'string (nombre de ciudad)',
          lat: 'number (coordenadas - opcional)',
          lon: 'number (coordenadas - opcional)',
          type: "'current' | 'forecast'",
          days: 'number (1-7, default: 7)'
        }
      }
    }
  });
}