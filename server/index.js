import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync } from "fs";
import quizRoutes from "./routes/quiz.js";
import uploadRoutes from "./routes/upload.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure data & uploads dirs exist
const dataDir = path.join(__dirname, "data");
const uploadsDir = path.join(__dirname, "uploads");
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json({ limit: "50mb" }));
app.use("/uploads", express.static(uploadsDir));

// Routes
app.use("/api/quiz", quizRoutes);
app.use("/api/upload", uploadRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🧬 GenQ API running on http://localhost:${PORT}`);
  console.log(`   Mode: ${process.env.GEMINI_API_KEY ? "AI (Gemini)" : "Mock (Seed Data)"}`);
});
