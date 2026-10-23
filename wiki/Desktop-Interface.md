# Interfaz de escritorio

## Ventana y marco nativo

VALET usa el marco nativo del sistema operativo:

- **Linux y Windows:** barra de título y botones de minimizar, maximizar y
  cerrar dibujados por el sistema.
- **macOS:** `hiddenInset` con los semáforos nativos sobre la barra de
  herramientas de la aplicación.

La barra superior interna de VALET no es un sustituto del marco: es una barra
de herramientas con el logotipo, menús, selector de proyecto y estado del
motor. No hay botones personalizados de minimizar, maximizar o cerrar.

## Barra de herramientas

| Zona | Función |
| --- | --- |
| **VALET** | Settings, Command palette, Check engine y Quit VALET. |
| **View** | Projects, Services, Terminal, mostrar/ocultar la barra lateral y los cuatro temas. |
| **Help** | Documentación upstream del motor y About VALET. |
| **Project** | Selector del proyecto activo. Cambiar de proyecto abre la vista Projects. |
| **Engine pill** | Estado del motor; al pulsarlo se vuelve a comprobar la conexión. |

El menú **View** no muestra todas las vistas; la barra de actividades y la
paleta de comandos sí permiten abrir PHP, Ports, Databases, Logs y Settings.

## Barra de actividades

La columna estrecha de la izquierda contiene:

1. **Projects** — proyectos registrados.
2. **PHP** — runtimes instalados y disponibles.
3. **Services** — contenedores y servicios del motor.
4. **Ports** — puertos del host y del motor; muestra un badge si hay
   conflictos.
5. **Databases** — motores y bases de datos.
6. **Terminal** — sesiones PTY.
7. **Logs & diagnostics** — logs y diagnóstico.

Abajo está **Settings**. La vista activa se resalta. Al abrir una vista se crea
o reutiliza una pestaña en la barra superior de pestañas.

## Pestañas

La barra de pestañas permite tener varias vistas abiertas a la vez. Puedes:

- cambiar de pestaña con clic o `Enter`/`Espacio` cuando tiene el foco;
- cerrar una pestaña con su botón `×`;
- abrir la paleta de comandos con el botón `+` de la derecha.

Cerrar una pestaña no detiene procesos, terminales ni servicios. Solo cierra la
vista.

## Barra lateral contextual

La barra lateral cambia según la vista activa:

| Vista | Contenido de la barra lateral |
| --- | --- |
| Projects | Lista filtrable, estado, proyecto seleccionado y acción de refresco. |
| PHP | Runtimes instalados con estado FPM. |
| Services | Servicios con estado y búsqueda. |
| Ports | Conflictos y accesos rápidos a puertos gestionados. |
| Databases | Motores y bases de datos. |
| Terminal | Sesiones abiertas, con opción de cerrar. |
| Logs | Fuentes de log disponibles. |
| Settings | Secciones de ajustes. |

Puedes ocultarla con `Ctrl+B` (`Cmd+B` en macOS) o desde **View → Hide
sidebar**.

## Barra de estado

La barra inferior muestra:

- **Motor:** online, idle (binario detectado pero API apagada) u offline.
- **Proyecto:** proyecto activo.
- **PHP:** versión fijada al proyecto activo.
- **Conflictos:** número de conflictos de puertos; abre Ports.
- **Servicios:** servicios en marcha sobre el total.
- **Tema:** nombre del tema actual; al pulsarlo cicla entre los cuatro temas.
- **Versión:** versión de VALET; abre Settings/About.

## Paleta de comandos

Abre la paleta con `Ctrl+K` (`Cmd+K` en macOS) o `Ctrl+Shift+P`
(`Cmd+Shift+P`). Escribe para filtrar, muévete con `↑`/`↓`, ejecuta con
`Enter` y cierra con `Esc`.

Comandos disponibles:

- abrir cada vista: Projects, PHP, Services, Ports, Databases, Terminal, Logs
  y Settings;
- **Add project folder…**;
- **New terminal in selected project**;
- **Refresh environment**;
- **Check engine status**;
- **Start engine**;
- **Run environment doctor**;
- **Use Min Dark / Min Light / Carbon Dark / Carbon Light theme**;
- **Toggle sidebar**;
- **Open settings**;
- **Open upstream engine documentation**.

## Atajos de teclado

En Linux y Windows se usa `Ctrl`; en macOS, `Cmd`.

| Atajo | Acción |
| --- | --- |
| `Ctrl+K` o `Ctrl+Shift+P` | Abrir la paleta de comandos |
| `Ctrl+1` | Projects |
| `Ctrl+2` | PHP |
| `Ctrl+3` | Services |
| `Ctrl+4` | Ports |
| `Ctrl+5` | Databases |
| `Ctrl+6` | Terminal |
| `Ctrl+7` | Logs & diagnostics |
| `Ctrl+,` | Settings |
| `Ctrl+B` | Mostrar u ocultar la barra lateral |
| `Ctrl` + tecla de acento grave | Nueva terminal en el proyecto seleccionado |
| `↑` / `↓` | Navegar por la paleta |
| `Enter` | Ejecutar el comando seleccionado |
| `Esc` | Cerrar la paleta |

Los atajos de vista se ignoran mientras escribes en un campo de texto. La
paleta se puede abrir incluso desde un campo de texto.

## Motor offline

Si el motor no responde:

- la ventana sigue abriendo;
- los temas y ajustes siguen funcionando;
- aparece un aviso con el estado y las instrucciones para arrancarlo;
- las vistas muestran datos vacíos o el último estado disponible;
- las acciones que necesitan API quedan deshabilitadas.

Puedes seguir usando `valet doctor`, `valet config`, `valet theme` y la
configuración local sin el motor.

## Siguiente paso

- [Proyectos](Projects.md)
- [PHP y servicios](PHP-and-Services.md)
- [Terminal y logs](Terminal-and-Logs.md)
