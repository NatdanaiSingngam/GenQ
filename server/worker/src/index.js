import { Hono } from "hono";
import { cors } from "hono/cors";
import { SignJWT, jwtVerify } from "jose";
import { SEED_DATA } from "./seed.js";

// ---------------------------------------------------------------------------
// AI Quiz Generation — Workers AI (primary) + Gemini (secondary) + Mock (fallback)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Quiz Type Configuration
// ---------------------------------------------------------------------------
function buildQuizPrompt(config, text) {
  const parts = [];
  if (config.multipleChoice > 0) parts.push(`- แบบเลือกตอบ (Multiple Choice) ${config.multipleChoice} ข้อ: มี 4 ตัวเลือก`);
  if (config.trueFalse > 0) parts.push(`- แบบถูก-ผิด (True-False) ${config.trueFalse} ข้อ: มี 2 ตัวเลือก (ถูก/ผิด)`);
  if (config.completion > 0) parts.push(`- แบบเติมคำ (Completion) ${config.completion} ข้อ: มีช่องว่างให้เติมคำ`);
  if (config.matching > 0) parts.push(`- แบบจับคู่ (Matching) ${config.matching} ข้อ: จับคู่ซ้าย-ขวา อย่างละ 3-5 รายการ`);
  if (config.shortAnswer > 0) parts.push(`- แบบตอบสั้น (Short Answer) ${config.shortAnswer} ข้อ: ตอบสั้นๆ 1-2 คำ`);
  if (config.essay > 0) parts.push(`- แบบเขียนตอบ (Essay) ${config.essay} ข้อ: เขียนอธิบาย 1 ย่อหน้า`);

  const typeDesc = parts.length > 0 ? parts.join("\n") : "- แบบเลือกตอบ (Multiple Choice) 5 ข้อ";

  const total = (config.multipleChoice || 0) + (config.trueFalse || 0) + (config.completion || 0) + (config.shortAnswer || 0) + (config.matching || 0) + (config.essay || 0);

  // Freshness instruction: ask for different questions when re-uploading same content
  const round = config._r || 0;
  const freshnessNote = round > 0
    ? `\n\n⚠️ IMPORTANT: This is round ${round} for this content. DO NOT repeat questions from previous rounds. Generate completely NEW and DIFFERENT questions. At most 5 out of ${total} questions may overlap with previous rounds.`
    : "";

  return `สร้างข้อสอบหลากหลายประเภทจากเนื้อหาต่อไปนี้

ประเภทข้อสอบที่ต้องการ:
${typeDesc}${freshnessNote}

รูปแบบ JSON:
{
  "title": "ชื่อข้อสอบที่สื่อถึงเนื้อหา",
  "questions": [
    {
      "type": "multiple-choice",
      "question": "คำถาม?",
      "options": ["ก", "ข", "ค", "ง"],
      "correctIndex": 0,
      "explanation": "เหตุผล"
    },
    {
      "type": "true-false",
      "question": "ข้อความนี้...",
      "correctIndex": 0,
      "explanation": "เหตุผล"
    },
    {
      "type": "completion",
      "question": "ข้อความ ___ เติมคำ",
      "answer": "คำตอบที่ถูก",
      "acceptableAnswers": ["คำตอบ1", "คำตอบ2"],
      "explanation": "เหตุผล"
    },
    {
      "type": "matching",
      "question": "จับคู่...",
      "pairs": [{"left": "ซ้าย1", "right": "ขวา1"}, {"left": "ซ้าย2", "right": "ขวา2"}],
      "explanation": "เหตุผล"
    },
    {
      "type": "short-answer",
      "question": "คำถามสั้น?",
      "answer": "คำตอบ",
      "keywords": ["คีย์1", "คีย์2"],
      "explanation": "เหตุผล"
    },
    {
      "type": "essay",
      "question": "อธิบาย...",
      "guidelines": ["ประเด็นที่ควรมี", "แนวคิดสำคัญ"],
      "explanation": "แนวคำตอบ"
    }
  ]
}

ภาษาไทยเท่านั้น จำนวนข้อตามที่กำหนด

เนื้อหา:`;
}

function parseAIResponse(rawText, filename) {
  const jsonStr = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(jsonStr);
  return {
    title: parsed.title || `Quiz: ${filename}`,
    questions: (parsed.questions || []).map((q, i) => {
      const base = { ...q, id: `q${i + 1}` };
      // Default type if missing
      if (!base.type) base.type = "multiple-choice";
      // Ensure options for MC/TF
      if ((base.type === "multiple-choice" || base.type === "true-false") && !base.options) {
        base.options = base.type === "true-false" ? ["ถูก", "ผิด"] : ["ก", "ข", "ค", "ง"];
      }
      return base;
    }),
  };
}

// Map config fields to question types in AI response
const CONFIG_TO_TYPE = {
  multipleChoice: "multiple-choice",
  trueFalse: "true-false",
  completion: "completion",
  matching: "matching",
  shortAnswer: "short-answer",
  essay: "essay",
};

function filterQuestionsByConfig(quizData, config) {
  if (!config || !quizData?.questions) return quizData;
  // Build set of allowed types (only types with count > 0)
  const allowedTypes = new Set();
  for (const [key, type] of Object.entries(CONFIG_TO_TYPE)) {
    if ((config[key] || 0) > 0) allowedTypes.add(type);
  }
  if (allowedTypes.size === 0) return quizData;
  // Filter: keep only questions whose type is in allowedTypes
  const filtered = quizData.questions.filter((q) => allowedTypes.has(q.type));
  return { ...quizData, questions: filtered };
}

async function generateQuizWithWorkersAI(env, text, filename, config) {
  const ai = env.AI;
  if (!ai) throw new Error("AI binding not available");

  const prompt = buildQuizPrompt(config || {}, text);

  const response = await ai.run("@cf/meta/llama-3.2-3b-instruct", {
    messages: [
      { role: "system", content: "You are a quiz generator. Always respond with valid JSON only." },
      { role: "user", content: `${prompt}\n\n${text.slice(0, 1500)}` },
    ],
    max_tokens: 4096,
    temperature: 0.7,
  });

  const rawText = response?.choices?.[0]?.message?.content || response?.response || "";
  if (!rawText) throw new Error("Empty AI response");

  const quizData = parseAIResponse(rawText, filename);
  return filterQuestionsByConfig(quizData, config);
}

async function generateQuizWithGemini(apiKey, text, filename, config) {
  const prompt = `${buildQuizPrompt(config || {}, text)}\n\n${text.slice(0, 3000)}`;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
  if (!rawText) throw new Error("Empty Gemini response");

  const quizData = parseAIResponse(rawText, filename);
  return filterQuestionsByConfig(quizData, config);
}

// ---------------------------------------------------------------------------
// Mock quiz generator (used when GEMINI_API_KEY is not set)
// ---------------------------------------------------------------------------
function generateMockQuiz(filename, config) {
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
  const baseQuestions = subject.questions.map((q, i) => ({ ...q, id: `q${i + 1}`, type: "multiple-choice" }));

  // If config says true-false, convert some
  const totalAsked = (config?.multipleChoice || 0) + (config?.trueFalse || 0) + (config?.completion || 0) + (config?.matching || 0) + (config?.shortAnswer || 0) + (config?.essay || 0);
  if (totalAsked < 1) {
    return { title: `Quiz: ${filename}`, questions: baseQuestions.slice(0, 5) };
  }

  // Build mixed types from mock data
  const result = [];
  let idx = 0;

  // Multiple Choice
  for (let i = 0; i < (config?.multipleChoice || 0); i++) {
    const q = baseQuestions[idx % baseQuestions.length];
    result.push({ ...q, id: `q${result.length + 1}` });
    idx++;
  }

  // True-False (convert from MC)
  for (let i = 0; i < (config?.trueFalse || 0); i++) {
    const q = baseQuestions[idx % baseQuestions.length];
    result.push({
      id: `q${result.length + 1}`,
      type: "true-false",
      question: `${q.question} — ข้อความนี้ถูกต้องหรือไม่?`,
      options: ["ถูก", "ผิด"],
      correctIndex: Math.random() > 0.5 ? 0 : 1,
      explanation: q.explanation,
    });
    idx++;
  }

  // Completion
  for (let i = 0; i < (config?.completion || 0); i++) {
    const q = baseQuestions[idx % baseQuestions.length];
    result.push({
      id: `q${result.length + 1}`,
      type: "completion",
      question: q.question.replace(/[ะาเแโใไ]/g, "___") || "ให้เติมคำที่ถูกต้องในช่องว่าง",
      answer: q.options?.[0] || "คำตอบ",
      acceptableAnswers: [q.options?.[0] || "คำตอบ"],
      explanation: q.explanation,
    });
    idx++;
  }

  // Short Answer
  for (let i = 0; i < (config?.shortAnswer || 0); i++) {
    const q = baseQuestions[idx % baseQuestions.length];
    result.push({
      id: `q${result.length + 1}`,
      type: "short-answer",
      question: `${q.question} (ตอบสั้นๆ)`,
      answer: q.options?.[0] || "คำตอบ",
      keywords: [(q.options?.[0] || "").substring(0, 5)],
      explanation: q.explanation,
    });
    idx++;
  }

  // Essay
  for (let i = 0; i < (config?.essay || 0); i++) {
    result.push({
      id: `q${result.length + 1}`,
      type: "essay",
      question: `อธิบายเกี่ยวกับ ${subject.name} และประยุกต์ใช้ในชีวิตจริง พร้อมยกตัวอย่างประกอบ`,
      guidelines: ["อธิบายแนวคิดหลัก", "ยกตัวอย่างประกอบ", "อธิบายการประยุกต์ใช้"],
      explanation: "คำตอบควรครอบคลุมแนวคิดหลัก พร้อมตัวอย่างและประยุกต์ใช้",
    });
  }

  // Matching (generate pairs from base questions)
  for (let i = 0; i < (config?.matching || 0); i++) {
    const leftItems = ["แนวคิด A", "แนวคิด B", "แนวคิด C", "แนวคิด D"];
    const rightItems = ["คำอธิบาย A", "คำอธิบาย B", "คำอธิบาย C", "คำอธิบาย D"];
    result.push({
      id: `q${result.length + 1}`,
      type: "matching",
      question: `จับคู่${subject.name}ต่อไปนี้ให้ถูกต้อง`,
      pairs: leftItems.map((l, idx) => ({ left: l, right: rightItems[idx] })),
      explanation: "การจับคู่ที่ถูกต้องคือ A–A, B–B, C–C, D–D",
    });
  }

  return { title: `Quiz: ${filename}`, questions: result.slice(0, totalAsked) };
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

app.use("/api/*", cors({ origin: "*", allowMethods: ["GET", "POST", "OPTIONS"], allowHeaders: ["Content-Type", "Authorization"], exposeHeaders: ["Content-Length"] }));

// ---------------------------------------------------------------------------
// JWT Helpers
// ---------------------------------------------------------------------------
function getJWTSecret(env) {
  return new TextEncoder().encode(env.JWT_SECRET || "genq-default-secret-pLEASE-CHANGE");
}

// Health
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// ---------------------------------------------------------------------------
// Google OAuth — Login
// ---------------------------------------------------------------------------

// GET /api/auth/google — Redirect to Google consent
app.get("/api/auth/google", (c) => {
  const redirectUri = c.env.GOOGLE_REDIRECT_URI || "https://genq-api.banana-by-monky.workers.dev/api/auth/google/callback";
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
  })}`;
  return c.redirect(url);
});

// GET /api/auth/google/callback — Handle Google redirect
app.get("/api/auth/google/callback", async (c) => {
  const { code } = c.req.query();
  if (!code) return c.json({ error: "Missing authorization code" }, 400);

  const redirectUri = c.env.GOOGLE_REDIRECT_URI || "https://genq-api.banana-by-monky.workers.dev/api/auth/google/callback";
  const frontendUrl = c.env.FRONTEND_URL || "https://genq-dlg.pages.dev";

  // Exchange auth code for tokens
  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResp.ok) {
    const errText = await tokenResp.text();
    return c.json({ error: "Token exchange failed: " + errText }, 400);
  }

  const tokens = await tokenResp.json();

  // Decode ID token to get user info
  let userInfo;
  try {
    const parts = tokens.id_token.split(".");
    const payload = JSON.parse(atob(parts[1]));
    userInfo = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name || payload.email?.split("@")[0] || "User",
      picture: payload.picture || "",
    };
  } catch {
    return c.json({ error: "Failed to decode ID token" }, 400);
  }

  // Create JWT
  const jwt = await new SignJWT(userInfo)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(getJWTSecret(c.env));

  // Redirect back to frontend with token
  return c.redirect(`${frontendUrl}?token=${jwt}`);
});

// GET /api/auth/me — Get current user from JWT (or null)
app.get("/api/auth/me", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ user: null });
  }
  try {
    const { payload } = await jwtVerify(auth.slice(7), getJWTSecret(c.env));
    return c.json({
      user: {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      },
    });
  } catch {
    return c.json({ user: null });
  }
});

// POST /api/auth/logout — Logout (frontend handles token removal; just ack)
app.post("/api/auth/logout", (c) => c.json({ success: true }));

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

// GET /api/quiz/:id — Fetch quiz (without answers)
app.get("/api/quiz/:id", async (c) => {
  const quiz = await loadQuiz(c.env, c.req.param("id"));
  if (!quiz) return c.json({ error: "Quiz not found" }, 404);

  const publicQuestions = quiz.questions.map((q) => {
    const base = { id: q.id, type: q.type || "multiple-choice", question: q.question };
    switch (q.type) {
      case "true-false":
        base.options = ["ถูก", "ผิด"];
        break;
      case "multiple-choice":
        base.options = q.options || [];
        break;
      case "matching":
        if (q.pairs) {
          base.leftColumn = q.pairs.map((p) => ({ id: p.left, text: p.left }));
          base.rightColumn = q.pairs.map((p) => ({ id: p.right, text: p.right })).sort(() => Math.random() - 0.5);
        }
        break;
      case "completion":
        base.hasBlank = true;
        break;
      case "short-answer":
        break;
      case "essay":
        base.guidelines = q.guidelines || [];
        break;
    }
    return base;
  });

  return c.json({
    id: quiz.id,
    title: quiz.title,
    source: quiz.source,
    createdAt: quiz.createdAt,
    questionCount: quiz.questionCount,
    questions: publicQuestions,
  });
});

// POST /api/quiz/:id/submit — Submit answers & get results (handles all types)
app.post("/api/quiz/:id/submit", async (c) => {
  const quiz = await loadQuiz(c.env, c.req.param("id"));
  if (!quiz) return c.json({ error: "Quiz not found" }, 404);

  const { answers } = await c.req.json();
  if (!answers || typeof answers !== "object") {
    return c.json({ error: "Answers object required" }, 400);
  }

  let correctCount = 0;
  let autoGradeCount = 0;

  const results = quiz.questions.map((q) => {
    const userAnswer = answers[q.id];
    let isCorrect = false;
    let autoGrade = true;

    switch (q.type || "multiple-choice") {
      case "multiple-choice":
      case "true-false":
        isCorrect = userAnswer === q.correctIndex;
        break;
      case "completion": {
        const userText = (userAnswer || "").trim().toLowerCase();
        if (!userText) { isCorrect = false; break; }
        const acceptable = (q.acceptableAnswers || [q.answer]).map((a) => a.trim().toLowerCase());
        isCorrect = acceptable.some((a) => userText.includes(a) || a.includes(userText));
        break;
      }
      case "short-answer": {
        const userText = (userAnswer || "").trim().toLowerCase();
        const kws = (q.keywords || [q.answer || ""]).map((k) => k.trim().toLowerCase());
        isCorrect = kws.some((kw) => userText.includes(kw));
        break;
      }
      case "matching":
        if (userAnswer && typeof userAnswer === "object") {
          const pairs = q.pairs || [];
          isCorrect = pairs.every((p) => userAnswer[p.left] === p.right);
        }
        break;
      case "essay":
        autoGrade = false;
        isCorrect = (userAnswer || "").trim().length > 20;
        break;
      default:
        isCorrect = userAnswer === q.correctIndex;
    }

    if (isCorrect && autoGrade) correctCount++;
    if (autoGrade) autoGradeCount++;

    return {
      id: q.id,
      type: q.type || "multiple-choice",
      question: q.question,
      options: q.options,
      pairs: q.pairs,
      answer: q.answer,
      acceptableAnswers: q.acceptableAnswers,
      keywords: q.keywords,
      guidelines: q.guidelines,
      correctIndex: q.correctIndex,
      userAnswer: userAnswer ?? null,
      isCorrect,
      autoGrade,
      explanation: q.explanation,
    };
  });

  const total = quiz.questions.length;
  const score = autoGradeCount > 0 ? Math.round((correctCount / autoGradeCount) * 100) : 0;
  const pendingCount = results.filter((r) => !r.autoGrade).length;
  const grade = pendingCount > 0 ? "รอตรวจ" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : score >= 50 ? "D" : "F";

  return c.json({
    quizId: quiz.id,
    title: quiz.title,
    score,
    grade,
    correctCount,
    total,
    autoGradeCount,
    pendingCount,
    questions: results,
    weakAreas: results.filter((r) => !r.isCorrect && r.autoGrade).map((r) => r.question),
    pendingQuestions: results.filter((r) => !r.autoGrade).map((r) => ({ id: r.id, question: r.question })),
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

    // Read quiz config from formData (question type counts)
    let config = {};
    try {
      const configStr = formData.get("config");
      if (configStr) config = JSON.parse(configStr);
    } catch {}
    // Strip internal fields before counting
    const { _r, ...cleanConfig } = config;
    config = cleanConfig;
    const totalAsked = Object.values(config).reduce((s, v) => s + (parseInt(v) || 0), 0);
    if (totalAsked < 1) config = { multipleChoice: 5 };

    // Generate quiz — Workers AI (freshest, no quota worries)
    let quizData = null;
    let genError = null;

    // 1st try: Workers AI (built-in, free 10k req/day)
    if (c.env.AI) {
      try {
        quizData = await generateQuizWithWorkersAI(c.env, text, filename, config);
        console.log("AI source: Workers AI");
      } catch (e) {
        genError = e;
        console.error("Workers AI failed:", e.message.slice(0, 80));
      }
    }

    // 2nd try: Gemini API (if Workers AI failed)
    if (!quizData && c.env.GEMINI_API_KEY) {
      try {
        quizData = await generateQuizWithGemini(c.env.GEMINI_API_KEY, text, filename, config);
        console.log("AI source: Gemini");
      } catch (e) {
        genError = e;
        console.error("Gemini failed:", e.message.slice(0, 80));
      }
    }

    // 3rd fallback: Mock quiz
    if (!quizData) {
      console.error("All AI failed, using mock. Last error:", genError?.message.slice(0, 60));
      quizData = generateMockQuiz(filename, config);
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
