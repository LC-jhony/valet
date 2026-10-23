# Chuleta de comandos

## CLI de VALET

### Núcleo

```bash
valet help
valet version [--json]
valet status [--json]
valet doctor [--engine] [--json]
valet start
valet stop
valet restart
```

### Proyectos

```bash
valet projects [list|ls] [--json]
valet projects add <ruta-absoluta>
valet projects remove <dominio> [--yes]
valet projects php <dominio> <version>
valet projects services <dominio> [--json]
valet projects service add|remove|declare|dismiss <dominio> <servicio> [--yes]
valet projects restart|pause|resume|unpause|secure|unsecure|rebuild <dominio>
valet projects open <dominio>
```

Atajo: `sites` es alias de `projects`.

### PHP

```bash
valet php [list|ls]
valet php install <version>
valet php extensions <version> [--json]
valet php pin <dominio> <version>
valet php use <version> [--yes]
```

### Servicios

```bash
valet services [list|ls] [--json]
valet services start|stop|restart <nombre>
valet services port <nombre> <puerto-host>
valet services port <nombre> <puerto-host> --container <puerto-contenedor>
valet services logs <nombre>
valet services remove <nombre> [--yes]
```

### Puertos, bases de datos y logs

```bash
valet ports [list|ls] [--json]
valet ports check <puerto> [--address <ip>] [--json]
valet databases [--json]
valet logs [unidad] [--json]
```

`valet logs` sin unidad lista fuentes; con unidad abre un stream SSE.

### Configuración y tema

```bash
valet config get
valet config get <clave> [--json]
valet config set theme <id>
valet config set engine-path <ruta-absoluta>
valet config set engine-path auto
valet config set sidebar-width <180-480>
valet config path [--json]
valet theme [id] [--json]
```

IDs de tema: `min-dark`, `min-light`, `carbon-dark`, `carbon-light`.

### Migración y phpMyAdmin

```bash
valet migrate detect [--json]
valet migrate status [--json]
valet migrate apply [--yes]
valet phpmyadmin status
valet phpmyadmin remove [--yes]
valet open [dominio|dashboard]
```

### Opciones globales

```text
--json, -j      salida JSON donde esté soportada
--yes, -y       aceptar confirmaciones
--engine        doctor: ejecutar también el doctor del motor
--address <ip>  ports check: dirección
--container <p> services port: mapeo secundario
--help, -h      ayuda
--version, -v   versión
```

## Flujo diario

```bash
valet status
valet projects
valet projects open acme.test
valet php
valet services
valet ports
valet logs lerd-nginx
valet doctor
```

## NPM

```bash
npm install          # dependencias
npm run dev          # Vite + Electron en desarrollo
npm run typecheck    # TypeScript de renderer, shared, tests y Electron
npm test             # Vitest
npm run test:watch   # Vitest en modo watch
npm run build        # renderer + Electron + CLI
npm run build:renderer
npm run build:electron
npm run build:cli
npm start            # Electron sobre dist/
npm run smoke        # smoke de escritorio y capturas
npm run package      # aplicación desempaquetada en release/
npm run dist         # AppImage + deb en Linux
```

## Instalación

```bash
npm run build:cli
./scripts/install-cli.sh
VALET_CLI_DIR="$HOME/bin" ./scripts/install-cli.sh
./scripts/install-cli.sh --force
```

## Atajos de la interfaz

Linux/Windows con `Ctrl`; macOS con `Cmd`.

| Atajo | Acción |
| --- | --- |
| `Ctrl+K` / `Ctrl+Shift+P` | Paleta de comandos |
| `Ctrl+1` | Projects |
| `Ctrl+2` | PHP |
| `Ctrl+3` | Services |
| `Ctrl+4` | Ports |
| `Ctrl+5` | Databases |
| `Ctrl+6` | Terminal |
| `Ctrl+7` | Logs & diagnostics |
| `Ctrl+,` | Settings |
| `Ctrl+B` | Mostrar/ocultar sidebar |
| `Ctrl` + tecla de acento grave | Nueva terminal |
| `↑` / `↓` | Navegar paleta |
| `Enter` | Ejecutar comando |
| `Esc` | Cerrar paleta |

## Diagnóstico del sistema

No son comandos de VALET; son útiles para comprobar el entorno.

```bash
command -v valet
ls -l "$(command -v valet)"
command -v lerd
command -v valet-engine
command -v podman

sha256sum valet-desktop-1.0.0-linux-x86_64.AppImage
sha256sum valet-desktop-1.0.0-linux-amd64.deb

ss -ltnp
lsof -nP -iTCP -sTCP:LISTEN

dpkg -l | grep -i valet
dpkg -L valet-desktop
```

En macOS, `lsof` suele estar disponible; en Linux, `ss` forma parte de
`iproute2`. Algunos comandos pueden requerir privilegios para mostrar el
propietario de un puerto.

## Variables de entorno

```bash
VALET_ENGINE_BIN=/ruta/a/lerd
VALET_ENGINE_URL=http://127.0.0.1:7073
VALET_CONFIG_HOME=/ruta/config
VALET_DATA_HOME=/ruta/data
VALET_STATE_HOME=/ruta/state
VALET_CACHE_HOME=/ruta/cache
VALET_CLI_DIR=/ruta/bin
NO_COLOR=1
TERM=dumb
```

## Precauciones

- No uses `--yes` sin saber qué operación estás confirmando.
- `projects remove` y `services remove` no borran datos, pero sí cambian el
  registro del motor.
- `php use` cambia el valor global del motor, no el PHP del host.
- `migrate apply` solo copia y verifica; no mueve datos.
- `ports check` no libera puertos.
- La terminal es un shell real con tus privilegios.

## Referencia completa

- [Referencia de la CLI](CLI-Reference.md)
- [Mapa de comandos del motor](Engine-Command-Map.md)
- [Configuración y datos](Configuration-and-Data.md)
