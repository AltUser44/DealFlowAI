import "dotenv/config";
import mongoose from "mongoose";
import { app } from "./app.js";

const PORT = Number(process.env.PORT) || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

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
