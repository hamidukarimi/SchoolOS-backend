import type { IUserDocument } from "../models/User.model.js";

declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
    }
  }
}