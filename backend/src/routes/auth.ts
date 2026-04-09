import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { signToken } from "../middleware/auth.js";

const router = Router();

const credentialsBody = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** POST /api/auth/register */
router.post("/register", async (req, res, next) => {
  try {
    const parsed = credentialsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    const { email, password } = parsed.data;

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash });

    const token = signToken({ userId: String(user._id), email: user.email });
    res.status(201).json({ token, email: user.email });
  } catch (e) {
    next(e);
  }
});

/** POST /api/auth/login */
router.post("/login", async (req, res, next) => {
  try {
    const parsed = credentialsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }
    const { email, password } = parsed.data;

    const user = await User.findOne({ email });
    if (!user) {
      // Same message for both cases — avoid user enumeration
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signToken({ userId: String(user._id), email: user.email });
    res.json({ token, email: user.email });
  } catch (e) {
    next(e);
  }
});

export default router;
