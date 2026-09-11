const test = require('node:test');
const assert = require('node:assert');
const keycloakService = require('../src/keycloakService');
const garageService = require('../src/garageService');
const { handleRegister } = require('../src/handlers/registerHandler');

test('RegisterHandler - Employee registration success with unified identity', async (t) => {
  const fakeKeycloakUser = {
    id: '7a403fc9-3c96-408c-984f-1fea2729b59f',
    name: 'Carlos Silva',
    email: 'carlos.silva@garage.com',
    document: '69005975059',
    documentType: 'CPF',
    role: 'EMPLOYEE'
  };

  const fakeCatalogEmployee = {
    id: '7a403fc9-3c96-408c-984f-1fea2729b59f',
    name: 'Carlos Silva',
    email: 'carlos.silva@garage.com',
    cpf: '69005975059'
  };

  t.mock.method(keycloakService, 'createUser', async () => fakeKeycloakUser);
  t.mock.method(garageService, 'createEmployee', async (payload) => {
    assert.strictEqual(payload.id, fakeKeycloakUser.id);
    assert.strictEqual(payload.cpf, fakeKeycloakUser.document);
    return fakeCatalogEmployee;
  });

  const response = await handleRegister({
    role: 'EMPLOYEE',
    name: 'Carlos Silva',
    email: 'carlos.silva@garage.com',
    document: '690.059.750-59',
    password: 'Password@2026!'
  });

  assert.strictEqual(response.statusCode, 201);
  assert.strictEqual(response.body.success, true);
  assert.strictEqual(response.body.user.id, fakeKeycloakUser.id);
  assert.strictEqual(response.body.catalog.id, fakeKeycloakUser.id);
});

test('RegisterHandler - Employee catalog failure triggers Saga rollback (deleteUser)', async (t) => {
  const fakeKeycloakUser = {
    id: '7a403fc9-3c96-408c-984f-1fea2729b59f',
    name: 'Carlos Silva',
    email: 'carlos.silva@garage.com',
    document: '69005975059',
    role: 'EMPLOYEE'
  };

  let rollbackCalledWith = null;

  t.mock.method(keycloakService, 'createUser', async () => fakeKeycloakUser);
  t.mock.method(keycloakService, 'deleteUser', async (userId) => {
    rollbackCalledWith = userId;
    return true;
  });
  t.mock.method(garageService, 'createEmployee', async () => {
    const error = new Error('Database connection timeout');
    error.status = 504;
    throw error;
  });

  const response = await handleRegister({
    role: 'EMPLOYEE',
    name: 'Carlos Silva',
    email: 'carlos.silva@garage.com',
    document: '690.059.750-59',
    password: 'Password@2026!'
  });

  assert.strictEqual(response.statusCode, 502);
  assert.strictEqual(response.body.error, 'Catalog Integration Error');
  assert.strictEqual(response.body.rollback_executed, true);
  assert.strictEqual(rollbackCalledWith, fakeKeycloakUser.id);
});

test('RegisterHandler - Customer registration success with vehicles and unified identity', async (t) => {
  const fakeKeycloakUser = {
    id: '36c9df52-01eb-4ffd-a0c1-1494440aedef',
    name: 'Maria Santos',
    email: 'maria.santos@exemplo.com',
    document: '27614623000100',
    documentType: 'CNPJ',
    role: 'CUSTOMER'
  };

  const vehicles = [
    {
      make: 'Toyota',
      model: 'Corolla',
      licensePlate: 'ABC1234',
      manufactureYear: '2024'
    }
  ];

  const fakeCatalogCustomer = {
    id: '36c9df52-01eb-4ffd-a0c1-1494440aedef',
    name: 'Maria Santos',
    email: 'maria.santos@exemplo.com',
    document: '27614623000100',
    vehicles
  };

  t.mock.method(keycloakService, 'createUser', async () => fakeKeycloakUser);
  t.mock.method(garageService, 'createCustomer', async (payload) => {
    assert.strictEqual(payload.id, fakeKeycloakUser.id);
    assert.strictEqual(payload.document, fakeKeycloakUser.document);
    assert.strictEqual(payload.vehicles.length, 1);
    return fakeCatalogCustomer;
  });

  const response = await handleRegister({
    role: 'CUSTOMER',
    name: 'Maria Santos',
    email: 'maria.santos@exemplo.com',
    document: '27.614.623/0001-00',
    password: 'Password@2026!',
    vehicles
  });

  assert.strictEqual(response.statusCode, 201);
  assert.strictEqual(response.body.success, true);
  assert.strictEqual(response.body.user.id, fakeKeycloakUser.id);
  assert.strictEqual(response.body.catalog.vehicles.length, 1);
});

test('RegisterHandler - Customer catalog failure triggers Saga rollback (deleteUser)', async (t) => {
  const fakeKeycloakUser = {
    id: '36c9df52-01eb-4ffd-a0c1-1494440aedef',
    name: 'Maria Santos',
    email: 'maria.santos@exemplo.com',
    document: '27614623000100',
    role: 'CUSTOMER'
  };

  let rollbackCalledWith = null;

  t.mock.method(keycloakService, 'createUser', async () => fakeKeycloakUser);
  t.mock.method(keycloakService, 'deleteUser', async (userId) => {
    rollbackCalledWith = userId;
    return true;
  });
  t.mock.method(garageService, 'createCustomer', async () => {
    const error = new Error('Internal Server Error in api-garage');
    error.status = 500;
    throw error;
  });

  const response = await handleRegister({
    role: 'CUSTOMER',
    name: 'Maria Santos',
    email: 'maria.santos@exemplo.com',
    document: '27.614.623/0001-00',
    password: 'Password@2026!'
  });

  assert.strictEqual(response.statusCode, 502);
  assert.strictEqual(response.body.error, 'Catalog Integration Error');
  assert.strictEqual(response.body.rollback_executed, true);
  assert.strictEqual(rollbackCalledWith, fakeKeycloakUser.id);
});

test('RegisterHandler - Keycloak conflict returns 409 without calling catalog or rollback', async (t) => {
  let garageCalled = false;
  let rollbackCalled = false;

  t.mock.method(keycloakService, 'createUser', async () => {
    throw new Error('Usuário já cadastrado com este documento/CPF ou e-mail.');
  });
  t.mock.method(garageService, 'createEmployee', async () => {
    garageCalled = true;
  });
  t.mock.method(keycloakService, 'deleteUser', async () => {
    rollbackCalled = true;
  });

  const response = await handleRegister({
    role: 'EMPLOYEE',
    name: 'Carlos Silva',
    email: 'carlos.silva@garage.com',
    document: '690.059.750-59',
    password: 'Password@2026!'
  });

  assert.strictEqual(response.statusCode, 409);
  assert.strictEqual(response.body.error, 'Conflict');
  assert.strictEqual(garageCalled, false);
  assert.strictEqual(rollbackCalled, false);
});
