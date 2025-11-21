import { NextRequest, NextResponse } from 'next/server';
import type { 
  ChatAPIRequest, 
  ChatAPIResponse, 
  Message,
  WeatherData,
  ForecastData 
} from '@/app/lib/types';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ============================================
// SYSTEM PROMPT MEJORADO
// ============================================

function getSystemPrompt(): string {
  const now = new Date();
  const hoy = now.getDay();
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  
  const fechaActual = now.toLocaleDateString('es-ES', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  const tablaCalculos = dias.map((dia, targetDay) => {
    let diasHasta = (targetDay - hoy + 7) % 7;
    if (diasHasta === 0) diasHasta = 0;
    return `  ${dia.padEnd(10)} → start_from: ${diasHasta}`;
  }).join('\n');

  return `Eres WeatherBot, un asistente meteorológico conversacional y útil.

╔══════════════════════════════════════════════════════════════╗
║  CONTEXTO ACTUAL                                             ║
╚══════════════════════════════════════════════════════════════╝

📅 HOY ES: ${fechaActual} (día ${hoy} de la semana)

TABLA PARA ESTA SEMANA (HOY = ${dias[hoy].toUpperCase()}):
${tablaCalculos}

╔══════════════════════════════════════════════════════════════╗
║  REGLAS DE INTERPRETACIÓN                                    ║
╚══════════════════════════════════════════════════════════════╝

✅ GENERA JSON cuando el usuario EXPLÍCITAMENTE pide clima:
   • "clima de/para/del [día/ciudad]"
   • "qué tiempo hace/hará"
   • "dame el clima"
   • "me puedes dar el clima"
   • "para el próximo [día]"
   • "clima del [día]"

❌ NO GENERES JSON para preguntas SOBRE tus capacidades:
   • "hasta qué día puedes decirme"
   • "cuántos días puedes mostrar"
   • "qué días puedes dar"
   
   → Para estas, responde conversacionalmente: "Puedo darte el pronóstico de los próximos 7 días"

🎯 CASOS ESPECIALES - PLANES + CLIMA:
   Si el usuario menciona planes Y pide clima en el MISMO mensaje:
   • Ejemplo: "mañana tengo una cita, me das el clima"
   • Ejemplo: "el lunes voy al parque, cómo estará el tiempo"
   
   → SIEMPRE genera JSON para buscar el clima

📋 FORMATO DE RESPUESTA:

🔹 NUNCA menciones JSON al usuario
🔹 NUNCA digas "formato JSON" o "te dejo la información en formato JSON"
🔹 El JSON es SOLO para el sistema, el usuario NO lo ve

🔹 CLIMA ACTUAL:
{"needs_weather":true,"city":"ciudad","type":"current"}

🔹 PRONÓSTICO DÍA ESPECÍFICO:
{"needs_weather":true,"city":"ciudad","type":"forecast","days_count":1,"start_from":N}

🔹 PRONÓSTICO MÚLTIPLES DÍAS:
{"needs_weather":true,"city":"ciudad","type":"forecast","days_count":N,"start_from":0}

PERSONALIDAD:
- Natural y conversacional
- Reconoce cuando el usuario pide clima aunque mencione otras cosas
- Nunca sugieras buscar en internet, TÚ tienes el clima
- Nunca menciones JSON al usuario`;
}

// ============================================
// VALIDADORES MEJORADOS
// ============================================

interface WeatherRequest {
  needs_weather: boolean;
  city: string;
  type: 'current' | 'forecast';
  days_count?: number;
  start_from?: number;
}

function esRespuestaCasual(mensaje: string): boolean {
  const mensajeLower = mensaje.toLowerCase().trim();
  
  // Si menciona clima explícitamente, NO es casual
  const mencionaClima = /\b(clima|tiempo|temperatura|pronóstico)\b/.test(mensajeLower);
  if (mencionaClima) return false;
  
  // Respuestas simples sin contexto de clima
  const respuestasCasuales = [
    /^(si|sí|ok|vale|claro|perfecto|genial|bien|bueno|dale)$/,
    /^(gracias|muchas gracias|excelente)$/,
    /^no,?\s+(gracias|nada|eso es todo)/
  ];
  
  return respuestasCasuales.some(pattern => pattern.test(mensajeLower));
}

function esSolicitudClimaValida(mensaje: string): boolean {
  const mensajeLower = mensaje.toLowerCase();
  
  // Si es respuesta casual pura, NO
  if (esRespuestaCasual(mensaje)) {
    console.log('🚫 Respuesta casual pura');
    return false;
  }
  
  // ❌ PREGUNTAS META (sobre el bot, no sobre clima real)
  const preguntasMeta = [
    /hasta (qué|que) (día|dias)/i,
    /cuántos días/i,
    /qué días puedes/i,
    /puedes (decirme|darme|mostrar)/i,
    /cuál es (tu|el) (límite|rango)/i
  ];
  
  const esPreguntaMeta = preguntasMeta.some(pattern => pattern.test(mensaje));
  if (esPreguntaMeta) {
    console.log('ℹ️ Pregunta META sobre capacidades del bot');
    return false; // No buscar clima, solo responder conversacionalmente
  }
  
  // Keywords FUERTES que confirman petición de clima REAL
  const keywordsClima = [
    'clima', 'tiempo', 'temperatura', 'pronóstico', 'forecast',
    'va a llover', 'llover', 'lluvia', 'hace calor', 'hace frío',
    'qué tiempo', 'cómo está el', 'dame el clima', 'quiero saber el',
    'me das el clima', 'me puedes dar', 'dime el clima', 'cómo estará',
    'me das el', 'puedes darme el clima', 'dime cómo está'
  ];
  
  // Detectar referencias temporales específicas (días de la semana, "próximo", etc)
  const referenciasTemporales = [
    /próximo (lunes|martes|miércoles|miércoles|jueves|viernes|sábado|sabado|domingo)/i,
    /para el (lunes|martes|miércoles|miércoles|jueves|viernes|sábado|sabado|domingo)/i,
    /el próximo (lunes|martes|miércoles|miércoles|jueves|viernes|sábado|sabado|domingo)/i,
    /clima del? (lunes|martes|miércoles|miércoles|jueves|viernes|sábado|sabado|domingo)/i
  ];
  
  const tieneReferenciaTemp = referenciasTemporales.some(pattern => pattern.test(mensaje));
  const tieneKeywordClima = keywordsClima.some(kw => mensajeLower.includes(kw));
  
  // Si tiene día específico mencionado (próximo viernes, para el lunes, etc)
  if (tieneReferenciaTemp) {
    console.log('✅ Referencia temporal detectada (próximo viernes, etc)');
    return true;
  }
  
  // Si menciona clima explícitamente → VÁLIDO
  if (tieneKeywordClima) {
    console.log('✅ Petición de clima detectada');
    return true;
  }
  
  // Si no menciona clima, NO buscar
  console.log('❌ No es petición de clima');
  return false;
}

function sonConsultasIguales(prev: any, current: WeatherRequest): boolean {
  if (!prev) return false;
  
  const prevCity = prev.city?.toLowerCase() || '';
  const currentCity = current.city.toLowerCase();
  
  if (prevCity !== currentCity) return false;
  
  const prevStartFrom = prev.startFrom ?? 0;
  const currentStartFrom = current.start_from ?? 0;
  
  const prevType = 'list' in prev ? 'forecast' : 'current';
  const currentType = current.type;
  
  if (prevType !== currentType) return false;
  
  if (currentType === 'forecast') {
    const prevDays = prev.requestedDays || prev.list?.length || 7;
    const currentDays = current.days_count || 7;
    
    return prevStartFrom === currentStartFrom && prevDays === currentDays;
  }
  
  return true;
}

// ============================================
// GENERADOR DE SUGERENCIAS CONTEXTUALES
// ============================================

function generarSugerenciasContextuales(
  tipo: 'current' | 'forecast',
  daysCount: number,
  startFrom: number,
  city: string
): string[] {
  const now = new Date();
  const hoy = now.getDay();
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  
  const sugerencias: string[] = [];
  const random = Math.random();
  
  if (tipo === 'current') {
    // Sugerencias para clima actual
    const opciones = [
      [`¿Y mañana?`, `¿Necesitas algo más?`],
      [`¿Quieres el pronóstico de la semana?`, `¿Te ayudo con otra ciudad?`],
      [`¿Cómo estará el fin de semana?`, `¿Necesitas planear algo?`],
      [`¿Y el ${dias[(hoy + 1) % 7]}?`, `¿Algo más?`]
    ];
    return opciones[Math.floor(random * opciones.length)];
  }
  
  if (daysCount === 1) {
    // Sugerencias para día específico
    if (startFrom === 0) {
      // HOY
      const opciones = [
        [`¿Y mañana?`, `¿Necesitas más detalles?`],
        [`¿Quieres el resto de la semana?`, `¿Te ayudo con otra ciudad?`],
        [`¿Cómo estará mañana?`, `¿Algo más?`]
      ];
      return opciones[Math.floor(random * opciones.length)];
    } else if (startFrom === 1) {
      // MAÑANA
      const opciones = [
        [`¿Y pasado mañana?`, `¿Necesitas algo más?`],
        [`¿Quieres toda la semana?`, `¿Te ayudo con otra ciudad?`],
        [`¿Cómo estará el ${dias[(hoy + 2) % 7]}?`, `¿Algo más?`]
      ];
      return opciones[Math.floor(random * opciones.length)];
    } else {
      // OTRO DÍA ESPECÍFICO
      const diaAnterior = dias[(hoy + startFrom - 1 + 7) % 7];
      const diaSiguiente = dias[(hoy + startFrom + 1) % 7];
      const opciones = [
        [`¿Y el ${diaSiguiente}?`, `¿Algo más?`],
        [`¿Quieres toda la semana?`, `¿Necesitas otra ciudad?`],
        [`¿Te digo desde el ${diaAnterior}?`, `¿Algo más?`]
      ];
      return opciones[Math.floor(random * opciones.length)];
    }
  }
  
  // Sugerencias para múltiples días
  if (daysCount >= 5) {
    const opciones = [
      [`¿Quieres detalles de un día específico?`, `¿Te ayudo con algo más?`],
      [`¿Necesitas el clima de otra ciudad?`, `¿Algo más?`],
      [`¿Te ayudo a planear tu semana?`, `¿Necesitas algo más?`]
    ];
    return opciones[Math.floor(random * opciones.length)];
  } else {
    const opciones = [
      [`¿Quieres el resto de la semana?`, `¿Algo más?`],
      [`¿Necesitas detalles de un día específico?`, `¿Te ayudo con otra ciudad?`],
      [`¿Te extiendo el pronóstico?`, `¿Algo más?`]
    ];
    return opciones[Math.floor(random * opciones.length)];
  }
}

// ============================================
// HANDLER PRINCIPAL
// ============================================

export async function POST(request: NextRequest) {
  try {
    if (!GROQ_API_KEY) {
      return NextResponse.json<ChatAPIResponse>(
        { message: 'Error de configuración del servidor', error: 'API key de Groq no configurada' },
        { status: 500 }
      );
    }

    const body: ChatAPIRequest = await request.json();
    const { message, history, location } = body;

    if (!message) {
      return NextResponse.json<ChatAPIResponse>(
        { message: 'Error', error: 'El mensaje no puede estar vacío' },
        { status: 400 }
      );
    }

    // 🔍 VALIDACIÓN TEMPRANA: Si es respuesta casual pura
    if (esRespuestaCasual(message)) {
      console.log('💬 Respuesta casual detectada, modo conversacional');
      
      const casualResponse = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { 
              role: 'system', 
              content: 'Eres un asistente amigable y conversacional. Responde de forma natural.' 
            },
            ...history.slice(-4).map(msg => ({
              role: msg.role as 'user' | 'assistant' | 'system',
              content: msg.content
            })),
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (casualResponse.ok) {
        const casualData = await casualResponse.json();
        return NextResponse.json<ChatAPIResponse>({
          message: casualData.choices[0]?.message?.content || '¡Entendido! ¿En qué más puedo ayudarte? 😊',
          needsWeather: false
        });
      }
    }

    const messages = [
      { role: 'system', content: getSystemPrompt() },
      ...history.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
      })),
      { role: 'user' as const, content: message }
    ];

    // Llamar a Groq API
    const groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        temperature: 0.4,
        max_tokens: 1500,
        top_p: 0.85,
      }),
    });

    if (!groqResponse.ok) {
      const errorData = await groqResponse.json();
      throw new Error(errorData.error?.message || 'Error al llamar a Groq API');
    }

    const groqData = await groqResponse.json();
    const aiMessage = groqData.choices[0]?.message?.content || '';

    // Verificar si la IA detectó que necesita datos del clima
    if (aiMessage.includes('needs_weather')) {
      // ✅ NUEVO: Validación mejorada
      if (!esSolicitudClimaValida(message)) {
        console.log('⚠️ No es petición de clima - Respuesta conversacional');
        
        // Limpiar cualquier JSON del mensaje
        const cleanMessage = aiMessage.replace(/\{[^}]*"needs_weather"[^}]*\}/g, '').trim();
        
        // Si el mensaje limpio está vacío o muy corto, generar respuesta apropiada
        if (!cleanMessage || cleanMessage.length < 10) {
          return NextResponse.json<ChatAPIResponse>({
            message: 'Puedo darte el pronóstico de los próximos 7 días. ¿De qué ciudad quieres saber? 😊',
            needsWeather: false
          });
        }
        
        return NextResponse.json<ChatAPIResponse>({
          message: cleanMessage,
          needsWeather: false
        });
      }

      try {
        let cleanJson = aiMessage.trim();
        const jsonMatch = cleanJson.match(/\{[^{}]*"needs_weather"[^{}]*\}/);
        if (jsonMatch) {
          cleanJson = jsonMatch[0];
        }
        
        const weatherRequest: WeatherRequest = JSON.parse(cleanJson);
        
        if (weatherRequest.needs_weather) {
          // Validación de duplicados
          const recentMessages = history.slice(-2);
          const lastWeatherMsg = recentMessages.find(msg => 
            msg.role === 'assistant' && msg.weatherData
          );

          if (lastWeatherMsg?.weatherData) {
            if (sonConsultasIguales(lastWeatherMsg.weatherData, weatherRequest)) {
              console.log('⚠️ BLOQUEADO: Consulta duplicada');
                
              const clarificationPrompt = `El usuario ya tiene información del clima de ${weatherRequest.city}.

NO busques clima otra vez. Pregúntale amablemente si quiere:
- Información de otro día
- Información de otra ciudad
- Más detalles

Mensaje del usuario: "${message}"

Responde en máximo 2 líneas, de forma amigable y variada.`;

              const clarificationResponse = await fetch(GROQ_API_URL, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${GROQ_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'llama-3.3-70b-versatile',
                  messages: [
                    { role: 'system', content: getSystemPrompt() },
                    ...messages.slice(-4),
                    { role: 'user', content: clarificationPrompt }
                  ],
                  temperature: 0.8,
                  max_tokens: 300,
                }),
              });

              if (clarificationResponse.ok) {
                const clarificationData = await clarificationResponse.json();
                return NextResponse.json<ChatAPIResponse>({
                  message: clarificationData.choices[0]?.message?.content || 
                          'Ya te di el clima de esa ciudad. ¿Quieres saber de otro día? 😊',
                  needsWeather: false
                });
              }
            }
          }

          // ===== OBTENER CLIMA =====
          console.log('🌤️ Buscando clima:', weatherRequest);
          
          const daysCount = weatherRequest.days_count || 7;
          const startFrom = weatherRequest.start_from ?? 0;

          if (startFrom < 0 || startFrom > 6) {
            return NextResponse.json<ChatAPIResponse>({
              message: `Solo tengo pronóstico para los próximos 7 días. ¿Quieres saber el clima de otro día? 🤔`,
              needsWeather: false
            });
          }

          const weatherResponse = await fetch(`${request.nextUrl.origin}/api/weather`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              city: weatherRequest.city,
              lat: location?.lat,
              lon: location?.lon,
              type: weatherRequest.type || 'current',
              days: daysCount,
              startFrom: startFrom
            }),
          });

          const weatherData = await weatherResponse.json();
          
          if (!weatherResponse.ok || !weatherData.success) {
            const errorMsg = weatherData.error || 'No se pudo obtener el clima';
            
            if (errorMsg.includes('no encontrada') || errorMsg.includes('not found')) {
              return NextResponse.json<ChatAPIResponse>({
                message: `No encontré información sobre "${weatherRequest.city}". 🤔\n\n¿Podrías especificar mejor? Por ejemplo: "${weatherRequest.city}, [País]"`,
                needsWeather: false
              });
            }
            
            throw new Error(errorMsg);
          }
          
          if (weatherData.data) {
            const enrichedWeatherData = {
              ...weatherData.data,
              startFrom: startFrom,
              requestedDays: daysCount
            };

            // ✅ NUEVO: Generar sugerencias contextuales
            const sugerencias = generarSugerenciasContextuales(
              weatherRequest.type,
              daysCount,
              startFrom,
              weatherRequest.city
            );

            const finalMessage = weatherRequest.type === 'forecast' 
              ? await generateForecastResponse(
                  enrichedWeatherData, 
                  weatherRequest.city, 
                  messages,
                  daysCount,
                  startFrom,
                  sugerencias,
                  message // ✅ NUEVO: Pasar mensaje original
                )
              : await generateWeatherResponse(
                  enrichedWeatherData, 
                  weatherRequest.city, 
                  messages,
                  sugerencias,
                  message // ✅ NUEVO: Pasar mensaje original
                );

            return NextResponse.json<ChatAPIResponse>({
              message: finalMessage,
              needsWeather: true,
              weatherData: enrichedWeatherData
            });
          }
        }
      } catch (parseError) {
        console.error('Error parsing weather request:', parseError);
      }
    }

    return NextResponse.json<ChatAPIResponse>({
      message: aiMessage,
      needsWeather: false
    });

  } catch (error) {
    console.error('Error en chat API:', error);
    return NextResponse.json<ChatAPIResponse>(
      { 
        message: 'Lo siento, tuve un problema. ¿Podrías intentarlo de nuevo?',
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    );
  }
}

// ============================================
// GENERAR RESPUESTA CON CLIMA ACTUAL
// ============================================

async function generateWeatherResponse(
  weatherData: WeatherData,
  city: string,
  previousMessages: Array<{ role: string; content: string }>,
  sugerencias: string[],
  userMessage: string
): Promise<string> {
  
  // ✅ NUEVO: Detectar si mencionó planes
  const mencionaPlanes = /\b(cita|reunión|salir|plan|voy|tengo que|iré)\b/i.test(userMessage);
  
  const weatherPrompt = `El usuario preguntó sobre el clima ACTUAL en ${city}.
${mencionaPlanes ? '\n⚠️ El usuario mencionó planes, sé empático y útil con recomendaciones.' : ''}

Datos del clima en este momento:
- Ciudad: ${weatherData.city}, ${weatherData.country}
- Temperatura: ${weatherData.temp}°C (sensación: ${weatherData.feels_like}°C)
- Descripción: ${weatherData.description}
- Humedad: ${weatherData.humidity}%
- Viento: ${weatherData.wind_speed} km/h
- Nubosidad: ${weatherData.clouds}%

Mensaje original del usuario: "${userMessage}"

Genera una respuesta que:
1. ${mencionaPlanes ? 'Primero reconozca sus planes brevemente' : 'Use emoji apropiado'}
2. Presente los datos conversacionalmente
3. Dé 1-2 recomendaciones útiles ${mencionaPlanes ? 'relacionadas con sus planes' : ''}
4. Termine con UNA de estas preguntas (elige la más natural):
   - "${sugerencias[0]}"
   - "${sugerencias[1]}"

⚠️ IMPORTANTE: 
- NUNCA menciones "JSON" o "formato JSON" al usuario
- Sé natural, amigable y varía tu respuesta`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: getSystemPrompt() },
          ...previousMessages.slice(-4),
          { role: 'user', content: weatherPrompt }
        ],
        temperature: 0.8,
        max_tokens: 800,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices[0]?.message?.content || formatWeatherFallback(weatherData);
    }
  } catch (error) {
    console.error('Error generating weather response:', error);
  }

  return formatWeatherFallback(weatherData);
}

// ============================================
// GENERAR RESPUESTA CON PRONÓSTICO
// ============================================

async function generateForecastResponse(
  forecastData: ForecastData,
  city: string,
  previousMessages: Array<{ role: string; content: string }>,
  daysCount: number,
  startFrom: number,
  sugerencias: string[],
  userMessage: string
): Promise<string> {
  
  const daysToShow = Math.min(daysCount, forecastData.list.length);
  const now = new Date();
  const hoy = now.getDay();
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  
  // ✅ NUEVO: Detectar si mencionó planes
  const mencionaPlanes = /\b(cita|reunión|salir|plan|voy|tengo que|iré|evento)\b/i.test(userMessage);
  
  const daysInfo = forecastData.list.slice(0, daysToShow).map((day, index) => {
    const date = new Date(day.dt * 1000);
    const realDayIndex = startFrom + index;
    
    let dayName: string;
    
    if (realDayIndex === 0) {
      dayName = 'Hoy';
    } else if (realDayIndex === 1) {
      dayName = 'Mañana';
    } else if (realDayIndex === 2) {
      dayName = 'Pasado mañana';
    } else {
      const targetDayOfWeek = (hoy + realDayIndex) % 7;
      dayName = dias[targetDayOfWeek].charAt(0).toUpperCase() + dias[targetDayOfWeek].slice(1);
    }
    
    return `${dayName} (${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}):
- Temperatura: ${day.temp.min}°C a ${day.temp.max}°C
- Mañana: ${day.temp.morn}°C, Tarde: ${day.temp.day}°C, Noche: ${day.temp.night}°C
- Clima: ${day.weather[0].description}
- Prob. lluvia: ${(day.pop * 100).toFixed(0)}%
- Humedad: ${day.humidity}%
- Viento: ${day.speed} km/h`;
  }).join('\n\n');

  const isSingleDay = daysCount === 1;
  const isToday = isSingleDay && startFrom === 0;
  const isTomorrow = isSingleDay && startFrom === 1;
  
  let contextType: string;
  if (isToday) {
    contextType = 'SOLO de HOY';
  } else if (isTomorrow) {
    contextType = 'SOLO de MAÑANA';
  } else if (isSingleDay) {
    const targetDay = (hoy + startFrom) % 7;
    contextType = `SOLO del ${dias[targetDay].toUpperCase()}`;
  } else {
    contextType = `de ${daysCount} días`;
  }
  
  const forecastPrompt = `HOY ES: ${dias[hoy]}, ${now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}.

El usuario preguntó sobre el pronóstico ${contextType} en ${city}.
${mencionaPlanes ? '\n⚠️ El usuario mencionó planes, sé empático y útil con recomendaciones relevantes.' : ''}

Pronóstico:

${daysInfo}

Mensaje original del usuario: "${userMessage}"

Genera una respuesta que:
1. ${mencionaPlanes ? 'Primero reconozca sus planes brevemente' : 'Use emoji apropiado'}
2. ${isSingleDay ? 'Enfócate EN ESE DÍA ESPECÍFICO con detalles útiles' : 'Da un resumen general + detalles por día'}
3. Da 1-2 recomendaciones ${mencionaPlanes ? 'relacionadas con sus planes' : 'prácticas'}
4. Termina con UNA de estas preguntas (elige la más natural):
   - "${sugerencias[0]}"
   - "${sugerencias[1]}"

⚠️ IMPORTANTE: 
- NUNCA menciones "JSON" o "formato JSON" al usuario
- Sé natural, conversacional y varía tu estilo de respuesta
- Presenta la información de forma fluida y amigable`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: getSystemPrompt() },
          ...previousMessages.slice(-4),
          { role: 'user', content: forecastPrompt }
        ],
        temperature: 0.8,
        max_tokens: 1200,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices[0]?.message?.content || formatForecastFallback(forecastData, isSingleDay);
    }
  } catch (error) {
    console.error('Error generating forecast response:', error);
  }

  return formatForecastFallback(forecastData, isSingleDay);
}

// ============================================
// RESPUESTAS FALLBACK
// ============================================

function formatWeatherFallback(weather: WeatherData): string {
  const emoji = weather.temp > 25 ? '☀️' : weather.temp < 10 ? '❄️' : '🌤️';
  
  return `${emoji} Clima actual en ${weather.city}, ${weather.country}:

**Temperatura:** ${weather.temp}°C (sensación de ${weather.feels_like}°C)
**Clima:** ${weather.description}
**Humedad:** ${weather.humidity}%
**Viento:** ${weather.wind_speed} km/h

${weather.temp > 25 ? '¡Hace calor! 🌞 Ropa ligera recomendada.' : 
  weather.temp < 10 ? '¡Hace frío! ❄️ Abrígate bien.' : 
  '¡Temperatura agradable! 👌'}

¿Necesitas algo más?`;
}

function formatForecastFallback(forecast: ForecastData, singleDay: boolean = false): string {
  const daysToShow = singleDay ? 1 : 5;
  const days = forecast.list.slice(0, daysToShow).map((day, index) => {
    const date = new Date(day.dt * 1000);
    const dayName = index === 0 ? (singleDay ? 'Ese día' : 'Hoy') : 
                    index === 1 ? 'Mañana' : 
                    date.toLocaleDateString('es-ES', { weekday: 'long' });
    
    const popPercentage = (day.pop * 100).toFixed(0);
    
    return `**${dayName}**: ${day.temp.min}°C - ${day.temp.max}°C, ${day.weather[0].description} (lluvia: ${popPercentage}%)`;
  }).join('\n');

  const title = singleDay ? '🌤️ Pronóstico para el día solicitado' : '🌤️ Pronóstico';

  return `${title} en ${forecast.city}, ${forecast.country}:

${days}

¿Necesitas más detalles?`;
}

// ============================================
// ENDPOINT GET (Testing)
// ============================================

export async function GET() {
  return NextResponse.json({
    message: 'Chat API v3.0 - Respuestas Contextuales Inteligentes',
    model: 'Llama 3.3 70B (Groq)',
    improvements: [
      'Reconoce planes + clima en mismo mensaje',
      'Respuestas contextuales que reconocen planes del usuario',
      'Sugerencias variadas basadas en contexto',
      'Detección mejorada de peticiones válidas',
      'No sugiere buscar en internet (el bot tiene el clima)'
    ],
    capabilities: {
      current_weather: 'Clima actual',
      forecast: 'Pronóstico 7 días',
      smart_days: 'Días específicos con contexto',
      context_aware: 'Reconoce planes y da respuestas relevantes',
      dynamic_suggestions: 'Sugerencias variadas según contexto',
      duplicate_prevention: 'Prevención inteligente de duplicados'
    }
  });
}