# Ajustes y temas

## Settings

Abre **Settings** con `Ctrl+,` (`Cmd+,` en macOS), desde el engranaje de la
barra de actividades, desde el menú **VALET → Settings** o con la paleta de
comandos.

La barra lateral de Settings agrupa:

- **Appearance**;
- **Engine**;
- **Adoption & backup**;
- **Command line**;
- **Security**;
- **About**.

## Appearance

Muestra cuatro tarjetas, una por tema incluido:

| Tema | ID | Tipo |
| --- | --- | --- |
| Min Dark | `min-dark` | oscuro |
| Min Light | `min-light` | claro |
| Carbon Dark | `carbon-dark` | oscuro |
| Carbon Light | `carbon-light` | claro |

Al elegir una tarjeta, el tema se aplica y se guarda en `desktop.json`.

Los archivos JSON de `src/themes` son la fuente de verdad visual. La interfaz
solo consume tokens semánticos (`--v-*`); no hay colores de paleta duplicados
en los componentes.

### Cambiar de tema

Puedes usar cualquiera de estas vías:

- **Settings → Appearance**;
- **View → nombre del tema**;
- **Command palette → Use … theme**;
- el indicador de tema de la barra de estado, que cicla entre los cuatro;
- `valet theme <id>`.

Ejemplos:

```bash
valet theme
valet theme carbon-dark
valet theme min-light
```

`valet theme` sin argumentos muestra el tema actual. El tema se persiste en
`~/.config/valet/desktop.json` (o en el directorio configurado).

### Primer pintado y marco nativo

El fondo de la ventana se elige según el tipo del tema guardado para evitar un
destello claro al arrancar. El marco y los botones de ventana los dibuja el
sistema operativo. Las capturas de `capturePage` solo muestran el contenido web,
así que el marco nativo no aparece en ellas.

### Añadir un tema incluido

Para que un tema sea seleccionable:

1. Añade el documento JSON a `src/themes/`.
2. Añade su entrada a `THEME_DEFINITIONS` en `shared/themes.ts` con `id`,
   `name`, `type` y `file`.
3. Añade o actualiza las pruebas de tema.
4. Ejecuta `npm test`, `npm run typecheck` y `npm run smoke`.

El registro de Vite (`src/themes/index.ts`) carga todos los `*.json` de la
carpeta, pero la lista de temas **seleccionables** la define el catálogo. Añadir
solo el JSON hace que el renderer lo conozca, pero no lo añade a Settings, a la
CLI ni al menú.

Consulta [`docs/THEMES.md`](../docs/THEMES.md) para el mapeo de claves de VS
Code, las correcciones de contraste y el flujo de pruebas.

## Engine

La sección **Engine** muestra:

- modo: `http`, `cli` u `offline`;
- versión del motor;
- base de la API;
- última comprobación;
- ruta del ejecutable detectado.

Acciones:

| Acción | Efecto |
| --- | --- |
| Campo **Engine executable** | Ruta absoluta del binario `lerd` o `valet-engine`. |
| **Browse** | Elegir el binario con el diálogo nativo. |
| **Save** | Guardar la ruta y volver a detectar. |
| **Auto-detect** | Borrar la ruta guardada y usar la detección automática. |
| **Check connection** | Volver a probar la API. |
| **Start engine** | Ejecutar el arranque del motor. |
| **Run doctor** | Diagnóstico de VALET, con salida en Logs. |

La variable `VALET_ENGINE_BIN` actúa como override de entorno. El binario debe
ser un archivo ejecutable absoluto llamado `lerd` o `valet-engine`; no se acepta
un intérprete arbitrario.

La URL de la API se controla con `VALET_ENGINE_URL` y por defecto es
`http://127.0.0.1:7073`. Se recomienda loopback; `valet doctor` avisa si la URL
configurada no es loopback.

## Adoption & backup

Muestra si se detectó una instalación previa del motor y permite crear una copia
verificada. La operación:

- lee rutas fijas heredadas;
- copia `config.yaml`, `sites.yaml` y el directorio de temas si existe;
- verifica con SHA-256 `config.yaml` y `sites.yaml`;
- escribe un manifiesto `adoption.json`;
- **no mueve** contenedores, volúmenes, proyectos ni bases de datos.

Si ya existe una adopción con los mismos hashes, no crea otra copia. Si los
archivos de origen cambian, `migrate apply` puede crear una copia nueva.

Detalle completo en [Migración y copias](Migration-and-Backup.md).

## Command line

La sección recuerda los comandos de instalación de la CLI:

```bash
npm install
npm run build
./scripts/install-cli.sh
```

El botón **Copy commands** copia ese bloque. El botón **Engine docs** abre la
documentación upstream del motor.

## Security

Resume las garantías principales:

- aislamiento del renderer, sin Node;
- IPC validado;
- allow-list de comandos del motor;
- sin telemetría;
- phpMyAdmin retirado;
- terminal real con privilegios del usuario;
- límites de seguridad que pertenecen al motor upstream.

También permite eliminar un contenedor heredado de phpMyAdmin. La acción pide
confirmación y no toca bases de datos ni volúmenes.

## About

Muestra:

- versión de VALET;
- versiones de Electron, Chromium y Node;
- plataforma y arquitectura;
- directorio de configuración;
- directorio de estado/logs;
- licencia MIT y avisos de atribución.

Consulta también [`LICENSE`](../LICENSE) y [`NOTICE`](../NOTICE).

## Configuración relacionada

```bash
valet config get
valet config get theme
valet config get enginePath
valet config path
valet config set theme carbon-light
valet config set engine-path "$HOME/.local/bin/lerd"
valet config set sidebar-width 280
```

Claves editables por CLI:

| Clave | Valores |
| --- | --- |
| `theme` | `min-dark`, `min-light`, `carbon-dark`, `carbon-light` |
| `engine-path` / `enginePath` | Ruta absoluta a `lerd`/`valet-engine`, o `auto`/`none` para borrar |
| `sidebar-width` / `sidebarWidth` | Número entre 180 y 480 |

`telemetry` es fija en `false` y no se puede activar. Otras claves, como
`lastProject` y `recentProjects`, son de solo lectura desde la CLI.

## Siguiente paso

- [Configuración y datos](Configuration-and-Data.md)
- [Seguridad](Security.md)
- [Solución de problemas](Troubleshooting.md)
