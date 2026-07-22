# Sellify

Global buy & sell marketplace (mobile-first web app). Core flow: user photographs an item → AI (OpenAI vision via Replit AI Integrations) generates the full listing (title, description, category, price suggestion) → user reviews editable cards → publishes → listing gets a public SEO page at /listing/:slug.

## Architecture
- pnpm monorepo. Web frontend: `artifacts/sellify` (React + Vite + wouter + Tailwind, base path `/`). Backend: `artifacts/api-server` (Express 5, contract-first OpenAPI).
- API contract: `lib/api-spec/openapi.yaml` → codegen (`pnpm --filter @workspace/api-spec run codegen`) → hooks in `@workspace/api-client-react`, Zod in `@workspace/api-zod`.
- DB: Replit PostgreSQL + Drizzle (`lib/db/src/schema/index.ts`): profiles, categories, listings, favorites, conversations, messages. Push with `pnpm --filter @workspace/db run push`.
- Auth: Replit-managed Clerk (cookie-based on web; proxy middleware in api-server). Profiles auto-created (JIT) from Clerk on first `/api/me` call.
- Images: Replit Object Storage, presigned upload flow (`/api/storage/uploads/request-url`), served at `/api/storage/objects/...`. Client lib: `lib/object-storage-web` (Uppy v5).
- AI: `@workspace/integrations-openai-ai-server`, model `gpt-5.6-terra`, `POST /api/ai/analyze` (images → listing draft JSON).
- i18n: Swedish (default) + English via `artifacts/sellify/src/lib/i18n.tsx` + translations dictionary; persisted in localStorage, falls back to browser language.
- Seed: `artifacts/api-server/scripts/seed.ts` (run with `pnpm --filter @workspace/api-server exec tsx scripts/seed.ts`); seed images in `artifacts/sellify/public/seed/`.

## User preferences
- Communicate with the user in Swedish.
- User is on the Replit iOS app: native Expo builds not possible in this session; mobile-friendly web first, native apps later.

## Notes
- Express 5: no regex route params (`:id(\d+)` unsupported).
- Spec priority (from attached Swedish spec): own marketplace + public listing pages first; external marketplace adapters, moderation/admin panel are future work.
