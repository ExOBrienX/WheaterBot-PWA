'use client';

import { useState, useEffect } from 'react';
import { clearAllCache, clearExpiredCache, getCacheStats } from '@/app/lib/cache';

export default function CacheManager() {
  const [cacheStats, setCacheStats] = useState({
    locations: 0,
    weather: 0,
    forecast: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showCacheInfo, setShowCacheInfo] = useState(false);

  useEffect(() => {
    loadCacheStats();
  }, []);

  const loadCacheStats = async () => {
    try {
      const stats = await getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

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
        className="w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full shadow-lg flex items-center justify-center text-white font-bold text-xl hover:shadow-xl transition-shadow"
        title="Gestor de caché"
      >
        💾
      </button>

      {/* Panel de información */}
      {showCacheInfo && (
        <div className="absolute bottom-20 right-0 bg-slate-800 text-white rounded-lg shadow-2xl p-4 w-80 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <div className="space-y-3">
            {/* Título */}
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">📊 Gestor de Caché</h3>
              <button
                onClick={() => setShowCacheInfo(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Estadísticas */}
            <div className="bg-slate-700 rounded p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">📍 Ubicaciones:</span>
                <span className="font-semibold">{cacheStats.locations}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">🌡️ Clima Actual:</span>
                <span className="font-semibold">{cacheStats.weather}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">📈 Pronósticos:</span>
                <span className="font-semibold">{cacheStats.forecast}</span>
              </div>
              <div className="border-t border-slate-600 pt-2 mt-2 flex justify-between text-sm font-bold">
                <span>Total:</span>
                <span>{totalCached}</span>
              </div>
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
            <p className="text-xs text-gray-400 text-center">
              Usar cuando haya inconsistencias en los datos
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
