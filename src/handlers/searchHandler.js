/**
 * Handler for User Search by CPF
 * Route: GET /users/{cpf} or GET /users?cpf=...
 */

const { validateDocument } = require('../documentValidator');
const { findUserByDocument } = require('../keycloakService');

async function handleSearch(cpfParam) {
  if (!cpfParam) {
    return {
      statusCode: 400,
      body: {
        error: 'Bad Request',
        message: 'O parâmetro CPF é obrigatório para a consulta.'
      }
    };
  }

  // 1. Validate CPF
  const validation = validateDocument(cpfParam);
  if (!validation.isValid || validation.type !== 'CPF') {
    return {
      statusCode: 400,
      body: {
        error: 'Invalid CPF',
        message: validation.error || 'O documento informado não é um CPF válido.'
      }
    };
  }

  // 2. Query Keycloak
  try {
    const user = await findUserByDocument(validation.clean);

    if (!user) {
      return {
        statusCode: 404,
        body: {
          exists: false,
          status: 'NOT_FOUND',
          cpf: validation.clean,
          formatted_cpf: validation.formatted,
          message: 'Nenhum usuário localizado com o CPF informado.'
        }
      };
    }

    const roles = user.attributes?.role || ['CUSTOMER'];

    return {
      statusCode: 200,
      body: {
        exists: true,
        status: user.enabled ? 'ACTIVE' : 'DISABLED',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          cpf: validation.clean,
          formatted_cpf: validation.formatted,
          roles: roles,
          created_at: user.createdTimestamp
        }
      }
    };
  } catch (error) {
    console.error('Error in handleSearch:', error.message);
    return {
      statusCode: 500,
      body: {
        error: 'Search Error',
        message: error.message
      }
    };
  }
}

module.exports = { handleSearch };
