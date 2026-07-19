const {
  app, BrowserWindow, ipcMain, powerMonitor, Notification
} = require('electron');
const path = require('path');
const { initWindowState, saveWindowState } = require('./window-state');
const { createTray } = require('./tray');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow = null;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createMainWindow() {
  const windowState = initWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width || 1440,
    height: windowState.height || 900,
    x: windowState.x,
    y: windowState.y,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'Mintzy Plugin',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.on('resize', () => {
    if (mainWindow) saveWindowState(mainWindow.getBounds());
  });
  mainWindow.on('move', () => {
    if (mainWindow) saveWindowState(mainWindow.getBounds());
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function loadApp() {
  if (!mainWindow) return;
  const rendererPath = path.join(__dirname, '..', 'dist', 'renderer', 'index.html');
  mainWindow.loadFile(rendererPath);
}

async function revalidateSession() {
  loadApp();
}

app.whenReady().then(async () => {
  createMainWindow();
  createTray(mainWindow, {
    onLogout: () => {
      mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'index.html'));
    },
  });

  ipcMain.handle('window:get-state', async () => {
    return initWindowState();
  });

  ipcMain.on('window:save-state', (_event, bounds) => {
    saveWindowState(bounds);
  });

  ipcMain.handle('system:get-auto-launch', async () => {
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle('system:set-auto-launch', async (_event, enable) => {
    app.setLoginItemSettings({ openAtLogin: enable });
    return { success: true };
  });

  ipcMain.on('system:show-notification', (_event, { title, body }) => {
    if (Notification.isSupported()) {
      const notif = new Notification({ title, body });
      notif.on('click', () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      });
      notif.show();
    }
  });

  await revalidateSession();
});

powerMonitor.on('resume', () => {
  if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('system:resume');
    revalidateSession();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
});

module.exports = { loadApp };
