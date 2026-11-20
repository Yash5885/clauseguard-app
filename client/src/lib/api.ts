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
    const token = await getToken();
    if (!token) throw new ApiError('Your session has expired. Please sign in again.', 401);
    const waking = setTimeout(() => onWake(true), 3500);
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) controller.abort();
        const timeout = setTimeout(() => controller.abort(), 25000);
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
          const transient = !(error instanceof ApiError) || [502, 503, 504].includes(error.status);
          if (method !== 'GET' || !transient || attempt === 2) throw error;
          onWake(true);
        } finally {
          clearTimeout(timeout);
          signal?.removeEventListener('abort', abort);
        }
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
