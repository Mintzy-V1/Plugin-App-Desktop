const storage = require('./storage');
const api = require('./api');

const isDev = process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged;

const MOCK = {
  valid: 'sk_trade_mock_valid_key_12345',
  expired: 'sk_trade_mock_expired_key_67890',
  brokerExpired: 'sk_trade_mock_broker_expired_99999',
};

function useMock() {
  return isDev && !process.env.MINTZY_API_URL;
}

function mockExchange(apiKey) {
  const trimmed = (apiKey || '').trim();

  if (trimmed === MOCK.expired) {
    return {
      success: false,
      error: 'expired_key',
      message: 'Your Mintzy session has expired. Please re-enter your API key.',
    };
  }

  if (trimmed === MOCK.brokerExpired) {
    return {
      success: false,
      error: 'broker_expired',
      message: 'Your broker session has expired. Please log in to your broker again.',
    };
  }

  if (trimmed !== MOCK.valid) {
    return {
      success: false,
      error: 'invalid_key',
      message: 'Invalid API key. Please check and try again.',
    };
  }

  const accessToken = 'mz_access_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const refreshToken = 'mz_refresh_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const brokerType = 'demo';

  storage.saveCredentials({ apiKey: trimmed, token: accessToken, refreshToken, brokerType });
  return { success: true, accessToken, refreshToken, brokerType };
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function exchangeApiKey(apiKey) {
  if (useMock()) {
    await delay(600);
    return mockExchange(apiKey);
  }
  try {
    const result = await api.exchangeApiKey(apiKey);
    if (result.success) {
      storage.saveCredentials({
        apiKey,
        token: result.accessToken,
        refreshToken: result.refreshToken,
        brokerType: result.brokerType,
      });
    }
    return result;
  } catch (e) {
    return {
      success: false,
      error: 'network',
      message: 'Unable to connect to authentication server. Please try again.',
    };
  }
}

async function handleAuthLogin(apiKey) {
  return exchangeApiKey(apiKey);
}

async function handleAuthRevalidate() {
  const creds = storage.getCredentials();
  if (!creds || !creds.apiKey) {
    return { authenticated: false };
  }
  const result = await exchangeApiKey(creds.apiKey);
  if (!result.success) {
    storage.clearCredentials();
    return { authenticated: false, error: result.error, message: result.message };
  }
  return {
    authenticated: true,
    token: result.accessToken,
    refreshToken: result.refreshToken,
    brokerType: result.brokerType,
  };
}

function handleAuthLogout() {
  storage.clearCredentials();
  return { success: true };
}

function handleAuthCheck() {
  const creds = storage.getCredentials();
  if (!creds) return { authenticated: false };
  return { authenticated: true, token: creds.token, brokerType: creds.brokerType, refreshToken: creds.refreshToken || null };
}

module.exports = { handleAuthLogin, handleAuthRevalidate, handleAuthLogout, handleAuthCheck };
