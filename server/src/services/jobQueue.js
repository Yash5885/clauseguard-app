const { AppError } = require('../utils/errors');
function createJobQueue({ concurrency = 2, capacity = 20, logger }) {
  let running = 0,
    reserved = 0,
    accepting = true;
  const pending = [],
    idle = [];
  const notify = () => {
    if (reserved === 0) while (idle.length) idle.shift()();
  };
  function pump() {
    while (running < concurrency && pending.length) {
      const job = pending.shift();
      running++;
      Promise.resolve()
        .then(job)
        .catch((err) => logger.error({ err }, 'Background job failed'))
        .finally(() => {
          running--;
          reserved--;
          pump();
          notify();
        });
    }
  }
  return {
    reserve() {
      if (!accepting || reserved >= capacity)
        throw new AppError(
          503,
          'QUEUE_FULL',
          'The analysis queue is full. Please try again shortly.',
        );
      reserved++;
      let consumed = false;
      return {
        submit(job) {
          if (consumed) throw new Error('Reservation already used');
          consumed = true;
          pending.push(job);
          setImmediate(pump);
        },
        release() {
          if (!consumed) {
            consumed = true;
            reserved--;
            notify();
          }
        },
      };
    },
    drain() {
      return reserved ? new Promise((resolve) => idle.push(resolve)) : Promise.resolve();
    },
    stop() {
      accepting = false;
    },
  };
}
module.exports = { createJobQueue };
