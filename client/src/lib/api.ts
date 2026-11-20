import type { Analysis, HistoryPage } from './types';
type GetToken = () => Promise<string | null>;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function isTransientError(error: unknown) {
  return error instanceof ApiError
    ? [408, 425, 429, 500, 502, 503, 504].includes(error.status)
    : error instanceof Error && error.name !== 'AbortError';
}
function retryDelay(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(new DOMException('Request canceled', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}
const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
async function errorMessage(response: Response) {
  try {
    return (await response.json()).error?.message || 'The request failed. Please try again.';
  } catch {
    return 'The request failed. Please try again.';
  }
}
export function createApi(getToken: GetToken, onWake: (value: boolean) => void) {
  async function request<T>(path: string, method = 'GET', signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw new DOMException('Request canceled', 'AbortError');
    let token = await getToken();
    if (signal?.aborted) throw new DOMException('Request canceled', 'AbortError');
    if (!token) throw new ApiError('Your session has expired. Please sign in again.', 401);
    const waking = setTimeout(() => onWake(true), 3500);
    const deadline = Date.now() + 75000;
    const attempts = method === 'GET' ? 6 : 1;
    try {
      for (let attempt = 0; attempt < attempts; attempt++) {
        if (signal?.aborted) throw new DOMException('Request canceled', 'AbortError');
        if (attempt > 0) {
          token = await getToken();
          if (signal?.aborted) throw new DOMException('Request canceled', 'AbortError');
          if (!token) throw new ApiError('Your session has expired. Please sign in again.', 401);
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0)
          throw new ApiError('The server is taking longer than expected. Please try again.', 503);
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) controller.abort();
        const timeout = setTimeout(() => controller.abort(), Math.min(25000, remaining));
        let nextAttemptDelay = 0;
        try {
          const response = await fetch(`${base}${path}`, {
            method,
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
            cache: 'no-store',
          });
          if (!response.ok) throw new ApiError(await errorMessage(response), response.status);
          return response.status === 204 ? (undefined as T) : await response.json();
        } catch (error) {
          if (signal?.aborted) throw new DOMException('Request canceled', 'AbortError');
          const failure =
            error instanceof DOMException && error.name === 'AbortError'
              ? new ApiError('The server is taking longer than expected. Please try again.', 503)
              : error;
          if (method !== 'GET' || !isTransientError(failure) || attempt === attempts - 1)
            throw failure;
          const remaining = deadline - Date.now();
          if (remaining <= 0) throw failure;
          onWake(true);
          nextAttemptDelay = Math.min(2000 * 2 ** attempt, 30000, remaining);
        } finally {
          clearTimeout(timeout);
          signal?.removeEventListener('abort', abort);
        }
        await retryDelay(nextAttemptDelay, signal);
      }
      throw new Error('The server is unavailable. Please try again.');
    } finally {
      clearTimeout(waking);
      onWake(false);
    }
  }
  return {
    list: (page = 1, signal?: AbortSignal) =>
      request<HistoryPage>(`/api/analyses?page=${page}&limit=10`, 'GET', signal),
    get: (id: string, signal?: AbortSignal) =>
      request<Analysis>(`/api/analyses/${encodeURIComponent(id)}`, 'GET', signal),
    remove: (id: string) => request<void>(`/api/analyses/${encodeURIComponent(id)}`, 'DELETE'),
    async upload(
      file: File,
      onProgress: (percent: number) => void,
      signal?: AbortSignal,
    ): Promise<{ id: string; status: string }> {
      const token = await getToken();
      if (!token) throw new ApiError('Your session has expired. Please sign in again.', 401);
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const waking = setTimeout(() => onWake(true), 3500);
        const abort = () => xhr.abort();
        const clean = () => {
          clearTimeout(waking);
          onWake(false);
          signal?.removeEventListener('abort', abort);
        };
        xhr.open('POST', `${base}/api/analyses`);
        xhr.timeout = 90000;
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          clean();
          let data;
          try {
            data = JSON.parse(xhr.responseText);
          } catch {
            reject(new Error('The server returned an unreadable response.'));
            return;
          }
          if (xhr.status === 202) resolve(data);
          else
            reject(
              new ApiError(data.error?.message || 'Upload failed. Please try again.', xhr.status),
            );
        };
        xhr.onerror = () => {
          clean();
          reject(new Error('Cannot reach the server. Check your connection and try again.'));
        };
        xhr.ontimeout = () => {
          clean();
          reject(new Error('The upload timed out. Check your history before trying again.'));
        };
        xhr.onabort = () => {
          clean();
          reject(new DOMException('Upload canceled', 'AbortError'));
        };
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) {
          clean();
          reject(new DOMException('Upload canceled', 'AbortError'));
          return;
        }
        const form = new FormData();
        form.append('file', file);
        xhr.send(form);
      });
    },
  };
}
