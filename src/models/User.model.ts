import mongoose, { Document, Model, Schema } from "mongoose";
import type { Types } from "mongoose";
import bcrypt from "bcryptjs";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ILocation {
  city?: string;
  country?: string;
}

export interface IUser {
  firstname: string;
  lastname: string;
  username: string;
  email: string;
  password: string;
  birthday?: Date;
  gender?: "male" | "female" | "other";
  location?: ILocation;
  avatar?: string;
  following: Types.ObjectId[];
  tokenVersion: number;
  role: "user" | "admin";
  isBlocked: boolean;
  isVerified: boolean;
  isActive: boolean;
  savedPosts: Types.ObjectId[];
  passwordChangedAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IUserDocument extends IUser, IUserMethods, Document {
  _id: Types.ObjectId;
}

export type UserModel = Model<IUserDocument, {}, IUserMethods>;

// ─── Schema ───────────────────────────────────────────────────────────────────

const userSchema = new Schema<IUserDocument, UserModel, IUserMethods>(
  {
    // =====================
    // Basic Information
    // =====================

    firstname: {
      type: String,
      trim: true,
      required: true,
      minlength: 2,
      maxlength: 50,
    },
    lastname: {
      type: String,
      trim: true,
      required: true,
      minlength: 2,
      maxlength: 50,
    },
    username: {
      type: String,
      trim: true,
      required: true,
      minlength: 2,
      maxlength: 50,
    },

    birthday: {
      type: Date,
    },

    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },

    location: {
      city: {
        type: String,
        trim: true,
        maxlength: 100,
      },
      country: {
        type: String,
        trim: true,
        maxlength: 100,
      },
    },

    email: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },

    // phone: {
    //   type: String,
    //   trim: true,
    //   maxlength: 20,
    //   unique: true,
    //   sparse: true,
    //   required: false,
    // }

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    avatar: {
      type: String,
    },

    following: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },

    tokenVersion: {
      type: Number,
      default: 0,
    },

    // =====================
    // Roles & Permissions
    // =====================

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    // =====================
    // Account Status
    // =====================

    isBlocked: {
      type: Boolean,
      default: false,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    savedPosts: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
      default: [],
    },

    // =====================
    // Security Fields
    // =====================

    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    lastLogin: Date,
  },
  {
    timestamps: true,
  },
);

// ─── Password Hashing Middleware ──────────────────────────────────────────────

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── toJSON Transform ─────────────────────────────────────────────────────────

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>;

    delete obj.password;
    delete obj.tokenVersion;
    delete obj.passwordResetToken;
    delete obj.passwordResetExpires;
    delete obj.emailVerificationToken;
    delete obj.emailVerificationExpires;
    delete obj.__v;

    obj.id = obj._id;
    delete obj._id;

    return obj;
  },
});

// ─── Model ────────────────────────────────────────────────────────────────────

const User = mongoose.model<IUserDocument, UserModel>("User", userSchema);

export default User;
