# Puertos y bases de datos

## Puertos

VALET muestra dos tipos de puertos:

- **del host:** sockets que ya están escuchando en la máquina;
- **gestionados:** mapeos declarados por los servicios del motor.

Nunca termina procesos externos. Si un puerto está ocupado, solo puede cambiar
el mapeo de un servicio gestionado o pedirte que elijas otro.

### Vista Ports

La cabecera resume:

- total de entradas;
- puertos escuchando;
- puertos configurados;
- conflictos.

La tabla muestra puerto del host, puerto interno del contenedor, dirección,
protocolo, propietario, proyecto, proceso y estado. Puedes buscar por cualquiera
de esos campos y filtrar por **All**, **Listening**, **Configured** o
**Conflicts**.

Estados:

| Estado | Significado |
| --- | --- |
| `listening` | Hay un socket escuchando. |
| `configured` | El motor declara el mapeo, pero no se observa escucha. |
| `conflict` | El puerto está ocupado por otro proceso o choca con otro mapeo. |

### Comprobar un puerto

La tarjeta **Check a port** hace un bind real sin privilegios:

- puerto entre 1 y 65535;
- dirección por defecto `127.0.0.1`;
- no detiene ni signaliza ningún proceso.

CLI:

```bash
valet ports check 3000
valet ports check 3000 --address 127.0.0.1
valet ports check 3000 --json
```

Si el puerto no está disponible, el código de salida es `1`.

### Listar puertos

```bash
valet ports
valet ports --json
```

Si el motor está offline, la CLI muestra solo los listeners del host. Si está
online, mezcla listeners, servicios y proyectos, y marca conflictos.

### Cambiar un puerto gestionado

Desde la tabla, **Change port** solo aparece para mapeos que pertenecen a un
servicio conocido. El formulario:

- conserva el puerto interno del contenedor;
- comprueba disponibilidad en `127.0.0.1`;
- puede sugerir el siguiente puerto libre entre los próximos 64 números;
- aplica el cambio a través del motor.

CLI equivalente:

```bash
valet services port mysql 3307
valet services port mailpit 11025 --container 1025
```

Detalles importantes:

- el puerto posicional es el **host**;
- `--container` identifica el puerto interno en un mapeo secundario;
- se preservan los demás mapeos y `extra_ports`;
- si el motor rechaza el guardado, restaura su snapshot anterior;
- VALET no ofrece la opción de “forzar” o matar el proceso ocupante.

### Direcciones

El valor por defecto es `127.0.0.1`. Las funciones LAN del motor pueden usar
`0.0.0.0`; el motor las muestra por separado. VALET no publica puertos en la red
por su cuenta.

## Bases de datos

La vista **Databases** es de solo lectura. Muestra:

- motores reportados por el motor, con estado, número de bases, puerto y versión;
- bases de datos con motor, proyecto asociado, tamaño y estado;
- notas sobre conexiones, backups y phpMyAdmin.

No hay panel de administración incluido. Las credenciales se leen del `.env`
del proyecto. El motor mantiene estable el host y el puerto de la base cuando un
servicio se mueve.

### Listar bases de datos

```bash
valet databases
valet databases --json
```

`--json` devuelve la estructura de motores y bases que entrega el adaptador. Si
no hay motores, el comando lo indica y no modifica nada.

### Operaciones que no hace VALET

VALET **no**:

- crea ni elimina bases de datos;
- ejecuta SQL;
- exporta o restaura volcados;
- copia o reescribe volúmenes;
- elimina datos al quitar un servicio.

Esas operaciones pertenecen al motor o a tus herramientas habituales. Para
administrar bases de datos, usa el cliente que prefieras y las credenciales del
`.env` del proyecto.

### phpMyAdmin

phpMyAdmin está retirado de la superficie activa. No aparece en Services, Ports
ni Databases. Si existe un contenedor heredado, la vista Databases y
`valet doctor` lo detectan. Puedes eliminarlo explícitamente:

```bash
valet phpmyadmin status
valet phpmyadmin remove --yes
```

La eliminación no toca bases de datos, volúmenes ni proyectos.

## Flujo recomendado ante un conflicto

1. Abre **Ports** y localiza el estado `conflict`.
2. Identifica si el puerto pertenece a un servicio gestionado o a un proceso
   externo.
3. Si es gestionado, usa **Change port** o `valet services port`.
4. Si es externo, decide tú si debes pararlo; VALET no lo hará.
5. Vuelve a comprobar con `valet ports check <puerto>`.
6. Arranca el servicio y revisa sus logs.

## Comandos relacionados

```bash
valet ports [--json]
valet ports check <puerto> [--address <ip>] [--json]
valet services port <servicio> <puerto-host> [--container <puerto-contenedor>]
valet databases [--json]
valet phpmyadmin [status|remove] [--yes]
```

## Siguiente paso

- [Terminal y logs](Terminal-and-Logs.md)
- [Ajustes y temas](Settings-and-Themes.md)
- [Solución de problemas](Troubleshooting.md)
