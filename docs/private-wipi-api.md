# Wipi Private API

API privada server-to-server para Beelink local.

## Base URL

Local/VPS interno:

```text
http://127.0.0.1:3030/api/private/wipi/v1
```

Publica via Nginx:

```text
https://admin.feegosystem.com/api/private/wipi/v1
```

## Autenticacion

Enviar siempre:

```http
Authorization: Bearer <WIPI_PRIVATE_TOKEN>
```

El token vive en el `.env` del backend Feego Admin. No depende del login del panel, cookies ni usuarios.

## Variables de entorno

```env
WIPI_PRIVATE_ENABLED=true
WIPI_PRIVATE_CLIENT_ID=wipi-local-app
WIPI_PRIVATE_TOKEN=<token-largo>
WIPI_PRIVATE_SCOPES=read:kanban
```

## Endpoints

### Health

```http
GET /health
```

Ejemplo:

```bash
curl -H "Authorization: Bearer $WIPI_PRIVATE_TOKEN" \
  http://127.0.0.1:3030/api/private/wipi/v1/health
```

Respuesta:

```json
{
  "ok": true,
  "data": {
    "app": "feego-admin",
    "api": "wipi-private",
    "client_id": "wipi-local-app",
    "scopes": ["read:kanban"],
    "status": "ok",
    "timestamp": "2026-08-17T00:00:00.000Z"
  }
}
```

### Kanban State

```http
GET /kanban/state
```

Ejemplo:

```bash
curl -H "Authorization: Bearer $WIPI_PRIVATE_TOKEN" \
  http://127.0.0.1:3030/api/private/wipi/v1/kanban/state
```

Respuesta:

```json
{
  "ok": true,
  "data": {
    "projects": [],
    "sections": [],
    "cards": []
  }
}
```

Cada proyecto puede traer:

```json
{
  "id": 1,
  "name": "Proyecto",
  "logo_path": "project-logos/project_1_123.webp",
  "logo_url": "/api/private/wipi/v1/kanban/project/logo?name=project-logos%2Fproject_1_123.webp"
}
```

### Project Logo

Lee el archivo grafico de un proyecto usando el mismo Bearer token y scope `read:kanban`.

```http
GET /kanban/project/logo?name=<logo_path>
```

Ejemplo:

```bash
curl -L \
  -H "Authorization: Bearer $WIPI_PRIVATE_TOKEN" \
  "http://127.0.0.1:3030/api/private/wipi/v1/kanban/project/logo?name=project-logos%2Fproject_1_123.webp" \
  --output logo.webp
```

Desde frontend no uses `<img src>` directo si no puedes agregar headers. Descarga la imagen con `fetch`, agrega el header `Authorization`, convierte a `blob` y usa `URL.createObjectURL(blob)`.

## Errores

- `401`: token ausente o invalido.
- `403`: falta el scope requerido.
- `404`: API privada desactivada.
- `500`: error interno.

Formato:

```json
{ "ok": false, "error": "unauthorized" }
```

## Uso desde Beelink

1. Leer el token desde el entorno local de Beelink.
2. Llamar `GET /health` al iniciar para validar credenciales.
3. Llamar `GET /kanban/state` para sincronizar proyectos, secciones y tarjetas.
4. Para logos, usar `project.logo_url` o construir `/kanban/project/logo?name=<logo_path>`.
5. Tratar esta API como solo lectura hasta que exista el scope `write:kanban`.
