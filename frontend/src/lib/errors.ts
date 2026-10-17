import type { ApiErrorBody } from './types';

/** Extracts the backend's `{ message, issues }` body from an RTK Query error, if there is one. */
export function errorBody(err: unknown): ApiErrorBody | null {
  const data = (err as { data?: unknown } | null)?.data;
  if (data && typeof data === 'object' && 'message' in data) {
    const body = data as { statusCode?: number; message: unknown; issues?: ApiErrorBody['issues'] };
    // Nest sometimes answers with an array of messages.
    const message = Array.isArray(body.message) ? body.message.join(' ') : String(body.message);
    return { statusCode: body.statusCode ?? 0, message, issues: body.issues };
  }
  return null;
}

export function errorStatus(err: unknown): number | null {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : null;
}

export const isRateLimited = (err: unknown): boolean => errorStatus(err) === 429;

export function errorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  const body = errorBody(err);
  if (body?.message && !body.issues?.length) return body.message;
  const status = errorStatus(err);
  if (status === null && err && typeof err === 'object' && 'error' in err) return 'Network error. Check your connection.';
  if (status === 413) return 'That file is too large.';
  if (status === 429) return 'Too many requests. Wait a moment and try again.';
  return body?.message ?? fallback;
}

/** Turns the backend's `issues` array into `{ 'image.title': 'message' }` for field-level errors. */
export function issuesByPath(body: ApiErrorBody | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of body?.issues ?? []) out[issue.path] ??= issue.message;
  return out;
}
