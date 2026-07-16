const storage = require('./storage');

const MOCK = {
  valid: 'sk_trade_mock_valid_key_12345',
  expired: 'sk_trade_mock_expired_key_67890',
  brokerExpired: 'sk_trade_mock_broker_expired_99999',
};

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function login(apiKey) {
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

  const token = 'mz_session_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const brokerType = 'demo';

  storage.saveCredentials({ apiKey: trimmed, token, brokerType });
  return { success: true, token, brokerType };
}

async function handleAuthLogin(apiKey) {
  await delay(600);
  return login(apiKey);
}

function handleAuthLogout() {
  storage.clearCredentials();
  return { success: true };
}

function handleAuthCheck() {
  const creds = storage.getCredentials();
  if (!creds) return { authenticated: false };
  return { authenticated: true, token: creds.token, brokerType: creds.brokerType };
}

module.exports = { handleAuthLogin, handleAuthLogout, handleAuthCheck };
