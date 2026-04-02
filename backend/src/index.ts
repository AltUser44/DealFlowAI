import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import api from "./routes/api.js";
import authRouter from "./routes/auth.js";
import watchlistRouter from "./routes/watchlist.js";

const PORT = Number(process.env.PORT) || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.json({
    ok: true,
    service: "dealflow-api",
    mongo: ready ? "connected" : "disconnected",
  });
});

function requireDb(
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (mongoose.connection.readyState === 1) {
    next();
    return;
  }
  res.status(503).json({
    error:
      "Database not connected. Set MONGODB_URI in backend/.env, restart the API, and ensure MongoDB Atlas allows your IP.",
  });
}

app.use("/api/auth", authRouter);
app.use("/api/watchlist", requireDb, watchlistRouter);
app.use("/api", requireDb, api);
/** Also serve spec-style paths: /companies, /analyze, /deals */
app.use("/", requireDb, api);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.flatten() });
      return;
    }
    const message = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ error: message });
  }
);

async function connectMongo(): Promise<void> {
  if (!MONGODB_URI) {
    console.error(
      "[dealflow-api] MONGODB_URI is not set. API listens on :%s but /api/* will return 503 until MongoDB is configured.",
      PORT
    );
    return;
  }
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("[dealflow-api] MongoDB connected");
  } catch (e) {
    console.error("[dealflow-api] MongoDB connection failed:", e);
  }
}

app.listen(PORT, () => {
  console.log(`[dealflow-api] Listening on http://127.0.0.1:${PORT}`);
  void connectMongo();
});
