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
- `GET /api/quiz` ✅ List all
- `GET /api/quiz/seed/data` ✅ 15 questions
- `GET /api/quiz/:id` ✅ Fetch quiz
- `POST /api/quiz/:id/submit` ✅ Score + Grade + Explanations + Weak areas
- `POST /api/upload` ✅ File upload + quiz generation

## Storage Architecture
```
Upload/Load → Memory Cache (fast) → KV (persistent, 7-day TTL)
                                   → D1 (available, queries table ready)
```

## To Enable GitHub Auto-Deploy
1. Cloudflare Dashboard → Workers & Pages → genq
2. Settings → Git Integration → Connect to GitHub
3. Select repo: NatdanaiSingngam/GenQ
4. Build: `cd client && npm install && npm run build`
5. Output: `dist`
6. Env: `VITE_API_URL = https://genq-api.banana-by-monky.workers.dev/api`
