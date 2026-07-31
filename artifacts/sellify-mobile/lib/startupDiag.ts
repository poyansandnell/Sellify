// Startup diagnostics: captures the FIRST uncaught JS error so the in-app
// diagnostics overlay can show it even in a release build where console
// output is invisible. Import this module FIRST in app/_layout.tsx.

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREV_ERROR_KEY = 'sellify.startupDiag.lastFatalError';

export const startupDiag: {
  firstError: string | null;
  /** First error from the PREVIOUS launch (persisted) — survives a crash. */
  previousError: string | null;
  startedAt: string;
  /** Lifecycle checkpoints in the order they were reached: "name @ ISO-time". */
  checkpoints: string[];
  /** First API request started via customFetch: "METHOD url @ ISO-time". */
  firstRequest: string | null;
} = {
  firstError: null,
  previousError: null,
  startedAt: new Date().toISOString(),
  checkpoints: [],
  firstRequest: null,
};

// Load the previous launch's persisted error (if any) so the diagnostics
// panel can show why the LAST run died even if it never rendered.
AsyncStorage.getItem(PREV_ERROR_KEY)
  .then((v) => {
    if (v) startupDiag.previousError = v;
  })
  .catch(() => {});

/** Record a lifecycle checkpoint (deduplicated by name). */
export function mark(name: string): void {
  if (startupDiag.checkpoints.some((c) => c.startsWith(`${name} `))) return;
  try {
    startupDiag.checkpoints.push(`${name} @ ${new Date().toISOString()}`);
  } catch {
    startupDiag.checkpoints.push(name);
  }
}

type GlobalWithErrorUtils = typeof globalThis & {
  ErrorUtils?: {
    getGlobalHandler?: () => (e: unknown, isFatal?: boolean) => void;
    setGlobalHandler?: (h: (e: unknown, isFatal?: boolean) => void) => void;
  };
};

const g = globalThis as GlobalWithErrorUtils;
if (g.ErrorUtils?.setGlobalHandler) {
  const prev = g.ErrorUtils.getGlobalHandler?.();
  g.ErrorUtils.setGlobalHandler((e, isFatal) => {
    if (!startupDiag.firstError) {
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      startupDiag.firstError = `${isFatal ? '[FATAL] ' : ''}${msg}`;
      // Persist so a crash-on-startup is still visible on the NEXT launch.
      const stack = e instanceof Error && e.stack ? `\n${e.stack.slice(0, 600)}` : '';
      AsyncStorage.setItem(
        PREV_ERROR_KEY,
        `${startupDiag.firstError}${stack} (@ ${new Date().toISOString()})`,
      ).catch(() => {});
    }
    prev?.(e, isFatal);
  });
}
