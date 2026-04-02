import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    /** bcrypt hash — never stored as plain text */
    passwordHash: { type: String, required: true },
    /** Watchlist: array of ticker symbols */
    watchlist: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
