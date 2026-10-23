# Instalación

## Requisitos

| Requisito | Detalle |
| --- | --- |
| Sistema | Linux o macOS para el motor upstream. Hay objetivos de Windows configurados, pero la validación de ejecución se hizo en Linux. |
| Node.js | 20 o superior, solo para compilar o desarrollar desde el código fuente. |
| Motor | Un binario `lerd` o `valet-engine`, o una API del motor ya iniciada. Sin motor, la interfaz abre en modo offline. |
| Podman | Solo si usas los contenedores del motor. VALET no instala Podman ni cambia el PHP del host. |
| Red | El motor se detecta por HTTP en `http://127.0.0.1:7073` por defecto. |

El motor puede estar apagado al abrir VALET: verás el aviso de motor offline y
las acciones de gestión se habilitarán cuando esté disponible.

## Opción A: AppImage en Linux

El artefacto de la release es:

```text
release/valet-desktop-1.0.0-linux-x86_64.AppImage
```

Hazlo ejecutable y ábrelo:

```bash
chmod +x valet-desktop-1.0.0-linux-x86_64.AppImage
./valet-desktop-1.0.0-linux-x86_64.AppImage
```

Si tu sistema no tiene FUSE, ejecuta la AppImage extrayéndola en un directorio
temporal:

```bash
APPIMAGE_EXTRACT_AND_RUN=1 ./valet-desktop-1.0.0-linux-x86_64.AppImage
```

Comprueba la integridad si tienes el hash publicado:

```bash
sha256sum valet-desktop-1.0.0-linux-x86_64.AppImage
```

## Opción B: paquete `.deb` en Debian/Ubuntu

```bash
sudo apt install ./valet-desktop-1.0.0-linux-amd64.deb
```

Alternativa con `dpkg`:

```bash
sudo dpkg -i valet-desktop-1.0.0-linux-amd64.deb
sudo apt-get install -f
```

El paquete instala la aplicación en `/opt/VALET/valet-desktop`, una entrada de
escritorio en `/usr/share/applications/valet.desktop`, el perfil AppArmor y los
scripts de mantenimiento. Después puedes abrir **VALET** desde el menú de
aplicaciones o ejecutar:

```bash
valet-desktop
```

Para desinstalar el paquete:

```bash
sudo apt remove valet-desktop
```

La desinstalación no borra tus proyectos, los datos del motor ni la
configuración de VALET en `~/.config/valet`. Borra esos directorios solo si
sabes exactamente lo que estás haciendo.

## Opción C: desde el código fuente

```bash
git clone <url-del-repositorio> valet
cd valet
npm install
```

Desarrollo con recarga:

```bash
npm run dev
```

Compilación de producción:

```bash
npm run build
npm start
```

`npm run build` genera:

- el renderer de Vite en `dist/`;
- el proceso principal y el preload de Electron en `dist/electron/`;
- la CLI en `dist/cli/valet.js`.

## Instalar la CLI `valet`

La CLI comparte el adaptador y las validaciones de la aplicación:

```bash
npm run build:cli
./scripts/install-cli.sh
```

El instalador crea un enlace simbólico en `~/.local/bin/valet` hacia
`bin/valet`. Si `~/.local/bin` no está en tu `PATH`, añádelo a tu shell:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Puedes elegir otro directorio:

```bash
VALET_CLI_DIR="$HOME/bin" ./scripts/install-cli.sh
```

El instalador **se niega a sobrescribir** un `valet` existente que no sea este
wrapper, porque Laravel Valet usa el mismo nombre. Revisa el conflicto con:

```bash
command -v valet
ls -l "$(command -v valet)"
```

Usa `--force` solo después de confirmar que el comando existente es el que
quieres reemplazar:

```bash
./scripts/install-cli.sh --force
```

Comprueba la instalación:

```bash
valet version
valet doctor
```

## Preparar el motor

VALET detecta el motor en este orden:

1. La API indicada por `VALET_ENGINE_URL` (por defecto
   `http://127.0.0.1:7073`).
2. El binario guardado en `enginePath` de `desktop.json`.
3. `VALET_ENGINE_BIN`.
4. `lerd` o `valet-engine` en `PATH`.
5. Rutas habituales como `~/.local/bin/lerd`, `/usr/local/bin/lerd`,
   `/usr/bin/lerd` y `/opt/homebrew/bin/lerd`.

Puedes indicar un binario concreto:

```bash
export VALET_ENGINE_BIN="$HOME/.local/bin/lerd"
```

O guardarlo en la configuración de VALET:

```bash
valet config set engine-path "$HOME/.local/bin/lerd"
```

El binario debe ser un archivo ejecutable absoluto llamado `lerd` o
`valet-engine` (también se acepta `lerd.exe`). No se acepta un intérprete
arbitrario.

Para una API ya iniciada en otro puerto loopback:

```bash
export VALET_ENGINE_URL="http://127.0.0.1:7073"
```

Arranca el motor desde la interfaz o con:

```bash
valet start
```

Comprueba el estado:

```bash
valet status
valet doctor
```

## Primer arranque

1. Abre VALET.
2. Mira el indicador del motor en la barra de estado.
3. Pulsa **Add project** y elige una carpeta existente.
4. Selecciona el proyecto y abre su sitio o su terminal.
5. Ejecuta **Run doctor** en Logs & diagnostics.
6. Si quieres la CLI, instálala y prueba `valet projects`.

## Notas por sistema operativo

- **Linux y Windows:** VALET usa el marco y los botones nativos del sistema.
- **macOS:** se usa `hiddenInset` con los semáforos nativos sobre la barra de
  herramientas de la aplicación.
- Las capturas hechas con `capturePage` muestran solo el contenido web, no el
  marco nativo del sistema.

## Siguiente paso

Continúa con [Inicio rápido](Quick-Start.md) para registrar tu primer proyecto
y ejecutar el circuito completo.
