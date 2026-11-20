import { renderHook, act, waitFor } from '@testing-library/react';
import { useAnalysis } from './useAnalysis';
import { ApiError } from '@/lib/api';
const get = jest.fn();
const api = { get };
jest.mock('./useApi', () => ({ useApi: () => ({ api, waking: false }) }));
beforeEach(() => {
  jest.useFakeTimers();
  get.mockReset();
});
afterEach(() => {
  jest.useRealTimers();
});
test('polls every two seconds and stops at completion', async () => {
  get
    .mockResolvedValueOnce({ id: 'a', status: 'processing' })
    .mockResolvedValueOnce({ id: 'a', status: 'completed' });
  const { result, unmount } = renderHook(() => useAnalysis('a'));
  await waitFor(() => expect(result.current.analysis?.status).toBe('processing'));
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(result.current.analysis?.status).toBe('completed');
  await act(async () => {
    jest.advanceTimersByTime(6000);
  });
  expect(get).toHaveBeenCalledTimes(2);
  unmount();
});
test('aborts requests and clears polling on unmount', async () => {
  get.mockResolvedValue({ id: 'a', status: 'pending' });
  const { unmount } = renderHook(() => useAnalysis('a'));
  await act(async () => {});
  const signal = get.mock.calls[0][1];
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => {
    jest.advanceTimersByTime(4000);
  });
  expect(get).toHaveBeenCalledTimes(1);
});
test('retains a running report and resumes polling after a transient outage', async () => {
  get
    .mockResolvedValueOnce({ id: 'a', status: 'processing' })
    .mockRejectedValueOnce(new ApiError('Unavailable', 503))
    .mockResolvedValueOnce({ id: 'a', status: 'completed' });
  const { result } = renderHook(() => useAnalysis('a'));
  await act(async () => {});
  await act(async () => {
    await jest.advanceTimersByTimeAsync(2000);
  });
  expect(result.current.analysis?.status).toBe('processing');
  expect(result.current.error).toBe('');
  expect(result.current.notice).toContain('keep checking');
  await act(async () => {
    await jest.advanceTimersByTimeAsync(2000);
  });
  expect(result.current.analysis?.status).toBe('completed');
  expect(result.current.notice).toBe('');
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30000);
  });
  expect(get).toHaveBeenCalledTimes(3);
});
test.each([401, 403, 404])('stops polling after permanent %s errors', async (status) => {
  get.mockRejectedValue(new ApiError('Cannot access this report', status));
  const { result } = renderHook(() => useAnalysis('a'));
  await act(async () => {});
  expect(result.current.error).toBe('Cannot access this report');
  await act(async () => {
    await jest.advanceTimersByTimeAsync(60000);
  });
  expect(get).toHaveBeenCalledTimes(1);
});
test('clears a scheduled outage retry on unmount', async () => {
  get.mockRejectedValue(new TypeError('Network unavailable'));
  const { unmount } = renderHook(() => useAnalysis('a'));
  await act(async () => {});
  unmount();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(60000);
  });
  expect(get).toHaveBeenCalledTimes(1);
});
test('stops polling after a failed analysis', async () => {
  get.mockResolvedValue({ id: 'a', status: 'failed' });
  const { result } = renderHook(() => useAnalysis('a'));
  await act(async () => {});
  expect(result.current.analysis?.status).toBe('failed');
  await act(async () => {
    await jest.advanceTimersByTimeAsync(60000);
  });
  expect(get).toHaveBeenCalledTimes(1);
});
