# STATUS.md — GenQ Project

## Current Status
✅ **DEPLOYED ON CLOUDFLARE**

## Live URLs
- **Frontend (Pages):** https://genq-dlg.pages.dev
- **Backend API (Worker):** https://genq-api.banana-by-monky.workers.dev
- **GitHub:** https://github.com/NatdanaiSingngam/GenQ

## Deployed Infrastructure
- [x] Cloudflare Worker `genq-api` — handles all API endpoints
- [x] Cloudflare Pages `genq` — serves React frontend (built with Vite)
- [x] GEMINI_API_KEY set as Worker secret
- [x] In-memory store for quiz data (works across same-isolate requests)

## API Verification
- `GET /api/health` → ✅
- `GET /api/quiz/seed/data` → ✅ 15 questions
- `GET /api/quiz/:id` → ✅
- `POST /api/quiz/:id/submit` → ✅ Score + Grade + Explanations
- `POST /api/upload` → ✅ File upload + quiz generation (Mock mode)
- CORS headers → ✅ `access-control-allow-origin: *`
