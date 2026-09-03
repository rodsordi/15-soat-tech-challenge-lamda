/**
 * Handler for User Registration (Customer / Employee)
 * Route: POST /register or POST /users
 */

const { validateDocument } = require('../documentValidator');
const { createUser } = require('../keycloakService');

async function handleRegister(body) {
  const { name, email, document, password, role = 'CUSTOMER' } = body || {};

  if (!name || !email || !document || !password) {
    return {
      statusCode: 400,
      body: {
        error: 'Bad Request',
        message: 'Os campos name, email, document (CPF/CNPJ) e password são obrigatórios.'
      }
    };
  }

  // 1. Validate Document (CPF / CNPJ)
  const validation = validateDocument(document);
  if (!validation.isValid) {
    return {
      statusCode: 400,
      body: {
        error: 'Invalid Document',
        message: validation.error,
        document_type: validation.type || 'UNKNOWN'
      }
    };
  }

  // 2. Validate Role
  const normalizedRole = role.toUpperCase();
  if (normalizedRole !== 'CUSTOMER' && normalizedRole !== 'EMPLOYEE') {
    return {
      statusCode: 400,
      body: {
        error: 'Invalid Role',
        message: "O campo role deve ser 'CUSTOMER' ou 'EMPLOYEE'."
      }
    };
  }

  // 3. Create User in Keycloak
  try {
    const createdUser = await createUser({
      name,
      email,
      document: validation.clean,
      documentType: validation.type,
      password,
      role: normalizedRole
    });

    return {
      statusCode: 201,
      body: {
        success: true,
        message: 'Usuário cadastrado com sucesso no Keycloak.',
        user: {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          document: validation.clean,
          formatted_document: validation.formatted,
          document_type: validation.type,
          role: normalizedRole
        }
      }
    };
  } catch (error) {
    console.error('Error in handleRegister:', error.message);
    const isConflict = error.message.includes('já cadastrado') || error.message.includes('409');
    return {
      statusCode: isConflict ? 409 : 500,
      body: {
        error: isConflict ? 'Conflict' : 'Registration Error',
        message: error.message
      }
    };
  }
}

module.exports = { handleRegister };
