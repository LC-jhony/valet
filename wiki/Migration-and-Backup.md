# Migración y copias

## Qué significa “adoptar”

VALET puede convivir con una instalación existente del motor Lerd sin moverla.
La adopción:

- detecta configuración y sitios heredados en rutas fijas;
- crea una copia verificada de esa configuración bajo el directorio de VALET;
- registra un manifiesto con hashes y metadatos;
- deja que el motor siga usando sus propios directorios, contenedores y
  volúmenes.

No es una migración de datos. No copia proyectos, bases de datos, imágenes,
contenedores ni certificados. Tampoco cambia el binario ni el `HOME` del motor.

## Rutas heredadas

La detección mira:

```text
~/.config/lerd/config.yaml
~/.local/share/lerd/sites.yaml
~/.config/lerd/themes/
```

El binario se busca para mostrarlo, pero **tener solo un binario no activa la
adopción**. Debe existir configuración o sitios.

## Comandos

### Detectar

```bash
valet migrate detect
valet migrate detect --json
```

Muestra:

- si se detectó una instalación previa;
- directorio de configuración y datos;
- binario encontrado;
- número de sitios;
- advertencias.

Ejemplo:

```text
A previous engine installation was detected.
Config /home/tu-usuario/.config/lerd · 3 site(s)
Data   /home/tu-usuario/.local/share/lerd
Binary /home/tu-usuario/.local/bin/lerd
```

### Estado

```bash
valet migrate status
valet migrate status --json
```

Si ya hay manifiesto, muestra:

- directorio de la copia;
- fecha de creación y antigüedad;
- modo (`in-place`);
- sitios;
- archivos y bytes;
- si se detecta una instalación.

Si no hay manifiesto, indica que aún no se ha adoptado.

### Aplicar

```bash
valet migrate apply
valet migrate apply --yes
```

El flujo:

1. Detecta la instalación heredada.
2. Muestra las rutas que se van a copiar.
3. Pide confirmación.
4. Crea un directorio de copia con timestamp.
5. Copia `config.yaml`, `sites.yaml` y `themes/`.
6. Verifica `config.yaml` y `sites.yaml` con SHA-256.
7. Escribe `adoption.json` de forma atómica.
8. Informa de la ruta de la copia.

`themes/` se copia de forma recursiva; el manifiesto no guarda un checksum
individual de cada archivo de tema.

Si no hay nada que adoptar:

```text
Nothing to adopt. The engine is already the source of truth.
```

Si ya existe una adopción con los mismos hashes:

```text
Already adopted. Existing backup: /home/.../backups/...
```

Si los archivos de origen cambiaron, puede crear una copia nueva.

`apply` no admite `--json`. En un shell no interactivo, sin `--yes`, termina con
código `2`.

## Dónde se guarda la copia

```text
~/.config/valet/backups/<timestamp>/
├── config.yaml
├── sites.yaml
└── themes/              # si existía
```

El manifiesto está en:

```text
~/.config/valet/adoption.json
```

El directorio de copia se crea con permisos `0700`. El manifiesto incluye los
hashes de origen de `config.yaml` y `sites.yaml`, el número de sitios, archivos,
bytes, binario y advertencias.

## Qué no se mueve

| Elemento | ¿Se copia? | ¿Se mueve? |
| --- | --- | --- |
| `config.yaml` | Sí | No |
| `sites.yaml` | Sí | No |
| Temas heredados | Sí, si existen | No |
| Proyectos | No | No |
| Bases de datos | No | No |
| Volúmenes | No | No |
| Contenedores | No | No |
| Certificados | No | No |
| Binario del motor | No | No |

El motor sigue funcionando con su instalación original. La copia sirve para
inspección, auditoría y recuperación manual.

## Desde la interfaz

En **Settings → Adoption & backup**:

- ves si se detectó una instalación;
- ves config, data, binario y número de proyectos;
- ves el manifiesto existente, la copia, la fecha, el modo, los archivos y el
  tamaño;
- puedes crear la copia verificada;
- ves una tabla de origen, destino, archivos y tamaño.

La interfaz pide confirmación antes de crear la copia.

## Verificar una copia

Puedes comparar hashes manualmente:

```bash
sha256sum ~/.local/share/lerd/sites.yaml
sha256sum ~/.config/valet/backups/<timestamp>/sites.yaml
```

Los hashes del manifiesto están en `adoption.json`:

```bash
cat ~/.config/valet/adoption.json
```

Si los hashes no coinciden, no uses esa copia para una restauración: vuelve a
ejecutar `valet migrate apply` después de revisar el estado de origen.

## Recuperación

VALET **no** restaura automáticamente una copia sobre el motor. La copia es un
respaldo de configuración, no un mecanismo de rollback de datos.

Para una recuperación real:

1. Detén el motor.
2. Haz una copia de seguridad del estado actual.
3. Restaura `config.yaml`/`sites.yaml` en las rutas del motor solo si entiendes
   el formato y el impacto.
4. Arranca el motor.
5. Verifica con `valet doctor`, `valet projects` y los logs.

Si no estás seguro, conserva la copia y pide ayuda antes de sobrescribir nada.

## Mensajes habituales

| Mensaje | Qué significa |
| --- | --- |
| `No previous engine installation detected.` | No existen `config.yaml` ni `sites.yaml` heredados. |
| `A previous engine installation was detected.` | Hay configuración o sitios que se pueden copiar. |
| `sites.yaml exists but no project entries were parsed` | El archivo existe, pero no se pudieron contar sitios; revisa el formato. |
| `Nothing to adopt. The engine is already the source of truth.` | No hay nada que copiar. |
| `Already adopted.` | Los hashes coinciden con una copia existente. |
| `backup verification failed for …` | La copia no coincide con el origen; se aborta. |
| `Confirmation required. Re-run with --yes` | No hay TTY y faltó `--yes`. |

## Permisos y errores

- Si no puedes leer `~/.config/lerd` o `~/.local/share/lerd`, ejecuta el
  diagnóstico con tu usuario normal y revisa permisos.
- Si no puedes escribir en `~/.config/valet`, revisa el propietario y los
  permisos; `doctor` avisa de directorios accesibles por otros usuarios.
- No ejecutes `migrate apply` con `sudo` salvo que sepas que las rutas y los
  propietarios son los correctos; podrías crear archivos propiedad de root.

## Comandos relacionados

```bash
valet migrate detect [--json]
valet migrate status [--json]
valet migrate apply [--yes]
valet doctor
valet config path
```

## Siguiente paso

- [Configuración y datos](Configuration-and-Data.md)
- [Seguridad](Security.md)
- [Solución de problemas](Troubleshooting.md)
