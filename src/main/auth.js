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

  const token = 'mz_jwt_mock_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const brokerType = 'angle one';

  storage.saveCredentials({ apiKey: trimmed, token, brokerType });
  return { success: true, token, brokerType };
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function handleAuthLogin(apiKey) {
  if (useMock()) {
    await delay(600);
    return mockExchange(apiKey);
  }
  try {
    const result = await api.users.onboard(apiKey);
    if (result.success) {
      storage.saveCredentials({
        apiKey,
        token: result.jwt,
        brokerType: result.broker || 'angle one',
      });
      return {
        success: true,
        token: result.jwt,
        brokerType: result.broker || 'angle one'
      };
    }
    return {
      success: false,
      error: 'invalid_key',
      message: result.message || 'Authentication failed'
    };
  } catch (e) {
    return {
      success: false,
      error: 'network',
      message: 'Unable to connect to authentication server. Please try again.',
    };
  }
}

async function handleAuthRevalidate() {
  const creds = storage.getCredentials();
  if (!creds || !creds.apiKey) {
    return { authenticated: false };
  }

  if (useMock()) {
    await delay(300);
    const result = mockExchange(creds.apiKey);
    if (!result.success) {
      storage.clearCredentials();
      return { authenticated: false, error: result.error, message: result.message };
    }
    return { authenticated: true, token: result.token, brokerType: result.brokerType };
  }

  try {
    // Try to refresh the JWT first if we have one
    if (creds.token) {
      const refreshResult = await api.users.refresh(creds.token);
      if (refreshResult.success) {
        storage.saveCredentials({
          ...creds,
          token: refreshResult.jwt,
          brokerType: refreshResult.broker || creds.brokerType,
        });
        return {
          authenticated: true,
          token: refreshResult.jwt,
          brokerType: refreshResult.broker || creds.brokerType,
        };
      }
    }

    // Fallback to onboarding with API key if JWT refresh failed or was absent
    const onboardResult = await api.users.onboard(creds.apiKey);
    if (onboardResult.success) {
      storage.saveCredentials({
        apiKey: creds.apiKey,
        token: onboardResult.jwt,
        brokerType: onboardResult.broker || 'angle one',
      });
      return {
        authenticated: true,
        token: onboardResult.jwt,
        brokerType: onboardResult.broker || 'angle one',
      };
    }

    // Both failed
    storage.clearCredentials();
    return { authenticated: false, error: 'invalid_key', message: onboardResult.message || 'Session expired.' };
  } catch (e) {
    return { authenticated: false, error: 'network', message: 'Network error during session revalidation.' };
  }
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

module.exports = { handleAuthLogin, handleAuthRevalidate, handleAuthLogout, handleAuthCheck };
