const { isDailyQuotaError, explainGeminiError } = require('../src/utils/geminiErrors');
const { retry } = require('../src/utils/limiter');
const { createSegmenter } = require('../src/services/clauseSegmenter');
const { createExplanationService } = require('../src/services/explanationService');
const quotaError = () => ({
  status: 429,
  message: JSON.stringify({
    error: {
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
          violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }],
        },
      ],
    },
  }),
});
test('daily quota exhaustion fails immediately without spending more requests or exposing provider payloads', async () => {
  const error = quotaError(),
    sleep = jest.fn(),
    call = jest.fn().mockRejectedValue(error);
  expect(isDailyQuotaError(error)).toBe(true);
  await expect(retry(call, { sleep })).rejects.toBe(error);
  expect(call).toHaveBeenCalledTimes(1);
  expect(sleep).not.toHaveBeenCalled();
  expect(explainGeminiError(error)).toMatchObject({
    code: 'GEMINI_DAILY_LIMIT',
    message: expect.stringContaining('daily request limit'),
  });
  expect(
    isDailyQuotaError({
      status: 429,
      details: [{ violations: [{ quotaId: 'RequestsPerMinute' }] }],
    }),
  ).toBe(false);
});
test('segmentation and explanations do not retry an exhausted daily quota', async () => {
  const error = explainGeminiError(quotaError());
  const generate = jest.fn().mockRejectedValue(error);
  await expect(createSegmenter({ generate })('1. Liability\nUncapped liability.')).rejects.toBe(
    error,
  );
  expect(generate).toHaveBeenCalledTimes(1);
  generate.mockClear();
  await expect(
    createExplanationService({ generate })('Uncapped liability.', [], {
      risk_level: 'risky',
      rule_flags: [],
    }),
  ).rejects.toBe(error);
  expect(generate).toHaveBeenCalledTimes(1);
});
test('other temporary provider failures have actionable messages', () => {
  expect(explainGeminiError({ status: 503 }).message).toContain('high demand');
  expect(explainGeminiError({ status: 429 }).message).toContain('wait a minute');
  const unknown = new Error('unknown');
  expect(explainGeminiError(unknown)).toBe(unknown);
});
