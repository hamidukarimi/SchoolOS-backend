import express from "express";
import type { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import env from "./config/env.js";

const app: Application = express();

// ─── Global Middlewares ───────────────────────────────────────────────────────

app.use(helmet());

const corsOptions: cors.CorsOptions = {
  origin: (requestOrigin: string | undefined, callback: (err: Error | null, origin?: boolean) => void) => {
    if (!requestOrigin) return callback(null, true); // allow Postman, curl

    if (requestOrigin === env.clientUrl) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (env.nodeEnv === "development") {
  app.use(morgan("dev"));
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api", routes);

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "AuthForge Express API is running",
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use(errorMiddleware);

export default app;