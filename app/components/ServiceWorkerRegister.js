"use client";

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', async () => {
        try {
          await navigator.serviceWorker.register('/sw.js');
        } catch (registerError) {
          console.warn('Service worker registration failed:', registerError);
        }
      });
    }
  }, []);

  return null;
}
