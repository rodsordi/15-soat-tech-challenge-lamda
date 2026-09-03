/**
 * AWS Lambda Auth & User Management Handler (Router)
 * Supports 3 endpoints:
 * 1. POST /register (or /users) - Registration with CPF/CNPJ validation
 * 2. GET /users/{cpf} - User search and status by CPF
 * 3. POST /auth/login (or /login, /) - User authentication and JWT issuance
 */

const { handleRegister } = require('./handlers/registerHandler');
const { handleSearch } = require('./handlers/searchHandler');
const { handleAuth } = require('./handlers/authHandler');

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

function parseBody(event) {
  if (!event.body) return {};
  try {
    return event.isBase64Encoded
      ? JSON.parse(Buffer.from(event.body, 'base64').toString('utf-8'))
      : (typeof event.body === 'string' ? JSON.parse(event.body) : event.body);
  } catch (err) {
    return null; // Malformed JSON
  }
}

function extractPath(event) {
  // Support Function URL rawPath, HTTP path or API Gateway path
  return event.rawPath || event.requestContext?.http?.path || event.path || '/';
}

function extractMethod(event) {
  return (event.requestContext?.http?.method || event.httpMethod || 'GET').toUpperCase();
}

exports.handler = async (event) => {
  const method = extractMethod(event);
  const path = extractPath(event);

  console.log(`Incoming request: ${method} ${path}`);

  // 1. Handle Preflight CORS
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  // 2. Parse JSON Body for POST/PUT requests
  let body = {};
  if (method === 'POST' || method === 'PUT') {
    body = parseBody(event);
    if (body === null) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Payload JSON inválido ou mal formatado.'
        })
      };
    }
  }

  try {
    let result = null;

    // --- ROUTE 1: Cadastro de Cliente / Funcionário (POST /register ou POST /users) ---
    if (method === 'POST' && (path === '/register' || path === '/users')) {
      result = await handleRegister(body);
    }

    // --- ROUTE 2: Consulta por CPF (GET /users/{cpf} ou GET /users?cpf=...) ---
    else if (method === 'GET' && (path.startsWith('/users') || path === '/search')) {
      // Extract CPF from path '/users/12345678900' or query parameter '?cpf=12345678900'
      const pathParts = path.split('/').filter(Boolean);
      let cpfParam = null;

      if (pathParts.length >= 2 && pathParts[0] === 'users') {
        cpfParam = decodeURIComponent(pathParts[1]);
      } else if (event.queryStringParameters?.cpf) {
        cpfParam = event.queryStringParameters.cpf;
      }

      result = await handleSearch(cpfParam);
    }

    // --- ROUTE 3: Autenticação (POST /auth/login, POST /login, POST /auth ou POST /) ---
    else if (method === 'POST' && (path === '/auth/login' || path === '/login' || path === '/auth' || path === '/')) {
      result = await handleAuth(body);
    }

    // --- HEALTH / INFO ROUTE (GET / ou GET /health) ---
    else if (method === 'GET' && (path === '/' || path === '/health')) {
      result = {
        statusCode: 200,
        body: {
          service: '15-soat-tech-challenge-lamda',
          status: 'UP',
          endpoints: [
            { method: 'POST', path: '/register', description: 'Cadastro de cliente/funcionário com validação de CPF/CNPJ' },
            { method: 'GET', path: '/users/{cpf}', description: 'Consulta de usuário por CPF e status na base' },
            { method: 'POST', path: '/auth/login', description: 'Autenticação de usuário e emissão de JWT' }
          ]
        }
      };
    }

    // --- 404 NOT FOUND ---
    else {
      result = {
        statusCode: 404,
        body: {
          error: 'Not Found',
          message: `Rota não encontrada: ${method} ${path}`,
          available_routes: [
            'POST /register',
            'GET /users/{cpf}',
            'POST /auth/login'
          ]
        }
      };
    }

    return {
      statusCode: result.statusCode,
      headers: CORS_HEADERS,
      body: JSON.stringify(result.body)
    };
  } catch (error) {
    console.error('Unhandled error in Lambda Router:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message || 'Erro interno ao processar a requisição.'
      })
    };
  }
};
