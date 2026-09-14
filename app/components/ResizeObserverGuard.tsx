'use client';

import { useEffect } from 'react';

const BENIGN_RESIZE_MESSAGES = new Set([
  'ResizeObserver loop completed with undelivered notifications.',
  'ResizeObserver loop limit exceeded',
]);

export function ResizeObserverGuard() {
  useEffect(() => {
    const ignoreBenignResizeLoop = (event: ErrorEvent) => {
      if (!BENIGN_RESIZE_MESSAGES.has(event.message)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    window.addEventListener('error', ignoreBenignResizeLoop, true);
    return () => window.removeEventListener('error', ignoreBenignResizeLoop, true);
  }, []);

  return null;
}
