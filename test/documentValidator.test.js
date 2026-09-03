const test = require('node:test');
const assert = require('node:assert');
const {
  isValidCPF,
  isValidCNPJ,
  sanitizeDocument,
  formatDocument,
  validateDocument
} = require('../src/documentValidator');

test('DocumentValidator - sanitizeDocument', () => {
  assert.strictEqual(sanitizeDocument('123.456.789-00'), '12345678900');
  assert.strictEqual(sanitizeDocument('12.345.678/0001-90'), '12345678000190');
  assert.strictEqual(sanitizeDocument('abc 123 - 456'), '123456');
  assert.strictEqual(sanitizeDocument(null), '');
});

test('DocumentValidator - isValidCPF with valid CPFs', () => {
  // Common valid test CPFs
  assert.strictEqual(isValidCPF('52998224725'), true);
  assert.strictEqual(isValidCPF('529.982.247-25'), true);
  assert.strictEqual(isValidCPF('11144477735'), true);
  assert.strictEqual(isValidCPF('111.444.777-35'), true);
});

test('DocumentValidator - isValidCPF with invalid CPFs', () => {
  // All same digits
  assert.strictEqual(isValidCPF('00000000000'), false);
  assert.strictEqual(isValidCPF('11111111111'), false);
  assert.strictEqual(isValidCPF('99999999999'), false);

  // Wrong check digits
  assert.strictEqual(isValidCPF('52998224720'), false);
  assert.strictEqual(isValidCPF('12345678900'), false);

  // Wrong length
  assert.strictEqual(isValidCPF('1234567890'), false);
  assert.strictEqual(isValidCPF('123456789012'), false);
});

test('DocumentValidator - isValidCNPJ with valid CNPJs', () => {
  assert.strictEqual(isValidCNPJ('11444777000161'), true);
  assert.strictEqual(isValidCNPJ('11.444.777/0001-61'), true);
});

test('DocumentValidator - isValidCNPJ with invalid CNPJs', () => {
  // All same digits
  assert.strictEqual(isValidCNPJ('00000000000000'), false);
  assert.strictEqual(isValidCNPJ('11111111111111'), false);

  // Wrong check digits
  assert.strictEqual(isValidCNPJ('11444777000100'), false);
});

test('DocumentValidator - formatDocument', () => {
  assert.strictEqual(formatDocument('52998224725', 'CPF'), '529.982.247-25');
  assert.strictEqual(formatDocument('11444777000161', 'CNPJ'), '11.444.777/0001-61');
});

test('DocumentValidator - validateDocument general detection', () => {
  const cpfResult = validateDocument('529.982.247-25');
  assert.strictEqual(cpfResult.isValid, true);
  assert.strictEqual(cpfResult.type, 'CPF');
  assert.strictEqual(cpfResult.clean, '52998224725');

  const cnpjResult = validateDocument('11.444.777/0001-61');
  assert.strictEqual(cnpjResult.isValid, true);
  assert.strictEqual(cnpjResult.type, 'CNPJ');
  assert.strictEqual(cnpjResult.clean, '11444777000161');

  const invalidResult = validateDocument('12345');
  assert.strictEqual(invalidResult.isValid, false);
  assert.ok(invalidResult.error.includes('Tamanho de documento inválido'));
});
