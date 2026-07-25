import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

/**
 * Generate quiz questions from extracted text using Gemini AI.
 * Returns { title, questions[] } or throws.
 */
export async function generateQuizFromText(text, filename) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const rawText = response.text();

  // Strip markdown code fences if present
  const jsonStr = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(jsonStr);

  return {
    title: parsed.title || `Quiz: ${filename}`,
    questions: parsed.questions || [],
  };
}
