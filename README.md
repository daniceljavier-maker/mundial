# Porra Mundial 2026 ⚽

Aplicación web para gestionar una porra (quiniela) entre amigos durante el Mundial 2026. Construida con **React + Vite** y conectada a **Google Sheets** como base de datos a través de Google Apps Script.

## Características

- **Pronósticos por partido**: cada participante elige su marcador, quién avanza, método (90', tiempo extra, penales) y minuto del primer gol.
- **Banderas reales** de cada país (imágenes de [flagcdn.com](https://flagcdn.com), con más de 50 selecciones mapeadas por nombre en español y fallback a emoji).
- **Pestaña "Apuestas"**: resumen de los pronósticos de todos los participantes por partido. Antes del inicio del partido solo se muestra quién ya apostó (🔒 los pronósticos ajenos permanecen ocultos); al arrancar el partido se revela la tabla completa con marcador, quién avanza, minuto del primer gol y puntos obtenidos.
- **Sistema de puntuación**:
  - 10 pts — Marcador exacto
  - 8 pts — Ganador/avanza + diferencia de goles
  - 6 pts — Ganador/avanza + goles de un equipo
  - 4 pts — Solo el ganador / quién avanza
  - 2 pts — Acertar tiempo extra o penales (eliminatorias)
- **Bonus por el minuto del primer gol**:
  - +3 pts — Minuto exacto
  - +2 pts — Error de 5 minutos o menos
  - +1 pt — Error de 10 minutos o menos
- **Ranking en vivo** con criterios de desempate (exactos, método, diferencia de goles, error de minuto).
- **Panel de administración** protegido con PIN para capturar resultados y gestionar partidos.
- **Sincronización automática** cada 15 segundos con Google Drive.

## Estructura del proyecto

```
mundial/
├── index.html           # Punto de entrada HTML
├── package.json         # Dependencias (React 18 + Vite 4)
├── vite.config.js       # Configuración de Vite
├── src/
│   ├── main.jsx         # Bootstrap de React
│   └── App.jsx          # Lógica principal de la app
└── apps-script/
    └── Code.gs          # Backend en Google Apps Script (Google Sheets)
```

## Instalación y desarrollo

```bash
pnpm install   # o npm install
pnpm dev       # o npm run dev
```

La app estará disponible en `http://localhost:5173`.

## Configuración del backend (Google Apps Script)

1. Crea una hoja de cálculo nueva en Google Sheets.
2. Abre **Extensiones → Apps Script** y pega el contenido de `apps-script/Code.gs`.
3. Ejecuta la función `setup()` una vez para vincular la hoja.
4. Despliega como **Aplicación web** (acceso: cualquier persona) y copia la URL.
5. Pega esa URL en la constante `SCRIPT_URL` dentro de `src/App.jsx`.

## Estado del proyecto

✅ La app está **completa y funcional**: incluye todos los componentes visuales (`Shell`, `Header`, `Tabs`, `Pick`, `Apostar`, `MatchCard`, `TeamCol`, `Ranking`, `Criterio`, `Admin`, `AddMatch`, `ResultForm` y `Styles`) con un tema oscuro responsive optimizado para móvil. Sin `SCRIPT_URL` configurada, la app funciona en modo local (los datos no se comparten entre dispositivos); al configurar la URL, todo se sincroniza a través de Google Sheets.

## Build de producción

```bash
pnpm build     # genera la carpeta dist/
pnpm preview   # previsualiza el build
```
