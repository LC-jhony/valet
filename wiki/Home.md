# Wiki de VALET

VALET es un **plano de control de escritorio** para entornos locales de
desarrollo PHP. Está construido sobre el motor **Lerd**, que se mantiene sin
cambios: VALET no reimplementa contenedores, DNS, Nginx, PHP-FPM, certificados
ni volúmenes. La aplicación ofrece una interfaz Electron/React y una CLI
`valet` que comparten el mismo adaptador y las mismas validaciones.

La documentación técnica original del repositorio está en inglés, dentro de
[`docs/`](../docs). Esta wiki está en español y está pensada para aprender a
usar el producto, consultar comandos y resolver problemas.

## Qué puedes hacer

- Registrar proyectos existentes **en su sitio**, sin mover archivos.
- Ver y cambiar el runtime PHP de cada proyecto sin tocar el PHP del sistema.
- Instalar runtimes PHP y consultar sus módulos, extensiones y paquetes.
- Arrancar, parar, reiniciar y cambiar puertos de servicios del motor.
- Gestionar servicios asociados a un proyecto: añadir, separar, declarar o
  descartar sugerencias.
- Ver puertos del host y del motor, detectar conflictos y comprobar
  disponibilidad real.
- Consultar bases de datos y tamaños sin panel de administración incluido.
- Abrir terminales reales basadas en PTY dentro de las carpetas de proyecto.
- Ver logs en vivo del motor, Nginx, PHP y servicios.
- Diagnosticar el entorno con `valet doctor`.
- Adoptar una instalación previa del motor con una copia verificada.
- Elegir entre cuatro temas: **Min Dark**, **Min Light**, **Carbon Dark** y
  **Carbon Light**.

## Mapa del sistema

```text
┌──────────────────────────── Ventana Electron ────────────────────────────┐
│ Renderer React (sandbox, sin Node)                                      │
│   vistas del workbench ── API tipada window.valet ── contextBridge      │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ IPC validado (solo proceso principal)
┌───────────────────────────────▼──────────────────────────────────────────┐
│ Proceso principal de Electron                                           │
│  validación IPC · escaneo de puertos · PTY · SSE · adaptador del motor  │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ HTTP loopback / execFile con allow-list
┌───────────────────────────────▼──────────────────────────────────────────┐
│ Motor Lerd existente (sin cambios)                                      │
│  contenedores · volúmenes · sites.yaml · certificados · imágenes PHP    │
└──────────────────────────────────────────────────────────────────────────┘
```

La CLI usa exactamente el mismo adaptador (`shared/engine.ts`) y la misma
allow-list de comandos. No existe un canal para ejecutar comandos arbitrarios.

## Empieza aquí

| Quiero… | Página |
| --- | --- |
| Instalar la aplicación o compilarla | [Instalación](Installation.md) |
| Hacer mi primer proyecto en diez minutos | [Inicio rápido](Quick-Start.md) |
| Conocer la ventana, menús y atajos | [Interfaz de escritorio](Desktop-Interface.md) |
| Gestionar proyectos | [Proyectos](Projects.md) |
| Gestionar PHP y servicios | [PHP y servicios](PHP-and-Services.md) |
| Entender puertos y bases de datos | [Puertos y bases de datos](Ports-and-Databases.md) |
| Usar terminales y logs | [Terminal y logs](Terminal-and-Logs.md) |
| Cambiar temas o ajustes | [Ajustes y temas](Settings-and-Themes.md) |
| Consultar todos los comandos de la CLI | [Referencia de la CLI](CLI-Reference.md) |
| Tener una chuleta de comandos | [Chuleta de comandos](Command-Cheat-Sheet.md) |
| Saber dónde se guarda todo | [Configuración y datos](Configuration-and-Data.md) |
| Adoptar una instalación previa | [Migración y copias](Migration-and-Backup.md) |
| Revisar el modelo de seguridad | [Seguridad](Security.md) |
| Resolver un fallo | [Solución de problemas](Troubleshooting.md) |
| Desarrollar o empaquetar VALET | [Desarrollo](Development.md) |
| Ver cómo se traduce cada comando al motor | [Mapa de comandos del motor](Engine-Command-Map.md) |

## Los cuatro temas

| ID | Nombre | Tipo | Archivo |
| --- | --- | --- | --- |
| `min-dark` | Min Dark | oscuro | `src/themes/min-dark.json` |
| `min-light` | Min Light | claro | `src/themes/min-light.json` |
| `carbon-dark` | Carbon Dark | oscuro | `src/themes/carbon-dark.json` |
| `carbon-light` | Carbon Light | claro | `src/themes/carbon-light.json` |

Los JSON son la fuente de verdad visual. Ningún componente debe definir su
propia paleta. Puedes cambiar el tema desde **Settings → Appearance**, el menú
**View**, la paleta de comandos, el indicador de tema de la barra de estado o
`valet theme <id>`.

## Promesas importantes

- **Los proyectos no se mueven.** Registrar un proyecto solo lo enlaza con el
  motor; los archivos siguen donde están.
- **Las acciones de VALET no borran datos.** Desregistrar un proyecto conserva
  archivos, bases de datos y volúmenes; quitar un servicio envía
  `removeData=false`.
- **El PHP del sistema no se reemplaza.** Los pines y el PHP global son del
  motor; la CLI y Composer usan los shims del proyecto cuando están instalados.
- **No se matan procesos ajenos.** Si un puerto está ocupado, VALET propone
  cambiarte el puerto gestionado; no libera el puerto por la fuerza.
- **No hay telemetría.** El esquema fija `telemetry: false`.
- **No hay comandos arbitrarios.** La CLI y la interfaz solo pueden invocar
  operaciones incluidas en la allow-list del motor.
- **La adopción no mueve datos.** Crea una copia verificada de la configuración
  heredada y registra un manifiesto; el motor sigue usando sus directorios.

## Estado de la plataforma

La interfaz y la CLI se han validado en Linux, incluyendo los artefactos
AppImage y `.deb`. Los objetivos de macOS y Windows están configurados en
Electron Builder, pero la validación de ejecución en esos sistemas no se hizo
en el entorno de desarrollo actual. Consulta
[Desarrollo](Development.md#verificación-y-limitaciones) para conocer el
alcance exacto.

## Documentación relacionada

- [README del proyecto](../README.md)
- [Arquitectura](../docs/ARCHITECTURE.md)
- [Referencia CLI original](../docs/CLI.md)
- [Temas](../docs/THEMES.md)
- [Seguridad](../docs/SECURITY.md)
- [Diagnóstico](../docs/DIAGNOSTICS.md)
- [Pruebas](../docs/TESTING.md)
