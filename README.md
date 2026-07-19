# NovaSchool OS Backend

API de gestión escolar construida con Node.js, Express, TypeScript, MongoDB y Mongoose. Incluye autenticación JWT con rotación de refresh tokens, sesiones persistidas, autorización administrativa y módulos escolares.

Proyecto basado en SchoolOS Backend, creado originalmente por Hamid Karimi y distribuido bajo licencia MIT.

## Tecnologías

- Node.js 22
- Express 5
- TypeScript en modo estricto
- MongoDB y Mongoose
- JWT de acceso y renovación
- Cookies HTTP-only
- Zod
- Helmet, CORS, rate limiting y Morgan
- bcryptjs

## Requisitos

- Node.js 22 o compatible. El archivo `.nvmrc` fija la versión recomendada.
- npm
- MongoDB local, Docker o una URI privada de MongoDB Atlas

Comprobación:

```bash
node --version
npm --version
```

## Instalación

Desde `novaschool-os/backend`:

```bash
npm ci
```

Se usa npm porque el proyecto incluye `package-lock.json`.

## Variables de entorno

Crear el entorno local desde el ejemplo:

```bash
cp .env.example .env
```

En PowerShell:

```powershell
Copy-Item .env.example .env
```

Variables:

| Variable | Uso |
|---|---|
| `PORT` | Puerto HTTP; localmente `5000` |
| `NODE_ENV` | `development`, `test` o `production` |
| `MONGO_URI` | URI local o privada de Atlas |
| `JWT_ACCESS_SECRET` | Secreto independiente de al menos 32 caracteres |
| `JWT_REFRESH_SECRET` | Secreto independiente de al menos 32 caracteres |
| `JWT_ACCESS_EXPIRES_IN` | Duración del access token, por ejemplo `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Duración de refresh y sesión, por ejemplo `7d` |
| `CLIENT_URL` | Único origen permitido por CORS |
| `COOKIE_SAME_SITE` | `lax`, `strict` o `none` |
| `COOKIE_SECURE` | `false` en HTTP local; `true` en producción HTTPS |
| `COOKIE_DOMAIN` | Dominio opcional de la cookie |

No versionar `.env`. `.env.example` contiene únicamente referencias reemplazables.

Para generar secretos de producción:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Generar un valor diferente para cada secreto.

## MongoDB local

### Instalación existente

Iniciar el servicio de MongoDB y usar:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/novaschool_os
```

### Docker Compose

El compose de desarrollo levanta solamente MongoDB:

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps
```

Para detenerlo sin borrar el volumen:

```bash
docker compose -f docker-compose.dev.yml down
```

### MongoDB Atlas

Reemplazar `MONGO_URI` en el `.env` local con la URI privada. No copiar la URI a `.env.example`, documentación, commits o capturas.

El servidor espera la conexión a MongoDB antes de aceptar solicitudes. En `SIGINT` o `SIGTERM` cierra el servidor HTTP y la conexión de Mongoose.

## Desarrollo

```bash
npm run dev
```

API local:

```text
http://localhost:5000/api
```

Health check:

```text
GET http://localhost:5000/api/health
```

Respuesta:

```json
{
  "success": true,
  "message": "NovaSchool OS API is running",
  "environment": "development",
  "timestamp": "..."
}
```

## Typecheck, build y pruebas

```bash
npm run typecheck
npm run build
npm test
```

El build se genera en `dist/`. Las pruebas usan el runner nativo de Node y verifican health, CORS, validación y errores JSON sin depender de MongoDB.

ESLint está configurado para TypeScript, pruebas y archivos de configuración:

```bash
npm run lint
```

## Producción

```bash
npm run build
npm start
```

Antes de producción:

- usar secretos aleatorios e independientes;
- configurar una URI privada de MongoDB;
- servir la API mediante HTTPS;
- establecer `NODE_ENV=production`;
- establecer `COOKIE_SECURE=true`;
- configurar exactamente el origen del frontend en `CLIENT_URL`;
- revisar proxy, logs, backups y límites según la infraestructura.

`COOKIE_SAME_SITE=none` solo se acepta junto con `COOKIE_SECURE=true`.

## Administrador inicial

El repositorio original requería cambiar el rol manualmente en MongoDB. Ahora existe un seeder seguro que crea o promueve por correo y utiliza el hook real de bcrypt del modelo.

Definir solo en `.env`:

```dotenv
ADMIN_NAME=Nova School
ADMIN_USERNAME=novaschool.admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-strong-password
```

Ejecutar:

```bash
npm run seed:admin
```

Reglas:

- no contiene credenciales fijas;
- exige nombre y apellido;
- exige contraseña de al menos 12 caracteres;
- no duplica usuarios por correo;
- si el usuario ya existe, lo promueve a `admin` sin sustituir su contraseña;
- si crea un usuario, la contraseña se hashea con el middleware del modelo.

## Autenticación para Angular

- Registro: `POST /api/users`
- Login: `POST /api/sessions`
- Perfil: `GET /api/users/me`
- Refresh: `POST /api/token`
- Logout: `POST /api/logout`

Registro y login devuelven `data.accessToken` en JSON y establecen `refreshToken` en una cookie HTTP-only. Angular debe:

- usar `withCredentials: true` para registro, login, refresh y logout;
- mantener el access token en memoria;
- enviarlo como `Authorization: Bearer <token>`;
- intentar un refresh controlado ante `401`;
- limpiar la sesión si refresh responde `401` o `403`;
- no intentar refresh repetidamente ante un `403` de permisos.

En desarrollo local, la cookie usa `sameSite=lax`, `secure=false` y `path=/api`. CORS permite únicamente el valor de `CLIENT_URL`, que por defecto es `http://127.0.0.1:4200`.

La guía completa está en [`../docs/BACKEND_API_GUIDE.md`](../docs/BACKEND_API_GUIDE.md).

## Roles y alcance escolar

El modelo de autenticación tiene dos roles:

- `admin`: lectura y escritura total.
- `user`: cuenta estándar.

Docente y estudiante son perfiles vinculados, no roles. Un `user` vinculado a `Teacher` o `Student` obtiene alcance de lectura sobre los datos escolares autorizados. Las mutaciones de registros escolares requieren `admin`.

## Módulos

- autenticación, usuarios, sesiones y administración;
- estudiantes y docentes;
- clases y horarios;
- asistencia;
- exámenes y calificaciones;
- pagos;
- anuncios;
- mensajería;
- biblioteca;
- recursos humanos.

## Estructura

```text
backend/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── models/
│   ├── routes/
│   ├── scripts/
│   ├── services/
│   ├── types/
│   ├── utils/
│   ├── validators/
│   ├── app.ts
│   └── server.ts
├── tests/
├── scripts/
├── docker-compose.dev.yml
├── package.json
├── tsconfig.json
└── .env.example
```

## Colección de API

Importar en Postman:

- `../docs/api/SchoolOS.postman_collection.json`
- `../docs/api/SchoolOS.postman_environment.json`

Seleccionar el entorno local, completar las variables de cuenta y usar primero login. Postman conserva la cookie de refresh en su cookie jar y los scripts de la colección actualizan `accessToken`.

## Problemas frecuentes

### El servidor no inicia

Si aparece `Database connection failed`, comprobar que MongoDB esté activo y que `MONGO_URI` sea válida. El backend no escucha el puerto hasta conectar a la base.

### Variables inválidas

El inicio falla de forma explícita si falta una variable obligatoria, el puerto es inválido, los secretos tienen menos de 32 caracteres o la combinación de cookies es insegura.

### Angular recibe un error CORS

Comprobar que `CLIENT_URL` coincida exactamente con el origin del navegador, sin una barra final:

```dotenv
CLIENT_URL=http://127.0.0.1:4200
```

### El refresh no envía cookie

Usar `withCredentials: true`. En HTTP local, mantener `COOKIE_SECURE=false`. En producción, usar HTTPS y `COOKIE_SECURE=true`.

### Un usuario autenticado recibe 403 en datos escolares

El usuario debe ser `admin` o estar vinculado por `userId` a un documento `Teacher` o `Student`. Autenticación válida no equivale a alcance escolar.

## Seguridad

- Helmet en todas las respuestas.
- CORS con origen único configurable y credenciales.
- Rate limit en registro, login y refresh.
- Validación Zod de bodies.
- bcrypt con coste 12.
- JWT con issuer, audience, expiración y `tokenVersion`.
- Refresh tokens almacenados únicamente como hash SHA-256.
- Rotación de refresh token.
- Rechazo de cuentas bloqueadas o inactivas.
- Errores de producción sin stack trace.
- Traducción a `400` de IDs inválidos y validación Mongoose.
- Conflictos únicos traducidos a `409`.

## Licencia y atribución

Se conserva el archivo [`LICENSE`](LICENSE) y la licencia MIT original.

Proyecto basado en SchoolOS Backend, creado originalmente por Hamid Karimi y distribuido bajo licencia MIT.

## Agradecimiento al autor original

Gracias a [Hamid Karimi](https://github.com/hamidukarimi) por crear y publicar
SchoolOS Backend como software de código abierto. Su trabajo proporcionó la
base sobre la que se desarrollaron estas mejoras de seguridad, calidad y
operación. Esta contribución se ofrece con respeto por su autoría y con el
propósito de devolver valor a la comunidad que hizo posible el proyecto.
