import type { CachedLocation, CachedWeather, CachedForecast, WeatherData, ForecastData } from './types';

const DB_NAME = 'WeatherBotCache';
const DB_VERSION = 1;
const LOCATIONS_STORE = 'locations';
const WEATHER_STORE = 'weather';
const FORECAST_STORE = 'forecast';

// ============================================
// INICIALIZAR BASE DE DATOS
// ============================================

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Crear stores si no existen
      if (!db.objectStoreNames.contains(LOCATIONS_STORE)) {
        const locStore = db.createObjectStore(LOCATIONS_STORE, { keyPath: 'id' });
        locStore.createIndex('city', 'city', { unique: false });
        locStore.createIndex('country', 'country', { unique: false });
      }

      if (!db.objectStoreNames.contains(WEATHER_STORE)) {
        const weatherStore = db.createObjectStore(WEATHER_STORE, { keyPath: 'id' });
        weatherStore.createIndex('city_country', ['city', 'country'], { unique: false });
        weatherStore.createIndex('expiresAt', 'expiresAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(FORECAST_STORE)) {
        const forecastStore = db.createObjectStore(FORECAST_STORE, { keyPath: 'id' });
        forecastStore.createIndex('city_country', ['city', 'country'], { unique: false });
        forecastStore.createIndex('expiresAt', 'expiresAt', { unique: false });
      }
    };
  });
}

// ============================================
// OPERACIONES CON UBICACIONES
// ============================================

export async function cacheLocation(city: string, country: string, lat: number, lon: number): Promise<void> {
  try {
    const db = await getDB();
    const location: CachedLocation = {
      id: `${city},${country}`,
      city,
      country,
      latitude: lat,
      longitude: lon,
      timestamp: Date.now(),
      lastQueried: Date.now()
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(LOCATIONS_STORE, 'readwrite');
      tx.objectStore(LOCATIONS_STORE).put(location);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Error cacheando ubicación:', error);
  }
}

export async function getCachedLocation(city: string, country?: string): Promise<CachedLocation | null> {
  try {
    const db = await getDB();
    const query = country ? `${city},${country}` : city;
    
    const tx = db.transaction(LOCATIONS_STORE, 'readonly');
    const store = tx.objectStore(LOCATIONS_STORE);
    
    if (country) {
      const request = store.get(query);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } else {
      // Buscar por ciudad usando índice
      const index = store.index('city');
      const request = index.getAll(city);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve((request.result || [])[0] || null);
        request.onerror = () => reject(request.error);
      });
    }
  } catch (error) {
    console.error('Error obteniendo ubicación cacheada:', error);
    return null;
  }
}

// ============================================
// OPERACIONES CON CLIMA ACTUAL
// ============================================

export async function cacheWeather(city: string, country: string, date: string, weatherData: WeatherData): Promise<void> {
  try {
    const db = await getDB();
    const cached: CachedWeather = {
      id: `${city},${country},${date}`,
      city,
      country,
      date,
      weatherData,
      timestamp: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(WEATHER_STORE, 'readwrite');
      tx.objectStore(WEATHER_STORE).put(cached);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Error cacheando clima:', error);
  }
}

export async function getCachedWeather(city: string, country: string, date: string): Promise<WeatherData | null> {
  try {
    const db = await getDB();
    const id = `${city},${country},${date}`;
    
    const tx = db.transaction(WEATHER_STORE, 'readonly');
    const request = tx.objectStore(WEATHER_STORE).get(id);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const cached = request.result as CachedWeather | undefined;
        if (cached && cached.expiresAt > Date.now()) {
          resolve(cached.weatherData);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error obteniendo clima cacheado:', error);
    return null;
  }
}

// ============================================
// OPERACIONES CON PRONÓSTICO
// ============================================

export async function cacheForecast(city: string, country: string, startDate: string, forecastData: ForecastData): Promise<void> {
  try {
    const db = await getDB();
    const cached: CachedForecast = {
      id: `${city},${country},${startDate}`,
      city,
      country,
      startDate,
      forecastData,
      timestamp: Date.now(),
      expiresAt: Date.now() + 6 * 60 * 60 * 1000 // 6 horas
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(FORECAST_STORE, 'readwrite');
      tx.objectStore(FORECAST_STORE).put(cached);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Error cacheando pronóstico:', error);
  }
}

export async function getCachedForecast(city: string, country: string, startDate: string): Promise<ForecastData | null> {
  try {
    const db = await getDB();
    const id = `${city},${country},${startDate}`;
    
    const tx = db.transaction(FORECAST_STORE, 'readonly');
    const request = tx.objectStore(FORECAST_STORE).get(id);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const cached = request.result as CachedForecast | undefined;
        if (cached && cached.expiresAt > Date.now()) {
          resolve(cached.forecastData);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error obteniendo pronóstico cacheado:', error);
    return null;
  }
}

// ============================================
// LIMPIAR CACHÉ
// ============================================

export async function clearAllCache(): Promise<void> {
  try {
    const db = await getDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction([LOCATIONS_STORE, WEATHER_STORE, FORECAST_STORE], 'readwrite');
      tx.objectStore(LOCATIONS_STORE).clear();
      tx.objectStore(WEATHER_STORE).clear();
      tx.objectStore(FORECAST_STORE).clear();
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Error limpiando caché:', error);
  }
}

export async function clearExpiredCache(): Promise<void> {
  try {
    const db = await getDB();
    const now = Date.now();

    // Limpiar clima expirado
    const weatherTx = db.transaction(WEATHER_STORE, 'readwrite');
    const weatherStore = weatherTx.objectStore(WEATHER_STORE);
    const weatherIndex = weatherStore.index('expiresAt');
    const weatherRange = IDBKeyRange.upperBound(now);
    
    const weatherRequest = weatherIndex.openCursor(weatherRange);
    weatherRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    // Limpiar pronóstico expirado
    const forecastTx = db.transaction(FORECAST_STORE, 'readwrite');
    const forecastStore = forecastTx.objectStore(FORECAST_STORE);
    const forecastIndex = forecastStore.index('expiresAt');
    const forecastRange = IDBKeyRange.upperBound(now);
    
    const forecastRequest = forecastIndex.openCursor(forecastRange);
    forecastRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  } catch (error) {
    console.error('Error limpiando caché expirado:', error);
  }
}

export async function getCacheStats(): Promise<{
  locations: number;
  weather: number;
  forecast: number;
}> {
  try {
    const db = await getDB();

    const countLocations = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(LOCATIONS_STORE, 'readonly');
      const request = tx.objectStore(LOCATIONS_STORE).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const countWeather = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(WEATHER_STORE, 'readonly');
      const request = tx.objectStore(WEATHER_STORE).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const countForecast = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(FORECAST_STORE, 'readonly');
      const request = tx.objectStore(FORECAST_STORE).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return {
      locations: countLocations,
      weather: countWeather,
      forecast: countForecast
    };
  } catch (error) {
    console.error('Error obteniendo estadísticas de caché:', error);
    return { locations: 0, weather: 0, forecast: 0 };
  }
}
