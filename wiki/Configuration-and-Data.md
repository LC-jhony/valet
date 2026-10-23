# Configuración y datos

## Directorios

VALET usa rutas XDG en sistemas tipo Unix. Las variables de entorno de VALET
tienen prioridad y deben ser rutas absolutas.

| Uso | Variable | Ruta por defecto |
| --- | --- | --- |
| Configuración | `VALET_CONFIG_HOME` | `$XDG_CONFIG_HOME/valet` o `~/.config/valet` |
| Datos | `VALET_DATA_HOME` | `$XDG_DATA_HOME/valet` o `~/.local/share/valet` |
| Estado | `VALET_STATE_HOME` | `$XDG_STATE_HOME/valet` o `~/.local/state/valet` |
| Caché | `VALET_CACHE_HOME` | `$XDG_CACHE_HOME/valet` o `~/.cache/valet` |
| Logs de VALET | — | `$VALET_STATE_HOME/logs` |

Puedes ver las rutas efectivas con:

```bash
valet config path
valet config path --json
```

Contenido habitual del directorio de configuración:

```text
~/.config/valet/
├── desktop.json       # preferencias de la aplicación
├── adoption.json      # manifiesto de adopción, si existe
└── backups/           # copias verificadas de configuración heredada
```

Si `XDG_CONFIG_HOME` o cualquiera de las variables `VALET_*` no es una ruta
absoluta, se ignora y se usa el valor por defecto.

## `desktop.json`

Ejemplo:

```json
{
  "version": 1,
  "theme": "min-dark",
  "enginePath": null,
  "lastProject": null,
  "recentProjects": [],
  "sidebarWidth": 248,
  "telemetry": false
}
```

| Clave | Tipo | Editable por CLI | Notas |
| --- | --- | --- | --- |
| `version` | `1` | No | Versión del esquema. |
| `theme` | string | Sí | Uno de los cuatro IDs; un valor inválido cae a `min-dark`. |
| `enginePath` | string o `null` | Sí | Ruta absoluta a `lerd`/`valet-engine`, o `null` para autodetectar. |
| `lastProject` | string o `null` | No | Último proyecto seleccionado. |
| `recentProjects` | string[] | No | Máximo 20 entradas. |
| `sidebarWidth` | number | Sí | Entre 180 y 480; por defecto 248. |
| `telemetry` | `false` | No | Forzado a `false`; no se puede activar. |

La lectura normaliza los valores: las claves desconocidas se ignoran, los temas
inválidos vuelven al tema por defecto y `telemetry` siempre queda en `false`.
Las claves antiguas como `panelOpen` o `panelHeight` se ignoran.

La escritura es atómica: se escribe un archivo temporal y se renombra sobre
`desktop.json`. El directorio se crea con modo `0700` y el archivo con `0600`.

### Cambiar valores

```bash
valet config set theme carbon-dark
valet config set engine-path "$HOME/.local/bin/lerd"
valet config set engine-path auto
valet config set sidebar-width 280
```

También puedes editar `desktop.json` a mano. Al leerlo se normaliza; si el JSON
está corrupto o no existe, se usan los valores por defecto.

### Restablecer la configuración

Haz una copia antes de borrar:

```bash
cp "$HOME/.config/valet/desktop.json" "$HOME/desktop.json.bak"
rm "$HOME/.config/valet/desktop.json"
```

La próxima apertura crea una configuración por defecto. Esto no afecta al motor,
a los proyectos ni a las bases de datos. Si usas un directorio personalizado,
ajusta la ruta según `valet config path`.

## Detección del motor

### API

La base de la API se decide así:

```text
VALET_ENGINE_URL  >  http://127.0.0.1:7073
```

Se consulta `/api/version` con un timeout corto. Si responde, el motor está en
modo `http` (online).

### Binario

Si no hay API, se busca un binario ejecutable:

1. `enginePath` guardado en `desktop.json`;
2. `VALET_ENGINE_BIN`;
3. `lerd` y `valet-engine` en cada entrada de `PATH`;
4. `~/.local/bin/lerd`;
5. `/usr/local/bin/lerd`;
6. `/usr/bin/lerd`;
7. `/opt/homebrew/bin/lerd`;
8. `~/.local/bin/valet-engine`.

El binario debe ser:

- una ruta absoluta;
- un archivo regular;
- ejecutable;
- llamado `lerd` o `valet-engine` (se acepta `lerd.exe`/`valet-engine.exe`).

No se acepta un intérprete arbitrario. Si hay binario pero no API, el modo es
`cli` (idle): algunas acciones que usan el binario funcionan, pero las que
necesitan HTTP fallan hasta que arranques el motor.

### Modos

| Modo | Significado |
| --- | --- |
| `http` | API online; proyectos, servicios, PHP, puertos y logs disponibles. |
| `cli` | Binario detectado, API apagada; acciones limitadas. |
| `offline` | Sin API y sin binario; solo configuración, temas y diagnóstico básico. |

`valet doctor` comprueba además que la URL de la API sea loopback
(`127.0.0.1`, `::1` o `localhost`).

## Qué datos pertenecen a quién

| Dato | Propietario | Ruta / ubicación |
| --- | --- | --- |
| Archivos de proyecto | Tú | Donde estén tus carpetas |
| `sites.yaml`, `config.yaml` | Motor | `~/.config/lerd`, `~/.local/share/lerd` |
| Contenedores, volúmenes, imágenes | Motor | Podman y estado del motor |
| Certificados y CA local | Motor | Directorios del motor / mkcert |
| `desktop.json` | VALET | `~/.config/valet` |
| `adoption.json` | VALET | `~/.config/valet` |
| Copias de adopción | VALET | `~/.config/valet/backups` |
| Logs de la aplicación | VALET | `~/.local/state/valet/logs` |
| Sesiones de terminal | Efímero | Memoria del proceso Electron |
| Líneas de log en pantalla | Efímero | Memoria del renderer |

VALET no copia bases de datos ni volúmenes. `migrate apply` solo copia
configuración heredada y escribe un manifiesto; el motor sigue usando sus
propios directorios.

## Adopción y copias

`adoption.json` registra:

- versión del manifiesto;
- fecha de creación;
- modo `in-place`;
- rutas y hashes SHA-256 de `config.yaml` y `sites.yaml`;
- directorio de copia;
- número de sitios, archivos y bytes;
- binario del motor;
- advertencias.

La copia va a:

```text
~/.config/valet/backups/<fecha-o-timestamp>/
```

Incluye `config.yaml`, `sites.yaml` y `themes/` si existe. Los archivos se
verifican con SHA-256 antes de escribir el manifiesto. Si los hashes de origen
no cambian, una nueva ejecución no duplica la copia.

Detalle completo en [Migración y copias](Migration-and-Backup.md).

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `VALET_ENGINE_BIN` | Binario explícito para la autodetección. |
| `VALET_ENGINE_URL` | URL base de la API. |
| `VALET_CONFIG_HOME` | Configuración. |
| `VALET_DATA_HOME` | Datos. |
| `VALET_STATE_HOME` | Estado y logs. |
| `VALET_CACHE_HOME` | Caché. |
| `VALET_CLI_DIR` | Destino del instalador de la CLI. |
| `NO_COLOR` | Sin color ANSI. |
| `TERM=dumb` | Sin color ANSI. |

La terminal de VALET también define `TERM=xterm-256color`, `COLORTERM=truecolor`,
`VALET=1` y `VALET_PROJECT` para la sesión del shell.

## Seguridad de archivos

- La configuración se guarda con permisos de usuario.
- Las copias de adopción se crean con modo `0700`.
- `doctor` avisa si los directorios de configuración o estado son accesibles por
  grupo u otros usuarios.
- No hay telemetría ni envío de datos a servicios remotos.
- Los logs y terminales pueden contener secretos; no se suben a ningún sitio.

## Siguiente paso

- [Migración y copias](Migration-and-Backup.md)
- [Seguridad](Security.md)
- [Solución de problemas](Troubleshooting.md)
