const { Tray, Menu, app } = require('electron');
const { loadAppIcon } = require('./icon');

let tray = null;

function createTray(mainWindow, callbacks = {}) {
  // Windows taskbar / tray needs a small crisp icon; resize from Mintzy mark.
  const icon = loadAppIcon(process.platform === 'win32' ? 32 : 16);
  tray = new Tray(icon.isEmpty() ? loadAppIcon() : icon);
  tray.setToolTip('Mintzy Plugin');

  const openApp = () => {
    if (typeof callbacks.onOpen === 'function') {
      callbacks.onOpen();
      return;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  };

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Mintzy',
      click: openApp,
    },
    { type: 'separator' },
    {
      label: 'Launch at startup',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({ openAtLogin: menuItem.checked });
      },
    },
    { type: 'separator' },
    {
      label: 'Logout',
      click: () => {
        if (callbacks && callbacks.onLogout) callbacks.onLogout();
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Windows: single-click tray icon should reopen the window (users rarely double-click).
  tray.on('click', openApp);
  tray.on('double-click', openApp);

  return tray;
}

function destroyTray() {
  if (tray) {
    try {
      tray.destroy();
    } catch (_) {
      /* ignore */
    }
    tray = null;
  }
}

module.exports = { createTray, destroyTray };
