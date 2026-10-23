# Inicio rápido

Esta guía recorre el circuito mínimo: detectar el motor, registrar un proyecto,
abrir el sitio, fijar PHP, revisar puertos y diagnosticar el entorno.

## 1. Comprueba el motor

```bash
valet status
valet doctor
```

`status` muestra el motor, proyectos, servicios, PHP y el estado de la copia de
adopción. `doctor` es de solo lectura y devuelve código de salida `1` si algún
chequeo falla.

Si la API está apagada pero el binario existe:

```bash
valet start
```

## 2. Registra un proyecto existente

La carpeta debe existir y la ruta debe ser absoluta. Los archivos **no se
mueven**.

```bash
valet projects add "$HOME/Code/acme"
valet projects
```

Ejemplo de salida:

```text
Domain       PHP  Framework  Status   Path
acme.test    8.2  Laravel    stopped  /home/tu-usuario/Code/acme
```

También puedes usar **Projects → Add project** en la interfaz y elegir la
carpeta con el diálogo nativo.

## 3. Abre el sitio

```bash
valet projects open acme.test
```

En la interfaz, selecciona el proyecto y pulsa **Site**. Abre la URL del
proyecto, normalmente `http://acme.test`.

## 4. Abre una terminal del proyecto

Desde la interfaz: selecciona el proyecto y pulsa **Terminal**, o usa `Ctrl` +
la tecla de acento grave en Linux/Windows (`Cmd` + la misma tecla en macOS).
También puedes usar **Terminal → New terminal**.

La terminal es un shell real en la carpeta del proyecto. Si el motor tiene
instalados sus shims, `php` y `composer` resuelven el runtime del proyecto.

```bash
pwd
php -v
```

## 5. Consulta y fija PHP

```bash
valet php
valet php install 8.3
valet projects php acme.test 8.3
```

`valet php install` construye un runtime con el motor y muestra su salida real.
`projects php` cambia solo ese proyecto; no reemplaza el PHP del host. Si el
cambio falla, el adaptador intenta restaurar el pin anterior.

La alternativa visual está en **PHP**: selecciona un proyecto y usa **Pin** en
la fila del runtime instalado.

## 6. Revisa servicios y puertos

```bash
valet projects services acme.test
valet services
valet ports
```

Si el proyecto sugiere un servicio, puedes añadirlo de forma explícita. La
operación puede instalar y arrancar el contenedor y editar el entorno del
proyecto:

```bash
valet projects service add acme.test mysql --yes
```

Sin `--yes`, la CLI pide confirmación si hay una terminal interactiva. En un
script no interactivo debes pasar `--yes` de forma consciente.

Comprueba un puerto antes de mover un servicio:

```bash
valet ports check 3306
valet services port mysql 3307
```

VALET no detiene procesos ajenos. Si el puerto está ocupado, la operación
falla y debes elegir otro puerto o liberar el proceso por tu cuenta.

## 7. Mira los logs

```bash
valet logs
valet logs lerd-nginx
```

El primer comando lista las fuentes disponibles. El segundo abre un stream SSE
hasta que pulses `Ctrl+C` (código de salida `130`).

En la interfaz, **Logs & diagnostics** tiene tres pestañas:

- **Container logs:** logs en vivo del motor, Nginx, PHP y servicios.
- **Engine output:** salida de comandos como el doctor.
- **Problems:** problemas detectados a partir del estado del entorno.

## 8. Revisa y adopta una instalación previa

Si vienes de una instalación existente de Lerd:

```bash
valet migrate detect
valet migrate status
valet migrate apply --yes
```

`apply` crea una copia con checksums y un manifiesto de adopción. No mueve
contenedores, volúmenes, proyectos ni bases de datos.

## 9. Flujo diario

```bash
valet status                  # ¿está todo en marcha?
valet projects                # sitios registrados
valet projects open acme.test # abrir el sitio
valet logs lerd-nginx         # ver tráfico y errores
valet doctor                  # diagnóstico cuando algo falla
```

En la interfaz, el flujo equivalente es: barra de estado → **Projects** →
seleccionar proyecto → **Site** / **Terminal** → **Logs & diagnostics**.

## Siguiente paso

- [Proyectos](Projects.md) para el detalle de cada acción.
- [Referencia de la CLI](CLI-Reference.md) para todos los comandos y flags.
- [Solución de problemas](Troubleshooting.md) si algo no arranca.
