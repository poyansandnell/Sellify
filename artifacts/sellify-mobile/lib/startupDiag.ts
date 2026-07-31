// Startup diagnostics: captures the FIRST uncaught JS error so the in-app
// diagnostics overlay can show it even in a release build where console
// output is invisible. Import this module FIRST in app/_layout.tsx.

export const startupDiag: {
  firstError: string | null;
  startedAt: string;
} = {
  firstError: null,
  startedAt: new Date().toISOString(),
};

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
    }
    prev?.(e, isFatal);
  });
}
