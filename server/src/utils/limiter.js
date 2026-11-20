function createLimiter(concurrency) {
  let active = 0;
  const waiting = [];
  return async function limit(fn) {
    if (active >= concurrency) await new Promise((resolve) => waiting.push(resolve));
    else active++;
    try {
      return await fn();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}
function retryDelay(error) {
  const header = error.response?.headers?.get?.('retry-after');
  if (header && Number.isFinite(Number(header))) return Math.max(0, Number(header) * 1000);
  let payload = error;
  try {
    payload = JSON.parse(error.message);
  } catch {
    /* SDK errors may already expose structured details. */
  }
  const details = payload.error?.details || payload.details || error.details || [];
  for (const detail of details) {
    if (!detail['@type']?.endsWith('/google.rpc.RetryInfo')) continue;
    const match = /^(\d+(?:\.\d+)?)s$/.exec(detail.retryDelay);
    if (match) return Math.ceil(Number(match[1]) * 1000);
  }
  return null;
}
async function retry(
  fn,
  {
    attempts = 5,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    random = Math.random,
  } = {},
) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      const status = Number(error.status || error.code);
      if (![429, 500, 502, 503, 504].includes(status) || i === attempts - 1) throw error;
      const suggested = retryDelay(error);
      if (suggested > 120000) throw error;
      const delay = Math.max(
        Math.min(30000, 1000 * 2 ** i),
        suggested === null ? (status === 429 ? 60000 : 0) : suggested + 1000,
      );
      await sleep(delay + Math.floor(random() * 500));
    }
  }
}
module.exports = { createLimiter, retry, retryDelay };
