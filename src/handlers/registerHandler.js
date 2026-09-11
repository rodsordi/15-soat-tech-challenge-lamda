/**
 * Handler for User Registration (Customer / Employee)
 * Route: POST /register or POST /users
 * Pattern: Backend Orchestration with Saga Compensation (Rollback)
 */

const { validateDocument } = require('../documentValidator');
const keycloakService = require('../keycloakService');
const garageService = require('../garageService');

async function handleRegister(body) {
  const { name, email, document, password, role = 'CUSTOMER', vehicles = [] } = body || {};

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

  // 3. Step 1 of Saga: Create User in Keycloak
  let createdUser;
  try {
    createdUser = await keycloakService.createUser({
      name,
      email,
      document: validation.clean,
      documentType: validation.type,
      password,
      role: normalizedRole
    });
  } catch (error) {
    console.error('Error in Keycloak user creation:', error.message);
    const isConflict = error.message.includes('já cadastrado') || error.message.includes('409');
    return {
      statusCode: isConflict ? 409 : 500,
      body: {
        error: isConflict ? 'Conflict' : 'Registration Error',
        message: error.message
      }
    };
  }

  // 4. Step 2 of Saga: Propagate to api-garage catalog with Unified ID
  let catalogResult = null;
  try {
    if (normalizedRole === 'EMPLOYEE') {
      catalogResult = await garageService.createEmployee({
        id: createdUser.id,
        name,
        email,
        cpf: validation.clean
      });
    } else {
      catalogResult = await garageService.createCustomer({
        id: createdUser.id,
        name,
        email,
        document: validation.clean,
        vehicles
      });
    }

    return {
      statusCode: 201,
      body: {
        success: true,
        message: 'Usuário cadastrado com sucesso no Keycloak e no catálogo da oficina.',
        user: {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          document: validation.clean,
          formatted_document: validation.formatted,
          document_type: validation.type,
          role: normalizedRole
        },
        catalog: catalogResult
      }
    };
  } catch (apiError) {
    console.error(`api-garage catalog creation failed for ${normalizedRole}. Initiating Saga compensation (rollback)...`, apiError.message);

    // Step 3 of Saga: Compensating Action (Rollback)
    const rollbackSuccess = await keycloakService.deleteUser(createdUser.id);
    console.log(`Rollback compensation status for user ${createdUser.id}: ${rollbackSuccess ? 'SUCCESS' : 'FAILED'}`);

    return {
      statusCode: 502,
      body: {
        error: 'Catalog Integration Error',
        message: `Falha ao registrar dados no catálogo da oficina (${apiError.message}). O cadastro no Keycloak foi revertido para garantir a consistência do sistema.`,
        rollback_executed: rollbackSuccess
      }
    };
  }
}

module.exports = { handleRegister };
