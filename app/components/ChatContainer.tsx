'use client';

import { useState, useRef, useEffect } from 'react';
import type { Message } from '@/app/lib/types';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import LoadingDots from './LoadingDots';

// ============================================
// INTERFAZ DE CACHE
// ============================================

interface ConversationCache {
  lastCities: string[];
  weatherHistory: Array<{
    city: string;
    timestamp: number;
    type: 'current' | 'forecast';
  }>;
  userPreferences: {
    timezone?: number;
    language: string;
  };
  // 🆕 Pregunta pendiente
  pendingQuestion?: {
    type: 'city_confirmation'; // ¿Clima de X?
    city: string;
    timestamp: number;
  };
}

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '¡Hola! 👋 Soy WeatherBot, tu asistente meteorológico inteligente.\n\nPuedo ayudarte con:\n• Clima actual de cualquier ciudad\n• Pronósticos del tiempo\n• Recomendaciones según el clima\n• O simplemente conversar 😊\n\n¿En qué te puedo ayudar hoy?',
      timestamp: new Date(),
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 🆕 Cache de contexto de conversación
  const cacheRef = useRef<ConversationCache>({
    lastCities: [],
    weatherHistory: [],
    userPreferences: {
      language: 'es'
    }
  });

  // Auto-scroll al último mensaje
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Obtener geolocalización del usuario
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          console.log('Geolocation not available:', error);
        }
      );
    }
  }, []);

  // 🆕 Función para actualizar cache
  const updateCache = (weatherData?: any) => {
    if (weatherData?.city) {
      // Agregar ciudad a historial si no está
      cacheRef.current.lastCities = [
        weatherData.city,
        ...cacheRef.current.lastCities.filter(c => c !== weatherData.city)
      ].slice(0, 5); // Mantener últimas 5 ciudades

      // Agregar a historial de clima
      cacheRef.current.weatherHistory.push({
        city: weatherData.city,
        timestamp: Date.now(),
        type: weatherData.list ? 'forecast' : 'current'
      });

      // Limpiar historial antiguo (más de 1 hora)
      const oneHourAgo = Date.now() - 3600000;
      cacheRef.current.weatherHistory = cacheRef.current.weatherHistory.filter(
        item => item.timestamp > oneHourAgo
      );
    }
    
    // 🆕 Limpiar pregunta pendiente cuando se obtiene el clima
    cacheRef.current.pendingQuestion = undefined;
  };

  // 🆕 Función para guardar una pregunta pendiente
  const setPendingQuestion = (city: string) => {
    cacheRef.current.pendingQuestion = {
      type: 'city_confirmation',
      city: city,
      timestamp: Date.now()
    };
  };

  // Enviar mensaje
  const handleSendMessage = async (content: string) => {
    // Agregar mensaje del usuario
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Llamar a la API de chat
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          history: messages.slice(-15), // 🆕 Aumentado a 15 para mejor contexto
          location: userLocation,
          cache: cacheRef.current, // 🆕 Pasar cache
        }),
      });

      if (!response.ok) {
        throw new Error('Error en la respuesta del servidor');
      }

      const data = await response.json();

      // 🆕 Actualizar cache con nueva información
      if (data.weatherData) {
        updateCache(data.weatherData);
      }

      // Agregar respuesta del asistente
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        weatherData: data.weatherData,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Mensaje de error
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Lo siento, tuve un problema procesando tu mensaje. ¿Podrías intentarlo de nuevo? 🙏',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">WeatherBot</h1>
              <p className="text-xs text-slate-400">
                {isLoading ? 'Escribiendo...' : 'Asistente meteorológico con IA'}
              </p>
            </div>
          </div>
          
          {/* Location indicator */}
          {userLocation && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <span>Ubicación detectada</span>
            </div>
          )}
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start mb-4">
              <div className="flex items-start max-w-[80%]">
                <div className="mr-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                </div>
                <div className="bg-slate-700 rounded-2xl px-4 py-3">
                  <LoadingDots />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  );
}