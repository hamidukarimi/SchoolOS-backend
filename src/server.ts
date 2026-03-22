import app from "./app.js";
import connectDB from "./config/db.js";
import env from "./config/env.js";

const startServer = async (): Promise<void> => {
  try {
    await connectDB();

    app.listen(env.port, () => {
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

startServer();