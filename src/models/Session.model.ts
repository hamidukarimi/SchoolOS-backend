import mongoose, { Document, Model, Schema } from "mongoose";
import type { Types } from "mongoose";
import crypto from "crypto";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ISession {
  user: Types.ObjectId;
  refreshTokenHash: string;
  userAgent?: string;
  ip?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISessionMethods {
  setRefreshToken(refreshToken: string): void;
  compareRefreshToken(refreshToken: string): boolean;
}

export interface ISessionDocument extends ISession, ISessionMethods, Document {
  _id: Types.ObjectId;
}

export type SessionModel = Model<ISessionDocument, {}, ISessionMethods>;

// ─── Schema ───────────────────────────────────────────────────────────────────

const sessionSchema = new Schema<ISessionDocument, SessionModel, ISessionMethods>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
    },
    userAgent: String,
    ip: String,
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

// ─── Instance Methods ─────────────────────────────────────────────────────────

sessionSchema.methods.setRefreshToken = function (refreshToken: string): void {
  this.refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
};

sessionSchema.methods.compareRefreshToken = function (
  refreshToken: string
): boolean {
  const hash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
  return hash === this.refreshTokenHash;
};

// ─── Model ────────────────────────────────────────────────────────────────────

const Session = mongoose.model<ISessionDocument, SessionModel>(
  "Session",
  sessionSchema,
);

export default Session;