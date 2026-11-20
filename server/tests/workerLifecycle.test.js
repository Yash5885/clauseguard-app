const { EventEmitter } = require('node:events');
const { createWorkerLifecycle, requireWorkerReady } = require('../src/services/workerLifecycle');

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function client(acquired = true) {
  const connection = new EventEmitter();
  connection.query = jest.fn(async () => ({ rows: [{ acquired }] }));
  connection.release = jest.fn();
  return connection;
}
function setup(connections) {
  const pool = { connect: jest.fn() };
  for (const connection of connections) pool.connect.mockResolvedValueOnce(connection);
  const db = { pool, close: jest.fn().mockResolvedValue(undefined) };
  const queue = { stop: jest.fn(), drain: jest.fn().mockResolvedValue(undefined) };
  const logger = { info: jest.fn(), error: jest.fn(), fatal: jest.fn() };
  const recover = jest.fn().mockResolvedValue(undefined);
  const onLeaseLost = jest.fn();
  const worker = createWorkerLifecycle({ db, queue, logger, recover, onLeaseLost });
  return { worker, db, queue, recover, onLeaseLost };
}
const closedServer = () => ({ close: jest.fn((done) => done()), closeIdleConnections: jest.fn() });

describe('worker lifecycle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('stands by without recovering live work and activates after lease release', async () => {
    const oldConnection = client(false);
    const replacement = client(true);
    const { worker, recover } = setup([oldConnection, replacement]);
    await worker.start();
    expect(worker.ready).toBe(false);
    expect(recover).not.toHaveBeenCalled();
    expect(oldConnection.release).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1000);
    await worker.start();
    expect(worker.ready).toBe(true);
    expect(recover).toHaveBeenCalledTimes(1);
    expect(replacement.release).not.toHaveBeenCalled();
    await worker.shutdown(closedServer());
  });

  test('only submissions are blocked while the worker is unavailable', () => {
    const worker = { ready: false };
    const gate = requireWorkerReady(worker);
    const next = jest.fn();
    gate({ method: 'POST' }, {}, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 503, code: 'WORKER_STARTING' }),
    );
    next.mockClear();
    gate({ method: 'GET' }, {}, next);
    expect(next).toHaveBeenCalledWith();
    next.mockClear();
    worker.ready = true;
    gate({ method: 'POST' }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  test('waits for HTTP requests and queued work before closing the database', async () => {
    const connection = client(true);
    const { worker, db, queue } = setup([connection]);
    await worker.start();
    const jobs = deferred();
    const requests = deferred();
    queue.drain.mockReturnValue(jobs.promise);
    const server = {
      close: jest.fn((done) => {
        requests.promise.then(() => done());
      }),
      closeIdleConnections: jest.fn(),
    };
    const shutdown = worker.shutdown(server);
    expect(worker.ready).toBe(false);
    expect(queue.stop).toHaveBeenCalledTimes(1);
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(db.close).not.toHaveBeenCalled();
    jobs.resolve();
    await Promise.resolve();
    expect(db.close).not.toHaveBeenCalled();
    requests.resolve();
    await shutdown;
    expect(connection.query).toHaveBeenLastCalledWith('SELECT pg_advisory_unlock($1)', [81742392]);
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(db.close).toHaveBeenCalledTimes(1);
    expect(worker.shutdown(server)).toBe(shutdown);
  });

  test('does not activate a connection arriving during shutdown', async () => {
    const connection = client(true);
    const pending = deferred();
    const { worker, db, recover } = setup([]);
    db.pool.connect.mockReturnValue(pending.promise);
    const startup = worker.start();
    const shutdown = worker.shutdown(closedServer());
    pending.resolve(connection);
    await Promise.all([startup, shutdown]);
    expect(recover).not.toHaveBeenCalled();
    expect(connection.query).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(db.close).toHaveBeenCalledTimes(1);
  });

  test('releases and retries a lease when recovery fails', async () => {
    const first = client(true);
    const second = client(true);
    const { worker, recover } = setup([first, second]);
    recover.mockRejectedValueOnce(new Error('Database unavailable'));
    await worker.start();
    expect(worker.ready).toBe(false);
    expect(first.query).toHaveBeenLastCalledWith('SELECT pg_advisory_unlock($1)', [81742392]);
    expect(first.release).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1000);
    await worker.start();
    expect(worker.ready).toBe(true);
    expect(recover).toHaveBeenCalledTimes(2);
    await worker.shutdown(closedServer());
  });

  test('losing the active lease prevents further submissions', async () => {
    const connection = client(true);
    const { worker, onLeaseLost } = setup([connection]);
    await worker.start();
    const error = new Error('Connection terminated');
    connection.emit('error', error);
    expect(worker.ready).toBe(false);
    expect(onLeaseLost).toHaveBeenCalledWith(error);
    await worker.shutdown(closedServer());
  });
});

const integration = process.env.TEST_DATABASE_URL ? test : test.skip;
integration(
  'PostgreSQL hands the worker lease to a replacement without recovering a live worker',
  async () => {
    const { createDatabase } = require('../src/db');
    const logger = { info: jest.fn(), error: jest.fn(), fatal: jest.fn() };
    const recover = jest.fn().mockResolvedValue(undefined);
    const workers = [0, 1].map(() =>
      createWorkerLifecycle({
        db: createDatabase(process.env.TEST_DATABASE_URL),
        queue: { stop: jest.fn(), drain: async () => {} },
        logger,
        recover,
        onLeaseLost: (error) => {
          throw error;
        },
      }),
    );
    try {
      await workers[0].start();
      expect(workers[0].ready).toBe(true);
      await workers[1].start();
      expect(workers[1].ready).toBe(false);
      expect(recover).toHaveBeenCalledTimes(1);
      await workers[0].shutdown(closedServer());
      await workers[1].start();
      expect(workers[1].ready).toBe(true);
      expect(recover).toHaveBeenCalledTimes(2);
    } finally {
      await Promise.all(workers.map((worker) => worker.shutdown(closedServer())));
    }
  },
);
