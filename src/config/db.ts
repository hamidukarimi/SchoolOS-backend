import mongoose from "mongoose";
import env from "./env.js";

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(env.mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(
      "Database connection failed:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
};

export default connectDB;