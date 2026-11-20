const request = require('supertest');
const { createApp } = require('../src/app');
const logger = { error: jest.fn() };
test('health and consistent missing route errors', async () => {
  const app = createApp({ config: { CLIENT_URL: 'http://localhost:3000' }, logger });
  expect((await request(app).get('/health')).body).toEqual({ status: 'ok' });
  expect((await request(app).get('/missing')).body.error.code).toBe('NOT_FOUND');
});
test('configuration fails clearly', () => {
  expect(() => require('../src/config').loadConfig({})).toThrow('DATABASE_URL');
});
