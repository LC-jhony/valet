# Terminal y logs

## Terminal

La terminal de VALET es un **shell real** conectado a un PTY. No simula comandos
ni interpreta la salida. Se abre en una carpeta de proyecto registrada o, si no
hay proyecto seleccionado, en el directorio home.

### Abrir una sesión

- **Terminal → New terminal**.
- `Ctrl` + la tecla de acento grave en Linux/Windows (`Cmd` + la misma tecla en
  macOS).
- Desde el detalle de un proyecto: **Terminal**.
- Desde la paleta: **New terminal in selected project**.

Cada sesión muestra una pestaña con título y ruta. Puedes cambiar de sesión,
cerrarla con `×` o usar **Close session**. El límite es de **8 sesiones
simultáneas**.

### Qué shell se usa

En Linux y macOS se resuelve un shell permitido:

1. `$SHELL`, si es una ruta absoluta y su nombre está en la lista;
2. `bash`, `zsh`, `fish`, `sh` o `dash` en ubicaciones habituales;
3. `/bin/sh` como último recurso.

En Linux/macOS se usa `script(1)` para asignar el PTY. En Windows se usa
`powershell.exe -NoLogo`. La sesión hereda tu entorno y añade:

| Variable | Valor |
| --- | --- |
| `TERM` | `xterm-256color` |
| `COLORTERM` | `truecolor` |
| `VALET` | `1` |
| `VALET_PROJECT` | Dominio o nombre del proyecto |
| `PATH` | Incluye primero `~/.local/share/lerd/bin` si existe |

El shim del motor permite que `php` y `composer` usen el runtime del proyecto.
Si el motor no ha instalado shims, el `PATH` del host queda intacto.

### Scrollback y entrada

- Se conservan los últimos **64 KB** de salida por sesión para recrear la
  terminal al volver a la vista.
- Cada escritura de entrada está limitada a **64 KB**.
- Al cerrar la sesión se envía `SIGTERM`; si sigue viva tras un segundo, se
  envía `SIGKILL`.

### Seguridad de la terminal

La terminal es intencionalmente un shell con tus privilegios. Puede leer tus
archivos, usar tus credenciales y ejecutar cualquier comando que tú escribas.
No pegues comandos que no entiendas. VALET no puede hacer que un shell
interactivo sea seguro frente a un portapapeles malicioso.

La interfaz solo puede abrir un shell en una carpeta absoluta existente y
escribir en su stdin; no puede elegir el binario ni pasar argumentos de línea de
comandos.

## Logs & diagnostics

La vista **Logs & diagnostics** reúne tres pestañas.

### Container logs

Stream en vivo de una fuente del motor. Las fuentes se derivan de los servicios
y runtimes PHP instalados:

- `lerd-nginx` — Nginx;
- `lerd-watcher` — watcher del motor;
- `lerd-ui` — dashboard/API;
- `lerd-php<version>-fpm` — PHP-FPM de cada versión instalada;
- `lerd-<servicio>` — cada servicio reportado.

La barra de la pestaña permite:

- elegir **Source**;
- **Pause** / **Resume** el stream;
- **Clear** las líneas;
- activar **Follow output** para desplazarse al final;
- ver el identificador de unidad (`lerd-...`);
- ver el estado `live`, `paused` o `error`.

Se conservan hasta 2.500 líneas en memoria. Al cambiar de fuente o de estado
del motor se limpian las líneas y se reinicia el stream.

### Engine output

Muestra la salida de comandos ejecutados por VALET, por ejemplo **Run doctor**.
Puedes limpiarla con **Clear output**. La salida es la del proceso real, no un
texto simulado.

### Problems

Lista problemas detectados a partir del estado del entorno. Si no hay
problemas, muestra **No problems detected**. El contador de problemas aparece
también en la franja de diagnóstico.

### Diagnóstico superior

La franja muestra:

- estado de la API: online, binary only u offline;
- versión del motor;
- URL de la API;
- número de problemas;
- botón **Run doctor**.

## Logs desde la CLI

Listar fuentes:

```bash
valet logs
valet logs --json
```

Abrir un stream:

```bash
valet logs lerd-nginx
valet logs lerd-php83-fpm
valet logs lerd-mysql
```

- El stream usa Server-Sent Events del motor.
- `Ctrl+C` aborta y devuelve código `130`.
- `--json` no está permitido al abrir un stream; sí al listar fuentes.
- La unidad debe existir entre las fuentes conocidas.
- Las líneas son datos: no se evalúan ni se ejecutan.

## Diagnóstico con `valet doctor`

```bash
valet doctor
valet doctor --json
valet doctor --engine
```

Comprueba, entre otras cosas:

- binario y API del motor;
- que la API sea loopback;
- directorios de configuración y estado;
- configuración de escritorio;
- proyectos, servicios, PHP y puertos;
- phpMyAdmin heredado;
- estado de adopción.

`--engine` añade el doctor del motor upstream cuando el binario está
disponible. El comando es de solo lectura y devuelve `1` si la API está offline
o algún chequeo falla.

## Comandos relacionados

```bash
valet logs [unidad] [--json]
valet services logs <servicio>
valet doctor [--engine] [--json]
```

## Siguiente paso

- [Ajustes y temas](Settings-and-Themes.md)
- [Solución de problemas](Troubleshooting.md)
- [Referencia de la CLI](CLI-Reference.md)
