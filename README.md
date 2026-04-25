# cobies-opencode-statusline

Reimplementación con **arquitectura hexagonal pragmática** del monitor de statusline para OpenCode, con identidad propia de Cobies.

Mantiene la idea original del proyecto:

- un **plugin runtime** para OpenCode que escribe estado y statusline
- un **plugin TUI** para visualizar subagentes dentro de OpenCode

Pero mejora:

- separación de responsabilidades
- mantenibilidad
- testabilidad
- seguridad del acceso a SQLite
- consistencia de tooling con **Bun**

---

## Estado actual

Este proyecto está verificado con:

- `bun run typecheck` ✅
- `bun test` ✅
- `bun run build` ✅

Salidas generadas:

- `dist/runtime.js`
- `dist/tui.js`

---

## Stack

- **TypeScript**
- **Bun**
- **Vitest**
- **tsup**
- **OpenCode Plugin API**
- **OpenTUI / Solid**
- **bun:sqlite** para acceso seguro a SQLite con prepared statements reales

---

## Arquitectura

```txt
src/
  domain/        # lógica pura del negocio
  application/   # casos de uso
  ports/         # contratos/interfaces
  adapters/      # OpenCode, SQLite, filesystem, TUI, statusline
  entry/         # puntos de entrada runtime y TUI
```

### Regla de diseño

El dominio no depende de:

- Node APIs
- Bun runtime APIs externas al dominio
- OpenCode
- SQLite
- Solid/OpenTUI

Las dependencias fluyen hacia adentro:

```txt
adapters -> application -> domain
```

---

## Instalación

```sh
bun install
```

---

## Scripts

### Typecheck

```sh
bun run typecheck
```

### Tests

```sh
bun test
```

### Build

```sh
bun run build
```

### Modo watch

```sh
bun run dev
```

---

## Uso como plugin runtime

Este entry genera los archivos de salida de statusline:

- `state.json`
- `status.txt`

Entry exportado:

- `./runtime`

### Configuración ejemplo en OpenCode

```json
{
  "plugin": ["cobies-opencode-statusline/runtime"]
}
```

### Comportamiento

El runtime:

1. recibe eventos del host
2. los mapea al dominio
3. actualiza el estado
4. persiste snapshot
5. escribe el resumen textual

---

## Uso como plugin TUI

Entry exportado:

- `./tui`

### Configuración ejemplo en OpenCode

```json
{
  "plugin": ["cobies-opencode-statusline/tui"]
}
```

El plugin TUI está separado de la lógica de negocio. La UI renderiza a partir de un view-model y no concentra reglas críticas del dominio.

---

## Variables de entorno relevantes

### Estado del runtime

- `OPENCODE_SUBAGENT_STATUSLINE_STATE`
  - path explícito para `state.json`

- `OPENCODE_SUBAGENT_STATUSLINE_PRESERVE_STATE=1`
  - preserva el estado previo al iniciar

### Base de datos OpenCode

- `OPENCODE_SUBAGENT_STATUSLINE_OPENCODE_DB`
  - permite indicar el path del `opencode.db`

Si no se define, el proyecto intenta resolver la DB de OpenCode desde el directorio estándar de datos.

---

## Seguridad

El acceso a SQLite ya no usa interpolación de strings ni shell escaping.

Ahora usa:

- `bun:sqlite`
- `Database.prepare()`
- placeholder `?`
- binding real con `stmt.get(sessionId)`

Eso elimina el problema anterior de SQL injection que existía en el enfoque basado en CLI.

---

## Testing

Actualmente el proyecto tiene cobertura de tests sobre:

- servicios de dominio
- transiciones de estado
- casos de uso principales
- mapper de eventos
- view-model del TUI

### Próxima mejora recomendada

Agregar test de integración para el adapter SQLite con una base real de prueba.

---

## Tradeoffs conocidos

### Bun-first

Este proyecto está estandarizado para **Bun**.

Eso simplifica:

- lockfile
- runtime SQLite
- consistencia del tooling

Pero implica que el adapter SQLite depende de `bun:sqlite` y no está pensado para Node puro.

---

## Diferencias frente al proyecto original

- menos acoplamiento
- runtime y TUI mejor separados
- lógica de negocio fuera de la UI
- acceso SQLite seguro
- tests presentes
- estructura lista para seguir creciendo sin convertir `tui.tsx` en un monstruo

---

## Recomendación de uso

Usá esta versión como la base nueva del proyecto.

Si querés migrarla a producción o adoptarla como reemplazo del original, el siguiente paso razonable es:

1. probarla dentro de OpenCode con tus eventos reales
2. agregar README de migración si vas a reemplazar el paquete original
3. agregar CI para `typecheck` + `test`

---

## Comandos rápidos

```sh
bun install
bun run typecheck
bun test
bun run build
```
