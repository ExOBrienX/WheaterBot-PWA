import type { Message, WeatherData, ForecastData } from '@/app/lib/types';

interface ChatMessageProps {
  message: Message;
}

// Helper para detectar si es WeatherData o ForecastData
function isWeatherData(data: any): data is WeatherData {
  return data && 'temp' in data && !('list' in data);
}

function isForecastData(data: any): data is ForecastData {
  return data && 'list' in data;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  // Determinar si mostrar la tarjeta:
  // - Solo si es WeatherData (clima actual)
  // - NO mostrar si es ForecastData (pronóstico de múltiples días)
  const weatherData = message.weatherData;
  const showWeatherCard = weatherData && isWeatherData(weatherData);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in`}>
      <div className={`flex items-start max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 ${isUser ? 'ml-3' : 'mr-3'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isUser 
              ? 'bg-blue-500 text-white' 
              : 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
          }`}>
            {isUser ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            )}
          </div>
        </div>

        {/* Message Content */}
        <div className={`rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-500 text-white'
            : 'bg-slate-700 text-slate-100'
        }`}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>

          {/* Weather Data Card - SOLO para clima actual (type: current) */}
          {showWeatherCard && (
            <div className="mt-3 p-3 bg-slate-800 bg-opacity-50 rounded-lg border border-slate-600">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-base">
                    {weatherData.city}, {weatherData.country}
                  </p>
                  <p className="text-xs text-slate-400 capitalize">
                    {weatherData.description}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{weatherData.temp}°C</p>
                  <p className="text-xs text-slate-400">
                    Sensación {weatherData.feels_like}°C
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                <div className="text-center">
                  <p className="text-slate-400">Humedad</p>
                  <p className="font-semibold">{weatherData.humidity}%</p>
                </div>
                <div className="text-center">
                  <p className="text-slate-400">Viento</p>
                  <p className="font-semibold">{weatherData.wind_speed} km/h</p>
                </div>
                <div className="text-center">
                  <p className="text-slate-400">Nubes</p>
                  <p className="font-semibold">{weatherData.clouds}%</p>
                </div>
              </div>
            </div>
          )}

          {/* Timestamp */}
          <p className="text-xs mt-2 opacity-60">
            {new Date(message.timestamp).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>
    </div>
  );
}