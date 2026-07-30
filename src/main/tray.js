const { Tray, Menu, app } = require('electron');
const { loadAppIcon } = require('./icon');

let tray = null;

function createTray(mainWindow, callbacks) {
  // Windows taskbar / tray needs a small crisp icon; resize from Mintzy mark.
  const icon = loadAppIcon(process.platform === 'win32' ? 32 : 16);
  tray = new Tray(icon.isEmpty() ? loadAppIcon() : icon);
  tray.setToolTip('Mintzy Plugin');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Mintzy',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
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

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

module.exports = { createTray, destroyTray };
