const { AppError } = require('./errors');

function isDailyQuotaError(error) {
  let payload = error;
  try {
    payload = JSON.parse(error.message);
  } catch {
    /* Some SDK errors expose details directly. */
  }
  const status = Number(error.status || payload.error?.code || error.code);
  if (status !== 429) return false;
  const details = payload.error?.details || payload.details || error.details || [];
  return details.some((detail) =>
    (detail.violations || []).some((violation) =>
      /perday|per_day|daily|per day/i.test(
        [violation.quotaId, violation.quotaMetric, violation.description].join(' '),
      ),
    ),
  );
}

function explainGeminiError(error) {
  if (isDailyQuotaError(error))
    return new AppError(
      503,
      'GEMINI_DAILY_LIMIT',
      'Google Gemini has reached this project’s daily request limit. This analysis could not finish. Wait for the quota to reset, or ask the project owner to enable billing or increase the quota, then upload the contract again.',
    );
  if (Number(error.status) === 429)
    return new AppError(
      503,
      'GEMINI_RATE_LIMIT',
      'Google Gemini is rate limiting requests. Please wait a minute before trying again.',
    );
  if (Number(error.status) === 503)
    return new AppError(
      503,
      'GEMINI_BUSY',
      'Google Gemini is temporarily unavailable due to high demand. Please try again later.',
    );
  return error;
}

module.exports = { isDailyQuotaError, explainGeminiError };
