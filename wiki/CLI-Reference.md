# Referencia de la CLI

La CLI `valet` comparte con la aplicación el adaptador del motor
(`shared/engine.ts`), la allow-list de comandos y las validaciones. No construye
cadenas de shell: usa `execFile` con vectores de argumentos fijos y llamadas
HTTP limitadas a `/api/`.

## Instalación

```bash
npm run build:cli
./scripts/install-cli.sh
```

El wrapper es `bin/valet`; la implementación compilada es
`dist/cli/valet.js`. El instalador crea `~/.local/bin/valet` (o
`$VALET_CLI_DIR/valet`).

Comprueba:

```bash
valet version
valet help
```

## Sintaxis general

```text
valet <comando> [argumentos] [opciones]
```

Opciones globales:

| Opción | Efecto |
| --- | --- |
| `--json`, `-j` | Salida JSON donde el comando lo soporte. |
| `--yes`, `-y` | Acepta confirmaciones. Obligatorio en un shell no interactivo. |
| `--engine` | Solo para `doctor`: ejecuta también el doctor del motor. |
| `--address <ip>` | Solo para `ports check`: dirección a comprobar. |
| `--container <puerto>` | Solo para `services port`: mapeo secundario. |
| `--help`, `-h`, `help` | Muestra la ayuda general. |
| `--version`, `-v` | Muestra la versión. |

Las opciones se pueden colocar antes o después de los argumentos. Una opción
desconocida produce un error de uso con código `2`.

Acciones por defecto cuando se omite la acción:

| Comando | Acción por defecto |
| --- | --- |
| `projects` | `list` |
| `php` | `list` |
| `services` | `list` |
| `ports` | `list` |
| `logs` | listar fuentes |
| `config` | `get` |
| `migrate` | `status` |
| `phpmyadmin` | `status` |
| `theme` | mostrar el tema actual |

## Códigos de salida

| Código | Significado |
| --- | --- |
| `0` | Éxito, o comando de solo lectura que terminó correctamente. |
| `1` | Fallo de ejecución: motor, API offline cuando era necesaria, puerto no disponible, chequeo fallido. |
| `2` | Error de uso: comando/opción desconocida, argumento faltante, confirmación requerida en modo no interactivo. |
| `130` | Stream de logs interrumpido con `Ctrl+C`. |

## Confirmaciones

Las acciones destructivas o de alto impacto piden confirmación:

- desregistrar un proyecto;
- quitar un servicio;
- cambiar el PHP global del motor;
- aplicar una migración;
- quitar phpMyAdmin;
- añadir o separar un servicio de un proyecto.

Si `stdin` no es una TTY, debes pasar `--yes`; de lo contrario la CLI termina
con código `2`. `--yes` no cambia el comportamiento destructivo de la operación:
solo evita la pregunta.

## Núcleo

### `valet status`

```bash
valet status
valet status --json
```

Resumen de motor, proyectos, servicios, PHP y copia de adopción. No exige que la
API esté online: si está offline, muestra el estado detectado y los fallos.

JSON incluye:

- `valet`: versión de VALET;
- `engine`: modo, versión, API, binario y plataforma;
- `projects`, `services`;
- `php.installed` y `php.available`;
- `adoption`;
- `failures`.

### `valet doctor`

```bash
valet doctor
valet doctor --json
valet doctor --engine
```

Diagnóstico de solo lectura. Comprueba:

- binario del motor;
- API y binding loopback;
- directorios de configuración/estado y permisos;
- `desktop.json`;
- proyectos, servicios, PHP y puertos;
- phpMyAdmin heredado;
- adopción.

Devuelve `1` si la API está offline o si algún chequeo falla. `--engine` añade
la salida del doctor upstream si hay binario. `--json` elimina códigos ANSI.

### `valet start`

```bash
valet start
```

Pide al motor que arranque DNS, Nginx, PHP-FPM y servicios. Espera hasta unos
15 segundos a que la API responda. Si ya estaba online, igualmente pide al motor
que arranque sus contenedores.

Requiere un binario de motor válido.

### `valet stop`

```bash
valet stop
```

Detiene los contenedores del motor. No elimina contenedores, volúmenes ni datos.
Espera brevemente a que la API deje de responder; si sigue respondiendo, avisa.

### `valet restart`

```bash
valet restart
```

Reinicia el motor. No borra datos.

### `valet version`

```bash
valet version
valet version --json
```

Muestra `VALET 1.0.0` o `{ "name": "VALET", "version": "1.0.0", "engine": null }`.
No consulta el motor.

## Proyectos

Alias del comando: `sites`.

### `valet projects [list|ls]`

```bash
valet projects
valet projects list
valet projects --json
```

Lista los proyectos registrados, ordenados por dominio. La tabla muestra
dominio, PHP, framework, estado y ruta.

### `valet projects add <ruta>`

```bash
valet projects add "$HOME/Code/acme"
```

Registra una carpeta existente **en su sitio**. Requisitos:

- ruta absoluta y existente;
- debe ser un directorio;
- API del motor disponible;
- binario del motor disponible.

El comando ejecuta el `link` del motor con `cwd` en la carpeta. No mueve ni
copia archivos. La ruta debe ser absoluta tal como se pasa; `~` debe expandirlo
tu shell.

### `valet projects remove <dominio> [--yes]`

```bash
valet projects remove acme.test
valet projects remove acme.test --yes
```

Desregistra el sitio del motor. Conserva archivos, bases de datos y volúmenes.
Pide confirmación; en un script usa `--yes`.

Alias: `unregister`.

### `valet projects php <dominio> <version>`

```bash
valet projects php acme.test 8.3
```

Fija un runtime PHP instalado a un solo proyecto. No cambia el PHP del host ni
otros proyectos. Si el motor falla, el adaptador intenta restaurar el pin
anterior.

### `valet projects services <dominio> [--json]`

```bash
valet projects services acme.test
valet projects services acme.test --json
```

Consulta de solo lectura. Muestra servicios adjuntos (detectados en el entorno o
declarados) y sugerencias del framework. No instala nada.

### `valet projects service <acción> <dominio> <servicio> [--yes]`

Acciones: `add`, `remove`, `declare`, `dismiss`.

```bash
valet projects service add acme.test mysql --yes
valet projects service remove acme.test mysql --yes
valet projects service declare acme.test redis
valet projects service dismiss acme.test mysql
```

| Acción | Efecto |
| --- | --- |
| `add` | El motor puede instalar/arrancar el servicio y editar el entorno del proyecto. |
| `remove` | Separa el servicio; el contenedor y los datos se conservan. |
| `declare` | Registra el servicio en `.lerd.yaml`; no instala nada. |
| `dismiss` | Descarta la sugerencia; no cambia archivos del proyecto. |

`add` y `remove` requieren confirmación; `declare` y `dismiss` no. `--json`
devuelve un objeto con dominio, servicio, operación y resultado.

### `valet projects restart|pause|resume|unpause|secure|unsecure|rebuild <dominio>`

```bash
valet projects restart acme.test
valet projects pause acme.test
valet projects resume acme.test
valet projects secure acme.test
valet projects unsecure acme.test
valet projects rebuild acme.test
```

Delega la acción al motor. `resume` se traduce a `unpause`. `rebuild` está
disponible en CLI aunque la interfaz no lo muestre como botón principal.

### `valet projects open <dominio>`

```bash
valet projects open acme.test
```

Abre la URL del proyecto (`https` si el proyecto tiene TLS, `http` si no) en el
navegador del sistema.

### Errores habituales

- **Not a directory:** la ruta no existe o no es una carpeta.
- **Project not found:** el dominio no está registrado.
- **Invalid domain:** el dominio no cumple `[a-z0-9][a-z0-9._-]*` (máx. 253).
- **Invalid service:** nombre no válido o phpMyAdmin, que está retirado.

## PHP

### `valet php [list|ls]`

```bash
valet php
```

Lista runtimes con estado (`default`, `installed`, `available`), estado FPM y
número de proyectos que los usan. No admite `--json`.

### `valet php install <version>`

```bash
valet php install 8.3
```

Pide al motor que construya e instale el runtime. Muestra la salida real del
proceso. Requiere la API online. La versión debe tener formato `major.minor`.

### `valet php extensions <version> [--json]`

```bash
valet php extensions 8.3
valet php extensions 8.3 --json
```

Muestra si la imagen está construida, si conviene reconstruirla, módulos
cargados, extensiones declaradas/presentes/no disponibles y paquetes del
sistema. Alias: `ext`.

### `valet php pin <dominio> <version>`

```bash
valet php pin acme.test 8.3
```

Alias de `valet projects php`.

### `valet php use <version> [--yes]`

```bash
valet php use 8.3
valet php use 8.3 --yes
```

Cambia el PHP global del motor. No reemplaza el PHP del host. Pide confirmación;
en un script usa `--yes`. Alias: `global`.

## Servicios

### `valet services [list|ls] [--json]`

```bash
valet services
valet services --json
```

Lista servicios con estado, versión, puerto del host y número de sitios.
phpMyAdmin se filtra de la lista.

### `valet services start|stop|restart <nombre>`

```bash
valet services start mysql
valet services stop mysql
valet services restart mysql
```

Antes de arrancar un servicio inactivo, la CLI comprueba conflictos reportados
por el motor y disponibilidad real del puerto principal. Si está ocupado,
rechaza la operación; no mata el proceso.

### `valet services port <nombre> <puerto-host> [--container <puerto-contenedor>]`

```bash
valet services port mysql 3307
valet services port mailpit 11025 --container 1025
```

Cambia el mapeo del host. Sin `--container` mueve el principal; con
`--container` mueve un mapeo secundario. Comprueba que el puerto esté libre y
conserva los demás mapeos y `extra_ports`. Si el motor rechaza el guardado,
restaura su snapshot.

### `valet services logs <nombre>`

```bash
valet services logs mysql
```

Abre el stream `lerd-<nombre>`.

### `valet services remove <nombre> [--yes]`

```bash
valet services remove mysql
valet services remove mysql --yes
```

Elimina el contenedor del servicio con `removeData=false`. Los volúmenes con
nombres y las bases de datos no se borran. Pide confirmación.

phpMyAdmin no se puede quitar por aquí; usa `valet phpmyadmin remove`.

## Puertos

### `valet ports [list|ls] [--json]`

```bash
valet ports
valet ports --json
```

Mezcla listeners del host con mapeos gestionados. Si el motor está offline,
muestra solo listeners del host y lo indica.

### `valet ports check <puerto> [--address <ip>] [--json]`

```bash
valet ports check 3000
valet ports check 3000 --address 127.0.0.1
valet ports check 3000 --json
```

Hace un bind real sin privilegios. Puerto entre 1 y 65535; la dirección debe ser
una IP. Por defecto `127.0.0.1`. Devuelve código `1` si no está disponible. No
detiene procesos.

## Bases de datos

### `valet databases [--json]`

```bash
valet databases
valet databases --json
```

Muestra motores, estado, bases, proyecto asociado y tamaño. Requiere API online.
No crea, borra ni modifica bases. No incluye phpMyAdmin.

## Logs

### `valet logs [unidad] [--json]`

```bash
valet logs
valet logs --json
valet logs lerd-nginx
```

Sin unidad, lista fuentes. Con unidad, abre el stream SSE. `--json` solo se
permite al listar; un stream con `--json` termina con error. `Ctrl+C` devuelve
`130`.

Unidades habituales:

```text
lerd-nginx
lerd-watcher
lerd-ui
lerd-php83-fpm
lerd-<servicio>
```

La unidad debe existir entre las fuentes que reporta el motor.

## Configuración y tema

### `valet config [get|set|path] [clave] [valor]`

```bash
valet config get
valet config get theme
valet config get enginePath
valet config set theme carbon-dark
valet config set engine-path "$HOME/.local/bin/lerd"
valet config set engine-path auto
valet config set sidebar-width 280
valet config path
valet config path --json
```

| Acción | Efecto |
| --- | --- |
| `get` sin clave | Imprime toda la configuración en JSON. |
| `get <clave>` | Imprime el valor; con `--json`, en JSON. |
| `set <clave> <valor>` | Valida y guarda. |
| `path` / `paths` | Muestra config, configFile, data, state, logs y cache. |

Claves editables: `theme`, `engine-path`/`enginePath`,
`sidebar-width`/`sidebarWidth`.

- `engine-path auto` o `none` borra la ruta guardada.
- `sidebar-width` debe estar entre 180 y 480.
- `telemetry` no se puede activar.
- Claves desconocidas o de solo lectura devuelven error.

### `valet theme [id]`

```bash
valet theme
valet theme carbon-dark
valet theme --json
```

Sin argumento muestra el tema actual. Con argumento valida uno de los cuatro IDs
y lo guarda. `--json` devuelve `{ "theme": "..." }`.

IDs válidos:

```text
min-dark
min-light
carbon-dark
carbon-light
```

## Migración

### `valet migrate [status|detect] [--json]`

```bash
valet migrate detect
valet migrate detect --json
valet migrate status
valet migrate status --json
```

- `detect` inspecciona una instalación heredada y muestra configuración, datos,
  binario y sitios detectados.
- `status` muestra si hay manifiesto de adopción, copia, fecha, modo, sitios,
  archivos y bytes.

### `valet migrate apply [--yes]`

```bash
valet migrate apply
valet migrate apply --yes
```

Crea una copia verificada de la configuración heredada y registra la adopción.
No mueve contenedores, volúmenes, proyectos ni bases de datos. Si no hay nada
que adoptar, no hace nada. Si ya existe una copia con los mismos hashes, no
duplica.

Requiere confirmación; en un script usa `--yes`. No admite `--json`.

## phpMyAdmin heredado

### `valet phpmyadmin [status|remove] [--yes]`

```bash
valet phpmyadmin status
valet phpmyadmin remove
valet phpmyadmin remove --yes
```

- `status` comprueba si existe el contenedor heredado.
- `remove` pide confirmación, necesita un binario de motor válido y ejecuta la
  eliminación del contenedor.
- No toca bases de datos, volúmenes ni proyectos.
- No admite `--json`.
- Requiere la API online.

## Abrir el dashboard o un sitio

### `valet open [dominio|dashboard]`

```bash
valet open
valet open dashboard
valet open acme.test
```

Sin argumento o con `dashboard`, pide al motor que abra su dashboard y requiere
un binario de motor válido. Con un dominio, consulta la API, abre la URL del
proyecto en el navegador y requiere que el proyecto esté registrado. El dominio
debe ser válido.

## Matriz de `--json`

| Comando | ¿Soporta `--json`? |
| --- | --- |
| `doctor` | Sí |
| `status` | Sí |
| `version` | Sí |
| `projects` | Sí |
| `projects add/remove/php` | No |
| `projects services` | Sí |
| `projects service` | Sí |
| `projects restart/pause/resume/secure/unsecure/rebuild` | No |
| `projects open` | No |
| `php` | No |
| `php install` | No |
| `php extensions` | Sí |
| `php pin` | No |
| `php use` | No |
| `services` | Sí |
| `services start/stop/restart` | No |
| `services port` | No |
| `services logs` | No (stream) |
| `services remove` | No |
| `ports` | Sí |
| `ports check` | Sí |
| `databases` | Sí |
| `logs` (listar) | Sí |
| `logs` (stream) | No |
| `config path` | Sí |
| `config get` sin clave | Siempre JSON |
| `config get <clave>` | Con `--json` |
| `config set` | Sí (configuración guardada) |
| `theme` | Sí |
| `migrate detect/status` | Sí |
| `migrate apply` | No |
| `phpmyadmin` | No |
| `open` | No |

## Variables de entorno

| Variable | Efecto |
| --- | --- |
| `VALET_ENGINE_BIN` | Binario explícito del motor. |
| `VALET_ENGINE_URL` | Base de la API; por defecto `http://127.0.0.1:7073`. |
| `VALET_CONFIG_HOME` | Directorio de configuración. |
| `VALET_DATA_HOME` | Directorio de datos. |
| `VALET_STATE_HOME` | Directorio de estado. |
| `VALET_CACHE_HOME` | Directorio de caché. |
| `VALET_CLI_DIR` | Destino del instalador de la CLI. |
| `NO_COLOR` | Desactiva color ANSI. |
| `TERM=dumb` | Desactiva color ANSI. |

`VALET_ENGINE_URL` se aplica siempre. La ruta guardada en `enginePath` tiene
prioridad sobre la autodetección; `VALET_ENGINE_BIN` participa en la
autodetección cuando no hay ruta guardada.

## Lo que la CLI no expone

No existe `exec`, `shell`, `run`, `eval`, carga de plugins ni una operación
arbitraria de archivos. La CLI no puede ejecutar un comando que no esté en
`EngineCommand`. Tampoco puede iniciar un proceso con una cadena de shell.

## Ejemplos seguros

```bash
valet doctor --json > doctor.json
valet status
valet projects
valet projects add "$PWD"
valet projects open acme.test
valet projects services acme.test --json
valet php
valet php extensions 8.3 --json
valet services
valet ports check 3306 --json
valet databases --json
valet logs lerd-nginx
valet migrate detect
valet theme carbon-light
```

## Siguiente paso

- [Chuleta de comandos](Command-Cheat-Sheet.md)
- [Mapa de comandos del motor](Engine-Command-Map.md)
- [Solución de problemas](Troubleshooting.md)
