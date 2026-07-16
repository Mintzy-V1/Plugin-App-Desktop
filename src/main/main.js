const {
  app, BrowserWindow, ipcMain, powerMonitor
} = require('electron');
const path = require('path');
const { initWindowState, saveWindowState } = require('./window-state');
const { handleAuthLogin, handleAuthLogout, handleAuthCheck } = require('./auth');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

const PLUGIN_URL = 'https://www.mintzy.in/plugin/sessions';

let mainWindow = null;
let sessionInjected = false;

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

function injectSessionToken(token) {
  if (!mainWindow || !token || sessionInjected) return;
  sessionInjected = true;

  const escaped = token.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  mainWindow.webContents.executeJavaScript(`
    localStorage.setItem('mintzy_token', '${escaped}');
    window.location.reload();
  `);
}

function loadLogin() {
  if (mainWindow) {
    sessionInjected = false;
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'login', 'login.html'));
  }
}

function loadTerminal(sessionContext) {
  if (!mainWindow) return;
  sessionInjected = false;

  mainWindow.loadURL(PLUGIN_URL);

  if (sessionContext && sessionContext.token) {
    mainWindow.webContents.once('did-stop-loading', () => {
      injectSessionToken(sessionContext.token);
    });
  }
}

function loadError(errorType) {
  if (mainWindow) {
    sessionInjected = false;
    mainWindow.loadFile(
      path.join(__dirname, '..', 'renderer', 'error', 'error.html'),
      { query: { type: errorType } }
    );
  }
}

app.whenReady().then(async () => {
  createMainWindow();

  ipcMain.handle('auth:login', async (_event, apiKey) => {
    return handleAuthLogin(apiKey);
  });

  ipcMain.handle('auth:logout', async () => {
    const result = handleAuthLogout();
    loadLogin();
    return result;
  });

  ipcMain.handle('auth:check', async () => {
    return handleAuthCheck();
  });

  ipcMain.on('nav:show-terminal', () => {
    const creds = handleAuthCheck();
    loadTerminal(creds.authenticated ? creds : null);
  });

  ipcMain.on('nav:show-error', (_event, type) => {
    loadError(type);
  });

  ipcMain.on('nav:show-login', () => {
    loadLogin();
  });

  ipcMain.handle('window:get-state', async () => {
    return initWindowState();
  });

  ipcMain.on('window:save-state', (_event, bounds) => {
    saveWindowState(bounds);
  });

  const authCheck = handleAuthCheck();
  if (authCheck.authenticated) {
    loadTerminal(authCheck);
  } else {
    loadLogin();
  }
});

powerMonitor.on('resume', () => {
  if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('system:resume');
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
});
