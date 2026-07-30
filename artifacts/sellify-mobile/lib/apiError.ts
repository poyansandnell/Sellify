import {
  ApiError,
  getLastAuthHeaderSent,
  getLastHttpStatus,
} from '@workspace/api-client-react';

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
/**
 * Visible debug block shown after a failed authenticated request:
 * Clerk state, token presence, whether the auth header was sent, HTTP status
 * and the server's rejection reason. Temporary — remove before public launch.
 */
export function authFailureDebug(
  isSignedIn: boolean | undefined,
  hasToken: boolean,
  e: unknown,
): string {
  const status = errorStatus(e) ?? getLastHttpStatus();
  const server = e instanceof Error ? e.message : String(e);
  return [
    `Clerk inloggad: ${isSignedIn ? 'ja' : 'nej'}`,
    `token finns: ${hasToken ? 'ja' : 'nej'}`,
    `auth-header skickad: ${getLastAuthHeaderSent() ? 'ja' : 'nej'}`,
    `HTTP-status: ${status ?? '–'}`,
    `server: ${server}`,
  ].join('\n');
}

export function errorDetail(step: string, e: unknown): string {
  const status = errorStatus(e);
  if (status === 401) return `${step}: inte inloggad (401)`;
  if (status != null) return `${step}: HTTP ${status}`;
  const msg = e instanceof Error ? e.message : String(e);
  return `${step}: ${msg}`;
}
