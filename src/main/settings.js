const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const SETTINGS_FILE = 'app-settings.json';
const DEFAULTS = { minimizeToTray: true };

function getPath() {
  return path.join(app.getPath('userData'), SETTINGS_FILE);
}

function getSettings() {
  try {
    if (fs.existsSync(getPath())) {
      return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(getPath(), 'utf-8')) };
    }
  } catch (e) {
  }
  return { ...DEFAULTS };
}

function setSetting(key, value) {
  const settings = { ...getSettings(), [key]: value };
  try {
    fs.writeFileSync(getPath(), JSON.stringify(settings), 'utf-8');
  } catch (e) {
  }
  return settings;
}

module.exports = { getSettings, setSetting };
