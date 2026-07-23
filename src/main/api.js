const { net } = require('electron');
const storage = require('./storage');

const API_BASE_URL = process.env.MINTZY_API_URL || 'http://localhost:3000/api/v1';

// Base Request Function
function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const method = options.method || 'GET';
  
  return new Promise((resolve, reject) => {
    const req = net.request({
      method,
      url,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
    });

    if (options.auth) {
      const creds = storage.getCredentials();
      if (creds && creds.token) {
        req.setHeader('Authorization', `Bearer ${creds.token}`);
      } else if (options.tokenOverride) {
        req.setHeader('Authorization', `Bearer ${options.tokenOverride}`);
      }
    }

    req.on('response', (response) => {
      // Check for auto-refreshed JWT
      const refreshedJwt = response.headers['x-refreshed-jwt'];
      if (refreshedJwt) {
        const newJwt = Array.isArray(refreshedJwt) ? refreshedJwt[0] : refreshedJwt;
        const creds = storage.getCredentials() || {};
        creds.token = newJwt;
        storage.saveCredentials(creds);
      }

      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(data);
          } else {
            resolve({
              success: false,
              statusCode: response.statusCode,
              message: data.message || 'Request failed',
              details: data.details || null
            });
          }
        } catch (e) {
          resolve({
            success: false,
            message: 'Invalid response from server'
          });
        }
      });
    });

    req.on('error', (err) => {
      if (err.message && err.message.includes('ERR_CONNECTION_REFUSED')) {
        resolve({
          success: false,
          error: 'network',
          message: 'Unable to connect to Mintzy servers. Please check your internet connection.',
        });
      } else {
        resolve({
          success: false,
          error: 'network',
          message: err.message || 'Network error. Please check your connection and try again.',
        });
      }
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

// System Routes
const system = {
  getHealth: () => request('/system/health'),
  getReady: () => request('/system/ready'),
};

// User Routes
const users = {
  onboard: (apiKey) => request('/users/onboard', { method: 'POST', body: { apiKey } }),
  updateBroker: (userId, broker) => request('/users/broker', { method: 'POST', body: { userId, broker } }),
  refresh: (token) => request('/users/refresh', { method: 'POST', auth: true, tokenOverride: token, body: { token } }),
  getPlan: (apiKey) => request('/users/plan', { method: 'POST', body: { apiKey } }),
  getDetail: (email) => request(`/users/detail?email=${encodeURIComponent(email)}`),
};

// Trading Factory
function createBrokerApi(prefix) {
  return {
    // Sessions
    start: (body) => request(`/${prefix}/start`, { method: 'POST', auth: true, body }),
    stopByParam: (sessionId) => request(`/${prefix}/stop/${sessionId}`, { method: 'POST', auth: true }),
    stop: (sessionId) => request(`/${prefix}/stop`, { method: 'POST', auth: true, body: { sessionId } }),
    stopSession: (sessionId) => request(`/${prefix}/sessions/${sessionId}/stop`, { method: 'POST', auth: true }),
    stopOldSessions: () => request(`/${prefix}/sessions/stop-old`, { method: 'POST', auth: true }),
    flushSessions: () => request(`/${prefix}/sessions/flush`, { method: 'DELETE', auth: true }),
    deleteInvalidSessions: () => request(`/${prefix}/sessions/invalid`, { method: 'DELETE', auth: true }),
    
    // Trading Data
    getLogs: (sessionId) => request(`/${prefix}/sessions/${sessionId}/trades`, { auth: true }),
    getStatus: (sessionId) => request(`/${prefix}/sessions/${sessionId}/status`, { auth: true }),
    downloadLogs: (sessionId) => request(`/${prefix}/sessions/${sessionId}/download`, { auth: true }),
    listSessions: () => request(`/${prefix}/trading/sessions`, { auth: true }),
    getSession: (id) => request(`/${prefix}/trading/sessions/${id}`, { auth: true }),
    getActiveSession: () => request(`/${prefix}/trading/active-session`, { auth: true }),
    getLivePnl: (sessionId) => request(`/${prefix}/trading/live-pnl/${sessionId}`, { auth: true }),
    getLivePnlHistory: (sessionId) => request(`/${prefix}/trading/live-pnl/${sessionId}/history`, { auth: true }),
    getFinalTradebook: (sessionId) => request(`/${prefix}/trading/${sessionId}/final-tradebook`, { auth: true }),
    
    // Symbol & Session Control
    exitSymbol: (sessionId, symbol) => request(`/${prefix}/${sessionId}/exit-symbol/${symbol}`, { method: 'POST', auth: true }),
    deleteSession: (sessionId) => request(`/${prefix}/trading/session/${sessionId}`, { method: 'DELETE', auth: true }),
    abandonSession: (sessionId) => request(`/${prefix}/trading/${sessionId}/abandon`, { method: 'POST', auth: true }),
    
    // Credentials & Auth
    submitCredentials: (body) => request(`/${prefix}/credentials`, { method: 'POST', auth: true, body }),
    submitTotp: (body) => request(`/${prefix}/totp`, { method: 'POST', auth: true, body }),
    
    // Saved Configs
    listConfigs: () => request(`/${prefix}/saved-configurations`, { auth: true }),
    getConfig: (configId) => request(`/${prefix}/saved-configurations/${configId}`, { auth: true }),
    createConfig: (body) => request(`/${prefix}/saved-configurations`, { method: 'POST', auth: true, body }),
    updateConfig: (configId, body) => request(`/${prefix}/saved-configurations/${configId}`, { method: 'PUT', auth: true, body }),
    deleteConfig: (configId) => request(`/${prefix}/saved-configurations/${configId}`, { method: 'DELETE', auth: true }),
    
    // Dashboard & Admin
    getDashboard: () => request(`/${prefix}/dashboard`, { auth: true }),
    getPnl: () => request(`/${prefix}/dashboard/pnl`, { auth: true }),
    getAggregatePnl: () => request(`/${prefix}/dashboard/pnl/aggregate`, { auth: true }),
    adminStopSession: (sessionId) => request(`/${prefix}/admin/sessions/${sessionId}/stop`, { method: 'POST', auth: true }),
    adminForceStopAll: () => request(`/${prefix}/admin/force-stop-all`, { method: 'POST', auth: true }),
    getHealth: () => request(`/${prefix}/health`, { auth: true }),
  };
}

const angleOne = createBrokerApi('angle_one');
const tradex = createBrokerApi('tradex');

// Legacy compatibility wrapper (if needed for migration)
async function exchangeApiKey(apiKey) {
  const result = await users.onboard(apiKey);
  if (result.success) {
    return {
      success: true,
      accessToken: result.jwt,
      refreshToken: result.jwt, // The new system uses a single auto-refreshing JWT
      brokerType: result.broker || 'angle one',
      user: result.user
    };
  }
  return {
    success: false,
    error: 'invalid_key',
    message: result.message || 'Authentication failed'
  };
}

module.exports = {
  request,
  system,
  users,
  angleOne,
  tradex,
  exchangeApiKey,
};
