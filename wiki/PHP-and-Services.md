# PHP y servicios

## PHP

VALET no reemplaza el PHP del sistema. Los runtimes pertenecen al motor y se
asignan por proyecto. La CLI y Composer usan los shims del motor cuando están
instalados.

### Ver runtimes

```bash
valet php
```

La tabla muestra:

| Columna | Significado |
| --- | --- |
| PHP | Versión, por ejemplo `8.3`. |
| State | `default`, `installed` o `available`. |
| Runtime | FPM running, FPM stopped, unknown o not installed. |
| Projects | Número de proyectos que usan esa versión. |

En la interfaz, **PHP → Installed** muestra los runtimes instalados, su estado
FPM, los puertos y acciones. **Available** muestra lo que el motor puede
construir.

### Instalar un runtime

```bash
valet php install 8.3
```

El comando pide al motor que construya la imagen y muestra la salida real del
proceso. Requiere la API del motor en línea. No descarga ni ejecuta binarios
desde VALET.

En la interfaz, usa **Install** en la fila de la versión disponible. El estado
se actualiza al terminar.

### Fijar PHP a un proyecto

```bash
valet projects php acme.test 8.3
# alias
valet php pin acme.test 8.3
```

Solo cambia el proyecto indicado. Si el motor rechaza el cambio, el adaptador
intenta restaurar el pin anterior. El PHP del host no se modifica.

En **Projects → detalle → PHP runtime** puedes elegir la versión. Las versiones
fuera del rango del framework o de `composer.json` aparecen marcadas.

### Cambiar el PHP global del motor

```bash
valet php use 8.3
```

Pide confirmación porque cambia el valor por defecto del motor para los
proyectos que no tengan un pin explícito. No cambia el PHP del host.

En la interfaz: **PHP → Global default**.

### Ver extensiones y módulos

```bash
valet php extensions 8.3
valet php extensions 8.3 --json
```

El informe incluye:

- si la imagen está construida;
- si conviene reconstruirla;
- módulos cargados (`php -m`);
- extensiones declaradas, presentes y no disponibles para esa versión;
- paquetes del sistema declarados y presentes.

En la interfaz, el botón de extensiones abre el detalle del runtime.

### Superficies de ejecución

| Superficie | Qué ejecuta | Aislamiento |
| --- | --- | --- |
| PHP-FPM | Peticiones web a través del vhost del proyecto. | Contenedor y pin por proyecto. |
| PHP CLI | Comandos dentro de la terminal del proyecto. | Shim del motor primero en `PATH`; el binario del host no se reemplaza. |
| Composer | Dependencias del proyecto. | Solo archivos del proyecto; no muta Composer global ni PHP del host. |

### Solución rápida de PHP

- **No aparece una versión instalada:** actualiza la vista; comprueba que el
  motor la reporta en `/api/php-versions`.
- **El pin falla:** verifica que la versión exista, que el proyecto exista y que
  el motor esté online.
- **El proyecto no arranca:** revisa el rango del framework, `composer.json`,
  logs de FPM y `valet doctor`.
- **La terminal usa otra versión:** comprueba que exista
  `~/.local/share/lerd/bin` y que la sesión se abrió después de fijar el pin.

## Servicios

Los servicios son contenedores gestionados por el motor: motores de base de
datos, Redis, Mailpit u otros. VALET muestra y controla lo que el motor reporta;
no implementa contenedores propios.

### Ver servicios

```bash
valet services
valet services --json
```

La tabla muestra servicio, estado, versión, puerto del host y número de sitios
que lo usan. Si el motor informa conflictos de puertos, aparecen junto al
estado.

**phpMyAdmin está retirado**: se filtra de las listas y no se puede arrancar,
parar, mover ni quitar desde `valet services`. Para un contenedor heredado existe
el espacio `valet phpmyadmin`.

En la interfaz, **Services** permite buscar y filtrar por **All**, **Running** y
**Stopped**.

### Arrancar, parar y reiniciar

```bash
valet services start mysql
valet services stop mysql
valet services restart mysql
```

Antes de arrancar un servicio inactivo, la CLI comprueba:

1. que el motor no reporte puertos requeridos ocupados;
2. que el puerto principal configurado se pueda enlazar.

Si el puerto está ocupado, la operación se rechaza. VALET **no detiene** el
proceso que lo ocupa.

En la interfaz, los botones de la fila y del detalle permiten **Start**,
**Stop**, **Restart**, **Logs**, **Change port** y **Manage all ports**.

### Cambiar el puerto de un servicio

```bash
valet services port mysql 3307
valet services port mailpit 11025 --container 1025
```

- Sin `--container`, se mueve el puerto principal del host; el puerto del
  contenedor no cambia.
- Con `--container`, se mueve un mapeo secundario: el puerto indicado por
  `--container` es el del contenedor y el posicional es el nuevo puerto del
  host.
- El comando comprueba que el nuevo puerto esté libre.
- Se preservan `extra_ports` y los demás mapeos; solo se cambia el mapeo
  solicitado.
- Si el motor rechaza el guardado, su propia instantánea restaura los mapeos
  anteriores.

En la interfaz, **Change port** abre un formulario con comprobación de
disponibilidad y sugerencia de puerto.

### Ver logs de un servicio

```bash
valet services logs mysql
```

Equivale a abrir el stream `lerd-mysql` con `valet logs`. En la interfaz, el
botón de logs selecciona `lerd-<servicio>` en **Logs & diagnostics**.

### Quitar un servicio

```bash
valet services remove mysql
valet services remove mysql --yes
```

La operación pide confirmación y envía `removeData=false`. El contenedor se
elimina, pero **los volúmenes con nombres y las bases de datos no se borran**
por VALET. Revisa la documentación del motor si necesitas eliminar datos
explícitamente.

La interfaz no expone un botón de borrado de servicios; usa la CLI o las
herramientas del motor.

### Añadir un servicio a un proyecto

La forma segura es desde el proyecto, porque el motor decide qué instalar y
cómo cablearlo:

```bash
valet projects services acme.test
valet projects service add acme.test mysql --yes
```

Esto puede instalar y arrancar el contenedor y editar el entorno del proyecto.
Revisa el diff de `.env` o de `.lerd.yaml` si tu proyecto está versionado.

### phpMyAdmin heredado

```bash
valet phpmyadmin status
valet phpmyadmin remove --yes
```

`status` solo comprueba la presencia del contenedor heredado. `remove` pide
confirmación, ejecuta la operación del motor y no toca bases de datos,
volúmenes ni proyectos. VALET no ofrece panel de administración de bases de
datos.

## Comandos relacionados

```bash
valet php
valet php install <version>
valet php extensions <version> [--json]
valet php pin <dominio> <version>
valet php use <version> [--yes]

valet services [--json]
valet services start|stop|restart <nombre>
valet services port <nombre> <puerto-host> [--container <puerto-contenedor>]
valet services logs <nombre>
valet services remove <nombre> [--yes]

valet projects services <dominio> [--json]
valet projects service add|remove|declare|dismiss <dominio> <servicio> [--yes]

valet phpmyadmin [status|remove] [--yes]
```

## Siguiente paso

- [Puertos y bases de datos](Ports-and-Databases.md)
- [Terminal y logs](Terminal-and-Logs.md)
- [Referencia de la CLI](CLI-Reference.md)
