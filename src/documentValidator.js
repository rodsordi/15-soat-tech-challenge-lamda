/**
 * Document Validator for CPF and CNPJ (Modulo 11 Brazilian Federal Revenue Algorithm)
 */

function sanitizeDocument(doc) {
  if (!doc || typeof doc !== 'string') return '';
  return doc.replace(/\D/g, '');
}

/**
 * Validates CPF format and check digits
 * @param {string} cpf 
 * @returns {boolean}
 */
function isValidCPF(cpf) {
  const clean = sanitizeDocument(cpf);
  if (clean.length !== 11) return false;

  // Reject known invalid all-same-digit CPFs (00000000000, 11111111111, etc.)
  if (/^(\d)\1{10}$/.test(clean)) return false;

  // Calculate 1st check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let firstDigit = (sum * 10) % 11;
  if (firstDigit === 10 || firstDigit === 11) firstDigit = 0;
  if (firstDigit !== parseInt(clean.charAt(9), 10)) return false;

  // Calculate 2nd check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  let secondDigit = (sum * 10) % 11;
  if (secondDigit === 10 || secondDigit === 11) secondDigit = 0;
  if (secondDigit !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

/**
 * Validates CNPJ format and check digits
 * @param {string} cnpj 
 * @returns {boolean}
 */
function isValidCNPJ(cnpj) {
  const clean = sanitizeDocument(cnpj);
  if (clean.length !== 14) return false;

  // Reject known invalid all-same-digit CNPJs
  if (/^(\d)\1{13}$/.test(clean)) return false;

  // Calculate 1st check digit
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(clean.charAt(i), 10) * weights1[i];
  }
  let remainder = sum % 11;
  let firstDigit = remainder < 2 ? 0 : 11 - remainder;
  if (firstDigit !== parseInt(clean.charAt(12), 10)) return false;

  // Calculate 2nd check digit
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(clean.charAt(i), 10) * weights2[i];
  }
  remainder = sum % 11;
  let secondDigit = remainder < 2 ? 0 : 11 - remainder;
  if (secondDigit !== parseInt(clean.charAt(13), 10)) return false;

  return true;
}

/**
 * Formats a clean document with its standard mask
 * @param {string} clean 
 * @param {'CPF' | 'CNPJ'} type 
 * @returns {string}
 */
function formatDocument(clean, type) {
  if (type === 'CPF' && clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (type === 'CNPJ' && clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return clean;
}

/**
 * General document validator detecting CPF vs CNPJ
 * @param {string} doc 
 * @returns {{ isValid: boolean, type?: 'CPF' | 'CNPJ', clean: string, formatted: string, error?: string }}
 */
function validateDocument(doc) {
  const clean = sanitizeDocument(doc);

  if (!clean) {
    return {
      isValid: false,
      clean: '',
      formatted: '',
      error: 'O documento (CPF ou CNPJ) é obrigatório e deve conter apenas números.'
    };
  }

  if (clean.length === 11) {
    const valid = isValidCPF(clean);
    return {
      isValid: valid,
      type: 'CPF',
      clean,
      formatted: formatDocument(clean, 'CPF'),
      error: valid ? null : 'CPF inválido (dígitos verificadores incorretos ou sequência repetida).'
    };
  }

  if (clean.length === 14) {
    const valid = isValidCNPJ(clean);
    return {
      isValid: valid,
      type: 'CNPJ',
      clean,
      formatted: formatDocument(clean, 'CNPJ'),
      error: valid ? null : 'CNPJ inválido (dígitos verificadores incorretos ou sequência repetida).'
    };
  }

  return {
    isValid: false,
    clean,
    formatted: clean,
    error: `Tamanho de documento inválido (${clean.length} dígitos). CPF deve ter 11 dígitos e CNPJ deve ter 14 dígitos.`
  };
}

module.exports = {
  sanitizeDocument,
  isValidCPF,
  isValidCNPJ,
  formatDocument,
  validateDocument
};
