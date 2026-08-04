---
name: Clerk proxy on native (Expo)
description: Why Replit-managed Clerk's production proxy only works on native with @clerk/expo v3, not @clerk/clerk-expo v2.
---

# Clerk proxy on native

**Rule:** For standalone (EAS/TestFlight) builds against Replit-managed Clerk in production, the mobile app MUST use `@clerk/expo` v3+. `@clerk/clerk-expo` v2 silently ignores `proxyUrl` on native.

**Why:** Two independent failures in v2, verified in library source:
1. v2's native singleton is created as `new ClerkClass(publishableKey)` — `proxyUrl` never reaches it.
2. clerk-js's `get proxyUrl()` returns `""` outside a browser (`if (isBrowser()) {...} return ""`), so even `load({ proxyUrl })` is ignored headless.
Result: native clerk-js derives the frontend API host from the pk_live key (`clerk.<app-domain>`), a DNS name that doesn't exist for managed Clerk → all Clerk traffic fails on-device (hung getToken, failed sign-in, zero `/api/__clerk` requests server-side). v3 fixes it: `new ClerkClass(publishableKey, { proxyUrl, domain })`.

**How to apply:** Keep `@clerk/expo` v3 in sellify-mobile; pass `proxyUrl` to `ClerkProvider`. Core v3 "Future" API: `signIn.password()`, `signUp.password()`, `signUp.verifications.sendEmailCode()/verifyEmailCode()`, `finalize()` — methods return `{ error }`, they don't throw. `useSignIn()` returns `{ signIn, errors, fetchStatus }` (no `isLoaded`/`setActive`).

**Debugging tell:** if a Clerk-on-native problem shows ZERO requests hitting the server's request logger (which logs everything), suspect the device is talking to the wrong/nonexistent Clerk host, not the app's API.
