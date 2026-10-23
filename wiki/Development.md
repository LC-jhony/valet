# Desarrollo

## Requisitos

- Node.js 20 o superior.
- npm.
- Linux o macOS para el motor upstream.
- Un binario `lerd`/`valet-engine` y, si usas contenedores, Podman.

## Puesta en marcha

```bash
npm install
npm run dev
```

`npm run dev` arranca Vite y Electron con el servidor de desarrollo. Para una
compilación de producción:

```bash
npm run build
npm start
```

## Scripts

| Script | Efecto |
| --- | --- |
| `npm run dev` | Vite + Electron en desarrollo. |
| `npm run build` | Renderer + Electron + CLI. |
| `npm run build:renderer` | Solo Vite. |
| `npm run build:electron` | Solo `tsc` para main/preload. |
| `npm run build:cli` | Solo esbuild de la CLI. |
| `npm run typecheck` | TypeScript de renderer, shared, tests y Electron. |
| `npm test` | Vitest una vez. |
| `npm run test:watch` | Vitest en watch. |
| `npm start` | Electron sobre `dist/`. |
| `npm run smoke` | Smoke de escritorio y capturas. |
| `npm run package` | App desempaquetada en `release/linux-unpacked`. |
| `npm run dist` | AppImage y `.deb` en Linux. |

## Arquitectura del código

```text
electron/
  main.ts        ventana, ciclo de vida, detección, smoke
  preload.ts     contextBridge tipado
  ipc.ts         handlers y validación
  terminal.ts    PTY, límites y shims
  logs.ts        SSE de logs
  engine.ts      adaptador HTTP + allow-list (en shared/)
shared/
  engine.ts      cliente del motor y validación de comandos
  config.ts      desktop.json, rutas XDG, adopción
  themes.ts      catálogo de temas
  theme.ts       mapeo VS Code -> tokens -> CSS
  types.ts       modelos compartidos
  ...
src/
  App.tsx        workbench, atajos, vistas
  state/store.tsx estado global
  components/    barra, sidebar, paleta, terminal, UI
  views/         Projects, PHP, Services, Ports, Databases, Terminal, Logs, Settings
  themes/        JSON + registro Vite
cli/
  valet.ts       CLI completa
tests/           Vitest
```

La documentación de diseño está en
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

## Añadir un comando del motor

La allow-list es deliberadamente estrecha. Para añadir una operación:

1. Añade el ID a `EngineCommand` en `shared/types.ts`.
2. Mapea el ID a argumentos fijos en `validateEngineArgs`
   (`shared/engine.ts`).
3. Si afecta a la interfaz, añade el método tipado en `shared/api.ts`, el
   handler en `electron/ipc.ts` y el uso en `src/state/store.tsx`.
4. Si es un comando de usuario, añade el caso en `cli/valet.ts` y la ayuda.
5. Actualiza `shared/mapping.ts` y la documentación.
6. Añade pruebas de validación, rechazo de argumentos y comportamiento.

No añadas un `exec` genérico. No aceptes una cadena de shell, un binario
arbitrario ni una ruta sin validar.

## Añadir una vista o un tema

Para una vista, actualiza `ViewId`, `VIEW_META`, la barra de actividades, la
barra lateral y `ViewContent`.

Para un tema:

1. Añade el JSON a `src/themes/`.
2. Añade la entrada a `THEME_DEFINITIONS` en `shared/themes.ts`.
3. Verifica tokens, contraste y xterm.
4. Ejecuta `npm test`, `npm run typecheck` y `npm run smoke`.

Los JSON de tema son la fuente de verdad visual. No dupliques colores en
componentes.

## Pruebas

```bash
npm run typecheck
npm test
```

Cobertura actual:

- temas y contraste;
- puertos;
- mapeo del motor, allow-list y rollback de PHP;
- migración;
- terminal real;
- parser de restricciones Composer;
- configuración.

Las pruebas usan directorios temporales y no modifican el árbol de trabajo, los
datos del motor ni la configuración del usuario.

## Smoke de escritorio

```bash
DISPLAY=:0 npm run smoke
```

El smoke lanza Electron y captura:

- Min Dark;
- Min Light;
- Carbon Dark;
- Carbon Light;
- Settings con los cuatro temas;
- detalle de proyecto;
- logs/diagnóstico;
- Engine output con doctor;
- terminal real.

También comprueba que la terminal ejecuta un comando y conserva la salida al
salir y volver a la vista. Las capturas se copian a `docs/screenshots/`.

Variables útiles:

| Variable | Uso |
| --- | --- |
| `VALET_SMOKE` | Activa el modo smoke en la aplicación. |
| `VALET_SMOKE_OUT` | Directorio de capturas. |
| `VALET_ENGINE_BIN` | Motor usado por el smoke. |
| `VALET_ENGINE_URL` | API usada por el smoke. |
| `HOME` | Home aislado para el smoke. |

El smoke necesita un motor vivo y un proyecto seleccionado; no es una prueba
offline autónoma.

## Empaquetado

```bash
npm run package   # release/linux-unpacked
npm run dist      # AppImage + deb
```

Los artefactos se escriben en `release/`, que está ignorado por Git. El `.deb`
incluye:

- `/opt/VALET/valet-desktop`;
- `resources/app.asar`;
- entrada `.desktop`;
- perfil AppArmor;
- `postinst`/`postrm`.

## Verificación y limitaciones

En esta release se validaron:

- `npm run typecheck`;
- 46 pruebas en 7 archivos;
- `npm run build`;
- AppImage, binario desempaquetado y `.deb` extraído;
- `desktop-file-validate`, sintaxis de scripts y perfil AppArmor;
- smoke con capturas y terminal real.

No se validaron en este entorno:

- ejecución nativa en macOS y Windows;
- instalación del `.deb` como root;
- servicios reales con Podman;
- builds de PHP y FPM en vivo;
- mutaciones de puertos contra contenedores reales;
- TLS y DNS `.test`;
- eliminación de un phpMyAdmin real.

No presentes esas áreas como verificadas hasta probarlas en un entorno
adecuado.

## Lista de release

1. `npm run typecheck`
2. `npm test`
3. `npm run build`
4. `npm run smoke`
5. `npm run dist`
6. Verificar artefactos y hashes.
7. Actualizar documentación y capturas.
8. Revisar que no se hayan añadido datos de usuario ni artefactos al árbol.

## Siguiente paso

- [Mapa de comandos del motor](Engine-Command-Map.md)
- [Seguridad](Security.md)
- [Pruebas originales](../docs/TESTING.md)
