/**
 * Handler for User Authentication and JWT Issuance
 * Route: POST /auth/login or POST /login
 */

const { validateDocument } = require('../documentValidator');
const keycloakService = require('../keycloakService');

async function handleAuth(body) {
  const { username, password, cpf } = body || {};
  const userIdentifier = username || cpf;

  if (!userIdentifier || !password) {
    return {
      statusCode: 400,
      body: {
        error: 'Bad Request',
        message: 'Os campos de identificação (username/cpf) e password são obrigatórios.'
      }
    };
  }

  const validation = validateDocument(userIdentifier);
  if (!validation.isValid || validation.type !== 'CPF') {
    return {
      statusCode: 400,
      body: {
        error: 'Invalid Document',
        message: validation.error || 'O campo username/cpf deve ser um CPF válido (11 dígitos).'
      }
    };
  }

  try {
    const authResult = await keycloakService.authenticate({
      username: validation.clean,
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
