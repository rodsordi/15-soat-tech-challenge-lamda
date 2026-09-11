/**
 * Garage API Service
 * Integrates with api-garage resource server for catalog persistence
 */

const RAW_GARAGE_API_URL = (process.env.GARAGE_API_URL || 'http://api-garage.garage.svc.cluster.local:8080').replace(/\/$/, '');
const GARAGE_API_URL = RAW_GARAGE_API_URL.endsWith('/api') ? RAW_GARAGE_API_URL : `${RAW_GARAGE_API_URL}/api`;
const DEFAULT_TIMEOUT_MS = parseInt(process.env.GARAGE_API_TIMEOUT_MS || '5000', 10);


/**
 * Creates an employee in api-garage catalog
 * @param {Object} employee - { id, name, email, cpf }
 * @returns {Promise<Object>}
 */
async function createEmployee({ id, name, email, cpf }) {
  const endpoint = `${GARAGE_API_URL}/v1/employees`;
  const payload = { id, name, email, cpf };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  });

  if (!response.ok && response.status !== 201) {
    const errorText = await response.text();
    console.error(`api-garage employee creation failed: HTTP ${response.status}`, errorText);
    const error = new Error(`Falha ao registrar funcionário no catálogo da oficina (HTTP ${response.status}): ${errorText || response.statusText}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

/**
 * Creates a customer in api-garage catalog
 * @param {Object} customer - { id, name, email, document, vehicles }
 * @returns {Promise<Object>}
 */
async function createCustomer({ id, name, email, document, vehicles = [] }) {
  const endpoint = `${GARAGE_API_URL}/v1/customers`;
  const payload = {
    id,
    name,
    email,
    document,
    vehicles: vehicles || []
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  });

  if (!response.ok && response.status !== 201) {
    const errorText = await response.text();
    console.error(`api-garage customer creation failed: HTTP ${response.status}`, errorText);
    const error = new Error(`Falha ao registrar cliente no catálogo da oficina (HTTP ${response.status}): ${errorText || response.statusText}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

module.exports = {
  createEmployee,
  createCustomer,
  GARAGE_API_URL
};
