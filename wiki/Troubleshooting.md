# Solución de problemas

## Primeros tres comandos

```bash
valet doctor
valet status
valet doctor --json > doctor.json
```

`doctor` es de solo lectura. Revisa el primer chequeo que falle antes de tocar
nada. Si el motor está offline, el resto de datos puede estar incompleto.

## El motor aparece offline

### Comprobar binario y API

```bash
command -v lerd
command -v valet-engine
valet status
```

Si el binario existe pero la API no responde, el modo es `cli` (idle). Si no
existe ninguno, el modo es `offline`.

Soluciones:

```bash
# Indicar un binario concreto
export VALET_ENGINE_BIN="$HOME/.local/bin/lerd"

# O guardarlo en la configuración
valet config set engine-path "$HOME/.local/bin/lerd"

# Arrancar el motor
valet start
```

Después:

```bash
valet doctor
```

### La API está en otra URL

```bash
export VALET_ENGINE_URL="http://127.0.0.1:7073"
valet doctor
```

La URL debe apuntar a la API del motor. Se recomienda loopback. `doctor` avisa
si la URL no es loopback.

### El binario no es aceptado

El archivo debe ser una ruta absoluta, regular, ejecutable y llamarse `lerd` o
`valet-engine` (o `.exe`). Un script con otro nombre no se acepta aunque sea
ejecutable.

```bash
ls -l "$VALET_ENGINE_BIN"
```

### El motor está online pero la interfaz no lo ve

- Pulsa el indicador del motor en la barra de estado.
- Revisa `VALET_ENGINE_URL` en el entorno desde el que lanzaste la aplicación.
- Abre **Settings → Engine → Check connection**.
- Reinicia la aplicación después de cambiar variables de entorno.
- Comprueba que no haya dos motores en puertos distintos.

## La CLI no se encuentra

```bash
command -v valet
echo "$PATH"
```

Si instalaste con el script:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Si el instalador se negó a sobrescribir un `valet` existente, revisa:

```bash
command -v valet
ls -l "$(command -v valet)"
```

No uses `--force` hasta confirmar que el comando existente no es Laravel Valet
u otra herramienta que necesitas.

## `projects add` falla

| Mensaje | Causa | Solución |
| --- | --- | --- |
| `Not a directory` | La ruta no existe o no es una carpeta. | Usa una ruta absoluta a una carpeta existente. |
| `project path is required` | Falta el argumento. | `valet projects add "$PWD"`. |
| API offline | El motor no responde. | `valet start` o corrige la API. |
| `engine binary not found` | No hay binario para ejecutar `link`. | Configura `engine-path` o `VALET_ENGINE_BIN`. |
| `The engine could not register` | El motor rechazó el enlace. | Revisa logs y `valet doctor`. |

Recuerda: `~` debe expandirlo el shell; la CLI no expande tildes.

## El proyecto aparece parado

1. Comprueba el estado del proyecto en Projects.
2. Revisa si está **Paused**.
3. Mira **Logs → Container logs → PHP FPM**.
4. Ejecuta `valet projects restart <dominio>`.
5. Comprueba el rango de PHP y `composer.json`.
6. Revisa conflictos en **Ports**.

## PHP

### No aparece una versión

```bash
valet php
valet php install 8.3
```

Si la instalación falla:

- confirma que la API está online;
- revisa la salida del build;
- comprueba espacio en disco;
- revisa los logs del motor;
- verifica que la versión exista como instalable.

### El pin de PHP falla

```bash
valet projects php acme.test 8.3
```

Causas posibles:

- la versión no está instalada;
- el dominio no existe;
- el motor rechaza el cambio;
- el proyecto no usa PHP.

Si el motor falla, el adaptador intenta restaurar el pin anterior. Si la
restauración también falla, se informa; revisa el estado del proyecto antes de
seguir.

### La terminal usa otro PHP

- Abre una sesión nueva después de cambiar el pin.
- Comprueba que `~/.local/share/lerd/bin` exista.
- Ejecuta `which php` y `php -v` dentro de la terminal.
- Si el shim no existe, la terminal usa el PHP del host; no es un fallo de
  VALET.

### Extensiones o módulos ausentes

```bash
valet php extensions 8.3
valet php extensions 8.3 --json
```

Revisa si la imagen está construida, si necesita rebuild y qué extensiones
pueden declararse para esa versión. Algunas extensiones no se pueden compilar en
ciertas versiones de PHP.

## Servicios

### No arranca

```bash
valet services
valet ports
valet logs lerd-<servicio>
```

Si el puerto está ocupado:

```bash
valet ports check 3306
valet services port mysql 3307
```

VALET no mata el proceso que ocupa el puerto. Si es un proceso externo, decides
tú si lo paras.

### No sé qué servicio añadir a un proyecto

```bash
valet projects services acme.test
```

Muestra servicios adjuntos y sugeridos. Una sugerencia no está instalada; usa
**Add** o `projects service add` de forma explícita.

### Quiero eliminar un servicio

```bash
valet services remove mysql
```

Pide confirmación. El contenedor se elimina, pero los volúmenes con nombres y las
bases de datos no se borran por VALET.

## Puertos

### Conflicto

1. **Ports → filtro Conflicts**.
2. Identifica el propietario.
3. Si es gestionado, **Change port** o `valet services port`.
4. Si es externo, no esperes que VALET lo cierre.
5. Vuelve a comprobar.

### `ports check` dice ocupado pero no veo el proceso

Puede ser un socket en otra dirección, un proceso de otro usuario o un servicio
del sistema. Prueba:

```bash
ss -ltnp
lsof -nP -iTCP -sTCP:LISTEN
```

Algunos detalles requieren privilegios. No ejecutes `kill` a ciegas.

## Logs

### El stream está vacío

- Comprueba que la API esté online.
- Verifica que la fuente exista en **Source**.
- Pulsa **Resume** si está paused.
- Revisa que el contenedor esté corriendo.
- Prueba `valet logs lerd-ui` o `valet logs lerd-nginx`.

### El stream se corta

- Revisa la conexión con la API.
- Vuelve a abrir la vista o el comando.
- Comprueba `valet doctor`.
- `Ctrl+C` en la CLI devuelve `130`; es normal.

## Terminal

### No se abre

- Debe haber un proyecto seleccionado o se usa el home.
- La ruta debe ser absoluta y existir.
- En Linux/macOS se necesita `script(1)` disponible.
- En Windows se usa PowerShell.
- El límite es de 8 sesiones; cierra una.

### El shell no es el que esperaba

VALET usa `$SHELL` si su nombre está permitido y existe; si no, prueba
`/bin/bash`, `/bin/zsh`, `/usr/bin/fish`, `/bin/sh` y `/bin/sh`. No se puede
elegir un binario arbitrario desde la interfaz.

### La salida se pierde al cambiar de vista

Se conservan los últimos 64 KB por sesión. Si el comando generó más, la parte
antigua no se conserva.

## Temas

- Solo hay cuatro temas seleccionables.
- Si añadiste un JSON pero no aparece, falta la entrada en `THEME_DEFINITIONS`
  (`shared/themes.ts`).
- Si el tema guardado no es válido, se usa `min-dark`.
- Si los colores no se aplican, revisa la consola del renderer y ejecuta
  `npm test`.
- `valet theme` sin argumentos muestra el tema actual.
- El marco nativo no aparece en las capturas de `capturePage`; no es un fallo.

## AppImage

### No arranca por FUSE

```bash
APPIMAGE_EXTRACT_AND_RUN=1 ./valet-desktop-1.0.0-linux-x86_64.AppImage
```

### Error de sandbox

El AppImage intenta usar el sandbox de Chromium. Si el sistema bloquea los
namespaces de usuario, su `AppRun` puede añadir un fallback. No desactives el
sandbox de forma permanente sin entender el riesgo.

### Comprobar integridad

```bash
sha256sum valet-desktop-1.0.0-linux-x86_64.AppImage
```

## Paquete `.deb`

### Dependencias incumplidas

```bash
sudo apt install -f
```

### El comando no aparece

```bash
dpkg -L valet-desktop | sed -n '1,80p'
```

La aplicación se instala en `/opt/VALET/valet-desktop` y la entrada de escritorio
en `/usr/share/applications/valet.desktop`.

### No se puede instalar como root

La instalación real requiere privilegios. Si no tienes `sudo` interactivo,
extrae el paquete y ejecuta el binario para una comprobación limitada; no es
equivalente a una instalación completa.

## Migración

| Problema | Solución |
| --- | --- |
| No detecta nada | Deben existir `~/.config/lerd/config.yaml` o `~/.local/share/lerd/sites.yaml`; un binario solo no basta. |
| `sites.yaml exists but no project entries were parsed` | Revisa el formato; la copia se puede crear igualmente, pero verifica el conteo. |
| `backup verification failed` | No se copió correctamente; revisa permisos y espacio. |
| `Confirmation required` | Pasa `--yes` en un script no interactivo. |
| Ya adoptado | Los hashes coinciden; no se duplica la copia. |

## macOS y Windows

Los objetivos de compilación están configurados, pero la validación de ejecución
de esta release se hizo en Linux. Si encuentras diferencias:

- revisa el marco nativo y los botones de ventana;
- comprueba la ruta del binario del motor;
- revisa el shell de la terminal (PowerShell en Windows);
- adjunta `valet doctor --json` y la versión en el informe.

## Datos y recuperación

- No borres `~/.config/lerd`, `~/.local/share/lerd` ni los volúmenes para
  “arreglar” un proyecto.
- Haz copias antes de cambios grandes.
- La adopción de VALET no sustituye un backup de bases de datos.
- Para una recuperación real, detén el motor y restaura con cuidado; consulta
  [Migración y copias](Migration-and-Backup.md).

## Recoger un informe de soporte

```bash
valet doctor --json > doctor.json
valet status --json > status.json
valet config path
valet version
```

Añade los logs relevantes, pero **redacta** credenciales, rutas privadas, tokens
y datos de clientes. No adjuntes volcados de bases de datos.

## Siguiente paso

- [Referencia de la CLI](CLI-Reference.md)
- [Configuración y datos](Configuration-and-Data.md)
- [Desarrollo](Development.md)
