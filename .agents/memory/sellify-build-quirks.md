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
- Push notifications: full pipeline built (push_tokens table, POST /me/push-token, exp.host send on new message, mobile PushNotifications component) but remote push is unsupported in Expo Go — component skips registration when `Constants.executionEnvironment === 'storeClient'`; only testable in a real build. Keyboard-pinned footers must use `KeyboardStickyView` (absolute-positioned children are never lifted by KeyboardAvoidingView padding).
- Expo mobile speech notes: record with `expo-audio` → base64 (`expo-file-system/legacy` native, FileReader on web) → server `/ai/transcribe` using `ensureCompatibleFormat`+`speechToText` from the OpenAI integrations package. Bump `express.json` limit and validate base64 size/shape server-side.
- The design subagent invents API/Clerk shapes (nested `listing.seller`, `SignedIn`, `colorText`) — after its first pass, run artifact typecheck and send a followup with the exact generated type names; it fixes everything in one round.

## App Store / EAS prep
Store submission assets live in `attached_assets/store/` (composed via `scripts/store-screenshots.mjs`, sharp) and docs (APP_STORE_CONNECT.md, APP_PRIVACY_GUIDE.md, EAS_RELEASE_GUIDE.md) in `artifacts/sellify-mobile/`. Account deletion: delete the Clerk user FIRST (fail loudly), then purge app data in one drizzle transaction — never return 204 if the identity still exists. Apple Sign-In offered via Clerk `oauth_apple` because Google login exists on iOS.

## Clerk on Expo iOS
`@clerk/expo` v3 ships a native module whose podspec adds ClerkKit/ClerkKitUI via SPM — this crashes RN 0.81's `spm.rb` ("undefined method package_product_dependencies for nil") on EAS iOS builds in the pnpm monorepo. Use the JS-only `@clerk/clerk-expo` v2 (same API: ClerkProvider, useAuth, useSSO, useSignIn/useSignUp in the main entry — no `/legacy` path). `ios.usesAppleSignIn` also requires `expo-apple-authentication` installed or prebuild warns. Never let `expo prebuild` keep its package.json edits (it duplicates expo/react/react-native into dependencies, conflicting with the pinned devDeps/catalog); revert those and delete the generated `ios/` dir — builds stay managed via EAS.

## Clerk auth in standalone (TestFlight/EAS) builds
Replit-managed Clerk swaps to a live instance at publish: the prod server verifies tokens against a key derived from the request host (`publishableKeyFromHost` → `pk_live_` + base64(`clerk.<host>$`)) with the Frontend API proxied at `<host>/api/__clerk`. Deployed web/mobile-web get matching env vars injected by build.js at publish time, but EAS/TestFlight builds don't — so the native app must derive the same pk_live key + proxy URL from `EXPO_PUBLIC_DOMAIN` itself (done in `_layout.tsx`). Symptom when missing: public GETs work, every authenticated request 401s. A `pk_test_` env key must be used as-is with NO proxy (dev instances can't be proxied).

## EAS env can leak pk_test into release builds
Build 7 TestFlight failure: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (pk_test) set in the user's EAS env got baked into the release binary — sign-in "worked" against the dev Clerk instance but the prod API rejected every token (401, iss = *.clerk.accounts.dev, not expired). Guard: `lib/clerkConfig.ts` ignores pk_test keys when `__DEV__` is false and always derives the pk_live key from EXPO_PUBLIC_DOMAIN. Server-side `auth rejected` logs with `iss` were what proved it — keep that logging pattern for auth bugs.
