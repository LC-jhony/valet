# PROMPT MAESTRO DEFINITIVO — VALET DESKTOP

## Aplicación desktop minimalista inspirada en VS Code, con temas Min Dark y Min Light

### 1. Objetivo general

Actúa como un arquitecto de software senior, ingeniero de aplicaciones desktop, especialista en UX/UI, DevOps, PHP, contenedores, redes y herramientas para desarrolladores.

Analiza el repositorio original:

https://github.com/lerd-env/lerd.git

Tu misión es transformar el proyecto en una aplicación de escritorio profesional llamada **VALET**, con identidad propia, diseño minimalista inspirado en Visual Studio Code y administración integrada de entornos de desarrollo local.

La aplicación debe ofrecer una experiencia desktop real y funcional, no simplemente una página web dentro de una ventana.

Debe permitir administrar proyectos, múltiples versiones de PHP, servicios, puertos, terminales, configuraciones y logs desde una interfaz unificada.

Además, debes retirar phpMyAdmin de las funcionalidades activas y garantizar que la configuración de red pueda adaptarse al entorno del usuario.

### Regla principal de identidad

**VALET será el nombre oficial de la aplicación, su interfaz, sus comandos, su documentación y todos los componentes que se renombren como parte de esta transformación.**

No debe seguir apareciendo Lerd como nombre de producto en la experiencia final, salvo cuando sea necesario mencionar el repositorio de origen, la procedencia del código, las licencias, las referencias históricas o una compatibilidad técnica que todavía no pueda eliminarse de forma segura.

No realices un reemplazo indiscriminado de texto. Analiza qué referencias son nombres visibles, identificadores técnicos, rutas, variables, servicios, comandos, imágenes, paquetes o datos persistidos, y adapta cada categoría de manera controlada.

---

## 2. Renombrado completo: de Lerd a VALET

Inspecciona todo el repositorio y localiza las referencias al nombre original.

Revisa, como mínimo:

- Nombre de la aplicación.
- Título de las ventanas.
- Logotipo e iconos.
- Menús y pantallas.
- Nombres de paquetes y artefactos de compilación.
- Identificadores de aplicación.
- Comandos CLI.
- Subcomandos y opciones.
- Scripts de instalación.
- Scripts de inicio y detención.
- Servicios y procesos administrados.
- Variables de entorno.
- Archivos de configuración.
- Rutas de configuración y datos.
- Directorios temporales.
- Archivos de registro.
- Integraciones con terminales y editores.
- Documentación.
- Ejemplos de configuración.
- Mensajes de error.
- Pruebas.
- Flujos de actualización.
- Instaladores y desinstaladores.
- Referencias en la interfaz de usuario.

### Reglas para el renombrado

1. Utiliza VALET como nombre visible del producto.
2. Utiliza `valet` como nombre base para los nuevos comandos y recursos que puedan renombrarse de forma segura.
3. Adapta los comandos existentes de Lerd a una interfaz coherente de VALET.
4. Actualiza las referencias internas necesarias para que los nuevos comandos funcionen realmente.
5. No cambies nombres de funciones, clases, módulos o símbolos de terceros que deban conservarse.
6. No modifiques identificadores públicos o formatos persistidos sin analizar primero sus dependencias.
7. No cambies la procedencia del repositorio, autores ni avisos de licencia.
8. No elimines mecanismos de compatibilidad antes de comprobar que ya no se necesitan.
9. No afirmes que el renombrado está completo hasta verificarlo mediante búsquedas y pruebas.

### Compatibilidad con instalaciones anteriores

Si una instalación existente utiliza directorios, configuraciones, contenedores o servicios identificados con el nombre original, implementa una estrategia de transición.

La migración debe:

- Detectar las configuraciones existentes.
- Conservar proyectos y datos.
- Reutilizar servicios cuando sea seguro.
- Migrar configuraciones con respaldo y validación.
- Evitar duplicar entornos innecesariamente.
- No eliminar directorios o volúmenes automáticamente.
- Ofrecer mensajes claros cuando una migración manual sea necesaria.

Durante la transición, VALET puede reconocer configuraciones antiguas de forma interna, pero debe presentar VALET como producto principal.

---

## 3. Comandos oficiales de VALET

Diseña una interfaz de comandos coherente, fácil de aprender y documentada.

Ejemplos de la experiencia deseada:

```bash
valet --help
valet --version
valet doctor
valet projects
valet services
valet services start
valet services stop
valet php list
valet php use 8.3
valet ports
valet config
valet logs
```

Estos comandos son ejemplos del diseño objetivo, no una afirmación de que ya existan ni una obligación de copiar exactamente la estructura anterior.

Primero inspecciona los comandos que ofrece el proyecto original. Define una tabla de correspondencia entre cada comando existente y su equivalente propuesto en VALET.

### Requisitos de CLI

- Usar `valet` como comando principal cuando la plataforma y el empaquetado lo permitan.
- Mantener convenciones uniformes para subcomandos y opciones.
- Mostrar ayuda clara.
- Validar argumentos.
- Devolver códigos de salida correctos.
- Mostrar errores útiles.
- Evitar salida interactiva cuando se utilice en scripts, siempre que corresponda.
- Ofrecer una salida estructurada, como JSON, cuando resulte útil.
- Documentar cada comando.
- Integrar la CLI con la misma lógica de negocio utilizada por la aplicación desktop.

No crees comandos que solo impriman resultados simulados.

### Instalación del comando

Asegura que el comando `valet` pueda instalarse y ejecutarse según las plataformas soportadas.

Si se necesita un enlace simbólico, un directorio de ejecutables o una modificación del `PATH`, documenta el procedimiento y solicita permisos cuando corresponda.

No sobrescribas ejecutables ni comandos ajenos que ya existan en el sistema.

Si `valet` ya está ocupado por otro programa en el sistema, detecta el conflicto y ofrece una alternativa segura de instalación sin cambiar silenciosamente el nombre oficial del producto.

---

## 4. Identidad visual y temas obligatorios

Utiliza los dos temas adjuntos al proyecto:

- `min-dark.json`
- `min-light.json`

Deben ser la fuente de verdad del diseño visual.

No inventes una paleta diferente ni reemplaces los colores por los predeterminados de una librería.

### Min Dark

Respeta los valores del archivo original, entre ellos:

- Fondo del editor: `#1f1f1f`.
- Barra lateral y barra superior: `#1A1A1A`.
- Fondo de entradas: `#2A2A2A`.
- Texto de entrada: `#E0E0E0`.
- Texto general: `#888888`.
- Texto activo: `#FAFAFA`.
- Violeta: `#b392f0`.
- Azul: `#79b8ff`.
- Rojo coral: `#FF7A84`.
- Naranja: `#ffab70`.

### Min Light

Respeta los valores del archivo original, entre ellos:

- Fondo del editor: `#ffffff`.
- Barra lateral y barra superior: `#f6f6f6`.
- Texto principal: `#212121`.
- Texto secundario: `#757575`.
- Azul: `#1976D2`.
- Rojo: `#D32F2F`.
- Violeta: `#6f42c1`.
- Verde: `#22863a`.
- Naranja: `#FF9800`.

Los valores anteriores son referencias. Utiliza los JSON completos para implementar las propiedades restantes.

### Sistema de temas

Implementa:

- Cambio instantáneo entre temas.
- Persistencia de la selección.
- Tokens semánticos centralizados.
- Estados de hover, focus, selección, error y deshabilitado.
- Aplicación coherente a todas las pantallas.
- Compatibilidad con terminales, logs y editores de código.
- Adaptación documentada de las propiedades de los JSON a la tecnología seleccionada.

Evita los colores hardcodeados dispersos por los componentes.

---

## 5. Diseño desktop minimalista inspirado en VS Code

La aplicación VALET debe utilizar una estructura compacta y familiar para desarrolladores, sin copiar la marca ni los recursos propietarios de VS Code.

### Estructura principal

**Barra superior**

- Identidad VALET.
- Menús.
- Selector de proyecto.
- Acciones contextuales.
- Indicadores de estado.

**Activity Bar**

- Proyectos.
- PHP.
- Servicios.
- Puertos.
- Bases de datos.
- Terminal.
- Logs y diagnóstico.
- Configuración.

**Sidebar**

Contenido contextual, búsqueda, listas de proyectos y acciones relevantes.

**Área de trabajo**

Pestañas para abrir vistas de proyectos, runtimes, puertos, servicios, configuración y diagnóstico.

**Panel inferior**

Terminales, logs, salida de procesos y errores.

**Barra de estado**

Proyecto activo, versión de PHP, servicios y puertos relevantes.

### Estilo

- Minimalista y compacto.
- Fondos definidos por Min Dark y Min Light.
- Separadores discretos.
- Tipografía legible.
- Iconografía uniforme.
- Sin gradientes decorativos.
- Sin tarjetas gigantes.
- Sin sombras innecesarias.
- Sin animaciones que distraigan.
- Sin botones puramente decorativos.

Cada control debe tener una función real.

---

## 6. Arquitectura de la aplicación desktop

Inspecciona primero la tecnología actual y decide si conviene Tauri, Electron o una alternativa compatible.

Documenta la decisión en función de:

- Integración con procesos locales.
- Reutilización de la lógica existente.
- Compatibilidad multiplataforma.
- Consumo de recursos.
- Seguridad.
- Instalación y actualizaciones.

Separa la interfaz gráfica, la lógica de negocio, la gestión de procesos y la persistencia de configuraciones.

Si existen CLI, TUI, API o servicios internos, reutilízalos cuando sea viable. Evita implementar dos veces la misma lógica.

La interfaz no debe ejecutar comandos arbitrarios directamente. Las operaciones deben pasar por un backend validado y seguro.

---

## 7. Administración de proyectos

VALET debe permitir:

- Registrar proyectos existentes.
- Consultar proyectos recientes.
- Detectar frameworks cuando sea posible.
- Mostrar rutas y estados.
- Asignar versiones de PHP.
- Configurar puertos.
- Administrar servicios asociados.
- Abrir terminales en el directorio correcto.
- Consultar logs y errores.
- Iniciar, detener y reiniciar los entornos soportados.

Distingue correctamente entre proyecto, proceso, servicio, contenedor y runtime.

No muevas ni elimines archivos de proyectos sin autorización explícita.

---

## 8. Múltiples versiones de PHP

Permite seleccionar y administrar versiones de PHP por proyecto, según la disponibilidad real y la compatibilidad de las dependencias.

La aplicación debe distinguir:

- PHP CLI.
- PHP-FPM u otro runtime web.
- Composer.
- Comandos del framework.
- Workers y tareas en segundo plano.

Cada proyecto debe utilizar la versión que tiene asignada sin afectar innecesariamente a los demás.

Incluye:

- Lista de versiones instaladas.
- Estado de cada runtime.
- Extensiones disponibles.
- Compatibilidad con `composer.json`.
- Advertencias antes de cambiar versiones.
- Detección de runtimes no disponibles.
- Recuperación de la configuración anterior cuando un cambio falla.

No cambies automáticamente el PHP global del sistema.

No muestres versiones como instaladas hasta verificar su disponibilidad real.

---

## 9. Configuración de puertos

Implementa un administrador de puertos del host.

Debe distinguir:

- Puerto del host.
- Puerto interno.
- Dirección de escucha.
- Protocolo.
- Servicio asociado.
- Proyecto.
- Estado y conflictos.

Incluye:

- Configuración manual.
- Sugerencia de puertos disponibles.
- Detección de conflictos.
- Persistencia.
- Revalidación antes del arranque.
- Gestión segura de errores.

Utiliza `127.0.0.1` como dirección predeterminada cuando sea compatible con el servicio y la arquitectura.

No detengas procesos externos ni modifiques el firewall sin autorización.

Cambiar el puerto no elimina todos los posibles conflictos de red: revisa también direcciones de escucha, redes de contenedores y rangos de puertos.

---

## 10. Retirar phpMyAdmin

Elimina phpMyAdmin de las funcionalidades activas de VALET.

Revisa:

- Servicios.
- Instaladores.
- Imágenes y contenedores dedicados.
- Variables de entorno.
- Configuraciones.
- Menús y enlaces.
- Documentación.
- Pruebas específicas.
- Scripts y comandos de instalación.

No elimines los motores de base de datos ni sus volúmenes.

No borres datos existentes.

Si hay una instalación previa de phpMyAdmin, identifica su presencia y documenta el procedimiento seguro de retirada.

No sustituyas phpMyAdmin por otro administrador de bases de datos sin autorización.

---

## 11. Terminal, servicios y logs

Integra una terminal con múltiples sesiones, directorio de trabajo por proyecto y selección correcta del runtime.

Permite iniciar, detener y reiniciar servicios reales, consultar sus logs y visualizar errores.

Distingue entre un proceso activo y un servicio saludable.

No ejecutes comandos con privilegios elevados automáticamente ni registres secretos en los logs.

Los nombres visibles, títulos, mensajes, configuraciones nuevas y comandos deben utilizar la identidad VALET.

Si se conserva algún identificador técnico antiguo por compatibilidad, debe estar justificado y documentado.

---

## 12. Seguridad y migraciones

Antes de renombrar rutas, servicios, directorios, paquetes o configuraciones:

1. Identifica los consumidores y dependencias.
2. Define la correspondencia entre los nombres antiguos y los nuevos.
3. Crea respaldos cuando sea necesario.
4. Valida los datos existentes.
5. Migra de forma idempotente.
6. Conserva proyectos y volúmenes.
7. Evita crear instancias duplicadas.
8. Ofrece recuperación si la migración falla.

No realices operaciones destructivas sin autorización.

Mantén las licencias, avisos de autoría y atribuciones originales.

---

## 13. Plan de trabajo

### Fase 1 — Auditoría

Inspecciona el repositorio original y entrega:

- Arquitectura actual.
- Inventario de funcionalidades.
- Referencias al nombre original.
- CLI y comandos existentes.
- Servicios y procesos.
- Rutas y configuraciones.
- Gestión de PHP.
- Gestión de puertos.
- Temas adjuntos.
- Pruebas disponibles.
- Riesgos de compatibilidad.

### Fase 2 — Plan de renombrado

Genera una tabla con:

| Elemento original | Nuevo nombre o estrategia | Riesgo | Validación |
|---|---|---|---|
| Nombre visible | VALET | Bajo | Revisar interfaz |
| Comando CLI | `valet` | Medio | Ejecutar comandos |
| Configuración existente | Migración compatible | Alto | Probar actualización |
| Servicio o contenedor | Renombrar si es seguro | Alto | Validar dependencias |
| Rutas y datos | Migrar solo cuando proceda | Alto | Verificar conservación |
| Documentación | VALET | Bajo | Buscar referencias residuales |

Completa esta tabla usando datos reales del repositorio.

### Fase 3 — Diseño e implementación

Implementa en orden:

1. Identidad VALET.
2. Sistema de temas Min Dark y Min Light.
3. Estructura desktop.
4. Navegación y componentes.
5. Integración de proyectos.
6. Gestión de versiones PHP.
7. Gestión de puertos.
8. Terminal, servicios y logs.
9. Retirada de phpMyAdmin.
10. CLI y empaquetado.

### Fase 4 — Pruebas

Verifica:

- Ejecución de la aplicación desktop.
- Comandos de VALET.
- Migración desde configuraciones anteriores.
- Conservación de proyectos y datos.
- Cambio de temas.
- Selección de PHP por proyecto.
- Detección de conflictos de puertos.
- Inicio y detención de servicios.
- Ausencia de instalaciones activas de phpMyAdmin.
- Funcionamiento del instalador.

### Fase 5 — Documentación

Actualiza los manuales, ejemplos, comandos y guías de instalación para utilizar VALET.

Documenta también las compatibilidades y las referencias antiguas que deban conservarse temporalmente.

---

## 14. Criterios de aceptación

El proyecto se considerará completo cuando:

1. La aplicación se identifique visualmente como VALET.
2. Los comandos nuevos de usuario utilicen el nombre `valet`.
3. La documentación activa esté adaptada a VALET.
4. La interfaz desktop utilice los temas Min Dark y Min Light.
5. El diseño sea minimalista, compacto y consistente.
6. Las funcionalidades estén conectadas a la lógica real.
7. Los proyectos puedan utilizar versiones de PHP compatibles de forma independiente.
8. Los puertos del host puedan configurarse y validarse.
9. phpMyAdmin no se instale ni aparezca como funcionalidad activa.
10. Las bases de datos y los proyectos existentes se conserven.
11. Las configuraciones anteriores puedan migrarse de forma segura cuando sea necesario.
12. Las pruebas ejecutadas y los resultados estén documentados.
13. No queden referencias visibles obsoletas al producto original, salvo las justificadas por procedencia, licencia o compatibilidad.
14. No se declare completado ningún cambio que no se haya verificado.

## Instrucción final

Comienza auditando el repositorio real y los dos archivos de temas.

**Transforma Lerd en VALET sin perder la funcionalidad existente, sin destruir datos y sin hacer reemplazos de texto indiscriminados.**

El resultado debe ser una aplicación desktop profesional, minimalista y funcional, con identidad VALET, temas Min Dark y Min Light, administración de versiones de PHP, configuración de puertos y servicios integrados.

Primero presenta el diagnóstico y el plan de migración. Después implementa los cambios de forma incremental, ejecuta las pruebas y entrega una lista verificable de lo terminado, lo pendiente y cualquier compatibilidad que deba mantenerse.