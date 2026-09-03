/**
 * Handler for User Authentication and JWT Issuance
 * Route: POST /auth/login or POST /login
 */

const { sanitizeDocument } = require('../documentValidator');
const { authenticate } = require('../keycloakService');

async function handleAuth(body) {
  const { username, password, cpf, email } = body || {};
  const userIdentifier = username || cpf || email;

  if (!userIdentifier || !password) {
    return {
      statusCode: 400,
      body: {
        error: 'Bad Request',
        message: 'Os campos de identificação (username/cpf/email) e password são obrigatórios.'
      }
    };
  }

  // Clean document digits if it's a numeric CPF/CNPJ
  const cleanIdentifier = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(userIdentifier) || /^\d{11}$/.test(userIdentifier)
    ? sanitizeDocument(userIdentifier)
    : userIdentifier;

  try {
    const authResult = await authenticate({
      username: cleanIdentifier,
      password: password
    });

    if (!authResult.success) {
      return {
        statusCode: authResult.status || 401,
        body: {
          error: authResult.error,
          message: authResult.message
        }
      };
    }

    return {
      statusCode: 200,
      body: {
        access_token: authResult.data.access_token,
        token_type: authResult.data.token_type,
        expires_in: authResult.data.expires_in,
        refresh_token: authResult.data.refresh_token,
        scope: authResult.data.scope
      }
    };
  } catch (error) {
    console.error('Error in handleAuth:', error.message);
    return {
      statusCode: 500,
      body: {
        error: 'Authentication Error',
        message: error.message || 'Erro ao comunicar com o servidor de autenticação.'
      }
    };
  }
}

module.exports = { handleAuth };
