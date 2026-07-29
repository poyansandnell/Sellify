import { ApiError } from '@workspace/api-client-react';

/** Error that keeps the HTTP status while carrying a step-specific message. */
export class StepError extends Error {
  status: number | null;
  constructor(message: string, status: number | null) {
    super(message);
    this.status = status;
  }
}

/** HTTP status of an API error, or null when it wasn't an API response. */
export function errorStatus(e: unknown): number | null {
  if (e instanceof ApiError) return e.status;
  if (e instanceof StepError) return e.status;
  return null;
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
