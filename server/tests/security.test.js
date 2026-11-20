const request = require('supertest');
const { createApp } = require('../src/app');
const { createAuth } = require('../src/middleware/auth');
const logger = { error: jest.fn() };
test('actual Clerk middleware rejects absent sessions without trusting user-supplied headers', async () => {
  const config = {
    CLIENT_URL: 'http://localhost:3000',
    CLERK_SECRET_KEY: 'sk_test_healthcheck',
    CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from('clauseguard-test.clerk.accounts.dev$').toString('base64')}`,
  };
  const app = createApp({ config, logger, auth: createAuth(config) });
  const result = await request(app).get('/api/analyses').set('x-test-user', 'attacker');
  expect(result.status).toBe(401);
  expect(result.body.error.code).toBe('UNAUTHORIZED');
  expect((await request(app).get('/health')).status).toBe(200);
});
test('CORS allows only the configured browser origin and required headers', async () => {
  const app = createApp({ config: { CLIENT_URL: 'https://contracts.example.com' }, logger });
  const result = await request(app).options('/api/analyses').set('Origin', 'https://evil.example');
  expect(result.headers['access-control-allow-origin']).toBe('https://contracts.example.com');
  expect(result.headers['access-control-allow-headers']).toContain('Authorization');
});
test('malformed and oversized JSON return consistent errors', async () => {
  const app = createApp({ config: { CLIENT_URL: 'http://localhost:3000' }, logger });
  expect(
    (await request(app).post('/api/analyses').set('Content-Type', 'application/json').send('{bad'))
      .body.error.code,
  ).toBe('INVALID_JSON');
  expect(
    (
      await request(app)
        .post('/api/analyses')
        .send({ text: 'x'.repeat(40000) })
    ).status,
  ).toBe(413);
});
