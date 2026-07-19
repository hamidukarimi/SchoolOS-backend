import mongoose from "mongoose";
import env from "./env.js";

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(env.mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch {
    throw new Error(
      "Database connection failed. Verify that MongoDB is running and MONGO_URI is valid.",
    );
  }
};

export default connectDB;
