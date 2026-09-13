const test = require('node:test');
const assert = require('node:assert');
const keycloakService = require('../src/keycloakService');
const { handleAuth } = require('../src/handlers/authHandler');

test('AuthHandler - Rejects request when username/cpf or password is missing', async () => {
  const missingBoth = await handleAuth({});
  assert.strictEqual(missingBoth.statusCode, 400);
  assert.strictEqual(missingBoth.body.error, 'Bad Request');

  const missingPassword = await handleAuth({ username: '52998224725' });
  assert.strictEqual(missingPassword.statusCode, 400);
  assert.strictEqual(missingPassword.body.error, 'Bad Request');

  const missingUser = await handleAuth({ password: 'Password@2026!' });
  assert.strictEqual(missingUser.statusCode, 400);
  assert.strictEqual(missingUser.body.error, 'Bad Request');
});

test('AuthHandler - Rejects email as username', async () => {
  const response = await handleAuth({
    username: 'admin@garage.com',
    password: 'Password@2026!'
  });

  assert.strictEqual(response.statusCode, 400);
  assert.strictEqual(response.body.error, 'Invalid Document');
});

test('AuthHandler - Rejects alphanumeric username', async () => {
  const response = await handleAuth({
    username: 'john_doe_mechanic',
    password: 'Password@2026!'
  });

  assert.strictEqual(response.statusCode, 400);
  assert.strictEqual(response.body.error, 'Invalid Document');
});

test('AuthHandler - Rejects invalid CPF check digits or repeating sequence', async () => {
  const repeatingDigits = await handleAuth({
    username: '111.111.111-11',
    password: 'Password@2026!'
  });
  assert.strictEqual(repeatingDigits.statusCode, 400);
  assert.strictEqual(repeatingDigits.body.error, 'Invalid Document');

  const wrongCheckDigit = await handleAuth({
    username: '12345678900',
    password: 'Password@2026!'
  });
  assert.strictEqual(wrongCheckDigit.statusCode, 400);
  assert.strictEqual(wrongCheckDigit.body.error, 'Invalid Document');
});

test('AuthHandler - Rejects CNPJ as login username', async () => {
  const cnpjUser = await handleAuth({
    username: '27614623000100',
    password: 'Password@2026!'
  });
  assert.strictEqual(cnpjUser.statusCode, 400);
  assert.strictEqual(cnpjUser.body.error, 'Invalid Document');
});

test('AuthHandler - Authenticates successfully with unmasked valid CPF', async (t) => {
  const validCpf = '52998224725';
  let passedUsername = null;

  t.mock.method(keycloakService, 'authenticate', async (payload) => {
    passedUsername = payload.username;
    return {
      success: true,
      data: {
        access_token: 'fake-access-token-jwt',
        token_type: 'Bearer',
        expires_in: 300,
        refresh_token: 'fake-refresh-token',
        scope: 'openid profile email'
      }
    };
  });

  const response = await handleAuth({
    username: validCpf,
    password: 'SecretPassword123'
  });

  assert.strictEqual(response.statusCode, 200);
  assert.strictEqual(passedUsername, validCpf);
  assert.strictEqual(response.body.access_token, 'fake-access-token-jwt');
  assert.strictEqual(response.body.token_type, 'Bearer');
  assert.strictEqual(response.body.expires_in, 300);
});

test('AuthHandler - Sanitizes masked valid CPF to pure digits before calling Keycloak', async (t) => {
  const maskedCpf = '529.982.247-25';
  const expectedClean = '52998224725';
  let passedUsername = null;

  t.mock.method(keycloakService, 'authenticate', async (payload) => {
    passedUsername = payload.username;
    return {
      success: true,
      data: {
        access_token: 'fake-access-token-jwt',
        token_type: 'Bearer',
        expires_in: 300,
        refresh_token: 'fake-refresh-token',
        scope: 'openid'
      }
    };
  });

  const response = await handleAuth({
    cpf: maskedCpf,
    password: 'SecretPassword123'
  });

  assert.strictEqual(response.statusCode, 200);
  assert.strictEqual(passedUsername, expectedClean);
  assert.strictEqual(response.body.access_token, 'fake-access-token-jwt');
});

test('AuthHandler - Propagates Keycloak authentication rejection (401)', async (t) => {
  t.mock.method(keycloakService, 'authenticate', async () => ({
    success: false,
    status: 401,
    error: 'Unauthorized',
    message: 'Credenciais inválidas.'
  }));

  const response = await handleAuth({
    username: '52998224725',
    password: 'WrongPassword'
  });

  assert.strictEqual(response.statusCode, 401);
  assert.strictEqual(response.body.error, 'Unauthorized');
  assert.strictEqual(response.body.message, 'Credenciais inválidas.');
});

test('AuthHandler - Handles unexpected communication errors with Keycloak (500)', async (t) => {
  t.mock.method(keycloakService, 'authenticate', async () => {
    throw new Error('Keycloak network timeout');
  });

  const response = await handleAuth({
    username: '52998224725',
    password: 'Password123'
  });

  assert.strictEqual(response.statusCode, 500);
  assert.strictEqual(response.body.error, 'Authentication Error');
  assert.strictEqual(response.body.message, 'Keycloak network timeout');
});
