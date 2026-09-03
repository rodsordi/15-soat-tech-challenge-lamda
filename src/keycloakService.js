/**
 * Keycloak Service for Admin Operations and Authentication
 */

const KEYCLOAK_URL = (process.env.KEYCLOAK_URL || 'http://keycloak.garage.svc.cluster.local:8080').replace(/\/$/, '');
const REALM = process.env.KEYCLOAK_REALM || 'garage';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'garage-client';
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || '';
const ADMIN_USER = process.env.KEYCLOAK_ADMIN || 'admin';
const ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'Admin@2026!';

/**
 * Obtains an Admin Access Token from Keycloak Master Realm
 * @returns {Promise<string>}
 */
async function getAdminToken() {
  const tokenEndpoint = `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`;
  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('client_id', 'admin-cli');
  params.append('username', ADMIN_USER);
  params.append('password', ADMIN_PASSWORD);

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    const errData = await response.text();
    console.error('Failed to get Keycloak Admin Token:', response.status, errData);
    throw new Error(`Falha ao autenticar administrador no Keycloak: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Creates a new user in Keycloak
 * @param {Object} userData
 * @returns {Promise<Object>}
 */
async function createUser({ name, email, document, documentType, password, role = 'CUSTOMER' }) {
  const adminToken = await getAdminToken();
  const usersEndpoint = `${KEYCLOAK_URL}/admin/realms/${REALM}/users`;

  // Split name into first and last name
  const nameParts = (name || '').trim().split(' ');
  const firstName = nameParts[0] || 'Usuário';
  const lastName = nameParts.slice(1).join(' ') || '';

  const userPayload = {
    username: document, // Document is the unique username
    email: email,
    firstName: firstName,
    lastName: lastName,
    enabled: true,
    emailVerified: true,
    attributes: {
      cpf: [document],
      document: [document],
      documentType: [documentType],
      role: [role]
    },
    credentials: [
      {
        type: 'password',
        value: password,
        temporary: false
      }
    ]
  };

  const response = await fetch(usersEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userPayload)
  });

  if (response.status === 409) {
    throw new Error('Usuário já cadastrado com este documento/CPF ou e-mail.');
  }

  if (!response.ok && response.status !== 201) {
    const errText = await response.text();
    console.error('Keycloak user creation error:', response.status, errText);
    throw new Error(`Erro ao criar usuário no Keycloak: ${errText || response.statusText}`);
  }

  // Get the created user ID from Location header or by querying
  const locationHeader = response.headers.get('location');
  let userId = null;
  if (locationHeader) {
    const parts = locationHeader.split('/');
    userId = parts[parts.length - 1];
  }

  return {
    id: userId,
    name: name,
    email: email,
    document: document,
    documentType: documentType,
    role: role
  };
}

/**
 * Finds user by document (CPF/CNPJ) or username
 * @param {string} document 
 * @returns {Promise<Object|null>}
 */
async function findUserByDocument(document) {
  const adminToken = await getAdminToken();
  const searchEndpoint = `${KEYCLOAK_URL}/admin/realms/${REALM}/users?username=${encodeURIComponent(document)}&exact=true`;

  const response = await fetch(searchEndpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Keycloak user search error:', response.status, errText);
    throw new Error(`Erro ao consultar usuário no Keycloak: ${response.statusText}`);
  }

  const users = await response.json();
  if (!users || users.length === 0) {
    return null;
  }

  const user = users[0];
  return {
    id: user.id,
    username: user.username,
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    email: user.email,
    enabled: user.enabled,
    createdTimestamp: user.createdTimestamp,
    attributes: user.attributes || {}
  };
}

/**
 * Authenticates user and generates JWT via Keycloak OIDC
 * @param {Object} credentials 
 * @returns {Promise<Object>}
 */
async function authenticate({ username, password }) {
  const tokenEndpoint = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`;
  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('client_id', CLIENT_ID);
  if (CLIENT_SECRET) {
    params.append('client_secret', CLIENT_SECRET);
  }
  params.append('username', username);
  params.append('password', password);

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      status: response.status,
      error: data.error || 'Unauthorized',
      message: data.error_description || 'Credenciais inválidas ou usuário inativo.'
    };
  }

  return {
    success: true,
    data: {
      access_token: data.access_token,
      token_type: data.token_type || 'Bearer',
      expires_in: data.expires_in,
      refresh_token: data.refresh_token,
      scope: data.scope
    }
  };
}

module.exports = {
  getAdminToken,
  createUser,
  findUserByDocument,
  authenticate
};
