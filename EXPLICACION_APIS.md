# 🔧 Explicación: Sistema de APIs

## Arquitectura del Proyecto

```
┌─────────────────────────────────────────────────────────────┐
│                 NAVEGADOR DEL USUARIO                       │
│                   (ChatContainer.tsx)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
        Mensaje del usuario: "¿Clima en Talca?"
                         │
         ┌───────────────▼────────────────┐
         │   /api/chat (route.ts)         │
         │                                │
         │ 1. Validar que es clima       │
         │ 2. Detectar período del día   │
         │ 3. Extraer ciudad             │
         │ 4. Llamar a Groq LLM          │
         └───────────────┬────────────────┘
                         │
        LLM detecta: "needs_weather: true, city: Talca"
                         │
         ┌───────────────▼────────────────┐
         │ /api/weather (route.ts)        │
         │                                │
         │ 1. Geocoding (ciudad → coords) │
         │ 2. Llamar Open-Meteo API       │
         │ 3. Transformar datos           │
         └───────────────┬────────────────┘
                         │
        Respuesta: {temp: 22°C, wind: 5km/h, ...}
                         │
         ┌───────────────▼────────────────┐
         │ /api/chat (continuación)       │
         │                                │
         │ 1. Recibir datos de clima      │
         │ 2. Generar respuesta natural   │
         │ 3. Con recomendaciones         │
         └───────────────┬────────────────┘
                         │
        Respuesta: "En Talca hace 22°C, lleva chaqueta..."
                         │
         ┌───────────────▼────────────────┐
         │  Mostrar en ChatContainer      │
         │  (Se añade al historial)       │
         └────────────────────────────────┘
```

---

## Archivo: `/app/api/chat/route.ts`

### ¿Qué hace?

Es el **cerebro de la conversación**. Recibe mensajes del usuario y decide si necesita buscar clima.

### Flujo Principal

```typescript
// 1. Usuario envía mensaje
POST /api/chat
{
  message: "¿Clima en Talca?",
  messages: [...historial],
  cache: {...datos en caché}
}

// 2. Validar si es petición de clima
esSolicitudClimaValida(mensaje) → true

// 3. Detectar período del día (tarde, noche, etc.)
detectarPerioDoDelDia(mensaje) → periods: ['day', 'eve']

// 4. Si ya tenemos datos en caché, responder directamente
if (cache.lastCities.includes('Talca')) → formatearPeriodoDelDia()

// 5. Si no, llamar a Groq LLM para extraer info
fetch(GROQ_API_URL, {
  model: 'llama-3.3-70b-versatile',
  messages: [systemPrompt, ...historial, userMessage]
})

// 6. LLM responde con JSON
{
  "needs_weather": true,
  "city": "Talca",
  "type": "forecast",
  "days_count": 1,
  "start_from": 0
}

// 7. Llamar a /api/weather
fetch('/api/weather', {
  city: 'Talca',
  type: 'forecast'
})

// 8. Generar respuesta natural
generateForecastResponse(weatherData, ...)

// 9. Devolver al usuario
{
  message: "En Talca hace 22°C...",
  weatherData: {...datos}
}
```

### Funciones Importantes

#### `esSolicitudClimaValida(mensaje: string)`
**¿Qué hace?** Valida que el usuario realmente pregunta por clima.

```typescript
// ✅ VÁLIDO
"¿Clima en Talca?"
"¿Cómo estará mañana?"
"Dime el clima para el próximo lunes"

// ❌ INVÁLIDO
"¿Hasta cuántos días puedes?"  (pregunta sobre bot)
"Hola, ¿cómo estás?"          (conversación casual)
```

#### `detectarPerioDoDelDia(mensaje: string)`
**¿Qué hace?** Identifica si pregunta por un período específico del día.

```typescript
// Detecta y mapea a temperaturas disponibles
"¿y para más tarde?"     → ['day', 'eve']  (tarde/atardecer)
"¿Esta noche cómo?"      → ['eve', 'night'] (noche)
"¿Temprano mañana?"      → ['morn']        (mañana)
```

#### `generarSugerenciasContextuales()`
**¿Qué hace?** Genera preguntas de seguimiento inteligentes.

```typescript
// Si está haciendo calor (>28°C)
"¿Llevas protector solar?"
"¿Quieres recomendaciones para el calor?"

// Si es clima normal
"¿Necesitas algo más?"
"¿De otra ciudad?"
```

---

## Archivo: `/app/api/weather/route.ts`

### ¿Qué hace?

**Obtiene datos meteorológicos reales** de Open-Meteo API y los transforma a un formato estándar.

### Flujo

```typescript
POST /api/weather
{
  city: "Talca",
  type: "forecast"  // o "current"
}

↓

// 1. Geocoding: Convertir ciudad a coordenadas
const coords = await getCoordinates("Talca")
// Resultado: { lat: -35.4, lon: -71.6 }

// 2. Llamar Open-Meteo API
fetch('https://api.open-meteo.com/v1/forecast?latitude=-35.4&longitude=-71.6&...')

// 3. Procesar respuesta
data.daily.temperature_2m_max    → 28°C
data.daily.weather_code[0]       → 80 (lluvia)
data.hourly.temperature_2m       → [temp cada hora]

// 4. Calcular temperaturas por período
morn: promedio(6-9h)    → 18°C
day:  máximo(12-15h)    → 28°C
eve:  máximo(18-21h)    → 22°C
night: mínimo(0-3h)     → 15°C

// 5. Devolver formato estándar
{
  city: "Talca",
  country: "Chile",
  list: [
    {
      dt: 1733192400,
      temp: { min: 15, max: 28, morn: 18, day: 28, eve: 22, night: 15 },
      weather: [{ description: "Lluvia", icon: "10d" }],
      humidity: 65,
      ...
    }
  ]
}
```

### Temperaturas Disponibles

Open-Meteo devuelve 4 temperaturas por día:

| Período | Horas | Temp |
|---------|-------|------|
| **morn** | 06:00-09:00 | 18°C |
| **day** | 12:00-15:00 | 28°C |
| **eve** | 18:00-21:00 | 22°C |
| **night** | 00:00-03:00 | 15°C |

Esto permite responder: "¿y para más tarde?" sin nuevas llamadas API.

---

## Archivos Componentes: `ChatContainer.tsx`

### ¿Qué hace?

**Gestiona el estado de la conversación** en el navegador.

### Estado Principal

```typescript
interface ChatContainer {
  messages: Message[]              // Historial de chat
  isLoading: boolean              // ¿Esperando respuesta?
  userLocation: { lat, lon }      // Ubicación del usuario
  cacheRef: ConversationCache     // Cache en caché
}
```

### Cache de Conversación

```typescript
interface ConversationCache {
  lastCities: string[]            // Últimas 5 ciudades buscadas
  weatherHistory: [{              // Historial de búsquedas
    city: string,
    timestamp: number,
    type: 'current' | 'forecast'
  }],
  userPreferences: {              // Preferencias del usuario
    timezone?: number,
    language: string
  },
  pendingQuestion?: {             // Pregunta pendiente de respuesta
    type: 'city_confirmation',
    city: string
  }
}
```

### Flujo de Mensaje

```typescript
// 1. Usuario escribe y envía
handleSendMessage(userMessage)

// 2. Agregar mensaje a historial
setMessages([...messages, {role: 'user', content: userMessage}])

// 3. Llamar a /api/chat
fetch('/api/chat', {
  body: {
    message: userMessage,
    messages: messagesFor LLM,
    cache: cacheRef.current
  }
})

// 4. Mostrar loading
setIsLoading(true)

// 5. Recibir respuesta
const response = await fetch(...)

// 6. Agregar respuesta al historial
setMessages([...messages, {role: 'assistant', content: response}])

// 7. Actualizar caché si tiene datos de clima
if (response.weatherData) {
  updateCache(response.weatherData)
}

// 8. Dejar de cargar
setIsLoading(false)
```

---

## Resumen del Flujo Completo

```
Usuario escribe "¿Clima en Talca?"
        ↓
ChatContainer envía a /api/chat
        ↓
Chat verifica: ¿es petición de clima? ✅
        ↓
Chat detecta: ¿período específico del día? 
        ↓
Si hay caché: responder con datos existentes
Si no: llamar a Groq LLM
        ↓
LLM extrae: {city: "Talca", type: "forecast"}
        ↓
Llamar a /api/weather
        ↓
Weather obtiene coords → llama Open-Meteo → transforma datos
        ↓
Devuelve: {temp, humidity, wind, etc}
        ↓
Chat genera respuesta natural con recomendaciones
        ↓
Devuelve al ChatContainer
        ↓
Usuario ve: "En Talca hace 22°C, lleva chaqueta..."
```

---

## APIs Externas Usadas

### 1. **Groq API** (LLM)
- **Propósito**: Entender lenguaje natural, extraer intención
- **Modelo**: `llama-3.3-70b-versatile`
- **Costo**: Según plan (nosotros usamos free tier)
- **Endpoint**: `https://api.groq.com/openai/v1/chat/completions`

### 2. **Open-Meteo API** (Weather)
- **Propósito**: Obtener datos meteorológicos reales
- **Costo**: **GRATIS** (sin límites)
- **Cobertura**: 195 países
- **Endpoint**: `https://api.open-meteo.com/v1/forecast`

### 3. **Geocoding API** (Open-Meteo)
- **Propósito**: Convertir nombre de ciudad a coordenadas
- **Costo**: **GRATIS**
- **Endpoint**: `https://geocoding-api.open-meteo.com/v1/search`

---

## Variables de Entorno Necesarias

```bash
# En .env.local
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxx
```

Es la única variable requerida. Open-Meteo y Geocoding no necesitan autenticación.
