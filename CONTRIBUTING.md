# Contributing to SchoolOS

Thank you for considering contributing to SchoolOS! This document will guide you through everything you need to know to contribute effectively, from setting up your environment to submitting a pull request.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Project Architecture](#project-architecture)
- [Development Workflow](#development-workflow)
- [Adding a New Feature](#adding-a-new-feature)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

---

## Code of Conduct

By participating in this project, you agree to keep discussions respectful, inclusive, and constructive. We welcome contributors of all experience levels. If you are unsure about something, open an issue and ask, no question is too small.

---

## Getting Started

### 1. Fork and clone the repository

```bash
git clone https://github.com/hamidukarimi/SchoolOS-backend.git
cd SchoolOS-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Fill in your MongoDB URI and JWT secrets in the `.env` file.

### 4. Start the development server

```bash
npm run dev
```

### 5. Verify the build

```bash
npm run build
```

Make sure the build passes with zero TypeScript errors before making any changes.

---

## Project Architecture

SchoolOS follows a flat, layered architecture. Every feature is spread across exactly **5 files**:

```
models/         → Mongoose schema and TypeScript interface
validators/     → Zod schemas for request validation
services/       → Business logic (database operations)
controllers/    → HTTP handlers (thin layer, no business logic)
routes/         → Express router with middleware applied
```

The single rule: **controllers stay thin**. All database queries and business logic belong in services. Controllers only call a service, then send the response.

### Request lifecycle

```
Request → Router → Middleware (auth, validate) → Controller → Service → Database
                                                                       ↓
Response ←────────────────────────────────────────────────────────────
```

---

## Development Workflow

### Branching strategy

Always create a new branch from `main` for your work:

```bash
git checkout main
git pull origin main
git checkout -b feat/your-feature-name
```

Branch naming conventions:

| Type | Format | Example |
|------|--------|---------|
| New feature | `feat/feature-name` | `feat/parent-portal` |
| Bug fix | `fix/bug-description` | `fix/attendance-duplicate` |
| Documentation | `docs/what-you-changed` | `docs/api-reference` |
| Refactor | `refactor/what-you-changed` | `refactor/fee-service` |

### Build before pushing

Always run the build before pushing your branch:

```bash
npm run build
```

Zero TypeScript errors is a hard requirement. PRs with build errors will not be reviewed.

---

## Adding a New Feature

Follow these steps exactly when adding a new feature to SchoolOS.

### Step 1 — Create the model

In `src/models/FeatureName.model.ts`:

- Define a TypeScript interface extending `Document`
- Define the Mongoose schema with proper types, validations, and defaults
- Export the interface and the model

```ts
import mongoose, { Document, Schema } from "mongoose";

export interface IFeature extends Document {
  name: string;
  // ...
}

const FeatureSchema = new Schema<IFeature>(
  {
    name: { type: String, required: true, trim: true },
    // ...
  },
  { timestamps: true }
);

export default mongoose.model<IFeature>("Feature", FeatureSchema);
```

### Step 2 — Create the validator

In `src/validators/feature.validator.ts`:

- Use Zod for all validation schemas
- Create a `create` schema and an `update` schema at minimum
- All enum arrays must use `as const`
- Do not wrap schemas in a `body` object — the validate middleware parses `req.body` directly

```ts
import { z } from "zod";

export const createFeatureSchema = z.object({
  name: z.string().min(1, "Name is required"),
  // ...
});

export const updateFeatureSchema = z.object({
  name: z.string().min(1).optional(),
  // ...
});
```

### Step 3 — Create the service

In `src/services/feature.service.ts`:

- All database queries live here
- Use `import type` for TypeScript interfaces
- Use `any` for Mongoose query objects when TypeScript's strict mode causes issues with `$or`, `$in`, etc.
- Throw `ApiError` for business logic errors, never send responses from a service

```ts
import Feature from "../models/Feature.model.js";
import type { IFeature } from "../models/Feature.model.js";
import ApiError from "../utils/ApiError.js";

export const createFeatureService = async (data: Partial<IFeature>) => {
  const feature = await Feature.create(data);
  return feature;
};
```

### Step 4 — Create the controller

In `src/controllers/feature.controller.ts`:

- Use `import type` for Express types
- Every handler must be `async` and call `next(error)` in the catch block
- Always guard `req.params.id` with `if (!id || Array.isArray(id))`
- Build filter objects conditionally to avoid `exactOptionalPropertyTypes` errors
- Never put business logic here — only call a service and send the response

```ts
import type { Request, Response, NextFunction } from "express";
import { createFeatureService } from "../services/feature.service.js";

export const createFeature = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const feature = await createFeatureService(req.body);
    res.status(201).json({ success: true, data: feature, message: "Feature created successfully" });
  } catch (error) {
    next(error);
  }
};
```

### Step 5 — Create the routes

In `src/routes/feature.routes.ts`:

- Always import middleware as default imports — `protect`, `adminOnly`, `validate` are all default exports
- Apply `protect` to the entire router with `router.use(protect)`
- Use `.js` extensions in all imports

```ts
import { Router } from "express";
import { createFeature } from "../controllers/feature.controller.js";
import protect from "../middlewares/auth.middleware.js";
import adminOnly from "../middlewares/adminOnly.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { createFeatureSchema } from "../validators/feature.validator.js";

const router = Router();

router.use(protect);

router.get("/", getAllFeatures);
router.post("/", adminOnly, validate(createFeatureSchema), createFeature);

export default router;
```

### Step 6 — Register the route

In `src/routes/index.ts`, add two lines:

```ts
import featureRoutes from "./feature.routes.js";
// ...
router.use("/features", featureRoutes);
```

### Step 7 — Build and test

```bash
npm run build
```

Then test all your endpoints in Postman before opening a pull request.

---

## Coding Standards

### TypeScript

- Strict mode is enabled — never use `any` unless it is the only solution for a Mongoose query type conflict
- Always use `import type` for type-only imports (`verbatimModuleSyntax` is enabled)
- Use `as const` on all Zod enum arrays
- Build filter objects conditionally to satisfy `exactOptionalPropertyTypes`

### Imports

- Always use `.js` extensions in local imports, even for `.ts` files — this is required for ESM compatibility
- Use named exports for controllers and services
- Use default exports for routes, models, and middleware

### Response format

Every response must follow this exact structure:

```ts
// Success
res.status(200).json({ success: true, data: result, message: "..." });

// Error (throw and let the error middleware handle it)
throw new ApiError(404, "Resource not found");
```

### Error handling

- Always use `ApiError` for expected errors (not found, unauthorized, conflict, etc.)
- Always wrap controller logic in try/catch and call `next(error)`
- Never send error responses manually from controllers — let the error middleware handle it

---

## Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
type: short description
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | Adding a new feature |
| `fix` | Fixing a bug |
| `docs` | Documentation changes only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `chore` | Build process, dependency updates, config changes |
| `test` | Adding or updating tests |

### Examples

```bash
git commit -m "feat: add Student feature (model, validator, service, controller, routes)"
git commit -m "fix: resolve duplicate attendance entry error"
git commit -m "docs: update API reference for grades endpoint"
git commit -m "refactor: extract fee calculation logic into service"
```

Keep the description short and in lowercase. No period at the end.

---

## Pull Request Guidelines

Before opening a pull request, make sure:

- `npm run build` passes with zero errors
- Your feature follows the 5-file pattern described above
- All endpoints are tested and working
- Your branch is up to date with `main`
- Your commit messages follow the conventional commits format

### PR title format

Use the same format as commit messages:

```
feat: add Parent Portal feature
fix: attendance bulk insert duplicate handling
```

### PR description

Include the following in your PR description:

1. What does this PR do?
2. What endpoints were added or changed?
3. Any known limitations or follow-up work needed?

---

## Reporting Bugs

If you find a bug, please open a GitHub issue with the following information:

- A clear and descriptive title
- Steps to reproduce the bug
- Expected behavior
- Actual behavior
- Any relevant error messages or stack traces
- Your Node.js version and OS

---

## Suggesting Features

We welcome feature suggestions! Open a GitHub issue with:

- A clear description of the feature
- The problem it solves
- How it fits into the existing architecture
- Any relevant examples

---

Thank you for helping make SchoolOS better for schools everywhere.