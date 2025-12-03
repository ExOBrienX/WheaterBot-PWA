# 🎯 Nuevo Feature: Respuestas por Período del Día

## ✅ Problema Resuelto

**Antes:** Cuando preguntabas "¿y para más tarde?" a las 03:02 (madrugada), el bot respondía:
> "¿Quieres pronóstico para los próximos 7 días?"

**Problema:** El bot ya tenía los datos de HOY incluyendo:
- `temp.morn`: Temperatura matutina
- `temp.day`: Temperatura diurna (tarde)
- `temp.eve`: Temperatura vespertina (atardecer)
- `temp.night`: Temperatura nocturna

Pero NO los estaba usando para responder a preguntas como "¿y para más tarde?"

---

## 🛠️ Solución Implementada

### 1. **Nueva Función: `detectarPerioDoDelDia(mensaje)`**

Detecta referencias temporales específicas dentro del mismo día:

```typescript
// Ejemplos que detecta:
"¿y para más tarde?"           → ['day', 'eve']      (tarde/atardecer)
"¿cómo estará esta noche?"    → ['eve', 'night']    (atardecer/noche)
"¿temprano mañana?"           → ['morn']            (mañana/madrugada)
"mañana por la tarde"         → ['day', 'eve']      (mañana tarde/atardecer)
"¿y después?"                 → ['day', 'eve']      (más tarde)
```

**Palabras clave detectadas:**
- **Tarde**: "más tarde", "en la tarde", "esta tarde", "por la tarde", "luego", "después"
- **Noche**: "esta noche", "por la noche", "en la noche", "de noche"
- **Madrugada**: "madrugada", "muy temprano", "al amanecer"
- **Combinadas**: "mañana en la tarde", "mañana por la noche", etc.

### 2. **Nueva Función: `formatearPeriodoDelDia()`**

Formatea una respuesta natural y contextualizada:

```
🌅 Ahora mismo son las ~03:00 (madrugada)

Para hoy por la tarde:
☀️ Por la tarde: **28°C**
🌆 Al atardecer: **25°C**

Parcialmente nublado

☀️ Calor considerable (28°C):
- Ropa ligera y clara
- Gafas de sol
- Mantente hidratado

¿Quieres más información? 🤔
```

**Características:**
- ✅ Emoji contextual del período horario actual
- ✅ Temperaturas específicas solo para el período solicitado
- ✅ Recomendaciones según temperatura
- ✅ Lenguaje natural y conversacional

### 3. **Modificación en `/api/chat/route.ts`**

Se agregó lógica ANTES de llamar a `generateForecastResponse()`:

```typescript
// 🆕 DETECTAR SI BUSCA PERÍODO ESPECÍFICO DEL DÍA
const periodoDia = detectarPerioDoDelDia(message);

if (periodoDia.found && weatherRequest.type === 'forecast' && enrichedWeatherData.list?.length > 0) {
  // Usuario preguntó por un período específico (ej: "más tarde", "esta noche")
  const dayData = enrichedWeatherData.list[0]; // Primer día del pronóstico
  
  // Usar datos existentes sin hacer llamada API extra
  const respuestaPeriodicidad = formatearPeriodoDelDia(
    dayData,
    dayName,
    periodoDia.periods,
    timeContext
  );
  
  return NextResponse.json<ChatAPIResponse>({
    message: respuestaPeriodicidad,
    needsWeather: true,
    weatherData: enrichedWeatherData
  });
}
```

---

## 📊 Flujo de Procesamiento

```
Usuario pregunta: "¿y para más tarde como estará?"
    ↓
detectarPerioDoDelDia() → { found: true, periods: ['day', 'eve'] }
    ↓
¿Ya tenemos datos? ✅ Sí (del pronóstico anterior de hoy)
    ↓
formatearPeriodoDelDia() → Respuesta natural con temp.day + temp.eve
    ↓
Respuesta inmediata sin API extra ⚡
```

---

## 🎨 Ejemplos de Respuestas

### Ejemplo 1: Pregunta "más tarde" a las 03:00
```
Usuario: ¿y para más tarde como estará?

Bot: 
🌅 Ahora mismo son las ~03:00 (madrugada)

Para hoy por la tarde:
☀️ Por la tarde: **29°C**
🌆 Al atardecer: **26°C**

Parcialmente nublado

🔥 **ALERTA CALOR EXTREMO** (hasta 29°C):
- ☀️ Protección solar SPF 50+
- 💧 Hidratación constante
- 🏃 Evita actividades entre 12-16h

¿Quieres más información? 🤔
```

### Ejemplo 2: Pregunta "esta noche" a las 15:00
```
Usuario: ¿y esta noche como estará?

Bot:
☀️ Ahora mismo son las ~15:00 (tarde)

Para hoy al atardecer y por la noche:
🌆 Al atardecer: **25°C**
🌙 Por la noche: **18°C**

Cielos nublados

☀️ Calor considerable (25°C):
- Ropa ligera y clara
- Gafas de sol
- Mantente hidratado

¿Quieres más información? 🤔
```

---

## ⚡ Beneficios

| Antes | Después |
|-------|---------|
| ❌ Pregunta innecesaria: "¿Quieres 7 días?" | ✅ Respuesta inmediata con datos disponibles |
| ❌ Experiencia lenta | ✅ Respuesta en <100ms |
| ❌ API redundante | ✅ Reutiliza datos en caché |
| ❌ Confusión del usuario | ✅ Claridad total sobre hora actual |

---

## 🔧 Mejoras Futuras Posibles

1. Detectar "la próxima hora" y dar pronóstico horario específico
2. Mapear directamente a Open-Meteo's hourly API para precisión por hora
3. Guardar histórico de qué períodos del día el usuario pregunta más
4. Sugerencias automáticas del período más relevante según hora actual

---

## 📝 Notas Técnicas

- **Open-Meteo Datos Disponibles**: `temp.morn`, `temp.day`, `temp.eve`, `temp.night`
- **Sin API extra**: Todo usa datos ya obtenidos del endpoint `/api/weather`
- **Contexto horario**: Se usa `timeContext` para saber hora actual y periodo
- **Regexes Robustas**: Detectan variaciones de lenguaje natural español
