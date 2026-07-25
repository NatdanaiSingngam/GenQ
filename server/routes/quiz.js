import { Router } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const dataDir = path.join(__dirname, "..", "data");

function loadQuiz(id) {
  const filePath = path.join(dataDir, `${id}.json`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

// GET /api/quiz/:id — Fetch quiz by ID (without exposing correct answers)
router.get("/:id", (req, res) => {
  const quiz = loadQuiz(req.params.id);
  if (!quiz) {
    return res.status(404).json({ error: "Quiz not found" });
  }

  // Return quiz without correctIndex for clean client
  const publicQuestions = quiz.questions.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
  }));

  res.json({
    id: quiz.id,
    title: quiz.title,
    source: quiz.source,
    createdAt: quiz.createdAt,
    questionCount: quiz.questionCount,
    questions: publicQuestions,
  });
});

// POST /api/quiz/:id/submit — Submit answers & get results
router.post("/:id/submit", (req, res) => {
  const quiz = loadQuiz(req.params.id);
  if (!quiz) {
    return res.status(404).json({ error: "Quiz not found" });
  }

  const { answers } = req.body; // { q1: 0, q2: 2, ... }
  if (!answers || typeof answers !== "object") {
    return res.status(400).json({ error: "Answers object required" });
  }

  let correctCount = 0;
  const results = quiz.questions.map((q) => {
    const userAnswer = answers[q.id];
    const isCorrect = userAnswer === q.correctIndex;
    if (isCorrect) correctCount++;
    return {
      id: q.id,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      userAnswer: userAnswer ?? null,
      isCorrect,
      explanation: q.explanation,
    };
  });

  const total = quiz.questions.length;
  const score = Math.round((correctCount / total) * 100);
  const grade =
    score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : score >= 50 ? "D" : "F";

  res.json({
    quizId: quiz.id,
    title: quiz.title,
    score,
    grade,
    correctCount,
    total,
    questions: results,
    weakAreas: results
      .filter((r) => !r.isCorrect)
      .map((r) => r.question),
  });
});

// GET /api/seed — Get seed quiz (pre-made demo data)
router.get("/seed/data", (_req, res) => {
  const seedPath = path.join(dataDir, "seed.json");
  if (!existsSync(seedPath)) {
    return res.status(404).json({ error: "Seed data not found" });
  }
  const seed = JSON.parse(readFileSync(seedPath, "utf-8"));

  // Save as a real quiz
  const quizId = "demo-seed";
  const quizRecord = {
    id: quizId,
    title: seed.title,
    source: seed.source || "สไลด์ตัวอย่าง — ระบบฐานข้อมูล บทที่ 1",
    createdAt: new Date().toISOString(),
    questionCount: seed.questions.length,
    questions: seed.questions,
  };

  const filePath = path.join(dataDir, `${quizId}.json`);
  writeFileSync(filePath, JSON.stringify(quizRecord, null, 2));

  const publicQuestions = seed.questions.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
  }));

  res.json({
    id: quizId,
    title: quizRecord.title,
    source: quizRecord.source,
    createdAt: quizRecord.createdAt,
    questionCount: quizRecord.questionCount,
    questions: publicQuestions,
  });
});

// GET /api/quiz — List all quizzes (summary only)
router.get("/", (_req, res) => {
  try {
    const files = readdirSync(dataDir).filter((f) => f.endsWith(".json") && f !== "seed.json");
    const quizzes = files.map((f) => {
      const data = JSON.parse(readFileSync(path.join(dataDir, f), "utf-8"));
      return {
        id: data.id,
        title: data.title,
        source: data.source,
        createdAt: data.createdAt,
        questionCount: data.questionCount,
      };
    });
    res.json(quizzes);
  } catch {
    res.json([]);
  }
});

export default router;
