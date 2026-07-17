const { net } = require('electron');

const API_BASE_URL = process.env.MINTZY_API_URL || 'https://www.mintzy.in';

async function exchangeApiKey(apiKey) {
  const url = `${API_BASE_URL}/api/auth/exchange-api-key`;

  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      url,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    request.on('response', (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (response.statusCode === 200 && data.success) {
            resolve({
              success: true,
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              brokerType: data.brokerType,
              user: data.user,
            });
          } else {
            resolve({
              success: false,
              error: data.message === 'API key has been revoked' ? 'expired_key' : 'invalid_key',
              message: data.message || 'Authentication failed',
            });
          }
        } catch (e) {
          reject(new Error('Invalid response from server'));
        }
      });
    });

    request.on('error', (err) => {
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
          message: 'Network error. Please check your connection and try again.',
        });
      }
    });

    request.write(JSON.stringify({ apiKey }));
    request.end();
  });
}

module.exports = { exchangeApiKey };
