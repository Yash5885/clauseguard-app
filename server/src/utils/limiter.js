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
      await sleep(Math.min(30000, 1000 * 2 ** i) + Math.floor(random() * 500));
    }
  }
}
module.exports = { createLimiter, retry };
