# Seguridad

## Frontera de confianza

```text
No confiable: contenido web, JSON de temas, respuestas del motor
Renderer:     Chromium sandbox, sin Node, sin FS ni procesos directos
Preload:      contextBridge con API fija, sin ipcRenderer crudo
Main:         proceso local de confianza; valida cada petición
Motor:        servicio local instalado aparte
```

El renderer no recibe `child_process`, `fs`, `eval` ni un canal IPC genérico.
La única superficie es la API tipada de `shared/api.ts` expuesta por el preload.

## Aislamiento de Electron

- `contextIsolation` activado.
- `nodeIntegration` desactivado.
- `sandbox` activado.
- Sin `webviewTag`.
- Sin módulo remoto.
- Navegación restringida a la URL exacta de la aplicación.
- Ventanas nuevas denegadas.
- URLs externas limitadas a `http:`/`https:` y abiertas por el sistema.
- Permisos denegados salvo escritura de portapapeles saneada.

En desarrollo, el proceso principal añade `--no-sandbox` porque el helper
setuid no está instalado en un checkout. Los builds empaquetados mantienen el
sandbox; el AppImage tiene un fallback controlado si el kernel bloquea los
namespaces de usuario, y el `.deb` configura `chrome-sandbox` en `postinst`.

## IPC validado

Cada handler:

- comprueba que el remitente sea la `webContents` de la ventana;
- valida rutas, dominios, versiones, nombres de servicio, puertos y unidades de
  log;
- no acepta un comando, una ruta o un binario arbitrario desde el renderer.

No existe `invoke(channel, ...)` genérico. La terminal solo puede abrir un shell
en una carpeta absoluta existente y escribir en su stdin.

## Allow-list del motor

`EngineCommand` es una unión cerrada de operaciones. `validateEngineArgs` las
traduce a vectores de argumentos fijos. Ejemplos:

| Operación | Argumentos del motor |
| --- | --- |
| `start` | `start` |
| `stop` | `stop` |
| `restart` | `restart` |
| `doctor` | `doctor` |
| `link` | `link` (con `cwd` validado) |
| `unlink` | `unlink` |
| `use-php 8.3` | `use 8.3` |
| `service-stop mysql` | `service stop mysql` |
| `remove-phpmyadmin` | `service remove phpmyadmin` |

El binario se valida como archivo ejecutable absoluto llamado `lerd` o
`valet-engine` (o `.exe`). Un `enginePath` malicioso no puede convertir el
adaptador en un lanzador de intérpretes.

Las acciones de sitio aceptan solo:

```text
php, unlink, pause, unpause, secure, unsecure, restart, rebuild,
service:add, service:remove, service:declare, service:dismiss
```

Las acciones PHP aceptan solo `version`/`branch`. Las acciones de servicio
aceptan solo un `name` validado. phpMyAdmin se rechaza por nombre en todos los
handlers de servicio.

## Puertos

- Las comprobaciones hacen un bind local; no envían señales ni matan procesos.
- Cambiar un puerto se rechaza si el destino está ocupado.
- Arrancar un servicio inactivo se rechaza si el motor reporta un puerto
  requerido ocupado o si falla un bind del puerto principal.
- Los puertos secundarios se comprueban al editarlos y el motor valida de nuevo
  al guardar.
- No hay una acción “force free”.

## Terminales

La terminal es un shell real con los privilegios del usuario. Esto es
intencional. Implicaciones:

- puede leer archivos y usar credenciales;
- puede ejecutar cualquier comando que el usuario escriba;
- hereda el entorno del usuario;
- añade el directorio de shims del motor al principio del `PATH` si existe.

Límites técnicos:

- máximo 8 sesiones;
- búfer de 64 KB por sesión;
- 64 KB por escritura de entrada;
- shell resuelto desde una lista (`bash`, `zsh`, `sh`, `fish`, `dash`) o
  `/bin/sh`;
- en Windows, PowerShell.

No abras terminales en una sesión de escritorio compartida o no confiable.

## Logs

- La unidad debe coincidir con `lerd-[a-z0-9-]+`.
- El proceso principal abre la conexión SSE; el renderer no hace `fetch` al
  motor.
- Las líneas de log son datos, no instrucciones. VALET no las evalúa.

## CSP

`index.html` define:

```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self' data:;
connect-src 'self' ws://localhost:5173 http://localhost:5173
            ws://127.0.0.1:5173 http://127.0.0.1:5173;
object-src 'none'; base-uri 'none'; form-action 'none'
```

Los puertos 5173 son solo para HMR de Vite. En producción, el tráfico al motor
pasa por IPC, no por `fetch` del renderer. `style-src 'unsafe-inline'` es
necesario para estilos inline de React y variables CSS; no se renderiza HTML
arbitrario.

## Migración

- Solo lee rutas heredadas fijas.
- No sigue rutas arbitrarias proporcionadas por el usuario.
- No borra datos de origen.
- Aborta si un checksum no coincide.
- Las copias se crean con modo `0700`; los archivos son de usuario.

## Secretos y datos locales

- No hay telemetría; `telemetry` se fuerza a `false`.
- El renderer recibe rutas de home y proyectos para mostrarlas y para la
  terminal.
- Las credenciales no se envían al renderer; las respuestas del motor se mapean
  a modelos de visualización.
- Los logs y terminales pueden contener secretos de comandos o servicios. Se
  quedan en el proceso local y no se suben.
- El motor upstream puede enlazar su UI/API a `0.0.0.0:7073` y tiene su propia
  puerta LAN. VALET no añade acceso remoto y se conecta por loopback.

## Limitaciones conocidas

- El binario del motor es código de confianza; si eliges un ejecutable
  malicioso llamado `lerd`, se ejecutará con argumentos permitidos.
- Un renderer comprometido podría escribir en una terminal del usuario, porque
  esa es la función de la terminal.
- No hay firma de código ni actualización automática configurada en este
  repositorio.
- La seguridad de la red y de los contenedores del motor pertenece al upstream.

## Reportar un problema

Reporta vulnerabilidades en privado a los mantenedores del repositorio. No
incluyas credenciales, código privado ni logs sin redactar. Para un informe
técnico, adjunta `valet doctor --json` y `valet status --json` después de
revisar que no contengan rutas o datos sensibles.

## Siguiente paso

- [Solución de problemas](Troubleshooting.md)
- [Configuración y datos](Configuration-and-Data.md)
- [Documento de seguridad original](../docs/SECURITY.md)
