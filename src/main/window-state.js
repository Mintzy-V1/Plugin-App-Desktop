const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const STATE_FILE = 'window-state.json';

function getPath() {
  return path.join(app.getPath('userData'), STATE_FILE);
}

function initWindowState() {
  const defaults = { width: 1440, height: 900 };
  try {
    if (fs.existsSync(getPath())) {
      return { ...defaults, ...JSON.parse(fs.readFileSync(getPath(), 'utf-8')) };
    }
  } catch (e) {
  }
  return defaults;
}

function saveWindowState(bounds) {
  try {
    fs.writeFileSync(getPath(), JSON.stringify({
      width: bounds.width, height: bounds.height,
      x: bounds.x, y: bounds.y,
    }), 'utf-8');
  } catch (e) {
  }
}

module.exports = { initWindowState, saveWindowState };
