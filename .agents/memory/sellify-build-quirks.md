---
name: Sellify build quirks
description: Non-obvious environment/toolchain lessons from the first Sellify build.
---

- Express 5 (path-to-regexp v8) does NOT support regex route params like `:id(\d+)` — use plain `:id` and register more-specific literal routes (e.g. `/listings/slug/:slug`) before them. **Why:** regex params throw at mount time. Also `req.params.x` is typed `string | string[]` — wrap in `String()` for drizzle `eq()`.
- Orval zod codegen emits zod-v4 `z.url()` for `format: uri` while the project pins zod 3 → typecheck of libs fails. **How to apply:** avoid `format: uri` in openapi.yaml string schemas.
- The pnpm `overrides: { react: "$react" }` trick from the object-storage skill fails here — root package.json has no direct react dep (react comes from the workspace catalog, v19). Uppy v5 needs react>=19, which the catalog already satisfies, so no overrides are needed at all.
- App i18n defaults to Swedish but falls back to `navigator.language`; screenshots render English because the headless browser locale is en — not a bug.
- `@clerk/expo` v3.7+ default entrypoint exposes the new "signals" auth API — the classic `useSignIn`/`useSignUp` (setActive, prepareEmailAddressVerification, …) live in `@clerk/expo/legacy`. Import from there for custom sign-in screens.
- Orval-generated react-query hooks here require an explicit `queryKey` whenever you pass query options (e.g. `enabled`) — import the matching `get*QueryKey()` helper and pass it alongside.
- Expo mobile speech notes: record with `expo-audio` → base64 (`expo-file-system/legacy` native, FileReader on web) → server `/ai/transcribe` using `ensureCompatibleFormat`+`speechToText` from the OpenAI integrations package. Bump `express.json` limit and validate base64 size/shape server-side.
- The design subagent invents API/Clerk shapes (nested `listing.seller`, `SignedIn`, `colorText`) — after its first pass, run artifact typecheck and send a followup with the exact generated type names; it fixes everything in one round.
