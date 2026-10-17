'use client';

import { ThemeProvider, useTheme } from 'next-themes';
import { useRef, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { Toaster } from 'sonner';
import { makeStore, type AppStore } from '@/store';

/** Toasts follow the active theme and read colours from the same CSS tokens as the rest of the UI. */
function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === 'light' ? 'light' : 'dark'}
      position="bottom-right"
      toastOptions={{ style: { background: 'var(--color-card)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' } }}
    />
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) storeRef.current = makeStore();
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem themes={['light', 'dark']} disableTransitionOnChange>
      <Provider store={storeRef.current}>
        {children}
        <ThemedToaster />
      </Provider>
    </ThemeProvider>
  );
}
