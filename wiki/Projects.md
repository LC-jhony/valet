# Proyectos

Un proyecto es una carpeta existente registrada en el motor. VALET **no copia
ni mueve** los archivos: pide al motor que sirva esa ruta y conserva el dominio,
el runtime PHP, los servicios y el estado de TLS que gestiona el motor.

## Listar proyectos

En la interfaz, abre **Projects**. La tabla muestra:

| Columna | Significado |
| --- | --- |
| Project | Nombre y dominio. |
| PHP | Versión fijada al proyecto. |
| Framework | Framework detectado por el motor o por la inspección local. |
| Status | Running, stopped, paused u otro estado informado. |
| Path | Ruta del proyecto. |

Puedes buscar por nombre, dominio, ruta o framework y filtrar por **All**,
**Running** o **Idle**.

En la CLI:

```bash
valet projects
valet projects --json
```

`--json` devuelve el array de proyectos tal como lo entrega el adaptador.

## Registrar un proyecto

### Interfaz

1. **Projects → Add project**.
2. Elige una carpeta existente en el diálogo nativo.
3. VALET pide al motor que la registre.
4. Si todo va bien, el proyecto queda seleccionado.

### CLI

```bash
valet projects add "$HOME/Code/acme"
```

Requisitos:

- la ruta debe ser **absoluta** y existir;
- debe ser un directorio;
- el motor debe estar disponible;
- los archivos no se mueven ni se copian.

Ejemplo de salida:

```text
Registered /home/tu-usuario/Code/acme. Project files were not moved.
```

## Inspeccionar un proyecto

Selecciona una fila o usa el selector **Project** de la barra superior. El panel
de detalle muestra:

- ruta, dominios, versión de Node, última actividad y número de peticiones;
- servicios adjuntos y sugeridos;
- runtime PHP, rango soportado por el framework y estado del worker de cola;
- inspección de `composer.json`: restricción PHP, framework detectado, Node,
  gestor de paquetes y Git;
- acciones de carpeta, sitio y terminal.

La inspección local no modifica el proyecto. Solo lee archivos de la carpeta.

## Abrir carpeta, sitio y terminal

Desde el detalle o desde la fila:

- **Folder:** abre la carpeta en el gestor de archivos del sistema.
- **Site:** abre `http://dominio` o `https://dominio` según TLS.
- **Terminal:** abre una sesión PTY en la carpeta del proyecto.

Equivalentes CLI:

```bash
valet projects open acme.test
```

La terminal se puede abrir también con `Ctrl` + la tecla de acento grave, o
desde **Terminal → New terminal**.

## Fijar PHP a un proyecto

Desde el detalle, usa el selector **Project version**. Solo se listan runtimes
instalados; los que quedan fuera del rango del framework o de `composer.json`
aparecen marcados y deshabilitados.

```bash
valet projects php acme.test 8.3
```

El cambio afecta solo a ese proyecto. El PHP del host y los demás proyectos no
se tocan. Si el motor informa un fallo al cambiar, el adaptador intenta
restaurar el pin anterior; si la restauración también falla, se informa
explícitamente.

También puedes usar el alias:

```bash
valet php pin acme.test 8.3
```

## Gestionar servicios del proyecto

La sección **Services** del detalle distingue:

- **attached**: servicios ya asociados al proyecto;
- **declared**: servicios registrados en `.lerd.yaml`;
- **detected in env**: servicios detectados en el entorno del proyecto;
- **suggested**: sugerencias del framework, por ejemplo un motor de base de
  datos a partir de `DB_CONNECTION`.

Acciones:

| Acción | Efecto | Confirmación |
| --- | --- | --- |
| **Add** | El motor puede instalar y arrancar el servicio y editar el entorno del proyecto. | Sí |
| **Detach** | Separa el servicio del proyecto; el contenedor y sus datos se conservan. | Sí |
| **Declare** | Registra el servicio en `.lerd.yaml` sin instalar nada. | No |
| **Dismiss** | Descarta la sugerencia; no cambia archivos del proyecto. | No |

CLI:

```bash
valet projects services acme.test
valet projects services acme.test --json

valet projects service add acme.test mysql --yes
valet projects service remove acme.test mysql --yes
valet projects service declare acme.test redis
valet projects service dismiss acme.test mysql
```

`projects services` es de solo lectura. `add` y `remove` piden confirmación en
una terminal interactiva y requieren `--yes` en un script no interactivo.

## Pausar, reanudar, reiniciar y TLS

En el detalle del proyecto:

- **Pause** detiene la ejecución del proyecto en el motor.
- **Resume** lo vuelve a activar.
- **Restart** reinicia el sitio.
- **Enable TLS** emite o activa el certificado del proyecto.
- **Remove TLS** desactiva TLS.

CLI:

```bash
valet projects pause acme.test
valet projects resume acme.test
valet projects restart acme.test
valet projects secure acme.test
valet projects unsecure acme.test
valet projects rebuild acme.test
```

`rebuild` está disponible en la CLI aunque no aparece como botón principal en
el detalle. La acción se delega al motor.

## Desregistrar un proyecto

En el detalle: **Unregister project**. En CLI:

```bash
valet projects remove acme.test
valet projects remove acme.test --yes
```

La operación elimina el sitio del registro del motor. **No borra**:

- los archivos del proyecto;
- las bases de datos;
- los volúmenes;
- los contenedores de servicios.

El adaptador pide confirmación. Si no hay TTY, debes pasar `--yes`.

## Proyectos y datos

| Dato | Dónde vive | ¿Lo borra VALET? |
| --- | --- | --- |
| Archivos del proyecto | Tu carpeta original | No |
| Registro del sitio | Motor (`sites.yaml` / estado del motor) | Solo al desregistrar |
| Bases de datos | Volúmenes del motor | No |
| Servicios | Contenedores del motor | No al desregistrar un proyecto |
| TLS | Certificados del motor | No al desregistrar |
| Configuración de VALET | `~/.config/valet` | No |

## Comandos relacionados

```bash
valet projects
valet projects add <ruta-absoluta>
valet projects remove <dominio> [--yes]
valet projects php <dominio> <version>
valet projects services <dominio> [--json]
valet projects service add|remove|declare|dismiss <dominio> <servicio> [--yes]
valet projects restart|pause|resume|secure|unsecure|rebuild <dominio>
valet projects open <dominio>
```

## Siguiente paso

- [PHP y servicios](PHP-and-Services.md)
- [Puertos y bases de datos](Ports-and-Databases.md)
- [Referencia de la CLI](CLI-Reference.md)
