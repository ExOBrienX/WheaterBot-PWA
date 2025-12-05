'use client';

import { useState, useEffect, useCallback } from 'react';
import { clearAllCache, clearExpiredCache, getCacheStats } from '@/app/lib/cache';
import { cacheLocation } from '@/app/lib/cache';

export default function CacheManager() {
  const [cacheStats, setCacheStats] = useState({
    locations: 0,
    weather: 0,
    forecast: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showCacheInfo, setShowCacheInfo] = useState(false);
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lon: number; city?: string } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Cargar estadísticas del cache
  const loadCacheStats = useCallback(async () => {
    try {
      const stats = await getCacheStats();
      setCacheStats(stats);
      console.log('📊 Estadísticas de cache actualizadas:', stats);
    } catch (error) {
      console.error('❌ Error cargando estadísticas:', error);
    }
  }, []);

  // Auto-refresh cada 2 segundos cuando el panel está abierto
  useEffect(() => {
    if (!showCacheInfo || !autoRefresh) return;

    const interval = setInterval(() => {
      loadCacheStats();
    }, 2000);

    return () => clearInterval(interval);
  }, [showCacheInfo, autoRefresh, loadCacheStats]);

  // Cargar al abrir el panel
  useEffect(() => {
    if (showCacheInfo) {
      loadCacheStats();
    }
  }, [showCacheInfo, loadCacheStats]);

  // Solicitar geolocalización
  const requestGeolocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      console.error('❌ Geolocalización no soportada');
      return;
    }

    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        console.log(`📍 Ubicación obtenida: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        
        // Intentar obtener nombre de la ciudad con Nominatim (reverse geocoding)
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          const city = data.address?.city || data.address?.town || data.address?.village || 'Ubicación desconocida';
          const country = data.address?.country || 'Desconocido';
          
          console.log(`🏙️ Ciudad detectada: ${city}, ${country}`);
          
          setGeoLocation({ lat: latitude, lon: longitude, city: `${city}, ${country}` });
          setGeoStatus('success');
          
          // Guardar en cache
          await cacheLocation(city, country, latitude, longitude);
          await loadCacheStats();
        } catch (error) {
          console.error('❌ Error obteniendo ciudad:', error);
          setGeoLocation({ lat: latitude, lon: longitude });
          setGeoStatus('success');
        }
      },
      (error) => {
        console.error('❌ Error de geolocalización:', error.message);
        setGeoStatus('error');
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 0
      }
    );
  }, [loadCacheStats]);

  const handleClearAll = async () => {
    if (confirm('⚠️ ¿Estás seguro que deseas borrar TODO el caché? Esto puede afectar el rendimiento.')) {
      try {
        setIsLoading(true);
        await clearAllCache();
        await loadCacheStats();
        alert('✅ Caché borrado exitosamente');
      } catch (error) {
        console.error('Error borrando caché:', error);
        alert('❌ Error al borrar el caché');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleClearExpired = async () => {
    try {
      setIsLoading(true);
      await clearExpiredCache();
      await loadCacheStats();
      alert('✅ Caché expirado borrado exitosamente');
    } catch (error) {
      console.error('Error borrando caché expirado:', error);
      alert('❌ Error al borrar el caché expirado');
    } finally {
      setIsLoading(false);
    }
  };

  const totalCached = cacheStats.locations + cacheStats.weather + cacheStats.forecast;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Botón flotante */}
      <button
        onClick={() => setShowCacheInfo(!showCacheInfo)}
        className="w-14 h-14 bg-linear-to-br from-purple-500 to-blue-500 rounded-full shadow-lg flex items-center justify-center text-white font-bold text-xl hover:shadow-xl transition-shadow"
        title="Gestor de caché"
      >
        💾
      </button>

      {/* Panel de información */}
      {showCacheInfo && (
        <div className="absolute bottom-20 right-0 bg-slate-800 text-white rounded-lg shadow-2xl p-4 w-96 border border-slate-700 animate-in fade-in slide-in-from-bottom-2 max-h-96 overflow-y-auto">
          <div className="space-y-3">
            {/* Título */}
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">📊 Gestor de Caché</h3>
              <button
                onClick={() => setShowCacheInfo(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            {/* Auto-refresh toggle */}
            <div className="bg-slate-700 rounded p-2 flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>🔄 Auto-actualizar (2s)</span>
              </label>
              <button
                onClick={loadCacheStats}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium"
              >
                ↻ Ahora
              </button>
            </div>

            {/* Estadísticas */}
            <div className="bg-slate-700 rounded p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">📍 Ubicaciones:</span>
                <span className="font-semibold text-green-400">{cacheStats.locations}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">🌡️ Clima Actual:</span>
                <span className="font-semibold text-orange-400">{cacheStats.weather}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">📈 Pronósticos:</span>
                <span className="font-semibold text-cyan-400">{cacheStats.forecast}</span>
              </div>
              <div className="border-t border-slate-600 pt-2 mt-2 flex justify-between text-sm font-bold">
                <span>Total:</span>
                <span className="text-purple-400">{totalCached}</span>
              </div>
            </div>

            {/* Geolocalización */}
            <div className="bg-green-900/30 border border-green-700 rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-green-300">📍 Ubicación Actual</span>
                {geoStatus === 'loading' && <span className="text-xs text-gray-300">⏳ Detectando...</span>}
                {geoStatus === 'success' && <span className="text-xs text-green-300">✅ Obtenida</span>}
                {geoStatus === 'error' && <span className="text-xs text-red-300">❌ Error</span>}
              </div>
              
              {geoLocation ? (
                <div className="text-xs text-gray-200 space-y-1">
                  <p>🗺️ Coordenadas: {geoLocation.lat.toFixed(4)}°, {geoLocation.lon.toFixed(4)}°</p>
                  {geoLocation.city && <p>🏙️ Ciudad: {geoLocation.city}</p>}
                </div>
              ) : (
                <p className="text-xs text-gray-300">Sin ubicación detectada</p>
              )}
              
              <button
                onClick={requestGeolocation}
                disabled={geoStatus === 'loading' || isLoading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-1 px-2 rounded text-xs font-medium transition-colors mt-2"
              >
                {geoStatus === 'loading' ? '⏳ Detectando...' : '📍 Detectar Ubicación'}
              </button>
              
              <p className="text-xs text-gray-400">
                💡 Esto ayuda a resolver ciudades ambiguas automáticamente
              </p>
            </div>

            {/* Información de expiración */}
            <div className="bg-blue-900/30 border border-blue-700 rounded p-2 text-xs text-blue-200">
              <p>⏱️ <strong>Expiración automática:</strong></p>
              <p>• Ubicaciones: No expiran</p>
              <p>• Clima actual: 24 horas</p>
              <p>• Pronósticos: 6 horas</p>
            </div>

            {/* Botones de acción */}
            <div className="space-y-2">
              <button
                onClick={handleClearExpired}
                disabled={isLoading}
                className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
              >
                {isLoading ? '⏳ Limpiando...' : '🗑️ Limpiar Expirado'}
              </button>
              <button
                onClick={handleClearAll}
                disabled={isLoading}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
              >
                {isLoading ? '⏳ Limpiando...' : '🗑️ Limpiar TODO'}
              </button>
            </div>

            {/* Footer */}
            <p className="text-xs text-gray-400 text-center border-t border-slate-600 pt-2">
              Usar para resolver problemas de inconsistencia
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
