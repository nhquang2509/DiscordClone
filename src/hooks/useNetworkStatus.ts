'use client';

import { useState, useEffect } from 'react';

export type NetworkStatus = 'online' | 'slow' | 'offline';

/**
 * Monitors network connectivity and quality.
 * - 'online'  → navigator.onLine + RTT ≤ 300 ms
 * - 'slow'    → navigator.onLine but RTT > 300 ms or connection is 2g/slow-2g
 * - 'offline' → navigator.onLine === false
 */
export function useNetworkStatus(): NetworkStatus {
  const getStatus = (): NetworkStatus => {
    if (typeof navigator === 'undefined') return 'online';
    if (!navigator.onLine) return 'offline';

    // navigator.connection is not in all browsers (Chrome/Edge only)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conn = (navigator as any).connection;
    if (conn) {
      const { effectiveType, rtt } = conn;
      if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'slow';
      if (typeof rtt === 'number' && rtt > 300) return 'slow';
    }
    return 'online';
  };

  const [status, setStatus] = useState<NetworkStatus>(getStatus);

  useEffect(() => {
    const update = () => setStatus(getStatus());

    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conn = (navigator as any).connection;
    if (conn) conn.addEventListener('change', update);

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      if (conn) conn.removeEventListener('change', update);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return status;
}
