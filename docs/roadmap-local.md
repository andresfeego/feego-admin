# Roadmap y ejecución local

## Modelo

Roadmap (`/administracion/roadmap`) reemplaza la vista Ideas. Comparte `kb_projects`,
`kb_sections` y `kb_cards` con Kanban. La clave interna `board=ideas` se conserva para
planificación; no es un segundo catálogo. Los editores y la carga de estado se comparten
mediante `KanbanWorkspace`; la presentación y métricas están separadas.

El avance general es el promedio simple de `progress_pct` de tarjetas no archivadas,
contando cada ID una vez. Las tareas con varias secciones se muestran en cada sección;
los subtotales por sección no deben sumarse como total de proyecto. El indicador de siete
días muestra el promedio actual de tareas actualizadas, **no** el incremento de avance.
`updated_at` puede cambiar por edición de metadatos y ordenación; no existe historial.

Roadmap muestra el avance como lectura; no tiene slider ni acciones de guardar/completar.
Solo el editor abierto desde Haciendo en Kanban permite modificar manualmente el porcentaje.
Guardar allí sincroniza 0 → todo, 1–99 → doing, 100 → done.
Crear una tarea la deja en planificación a 0. Editar metadatos conserva su ubicación.
El arrastre a doing pide un porcentaje intermedio si el anterior era 0 o 100.
Los proyectos disponibles son los del catálogo Kanban, no los del dashboard de infraestructura.

## Contratos compatibles

- `GET /api/kanban/state` mantiene su estructura. Fechas de tarjetas serializadas en UTC.
- `POST /api/kanban/card/update`: payload completo de tarjeta; `progress_pct` es opcional
  para clientes existentes y, si se omite, conserva el valor. Cuando está presente debe
  ser un número entero entre 0 y 100. `sync_progress: true` requiere ese campo y actualiza
  porcentaje/columna en una sola sentencia. No reactiva tarjetas archivadas.
- `POST /api/kanban/move`: admite `progress_pct` opcional. Para Kanban debe corresponder a
  la columna de destino. Las llamadas antiguas sin ese campo conservan su contrato;
  mover a done continúa estableciendo 100. Omitir `project_id` si no cambia el proyecto.
- Valores inválidos producen 400; columna de progreso ausente produce 409 al intentar
  escribir progreso. La UI conserva borradores si falla el guardado.

La migración `20260915060000_backfill_done_progress.js` corrige done históricos a 100,
sin modificar su fecha de actividad. No revierte porcentajes al bajar la migración,
porque los valores históricos previos no se pueden reconstruir.

## Local

Usar Node 22. La base restaurada vive en el contenedor persistente `feego-mariadb`,
`127.0.0.1:3308`, base `feegosystem_admin_db`. Credenciales solo en `.env`.
Respaldar antes de migrar. El respaldo previo a Roadmap está en
`../DB/feego-local-before-roadmap-20260915.sql.gz`.

Desde la raíz del repo:

```sh
npm run migrate:status
npm run migrate
npm --prefix ui ci
npm --prefix ui run build
HOST=0.0.0.0 PORT=3030 UI_DIST_DIR="$PWD/ui/dist" UI_DIST_ASSETS_DIR="$PWD/ui/dist/assets" node server.js
```

`HOST=0.0.0.0` permite acceso por Wi-Fi. La URL usa la IP Wi-Fi actual del Mac y el
puerto 3030; puede cambiar al reconectar. El Mac debe seguir encendido.
El servidor local iniciado durante la implementación registra salida en
`/tmp/feego-admin-local.log`.

En producción mantener `HOST=127.0.0.1`: Nginx conecta a `127.0.0.1:3030`.
No cambiar el servicio del VPS ni ejecutar migraciones allí sin autorización.

## Verificación

```sh
node --check server.js
node --test tests/roadmap.test.mjs
npm --prefix ui run build
npm run migrate:status
```

Prueba de integración local opcional:

```sh
# Proporcionar FEEGO_TEST_PASSWORD mediante el entorno; no guardarla en el repo.
node tests/roadmap-local.cjs
```

El test comprueba host, puerto y base antes de escribir; crea fixtures temporales y
los elimina en `finally`. Verifica autenticación, CRUD, persistencia, preservación de
metadatos/fechas, sincronización, archivo y fecha de la migración.

## Nueva tarea y orden por sección

El modal Nueva tarea permite elegir proyecto mediante tarjetas con logo, varias secciones
mediante badges y prioridad mediante botones con iconos. Cambiar proyecto limpia las
secciones seleccionadas. Título obligatorio, progreso inicial 0 y ubicación planificación.

La migración `20260915070000_roadmap_section_order.js` añade `roadmap_order_json` a
`kb_cards`. Las claves son IDs de sección (0 para Sin sección); mantienen un orden
independiente del campo `sort` del Kanban y de otras secciones de la misma tarea.
Aplicar antes de iniciar esta versión del backend. Respaldo local previo en
`../DB/feego-local-before-task-order-20260915.sql.gz`.

`POST /api/roadmap/reorder` recibe `{ project_id, section_id, ordered_ids }`, con IDs
numéricos y proyecto/sección null cuando corresponda. La lista debe contener exactamente
las tareas no completadas y no archivadas de esa sección. El backend valida pertenencia,
rechaza duplicados (400) o conjuntos desactualizados/completadas (409), y guarda en una
transacción. El orden no cambia `updated_at`, porcentajes, estados ni orden del Kanban.

Las completadas aparecen debajo en una subsección, sin asas de arrastre. Se conservan
sus posiciones relativas; reordenar tareas pendientes ocupa solo los espacios de las
pendientes dentro del orden almacenado. El arrastre admite puntero y teclado (Espacio,
flechas, Espacio; Escape cancela). Con búsqueda activa se deshabilita el arrastre para
no reordenar accidentalmente una lista parcial.

## Orden y prioridad de proyectos

- El botón Ordenar proyectos en Roadmap abre una lista con arrastre por asa y soporte de teclado (espacio, flechas, espacio); Guardar orden persiste y Cancelar descarta el borrador.
- `POST /api/kanban/projects/reorder` recibe `{ ordered_ids: number[] }` con todos los proyectos activos. Valida duplicados (400) y listas desactualizadas/incompletas (409), y guarda `kb_projects.sort` en una transacción. El orden compartido también se refleja donde se usa `/api/kanban/state`. Sin proyecto permanece al final, fuera de la lista editable.
- Migración local `20260915120000_kb_project_priority.js`: agrega `kb_projects.priority`, nullable. Los proyectos existentes quedan sin prioridad; valores editables 1/Alta, 2/Media, 3/Baja o null. No afecta el orden manual.
- `POST /api/kanban/project/update` acepta priority; si se omite conserva el valor actual.
- Validación: `FEEGO_TEST_PASSWORD=... node tests/project-options-local.cjs`. Solo admite MariaDB local en 3308, crea proyectos temporales y restaura el orden original al finalizar.

## Kanban y archivadas por proyecto

Kanban presenta únicamente Por hacer, Haciendo y Hecho. Conserva el arrastre entre columnas, la edición y las acciones de archivar y eliminar. La edición manual del porcentaje sigue limitada a Haciendo. Las columnas tienen desplazamiento horizontal independiente en móvil.

Al pie del detalle de Roadmap están Tareas archivadas y Abrir Kanban. El modal de archivadas usa las tarjetas del proyecto, agrupadas por sus secciones; una tarea multisección aparece en cada sección, sin inflar el contador total. Las tareas sin sección o con secciones que ya no existen aparecen en Sin sección. Se pueden buscar, abrir para editar/eliminar y restaurar a Roadmap conservando el progreso mediante el endpoint existente de movimiento.

Verificación: agrupación de archivadas cubierta en tests/roadmap.test.mjs; integración de tareas y movimientos en tests/roadmap-local.cjs. Prueba visual con fixtures temporales: arrastre de Por hacer a Haciendo con 35%, restauración de archivada con 40%, edición desde archivadas, múltiples secciones, vista móvil y limpieza de fixtures.

### Pendientes: planificación y Por hacer

Roadmap muestra Play en todas las tareas cuyo estado calculado es pendiente. Si ya están en Kanban/Por hacer, el control está deshabilitado y su etiqueta lo indica. Las demás se envían a Por hacer con 0%. Cada tarjeta de Por hacer en Kanban incluye Devolver a planificación de Roadmap, que mueve a Ideas/n/a conservando sus metadatos. No archiva ni elimina. Validación visual local: ida y vuelta completa, botón habilitado/deshabilitado según destino y comprobación de notas, prioridad y sección en DB; fixtures retirados.

### Editor visual de tareas

`EditTaskDialog` comparte estilos y logos con Nueva tarea: proyectos visuales, secciones múltiples y prioridad como botones, fecha limitada a 320 px, etiquetas, notas y acciones al pie. El control de progreso se presenta solo cuando el editor se abre desde Haciendo en Kanban; el resto es lectura. La lógica de guardado sigue omitiendo progress_pct si no corresponde editarlo. Prueba visual y DB: guardar dos secciones, prioridad Alta, etiquetas separadas por coma, notas y progreso 45 desde Haciendo; fixtures retirados.

## Renovación del panel operativo (15 septiembre 2026)

- Kanban: las tareas en Por hacer no muestran barra ni porcentaje. Haciendo y Hecho conservan su indicador; la edición del progreso sigue limitada a Haciendo.
- Dashboard VPS, Diario, Uploads y Configuración comparten encabezados y estilos basados en los tokens del tema (`OperationsHeader`, `AdminPages.scss`). Se conservan los calendarios, métricas, editores y operaciones existentes.
- Los colores de proyectos se administran desde el engranaje de Dashboard VPS (`ProjectColorsDialog`). Conserva GET `/api/infra/projects` y PATCH por slug, admite color automático y valida códigos hexadecimales. Cada fila se guarda individualmente y actualiza los colores de las analíticas.
- Configuración queda dedicada a apariencia con previsualizaciones Claro/Oscuro/Sistema. Uploads utiliza iconos Lucide por tipo y mantiene vista previa, descarga, eliminación y carga múltiple.
- El marco de la aplicación mide `100dvh`; el contenido y los ítems de navegación tienen scroll independiente. Al cambiar de ruta se restablece el scroll del contenido.
- Verificado localmente: build Vite, sintaxis de server.js y 7 pruebas de Roadmap. Revisión visual en 1280×720, 1280×480 y 390×844, tema claro/oscuro, modal de colores (guardado del mismo color de Altezza y reapertura), vista previa de imagen y detalle del Diario. En página larga, scroll del contenido 4682 px con sidebar top 0 / alto 480 px, scroll de ventana 0 y navegación con scroll propio; al navegar, contenido vuelve a 0.
