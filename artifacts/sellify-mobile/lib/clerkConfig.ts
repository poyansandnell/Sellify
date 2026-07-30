// Clerk configuration for the Sellify mobile app.
//
// In development the publishable key is injected via
// EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY (see the dev script in package.json).
// In standalone production builds (EAS/TestFlight) those env vars are not
// available, so we derive the same production key and proxy URL from
// EXPO_PUBLIC_DOMAIN that the backend derives on its side
// (publishableKeyFromHost + /api/__clerk proxy) — they must match or every
// authenticated request is rejected with 401.

// Bump this tag whenever auth wiring changes so the in-app debug panel can
// prove which configuration a given TestFlight build actually contains.
export const BUILD_TAG = 'auth-v3-prod-key-guard';

const CLERK_PROXY_PATH = '/api/__clerk';
const domainForClerk = process.env.EXPO_PUBLIC_DOMAIN || '';

function derivedPublishableKey(host: string): string {
  if (!host) return '';
  const frontendApi = `clerk.${host.toLowerCase().replace(/:\d+$/, '')}`;
  // btoa is available in React Native (Hermes) and on web.
  return `pk_live_${btoa(`${frontendApi}$`).replace(/=+$/, '')}`;
}

const envPubKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || '';

// Whether this is a development bundle (Expo dev server). Release/TestFlight
// builds have __DEV__ === false.
const isDevBuild = typeof __DEV__ !== 'undefined' && __DEV__;

// A pk_test_ (development-instance) key is only honored in development
// bundles. Release builds MUST use the production instance: tokens issued by
// the dev instance are rejected by the production API with 401 even though
// sign-in appears to work. (Build 7 root cause: a pk_test key from EAS env
// leaked into the release binary.)
export const clerkPubKey =
  envPubKey.startsWith('pk_test_')
    ? isDevBuild
      ? envPubKey
      : derivedPublishableKey(domainForClerk)
    : envPubKey || derivedPublishableKey(domainForClerk);

export const clerkProxyUrl = clerkPubKey.startsWith('pk_test_')
  ? undefined
  : process.env.EXPO_PUBLIC_CLERK_PROXY_URL ||
    (domainForClerk ? `https://${domainForClerk}${CLERK_PROXY_PATH}` : undefined);

export const apiBaseUrl = `https://${domainForClerk}`;
