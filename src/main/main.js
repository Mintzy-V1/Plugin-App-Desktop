const {
  app, BrowserWindow, ipcMain, powerMonitor, Notification, shell, dialog
} = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { initWindowState, saveWindowState } = require('./window-state');
const { getSettings, setSetting } = require('./settings');
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
    // Match the renderer's light slate background so there is no dark flash on launch.
    backgroundColor: '#f8fafc',
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

  ipcMain.handle('app:get-version', async () => {
    return app.getVersion();
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

  // --- Auto-Update Logic ---
  // We only check for updates in production builds
  if (!isDev) {
    
    // 1. Configure the updater to download silently, but NOT automatically install on quit without asking
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.autoDownload = true;

    // 2. Start checking for updates
    autoUpdater.checkForUpdates().catch(err => {
      console.error("Error checking for updates:", err);
    });

    // 3. When an update is fully downloaded, prompt the user
    autoUpdater.on('update-downloaded', (info) => {
      const dialogOpts = {
        type: 'info',
        buttons: ['Restart and Install Now', 'Later'],
        title: 'Application Update',
        message: `Version ${info.version} is available.`,
        detail: 'A new version has been downloaded. Restart the application to apply the updates.'
      };

      dialog.showMessageBox(dialogOpts).then((returnValue) => {
        if (returnValue.response === 0) {
          // If the user clicked the first button ("Restart and Install Now")
          autoUpdater.quitAndInstall();
        }
      });
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
