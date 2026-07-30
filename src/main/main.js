const {
  app, BrowserWindow, ipcMain, powerMonitor, Notification, shell, dialog
} = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { initWindowState, saveWindowState } = require('./window-state');
const { getSettings, setSetting } = require('./settings');
const { createTray } = require('./tray');
const { resolveIconPath, loadAppIcon } = require('./icon');

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
  const iconPath = resolveIconPath();

  mainWindow = new BrowserWindow({
    width: windowState.width || 1440,
    height: windowState.height || 900,
    x: windowState.x,
    y: windowState.y,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'Mintzy Plugin',
    icon: iconPath || undefined,
    // Match the renderer's light slate background so there is no dark flash on launch.
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Ensure taskbar / dock uses Mintzy mark even if BrowserWindow icon option is ignored.
  if (process.platform === 'darwin' && app.dock) {
    const dockIcon = loadAppIcon(128);
    if (!dockIcon.isEmpty()) app.dock.setIcon(dockIcon);
  }

  mainWindow.on('resize', () => {
    if (mainWindow) saveWindowState(mainWindow.getBounds());
  });
  mainWindow.on('move', () => {
    if (mainWindow) saveWindowState(mainWindow.getBounds());
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in the default browser instead of a new Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting && getSettings().minimizeToTray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// Vite outputs to <project root>/dist/renderer; __dirname is <project root>/src/main.
const RENDERER_INDEX = path.join(__dirname, '..', '..', 'dist', 'renderer', 'index.html');

function loadApp() {
  if (!mainWindow) return;
  mainWindow.loadFile(RENDERER_INDEX);
}

async function revalidateSession() {
  loadApp();
}

app.whenReady().then(async () => {
  createMainWindow();
  createTray(mainWindow, {
    onLogout: () => {
      mainWindow.loadFile(RENDERER_INDEX);
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

  ipcMain.handle('system:get-minimize-to-tray', async () => {
    return getSettings().minimizeToTray;
  });

  ipcMain.handle('system:set-minimize-to-tray', async (_event, enable) => {
    setSetting('minimizeToTray', Boolean(enable));
    return { success: true };
  });

  ipcMain.handle('system:get-notifications', async () => {
    return getSettings().notificationsEnabled !== false;
  });

  ipcMain.handle('system:set-notifications', async (_event, enable) => {
    setSetting('notificationsEnabled', Boolean(enable));
    return { success: true };
  });

  ipcMain.handle('app:get-version', async () => {
    return app.getVersion();
  });

  const canNotify = () => Notification.isSupported() && getSettings().notificationsEnabled !== false;

  ipcMain.on('system:show-notification', (_event, { title, body }) => {
    if (!canNotify()) return;
    const notif = new Notification({
      title,
      body,
      icon: resolveIconPath() || undefined,
    });
    notif.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    notif.show();
  });

  await revalidateSession();

  // --- Auto-Update Logic ---
  if (!isDev) {
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.autoDownload = true;

    autoUpdater.checkForUpdates().catch(err => {
      console.error('Error checking for updates:', err);
    });

    autoUpdater.on('update-available', (info) => {
      if (canNotify()) {
        new Notification({
          title: 'Update Available',
          body: `Mintzy Plugin v${info.version} is being downloaded…`,
          icon: resolveIconPath() || undefined,
        }).show();
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      // Show OS notification (appears even if app is minimized/in tray)
      if (canNotify()) {
        const notification = new Notification({
          title: 'Update Ready to Install',
          body: `Mintzy Plugin v${info.version} has been downloaded. Click to install.`,
          icon: resolveIconPath() || undefined,
        });
        notification.on('click', () => {
          autoUpdater.quitAndInstall();
        });
        notification.show();
      }

      // Also show in-app dialog if the window is visible
      if (mainWindow && mainWindow.isVisible()) {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          buttons: ['Restart and Install Now', 'Later'],
          title: 'Application Update',
          message: `Version ${info.version} is available.`,
          detail: 'A new version has been downloaded. Restart the application to apply the updates.'
        }).then((returnValue) => {
          if (returnValue.response === 0) {
            autoUpdater.quitAndInstall();
          }
        });
      }
    });
  }
  // -------------------------
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
