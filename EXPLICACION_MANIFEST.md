# 📋 Explicación: manifest.json

Este archivo define cómo se ve y comporta tu PWA cuando se instala.

## Propiedades Clave

### **name** y **short_name**
- `name`: "WheaterBot - Clima con IA" (nombre completo, usado en pantalla de instalación)
- `short_name`: "WheaterBot" (nombre corto cuando el espacio es limitado)

### **description**
Descripción que aparece en la tienda o pantalla de instalación de la app.

### **start_url**
URL donde comienza la aplicación. Siempre debe ser `"/"` (raíz).

### **display**
Define cómo se abre la app:
- `"standalone"` = Como app nativa, sin barra de dirección de Chrome ✅ (recomendado)
- `"fullscreen"` = Pantalla completa
- `"minimal-ui"` = Controles mínimos

### **orientation**
- `"portrait-primary"` = Se abre en vertical (recomendado para móviles)
- `"landscape-primary"` = Se abre en horizontal

### **background_color** y **theme_color**
- `background_color`: Color de fondo de la pantalla de carga
- `theme_color`: Color de la barra de tareas en Android

### **icons**
Array de iconos en diferentes tamaños:
- `192x192` = Pequeño (iconos en home)
- `512x512` = Grande (pantalla de instalación)
- `maskable` = Android puede aplicar máscara al icono

### **categories**
Categorías para tiendas de apps: `["weather", "utilities"]`

### **shortcuts**
Accesos directos que aparecen al hacer click largo en el icono:
```
Click largo en icono → Opción: "Clima actual"
```

---

## Archivo Actual

```json
{
  "name": "WheaterBot - Clima con IA",
  "short_name": "WheaterBot",
  "description": "Chatbot que proporciona pronósticos meteorológicos...",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#1a1a2e",
  "theme_color": "#0f3460",
  "icons": [...],
  "categories": ["weather", "utilities"],
  "shortcuts": [...]
}
```

✅ **Tu manifest está bien configurado para PWA.**
