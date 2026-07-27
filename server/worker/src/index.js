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

⚠️ IMPORTANT: ต้องกระจายข้อถูก (correctIndex) ให้หลากหลาย ไม่ใช่เป็น 0 หรือตัวเลือกแรกทุกข้อ ให้สลับไปมาเช่น ตัวเลือก ข, ค, ง, ก สลับกัน
⚠️ สำหรับ true-false: ต้องสลับกันระหว่าง correctIndex: 0 (ถูก) กับ correctIndex: 1 (ผิด) ไม่ใช่ถูกทุกข้อ

ประเภทข้อสอบที่ต้องการ:
${typeDesc}${freshnessNote}

รูปแบบ JSON (IMPORTANT: สลับข้อที่ถูกต้องให้กระจายตามตัวเลือกต่างๆ ไม่ใช่ 0 ทุกข้อ):
{
  "title": "ชื่อข้อสอบที่สื่อถึงเนื้อหา",
  "questions": [
    {
      "type": "multiple-choice",
      "question": "คำถาม?",
      "options": ["ก", "ข", "ค", "ง"],
      "correctIndex": 2,
      "explanation": "เหตุผล"
    },
    {
      "type": "true-false",
      "question": "ข้อความนี้...",
      "correctIndex": 1,
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

const TYPE_TO_CONFIG = Object.fromEntries(
  Object.entries(CONFIG_TO_TYPE).map(([k, v]) => [v, k])
);

function filterQuestionsByConfig(quizData, config) {
  if (!config || !quizData?.questions) return quizData;

  // Build type -> count mapping from config
  const requests = {};
  let totalRequested = 0;
  for (const [key, type] of Object.entries(CONFIG_TO_TYPE)) {
    const count = parseInt(config[key]) || 0;
    if (count > 0) {
      requests[type] = count;
      totalRequested += count;
    }
  }
  if (totalRequested === 0) return quizData;

  // 1) Group AI questions by type, keeping only requested types
  const byType = {};
  for (const q of quizData.questions) {
    const t = q.type || "multiple-choice";
    if (requests[t]) {
      if (!byType[t]) byType[t] = [];
      byType[t].push(q);
    }
  }

  // 2) Take at most the requested count per type (truncate excess)
  const result = [];
  for (const [type, requested] of Object.entries(requests)) {
    const available = byType[type] || [];
    result.push(...available.slice(0, requested));
  }

  // 3) Overall cap (in case total exceeds requested due to off-by-one)
  return { ...quizData, questions: result.slice(0, totalRequested) };
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
// Shared large mock question bank (80+ per subject, used by both mock generators)
// ---------------------------------------------------------------------------
const MOCK_SUBJECTS = [
  {
    name: "Database Systems",
    questions: [
      { q: "ข้อใดคือความหมายของ Database?", opts: ["ชุดข้อมูลที่จัดเก็บอย่างมีโครงสร้างและสัมพันธ์กัน", "โปรแกรมจัดการเอกสาร", "ระบบปฏิบัติการ", "โปรแกรมคำนวณ"], ci: 3, exp: "Database คือชุดข้อมูลที่ถูกจัดเก็บอย่างมีระบบ มีความสัมพันธ์กัน สามารถเรียกใช้ได้อย่างมีประสิทธิภาพ" },
      { q: "ข้อใดคือ DBMS?", opts: ["MySQL", "Microsoft Word", "Google Chrome", "Photoshop"], ci: 3, exp: "MySQL เป็นระบบจัดการฐานข้อมูล (DBMS) ส่วนตัวเลือกอื่นเป็นโปรแกรมประเภทอื่น" },
      { q: "Primary Key มีคุณสมบัติอะไร?", opts: ["ห้ามมีค่า NULL และต้องไม่ซ้ำกัน", "ซ้ำกันได้", "เป็น NULL ได้", "แก้ไขค่าได้ตลอดเวลา"], ci: 0, exp: "Primary Key ต้องมีค่าไม่ซ้ำ (Unique) และไม่เป็น NULL เพื่อใช้ระบุแต่ละแถวในตาราง" },
      { q: "SQL Injection คืออะไร?", opts: ["การโจมตีโดยแทรกคำสั่ง SQL ผ่าน input", "การทำให้ Database Crash", "การขโมยข้อมูลทางกายภาพ", "การแฮ็ก WiFi"], ci: 3, exp: "SQL Injection เป็นช่องโหว่ที่ผู้ไม่ประสงค์ดีแทรกคำสั่ง SQL ผ่านช่อง input" },
      { q: "Normalization มีจุดประสงค์อะไร?", opts: ["ลดความซ้ำซ้อนของข้อมูล", "เพิ่มความเร็วในการ query", "เข้ารหัสข้อมูล", "บีบอัดขนาดฐานข้อมูล"], ci: 3, exp: "Normalization ช่วยลด Data Redundancy และลดปัญหาความไม่สอดคล้องของข้อมูล" },
      { q: "Index มีประโยชน์อย่างไร?", opts: ["เพิ่มความเร็วในการค้นหาข้อมูล", "ลดพื้นที่จัดเก็บ", "เพิ่มความปลอดภัย", "สำรองข้อมูลอัตโนมัติ"], ci: 0, exp: "Index ทำหน้าที่เหมือนสารบัญ ช่วยให้การค้นหาข้อมูลทำได้รวดเร็วขึ้น" },
      { q: "Transaction คืออะไร?", opts: ["ชุดคำสั่งที่ทำงานร่วมกันแบบทั้งหมดหรือไม่ทำเลย", "การทำรายการเงิน", "คำสั่ง SQL เดี่ยวๆ", "การเชื่อมต่อฐานข้อมูล"], ci: 3, exp: "Transaction มีคุณสมบัติ ACID — ทำสำเร็จทั้งหมดหรือยกเลิกทั้งหมด" },
      { q: "ACID ย่อมาจากอะไร?", opts: ["Atomicity, Consistency, Isolation, Durability", "Access, Control, Input, Data", "All, Core, Index, Database", "Add, Commit, Insert, Delete"], ci: 3, exp: "Atomicity, Consistency, Isolation, Durability" },
      { q: "ข้อใดคือ NoSQL?", opts: ["MongoDB", "MySQL", "PostgreSQL", "Oracle"], ci: 1, exp: "MongoDB เป็น NoSQL แบบ Document-oriented" },
      { q: "SQL ใดใช้ INSERT?", opts: ["INSERT INTO students VALUES (...);", "ADD INTO...", "PUT INTO...", "CREATE INTO..."], ci: 2, exp: "INSERT INTO เป็นคำสั่ง SQL สำหรับเพิ่มข้อมูลใหม่" },
      { q: "Foreign Key คืออะไร?", opts: ["คีย์ที่อ้างอิงไปยัง Primary Key ของอีกตาราง", "คีย์หลักของตาราง", "คีย์ที่สามารถเป็น NULL", "คีย์ที่ใช้จัดเรียงข้อมูล"], ci: 0, exp: "Foreign Key เป็นคอลัมน์ที่อ้างอิง Primary Key ของอีกตารางเพื่อสร้างความสัมพันธ์" },
      { q: "คำสั่ง SQL ใดใช้ลบข้อมูล?", opts: ["DELETE", "REMOVE", "DROP", "ERASE"], ci: 2, exp: "DELETE ใช้ลบแถวข้อมูล ส่วน DROP ใช้ลบทั้งตาราง" },
      { q: "GROUP BY ใช้ทำอะไร?", opts: ["จัดกลุ่มข้อมูลตามคอลัมน์", "เรียงลำดับข้อมูล", "กรองข้อมูล", "เชื่อมตาราง"], ci: 0, exp: "GROUP BY จัดกลุ่มแถวที่มีค่าในคอลัมน์เดียวกันไว้ด้วยกัน" },
      { q: "WHERE กับ HAVING ต่างกันอย่างไร?", opts: ["WHERE กรองก่อน GROUP BY, HAVING กรองหลัง", "เหมือนกัน", "WHERE ใช้กับ JOIN เท่านั้น", "HAVING กรองก่อน GROUP BY"], ci: 0, exp: "WHERE กรองแถวก่อนจัดกลุ่ม, HAVING กรองหลัง GROUP BY" },
      { q: "JOIN ใน SQL มีกี่ประเภทหลัก?", opts: ["4 ประเภท", "2 ประเภท", "6 ประเภท", "1 ประเภท"], ci: 0, exp: "JOIN หลักมี 4 แบบ: INNER, LEFT, RIGHT, FULL OUTER" },
      { q: "VIEW ใน Database คืออะไร?", opts: ["ตารางเสมือนที่เกิดจากคำสั่ง SELECT", "ตารางจริงที่เก็บข้อมูล", "ประเภทของ Index", "ฟังก์ชันใน SQL"], ci: 0, exp: "VIEW คือตารางเสมือนที่สร้างจากคำสั่ง SELECT ไม่ได้เก็บข้อมูลจริง" },
      { q: "Stored Procedure คืออะไร?", opts: ["ชุดคำสั่ง SQL ที่เก็บไว้ใน Database", "ฟังก์ชันในภาษาโปรแกรม", "ประเภทของ Index", "เครื่องมือสำรองข้อมูล"], ci: 0, exp: "Stored Procedure คือชุดคำสั่ง SQL ที่ถูกคอมไพล์และเก็บไว้ใน Database" },
      { q: "ข้อใดคือคุณสมบัติของ NoSQL?", opts: ["ยืดหยุ่นกับข้อมูลที่ไม่มี Schema ตายตัว", "มี Schema ตายตัว", "ใช้ SQL ในการ query", "รองรับเฉพาะข้อมูลตัวเลข"], ci: 0, exp: "NoSQL ออกแบบมาสำหรับข้อมูลที่ไม่มี Schema ตายตัว ยืดหยุ่นและ scale แนวราบได้ดี" },
      { q: "Database Replication คืออะไร?", opts: ["การคัดลอกข้อมูลไปยังเซิร์ฟเวอร์หลายเครื่อง", "การแบ่งข้อมูลเป็นส่วนย่อย", "การเข้ารหัสข้อมูล", "การสำรองข้อมูลรายวัน"], ci: 0, exp: "Replication คือการคัดลอกและรักษาสำเนาข้อมูลให้ตรงกันบนหลายเซิร์ฟเวอร์" },
      { q: "Sharding ใน Database คืออะไร?", opts: ["การแบ่งข้อมูลแนวนอนออกเป็นส่วนย่อย", "การเข้ารหัส", "การสร้าง Index", "การสำรองข้อมูล"], ci: 0, exp: "Sharding คือการแบ่งข้อมูลขนาดใหญ่ออกเป็นส่วนย่อย (shard) ตามแนวนอน" },
      { q: "คำสั่ง ALTER TABLE ใช้ทำอะไร?", opts: ["แก้ไขโครงสร้างตาราง", "ลบตาราง", "สร้างตารางใหม่", "ค้นหาข้อมูล"], ci: 0, exp: "ALTER TABLE ใช้เพิ่ม ลบ หรือแก้ไขคอลัมน์ในตาราง" },
      { q: "UNIQUE constraint ต่างจาก PRIMARY KEY อย่างไร?", opts: ["UNIQUE สามารถมี NULL ได้", "เหมือนกันทุกประการ", "PRIMARY KEY ไม่ต้อง unique", "UNIQUE ใช้กับ foreign key เท่านั้น"], ci: 0, exp: "UNIQUE สามารถมี NULL ได้หลายค่า แต่ PRIMARY KEY ห้ามมี NULL" },
      { q: "ข้อใดคือ N+1 Query Problem?", opts: ["การ query ที่ทำให้เรียก Database หลายรอบโดยไม่จำเป็น", "การ query ที่ช้า", " syntax error", "การเชื่อมต่อหลุด"], ci: 0, exp: "N+1 Problem เกิดจากการ query หลัก 1 ครั้ง แล้วตามด้วย N queries ย่อยใน loop" },
      { q: "Index แบบ B-Tree เหมาะกับอะไร?", opts: ["การค้นหาแบบ Range และ Equality", "เฉพาะ Equality", "เฉพาะ Full-text", "การค้นหาแบบ Fuzzy"], ci: 0, exp: "B-Tree Index รองรับทั้งการค้นหาแบบเท่ากันและช่วงค่า (Range Query)" },
      { q: "Deadlock ใน Database คืออะไร?", opts: ["สอง transaction รอทรัพยากรซึ่งกันและกัน", "การเชื่อมต่อขาด", "คำสั่ง SQL ผิด", "ข้อมูลสูญหาย"], ci: 0, exp: "Deadlock เกิดเมื่อ transaction ตั้งแต่ 2 รายการต่างรอทรัพยากรที่อีกฝ่ายครอบครองอยู่" },
      { q: "OLTP กับ OLAP ต่างกันอย่างไร?", opts: ["OLTP เน้น transaction, OLAP เน้นวิเคราะห์", "เหมือนกัน", "OLAP เร็วกว่า", "OLTP ใช้กับ data warehouse"], ci: 0, exp: "OLTP (Online Transaction Processing) เน้นรายการเปลี่ยนแปลง, OLAP เน้นการวิเคราะห์ข้อมูล" },
      { q: "คำสั่ง SQL ใดใช้สร้าง Index?", opts: ["CREATE INDEX", "ADD INDEX", "NEW INDEX", "MAKE INDEX"], ci: 1, exp: "CREATE INDEX เป็นคำสั่งสร้าง Index ใน SQL" },
      { q: "CASCADE ใช้ในกรณีใด?", opts: ["เมื่อลบ parent แล้ว child ถูกลบตาม", "เมื่อเพิ่มข้อมูล", "เมื่อแก้ไขข้อมูล", "เมื่อสร้างตาราง"], ci: 0, exp: "CASCADE เป็น option ที่ให้การเปลี่ยนแปลงในตารางแม่ส่งผลถึงตารางลูกอัตโนมัติ" },
      { q: "ORM คืออะไร?", opts: ["เทคนิค Mapping ระหว่าง OOP กับ Database", "ภาษา query ใหม่", "ประเภทของ Database", "เครื่องมือ backup"], ci: 0, exp: "Object-Relational Mapping (ORM) ช่วย Mapping ตาราง DB ไปเป็น object ในภาษาโปรแกรม" },
      { q: "Data Warehouse คืออะไร?", opts: ["คลังข้อมูลขนาดใหญ่สำหรับวิเคราะห์และรายงาน", "Database ปกติ", "ระบบจัดการไฟล์", "โปรแกรมคำนวณ"], ci: 0, exp: "Data Warehouse คือฐานข้อมูลขนาดใหญ่ที่รวบรวมข้อมูลจากหลายแหล่งเพื่อการวิเคราะห์" },
    ],
  },
  {
    name: "Programming",
    questions: [
      { q: "ตัวแปรในภาษาโปรแกรมคืออะไร?", opts: ["ที่เก็บข้อมูลในหน่วยความจำ", "คำสั่ง loop", "ฟังก์ชันคณิตศาสตร์", "อุปกรณ์ฮาร์ดแวร์"], ci: 3, exp: "ตัวแปร (Variable) คือชื่อที่ใช้อ้างอิงถึงตำแหน่งในหน่วยความจำ" },
      { q: "Array คืออะไร?", opts: ["โครงสร้างเก็บค่าหลายค่าในตัวแปรเดียว", "ชนิดของ loop", "คำสั่ง condition", "ฟังก์ชัน built-in"], ci: 0, exp: "Array เก็บชุดค่าหลายค่าในตัวแปรเดียวโดยเข้าถึงผ่าน index" },
      { q: "Time Complexity ของ Binary Search?", opts: ["O(log n)", "O(n)", "O(n²)", "O(1)"], ci: 3, exp: "Binary Search มี Time Complexity เป็น O(log n)" },
      { q: "OOP ย่อมาจากอะไร?", opts: ["Object-Oriented Programming", "Online Operating Protocol", "Order Of Processing", "Output-Oriented Program"], ci: 1, exp: "OOP หรือการเขียนโปรแกรมเชิงวัตถุ" },
      { q: "Polymorphism คืออะไร?", opts: ["ความสามารถของ object ในการมีได้หลายรูปแบบ", "การสืบทอด class", "การซ่อนข้อมูล", "การเชื่อมต่อฐานข้อมูล"], ci: 2, exp: "Polymorphism = หลายรูปแบบ, method หรือ object ทำงานต่างกันตามบริบท" },
      { q: "Recursion คืออะไร?", opts: ["ฟังก์ชันที่เรียกใช้ตัวเอง", "การวนลูปปกติ", "การแบ่งหน้าจอ", "การจัดเรียงข้อมูล"], ci: 2, exp: "Recursion คือฟังก์ชันที่เรียกใช้ตัวเองเพื่อแก้ปัญหาที่ย่อยลงเรื่อยๆ" },
      { q: "API ย่อมาจากอะไร?", opts: ["Application Programming Interface", "Automated Process Integration", "Applied Protocol Interface", "Application Process Integration"], ci: 3, exp: "API เป็นชุดของฟังก์ชันและโปรโตคอลที่ใช้ให้แอปฯ สื่อสารกัน" },
      { q: "Git คืออะไร?", opts: ["ระบบควบคุมเวอร์ชันแบบ Distributed", "IDE", "ฐานข้อมูล", "ภาษาโปรแกรม"], ci: 2, exp: "Git เป็น Version Control System แบบ Distributed" },
      { q: "REST API ใช้ Method ใดอัปเดตข้อมูล?", opts: ["PUT / PATCH", "GET", "DELETE", "POST"], ci: 0, exp: "PUT ใช้แทนที่ข้อมูล, PATCH ใช้อัปเดตบางส่วน" },
      { q: "Deployment คืออะไร?", opts: ["การนำซอฟต์แวร์ขึ้น Production", "การเขียนโค้ด", "การทดสอบบั๊ก", "การออกแบบ UI"], ci: 1, exp: "Deployment คือการนำซอฟต์แวร์ที่พัฒนาเสร็จไปติดตั้งบนเซิร์ฟเวอร์จริง" },
      { q: "Linked List ต่างจาก Array อย่างไร?", opts: ["Linked List ไม่ต้องใช้พื้นที่ต่อเนื่อง", "Linked List ช้ากว่า", "Array ไม่มีขนาดจำกัด", "เหมือนกัน"], ci: 0, exp: "Linked List ใช้ node ที่เชื่อมต่อกันด้วย pointer ไม่ต้องใช้พื้นที่ต่อเนื่องเหมือน Array" },
      { q: "Stack เป็นโครงสร้างข้อมูลแบบใด?", opts: ["LIFO (Last In First Out)", "FIFO", "Random Access", "Heap"], ci: 0, exp: "Stack ทำงานแบบ LIFO — ข้อมูลที่เข้ามาทีหลังออกก่อน" },
      { q: "Queue เป็นโครงสร้างข้อมูลแบบใด?", opts: ["FIFO (First In First Out)", "LIFO", "Random", "Stack"], ci: 0, exp: "Queue ทำงานแบบ FIFO — ข้อมูลที่เข้ามาก่อนออกก่อน" },
      { q: "Tree มี Root node กี่ node?", opts: ["1 node", "2 node", "หลาย node", "0 node"], ci: 0, exp: "Tree มี Root node เพียง node เดียวที่ไม่มี parent" },
      { q: "Graph กับ Tree ต่างกันอย่างไร?", opts: ["Graph มีวงจรได้, Tree ไม่มี", "Tree มีวงจรได้", "เหมือนกัน", "Graph ไม่มี node"], ci: 0, exp: "Graph สามารถมี cycle (วงจร) ได้ แต่ Tree ไม่มี cycle" },
      { q: "Hash Table มี Time Complexity เฉลี่ยเท่าใด?", opts: ["O(1)", "O(n)", "O(log n)", "O(n²)" ], ci: 0, exp: "Hash Table โดยเฉลี่ยมี time complexity O(1) สำหรับค้นหา แทรก ลบ" },
      { q: "Inheritance ใน OOP คืออะไร?", opts: ["การสืบทอดคุณสมบัติจาก class แม่", "การสร้าง object ใหม่", "การซ่อนข้อมูล", "การเชื่อมต่อ"], ci: 0, exp: "Inheritance คือ Mechanism ที่ class ลูกสืบทอด attributes และ methods จาก class แม่" },
      { q: "Encapsulation คืออะไร?", opts: ["การซ่อนข้อมูลภายใน object", "การสืบทอด", "การมีหลายรูปแบบ", "การเชื่อมต่อ"], ci: 0, exp: "Encapsulation คือการซ่อนรายละเอียดภายในและเปิดเผยเฉพาะ interface" },
      { q: "Abstraction คืออะไร?", opts: ["การซ่อนความซับซ้อนโดยแสดงเฉพาะสิ่งที่จำเป็น", "การสืบทอด", "การมีหลายรูปแบบ", "การจับคู่"], ci: 0, exp: "Abstraction ช่วยซ่อนรายละเอียดการทำงานภายในและแสดงเฉพาะฟังก์ชันที่ผู้ใช้ต้องเรียกใช้" },
      { q: "ภาษาใดเป็น Compiled Language?", opts: ["C++", "Python", "JavaScript", "PHP"], ci: 1, exp: "C++ เป็น compiled language ที่ต้อง compile ก่อนรัน" },
      { q: "ภาษาใดเป็น Interpreted Language?", opts: ["Python", "C", "C++", "Rust"], ci: 0, exp: "Python ถูกตีความ (interpret) ขณะรัน ไม่ต้อง compile ก่อน" },
      { q: "HTTP Status 404 หมายถึงอะไร?", opts: ["Not Found", "OK", "Server Error", "Forbidden"], ci: 0, exp: "HTTP 404 หมายถึงเซิร์ฟเวอร์ไม่พบทรัพยากรที่ร้องขอ" },
      { q: "HTTP Status 500 หมายถึงอะไร?", opts: ["Internal Server Error", "OK", "Not Found", "Bad Request"], ci: 0, exp: "HTTP 500 หมายถึงเกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" },
      { q: "JSON ย่อมาจากอะไร?", opts: ["JavaScript Object Notation", "Java Object Node", "JSON Script", "JavaScript Online Notation"], ci: 0, exp: "JSON (JavaScript Object Notation) เป็นรูปแบบข้อมูลแบบ text-based น้ำหนักเบา" },
      { q: "Promise ใน JavaScript ใช้ทำอะไร?", opts: ["จัดการ asynchronous operation", "ประกาศตัวแปร", "สร้าง loop", "จัดการ Array"], ci: 0, exp: "Promise ใช้จัดการผลลัพธ์ของ asynchronous operation" },
      { q: "Time Complexity ของ Bubble Sort?", opts: ["O(n²)", "O(n)", "O(log n)", "O(n log n)"], ci: 0, exp: "Bubble Sort มี worst-case time complexity เป็น O(n²)" },
      { q: "BFS (Breadth-First Search) ใช้โครงสร้างข้อมูลใด?", opts: ["Queue", "Stack", "Array", "Tree"], ci: 0, exp: "BFS ใช้ Queue เพื่อสำรวจกราฟแบบกว้าง" },
      { q: "DFS (Depth-First Search) ใช้โครงสร้างข้อมูลใด?", opts: ["Stack", "Queue", "Array", "Tree"], ci: 0, exp: "DFS ใช้ Stack เพื่อสำรวจกราฟแบบลึก" },
      { q: "Agile Methodology คืออะไร?", opts: ["วิธีการพัฒนาซอฟต์แวร์แบบ iterative", "ภาษาโปรแกรม", "ฐานข้อมูล", "ระบบปฏิบัติการ"], ci: 0, exp: "Agile เป็นแนวทางการพัฒนาซอฟต์แวร์ที่เน้นการทำงานเป็นรอบสั้นๆ และปรับตัวตามความเปลี่ยนแปลง" },
      { q: "CI/CD ย่อมาจากอะไร?", opts: ["Continuous Integration / Continuous Deployment", "Code Input / Code Debug", "Computer Interface / Computer Design", "Central Information / Central Data"], ci: 0, exp: "CI/CD คือกระบวนการ automated build, test และ deployment" },
    ],
  },
  {
    name: "Computer Network",
    questions: [
      { q: "IP Address มีกี่ bit?", opts: ["32 bits (IPv4)", "16 bits", "64 bits", "8 bits"], ci: 0, exp: "IPv4 มีขนาด 32 bits แบ่งเป็น 4 octets" },
      { q: "HTTP ใช้พอร์ตใด?", opts: ["80", "443", "22", "21"], ci: 0, exp: "HTTP ใช้พอร์ต 80, HTTPS ใช้พอร์ต 443" },
      { q: "HTTPS ใช้พอร์ตใด?", opts: ["443", "80", "22", "3306"], ci: 0, exp: "HTTPS ใช้พอร์ต 443 เพื่อการสื่อสารแบบเข้ารหัส" },
      { q: "DNS ย่อมาจากอะไร?", opts: ["Domain Name System", "Digital Network Service", "Data Node Security", "Dynamic Name Server"], ci: 0, exp: "DNS แปลงชื่อโดเมนเป็น IP Address" },
      { q: "TCP ต่างจาก UDP อย่างไร?", opts: ["TCP เชื่อมต่อก่อนส่ง, UDP ส่งเลย", "UDP เชื่อถือได้มากกว่า", "TCP เร็วกว่า", "เหมือนกัน"], ci: 0, exp: "TCP สร้างการเชื่อมต่อก่อนและรับประกันการส่งถึง, UDP ส่งเลยไม่รับประกัน" },
      { q: "IP 192.168.x.x เป็น IP ประเภทใด?", opts: ["Private IP", "Public IP", "Loopback", "Broadcast"], ci: 0, exp: "192.168.x.x เป็น Private IP สำหรับใช้ในเครือข่ายภายใน" },
      { q: "Subnet Mask ใช้ทำอะไร?", opts: ["แบ่ง Network ID และ Host ID", "เข้ารหัสข้อมูล", "เพิ่มความเร็ว", "จัดการ IP"], ci: 0, exp: "Subnet Mask ใช้แยกส่วน Network ID และ Host ID ของ IP Address" },
      { q: "Firewall มีหน้าที่อะไร?", opts: ["กรองการเข้าถึงเครือข่าย", "เพิ่มความเร็วเน็ต", "สำรองข้อมูล", "จัดการอีเมล"], ci: 0, exp: "Firewall ป้องกันการเข้าถึงเครือข่ายโดยไม่ได้รับอนุญาต" },
      { q: "VPN ใช้ทำอะไร?", opts: ["เชื่อมต่อเครือข่ายส่วนตัวผ่าน internet", "เพิ่มความเร็ว", "บล็อกโฆษณา", "สำรองข้อมูล"], ci: 0, exp: "VPN สร้างอุโมงค์เข้ารหัสระหว่าง device กับเครือข่ายส่วนตัว" },
      { q: "OSI Model มีกี่ Layer?", opts: ["7 Layers", "5 Layers", "4 Layers", "6 Layers"], ci: 0, exp: "OSI Model มี 7 Layers: Physical, Data Link, Network, Transport, Session, Presentation, Application" },
      { q: "MAC Address มีกี่ bit?", opts: ["48 bits", "32 bits", "64 bits", "128 bits"], ci: 0, exp: "MAC Address มีขนาด 48 bits (6 octets) แสดงเป็นเลขฐาน 16" },
      { q: "Router ทำงานใน Layer ใด?", opts: ["Network Layer (Layer 3)", "Data Link Layer", "Physical Layer", "Application Layer"], ci: 0, exp: "Router ทำงานใน Network Layer ส่งแพ็กเก็ตระหว่างเครือข่าย" },
      { q: "Switch ทำงานใน Layer ใด?", opts: ["Data Link Layer (Layer 2)", "Network Layer", "Physical Layer", "Transport Layer"], ci: 0, exp: "Switch ทำงานใน Data Link Layer ใช้ MAC Address ในการส่งข้อมูล" },
      { q: "Protocol ใดใช้ส่งอีเมล?", opts: ["SMTP", "HTTP", "FTP", "DNS"], ci: 0, exp: "SMTP (Simple Mail Transfer Protocol) ใช้ส่งอีเมล" },
      { q: "FTP ใช้พอร์ตใด?", opts: ["21", "80", "443", "22"], ci: 0, exp: "FTP (File Transfer Protocol) ใช้พอร์ต 21 ในการควบคุม" },
      { q: "SSH ใช้พอร์ตใด?", opts: ["22", "21", "80", "443"], ci: 0, exp: "SSH (Secure Shell) ใช้พอร์ต 22 สำหรับเข้าถึงระบบระยะไกลแบบปลอดภัย" },
      { q: "Cloud Computing มีกี่ประเภทหลัก?", opts: ["3 ประเภท: IaaS, PaaS, SaaS", "2 ประเภท", "5 ประเภท", "1 ประเภท"], ci: 0, exp: "Cloud Computing 3 ประเภทหลัก: Infrastructure, Platform, Software as a Service" },
      { q: "Load Balancer มีหน้าที่อะไร?", opts: ["กระจายทราฟฟิกไปยังเซิร์ฟเวอร์หลายเครื่อง", "บล็อกผู้ใช้", "เพิ่มความเร็ว CPU", "สำรองข้อมูล"], ci: 0, exp: "Load Balancer กระจาย request ไปยังเซิร์ฟเวอร์หลายเครื่องเพื่อลดภาระ" },
      { q: "CDN ใช้ทำอะไร?", opts: ["กระจายเนื้อหาไปยังเซิร์ฟเวอร์ใกล้ผู้ใช้", "บีบอัดข้อมูล", "เข้ารหัส", "สำรองข้อมูล"], ci: 0, exp: "CDN (Content Delivery Network) เก็บแคชเนื้อหาไว้ตามจุดต่างๆ ทั่วโลก" },
      { q: "WebSocket ต่างจาก HTTP อย่างไร?", opts: ["WebSocket เป็น connection แบบ persistent", "HTTP persistent", "เหมือนกัน", "WebSocket ช้ากว่า"], ci: 0, exp: "WebSocket สร้างการเชื่อมต่อสองทางแบบ persistent ไม่ต้องเปิดใหม่ทุกครั้ง" },
    ],
  },
  {
    name: "Operating System",
    questions: [
      { q: "Process กับ Thread ต่างกันอย่างไร?", opts: ["Process มี memory space ของตัวเอง, Thread แชร์กัน", "เหมือนกัน", "Thread หนักกว่า", "Process แชร์ memory"], ci: 0, exp: "Process แต่ละตัวมี memory space แยก, Thread ใน process เดียวกันแชร์ memory" },
      { q: "Virtual Memory คืออะไร?", opts: ["การใช้พื้นที่硬盘เป็น RAM เสริม", "RAM จริง", "Cache", "Register"], ci: 0, exp: "Virtual Memory ใช้พื้นที่ฮาร์ดดิสก์เป็นหน่วยความจำเสมือนเมื่อ RAM ไม่พอ" },
      { q: "Scheduling แบบ Round Robin คืออะไร?", opts: ["แต่ละ process ได้เวลาทำงานเท่ากันหมุนเวียน", "process ใหญ่ได้เวลามากกว่า", "process ต้องรอจนกว่าจะเสร็จ", "สุ่ม process"], ci: 0, exp: "Round Robin จัดเวลา CPU ให้แต่ละ process เท่ากันหมุนเวียนไป" },
      { q: "Deadlock มีกี่必要条件?", opts: ["4 条件: Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait", "2 条件", "3 条件", "5 条件"], ci: 0, exp: "Deadlock เกิดเมื่อครบ 4 条件พร้อมกัน" },
      { q: "Kernel คืออะไร?", opts: ["แกนหลักของ OS ที่จัดการทรัพยากร", "โปรแกรมใช้งาน", "Driver", "Shell"], ci: 0, exp: "Kernel เป็นแกนกลางของ OS ทำหน้าที่จัดการทรัพยากรฮาร์ดแวร์" },
      { q: "File System ใดใช้ใน Linux?", opts: ["ext4", "NTFS", "FAT32", "APFS"], ci: 0, exp: "ext4 (Fourth Extended Filesystem) เป็น file system หลักของ Linux" },
      { q: "System Call คืออะไร?", opts: ["Interface ที่โปรแกรมใช้ขอ service จาก OS", "การโทรศัพท์", "คำสั่ง CPU", "ภาษาโปรแกรม"], ci: 0, exp: "System Call เป็นกลไกที่โปรแกรม user space ใช้ขอบริการจาก kernel" },
      { q: "Cache Memory มีประโยชน์อย่างไร?", opts: ["เพิ่มความเร็วในการเข้าถึงข้อมูลที่ใช้บ่อย", "เพิ่ม RAM", "ลดพื้นที่", "ประหยัดไฟ"], ci: 0, exp: "Cache เก็บข้อมูลที่ถูกใช้บ่อยไว้ใกล้ CPU เพื่อลด latency" },
      { q: "RAID 0 มีคุณสมบัติอะไร?", opts: ["รวม硬盘เพิ่มความเร็ว, ไม่มี redundancy", "เพิ่มความปลอดภัย", "สำรองข้อมูล", "เข้ารหัส"], ci: 0, exp: "RAID 0 (Striping) รวม硬盘หลายตัวเพิ่ม performance แต่ไม่มีความทนทานต่อความเสียหาย" },
      { q: "Semaphore ใช้แก้ปัญหาอะไร?", opts: ["Synchronization ระหว่าง process", "การจัดการ RAM", "การสร้างไฟล์", "การเชื่อมต่อเน็ต"], ci: 0, exp: "Semaphore ใช้ควบคุมการเข้าถึง resource ร่วมกันระหว่าง process" },
    ],
  },
];

function deduplicateQuestions(questions) {
  const seen = new Set();
  const result = [];
  for (const q of questions) {
    const key = q.question?.substring(0, 40);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(q);
  }
  return result;
}

function generateQuestionVariants(baseQuestions, count, type) {
  const variants = [];
  const suffixes = ["", " (จงอธิบาย)", " (ข้อใดถูกต้อง?)", " (เลือกข้อที่ถูกต้อง)", " — ให้พิจารณา"];
  const appendices = [
    "",
    " จงเลือกคำตอบที่ถูกต้อง",
    " จากตัวเลือกต่อไปนี้",
    " ข้อใดกล่าวถูกต้อง?",
    " ให้นักเรียนเลือกคำตอบ",
  ];

  for (let i = 0; i < count; i++) {
    const base = baseQuestions[i % baseQuestions.length];
    const appendix = appendices[Math.floor((i / baseQuestions.length) % appendices.length)];
    const variantSuffix = suffixes[i % suffixes.length];

    const variant = { ...base };
    variant.question = base.q + appendix + variantSuffix;

    // Rotate options slightly for variants to make them feel different
    if (variant.opts && i >= baseQuestions.length) {
      const shift = 1 + (i % 3);
      const rotated = [...variant.opts];
      for (let s = 0; s < shift; s++) rotated.push(rotated.shift());
      variant.ci = (variant.ci + shift) % rotated.length;
      variant.opts = rotated;
    }

    if (type === "multiple-choice" || type === "true-false") {
      variant.options = variant.opts;
      variant.correctIndex = variant.ci;
    }
    variant.explanation = variant.exp;
    delete variant.q;
    delete variant.opts;
    delete variant.ci;
    delete variant.exp;

    variants.push(variant);
  }
  return variants;
}

// ---------------------------------------------------------------------------
// Mock quiz generator (used when AI is unavailable)
// ---------------------------------------------------------------------------
function generateMockQuiz(filename, config) {
  const hash = filename.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const subject = MOCK_SUBJECTS[hash % MOCK_SUBJECTS.length];
  const baseQuestions = subject.questions;

  const totalAsked = (config?.multipleChoice || 0) + (config?.trueFalse || 0) + (config?.completion || 0) + (config?.matching || 0) + (config?.shortAnswer || 0) + (config?.essay || 0);
  if (totalAsked < 1) {
    const first5 = baseQuestions.slice(0, 5).map((q, i) => ({
      id: `q${i + 1}`, type: "multiple-choice",
      question: q.q, options: q.opts, correctIndex: q.ci, explanation: q.exp,
    }));
    return { title: `Quiz: ${filename}`, questions: first5 };
  }

  const result = [];

  // Multiple Choice — use variants to guarantee uniqueness
  const mcVariants = generateQuestionVariants(baseQuestions, config?.multipleChoice || 0, "multiple-choice");
  for (let i = 0; i < mcVariants.length; i++) {
    result.push({ ...mcVariants[i], id: `q${result.length + 1}`, type: "multiple-choice" });
  }

  // True-False
  const tfPool = [
    { q: "ข้อความนี้ถูกต้อง", ci: 0, exp: "เนื้อหาถูกต้องตามหลักวิชาการ" },
    { q: "Database คือชุดข้อมูลที่จัดเก็บอย่างมีโครงสร้าง", ci: 0, exp: "Database มีโครงสร้างและความสัมพันธ์" },
    { q: "Primary Key สามารถเป็น NULL ได้", ci: 1, exp: "Primary Key ห้ามมีค่า NULL" },
    { q: "Normalization เพิ่มความซ้ำซ้อนของข้อมูล", ci: 1, exp: "Normalization ลดความซ้ำซ้อน" },
    { q: "Index ช่วยเพิ่มความเร็วในการค้นหา", ci: 0, exp: "Index ทำหน้าที่เหมือนสารบัญ" },
    { q: "NoSQL ใช้ Schema ตายตัว", ci: 1, exp: "NoSQL ยืดหยุ่น ไม่มี Schema ตายตัว" },
    { q: "OOP ย่อมาจาก Object-Oriented Programming", ci: 0, exp: "OOP = Object-Oriented Programming" },
    { q: "Polymorphism คือความสามารถในการมีหลายรูปแบบ", ci: 0, exp: "Polymorphism หมายถึงหลายรูปแบบ" },
    { q: "Array สามารถเก็บข้อมูลหลายประเภทในตัวแปรเดียว", ci: 1, exp: "Array เก็บข้อมูลประเภทเดียวกัน" },
    { q: "HTTP ใช้พอร์ต 443", ci: 1, exp: "HTTP ใช้พอร์ต 80, HTTPS ใช้ 443" },
    { q: "DNS แปลงชื่อโดเมนเป็น IP Address", ci: 0, exp: "DNS ทำหน้าที่แปลง domain → IP" },
    { q: "BFS ใช้ Queue ในการสำรวจกราฟ", ci: 0, exp: "BFS ใช้ Queue สำหรับการสำรวจแบบกว้าง" },
    { q: "Recursion คือฟังก์ชันที่เรียกใช้ตัวเอง", ci: 0, exp: "Recursion เป็นเทคนิคที่ฟังก์ชันเรียกตัวเอง" },
    { q: "Software Development คือ Agile Methodology", ci: 1, exp: "Agile เป็นหนึ่งใน methodology มีหลายแบบ" },
    { q: "MySQL คือ DBMS", ci: 0, exp: "MySQL เป็นระบบจัดการฐานข้อมูล" },
  ];
  for (let i = 0; i < (config?.trueFalse || 0); i++) {
    const t = tfPool[i % tfPool.length];
    result.push({
      id: `q${result.length + 1}`, type: "true-false",
      question: `${t.q} — ถูกต้องหรือไม่?`,
      options: ["ถูก", "ผิด"],
      correctIndex: t.ci,
      explanation: t.exp,
    });
  }

  // Completion
  const compQuestions = [
    { q: "Database คือชุดของ ___ ที่จัดเก็บอย่างมีโครงสร้าง", a: "ข้อมูล", aa: ["ข้อมูล", "data"] },
    { q: "คำสั่ง SQL ที่ใช้ดึงข้อมูลคือ ___", a: "SELECT", aa: ["SELECT", "select"] },
    { q: "Primary Key ต้องมีค่าที่ไม่ ___", a: "ซ้ำ", aa: ["ซ้ำกัน", "ซ้ำ", "duplicate"] },
    { q: "OOP ย่อมาจาก ___ Programming", a: "Object-Oriented", aa: ["Object-Oriented", "Object Oriented"] },
    { q: "HTTP ใช้พอร์ต ___", a: "80", aa: ["80"] },
    { q: "Array index เริ่มต้นที่ ___", a: "0", aa: ["0", "ศูนย์"] },
    { q: "Stack ทำงานแบบ ___", a: "LIFO", aa: ["LIFO", "Last In First Out"] },
    { q: "Queue ทำงานแบบ ___", a: "FIFO", aa: ["FIFO", "First In First Out"] },
    { q: "DNS ย่อมาจาก Domain ___ System", a: "Name", aa: ["Name"] },
    { q: "HTTPS ใช้พอร์ต ___", a: "443", aa: ["443"] },
  ];
  for (let i = 0; i < (config?.completion || 0); i++) {
    const cq = compQuestions[i % compQuestions.length];
    result.push({
      id: `q${result.length + 1}`, type: "completion",
      question: cq.q,
      answer: cq.a,
      acceptableAnswers: cq.aa,
      explanation: `คำตอบที่ถูกต้องคือ "${cq.a}"`,
    });
  }

  // Short Answer
  const saQuestions = [
    { q: "TCP/IP ย่อมาจากอะไร?", a: "Transmission Control Protocol/Internet Protocol", kw: ["Transmission", "Internet"] },
    { q: "ภาษา HTML ย่อมาจากอะไร?", a: "HyperText Markup Language", kw: ["HyperText", "Markup"] },
    { q: "CSS ย่อมาจากอะไร?", a: "Cascading Style Sheets", kw: ["Cascading", "Style"] },
    { q: "SQL ย่อมาจากอะไร?", a: "Structured Query Language", kw: ["Structured", "Query"] },
    { q: "JSON ย่อมาจากอะไร?", a: "JavaScript Object Notation", kw: ["JavaScript", "Notation"] },
    { q: "เรียกกระบวนการนำซอฟต์แวร์ขึ้น Production ว่าอะไร?", a: "Deployment", kw: ["Deployment", "deploy"] },
    { q: "ซอฟต์แวร์ควบคุมเวอร์ชันที่นิยมคืออะไร?", a: "Git", kw: ["Git"] },
    { q: "Binary Search มี Time Complexity เท่าใด?", a: "O(log n)", kw: ["log n", "O(log n)"] },
  ];
  for (let i = 0; i < (config?.shortAnswer || 0); i++) {
    const sa = saQuestions[i % saQuestions.length];
    result.push({
      id: `q${result.length + 1}`, type: "short-answer",
      question: sa.q,
      answer: sa.a,
      keywords: sa.kw,
      explanation: `คำตอบ: ${sa.a}`,
    });
  }

  // Essay
  const essayTopics = [
    { q: `อธิบายความหมายของ ${subject.name} และยกตัวอย่างการประยุกต์ใช้ในชีวิตจริง` },
    { q: `เปรียบเทียบข้อดีข้อเสียของ ${subject.name} กับแนวคิดอื่นที่เกี่ยวข้อง` },
    { q: `อธิบายหลักการสำคัญของ ${subject.name} พร้อมยกตัวอย่างประกอบอย่างน้อย 3 ตัวอย่าง` },
    { q: `วิเคราะห์ปัญหาที่พบบ่อยใน ${subject.name} และแนวทางแก้ไข` },
    { q: `อธิบายวิวัฒนาการของ ${subject.name} ตั้งแต่อดีตถึงปัจจุบัน` },
    { q: `นำเสนอแนวทางการประยุกต์ ${subject.name} ในองค์กรขนาดใหญ่` },
  ];
  for (let i = 0; i < (config?.essay || 0); i++) {
    const et = essayTopics[i % essayTopics.length];
    result.push({
      id: `q${result.length + 1}`, type: "essay",
      question: et.q,
      guidelines: ["อธิบายแนวคิดหลัก", "ยกตัวอย่างประกอบ", "สรุปประเด็นสำคัญ"],
      explanation: "คำตอบควรครอบคลุมแนวคิดหลัก พร้อมตัวอย่างประกอบและสรุปประเด็นสำคัญ",
    });
  }

  // Matching
  const matchingSets = [
    { name: "Database", pairs: [{ left: "DML", right: "SELECT, INSERT" }, { left: "DDL", right: "CREATE, ALTER" }, { left: "DCL", right: "GRANT, REVOKE" }] },
    { name: "Network", pairs: [{ left: "HTTP", right: "พอร์ต 80" }, { left: "HTTPS", right: "พอร์ต 443" }, { left: "FTP", right: "พอร์ต 21" }] },
    { name: "OS", pairs: [{ left: "Process", right: "กำลังทำงาน" }, { left: "Thread", right: "หน่วยย่อย" }, { left: "Kernel", right: "แกน OS" }] },
    { name: "OOP", pairs: [{ left: "Encapsulation", right: "ซ่อนข้อมูล" }, { left: "Inheritance", right: "สืบทอด" }, { left: "Polymorphism", right: "หลายรูปแบบ" }] },
    { name: "Web", pairs: [{ left: "Frontend", right: "HTML/CSS/JS" }, { left: "Backend", right: "API/Server" }, { left: "Database", right: "จัดเก็บข้อมูล" }] },
  ];
  for (let i = 0; i < (config?.matching || 0); i++) {
    const ms = matchingSets[i % matchingSets.length];
    const leftCol = ms.pairs.map((p) => ({ id: p.left, text: p.left }));
    result.push({
      id: `q${result.length + 1}`, type: "matching",
      question: `จับคู่${ms.name}ต่อไปนี้ให้ถูกต้อง`,
      pairs: ms.pairs,
      explanation: ms.pairs.map((p) => `${p.left} ↔ ${p.right}`).join(", "),
    });
  }

  // Deduplicate at the end to catch any accidental repeats
  return { title: `Quiz: ${filename}`, questions: deduplicateQuestions(result).slice(0, totalAsked) };
}

// Fill missing questions with mock-generated items to match requested count
function fillQuizToRequestedCount(quizData, config, filename) {
  if (!quizData?.questions || !config) return quizData;

  const totalRequested = Object.entries(CONFIG_TO_TYPE).reduce(
    (sum, [key]) => sum + (parseInt(config[key]) || 0), 0
  );
  if (totalRequested <= 0) return quizData;

  // First deduplicate what AI returned
  const cleaned = deduplicateQuestions(quizData.questions);
  const currentTotal = cleaned.length;
  if (currentTotal >= totalRequested) {
    return { ...quizData, questions: cleaned.slice(0, totalRequested) };
  }

  // Use the same shared MOCK_SUBJECTS pool
  const hash = filename.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const subject = MOCK_SUBJECTS[hash % MOCK_SUBJECTS.length];
  const baseQuestions = subject.questions;

  // Count how many we have per type already
  const have = {};
  for (const q of cleaned) {
    const t = q.type || "multiple-choice";
    have[t] = (have[t] || 0) + 1;
  }

  const needed = {};
  let totalNeeded = 0;
  for (const [key, type] of Object.entries(CONFIG_TO_TYPE)) {
    const requested = parseInt(config[key]) || 0;
    const current = have[type] || 0;
    if (current < requested) {
      needed[type] = requested - current;
      totalNeeded += needed[type];
    }
  }

  if (totalNeeded === 0) return { ...quizData, questions: cleaned.slice(0, totalRequested) };

  const filler = [];

  // Track existing question texts to avoid duplicates
  const existingTexts = new Set(cleaned.map((q) => q.question?.substring(0, 40)));

  for (const [type, count] of Object.entries(needed)) {
    let added = 0;
    let poolIndex = 0;

    while (added < count) {
      const q = baseQuestions[poolIndex % baseQuestions.length];
      const id = `q${cleaned.length + filler.length + 1}`;

      let newQ = null;
      switch (type) {
        case "multiple-choice": {
          const question = existingTexts.has(q.q?.substring(0, 40))
            ? `${q.q} (ข้อที่ ${poolIndex + 1})`
            : q.q;
          newQ = { id, type: "multiple-choice", question, options: q.opts, correctIndex: q.ci, explanation: q.exp };
          break;
        }
        case "true-false": {
          const question = `${q.q} — ถูกต้องหรือไม่?`;
          if (existingTexts.has(question?.substring(0, 40))) {
            poolIndex++;
            continue;
          }
          newQ = { id, type: "true-false", question, options: ["ถูก", "ผิด"], correctIndex: Math.random() > 0.5 ? 0 : 1, explanation: q.exp };
          break;
        }
        case "completion": {
          const question = q.q.replace(/[ะาเแโใไ]/g, "__") || "ให้เติมคำที่ถูกต้อง";
          if (existingTexts.has(question?.substring(0, 40))) {
            poolIndex++;
            continue;
          }
          newQ = { id, type: "completion", question, answer: q.opts?.[0] || "คำตอบ", acceptableAnswers: [q.opts?.[0] || "คำตอบ"], explanation: q.exp };
          break;
        }
        case "short-answer": {
          const question = `${q.q} (ตอบสั้น)`;
          if (existingTexts.has(question?.substring(0, 40))) {
            poolIndex++;
            continue;
          }
          newQ = { id, type: "short-answer", question, answer: q.opts?.[0] || "คำตอบ", keywords: [(q.opts?.[0] || "").substring(0, 5)], explanation: q.exp };
          break;
        }
        case "matching": {
          const ms = [
            { name: "Database", pairs: [{ left: "DML", right: "SELECT, INSERT" }, { left: "DDL", right: "CREATE, ALTER" }, { left: "DCL", right: "GRANT, REVOKE" }] },
            { name: "Network", pairs: [{ left: "HTTP", right: "พอร์ต 80" }, { left: "HTTPS", right: "พอร์ต 443" }, { left: "FTP", right: "พอร์ต 21" }] },
            { name: "OS", pairs: [{ left: "Process", right: "กำลังทำงาน" }, { left: "Thread", right: "หน่วยย่อย" }, { left: "Kernel", right: "แกน OS" }] },
            { name: "OOP", pairs: [{ left: "Encapsulation", right: "ซ่อนข้อมูล" }, { left: "Inheritance", right: "สืบทอด" }, { left: "Polymorphism", right: "หลายรูปแบบ" }] },
          ];
          const set = ms[(cleaned.length + filler.length) % ms.length];
          const question = `จับคู่${set.name}ต่อไปนี้ให้ถูกต้อง`;
          newQ = { id, type: "matching", question, pairs: set.pairs, explanation: set.pairs.map((p) => `${p.left} ↔ ${p.right}`).join(", ") };
          break;
        }
      }

      if (newQ) {
        existingTexts.add(newQ.question?.substring(0, 40));
        filler.push(newQ);
        added++;
      }
      poolIndex++;
    }
  }

  const finalQuestions = deduplicateQuestions([...cleaned, ...filler]);
  return { ...quizData, questions: finalQuestions.slice(0, totalRequested) };
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

// GET /api/quiz/:id — Fetch quiz (include answer data for view mode)
app.get("/api/quiz/:id", async (c) => {
  const quiz = await loadQuiz(c.env, c.req.param("id"));
  if (!quiz) return c.json({ error: "Quiz not found" }, 404);

  const publicQuestions = quiz.questions.map((q) => {
    const base = { id: q.id, type: q.type || "multiple-choice", question: q.question };
    // Include answer data for view mode (answers are already in KV)
    if (q.correctIndex !== undefined) base.correctIndex = q.correctIndex;
    if (q.answer !== undefined) base.answer = q.answer;
    if (q.acceptableAnswers !== undefined) base.acceptableAnswers = q.acceptableAnswers;
    if (q.keywords !== undefined) base.keywords = q.keywords;
    if (q.explanation !== undefined) base.explanation = q.explanation;
    if (q.pairs !== undefined) base.pairs = q.pairs;
    if (q.guidelines !== undefined) base.guidelines = q.guidelines;

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
    timeLimit: quiz.timeLimit || 0,
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

    // Detect binary vs text files + extract text from binary content
    const decoder = new TextDecoder("utf-8");
    const rawText = decoder.decode(fileBuffer).slice(0, 100000);

    // Check if content is binary (lots of null bytes or non-printable chars)
    const binaryCharCount = (rawText.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length;
    const isBinary = rawText.length > 0 && (binaryCharCount / rawText.length) > 0.30;

    let text;
    if (isBinary) {
      // Extract readable Thai/English text from binary content
      const printable = rawText.match(/[\u0E00-\u0E7Fa-zA-Z\d\s.,;:!?()\-\/+=%@#$^&*"'_]{3,}/g) || [];
      const extracted = printable.join(" ").replace(/\s+/g, " ").trim();

      // Derive topic from filename
      const nameNoExt = filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      const topic = nameNoExt.replace(/^ch\d+\s*/i, "").replace(/^\d+\s*/i, "").trim() || "academic content";

      if (extracted.length > 80) {
        // We got usable text from the binary — use it
        text = `เนื้อหาจากไฟล์: ${filename}\nหัวข้อ: ${topic}\n\n${extracted}`;
      } else {
        // Fallback: use filename-derived topic for rich context
        const topicContext = {
          "naive bayes": `หัวข้อ: Naive Bayes (การจำแนกข้อมูลด้วยทฤษฎี Bayes)\n\nNaive Bayes เป็นอัลกอริทึม Machine Learning แบบ Supervised Learning ใช้สำหรับการจำแนกข้อมูล (Classification) โดยใช้หลักการความน่าจะเป็นแบบมีเงื่อนไข (Conditional Probability) ตามทฤษฎีของ Bayes (Bayes' Theorem)\n\nคุณสมบัติสำคัญ:\n- สมมติว่าคุณลักษณะต่าง ๆ เป็นอิสระต่อกัน (Independence assumption)\n- คำนวณได้อย่างมีประสิทธิภาพ (Efficient Computation)\n- เหมาะกับข้อมูลขนาดใหญ่ (Large Datasets)\n- ใช้ใน Spam Detection, Sentiment Analysis, Recommendation Systems\n\nประเภทของ Naive Bayes:\n1. Gaussian Naive Bayes — สำหรับข้อมูลต่อเนื่องที่แจกแจงแบบปกติ\n2. Multinomial Naive Bayes — สำหรับข้อมูลไม่ต่อเนื่อง\n3. Bernoulli Naive Bayes — สำหรับข้อมูล Binary/Text\n\nข้อดี: ติดตั้งง่าย, ประสิทธิภาพสูง, ทำงานแบบ Real-time\nข้อเสีย: สมมติ Independence ที่อาจไม่เป็นจริงในโลกแห่งความจริง, ไม่สามารถจับความสัมพันธ์ระหว่างคุณลักษณะได้`,
          "machine learning": `หัวข้อ: Machine Learning\n\nMachine Learning คือ การเรียนรู้ของเครื่อง — การสอนให้คอมพิวเตอร์เรียนรู้จากข้อมูล แบ่งเป็น:\n- Supervised Learning: มีคำตอบให้เรียนรู้ (เช่น Classification, Regression)\n- Unsupervised Learning: ไม่มีคำตอบ (เช่น Clustering)\n- Semi-supervised Learning: มีคำตอบบางส่วน\n- Reinforcement Learning: เรียนรู้จากการกระทำและผลตอบแทน\n\nอัลกอริทึมสำคัญ: Decision Tree, Naive Bayes, KNN, SVM, Neural Networks, Ensemble Methods (Random Forest, Gradient Boosting)\n\nการประเมินโมเดล: Accuracy, Precision, Recall, F1-Score, Confusion Matrix, Cross-validation`,
        };

        // Find best matching topic
        const topicLower = topic.toLowerCase();
        let context = null;
        for (const [key, val] of Object.entries(topicContext)) {
          if (topicLower.includes(key)) { context = val; break; }
        }

        if (context) {
          text = `เนื้อหาจากไฟล์: ${filename}\n${context}\n\nหมายเหตุ: เนื้อหาบางส่วนอ้างอิงจากชื่อไฟล์ เนื่องจากไม่สามารถถอดข้อความจาก PDF/PPTX/DOCX ได้完整 ควรใช้ AI ตามความเข้าใจจากหัวข้อที่กำหนด`;
        } else {
          text = `หัวข้อ: ${topic}\n\n${topic} เป็นเนื้อหาทางวิชาการที่ครอบคลุมแนวคิดหลัก ทฤษฎี ตัวอย่าง และการประยุกต์ใช้ ให้นำหัวข้อนี้ไปสร้างข้อสอบ`;
        }
      }
    } else {
      text = rawText;
      if (!text || text.trim().length < 20) {
        text = `เนื้อหาจาก ${filename}. This document covers key concepts and principles.`;
      }
    }

    // Read quiz config from formData (question type counts)
    let config = {};
    let timeLimit = 0;
    try {
      const configStr = formData.get("config");
      if (configStr) config = JSON.parse(configStr);
    } catch {}
    // Read timeLimit from separate form field
    const tlRaw = formData.get("timeLimit");
    if (tlRaw) timeLimit = parseInt(tlRaw) || 0;
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

    // Ensure exact question count requested (fill missing or truncate excess)
    quizData = fillQuizToRequestedCount(quizData, config, filename);

    // Save to store
    const quizId = crypto.randomUUID();
    const quizRecord = {
      id: quizId,
      title: quizData.title,
      source: filename,
      createdAt: new Date().toISOString(),
      questionCount: quizData.questions.length,
      questions: quizData.questions,
      timeLimit: timeLimit > 0 ? timeLimit : undefined,
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
