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
export const BUILD_TAG = 'auth-v4-clerk-expo-v3-proxy';

const CLERK_PROXY_PATH = '/api/__clerk';
const domainForClerk = process.env.EXPO_PUBLIC_DOMAIN || '';

// If anything goes wrong while computing the Clerk config, the error text is
// stored here (shown in the startup diagnostics overlay) instead of crashing
// the whole app at bundle-evaluation time.
export let clerkConfigError: string | null = null;

// Pure-JS base64 so key derivation never depends on a global `btoa`
// (availability varies across React Native runtimes; a missing global here
// would crash the app before the first screen renders).
const B64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64Encode(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i += 3) {
    const c1 = input.charCodeAt(i);
    const c2 = i + 1 < input.length ? input.charCodeAt(i + 1) : NaN;
    const c3 = i + 2 < input.length ? input.charCodeAt(i + 2) : NaN;
    out += B64_ALPHABET.charAt(c1 >> 2);
    out += B64_ALPHABET.charAt(((c1 & 3) << 4) | (Number.isNaN(c2) ? 0 : c2 >> 4));
    out += Number.isNaN(c2)
      ? '='
      : B64_ALPHABET.charAt(((c2 & 15) << 2) | (Number.isNaN(c3) ? 0 : c3 >> 6));
    out += Number.isNaN(c3) ? '=' : B64_ALPHABET.charAt(c3 & 63);
  }
  return out;
}

function derivedPublishableKey(host: string): string {
  try {
    if (!host) {
      clerkConfigError = 'EXPO_PUBLIC_DOMAIN saknas – kan inte härleda Clerk-nyckel';
      return '';
    }
    const frontendApi = `clerk.${host.toLowerCase().replace(/:\d+$/, '')}`;
    return `pk_live_${base64Encode(`${frontendApi}$`).replace(/=+$/, '')}`;
  } catch (e) {
    clerkConfigError = e instanceof Error ? e.message : String(e);
    return '';
  }
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
