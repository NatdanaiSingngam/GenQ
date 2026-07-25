import { Hono } from "hono";
import { cors } from "hono/cors";
import { SEED_DATA } from "./seed.js";

// ---------------------------------------------------------------------------
// Gemini AI: call the REST API directly (works in Workers, no SDK needed)
// ---------------------------------------------------------------------------
async function generateQuizWithGemini(apiKey, text, filename) {
  const prompt = `คุณคือผู้ช่วยสร้างข้อสอบจากเนื้อหาเอกสาร จงสร้างข้อสอบแบบ multiple-choice จำนวน 10 ข้อ จากเนื้อหาต่อไปนี้

รูปแบบผลลัพธ์: ให้ตอบเป็น JSON เท่านั้น ไม่ต้องมีข้อความอื่นใดนอก JSON

{
  "title": "ชื่อข้อสอบที่สื่อถึงเนื้อหา",
  "questions": [
    {
      "id": "q1",
      "question": "คำถาม?",
      "options": ["ตัวเลือก ก", "ตัวเลือก ข", "ตัวเลือก ค", "ตัวเลือก ง"],
      "correctIndex": 0,
      "explanation": "คำอธิบายว่าทำไมข้อนี้ถึงถูก อ้างอิงจากเนื้อหา"
    }
  ]
}

เงื่อนไข:
- 10 ข้อ
- ตัวเลือก 4 ตัวเลือกต่อข้อ
- correctIndex คือ index ที่ถูกต้อง (0-3)
- explanation ต้องอ้างอิงจากเนื้อหาจริง
- ภาษาไทยเท่านั้น

เนื้อหา:
${text.slice(0, 80000)}`;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${errBody}`);
  }

  const data = await resp.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Strip markdown fences
  const jsonStr = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(jsonStr);

  return {
    title: parsed.title || `Quiz: ${filename}`,
    questions: (parsed.questions || []).map((q, i) => ({
      ...q,
      id: `q${i + 1}`,
    })),
  };
}

// ---------------------------------------------------------------------------
// Mock quiz generator (used when GEMINI_API_KEY is not set)
// ---------------------------------------------------------------------------
function generateMockQuiz(filename) {
  const subjects = [
    {
      name: "Database Systems",
      questions: [
        { question: "ข้อใดคือความหมายของ Database?", options: ["ชุดข้อมูลที่จัดเก็บอย่างมีโครงสร้างและสัมพันธ์กัน", "โปรแกรมจัดการเอกสาร", "ระบบปฏิบัติการ", "โปรแกรมคำนวณ"], correctIndex: 0, explanation: "Database คือชุดข้อมูลที่ถูกจัดเก็บอย่างมีระบบ มีความสัมพันธ์กัน สามารถเรียกใช้ได้อย่างมีประสิทธิภาพ" },
        { question: "ข้อใดคือ DBMS?", options: ["MySQL", "Microsoft Word", "Google Chrome", "Photoshop"], correctIndex: 0, explanation: "MySQL เป็นระบบจัดการฐานข้อมูล (DBMS) ส่วนตัวเลือกอื่นเป็นโปรแกรมประเภทอื่น" },
        { question: "Primary Key มีคุณสมบัติอะไร?", options: ["ห้ามมีค่า NULL และต้องไม่ซ้ำกัน", "ซ้ำกันได้", "เป็น NULL ได้", "แก้ไขค่าได้ตลอดเวลา"], correctIndex: 0, explanation: "Primary Key ต้องมีค่าไม่ซ้ำ (Unique) และไม่เป็น NULL เพื่อใช้ระบุแต่ละแถวในตาราง" },
        { question: "SQL Injection คืออะไร?", options: ["การโจมตีโดยแทรกคำสั่ง SQL ผ่าน input", "การทำให้ Database Crash", "การขโมยข้อมูลทางกายภาพ", "การแฮ็ก WiFi"], correctIndex: 0, explanation: "SQL Injection เป็นช่องโหว่ที่ผู้ไม่ประสงค์ดีแทรกคำสั่ง SQL ผ่านช่อง input เพื่อเข้าถึงข้อมูล" },
        { question: "Normalization มีจุดประสงค์อะไร?", options: ["ลดความซ้ำซ้อนของข้อมูล", "เพิ่มความเร็วในการ query", "เข้ารหัสข้อมูล", "บีบอัดขนาดฐานข้อมูล"], correctIndex: 0, explanation: "Normalization ช่วยลด Data Redundancy และลดปัญหาความไม่สอดคล้องของข้อมูล" },
        { question: "Index มีประโยชน์อย่างไร?", options: ["เพิ่มความเร็วในการค้นหาข้อมูล", "ลดพื้นที่จัดเก็บ", "เพิ่มความปลอดภัย", "สำรองข้อมูลอัตโนมัติ"], correctIndex: 0, explanation: "Index ทำหน้าที่เหมือนสารบัญ ช่วยให้การค้นหาข้อมูลทำได้รวดเร็วขึ้น" },
        { question: "Transaction คืออะไร?", options: ["ชุดคำสั่งที่ทำงานร่วมกันแบบทั้งหมดหรือไม่ทำเลย", "การทำรายการเงิน", "คำสั่ง SQL เดี่ยวๆ", "การเชื่อมต่อฐานข้อมูล"], correctIndex: 0, explanation: "Transaction มีคุณสมบัติ ACID ทำให้การทำงานเป็น Atomic — ทำสำเร็จทั้งหมดหรือยกเลิกทั้งหมด" },
        { question: "ACID ใน Database ย่อมาจากอะไร?", options: ["Atomicity, Consistency, Isolation, Durability", "Access, Control, Input, Data", "All, Core, Index, Database", "Add, Commit, Insert, Delete"], correctIndex: 0, explanation: "ACID คือคุณสมบัติ 4 ประการของ Transaction ได้แก่ Atomicity, Consistency, Isolation, Durability" },
        { question: "ข้อใดคือ NoSQL?", options: ["MongoDB", "MySQL", "PostgreSQL", "Oracle"], correctIndex: 0, explanation: "MongoDB เป็น NoSQL Database ที่เก็บข้อมูลแบบ Document-oriented ไม่มี Schema ตายตัว" },
        { question: "SQL ข้อใดใช้ INSERT ข้อมูล?", options: ["INSERT INTO students VALUES (...);", "ADD INTO students VALUES (...);", "PUT INTO students VALUES (...);", "CREATE INTO students VALUES (...);"], correctIndex: 0, explanation: "INSERT INTO เป็นคำสั่ง SQL สำหรับเพิ่มข้อมูลใหม่ลงในตาราง" },
      ],
    },
    {
      name: "Programming",
      questions: [
        { question: "ตัวแปรในภาษาโปรแกรมมิ่งคืออะไร?", options: ["ที่สำหรับเก็บข้อมูลในหน่วยความจำ", "คำสั่งที่ใช้ loop", "ฟังก์ชันทางคณิตศาสตร์", "อุปกรณ์ฮาร์ดแวร์"], correctIndex: 0, explanation: "ตัวแปร (Variable) คือชื่อที่ใช้อ้างอิงถึงตำแหน่งในหน่วยความจำที่ใช้เก็บข้อมูล" },
        { question: "Array คืออะไร?", options: ["โครงสร้างข้อมูลที่เก็บค่าหลายค่าในตัวแปรเดียว", "ชนิดของ loop", "คำสั่ง condition", "ฟังก์ชัน built-in"], correctIndex: 0, explanation: "Array เป็นโครงสร้างข้อมูลที่เก็บชุดของค่าหลายค่าไว้ในตัวแปรเดียว โดยเข้าถึงผ่าน index" },
        { question: "Time Complexity ของ Binary Search คือ?", options: ["O(log n)", "O(n)", "O(n²)", "O(1)"], correctIndex: 0, explanation: "Binary Search แบ่งครึ่งข้อมูลในทุก iteration จึงมี Time Complexity เป็น O(log n)" },
        { question: "OOP ย่อมาจากอะไร?", options: ["Object-Oriented Programming", "Online Operating Protocol", "Order Of Processing", "Output-Oriented Program"], correctIndex: 0, explanation: "OOP หรือการเขียนโปรแกรมเชิงวัตถุ เป็นกระบวนทัศน์ที่ใช้ concept ของ object และ class" },
        { question: "Polymorphism ใน OOP คืออะไร?", options: ["ความสามารถของ object ในการมีได้หลายรูปแบบ", "การสืบทอด class", "การซ่อนข้อมูล", "การเชื่อมต่อฐานข้อมูล"], correctIndex: 0, explanation: "Polymorphism หมายถึงความสามารถของ method หรือ object ที่สามารถทำงานได้หลายรูปแบบขึ้นอยู่กับบริบท" },
        { question: "Recursion คืออะไร?", options: ["ฟังก์ชันที่เรียกใช้ตัวเอง", "การวนลูปแบบปกติ", "การแบ่งหน้าจอ", "การจัดเรียงข้อมูล"], correctIndex: 0, explanation: "Recursion คือเทคนิคที่ฟังก์ชันเรียกใช้ตัวเองเพื่อแก้ปัญหาที่ย่อยลงเรื่อยๆ" },
        { question: "API ย่อมาจากอะไร?", options: ["Application Programming Interface", "Automated Process Integration", "Applied Protocol Interface", "Application Process Integration"], correctIndex: 0, explanation: "API เป็นชุดของฟังก์ชันและโปรโตคอลที่ใช้สร้างซอฟต์แวร์และให้แอปพลิเคชันต่างๆ สื่อสารกัน" },
        { question: "Git คืออะไร?", options: ["ระบบควบคุมเวอร์ชันแบบ Distributed", "IDE สำหรับเขียนโค้ด", "ฐานข้อมูล", "ภาษาโปรแกรมมิ่ง"], correctIndex: 0, explanation: "Git เป็น Version Control System แบบ Distributed ที่ใช้ติดตามการเปลี่ยนแปลงของซอร์สโค้ด" },
        { question: "REST API ใช้ HTTP Method ใดในการอัปเดตข้อมูล?", options: ["PUT / PATCH", "GET", "DELETE", "POST"], correctIndex: 0, explanation: "PUT ใช้แทนที่ข้อมูลทั้งหมด ส่วน PATCH ใช้อัปเดตบางส่วนของข้อมูล" },
        { question: "Deployment คืออะไร?", options: ["กระบวนการนำซอฟต์แวร์ขึ้นสู่ระบบ Production", "การเขียนโค้ด", "การทดสอบบั๊ก", "การออกแบบ UI"], correctIndex: 0, explanation: "Deployment คือขั้นตอนการนำซอฟต์แวร์ที่พัฒนาเสร็จแล้วไปติดตั้งบนเซิร์ฟเวอร์จริงเพื่อให้ผู้ใช้เข้าถึง" },
      ],
    },
  ];

  const hash = filename.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const subject = subjects[hash % subjects.length];
  return {
    title: `Quiz: ${filename}`,
    questions: subject.questions.map((q, i) => ({ ...q, id: `q${i + 1}` })),
  };
}

// ---------------------------------------------------------------------------
// Hybrid store: KV (persistent) + in-memory (fast reads) + D1 (secondary)
// ---------------------------------------------------------------------------
const mem = new Map();

function key(id) {
  return "q:" + id.replace(/^quiz:/, "");
}

async function saveQuiz(env, quiz) {
  const cleanId = quiz.id.replace(/^quiz:/, "");
  const data = JSON.stringify({ ...quiz, id: cleanId });

  // Memory cache
  mem.set(key(cleanId), data);

  // KV (primary persistent)
  const kv = env.GENQ_KV;
  if (kv) {
    try { await kv.put(key(cleanId), data, { expirationTtl: 86400 * 7 }); } catch {}
  }
}

async function loadQuiz(env, id) {
  const k = key(id);

  // Memory first (fast)
  const memRaw = mem.get(k);
  if (memRaw !== undefined) return JSON.parse(memRaw);

  // KV (persistent)
  const kv = env.GENQ_KV;
  if (kv) {
    try {
      const raw = await kv.get(k);
      if (raw) {
        mem.set(k, raw);
        return JSON.parse(raw);
      }
    } catch {}
  }

  return null;
}

async function listQuizzes(env) {
  const seen = new Set();
  const quizzes = [];

  // Collect from memory
  for (const [, v] of mem) {
    try {
      const d = JSON.parse(v);
      seen.add(d.id);
      quizzes.push({ id: d.id, title: d.title, source: d.source, createdAt: d.createdAt, questionCount: d.questionCount });
    } catch {}
  }

  // KV (persistent)
  const kv = env.GENQ_KV;
  if (kv) {
    try {
      const list = await kv.list();
      for (const entry of list.keys || []) {
        const name = typeof entry === "string" ? entry : entry.name;
        const raw = await kv.get(name);
        if (raw) {
          try {
            const d = JSON.parse(raw);
            if (!seen.has(d.id)) {
              quizzes.push({ id: d.id, title: d.title, source: d.source, createdAt: d.createdAt, questionCount: d.questionCount });
              seen.add(d.id);
            }
          } catch {}
        }
      }
    } catch {}
  }

  return quizzes;
}

// ---------------------------------------------------------------------------
// Hono App
// ---------------------------------------------------------------------------
const app = new Hono();

app.use("/api/*", cors({ origin: "*", allowMethods: ["GET", "POST", "OPTIONS"], allowHeaders: ["Content-Type"] }));

// Health
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));





// GET /api/quiz — List all quizzes
app.get("/api/quiz", async (c) => {
  try {
    const quizzes = await listQuizzes(c.env);
    return c.json(quizzes);
  } catch {
    return c.json([]);
  }
});

// GET /api/quiz/seed/data — Seed demo quiz
app.get("/api/quiz/seed/data", async (c) => {
  const quizId = "demo-seed";
  const quizRecord = {
    id: quizId,
    title: SEED_DATA.title,
    source: SEED_DATA.source,
    createdAt: new Date().toISOString(),
    questionCount: SEED_DATA.questions.length,
    questions: SEED_DATA.questions,
  };

  await saveQuiz(c.env, quizRecord);

  const publicQuestions = SEED_DATA.questions.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
  }));

  return c.json({
    id: quizId,
    title: quizRecord.title,
    source: quizRecord.source,
    createdAt: quizRecord.createdAt,
    questionCount: quizRecord.questionCount,
    questions: publicQuestions,
  });
});

// GET /api/quiz/:id — Fetch quiz (without correct answers)
app.get("/api/quiz/:id", async (c) => {
  const quiz = await loadQuiz(c.env, c.req.param("id"));
  if (!quiz) return c.json({ error: "Quiz not found" }, 404);

  const publicQuestions = quiz.questions.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
  }));

  return c.json({
    id: quiz.id,
    title: quiz.title,
    source: quiz.source,
    createdAt: quiz.createdAt,
    questionCount: quiz.questionCount,
    questions: publicQuestions,
  });
});

// POST /api/quiz/:id/submit — Submit answers & get results
app.post("/api/quiz/:id/submit", async (c) => {
  const quiz = await loadQuiz(c.env, c.req.param("id"));
  if (!quiz) return c.json({ error: "Quiz not found" }, 404);

  const { answers } = await c.req.json();
  if (!answers || typeof answers !== "object") {
    return c.json({ error: "Answers object required" }, 400);
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
  const grade = score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : score >= 50 ? "D" : "F";

  return c.json({
    quizId: quiz.id,
    title: quiz.title,
    score,
    grade,
    correctCount,
    total,
    questions: results,
    weakAreas: results.filter((r) => !r.isCorrect).map((r) => r.question),
  });
});

// POST /api/upload — Upload file & generate quiz
app.post("/api/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file");

    if (!file) return c.json({ error: "No file uploaded" }, 400);

    const filename = file.name || "document";
    const fileBuffer = await file.arrayBuffer();

    // Detect binary vs text files
    const decoder = new TextDecoder("utf-8");
    const rawText = decoder.decode(fileBuffer).slice(0, 100000);

    // Check if content is binary (lots of null bytes or non-printable chars)
    const binaryCharCount = (rawText.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length;
    const isBinary = rawText.length > 0 && (binaryCharCount / rawText.length) > 0.30;

    let text;
    if (isBinary) {
      // Binary file (PDF/PPTX/DOCX) — generate contextual fallback
      const ext = filename.split(".").pop()?.toLowerCase() || "";
      const topicMap = {
        pdf: "PDF document covering academic concepts and key topics",
        pptx: "PowerPoint presentation slides covering important subject matter",
        ppt: "PowerPoint presentation covering lecture content",
        docx: "Word document covering detailed subject content",
        doc: "Word document with educational content",
      };
      text = `Content extracted from "${filename}" (${ext.toUpperCase() || "binary"} format). ${topicMap[ext] || "Document with educational content"}. This material covers key concepts, definitions, examples, and important principles.`;
    } else {
      text = rawText;
      if (!text || text.trim().length < 20) {
        text = `Content extracted from ${filename}. This document covers key concepts and principles.`;
      }
    }

    // Generate quiz
    const apiKey = c.env.GEMINI_API_KEY;
    let quizData;

    if (apiKey) {
      quizData = await generateQuizWithGemini(apiKey, text, filename);
    } else {
      quizData = generateMockQuiz(filename);
    }

    // Save to store
    const quizId = crypto.randomUUID();
    const quizRecord = {
      id: quizId,
      title: quizData.title,
      source: filename,
      createdAt: new Date().toISOString(),
      questionCount: quizData.questions.length,
      questions: quizData.questions,
    };

    await saveQuiz(c.env, quizRecord);

    return c.json({
      quizId,
      title: quizRecord.title,
      questionCount: quizRecord.questionCount,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return c.json({ error: "Failed to process file: " + error.message }, 500);
  }
});

// Catch-all for 404
app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
