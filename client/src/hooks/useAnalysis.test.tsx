import { renderHook, act, waitFor } from '@testing-library/react';
import { useAnalysis } from './useAnalysis';
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
