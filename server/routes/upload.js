import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
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
  const subjects = [
    { name: "Database Systems", questions: [
      { question: "ข้อใดคือความหมายของ Database?", options: ["ชุดข้อมูลที่จัดเก็บอย่างมีโครงสร้างและสัมพันธ์กัน", "โปรแกรมจัดการเอกสาร", "ระบบปฏิบัติการ", "โปรแกรมคำนวณ"], correctIndex: 0, explanation: "Database คือชุดข้อมูลที่ถูกจัดเก็บอย่างมีระบบ มีความสัมพันธ์กัน สามารถเรียกใช้ได้อย่างมีประสิทธิภาพ" },
      { question: "ข้อใดคือ DBMS?", options: ["MySQL", "Microsoft Word", "Google Chrome", "Photoshop"], correctIndex: 0, explanation: "MySQL เป็นระบบจัดการฐานข้อมูล (DBMS) ส่วนตัวเลือกอื่นเป็นโปรแกรมประเภทอื่น" },
      { question: "Primary Key มีคุณสมบัติอะไร?", options: ["ห้ามมีค่า NULL และต้องไม่ซ้ำกัน", "ซ้ำกันได้", "เป็น NULL ได้", "แก้ไขค่าได้ตลอดเวลา"], correctIndex: 0, explanation: "Primary Key ต้องมีค่าไม่ซ้ำ (Unique) และไม่เป็น NULL เพื่อใช้ระบุแต่ละแถวในตาราง" },
      { question: "SQL ข้อใดใช้ดึงข้อมูลทั้งหมดจากตาราง students?", options: ["SELECT * FROM students;", "GET * FROM students;", "FETCH * FROM students;", "EXTRACT * FROM students;"], correctIndex: 0, explanation: "คำสั่ง SELECT ใน SQL ใช้ดึงข้อมูล และ * หมายถึงทุกคอลัมน์" },
      { question: "Normalization มีจุดประสงค์อะไร?", options: ["ลดความซ้ำซ้อนของข้อมูล", "เพิ่มความเร็วในการ query", "เข้ารหัสข้อมูล", "บีบอัดขนาดฐานข้อมูล"], correctIndex: 0, explanation: "Normalization ช่วยลด Data Redundancy และลดปัญหาความไม่สอดคล้องของข้อมูล" },
      { question: "Index ใน Database มีประโยชน์อย่างไร?", options: ["เพิ่มความเร็วในการค้นหาข้อมูล", "ลดพื้นที่จัดเก็บ", "เพิ่มความปลอดภัย", "สำรองข้อมูลอัตโนมัติ"], correctIndex: 0, explanation: "Index ทำหน้าที่เหมือนสารบัญ ช่วยให้การค้นหาข้อมูลทำได้รวดเร็วขึ้น" },
      { question: "Transaction คืออะไร?", options: ["ชุดของคำสั่งที่ทำงานร่วมกันแบบทั้งหมดหรือไม่ทำเลย", "การทำรายการเงิน", "คำสั่ง SQL เดี่ยวๆ", "การเชื่อมต่อฐานข้อมูล"], correctIndex: 0, explanation: "Transaction มีคุณสมบัติ ACID ทำให้การทำงานเป็น Atomic — ทำสำเร็จทั้งหมดหรือยกเลิกทั้งหมด" },
      { question: "ข้อใดคือคุณสมบัติของ NoSQL?", options: ["ยืดหยุ่นกับข้อมูลที่ไม่มีโครงสร้างตายตัว", "ใช้ SQL ในการ query", "มี Schema ตายตัว", "รองรับเฉพาะข้อมูลตัวเลข"], correctIndex: 0, explanation: "NoSQL ออกแบบมาสำหรับข้อมูลที่ไม่มี Schema ตายตัว ยืดหยุ่นและ scale แนวราบได้ดี" },
      { question: "SQL Injection คืออะไร?", options: ["การโจมตีโดยแทรกคำสั่ง SQL ผ่าน input ของผู้ใช้", "การทำให้ Database Crash", "การขโมยข้อมูลทางกายภาพ", "การแฮ็ก WiFi"], correctIndex: 0, explanation: "SQL Injection เป็นช่องโหว่ที่ผู้ไม่ประสงค์ดีแทรกคำสั่ง SQL ผ่านช่อง input เพื่อเข้าถึงข้อมูล" },
      { question: "ACID ใน Database ย่อมาจากอะไร?", options: ["Atomicity, Consistency, Isolation, Durability", "Access, Control, Input, Data", "All, Core, Index, Database", "Add, Commit, Insert, Delete"], correctIndex: 0, explanation: "ACID คือคุณสมบัติ 4 ประการของ Transaction ได้แก่ Atomicity, Consistency, Isolation, Durability" },
    ]},
    { name: "Programming", questions: [
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
    ]},
  ];

  // Pick a subject based on filename
  const hash = filename.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const subject = subjects[hash % subjects.length];
  return subject.questions.map((q, i) => ({ ...q, id: `q${i + 1}` }));
}

export default router;
