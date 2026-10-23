'use client';

import { useEffect, useState } from 'react';

export function useDelayedLoading(isLoading: boolean, delay = 150) {
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowLoading(false);
      return;
    }

    const timeout = setTimeout(() => setShowLoading(true), delay);
    return () => clearTimeout(timeout);
  }, [delay, isLoading]);

  return isLoading && showLoading;
}