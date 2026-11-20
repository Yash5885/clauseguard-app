'use client';
import { useEffect, useState, useCallback } from 'react';
import type { Analysis } from '@/lib/types';
import { isTransientError } from '@/lib/api';
import { useApi } from './useApi';
export function useAnalysis(id: string) {
  const { api, waking } = useApi();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [version, setVersion] = useState(0);
  const retry = useCallback(() => {
    setError('');
    setVersion((v) => v + 1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    setAnalysis(null);
    setError('');
    setNotice('');
    async function poll() {
      try {
        const result = await api.get(id, controller.signal);
        if (controller.signal.aborted) return;
        setAnalysis(result);
        setError('');
        setNotice('');
        failures = 0;
        if (['pending', 'processing'].includes(result.status)) timer = setTimeout(poll, 2000);
      } catch (e) {
        if (controller.signal.aborted) return;
        if (isTransientError(e)) {
          failures++;
          setNotice('The connection was interrupted. We’ll keep checking for your report.');
          timer = setTimeout(poll, Math.min(2000 * 2 ** Math.min(failures - 1, 4), 30000));
        } else setError(e instanceof Error ? e.message : 'Could not load this analysis.');
      }
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [api, id, version]);
  return { analysis, error, notice, waking, retry };
}
