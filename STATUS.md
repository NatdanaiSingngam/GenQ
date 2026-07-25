# STATUS.md — GenQ Project

## Current Status
✅ **DEPLOYED ON CLOUDFLARE — Persistent Storage**

## Live URLs
- **Frontend (Pages):** https://genq-dlg.pages.dev
- **Backend API (Worker):** https://genq-api.banana-by-monky.workers.dev
- **GitHub:** https://github.com/NatdanaiSingngam/GenQ

## Infrastructure
- **Worker:** `genq-api` (Hono.js)
- **Pages:** `genq` (React + Vite built files)
- **KV Namespace:** `b48af9d4...` (genq-api-GENQ_KV)
- **D1 Database:** `banana-by-monky-db` (0dfe304b...) — available for future use
- **Secret:** GEMINI_API_KEY set

## Storage
- Hybrid in-memory (fast) + KV (persistent) store
- Quiz data survives Worker redeployment
- CORS configured for Pages → Worker cross-origin

## Verified Endpoints
- `GET /api/health` ✅
- `GET /api/quiz/seed/data` ✅ 15 questions
- `GET /api/quiz/:id` ✅
- `POST /api/quiz/:id/submit` ✅ Score + Grade + Explanations + Weak areas
- `POST /api/upload` ✅ File upload + quiz generation
- `GET /api/quiz` ✅ List all quizzes
