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
   • "necesitaré usar paraguas esta semana" (pregunta sobre objetos/acciones que dependen del clima)
   • "¿qué abrigo debo ponerme?" (actividades/ropa relacionadas con el clima)
   • "voy a la playa el sábado" + "¿cómo estará el clima?" (planes + clima)

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

🔹 ⚠️ CRÍTICO - CIUDAD OBLIGATORIA:
   - Si el usuario NO menciona una ciudad específica en su pregunta, NO generes JSON
   - SIEMPRE pregunta por la ciudad primero
   - Ejemplos de "NO ciudad específica":
     * "¿necesitaré paraguas esta semana?" (sin ciudad)
     * "¿qué ropa debo usar?" (sin ciudad)
     * "va a llover?" (sin ciudad)
   - En estos casos, responde conversacionalmente pidiendo la ciudad
   - Solo genera JSON CUANDO tienes ciudad específica

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
- Nunca menciones JSON al usuario
- ⚠️ IMPORTANTE: Si el usuario pide clima pero NO menciona una ciudad específica, SIEMPRE pregunta qué ciudad en tu respuesta. NO asumas ciudades.`;
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

// ============================================
// FUNCIONES DE CONTEXTO HORARIO
// ============================================

interface TimeContext {
  hour: number;
  period: 'madrugada' | 'mañana' | 'tarde' | 'noche';
  isDarkOutside: boolean;
  emoji: string;
}

function getTimeContext(timezone?: number): TimeContext {
  const now = new Date();
  let hour = now.getHours();
  
  // Si tenemos zona horaria, ajustar
  if (timezone) {
    hour = (hour + Math.round(timezone / 3600)) % 24;
  }
  
  let period: 'madrugada' | 'mañana' | 'tarde' | 'noche';
  let isDarkOutside: boolean;
  let emoji: string;
  
  if (hour >= 5 && hour < 12) {
    period = 'mañana';
    isDarkOutside = false;
    emoji = '🌅';
  } else if (hour >= 12 && hour < 17) {
    period = 'tarde';
    isDarkOutside = false;
    emoji = '☀️';
  } else if (hour >= 17 && hour < 21) {
    period = 'noche';
    isDarkOutside = false; // Atardecer
    emoji = '🌆';
  } else if (hour >= 21 && hour < 23) {
    period = 'noche';
    isDarkOutside = true;
    emoji = '🌙';
  } else {
    // 23:00 - 04:59
    period = 'madrugada';
    isDarkOutside = true;
    emoji = '🌌';
  }
  
  return { hour, period, isDarkOutside, emoji };
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

// 🆕 DETECTAR SI ES CONFIRMACIÓN (SÍ/NO)
function esConfirmacion(mensaje: string): { type: 'si' | 'no' | null; } {
  const mensajeLower = mensaje.toLowerCase().trim();
  
  if (/^(si|sí|ok|vale|claro|perfecto|genial|bien|bueno|dale)$/.test(mensajeLower)) {
    return { type: 'si' };
  }
  
  if (/^(no|nope|nah|nunca|para nada)$/.test(mensajeLower)) {
    return { type: 'no' };
  }
  
  return { type: null };
}

// 🆕 EXTRAER CIUDAD DEL MENSAJE
function extraerCiudadDelMensaje(mensaje: string): string | null {
  const mensajeLower = mensaje.toLowerCase().trim();
  
  // Si el mensaje es muy corto y no tiene palabras reservadas, probablemente sea una ciudad
  // Ej: "Talca", "Santiago", "Madrid"
  const palabrasReservadas = ['si', 'sí', 'no', 'ok', 'vale', 'claro', 'bueno', 'bien', 'y', 'o', 'el', 'la', 'de', 'en', 'por', 'para'];
  const palabras = mensajeLower.split(/\s+/);
  
  // Si tiene 1-2 palabras y no son reservadas, podría ser una ciudad
  if (palabras.length <= 2) {
    const palabrasPrincipales = palabras.filter(p => !palabrasReservadas.includes(p) && p.length > 2);
    if (palabrasPrincipales.length > 0) {
      return palabrasPrincipales.join(' ');
    }
  }
  
  return null;
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
    return false;
  }
  
  // Keywords FUERTES que confirman petición de clima REAL
  // Incluye palabras directas sobre clima + actividades/objetos que dependen del clima
  const keywordsClima = [
    'clima', 'tiempo', 'temperatura', 'pronóstico', 'forecast',
    'va a llover', 'llover', 'lluvia', 'hace calor', 'hace frío',
    'qué tiempo', 'cómo está el', 'dame el clima', 'quiero saber el',
    'me das el clima', 'me puedes dar', 'dime el clima', 'cómo estará',
    'como estara', 'me das el', 'puedes darme el clima', 'dime cómo está',
    'dime como esta', 'estará', 'estara', 'cómo está', 'como esta',
    // Palabras relacionadas con lluvia/paraguas
    'paraguas', 'paragüas', 'lluvia', 'llover', 'mojarse', 'mojada',
    'impermeable', 'mojado', 'mojar',
    // Palabras relacionadas con frío/abrigo
    'abrigo', 'chaqueta', 'suéter', 'sueter', 'frio', 'frío', 'helada',
    'nieve', 'nieva', 'nevar', 'capa de nieve',
    // Palabras relacionadas con calor
    'calor', 'caluroso', 'ola de calor', 'sofocante',
    // Palabras sobre actividades exteriores
    'salir', 'paseo', 'caminar', 'caminata', 'vacaciones', 'viaje',
    'playa', 'piscina', 'picnic', 'senderismo', 'excursión',
    // Palabras sobre planes
    'planes', 'plan', 'voy a', 'iré', 'necesitaré', 'necesitare',
    'tendré', 'tendre', 'usaré', 'usare'
  ];
  
  // Detectar referencias temporales específicas (días de la semana, "próximo", etc)
  // También incluye referencias a períodos del día
  const referenciasTemporales = [
    /próximo (lunes|martes|miércoles|jueves|viernes|sábado|domingo)/i,
    /para el (lunes|martes|miércoles|jueves|viernes|sábado|domingo)/i,
    /el próximo (lunes|martes|miércoles|jueves|viernes|sábado|domingo)/i,
    /clima del? (lunes|martes|miércoles|jueves|viernes|sábado|domingo)/i,
    // Referencias a períodos del día
    /más tarde|en la tarde|esta tarde|por la tarde|de la tarde|luego|después/i,
    /esta noche|por la noche|en la noche|durante la noche|de noche/i,
    /madrugada|muy temprano|de madrugada|al amanecer/i,
    /durante el d[ií]a|en el d[ií]a|lo que queda del d[ií]a/i,
    // Referencias a períodos como "esta semana", "el próximo mes"
    /esta semana|próxima semana|semana que viene/i,
    /todo el mes|durante el mes/i,
    /varios días|varios d[ií]as|múltiples días/i
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
  
  // Si son de diferentes períodos (ej: hoy vs mañana), NO son iguales
  if (prevStartFrom !== currentStartFrom) return false;
  
  if (currentType === 'forecast') {
    const prevDays = prev.requestedDays || prev.list?.length || 7;
    const currentDays = current.days_count || 7;
    
    // Solo son iguales si: misma ciudad, mismo período de inicio, misma cantidad de días
    return prevDays === currentDays;
  }
  
  return true;
}

// 🆕 DETECTAR REFERENCIAS TEMPORALES DENTRO DEL DÍA
// ============================================

interface TimePeriodReference {
  found: boolean;
  periods: Array<'morn' | 'day' | 'eve' | 'night'>;
  description: string;
}

function detectarPerioDoDelDia(mensaje: string): TimePeriodReference {
  const mensajeLower = mensaje.toLowerCase();
  
  // Detectar "más tarde", "tarde", "en la tarde", "luego", "después"
  if (/más tarde|en la tarde|esta tarde|por la tarde|de la tarde|luego|después|más adelante/.test(mensajeLower)) {
    return { 
      found: true, 
      periods: ['day', 'eve'], // Cubre tarde (día) y atardecer (eve)
      description: 'más tarde (tarde/atardecer)'
    };
  }
  
  // Detectar "noche", "esta noche", "por la noche"
  if (/esta noche|por la noche|en la noche|durante la noche|de noche/.test(mensajeLower)) {
    return { 
      found: true, 
      periods: ['eve', 'night'], // Noche incluye atardecer y madrugada
      description: 'esta noche'
    };
  }
  
  // Detectar "madrugada" (muy temprano por la mañana)
  if (/madrugada|muy temprano|de madrugada|al amanecer/.test(mensajeLower)) {
    return { 
      found: true, 
      periods: ['morn'], // Solo temperaturas matutinas
      description: 'madrugada/muy temprano'
    };
  }
  
  // Detectar "mañana en la mañana", "mañana por la mañana" (sin confundir con solo "mañana")
  if (/mañana\s+(en\s+la\s+)?mañana|mañana\s+(por\s+la\s+)?madrugada|temprano\s+mañana/.test(mensajeLower)) {
    return { 
      found: true, 
      periods: ['morn'], 
      description: 'mañana por la mañana'
    };
  }
  
  // Detectar "mañana en la tarde", "mañana por la tarde"
  if (/mañana\s+(en\s+la\s+)?tarde|mañana\s+(por\s+la\s+)?tarde|mañana\s+atardecer/.test(mensajeLower)) {
    return { 
      found: true, 
      periods: ['day', 'eve'], 
      description: 'mañana por la tarde'
    };
  }
  
  // Detectar "mañana en la noche", "mañana por la noche"
  if (/mañana\s+(en\s+la\s+)?noche|mañana\s+(por\s+la\s+)?noche|mañana\s+de\s+noche/.test(mensajeLower)) {
    return { 
      found: true, 
      periods: ['eve', 'night'], 
      description: 'mañana por la noche'
    };
  }
  
  return { found: false, periods: [], description: '' };
}

// 🆕 FORMATEAR RESPUESTA DE PERÍODO ESPECÍFICO DEL DÍA
function formatearPeriodoDelDia(
  dayData: any,
  dayName: string,
  periods: Array<'morn' | 'day' | 'eve' | 'night'>,
  timeContext: TimeContext
): string {
  const periodLabels = {
    morn: { label: 'por la mañana', icon: '🌅', temp: dayData.temp.morn },
    day: { label: 'por la tarde', icon: '☀️', temp: dayData.temp.day },
    eve: { label: 'al atardecer', icon: '🌆', temp: dayData.temp.eve },
    night: { label: 'por la noche', icon: '🌙', temp: dayData.temp.night }
  };
  
  // Construir lista de períodos
  const periodosTexto = periods.map(p => periodLabels[p].label).join(' y ');
  const maxTempPeriodo = Math.max(...periods.map(p => periodLabels[p].temp));
  const minTempPeriodo = Math.min(...periods.map(p => periodLabels[p].temp));
  
  let respuesta = ``;
  
  // Contexto horario si es hoy
  if (dayName === 'hoy') {
    respuesta += `${timeContext.emoji} Ahora mismo son las ~${String(timeContext.hour).padStart(2, '0')}:00 (${timeContext.period})\n\n`;
  }
  
  // Respuesta natural
  respuesta += `Para ${dayName} ${periodosTexto}:\n`;
  
  // Mostrar temperaturas específicas
  for (const period of periods) {
    const info = periodLabels[period];
    respuesta += `${info.icon} ${info.label.charAt(0).toUpperCase() + info.label.slice(1)}: **${info.temp}°C**\n`;
  }
  
  // Clima general
  respuesta += `\n${dayData.weather[0].description}`;
  
  // Recomendaciones según temperatura
  if (maxTempPeriodo > 30) {
    respuesta += `\n\n🔥 **ALERTA CALOR EXTREMO** (hasta ${maxTempPeriodo}°C):\n- ☀️ Protección solar SPF 50+\n- 💧 Hidratación constante\n- 🏃 Evita actividades entre 12-16h`;
  } else if (maxTempPeriodo > 26) {
    respuesta += `\n\n☀️ Calor considerable (${maxTempPeriodo}°C):\n- Ropa ligera y clara\n- Gafas de sol\n- Mantente hidratado`;
  } else if (minTempPeriodo < 5) {
    respuesta += `\n\n❄️ Frío intenso (${minTempPeriodo}°C):\n- Abrigo adecuado\n- Cuida extremidades`;
  }
  
  respuesta += `\n\n¿Quieres más información? 🤔`;
  
  return respuesta;
}

// ============================================
// GENERADOR DE SUGERENCIAS CONTEXTUALES
// ============================================

function generarSugerenciasContextuales(
  tipo: 'current' | 'forecast',
  daysCount: number,
  startFrom: number,
  city: string,
  temperatura?: number
): string[] {
  const now = new Date();
  const hoy = now.getDay();
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  
  const sugerencias: string[] = [];
  const random = Math.random();
  
  // Detectar si hace calor extremo (>28°C)
  const esCalorExtremo = temperatura && temperatura > 28;
  
  if (tipo === 'current') {
    // Sugerencias para clima actual
    let opciones: string[][];
    if (esCalorExtremo) {
      opciones = [
        [`¿Quieres el pronóstico para planear mejor con el calor?`, `¿Necesitas consejos?`],
        [`¿Cómo estará mañana con el calor?`, `¿Algo más?`],
        [`¿Quieres saber de temperaturas más frescas en la semana?`, `¿Te ayudo con otra ciudad?`]
      ];
    } else {
      opciones = [
        [`¿Y mañana?`, `¿Necesitas algo más?`],
        [`¿Quieres el pronóstico de la semana?`, `¿Te ayudo con otra ciudad?`],
        [`¿Cómo estará el fin de semana?`, `¿Necesitas planear algo?`],
        [`¿Y el ${dias[(hoy + 1) % 7]}?`, `¿Algo más?`]
      ];
    }
    return opciones[Math.floor(random * opciones.length)];
  }
  
  if (daysCount === 1) {
    // Sugerencias para día específico
    if (startFrom === 0) {
      // HOY
      let opciones: string[][];
      if (esCalorExtremo) {
        opciones = [
          [`¿Cómo estará mañana?`, `¿Tendrá menos calor?`],
          [`¿Te gustaría ver toda la semana por el calor?`, `¿Algo más?`]
        ];
      } else {
        opciones = [
          [`¿Y mañana?`, `¿Necesitas más detalles?`],
          [`¿Quieres el resto de la semana?`, `¿Te ayudo con otra ciudad?`],
          [`¿Cómo estará mañana?`, `¿Algo más?`]
        ];
      }
      return opciones[Math.floor(random * opciones.length)];
    } else if (startFrom === 1) {
      // MAÑANA
      let opciones: string[][];
      if (esCalorExtremo) {
        opciones = [
          [`¿Y el ${dias[(hoy + 2) % 7]}? ¿Seguirá el calor?`, `¿Algo más?`],
          [`¿Necesitas ver días más frescos?`, `¿Te ayudo con otra ciudad?`]
        ];
      } else {
        opciones = [
          [`¿Y pasado mañana?`, `¿Necesitas algo más?`],
          [`¿Quieres toda la semana?`, `¿Te ayudo con otra ciudad?`],
          [`¿Cómo estará el ${dias[(hoy + 2) % 7]}?`, `¿Algo más?`]
        ];
      }
      return opciones[Math.floor(random * opciones.length)];
    } else {
      // OTRO DÍA ESPECÍFICO
      const diaAnterior = dias[(hoy + startFrom - 1 + 7) % 7];
      const diaSiguiente = dias[(hoy + startFrom + 1) % 7];
      let opciones: string[][];
      if (esCalorExtremo) {
        opciones = [
          [`¿Y el ${diaSiguiente}? ¿Continuará el calor?`, `¿Algo más?`],
          [`¿Quieres ver días más frescos en la semana?`, `¿Algo más?`]
        ];
      } else {
        opciones = [
          [`¿Y el ${diaSiguiente}?`, `¿Algo más?`],
          [`¿Quieres toda la semana?`, `¿Necesitas otra ciudad?`],
          [`¿Te digo desde el ${diaAnterior}?`, `¿Algo más?`]
        ];
      }
      return opciones[Math.floor(random * opciones.length)];
    }
  }
  
  // Sugerencias para múltiples días
  if (daysCount >= 5) {
    let opciones: string[][];
    if (esCalorExtremo) {
      opciones = [
        [`¿Quieres detalles de cuándo baje la temperatura?`, `¿Te ayudo con algo más?`],
        [`¿Necesitas otra ciudad con clima más fresco?`, `¿Algo más?`],
        [`¿Te ayudo a planear actividades considerando el calor?`, `¿Necesitas algo más?`]
      ];
    } else {
      opciones = [
        [`¿Quieres detalles de un día específico?`, `¿Te ayudo con algo más?`],
        [`¿Necesitas el clima de otra ciudad?`, `¿Algo más?`],
        [`¿Te ayudo a planear tu semana?`, `¿Necesitas algo más?`]
      ];
    }
    return opciones[Math.floor(random * opciones.length)];
  } else {
    let opciones: string[][];
    if (esCalorExtremo) {
      opciones = [
        [`¿Quieres ver cuándo baja el calor?`, `¿Algo más?`],
        [`¿Necesitas detalles de temperaturas más bajas?`, `¿Te ayudo con otra ciudad?`],
        [`¿Te extiendo el pronóstico para encontrar días más frescos?`, `¿Algo más?`]
      ];
    } else {
      opciones = [
        [`¿Quieres el resto de la semana?`, `¿Algo más?`],
        [`¿Necesitas detalles de un día específico?`, `¿Te ayudo con otra ciudad?`],
        [`¿Te extiendo el pronóstico?`, `¿Algo más?`]
      ];
    }
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
    const { message, history, location, cache } = body;

    if (!message) {
      return NextResponse.json<ChatAPIResponse>(
        { message: 'Error', error: 'El mensaje no puede estar vacío' },
        { status: 400 }
      );
    }

    // 🆕 Obtener contexto horario basado en timezone del cache
    const timeContext = getTimeContext(cache?.userPreferences?.timezone);

    // 🆕 OBTENER ÚLTIMA CIUDAD DEL CONTEXTO
    const lastCity = cache?.lastCities?.[0] || null;
    console.log(`🏙️ Última ciudad en contexto: ${lastCity || 'ninguna'}`);

    // 🆕 NUEVO: Detectar si hay pregunta pendiente y el usuario responde "sí"
    const confirmacion = esConfirmacion(message);
    if (confirmacion.type === 'si' && cache?.pendingQuestion?.type === 'city_confirmation') {
      console.log(`✅ Confirmación detectada para ciudad: ${cache.pendingQuestion.city}`);
      
      // Crear un mensaje interno para solicitar el clima de esa ciudad
      const cityFromPending = cache.pendingQuestion.city;
      
      // Construir la solicitud como si el usuario hubiera pedido el clima
      const internalWeatherRequest: WeatherRequest = {
        needs_weather: true,
        city: cityFromPending,
        type: 'current'
      };
      
      // Saltar directamente a obtener el clima
      console.log('🌤️ Procesando solicitud confirmada:', internalWeatherRequest);
      
      // Copiar lógica de obtención de clima aquí
      const weatherResponse = await fetch(`${request.nextUrl.origin}/api/weather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: cityFromPending,
          lat: location?.lat,
          lon: location?.lon,
          type: 'current'
        }),
      });

      const weatherData = await weatherResponse.json();
      
      if (!weatherResponse.ok || !weatherData.success) {
        const errorMsg = weatherData.error || 'No se pudo obtener el clima';
        return NextResponse.json<ChatAPIResponse>({
          message: `❌ Lo siento, actualmente no tengo acceso a información climática de **"${cityFromPending}"**.\n\n¿Quieres probar con otra ubicación? 🌍`,
          needsWeather: false
        });
      }

      if (weatherData.data) {
        const enrichedWeatherData = {
          ...weatherData.data,
          startFrom: 0,
          requestedDays: 1
        };

        const sugerencias = generarSugerenciasContextuales('current', 1, 0, cityFromPending, enrichedWeatherData.temp);

        const finalMessage = await generateWeatherResponse(
          enrichedWeatherData,
          cityFromPending,
          [],
          sugerencias,
          `Sí`,
          timeContext
        );

        // Limpiar pregunta pendiente
        if (cache) {
          cache.pendingQuestion = undefined;
        }

        return NextResponse.json<ChatAPIResponse>({
          message: finalMessage,
          needsWeather: true,
          weatherData: enrichedWeatherData
        });
      }
    }

    // Si dice "no" a la pregunta pendiente, limpiar
    if (confirmacion.type === 'no' && cache?.pendingQuestion?.type === 'city_confirmation') {
      console.log(`❌ Usuario rechazó: ${cache.pendingQuestion.city}`);
      if (cache) {
        cache.pendingQuestion = undefined;
      }
    }

    // 🆕 NUEVO: Si hay pregunta pendiente y usuario responde con una ciudad
    const ciudadExtraida = extraerCiudadDelMensaje(message);
    if (ciudadExtraida && cache?.pendingQuestion?.type === 'city_confirmation') {
      console.log(`📍 Ciudad extraída de respuesta: ${ciudadExtraida}`);
      
      // Actualizar la ciudad en la pregunta pendiente
      cache.pendingQuestion.city = ciudadExtraida;
      
      // Procesar automáticamente esa ciudad
      const weatherResponse = await fetch(`${request.nextUrl.origin}/api/weather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: ciudadExtraida,
          lat: location?.lat,
          lon: location?.lon,
          type: 'forecast',
          days: 7,
          startFrom: 0
        }),
      });

      const weatherData = await weatherResponse.json();
      
      if (!weatherResponse.ok || !weatherData.success) {
        return NextResponse.json<ChatAPIResponse>({
          message: `❌ No encontré información de **"${ciudadExtraida}"**. ¿Quieres probar con otra ciudad? 🌍`,
          needsWeather: false
        });
      }

      if (weatherData.data) {
        const enrichedWeatherData = {
          ...weatherData.data,
          startFrom: 0,
          requestedDays: 7
        };

        const sugerencias = generarSugerenciasContextuales('forecast', 7, 0, ciudadExtraida, 
          Math.max(...enrichedWeatherData.list.map((d: any) => d.temp?.max || 0)));

        const finalMessage = await generateForecastResponse(
          enrichedWeatherData,
          ciudadExtraida,
          [...history.slice(-2)],
          7,
          0,
          sugerencias,
          `¿Cómo está el clima en ${ciudadExtraida}?`,
          timeContext
        );

        if (cache) {
          cache.pendingQuestion = undefined;
        }

        return NextResponse.json<ChatAPIResponse>({
          message: finalMessage,
          needsWeather: true,
          weatherData: enrichedWeatherData
        });
      }
    }
    
    // 🆕 ALTERNATIVA: Si usuario solo dice ciudad (sin pregunta pendiente previa)
    // pero es respuesta a solicitud de ciudad
    if (ciudadExtraida && !cache?.pendingQuestion && esSolicitudClimaValida(message)) {
      console.log(`📍 Ciudad extraída directamente (sin pregunta pendiente): ${ciudadExtraida}`);
      
      const weatherResponse = await fetch(`${request.nextUrl.origin}/api/weather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: ciudadExtraida,
          lat: location?.lat,
          lon: location?.lon,
          type: 'forecast',
          days: 7,
          startFrom: 0
        }),
      });

      const weatherData = await weatherResponse.json();
      
      if (!weatherResponse.ok || !weatherData.success) {
        return NextResponse.json<ChatAPIResponse>({
          message: `❌ No encontré información de **"${ciudadExtraida}"**. ¿Quieres probar con otra ciudad? 🌍`,
          needsWeather: false
        });
      }

      if (weatherData.data) {
        const enrichedWeatherData = {
          ...weatherData.data,
          startFrom: 0,
          requestedDays: 7
        };

        const sugerencias = generarSugerenciasContextuales('forecast', 7, 0, ciudadExtraida,
          Math.max(...enrichedWeatherData.list.map((d: any) => d.temp?.max || 0)));

        const finalMessage = await generateForecastResponse(
          enrichedWeatherData,
          ciudadExtraida,
          [...history.slice(-2)],
          7,
          0,
          sugerencias,
          message,
          timeContext
        );

        return NextResponse.json<ChatAPIResponse>({
          message: finalMessage,
          needsWeather: true,
          weatherData: enrichedWeatherData
        });
      }
    }

    // 🔍 VALIDACIÓN TEMPRANA: Si es respuesta casual pura
    if (esRespuestaCasual(message)) {
      console.log('💬 Respuesta casual detectada, modo conversacional (salto early)');
      
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

    console.log(`📨 Respuesta de Groq (primeros 200 chars): ${aiMessage.substring(0, 200)}`);
    console.log(`🔍 ¿Contiene JSON needs_weather?: ${aiMessage.includes('needs_weather')}`);

    // Verificar si la IA detectó que necesita datos del clima
    if (aiMessage.includes('needs_weather')) {
      // 🆕 CAMBIO: Si la IA generó JSON needs_weather, confiar en ella
      // La IA es más inteligente que nuestras regex para entender contexto
      console.log(`✅ IA generó JSON needs_weather, confiando en su decisión`);
      
      try {
        let cleanJson = aiMessage.trim();
        const jsonMatch = cleanJson.match(/\{[^{}]*"needs_weather"[^{}]*\}/);
        if (jsonMatch) {
          cleanJson = jsonMatch[0];
        }
        
        console.log(`📋 JSON extraído: ${cleanJson}`);
        
        const weatherRequest: WeatherRequest = JSON.parse(cleanJson);
        
        console.log(`✅ JSON parseado correctamente:`, weatherRequest);
        
        if (weatherRequest.needs_weather) {
          console.log(`🌤️ needs_weather = true, procesando solicitud...`);
          console.log(`🌤️ needs_weather = true, procesando solicitud...`);
          // 🆕 Si no hay ciudad específica pero tenemos contexto anterior, usar esa ciudad
          if ((!weatherRequest.city || weatherRequest.city.trim() === '' || weatherRequest.city.toLowerCase() === 'genérica' || weatherRequest.city.toLowerCase() === 'generica') && lastCity) {
            console.log(`🏙️ Usando última ciudad del contexto: ${lastCity}`);
            weatherRequest.city = lastCity;
          }
          
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

          // 🆕 VALIDACIÓN: Verificar si hay ciudad específica
          if (!weatherRequest.city || weatherRequest.city.trim() === '' || weatherRequest.city.toLowerCase() === 'genérica' || weatherRequest.city.toLowerCase() === 'generica') {
            console.log('⚠️ No hay ciudad específica - Pedirla al usuario');
            
            // Guardar pregunta pendiente
            if (cache) {
              cache.pendingQuestion = {
                type: 'city_confirmation',
                city: '',
                timestamp: Date.now()
              };
            }
            
            return NextResponse.json<ChatAPIResponse>({
              message: `Para darte un pronóstico preciso sobre el clima, necesito saber en qué ciudad te encuentras. ¿De dónde eres o en qué ciudad quieres saber el clima? 🌍`,
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
                message: `❌ Lo siento, actualmente no tengo acceso a información climática de **"${weatherRequest.city}"**.\n\nPuedo ayudarte con:\n• Otras ciudades importantes\n• Ciudades cercanas\n• O consultar por "Ciudad, País" para ser más específico\n\n¿Quieres probar con otra ubicación? 🌍`,
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

            // 🆕 GUARDAR CIUDAD EN CACHE PARA CONTEXTO FUTURO
            if (cache && weatherRequest.city) {
              if (!cache.lastCities) {
                cache.lastCities = [];
              }
              // Agregar ciudad al inicio si no está ya
              if (!cache.lastCities.includes(weatherRequest.city)) {
                cache.lastCities.unshift(weatherRequest.city);
              }
              console.log(`💾 Ciudad guardada en cache: ${weatherRequest.city}`);
            }

            // 🆕 DETECTAR SI BUSCA PERÍODO ESPECÍFICO DEL DÍA
            const periodoDia = detectarPerioDoDelDia(message);
            
            if (periodoDia.found && weatherRequest.type === 'forecast' && enrichedWeatherData.list?.length > 0) {
              // Usuario preguntó por un período específico (ej: "más tarde", "esta noche")
              const dayData = enrichedWeatherData.list[0]; // Primer día del pronóstico
              
              let dayName = 'hoy';
              if (startFrom === 1) {
                dayName = 'mañana';
              } else if (startFrom === 2) {
                dayName = 'pasado mañana';
              }
              
              const respuestaPeriodicidad = formatearPeriodoDelDia(
                dayData,
                dayName,
                periodoDia.periods,
                timeContext
              );
              
              console.log(`✅ Detectado período del día: "${periodoDia.description}"`);
              
              return NextResponse.json<ChatAPIResponse>({
                message: respuestaPeriodicidad,
                needsWeather: true,
                weatherData: enrichedWeatherData
              });
            }

            // ✅ NUEVO: Generar sugerencias contextuales (FLUJO NORMAL)
            // Obtener temperatura máxima para decidir si hay calor extremo
            let maxTemp = 0;
            if (weatherRequest.type === 'forecast' && enrichedWeatherData.list?.length > 0) {
              maxTemp = Math.max(...enrichedWeatherData.list.map((d: any) => d.temp?.max || 0));
            } else if ('temp' in enrichedWeatherData) {
              maxTemp = enrichedWeatherData.temp || 0;
            }
            
            const sugerencias = generarSugerenciasContextuales(
              weatherRequest.type,
              daysCount,
              startFrom,
              weatherRequest.city,
              maxTemp
            );

            const finalMessage = weatherRequest.type === 'forecast' 
              ? await generateForecastResponse(
                  enrichedWeatherData, 
                  weatherRequest.city, 
                  messages,
                  daysCount,
                  startFrom,
                  sugerencias,
                  message,
                  timeContext // 🆕
                )
              : await generateWeatherResponse(
                  enrichedWeatherData, 
                  weatherRequest.city, 
                  messages,
                  sugerencias,
                  message,
                  timeContext // 🆕
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
  userMessage: string,
  timeContext?: TimeContext
): Promise<string> {
  
  // ✅ NUEVO: Detectar si mencionó planes
  const mencionaPlanes = /\b(cita|reunión|salir|plan|voy|tengo que|iré)\b/i.test(userMessage);
  
  // ✅ Evaluar si hay calor extremo
  const esCalorExtremo = weatherData.temp > 28;
  const esCalorModerado = weatherData.temp > 24 && weatherData.temp <= 28;
  const esFrio = weatherData.temp < 10;
  
  // 🆕 Evaluar contexto de hora
  let contextHora = '';
  if (timeContext?.isDarkOutside) {
    contextHora = `⚠️ CONTEXTO HORARIO: Es ${timeContext.period} (${timeContext.hour}:00 aprox). No sugieras actividades al aire libre diurnas, es de noche. Recomendaciones deben ser nocturas.`;
  } else if (timeContext?.period === 'madrugada') {
    contextHora = `⚠️ CONTEXTO HORARIO: Es madrugada (${timeContext.hour}:00). Probablemente el usuario esté durmiendo. Respuestas breves y sin sugerir actividades.`;
  }
  
  let recomendacionClima = '';
  if (esCalorExtremo) {
    recomendacionClima = '⚠️ CONTEXTO: Hace CALOR EXTREMO. Las recomendaciones deben ser conservadoras: protección solar, mantenerse hidratado, evitar horas pico de calor, actividades a la sombra, etc. NO minimices el calor.';
  } else if (esCalorModerado) {
    recomendacionClima = '⚠️ CONTEXTO: Hace calor moderado. Recomendaciones equilibradas.';
  } else if (esFrio) {
    recomendacionClima = '⚠️ CONTEXTO: Hace frío. Recomendaciones de abrigo y protección.';
  }
  
  const weatherPrompt = `El usuario preguntó sobre el clima ACTUAL en ${city}.
${mencionaPlanes ? '\n⚠️ El usuario mencionó planes, sé empático y útil con recomendaciones.' : ''}
${contextHora}
${recomendacionClima}

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
3. Dé 1-2 recomendaciones útiles ${esCalorExtremo ? 'REALISTAS para el calor extremo (NO digas "día agradable")' : mencionaPlanes ? 'relacionadas con sus planes' : 'prácticas'}
4. Termine con UNA de estas preguntas (elige la más natural):
   - "${sugerencias[0]}"
   - "${sugerencias[1]}"

⚠️ IMPORTANTE: 
- NUNCA menciones "JSON" o "formato JSON" al usuario
- ${esCalorExtremo ? `SÉ HONESTO: con ${weatherData.temp}°C es calor EXTREMO, no minimices. Recomienda cuidados.` : 'Sé natural'}
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
  userMessage: string,
  timeContext?: TimeContext
): Promise<string> {
  
  const daysToShow = Math.min(daysCount, forecastData.list.length);
  const now = new Date();
  const hoy = now.getDay();
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  
  // ✅ Detectar si hay calor extremo en los días solicitados
  const maxTempForecast = Math.max(...forecastData.list.slice(0, daysToShow).map(d => d.temp?.max || 0));
  const esCalorExtremo = maxTempForecast > 28;
  
  // 🆕 Contexto horario
  let contextHora = '';
  if (timeContext?.isDarkOutside) {
    contextHora = `⚠️ CONTEXTO HORARIO: Es ${timeContext.period} (${timeContext.hour}:00 aprox). Usuario probablemente verá esto en la noche.`;
  }
  
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
${contextHora}
${esCalorExtremo ? `\n⚠️ CONTEXTO IMPORTANTE: Hay CALOR EXTREMO (hasta ${maxTempForecast}°C). Las recomendaciones deben ser REALISTAS y CONSERVADORAS: protección solar, evitar horas pico, mantenerse hidratado, NO digas "es un día agradable".` : ''}

⚠️ INSTRUCCIONES CRÍTICAS PARA ESTA RESPUESTA:
- USA EXACTAMENTE los datos que te proporciono abajo
- NO inventes datos ni probabilidades
- Si dice "Prob. lluvia: 0%" significa SIN lluvia - di "sin lluvia" o "sin riesgo de lluvia"
- Si dice "Prob. lluvia: 2%" significa BAJA probabilidad - di "2% de probabilidad"
- Si dice "Prob. lluvia: 10%" significa BAJA probabilidad - di "10% de probabilidad"
- Si dice "Prob. lluvia: 15%" significa BAJA-MODERADA probabilidad
- Nunca hagas porcentajes mayores a 100% ni inventes valores no mencionados

Pronóstico EXACTO que debes usar:

${daysInfo}

Mensaje original del usuario: "${userMessage}"

Genera una respuesta que:
1. ${mencionaPlanes ? 'Primero reconozca sus planes brevemente' : 'Use emoji apropiado'}
2. ${isSingleDay ? 'Enfócate EN ESE DÍA ESPECÍFICO con detalles útiles' : 'Da un resumen general + detalles por día'}
3. Da 1-2 recomendaciones ${esCalorExtremo ? 'REALISTAS para el calor extremo (NO seas ingenuo con altas temperaturas)' : mencionaPlanes ? 'relacionadas con sus planes' : 'prácticas'}
4. Termina con UNA de estas preguntas (elige la más natural):
   - "${sugerencias[0]}"
   - "${sugerencias[1]}"

⚠️ IMPORTANTE: 
- NUNCA menciones "JSON" o "formato JSON" al usuario
- ${esCalorExtremo ? `Sé HONESTO: con ${maxTempForecast}°C es calor EXTREMO, no minimices. Recomienda cuidados.` : 'Sé natural'}
- Sé natural, conversacional y varía tu estilo de respuesta
- Presenta la información de forma fluida y amigable
- CITA EXACTAMENTE los porcentajes y descripciones de los datos que te di`;

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