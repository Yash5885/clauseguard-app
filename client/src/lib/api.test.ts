import { createApi } from './api';
const response = (status: number, data: unknown) =>
  ({ ok: status < 400, status, json: async () => data }) as Response;
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
test('attaches a Bearer token to the separate Express origin', async () => {
  const fetchMock = jest.fn().mockResolvedValue(response(200, { analyses: [] }));
  global.fetch = fetchMock;
  await createApi(async () => 'session-token', jest.fn()).list();
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/api/analyses?page=1'),
    expect.objectContaining({ headers: { Authorization: 'Bearer session-token' } }),
  );
});
test('retries transient reads but never retries mutations', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce(response(503, { error: { message: 'Busy' } }))
    .mockResolvedValueOnce(response(200, { id: 'a' }));
  global.fetch = fetchMock;
  const wake = jest.fn();
  const getToken = jest.fn().mockResolvedValueOnce('first-token').mockResolvedValue('fresh-token');
  const pending = createApi(getToken, wake).get('a');
  await jest.advanceTimersByTimeAsync(0);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1999);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  expect((await pending).id).toBe('a');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh-token');
  expect(wake).toHaveBeenCalledWith(true);
  fetchMock.mockReset().mockResolvedValue(response(503, { error: { message: 'Busy' } }));
  await expect(createApi(async () => 'token', wake).remove('a')).rejects.toThrow('Busy');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
test('cancels a retry delay without making another request', async () => {
  const fetchMock = jest.fn().mockResolvedValue(response(503, { error: { message: 'Busy' } }));
  global.fetch = fetchMock;
  const controller = new AbortController();
  const wake = jest.fn();
  const pending = createApi(async () => 'token', wake).get('a', controller.signal);
  const canceled = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  await jest.advanceTimersByTimeAsync(0);
  controller.abort();
  await canceled;
  await jest.advanceTimersByTimeAsync(30000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(wake).toHaveBeenLastCalledWith(false);
});
test('does not send a request when canceled while waiting for a session token', async () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;
  let resolveToken: (token: string) => void = () => {};
  const getToken = () =>
    new Promise<string>((resolve) => {
      resolveToken = resolve;
    });
  const controller = new AbortController();
  const pending = createApi(getToken, jest.fn()).get('a', controller.signal);
  controller.abort();
  resolveToken('token');
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetchMock).not.toHaveBeenCalled();
});
test('bounds immediate transient retries to six attempts across the cold-start window', async () => {
  const fetchMock = jest.fn().mockResolvedValue(response(503, { error: { message: 'Busy' } }));
  global.fetch = fetchMock;
  const pending = expect(createApi(async () => 'token', jest.fn()).get('a')).rejects.toThrow(
    'Busy',
  );
  await jest.advanceTimersByTimeAsync(75000);
  await pending;
  expect(fetchMock).toHaveBeenCalledTimes(6);
});
test('bounds hung requests to seventy-five seconds', async () => {
  const fetchMock = jest.fn(
    (_url: RequestInfo | URL, options?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Timed out', 'AbortError')),
          { once: true },
        );
      }),
  );
  global.fetch = fetchMock;
  const pending = expect(createApi(async () => 'token', jest.fn()).get('a')).rejects.toThrow(
    'taking longer than expected',
  );
  await jest.advanceTimersByTimeAsync(75000);
  await pending;
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
test('does not retry authorization errors or send requests without a session', async () => {
  const fetchMock = jest.fn().mockResolvedValue(response(401, { error: { message: 'Sign in' } }));
  global.fetch = fetchMock;
  await expect(createApi(async () => 'token', jest.fn()).list()).rejects.toThrow('Sign in');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockClear();
  await expect(createApi(async () => null, jest.fn()).list()).rejects.toThrow('expired');
  expect(fetchMock).not.toHaveBeenCalled();
});
