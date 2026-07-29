import { ApiError } from '@workspace/api-client-react';

/** HTTP status of an API error, or null when it wasn't an API response. */
export function errorStatus(e: unknown): number | null {
  return e instanceof ApiError ? e.status : null;
}

/**
 * Short human-readable detail for alerts: includes the failing step and the
 * HTTP status so production issues can be told apart (auth vs server vs
 * network).
 */
export function errorDetail(step: string, e: unknown): string {
  const status = errorStatus(e);
  if (status === 401) return `${step}: inte inloggad (401)`;
  if (status != null) return `${step}: HTTP ${status}`;
  const msg = e instanceof Error ? e.message : String(e);
  return `${step}: ${msg}`;
}
