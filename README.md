# 🌤️ WheaterBot - Chatbot Meteorológico con IA

Una **Progressive Web App (PWA)** que te proporciona pronósticos meteorológicos inteligentes usando IA. ¡Instálala en Android como una app nativa!

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-active-success)

---

## ✨ Características

### 🤖 IA Conversacional
- Chatbot que entiende español natural
- Powered by **Groq LLM** (llama-3.3-70b)
- Respuestas contextuales e inteligentes

### 🌍 Datos Meteorológicos Precisos
- API **Open-Meteo** (100% gratis, sin límites)
- Cobertura mundial (195 países)
- Pronóstico hasta 7 días
- Actualización en tiempo real

### 📱 Progressive Web App
- Instálate como app nativa en Android
- Funciona **offline** con Service Worker
- Cache inteligente de datos
- Instalación con 1 clic

### 🎯 Funcionalidades Avanzadas
- ✅ Detección automática de período del día (tarde, noche, madrugada)
- ✅ Respuestas específicas por hora (ej: "¿y para más tarde?")
- ✅ Recomendaciones según temperatura
- ✅ Memoria de conversación (cache de contexto)
- ✅ Captura de geolocalización (opcional, para precisión)
- ✅ Historial de ciudades consultadas
- ✅ Validación inteligente de solicitudes

---

## 🚀 Inicio Rápido

### Requisitos
- Node.js 18+
- npm o yarn
- API key de Groq (gratis en [console.groq.com](https://console.groq.com))

### Instalación Local

1. **Clonar el repositorio**
```bash
git clone https://github.com/ExOBrienX/WheaterBot-PWA.git
cd WheaterBot-PWA
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
# Crear archivo .env.local
echo "GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxx" > .env.local
```

4. **Ejecutar en desarrollo**
```bash
npm run dev
```

5. **Abrir en navegador**
```
http://localhost:3000
```

---

## 📱 Instalación como PWA

### En Android (Chrome)

1. Abre la app en Chrome: `https://weatherbot-pwa.vercel.app`
2. Espera a que aparezca el banner **"Instalar"**
3. Presiona **"Instalar"**
4. ¡Listo! La app aparecerá en tu pantalla principal

### En iOS (Safari)

1. Abre en Safari
2. Presiona el ícono de compartir
3. Selecciona **"Añadir a pantalla de inicio"**
4. Usa como app normal

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────┐
│         NAVEGADOR (Frontend - React)            │
│                                                 │
│  ChatContainer → ChatInput → ChatMessage        │
│        ↓                                         │
│   Service Worker (Offline + Cache)             │
└────────────────────┬────────────────────────────┘
                     │
        POST /api/chat (Next.js Serverless)
                     │
        ┌────────────┴────────────┐
        ↓                         ↓
    Groq LLM              /api/weather
    (IA)                  (Open-Meteo)
                          
    ├─ Geocoding         ├─ Datos diarios
    ├─ Validación        ├─ Datos horarios
    └─ Generación        └─ Transformación
```

### Stack Técnico

| Componente | Tecnología | Propósito |
|-----------|-----------|----------|
| **Frontend** | Next.js 14, React, TypeScript | UI interactiva |
| **Backend** | Next.js API Routes | Lógica de servidor |
| **LLM** | Groq (llama-3.3-70b) | IA conversacional |
| **Weather** | Open-Meteo API | Datos meteorológicos |
| **Hosting** | Vercel | Deploy automático |
| **PWA** | Service Worker + Manifest | Instalación offline |
| **Styles** | Tailwind CSS | Diseño responsivo |

---

## 📁 Estructura del Proyecto

```
weatherbot-pwa/
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts              # Lógica del chat ⭐
│   │   └── weather/
│   │       └── route.ts              # Obtiene clima ⭐
│   ├── components/
│   │   ├── ChatContainer.tsx         # Estado del chat ⭐
│   │   ├── ChatInput.tsx             # Input de texto
│   │   ├── ChatMessage.tsx           # Mensaje individual
│   │   └── LoadingDots.tsx           # Animación
│   ├── lib/
│   │   └── types.ts                  # TypeScript types
│   ├── layout.tsx                    # Meta tags PWA 🔧
│   ├── register-sw.ts                # Registro SW 🔧
│   ├── globals.css                   # Estilos globales
│   └── page.tsx                      # Página principal
│
├── public/
│   ├── sw.js                         # Service Worker 🔧
│   ├── manifest.json                 # PWA Manifest 🔧
│   ├── icon-192.png                  # Icono PWA
│   ├── icon-512.png                  # Icono PWA
│   └── icon-maskable.png             # Icono adaptativo
│
├── .env.local                        # Variables de entorno 🔐
├── next.config.ts                    # Configuración Next.js
├── tsconfig.json                     # Configuración TypeScript
└── package.json                      # Dependencias

⭐ = Core functionality
🔧 = PWA configuration
🔐 = Secrets
```

---

## 🔧 Configuración

### Variables de Entorno

```bash
# .env.local
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxx
```

**Cómo obtener GROQ_API_KEY:**
1. Ir a https://console.groq.com
2. Crear cuenta (gratis)
3. Ir a "API Keys"
4. Copiar la key
5. Pegar en .env.local

---

## 💬 Cómo Usar

### Ejemplos de Preguntas

```
✅ "¿Clima en Talca?"
✅ "¿Cómo estará mañana?"
✅ "¿Y para más tarde?"
✅ "Clima del próximo lunes"
✅ "¿Va a llover esta semana?"
✅ "Dime el clima para el viernes"
```

### Casos de Uso

**Caso 1: Clima Actual**
```
Usuario: ¿Clima en Santiago?
Bot: En Santiago hace 22°C... 🤖
```

**Caso 2: Período Específico**
```
Usuario: ¿Y para más tarde como estará? (a las 03:00 AM)
Bot: Para hoy por la tarde: 28°C... ⚡ (sin llamada API extra)
```

**Caso 3: Pronóstico Futuro**
```
Usuario: ¿Cómo estará el próximo lunes?
Bot: El lunes será... 📅
```

---

## 📚 Documentación

Documentación completa y ejemplos:

| Documento | Descripción |
|-----------|----------|
| **[DOCUMENTACION_COMPLETA.md](./DOCUMENTACION_COMPLETA.md)** | 📖 Guía completa (empieza aquí) |
| **[EXPLICACION_APIS.md](./EXPLICACION_APIS.md)** | 🔌 Arquitectura y APIs |
| **[GUIA_PWA_INSTALACION.md](./GUIA_PWA_INSTALACION.md)** | 📱 Cómo instalar como PWA |
| **[EXPLICACION_MANIFEST.md](./EXPLICACION_MANIFEST.md)** | ⚙️ Configuración del manifest |
| **[CAMBIOS_PERIODOS_DIA.md](./CAMBIOS_PERIODOS_DIA.md)** | 🕐 Feature de períodos del día |

---

## 🎯 Características por Versión

### v1.0.0 (Actual)
- ✅ Chat conversacional con IA
- ✅ Pronósticos meteorológicos
- ✅ Instalación como PWA
- ✅ Offline functionality
- ✅ Detección de períodos del día
- ✅ Cache de contexto
- ✅ Recomendaciones inteligentes

### v1.1.0 (Planeado)
- 🟡 Caché offline completo
- 🟡 Historial persistente (localStorage)
- 🟡 Dark mode
- 🟡 Multi-idioma

### v2.0.0 (Futuro)
- 🔮 Notificaciones push
- 🔮 Base de datos
- 🔮 Autenticación de usuarios
- 🔮 Panel de estadísticas

---

## 🚀 Deploy en Vercel

La forma más fácil de desplegar:

1. **Conectar a GitHub**
   - Forka el repo o conecta tu cuenta
   
2. **Crear en Vercel**
   - Ve a https://vercel.com/new
   - Selecciona tu repo
   - Agrega `GROQ_API_KEY` en variables de entorno
   
3. **Deploy**
   - Presiona Deploy
   - ¡Listo! La app estará en línea

**URL de demostración:**
```
https://weatherbot-pwa.vercel.app
```

---

## 📊 Rendimiento

### Tiempos de Respuesta
- Primera carga: ~2-3s
- Respuesta de chat: ~500-1000ms
- Respuesta con caché: <100ms

### Tamaño de Bundle
- JS inicial: ~150KB
- CSS: ~30KB
- Total gzip: ~50KB

### Offline
- ✅ Funciona sin conexión
- ✅ Cache automático
- ✅ Sincronización cuando conecta

---

## 🔐 Seguridad

- ✅ API keys en variables de entorno (.env.local)
- ✅ Groq API: solo en backend (servidor)
- ✅ Open-Meteo: sin autenticación requerida
- ✅ HTTPS en producción (Vercel)
- ✅ No almacena datos personales

---

## 💰 Costos

| Servicio | Costo | Notas |
|---------|-------|-------|
| **Groq API** | Free tier | Gratis hasta cierto uso |
| **Open-Meteo** | Gratis | Sin límites, siempre gratis |
| **Vercel** | Free tier | Hosting gratis para personal |
| **Total** | **$0** | Totalmente gratuito |

---

## 🤝 Contribuir

Las contribuciones son bienvenidas. Para cambios importantes:

1. Fork el repo
2. Crea una rama (`git checkout -b feature/AmazingFeature`)
3. Commit los cambios (`git commit -m 'Add AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📝 Licencia

Este proyecto está bajo la licencia MIT. Ver archivo [LICENSE](./LICENSE) para más detalles.

---

## 👥 Autor

**ExOBrienX**
- GitHub: [@ExOBrienX](https://github.com/ExOBrienX)
- Proyecto: [WheaterBot-PWA](https://github.com/ExOBrienX/WheaterBot-PWA)

---

## 📞 Soporte

¿Problemas? Abre un [issue](https://github.com/ExOBrienX/WheaterBot-PWA/issues) en GitHub.

---

## 🙏 Agradecimientos

- **Groq** - Por el poderoso LLM gratis
- **Open-Meteo** - Por la API de clima gratis
- **Vercel** - Por hosting increíble
- **Next.js** - Por el framework amazing

---

## 📈 Estadísticas

```
Líneas de código: ~2500
Componentes: 4
APIs integradas: 3
Idiomas soportados: TypeScript, JavaScript
Países cubiertos: 195 (Open-Meteo)
```

---

**¡Gracias por usar WheaterBot! 🌤️**

Made with ❤️ by ExOBrienX
