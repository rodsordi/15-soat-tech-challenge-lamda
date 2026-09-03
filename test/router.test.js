const test = require('node:test');
const assert = require('node:assert');
const { handler } = require('../src/index');

test('Lambda Router - OPTIONS preflight', async () => {
  const event = {
    requestContext: { http: { method: 'OPTIONS', path: '/register' } }
  };
  const response = await handler(event);
  assert.strictEqual(response.statusCode, 204);
  assert.strictEqual(response.headers['Access-Control-Allow-Origin'], '*');
});

test('Lambda Router - Health check GET /', async () => {
  const event = {
    rawPath: '/',
    requestContext: { http: { method: 'GET', path: '/' } }
  };
  const response = await handler(event);
  assert.strictEqual(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.strictEqual(body.status, 'UP');
  assert.strictEqual(body.endpoints.length, 3);
});

test('Lambda Router - 404 Not Found for unknown route', async () => {
  const event = {
    rawPath: '/unknown-route',
    requestContext: { http: { method: 'GET', path: '/unknown-route' } }
  };
  const response = await handler(event);
  assert.strictEqual(response.statusCode, 404);
  const body = JSON.parse(response.body);
  assert.strictEqual(body.error, 'Not Found');
});

test('Lambda Router - Register validation failure for missing fields', async () => {
  const event = {
    rawPath: '/register',
    requestContext: { http: { method: 'POST', path: '/register' } },
    body: JSON.stringify({ name: 'John' }) // missing email, document, password
  };
  const response = await handler(event);
  assert.strictEqual(response.statusCode, 400);
  const body = JSON.parse(response.body);
  assert.strictEqual(body.error, 'Bad Request');
});

test('Lambda Router - Register validation failure for invalid CPF', async () => {
  const event = {
    rawPath: '/register',
    requestContext: { http: { method: 'POST', path: '/register' } },
    body: JSON.stringify({
      name: 'John Doe',
      email: 'john@example.com',
      document: '11111111111', // invalid CPF
      password: 'password123'
    })
  };
  const response = await handler(event);
  assert.strictEqual(response.statusCode, 400);
  const body = JSON.parse(response.body);
  assert.strictEqual(body.error, 'Invalid Document');
});

test('Lambda Router - Search validation failure for invalid CPF in path', async () => {
  const event = {
    rawPath: '/users/00000000000',
    requestContext: { http: { method: 'GET', path: '/users/00000000000' } }
  };
  const response = await handler(event);
  assert.strictEqual(response.statusCode, 400);
  const body = JSON.parse(response.body);
  assert.strictEqual(body.error, 'Invalid CPF');
});

test('Lambda Router - Auth validation failure for missing password', async () => {
  const event = {
    rawPath: '/auth/login',
    requestContext: { http: { method: 'POST', path: '/auth/login' } },
    body: JSON.stringify({ username: 'john@example.com' }) // missing password
  };
  const response = await handler(event);
  assert.strictEqual(response.statusCode, 400);
  const body = JSON.parse(response.body);
  assert.strictEqual(body.error, 'Bad Request');
});
