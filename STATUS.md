# STATUS.md — GenQ Project

## Current Status
✅ **FULLY DEPLOYED ON CLOUDFLARE — Production Ready**

## Live URLs
- **Frontend:** https://genq-dlg.pages.dev
- **API:** https://genq-api.banana-by-monky.workers.dev
- **GitHub:** https://github.com/NatdanaiSingngam/GenQ

## Infrastructure
| Resource | Name | Status |
|----------|------|--------|
| Worker | genq-api (Hono.js) | ✅ https://genq-api.banana-by-monky.workers.dev |
| Pages | genq | ✅ https://genq-dlg.pages.dev |
| KV | genq-api-GENQ_KV (b48af9...) | ✅ Quiz data persistent |
| D1 | banana-by-monky-db (0dfe304b...) | ✅ Table created, binding ready |
| Secret | GEMINI_API_KEY | ✅ Set |

## Bindings Verified
- [x] `GEMINI_API_KEY` — environment variable (for AI)
- [x] `GENQ_KV` — KV namespace object
- [x] `GENQ_DB` — D1 database object

## API Endpoints
- `GET /api/health` ✅
- `GET /api/auth/google` ✅ Google OAuth redirect
- `GET /api/auth/google/callback` ✅ OAuth callback → JWT
- `GET /api/auth/me` ✅ Check JWT user
- `POST /api/auth/logout` ✅ Logout
- `GET /api/quiz` ✅ List all
- `GET /api/quiz/seed/data` ✅ 15 questions
- `GET /api/quiz/:id` ✅ Fetch quiz (strips answers)
- `POST /api/quiz/:id/submit` ✅ Score + Grade (handles all types)
- `POST /api/upload` ✅ File upload + config + AI quiz generation (mixed types)

## Storage Architecture
```
Upload/Load → Memory Cache (fast) → KV (persistent, 7-day TTL)
                                   → D1 (available, queries table ready)
```

## Features
- ✅ Google OAuth Login with JWT (7-day expiry)
- ✅ Mixed quiz types: Multiple Choice, True-False, Completion, Short Answer, Essay
- ✅ Config page after upload to select types/counts
- ✅ Quiz page renders each type with appropriate input
- ✅ Results page with all types, pending review for Essay
- ✅ Guest history via sessionStorage (cleared on tab close)
- ✅ Clear history button
- ✅ AI pipeline: Workers AI → Gemini → Mock
- ✅ File upload: PDF, PPTX, DOCX, TXT with binary detection

## Env Variables
- `VITE_API_URL` (Pages production) = `https://genq-api.banana-by-monky.workers.dev/api`
- `GOOGLE_REDIRECT_URI` (Worker vars) = `https://genq-api.banana-by-monky.workers.dev/api/auth/google/callback`
- `FRONTEND_URL` (Worker vars) = `https://genq-dlg.pages.dev`

## Secrets (wrangler secret put)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `JWT_SECRET`
- `GEMINI_API_KEY` (fallback)
