import { createApi } from './api';
const response = (status: number, data: unknown) =>
  ({ ok: status < 400, status, json: async () => data }) as Response;
afterEach(() => {
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
  expect((await createApi(async () => 'token', wake).get('a')).id).toBe('a');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(wake).toHaveBeenCalledWith(true);
  fetchMock.mockReset().mockResolvedValue(response(503, { error: { message: 'Busy' } }));
  await expect(createApi(async () => 'token', wake).remove('a')).rejects.toThrow('Busy');
  expect(fetchMock).toHaveBeenCalledTimes(1);
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
