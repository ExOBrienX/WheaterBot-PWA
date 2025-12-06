# Fix: Diferenciación de Pronósticos en Caché

## Problema Identificado

El usuario reportó que cuando pide:
1. **Pronóstico de mañana** → API devuelve 7 días, se guardan
2. **Pronóstico de toda la semana** → Sistema bloquea como "duplicado"

**Logs del error:**
```
⚠️ Ya se buscó recientemente: Santiago, Chile (forecast)
⚠️ Bloqueando búsqueda duplicada dentro de 15 minutos
```

**El problema raíz:** El caché no diferenciaba entre:
- ✅ "Dame el clima de MAÑANA" (pronóstico de 1 día)
- ✅ "Dame el clima de LA SEMANA" (pronóstico de 7 días)

Ambos eran tratados como "forecast" y se bloqueaban mutuamente.

---

## Solución Implementada

### 1. ✅ Crear 3 Tipos Distintos de Pronóstico

**Nuevo campo en caché: `forecastType`**

```typescript
'day'         // Un día específico (mañana, pasado mañana, etc.)
'week'        // Semana completa empezando hoy (7 días: hoy + 6)
'week-future' // Semana futura empezando desde mañana
```

### 2. ✅ Lógica de Clasificación (líneas 1157-1167)

```typescript
let forecastCacheType = 'day'; // default

if (weatherRequest.type === 'forecast') {
  if (daysCount === 7 && startFrom === 0) {
    forecastCacheType = 'week';        // Semana desde HOY
  } else if (daysCount === 7 && startFrom > 0) {
    forecastCacheType = 'week-future'; // Semana desde MAÑANA
  } else {
    forecastCacheType = 'day';         // Un día específico
  }
}
```

**Ejemplos:**
- Usuario: "¿Mañana?" → `days_count=1, start_from=1` → `'day'`
- Usuario: "¿Pasado mañana?" → `days_count=1, start_from=2` → `'day'`
- Usuario: "¿Semana?" → `days_count=7, start_from=0` → `'week'`
- Usuario: "¿Semana desde mañana?" → `days_count=7, start_from=1` → `'week-future'`

### 3. ✅ Verificación de Duplicados Mejorada (líneas 1170-1175)

**Antes:**
```typescript
const yaFueBuscado = cache?.weatherHistory?.some(item =>
  item.city.toLowerCase() === weatherRequest.city.toLowerCase() &&
  item.type === weatherRequest.type
  // ❌ NO diferenciaba entre day/week
);
```

**Después:**
```typescript
const yaFueBuscado = cache?.weatherHistory?.some(item =>
  item.city.toLowerCase() === weatherRequest.city.toLowerCase() &&
  item.type === weatherRequest.type &&
  item.forecastType === forecastCacheType  // ✅ AHORA DIFERENCIA
);
```

**Impacto:**
- `'Santiago', 'forecast', 'day'` ≠ `'Santiago', 'forecast', 'week'`
- Cada tipo se caché independientemente
- No hay bloqueos cruzados

### 4. ✅ Registro Mejorado (líneas 1222-1231)

**Antes:**
```typescript
cache.weatherHistory.push({
  city: weatherRequest.city,
  timestamp: Date.now(),
  type: weatherRequest.type
  // ❌ SIN información de qué tipo de pronóstico
});
```

**Después:**
```typescript
cache.weatherHistory.push({
  city: weatherRequest.city,
  timestamp: Date.now(),
  type: weatherRequest.type,
  forecastType: weatherRequest.type === 'forecast' ? forecastCacheType : undefined
});
```

**Logs ahora dicen:**
```
✅ Registrado en historial: Santiago (forecast - week)
✅ Registrado en historial: Talca (forecast - day)
```

---

## Tipos Actualizados

### En `app/lib/types.ts` (línea 108)
```typescript
weatherHistory: Array<{
  city: string;
  timestamp: number;
  type: 'current' | 'forecast';
  forecastType?: 'day' | 'week' | 'week-future'; // 🆕
}>;
```

### En `app/components/ChatContainer.tsx` (línea 16)
```typescript
interface ConversationCache {
  // ... resto del código
  weatherHistory: Array<{
    city: string;
    timestamp: number;
    type: 'current' | 'forecast';
    forecastType?: 'day' | 'week' | 'week-future'; // 🆕
  }>;
}
```

---

## Cómo Funciona Ahora

### Escenario: Usuario pide mañana y semana

**Paso 1: Usuario pide "¿Clima para mañana en Santiago?"**
```
API devuelve: 7 días (desde hoy)
Sistema detecta: days_count=1, start_from=1
Tipo asignado: 'day'
Caché ID: "Santiago,Chile,2025-12-06" (para mañana)
Historial: { city: 'Santiago', type: 'forecast', forecastType: 'day' }
Resultado: ✅ Muestra SOLO mañana
```

**Paso 2: Usuario pide "¿Semana en Santiago?"**
```
Verifica historial:
  - ¿Existe 'Santiago' + 'forecast' + 'week'? NO
Verificación de duplicados: ✅ PASA (es diferente tipo)
API devuelve: 7 días (semana completa)
Tipo asignado: 'week'
Caché ID: "Santiago,Chile,2025-12-05" (base = hoy)
Historial: { city: 'Santiago', type: 'forecast', forecastType: 'week' }
Resultado: ✅ Muestra TODA la semana (7 días)
```

**Paso 3: Usuario pide "¿Mañana en Santiago?" (nuevamente)**
```
Verifica historial:
  - ¿Existe 'Santiago' + 'forecast' + 'day' dentro de 15min? SI
Verificación de duplicados: ✅ BLOQUEADO (evita request innecesario)
Resultado: "Ya te di el clima de mañana..."
```

---

## Tests de Verificación

### Test A: Día Específico NO bloquea Semana

**Pasos:**
1. Usuario: "¿Clima para mañana en Talca?"
   - Sistema registra: `{ city: 'Talca', type: 'forecast', forecastType: 'day' }`
   - Resultado: ✅ Muestra mañana

2. Usuario: "¿Y la semana completa?"
   - Sistema verifica: 'day' ≠ 'week' → ✅ NO es duplicado
   - API es llamada → ✅ Recibe datos
   - Resultado: ✅ Muestra 7 días

**Resultado esperado:**
- Ambos requests se ejecutan
- No hay mensajes de "duplicado"
- Se ve mañana primero, luego la semana

---

### Test B: Mismo Tipo SÍ bloquea Duplicados

**Pasos:**
1. Usuario: "¿Semana en Talca?"
   - Sistema registra: `{ city: 'Talca', type: 'forecast', forecastType: 'week' }`
   - Resultado: ✅ Muestra 7 días

2. Usuario: "¿De nuevo la semana?" (dentro de 15 min)
   - Sistema verifica: 'week' === 'week' + menos de 15min → ✅ ES duplicado
   - Resultado: ✅ Bloqueado

**Resultado esperado:**
```
⚠️ Ya se buscó recientemente: Talca (forecast - week)
⚠️ Bloqueando búsqueda duplicada dentro de 15 minutos
```

---

### Test C: Diferentes Ciudades NO se bloquean

**Pasos:**
1. Usuario: "¿Mañana en Talca?"
   - Registra: `{ city: 'Talca', type: 'forecast', forecastType: 'day' }`

2. Usuario: "¿Mañana en Santiago?" (diferente ciudad)
   - Verifica: 'Santiago' ≠ 'Talca' → ✅ NO es duplicado
   - API es llamada
   - Registra: `{ city: 'Santiago', type: 'forecast', forecastType: 'day' }`

**Resultado esperado:**
- Ambos requests se ejecutan
- Se muestra clima de Talca, luego Santiago

---

## Cambios de Código Resumido

| Componente | Cambio | Línea |
|------------|--------|-------|
| Determinación de tipo | Nuevo sistema day/week/week-future | 1157-1167 |
| Verificación de duplicados | Incluir `forecastType` | 1173 |
| Registro en historial | Guardar `forecastType` | 1228 |
| Tipos (types.ts) | Agregar campo `forecastType` | 108 |
| Tipos (ChatContainer.tsx) | Agregar campo `forecastType` | 16 |

---

## Commit

- **0f2f5d2:** "Fix: Diferenciar pronósticos por tipo (day/week/week-future) en caché"

---

## Comportamiento Esperado

✅ **Permite:**
- Pedir mañana → Luego pedir semana (sin bloqueo)
- Pedir semana → Luego pedir otro día específico (sin bloqueo)
- Pedir semana → Pedir semana nuevamente dentro de 15min (SÍ bloqueado)

✅ **Previene:**
- Llamadas innecesarias cuando pide lo mismo 2 veces
- Bloqueos cruzados entre "día específico" y "semana"

---

## Status: ✅ IMPLEMENTADO

El fix está compilado, commited y listo para testing. 

El usuario ahora puede:
1. Pedir clima de **un día específico** (mañana, pasado mañana, etc.)
2. Pedir clima de **la semana completa**
3. Ambos se cachean y validan **independientemente**
4. NO se bloquean mutuamente ✅
