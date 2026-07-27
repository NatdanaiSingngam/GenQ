import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { generateQuizFromText } from "../services/ai.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "uploads"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".pptx", ".ppt", ".docx", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Allowed: PDF, PPTX, DOCX, TXT"));
    }
  },
});

// POST /api/upload — Upload file & generate quiz
router.post("/", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Upload failed" });
    }

    try {
      // Read timeLimit from request body (might be in config or separate field)
      let timeLimit = 0;
      if (req.body.timeLimit) {
        timeLimit = parseInt(req.body.timeLimit) || 0;
      } else if (req.body.config) {
        try {
          const parsed = JSON.parse(req.body.config);
          if (parsed.timeLimit) timeLimit = parseInt(parsed.timeLimit) || 0;
        } catch {}
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Read file content as text
      const filePath = file.path;
      let text = "";

      if (file.mimetype === "text/plain" || path.extname(file.originalname).toLowerCase() === ".txt") {
        text = readFileSync(filePath, "utf-8");
      } else {
        // For PDF/PPTX/DOCX — attempt basic text extraction
        // In MVP, we read raw bytes as text approximation
        // Real implementation would use pdf-parse, mammoth, etc.
        try {
          const buffer = readFileSync(filePath);
          text = buffer.toString("utf-8").replace(/[^\u0E00-\u0E7F\w\s.,;:!?()\-]/g, " ").slice(0, 100000);
        } catch {
          text = `Content extracted from ${file.originalname}`;
        }
      }

      if (!text || text.trim().length < 20) {
        text = `Sample educational content from ${file.originalname}. This document covers key concepts and principles in the subject matter.`;
      }

      // Generate quiz
      let quizData;
      if (process.env.GEMINI_API_KEY) {
        quizData = await generateQuizFromText(text, file.originalname);
      } else {
        // Return seed-based mock
        const seedPath = path.join(__dirname, "..", "data", "seed.json");
        if (existsSync(seedPath)) {
          const seedRaw = readFileSync(seedPath, "utf-8");
          const seed = JSON.parse(seedRaw);
          quizData = {
            title: `Quiz: ${file.originalname}`,
            questions: seed.questions.slice(0, 10).map((q, i) => ({
              ...q,
              id: `q${i + 1}`,
            })),
          };
        } else {
          quizData = {
            title: `Quiz: ${file.originalname}`,
            questions: generateMockQuestions(file.originalname),
          };
        }
      }

      // Save quiz to data store
      const quizId = uuidv4();
      const quizRecord = {
        id: quizId,
        title: quizData.title,
        source: file.originalname,
        createdAt: new Date().toISOString(),
        questionCount: quizData.questions.length,
        questions: quizData.questions,
        timeLimit: timeLimit > 0 ? timeLimit : undefined,
      };

      const dataPath = path.join(__dirname, "..", "data", `${quizId}.json`);
      writeFileSync(dataPath, JSON.stringify(quizRecord, null, 2));

      res.json({
        quizId,
        title: quizRecord.title,
        questionCount: quizRecord.questionCount,
      });
    } catch (error) {
      console.error("Upload processing error:", error);
      res.status(500).json({ error: "Failed to process file: " + error.message });
    }
  });
});

function generateMockQuestions(filename) {
  const bank = [
    { question: "ข้อใดคือความหมายของ Database?", options: ["ชุดข้อมูลที่จัดเก็บอย่างมีโครงสร้างและสัมพันธ์กัน", "โปรแกรมจัดการเอกสาร", "ระบบปฏิบัติการ", "โปรแกรมคำนวณ"], correctIndex: 0, explanation: "Database คือชุดข้อมูลที่ถูกจัดเก็บอย่างมีระบบ มีความสัมพันธ์กัน" },
    { question: "ข้อใดคือ DBMS?", options: ["MySQL", "Microsoft Word", "Google Chrome", "Photoshop"], correctIndex: 3, explanation: "MySQL เป็นระบบจัดการฐานข้อมูล (DBMS)" },
    { question: "Primary Key มีคุณสมบัติอะไร?", options: ["ห้ามมีค่า NULL และต้องไม่ซ้ำกัน", "ซ้ำกันได้", "เป็น NULL ได้", "แก้ไขค่าได้ตลอดเวลา"], correctIndex: 3, explanation: "Primary Key ต้องมีค่าไม่ซ้ำและไม่เป็น NULL" },
    { question: "SQL ข้อใดใช้ดึงข้อมูลทั้งหมด?", options: ["SELECT * FROM students;", "GET * FROM students;", "FETCH", "EXTRACT"], correctIndex: 2, explanation: "SELECT ใช้ดึงข้อมูล, * หมายถึงทุกคอลัมน์" },
    { question: "Normalization มีจุดประสงค์อะไร?", options: ["ลดความซ้ำซ้อนของข้อมูล", "เพิ่มความเร็ว", "เข้ารหัส", "บีบอัด"], correctIndex: 3, explanation: "Normalization ช่วยลด Data Redundancy" },
    { question: "Index มีประโยชน์อย่างไร?", options: ["เพิ่มความเร็วในการค้นหา", "ลดพื้นที่", "เพิ่มความปลอดภัย", "สำรองข้อมูล"], correctIndex: 0, explanation: "Index ทำหน้าที่เหมือนสารบัญ" },
    { question: "Transaction คืออะไร?", options: ["ชุดคำสั่งที่ทำงานร่วมกันแบบทั้งหมดหรือไม่ทำเลย", "การทำรายการเงิน", "คำสั่ง SQL เดี่ยว", "การเชื่อมต่อ"], correctIndex: 3, explanation: "Transaction มีคุณสมบัติ ACID" },
    { question: "ข้อใดคือ NoSQL?", options: ["MongoDB", "MySQL", "PostgreSQL", "Oracle"], correctIndex: 1, explanation: "MongoDB เป็น NoSQL แบบ Document-oriented" },
    { question: "SQL Injection คืออะไร?", options: ["การแทรกคำสั่ง SQL ผ่าน input ผู้ใช้", "ทำให้ Database Crash", "ขโมยข้อมูล", "แฮ็ก WiFi"], correctIndex: 0, explanation: "SQL Injection แทรกคำสั่ง SQL ผ่านช่อง input" },
    { question: "ACID ย่อมาจากอะไร?", options: ["Atomicity, Consistency, Isolation, Durability", "Access, Control, Input, Data", "All, Core, Index, Database", "Add, Commit, Insert, Delete"], correctIndex: 0, explanation: "Atomicity, Consistency, Isolation, Durability" },
    { question: "Foreign Key คืออะไร?", options: ["คีย์ที่อ้างอิง Primary Key ของอีกตาราง", "คีย์หลัก", "คีย์ที่ NULL ได้", "คีย์จัดเรียง"], correctIndex: 0, explanation: "Foreign Key เชื่อมความสัมพันธ์ระหว่างตาราง" },
    { question: "ตัวแปรในภาษาโปรแกรมคืออะไร?", options: ["ที่เก็บข้อมูลในหน่วยความจำ", "คำสั่ง loop", "ฟังก์ชัน", "อุปกรณ์"], correctIndex: 3, explanation: "ตัวแปร (Variable) คือชื่ออ้างอิงถึงตำแหน่งในหน่วยความจำ" },
    { question: "Array คืออะไร?", options: ["โครงสร้างเก็บค่าหลายค่าในตัวแปรเดียว", "ชนิดของ loop", "คำสั่ง condition", "ฟังก์ชัน"], correctIndex: 0, explanation: "Array เก็บชุดค่าหลายค่าในตัวแปรเดียว เข้าถึงผ่าน index" },
    { question: "Time Complexity ของ Binary Search?", options: ["O(log n)", "O(n)", "O(n²)", "O(1)"], correctIndex: 3, explanation: "Binary Search แบ่งครึ่งข้อมูลในทุก iteration" },
    { question: "OOP ย่อมาจากอะไร?", options: ["Object-Oriented Programming", "Online Operating Protocol", "Order Of Processing", "Output-Oriented"], correctIndex: 1, explanation: "OOP = Object-Oriented Programming" },
    { question: "Polymorphism ใน OOP คืออะไร?", options: ["object มีได้หลายรูปแบบ", "การสืบทอด class", "การซ่อนข้อมูล", "การเชื่อมต่อ"], ci: 2, explanation: "Polymorphism หมายถึงความสามารถในการมีได้หลายรูปแบบ" },
    { question: "Recursion คืออะไร?", options: ["ฟังก์ชันเรียกใช้ตัวเอง", "การวนลูป", "การแบ่งหน้าจอ", "การจัดเรียง"], ci: 2, explanation: "Recursion คือฟังก์ชันที่เรียกใช้ตัวเอง" },
    { question: "API ย่อมาจากอะไร?", options: ["Application Programming Interface", "Automated Process Integration", "Applied Protocol Interface", "Application Process"], ci: 3, exp: "API = Application Programming Interface" },
    { question: "Git คืออะไร?", options: ["ระบบควบคุมเวอร์ชันแบบ Distributed", "IDE", "ฐานข้อมูล", "ภาษาโปรแกรม"], ci: 2, exp: "Git เป็น Version Control System" },
    { question: "HTTP ใช้พอร์ตใด?", options: ["80", "443", "22", "21"], ci: 0, exp: "HTTP ใช้พอร์ต 80" },
    { question: "HTTPS ใช้พอร์ตใด?", options: ["443", "80", "22", "3306"], ci: 0, exp: "HTTPS ใช้พอร์ต 443" },
    { question: "DNS ย่อมาจากอะไร?", options: ["Domain Name System", "Digital Network", "Data Node", "Dynamic Name"], ci: 0, exp: "DNS แปลงชื่อโดเมนเป็น IP Address" },
    { question: "ลบข้อมูลใช้คำสั่ง SQL ใด?", options: ["DELETE", "REMOVE", "DROP", "ERASE"], ci: 2, exp: "DELETE ใช้ลบแถว, DROP ใช้ลบทั้งตาราง" },
    { question: "JOIN มีกี่ประเภทหลัก?", options: ["4 ประเภท", "2", "6", "1"], ci: 0, exp: "INNER, LEFT, RIGHT, FULL OUTER" },
    { question: "TCP ต่างจาก UDP อย่างไร?", options: ["TCP เชื่อมต่อก่อนส่ง", "UDP เชื่อถือได้กว่า", "TCP เร็วกว่า", "เหมือนกัน"], ci: 0, exp: "TCP สร้าง connection ก่อนส่ง UDP ส่งเลย" },
    { question: "Stack เป็นโครงสร้างแบบใด?", options: ["LIFO", "FIFO", "Random", "Heap"], ci: 0, exp: "Stack ทำงานแบบ LIFO" },
    { question: "Queue เป็นโครงสร้างแบบใด?", options: ["FIFO", "LIFO", "Random", "Stack"], ci: 0, exp: "Queue ทำงานแบบ FIFO" },
    { question: "REST API ใช้ Method ใดอัปเดตข้อมูล?", options: ["PUT / PATCH", "GET", "DELETE", "POST"], ci: 0, exp: "PUT = แทนที่, PATCH = อัปเดตบางส่วน" },
    { question: "Deployment คืออะไร?", options: ["นำซอฟต์แวร์ขึ้น Production", "การเขียนโค้ด", "การทดสอบ", "ออกแบบ UI"], ci: 1, exp: "Deployment = นำซอฟต์แวร์ขึ้นเซิร์ฟเวอร์จริง" },
    { question: "OSI Model มีกี่ Layer?", options: ["7 Layers", "5", "4", "6"], ci: 0, exp: "OSI Model มี 7 Layers" },
  ];

  // Normalize: some entries use ci/exp shorthand — convert to correctIndex/explanation
  const normalized = bank.map((q) => ({
    ...q,
    correctIndex: q.correctIndex !== undefined ? q.correctIndex : q.ci,
    explanation: q.explanation !== undefined ? q.explanation : q.exp,
  }));
  delete normalized.correctIndex; delete normalized.ci; delete normalized.exp;

  // Deduplicate
  const seen = new Set();
  const unique = [];
  for (const q of normalized) {
    const key = q.question?.substring(0, 30);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(q);
  }

  const hash = filename.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  // Shuffle deterministically based on filename
  const shuffled = unique.sort((a, b) => {
    const ha = (hash + a.question.length) % 100;
    const hb = (hash + b.question.length) % 100;
    return ha - hb;
  });

  return shuffled.map((q, i) => ({ ...q, id: `q${i + 1}` }));
}

export default router;
