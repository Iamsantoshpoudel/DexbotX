'use client';

import { useSearchParams } from 'next/navigation';

const ERRORS: Record<string, string> = {
  access_denied: 'You cancelled the Discord login. No changes were made.',
  login_failed: 'Discord login failed or expired. Please try again.',
};

export function LoginErrorBanner() {
  const error = useSearchParams().get('error');
  const message = error ? ERRORS[error] : undefined;
  if (!message) return null;

  return (
    <div role="alert" className="mx-auto mt-6 max-w-3xl rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}
