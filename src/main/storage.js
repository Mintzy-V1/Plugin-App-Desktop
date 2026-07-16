const { safeStorage, app } = require('electron');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_FILE = 'credentials.enc';
const FALLBACK_SUFFIX = '.b64';

function getPath() {
  return path.join(app.getPath('userData'), CREDENTIALS_FILE);
}

function getFallbackPath() {
  return getPath() + FALLBACK_SUFFIX;
}

function saveCredentials({ apiKey, token, brokerType }) {
  const payload = JSON.stringify({ apiKey, token, brokerType });
  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(getPath(), safeStorage.encryptString(payload));
  } else {
    fs.writeFileSync(getFallbackPath(), Buffer.from(payload).toString('base64'));
  }
}

function getCredentials() {
  try {
    if (fs.existsSync(getPath())) {
      return JSON.parse(safeStorage.decryptString(fs.readFileSync(getPath())));
    }
    if (fs.existsSync(getFallbackPath())) {
      return JSON.parse(Buffer.from(fs.readFileSync(getFallbackPath(), 'utf-8'), 'base64').toString('utf-8'));
    }
  } catch (e) {
    clearCredentials();
  }
  return null;
}

function clearCredentials() {
  try {
    if (fs.existsSync(getPath())) fs.unlinkSync(getPath());
    if (fs.existsSync(getFallbackPath())) fs.unlinkSync(getFallbackPath());
  } catch (e) {
  }
}

module.exports = { saveCredentials, getCredentials, clearCredentials };
