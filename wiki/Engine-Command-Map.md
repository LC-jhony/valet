# Mapa de comandos del motor

VALET no reimplementa el motor. Se comunica por dos vías:

1. **HTTP local** contra la API del motor (por defecto
   `http://127.0.0.1:7073`).
2. **`execFile`** contra un binario validado, con una allow-list de argumentos
   fijos.

Nunca se construye una cadena de shell. Las rutas de API deben empezar por
`/api/`; las peticiones que cambian estado envían `x-lerd-csrf: 1`.

## Allow-list de `EngineCommand`

| ID | Argumentos que recibe el motor | Uso principal |
| --- | --- | --- |
| `start` | `start` | `valet start`, botón Start engine. |
| `stop` | `stop` | `valet stop`. |
| `restart` | `restart` | `valet restart`. |
| `doctor` | `doctor` | `doctor --engine`, Run doctor. |
| `version` | `version` | Detección de versión. |
| `link` | `link` (cwd validado) | Registrar proyecto. |
| `unlink` | `unlink` | Desregistrar proyecto. |
| `use-php` | `use <major.minor>` | PHP global del motor. |
| `isolate-php` | `isolate <major.minor>` | Aislamiento de PHP en la allow-list. |
| `logs` | `logs [unit]` | Logs del motor. |
| `open` | `dashboard` | Abrir dashboard. |
| `service-start` | `service start <name>` | Arrancar servicio. |
| `service-stop` | `service stop <name>` | Parar servicio. |
| `service-restart` | `service restart <name>` | Reiniciar servicio. |
| `service-remove` | `service remove <name>` | Quitar servicio. |
| `remove-phpmyadmin` | `service remove phpmyadmin` | Retirar contenedor heredado. |

Validaciones:

- nombre de servicio: `[a-z0-9][a-z0-9._-]*`, máximo 64; phpMyAdmin rechazado;
- versión PHP: `^\d+\.\d+$`;
- unidad de log: `[a-z0-9][a-z0-9._-]*`;
- dominio: `[a-z0-9][a-z0-9._-]*`, máximo 253;
- `cwd`: ruta absoluta existente;
- binario: archivo ejecutable regular, ruta absoluta, nombre `lerd` o
  `valet-engine` (o `.exe`).

Cualquier otro ID o argumento produce `unsupported engine command` o
`invalid …`. No hay un comando “run anything”.

## API usada

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/api/version` | Detectar API y versión. |
| `GET` | `/api/status` | Estado de PHP/FPM. |
| `GET` | `/api/sites` | Listar proyectos. |
| `POST` | `/api/sites/{domain}/{action}` | `php`, `unlink`, `pause`, `unpause`, `secure`, `unsecure`, `restart`, `rebuild`, `service:*`. |
| `GET` | `/api/services` | Listar servicios. |
| `POST` | `/api/services/{name}/{start\|stop\|restart}` | Controlar servicio. |
| `POST` | `/api/services/{name}/ports` | Cambiar mapeos de puertos. |
| `POST` | `/api/services/{name}/remove?removeData=false` | Quitar servicio conservando datos. |
| `GET` | `/api/php-versions` | Runtimes instalados. |
| `GET` | `/api/php-installable` | Runtimes disponibles. |
| `GET` | `/api/php-versions/{version}/extensions` | Extensiones y módulos. |
| `POST` | `/api/php-versions/install?version={x.y}` | Construir runtime (SSE). |
| `GET` | `/api/databases` | Motores y bases. |
| `GET` | `/api/logs/{unit}` | Stream SSE de logs. |

Las acciones de sitio aceptan solo:

```text
php, unlink, pause, unpause, secure, unsecure, restart, rebuild,
service:add, service:remove, service:declare, service:dismiss
```

Parámetros permitidos:

- `php`: `version` o `branch`;
- `service:*`: `name` validado;
- cualquier otra clave se rechaza.

## Correspondencia de comandos de usuario

| Comando VALET | Motor |
| --- | --- |
| `valet projects` | `GET /api/sites` |
| `valet projects add <path>` | `lerd link` con cwd |
| `valet projects remove <domain>` | `POST /api/sites/{domain}/unlink` |
| `valet projects php <domain> <version>` | `POST /api/sites/{domain}/php` |
| `valet start` | `lerd start` |
| `valet stop` | `lerd stop` |
| `valet restart` | `lerd restart` |
| `valet status` | `/api/version` + listas |
| `valet doctor` | chequeos VALET + `lerd doctor` opcional |
| `valet services` | `GET /api/services` |
| `valet services start\|stop\|restart <name>` | `POST /api/services/{name}/{action}` |
| `valet services port <name> <port>` | `POST /api/services/{name}/ports` |
| `valet services remove <name>` | `POST /api/services/{name}/remove` |
| `valet php` | `GET /api/php-versions` |
| `valet php install <version>` | `POST /api/php-versions/install` |
| `valet php pin <domain> <version>` | `POST /api/sites/{domain}/php` |
| `valet php use <version>` | `lerd use <version>` |
| `valet ports` | API + escaneo de sockets |
| `valet ports check <port>` | bind local |
| `valet logs [unit]` | `GET /api/logs/{unit}` |
| `valet open [domain]` | `lerd dashboard` o URL del sitio |
| `valet config` | `~/.config/valet/desktop.json` |
| `valet theme <id>` | `desktop.json` |
| `valet migrate` | lógica local de VALET |
| `valet phpmyadmin remove` | `lerd service remove phpmyadmin` |

## Riesgo de las operaciones

La tabla interna de correspondencia clasifica el riesgo:

| Riesgo | Ejemplos |
| --- | --- |
| Bajo | listar, estado, doctor, puertos, logs, configuración, temas. |
| Medio | registrar/desregistrar, fijar PHP, arrancar/parar servicios, cambiar puertos, instalar PHP, migrar. |
| Alto | quitar un servicio, quitar phpMyAdmin. |

El riesgo no cambia la allow-list: una operación de riesgo alto sigue siendo una
operación concreta, validada y confirmada.

## Lo que no existe

- `exec`, `shell`, `run`, `eval`.
- Plugins o carga dinámica de código.
- Ejecución de una cadena arbitraria.
- Apertura de una ruta arbitraria desde el renderer.
- Un binario distinto de `lerd`/`valet-engine`.

## Por qué importa

El motor es un servicio local con acceso a contenedores, certificados y datos de
proyectos. La allow-list reduce la superficie de la interfaz a operaciones
conocidas y evita que un fallo del renderer se convierta en ejecución arbitraria.
No sustituye la seguridad del motor: mantén actualizado el upstream y revisa su
configuración de red.

## Siguiente paso

- [Seguridad](Security.md)
- [Referencia de la CLI](CLI-Reference.md)
- [Arquitectura](../docs/ARCHITECTURE.md)
