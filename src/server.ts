import app from "./app.js";
import connectDB from "./config/db.js";
import env from "./config/env.js";
import mongoose from "mongoose";
import type { Server } from "node:http";

let server: Server | undefined;

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  console.log(`${signal} received. Shutting down gracefully.`);

  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  await mongoose.disconnect();
  console.log("HTTP server and MongoDB connection closed.");
};

const startServer = async (): Promise<void> => {
  try {
    await connectDB();

    server = app.listen(env.port, () => {
      console.log(`Server running on port ${env.port}`);
    });
  } catch (error) {
    console.error(
      "❌ Server failed to start:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
};

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(signal)
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        console.error(
          "Graceful shutdown failed:",
          error instanceof Error ? error.message : error,
        );
        process.exit(1);
      });
  });
}

startServer();
