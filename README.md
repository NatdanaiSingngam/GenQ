# 🧬 GenQ — เปลี่ยนสไลด์เป็นข้อสอบ Interactive ใน 1 นาที

> AI-Powered Quiz Generator สำหรับนักเรียนนักศึกษา  
> แค่ลากไฟล์ PDF/PPTX — AI สร้างข้อสอบพร้อมเฉลยให้ทันที

---

## ✨ คุณสมบัติ (MVP)

| ฟีเจอร์ | สถานะ |
|---------|--------|
| 🎯 Drag & Drop File Upload | ✅ ทำงาน |
| 🧠 AI Quiz Generator (Gemini API) | ✅ พร้อม Mock Data |
| 🎮 Clean Interactive UI (ปุ่มกดข้อสอบ) | ✅ |
| 💡 Instant Explanation / เฉลยทันที | ✅ |
| 📊 Summary Dashboard | ✅ |
| 🔍 Smart Search History | ✅ |
| 📱 Responsive (มือถือ + เดสก์ท็อป) | ✅ |
| 🎲 ข้อมูลตัวอย่าง (Seed Data) ให้ทดลอง | ✅ |
| 🏆 Skill Ranking | ⏳ (Phase 2) |

## 🚀 วิธีรัน (Local Development)

### สิ่งที่ต้องมี
- Node.js 18+
- npm

### 1. ติดตั้ง Dependencies

```bash
# จาก root ของโปรเจกต์
cd genq

# ติดตั้ง dependencies ทั้ง server และ client
cd server && npm install
cd ../client && npm install
cd ..
```

### 2. ตั้งค่า Environment (ไม่จำเป็น — Mock Mode ใช้ได้ทันที)

สร้างไฟล์ `server/.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
CLIENT_URL=http://localhost:5173
```
> **ถ้าไม่มี API Key** → ระบบจะทำงานใน **Mock Mode** โดยใช้ Seed Data ข้อสอบตัวอย่าง  
> (ข้อมูลสมจริงจากวิชาระบบฐานข้อมูล — 15 ข้อ)

### 3. รัน Backend

```bash
cd server
npm run dev
# API อยู่ที่ http://localhost:3001
```

### 4. รัน Frontend (อีก terminal)

```bash
cd client
npm run dev
# Frontend อยู่ที่ http://localhost:5173
```

### 5. เปิดเบราว์เซอร์

ไปที่ **http://localhost:5173**  
- กดปุ่ม "ลองทำข้อสอบตัวอย่าง" เพื่อทดสอบทันทีโดยไม่ต้องอัปโหลดไฟล์
- หรือลากไฟล์ PDF/PPTX/DOCX/TXT มาวาง

## 🧪 วิธี Test

### ทดสอบด้วย Seed Data (ไม่ต้องอัปโหลด)
1. เปิด `http://localhost:5173`
2. กดปุ่ม "หรือลองทำข้อสอบตัวอย่างทันที"
3. ข้อสอบ 15 ข้อจากวิชาระบบฐานข้อมูลจะโหลดขึ้น
4. เลือกคำตอบ → กดส่ง → ดูผลลัพธ์

### ทดสอบด้วยการอัปโหลดไฟล์จริง
1. เตรียมไฟล์ PDF/PPTX/DOCX/TXT
2. ลากมาวางบนหน้า Landing
3. รอ AI สร้างข้อสอบ (หรือโหลดจาก Mock ถ้าไม่มี API Key)
4. ทำข้อสอบและดูผลลัพธ์

### ทดสอบ Mobile
เปิด DevTools > Device Toolbar หรือใช้手机จริงต่อ network เดียวกัน

## 🏗️ โครงสร้างโปรเจกต์

```
genq/
├── client/                  # React + Vite + Tailwind
│   ├── src/
│   │   ├── api/             # API client
│   │   ├── components/      # UI Components
│   │   ├── pages/           # หน้าต่างๆ
│   │   │   ├── Landing.jsx      # Drag & Drop + Hero
│   │   │   ├── Quiz.jsx         # Interactive Quiz
│   │   │   ├── Results.jsx      # Summary Dashboard
│   │   │   └── History.jsx      # Quiz History
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── vite.config.js
│   └── tailwind.config.js
├── server/                  # Express API
│   ├── routes/
│   │   ├── upload.js        # File upload + AI processing
│   │   └── quiz.js          # Quiz CRUD + Submit
│   ├── services/
│   │   └── ai.js            # Gemini AI integration
│   ├── data/
│   │   └── seed.json        # Seed data (15 ข้อ)
│   └── index.js
├── package.json
└── README.md
```

## ☁️ Deploy

### Local Dev (Express — แบบเดิม)

```bash
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend
cd client && npm run dev
```

---

## ☁️ Deploy (Cloudflare — Production)

โปรเจกต์นี้ deploy บน **Cloudflare Workers (API) + Cloudflare Pages (Frontend)**

### สิ่งที่ต้องเตรียม
- Cloudflare Account
- API Token (permissions: Workers, Pages, KV)
- `GEMINI_API_KEY`

---

### 1. Create KV Namespace

```bash
cd server/worker
npm install
npx wrangler kv:namespace create GENQ_KV
```
→ คัดลอก `id` ที่ได้ไปใส่ใน `server/worker/wrangler.toml`:
```toml
[[kv_namespaces]]
  binding = "GENQ_KV"
  id = "your-id-here"
```

### 2. ตั้งค่า Secret (GEMINI_API_KEY)

```bash
npx wrangler secret put GEMINI_API_KEY
# Paste: AQ.Ab8…u4Aw
```

### 3. Deploy Backend (Worker)

```bash
cd server/worker
npx wrangler deploy
```
→ จะได้ URL ประมาณ `https://genq-api.your-username.workers.dev`

### 4. Deploy Frontend (Pages)

**วิธี A — ผ่าน CLI:**
```bash
cd client
npm install
npm run build
npx wrangler pages deploy dist --project-name=genq --branch main
```

**วิธี B — ผ่าน Dashboard (auto-deploy จาก GitHub):**
1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
2. เลือก repo `NatdanaiSingngam/GenQ`
3. Build setting:
   - Root directory: `client`
   - Build command: `npm install && npm run build`
   - Build output: `dist`
4. Environment variable (Production):
   - `VITE_API_URL` = `https://genq-api.your-username.workers.dev/api`

### 5. ทดสอบ Local (Cloudflare Worker)

```bash
cd server/worker
npm install
# .dev.vars จะถูก ignore โดย git (มี GEMINI_API_KEY)
npx wrangler dev
# API อยู่ที่ http://localhost:8787
```

แล้วรัน Frontend:
```bash
cd client
VITE_API_URL=http://localhost:8787/api npm run dev
```

## 🔧 เทคโนโลยี

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion |
| Backend | Express.js, Multer |
| AI | Google Gemini 1.5 Flash |
| Animation | Framer Motion, Tailwind Animations |
| Icons | Lucide React |
| Storage | JSON File-based |

## 🎯 เป้าหมายสำหรับ Hackathon

- ✅ MVP ทำงานครบ: Upload → AI Generate → Quiz → Submit → Results
- ✅ ข้อมูล Seed Data สำหรับ Demo ทันที
- ✅ UI สวยพร้อม Animation
- ✅ Responsive
- ✅ Deploy-ready

## 📋 Roadmap

### Phase 1 — MVP (ปัจจุบัน)
- [x] Drag & Drop Upload
- [x] AI Quiz Generator (Gemini + Mock)
- [x] Interactive Quiz UI
- [x] Instant Explanation
- [x] Summary Dashboard
- [x] Quiz History
- [x] Seed Data Demo

### Phase 2 — ถัดไป
- [ ] Student Skill Ranking
- [ ] Multiple Quiz Types (True/False, Fill-in-blank)
- [ ] PDF text extraction (pdf-parse, mammoth)
- [ ] User Authentication
- [ ] Quiz Bank / Sharing
- [ ] Analytics Dashboard

---

**Built with ❤️ for the Hackathon**
