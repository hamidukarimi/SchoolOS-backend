# AuthForge Express

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)

An open-source authentication backend built with **Node.js**, **Express.js**, **MongoDB**, and **TypeScript**.  
It includes JWT-based authentication, refresh tokens with database sessions, role-based access control, rate limiting, and password management. Designed for real-world projects and easily extendable.

---

## 🔹 Features

- ✅ User registration & login with hashed passwords
- ✅ JWT authentication (access + refresh tokens)
- ✅ Database-backed refresh tokens (sessions stored in MongoDB)
- ✅ Role-based authorization (`user` & `admin`)
- ✅ Password change & session invalidation
- ✅ Logout & logout-all devices
- ✅ Rate limiting per IP (prevents brute force login)
- ✅ Error handling with standardized `ApiError`
- ✅ Environment configuration with Zod validation
- ✅ Fully typed with TypeScript (strict mode)
- ✅ RESTful API design

---

## 🔹 Tech Stack

- Node.js (v18+)
- Express.js
- MongoDB (local or Atlas)
- Mongoose
- TypeScript (strict mode)
- Zod for environment & request validation
- JWT for authentication
- Bcrypt for password hashing
- dotenv for environment variables
- ts-node / nodemon for development

---

## 🔹 Project Structure

```bash
src/
├─ config/
│  ├─ db.ts
│  └─ env.ts
├─ controllers/
│  ├─ logout.controller.ts
│  ├─ refresh.controller.ts
│  ├─ session.controller.ts
│  └─ user.controller.ts
├─ middlewares/
│  ├─ auth.middleware.ts
│  ├─ error.middleware.ts
│  ├─ rateLimit.middleware.ts
│  ├─ role.middleware.ts
│  └─ validate.middleware.ts
├─ models/
│  ├─ Session.model.ts
│  └─ User.model.ts
├─ routes/
│  ├─ admin.routes.ts
│  ├─ index.ts
│  ├─ logout.routes.ts
│  ├─ refresh.routes.ts
│  ├─ session.routes.ts
│  └─ user.routes.ts
├─ services/
│  ├─ refresh.service.ts
│  ├─ session.service.ts
│  └─ user.service.ts
├─ types/
│  └─ express.d.ts
├─ utils/
│  ├─ ApiError.ts
│  └─ jwt.ts
├─ validators/
│  ├─ session.validator.ts
│  └─ user.validator.ts
├─ app.ts
└─ server.ts
```

---

## 🔹 Installation

**1️⃣ Clone the repository**

```bash
git clone https://github.com/hamidukarimi/authforge-express.git
cd authforge-express
```

**2️⃣ Install dependencies**

```bash
npm install
```

**3️⃣ Create .env file**

You must create a `.env` file in the root of the project.

You can copy from `.env.example`:

```bash
cp .env.example .env
```

Or manually create one with:

```bash
PORT=5000
NODE_ENV=development
MONGO_URI=your_mongodb_uri
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES_IN=10m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
```

> All environment variables are validated at startup using **Zod**. The server will not start if any required variable is missing or invalid.

---

## 🔹 Running the Server

**Development mode** (with nodemon + ts-node)

```bash
npm run dev
```

**Build**

```bash
npm run build
```

**Production mode**

```bash
npm start
```

By default, the server runs on:

```bash
http://localhost:5000
```

---

## 🔹 API Overview

### Authentication Routes

| Route                    | Method | Auth Required | Description                                  |
| ------------------------ | ------ | ------------- | -------------------------------------------- |
| `/api/users/`            | POST   | ❌            | Register a new user                          |
| `/api/sessions/`         | POST   | ❌            | Login user (returns access & refresh tokens) |
| `/api/logout/`           | POST   | ❌            | Logout current session                       |
| `/api/logout/all`        | POST   | ✅            | Logout all sessions                          |
| `/api/token/`            | POST   | ❌            | Get new access token using refresh token     |
| `/api/users/me/password` | PUT    | ✅            | Change password                              |

### Headers

```bash
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## 🔹 Example: Register

**Request**

```bash
POST /api/users/
Content-Type: application/json
```

```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**

```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "id": "64f1a2b3c4d5e6f7g8h9",
      "name": "John Doe",
      "email": "user@example.com",
      "role": "user"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsIn..."
  }
}
```

---

## 🔹 Example: Login

**Request**

```bash
POST /api/sessions/
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**

```json
{
  "success": true,
  "message": "Logged in successfully",
  "data": {
    "user": {
      "id": "64f1a2b3c4d5e6f7g8h9",
      "name": "John Doe",
      "email": "user@example.com",
      "role": "user"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsIn..."
  }
}
```

> The refresh token is stored in an **httpOnly cookie** automatically.

---

## 🔹 TypeScript Notes

This project uses **strict TypeScript** with the following key patterns:

- Mongoose models are fully typed using `IDocument`, `IMethods`, and `Model` generics
- Express `Request` is extended via `src/types/express.d.ts` to include `req.user`
- JWT payloads are typed with `AccessTokenPayload` and `RefreshTokenPayload` interfaces
- Zod schemas export inferred types (`LoginInput`, `RegisterInput`, etc.) as the single source of truth for request shapes
- All `catch` blocks narrow `unknown` errors safely with `instanceof` checks

---

## 🔹 Contributing

This project is open-source.

You are welcome to fork, submit pull requests, or open issues.

```bash
git checkout -b feature/my-feature
git commit -m "feat: add my feature"
git push origin feature/my-feature
```

Then open a Pull Request.

---

## 🔹 License

This project is licensed under the MIT License.  
See the [LICENSE](./LICENSE) file for details.

---

## 🔹 Notes

- Easily extensible with email verification, password reset, or OAuth providers
- Ensure environment variables are properly configured before deployment
- Never commit JWT secrets to public repositories

---

## ⭐ Support

If you find this project useful, consider giving it a star ⭐ on GitHub.

Made with ❤️ by Hamid Karimi