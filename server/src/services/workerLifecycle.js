const { AppError } = require('../utils/errors');

const WORKER_LOCK = 81742392;

function requireWorkerReady(worker) {
  return (req, res, next) => {
    if (req.method === 'POST' && !worker.ready)
      return next(
        new AppError(
          503,
          'WORKER_STARTING',
          'The analysis worker is starting. Please try your upload again shortly.',
        ),
      );
    next();
  };
}

function createWorkerLifecycle({ db, queue, logger, recover, onLeaseLost, retryDelayMs = 1000 }) {
  let ready = false;
  let stopping = false;
  let lease = null;
  let retryTimer = null;
  let acquisition = null;
  let shutdownPromise = null;

  async function release(candidate, acquired, onError) {
    candidate.removeListener('error', onError);
    try {
      if (acquired) await candidate.query('SELECT pg_advisory_unlock($1)', [WORKER_LOCK]);
      candidate.release();
    } catch (error) {
      candidate.release(error);
    }
  }

  async function acquire() {
    let candidate;
    let acquired = false;
    let retained = false;
    const onError = (error) => {
      if (!retained) return;
      ready = false;
      logger.fatal({ err: error }, 'Worker lease lost');
      onLeaseLost(error);
    };
    try {
      candidate = await db.pool.connect();
      candidate.on('error', onError);
      if (stopping) return;
      acquired = (
        await candidate.query('SELECT pg_try_advisory_lock($1) AS acquired', [WORKER_LOCK])
      ).rows[0].acquired;
      if (!acquired || stopping) return;
      await recover(db);
      if (stopping) return;
      lease = { client: candidate, onError };
      retained = true;
      ready = true;
      logger.info('Analysis worker activated');
    } catch (error) {
      logger.error({ err: error }, 'Analysis worker activation failed; retrying');
    } finally {
      if (candidate && !retained) await release(candidate, acquired, onError);
    }
  }

  function start() {
    if (stopping || ready) return Promise.resolve();
    if (acquisition) return acquisition;
    acquisition = acquire().finally(() => {
      acquisition = null;
      if (!stopping && !ready) {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          void start();
        }, retryDelayMs);
        retryTimer.unref?.();
      }
    });
    return acquisition;
  }

  function shutdown(server) {
    if (shutdownPromise) return shutdownPromise;
    stopping = true;
    ready = false;
    queue.stop();
    clearTimeout(retryTimer);
    const closed = new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeIdleConnections?.();
    });
    shutdownPromise = (async () => {
      await Promise.all([closed, queue.drain(), acquisition]);
      if (lease) {
        await release(lease.client, true, lease.onError);
        lease = null;
      }
      await db.close();
    })();
    return shutdownPromise;
  }

  return {
    start,
    shutdown,
    get ready() {
      return ready;
    },
  };
}

module.exports = { createWorkerLifecycle, requireWorkerReady };
