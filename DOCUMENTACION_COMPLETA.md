# 📚 DOCUMENTACIÓN COMPLETA - WEATHERBOT PWA

## 📑 Tabla de Contenidos

1. [Estructura del Proyecto](#estructura)
2. [Archivos Principales Comentados](#archivos)
3. [Cómo Funciona el Chat](#flujo-chat)
4. [PWA y Instalación](#pwa)
5. [APIs Usadas](#apis)
6. [Variables de Entorno](#env)

---

## Estructura del Proyecto {#estructura}

```
proyecto/
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts          ⭐ CORE: Procesa mensajes y detecta clima
│   │   └── weather/
│   │       └── route.ts          ⭐ CORE: Obtiene datos meteorológicos
│   ├── components/
│   │   ├── ChatContainer.tsx     ⭐ CORE: Gestiona estado del chat
│   │   ├── ChatInput.tsx         ⭐ CORE: Input para escribir mensajes
│   │   ├── ChatMessage.tsx       Mostrar mensajes
│   │   └── LoadingDots.tsx       Animación de carga
│   ├── lib/
│   │   └── types.ts             Tipos TypeScript
│   ├── layout.tsx               🔧 Layout principal con PWA meta tags
│   ├── register-sw.ts           🔧 Registra Service Worker
│   ├── globals.css              Estilos globales
│   └── page.tsx                 Página principal
├── public/
│   ├── sw.js                    🔧 Service Worker (offline + caché)
│   ├── manifest.json            🔧 PWA manifest
│   ├── icon-192.png             Icono PWA (pequeño)
│   ├── icon-512.png             Icono PWA (grande)
│   └── icon-maskable.png        Icono PWA (adaptativo)
├── .env.local                   🔧 Variables de entorno (API keys)
└── next.config.ts               Configuración Next.js

⭐ = Archivos críticos para entender la app
🔧 = Archivos PWA y configuración
```

---

## Archivos Principales Comentados {#archivos}

### 1. **`register-sw.ts`** - Registrador del Service Worker

```typescript
/**
 * ¿QUÉ HACE?
 * - Se ejecuta en el navegador (cliente)
 * - Registra el Service Worker que está en /public/sw.js
 * - El SW permite: offline, caché, instalación PWA
 */

'use client'; // Necesario en Next.js 13+

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .then(() => console.log('✅ SW registrado'))
    .catch((err) => console.error('❌ Error SW:', err));
}
```

**Resultado**: Cuando el usuario abre tu app, el SW se instala automáticamente.

---

### 2. **`/public/sw.js`** - Service Worker

```javascript
/**
 * ¿QUÉ HACE?
 * - Intercepta TODAS las peticiones HTTP
 * - Cachea archivos para funcionar offline
 * - Estrategia: Network-First (intenta internet, luego caché)
 */

// INSTALL: Primera vez que se instala
self.addEventListener('install', event => {
  // Cachear archivos estáticos
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// ACTIVATE: Cuando se activa
self.addEventListener('activate', event => {
  // Limpiar cachés viejos
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// FETCH: Cuando se realiza una petición
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    // Intentar internet primero
    fetch(event.request)
      .then(response => {
        // Si exitosa, guardar en caché
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla, usar caché
        return caches.match(event.request)
          .then(response => response || new Response('Offline'));
      })
  );
});
```

**Ventaja**: La app funciona sin conexión y carga más rápido.

---

### 3. **`layout.tsx`** - Configuración PWA

```typescript
/**
 * ¿QUÉ HACE?
 * - Define meta tags para PWA
 * - Links al manifest.json
 * - Configuración para iOS y Android
 */

export const metadata: Metadata = {
  title: "WheaterBot - Clima con IA",
  description: "Chatbot meteorológico...",
  
  // Viewport: se vea bien en móviles
  viewport: "width=device-width, initial-scale=1, maximum-scale=5",
  
  // Para iOS (web app mode)
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WheaterBot",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        {/* ⭐ NECESARIO PARA PWA */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon-192.png" />
        <meta name="theme-color" content="#0f3460" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

**Resultado**: Chrome muestra banner de instalación automáticamente.

---

### 4. **`/api/chat/route.ts`** - Cerebro del Chat ⭐

```typescript
/**
 * ¿QUÉ HACE?
 * 1. Recibe mensajes del usuario
 * 2. Valida si es petición de clima
 * 3. Detecta período del día (tarde, noche, etc)
 * 4. Llama a Groq LLM para entender intención
 * 5. Si necesita clima, llama a /api/weather
 * 6. Genera respuesta natural
 */

// Funciones clave:

/**
 * esSolicitudClimaValida(mensaje)
 * Valida si el usuario realmente pide clima
 * 
 * ✅ VÁLIDO: "¿Clima en Talca?"
 * ❌ INVÁLIDO: "¿Hasta cuántos días puedes?"
 */

/**
 * detectarPerioDoDelDia(mensaje)
 * Identifica si pregunta por un período específico
 * 
 * "¿y para más tarde?" → ['day', 'eve'] (tarde/atardecer)
 * "¿Esta noche?" → ['eve', 'night'] (noche)
 * "¿Temprano?" → ['morn'] (mañana)
 */

/**
 * generarSugerenciasContextuales()
 * Preguntas de seguimiento inteligentes
 * 
 * Si calor (>28°C): "¿Llevas protector?"
 * Si frío (<5°C): "¿Necesitas abrigo?"
 * Normal: "¿De otra ciudad?"
 */

/**
 * generateForecastResponse()
 * Genera respuesta natural con datos del clima
 * - Formatea temperaturas
 * - Añade recomendaciones
 * - Sugiere preguntas de seguimiento
 */
```

**Flujo**:
```
Usuario: "¿Clima en Talca?"
   ↓
esSolicitudClimaValida() → true
   ↓
Llamar Groq LLM → {city: "Talca", needs_weather: true}
   ↓
Llamar /api/weather → {temp: 22, humidity: 65, ...}
   ↓
generateForecastResponse() → "En Talca hace 22°C..."
   ↓
Mostrar respuesta al usuario
```

---

### 5. **`/api/weather/route.ts`** - Obtiene Datos Meteorológicos

```typescript
/**
 * ¿QUÉ HACE?
 * 1. Recibe ciudad
 * 2. Geocoding: Convierte ciudad a coordenadas
 * 3. Llama Open-Meteo API
 * 4. Transforma datos a formato estándar
 * 5. Devuelve: temp, humedad, viento, etc
 */

async function getCoordinates(city: string) {
  // Geocoding API: "Talca" → {lat: -35.4, lon: -71.6}
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${city}`
  );
  return response.json();
}

async function getForecast(lat: number, lon: number) {
  // Open-Meteo API: Obtiene pronóstico
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
  );
  
  const data = await response.json();
  
  // Procesa datos horarios para calcular temperaturas por período
  morn = promedio(6-9h)    // Mañana
  day = máximo(12-15h)     // Tarde
  eve = máximo(18-21h)     // Atardecer
  night = mínimo(0-3h)     // Noche
  
  return { city, list: [{ temp: {morn, day, eve, night}, ... }] };
}
```

**Ventaja**: Open-Meteo es GRATIS y sin límites.

---

### 6. **`ChatContainer.tsx`** - Gestiona Estado del Chat

```typescript
/**
 * ¿QUÉ HACE?
 * - Almacena historial de mensajes
 * - Gestiona loading
 * - Mantiene caché de contexto
 * - Obtiene geolocalización del usuario
 */

interface ConversationCache {
  lastCities: string[]           // Últimas 5 ciudades
  weatherHistory: Array<{...}>   // Historial de búsquedas
  userPreferences: {...}         // Preferencias del usuario
  pendingQuestion?: {...}        // Pregunta pendiente
}

export default function ChatContainer() {
  const [messages, setMessages] = useState([])  // Historial
  const [isLoading, setIsLoading] = useState()  // ¿Cargando?
  const cacheRef = useRef<ConversationCache>() // Cache
  
  const handleSendMessage = async (userMessage: string) => {
    // 1. Agregar mensaje a historial
    setMessages([...messages, {role: 'user', content: userMessage}])
    
    // 2. Llamar a /api/chat
    const response = await fetch('/api/chat', {
      body: {message, messages, cache: cacheRef.current}
    })
    
    // 3. Agregar respuesta
    setMessages(prev => [...prev, {role: 'assistant', ...response}])
    
    // 4. Actualizar caché si hay datos de clima
    if (response.weatherData) {
      updateCache(response.weatherData)
    }
  }
}
```

---

## Cómo Funciona el Chat {#flujo-chat}

### Ejemplo Completo: Usuario pregunta "¿Clima en Talca?"

```
USUARIO ESCRIBE:
"¿Clima en Talca?"
   │
   ▼
ChatContainer.handleSendMessage()
   │
   ├─ Agregar a historial
   ├─ setLoading(true)
   └─ fetch('/api/chat', {message, cache})
        │
        ▼
/api/chat/route.ts POST handler
   │
   ├─ esSolicitudClimaValida() → true ✅
   ├─ detectarPerioDoDelDia() → false (no especifica periodo)
   │
   ├─ Llamar Groq LLM:
   │  - System Prompt: "Eres WeatherBot, asistente meteorológico"
   │  - Historial: [messages previos]
   │  - Mensaje: "¿Clima en Talca?"
   │
   ├─ Groq responde JSON:
   │  {
   │    "needs_weather": true,
   │    "city": "Talca",
   │    "type": "forecast",
   │    "days_count": 1,
   │    "start_from": 0
   │  }
   │
   ├─ fetch('/api/weather', {city: 'Talca', type: 'forecast'})
   │  │
   │  ▼
   │  /api/weather/route.ts POST handler
   │  │
   │  ├─ getCoordinates('Talca') 
   │  │  → {lat: -35.4, lon: -71.6}
   │  │
   │  ├─ fetch Open-Meteo API
   │  │  → {daily, hourly data}
   │  │
   │  ├─ Procesar:
   │  │  - min temp: 15°C
   │  │  - max temp: 28°C
   │  │  - morn: 18°C
   │  │  - day: 28°C
   │  │  - eve: 22°C
   │  │  - night: 15°C
   │  │  - humidity: 65%
   │  │  - wind: 10 km/h
   │  │
   │  └─ return {city, list: [...]}
   │
   ├─ enrichedWeatherData = {
   │    city: 'Talca',
   │    list: [{temp, humidity, wind, ...}]
   │  }
   │
   ├─ generarSugerenciasContextuales(forecast, 1, 0, 'Talca', 28)
   │  → ["¿Llevas protector solar?", "¿Quieres recomendaciones?"]
   │
   ├─ generateForecastResponse(
   │    weatherData, 'Talca', messages, 1, 0, sugerencias
   │  )
   │  │
   │  ├─ Llamar Groq LLM de nuevo:
   │  │  "Genera respuesta natural sobre el clima"
   │  │
   │  └─ Respuesta: "En Talca hace 28°C hoy..."
   │
   └─ return {
        message: "En Talca hace 28°C...",
        weatherData: {...},
        needsWeather: true
      }

ChatContainer recibe respuesta:
   │
   ├─ Agregar a historial
   ├─ updateCache(weatherData)
   │  - Agregar 'Talca' a lastCities
   │  - Guardar en weatherHistory
   │
   ├─ setLoading(false)
   └─ scrollToBottom()

USUARIO VE:
┌─────────────────────────────────┐
│ En Talca hace 28°C hoy...       │
│ Temperatura máxima: 28°C        │
│                                 │
│ 🌡️ ALERTA CALOR EXTREMO:       │
│ - Protección solar SPF 50+      │
│ - Mantente hidratado            │
│ - Evita horas pico              │
│                                 │
│ ¿Llevas protector solar?        │
└─────────────────────────────────┘
```

---

## PWA y Instalación {#pwa}

### ¿Qué es PWA?

PWA = Progressive Web App
- App web que se instala como aplicación nativa
- Funciona en navegador pero parece app
- Funciona offline
- Se actualiza automáticamente

### Instalación en Android

**Paso 1**: Abrir en Chrome
```
https://tuapp.vercel.app
```

**Paso 2**: Esperar banner
```
┌─────────────────────────────┐
│ Instalar WheaterBot         │
│ Agregar a pantalla de inicio│
│ ┌──────────────┐ ┌────────┐│
│ │   Instalar   │ │  No    ││
│ └──────────────┘ └────────┘│
└─────────────────────────────┘
```

**Paso 3**: Hacer clic en "Instalar"

**Resultado**: App en pantalla de inicio

### Archivos PWA Necesarios

```
✅ manifest.json        Define app (nombre, icono, etc)
✅ sw.js               Service Worker (offline + caché)
✅ icon-192.png        Icono pequeño
✅ icon-512.png        Icono grande
✅ icon-maskable.png   Icono adaptativo Android
✅ layout.tsx          Meta tags
✅ register-sw.ts      Registra Service Worker
✅ HTTPS (Vercel)      Necesario para PWA
```

---

## APIs Usadas {#apis}

### 1. **Groq API** - LLM (Entendimiento de Lenguaje)

```
Propósito: Entiende lo que dice el usuario en español natural
Modelo: llama-3.3-70b-versatile
Costo: Free tier disponible
Endpoint: https://api.groq.com/openai/v1/chat/completions

Ejemplo:
POST /chat/completions
{
  "messages": [
    {"role": "system", "content": "Eres WeatherBot..."},
    {"role": "user", "content": "¿Clima en Talca?"}
  ],
  "model": "llama-3.3-70b-versatile"
}

Respuesta:
{
  "needs_weather": true,
  "city": "Talca",
  "type": "forecast"
}
```

### 2. **Open-Meteo API** - Datos Meteorológicos

```
Propósito: Obtener datos climáticos en tiempo real
Costo: GRATIS (sin límites)
Cobertura: 195 países
No requiere API key

Endpoint 1 - Geocoding (ciudad → coordenadas):
GET /v1/search?name=Talca
→ {latitude: -35.4, longitude: -71.6}

Endpoint 2 - Weather (coordenadas → clima):
GET /v1/forecast?latitude=-35.4&longitude=-71.6
→ {
    daily: {
      temperature_2m_max: [28, 26, 25, ...],
      temperature_2m_min: [15, 14, 13, ...],
      weather_code: [80, 61, 3, ...],
      ...
    },
    hourly: {
      temperature_2m: [16, 15, 14, ..., 28, 27, 26, ..., 22, 21, ..., 18],
      ...
    }
  }
```

### 3. **Vercel API** - Hosting

```
Propósito: Alojar la app
Costo: Free tier disponible
URL: https://[proyecto].vercel.app
Ventajas:
- HTTPS automático ✅ (necesario para PWA)
- Deploy automático con GitHub
- Función serverless (APIs)
```

---

## Variables de Entorno {#env}

### Archivo: `.env.local`

```bash
# Groq API Key (obtener de https://console.groq.com)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxx
```

### ¿Cómo obtener GROQ_API_KEY?

1. Ir a https://console.groq.com
2. Crear cuenta (gratis)
3. Ir a "API Keys"
4. Copiar la key
5. Pegar en .env.local
6. Hacer `npm run dev` (recarga variable)

**Nota**: Open-Meteo no requiere key. Vercel tampoco (solo URL).

---

## Resumen Técnico

### Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes (serverless)
- **LLM**: Groq (llama-3.3-70b-versatile)
- **Weather**: Open-Meteo (free)
- **Hosting**: Vercel
- **PWA**: Service Worker + Manifest
- **Cache**: IndexedDB (navegador) + Service Worker

### Tecnologías Principales

| Tecnología | Para qué | Gratuito |
|-----------|---------|---------|
| Next.js | Framework web fullstack | ✅ |
| React | UI components | ✅ |
| TypeScript | Tipado estático | ✅ |
| Tailwind | Estilos | ✅ |
| Groq API | LLM | ✅ (free tier) |
| Open-Meteo | Datos clima | ✅ |
| Vercel | Hosting | ✅ (free tier) |
| Service Worker | Offline + PWA | ✅ |

### Costos

```
Opción 1: TOTALMENTE GRATIS
- Groq: free tier
- Open-Meteo: gratis siempre
- Vercel: free tier
- Total: $0

Opción 2: Escalado (pagado)
- Groq: $0.05 / 1M tokens
- Open-Meteo: $0 (siempre gratis)
- Vercel: $20+ / mes
- Total: depende del uso
```

---

## Estructura de Directorio Final

```
weatherbot-pwa/
│
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts          [CORE] Chat logic
│   │   └── weather/
│   │       └── route.ts          [CORE] Weather data
│   ├── components/
│   │   ├── ChatContainer.tsx     [CORE] Chat state
│   │   ├── ChatInput.tsx         [CORE] Input
│   │   ├── ChatMessage.tsx       Display
│   │   └── LoadingDots.tsx       Loading
│   ├── lib/
│   │   └── types.ts              TypeScript types
│   ├── layout.tsx                [PWA] Meta tags
│   ├── register-sw.ts            [PWA] SW register
│   ├── globals.css               Styles
│   └── page.tsx                  Main page
│
├── public/
│   ├── sw.js                     [PWA] Service Worker
│   ├── manifest.json             [PWA] PWA Manifest
│   ├── icon-192.png              [PWA] Icon small
│   ├── icon-512.png              [PWA] Icon large
│   └── icon-maskable.png         [PWA] Icon adaptive
│
├── .env.local                    🔐 API Keys
├── next.config.ts                Next.js config
├── tsconfig.json                 TypeScript config
├── package.json                  Dependencies
│
└── DOCS (archivos de documentación)
    ├── GUIA_PWA_INSTALACION.md
    ├── EXPLICACION_APIS.md
    ├── EXPLICACION_MANIFEST.md
    └── CAMBIOS_PERIODOS_DIA.md
```

---

## Próximos Pasos

1. ✅ **Ya completado**: 
   - Chat funcional
   - PWA instalable
   - Detección de períodos del día
   - Service Worker con caché

2. 🟡 **Opcional**:
   - Mejorar caché de API (offline completo)
   - Historial persistente (localStorage)
   - Dark mode
   - Soporte multi-idioma
   - Notificaciones push

3. 🚀 **Escalado**:
   - Base de datos (para guardar historial)
   - Autenticación de usuarios
   - Estadísticas de uso
   - Panel de administración

---

**¡Tu PWA está lista para producción! 🎉**
