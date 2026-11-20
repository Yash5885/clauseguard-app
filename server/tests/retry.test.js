const { retry, retryDelay } = require('../src/utils/limiter');
test('respects the Gemini SDK RetryInfo payload and resumes after the requested window', async () => {
  const error = {
    status: 429,
    message: JSON.stringify({
      error: {
        details: [
          { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '39.772535882s' },
        ],
      },
    }),
  };
  const call = jest.fn().mockRejectedValueOnce(error).mockResolvedValue('resumed');
  const sleep = jest.fn();
  expect(await retry(call, { sleep, random: () => 0 })).toBe('resumed');
  expect(sleep).toHaveBeenCalledWith(40773);
});
test('understands structured details and Retry-After seconds', () => {
  expect(
    retryDelay({
      details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '12s' }],
    }),
  ).toBe(12000);
  expect(retryDelay({ response: { headers: { get: () => '45' } } })).toBe(45000);
  expect(retryDelay({ message: 'network failure' })).toBeNull();
});
test('does not sleep for an unreasonably long quota reset or retry nontransient errors', async () => {
  const sleep = jest.fn();
  const error = {
    status: 429,
    details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '3600s' }],
  };
  await expect(retry(() => Promise.reject(error), { sleep })).rejects.toBe(error);
  expect(sleep).not.toHaveBeenCalled();
});
