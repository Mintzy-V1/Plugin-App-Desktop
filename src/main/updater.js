const { Notification, dialog, app } = require('electron');
const { autoUpdater } = require('electron-updater');
const { getSettings } = require('./settings');
const { resolveIconPath } = require('./icon');

let mainWindowRef = null;
let listenersReady = false;
let downloadedInfo = null;
let downloadInProgress = false;
let checking = false;
let isDevMode = false;

/** Map electron-updater / network failures to plain language for end users. */
function userFacingUpdateError(err) {
  const raw = String(err?.message || err || '').toLowerCase();

  if (/dev|not.?packaged|app.?is.?not.?packed/i.test(raw)) {
    return 'Updates are only available in the installed app.';
  }
  if (/enoent|latest\.yml|cannot find|404|not found/i.test(raw)) {
    return 'No update package was found. Please try again later or download the latest installer from Mintzy.';
  }
  if (/401|403|unauthorized|forbidden|private/i.test(raw)) {
    return 'Could not reach the update server. Please try again later.';
  }
  if (/timed?\s*out|timeout|etimedout/i.test(raw)) {
    return 'The update check timed out. Check your connection and try again.';
  }
  if (/network|enotfound|econnrefused|econnreset|offline|dns|net::/i.test(raw)) {
    return 'Could not check for updates. Check your internet connection and try again.';
  }
  if (/sha512|checksum|signature|blockmap/i.test(raw)) {
    return 'The update file could not be verified. Please try again later.';
  }

  return 'Could not check for updates right now. Please try again later.';
}

function canNotify() {
  return Notification.isSupported() && getSettings().notificationsEnabled !== false;
}

function promptInstall(info) {
  const version = info?.version || downloadedInfo?.version || '';
  const win = mainWindowRef && !mainWindowRef.isDestroyed() ? mainWindowRef : null;

  // Bring the app forward if it was minimized to tray so the dialog is usable.
  if (win) {
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    win.focus();
  }

  const opts = {
    type: 'info',
    buttons: ['Restart and Install Now', 'Later'],
    defaultId: 0,
    cancelId: 1,
    title: 'Update ready',
    message: version ? `Mintzy Plugin v${version} is ready to install.` : 'An update is ready to install.',
    detail: 'Restart the app to finish updating. Your work will be saved when you reopen.',
  };

  const box = win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts);
  box.then((returnValue) => {
    if (returnValue.response === 0) {
      try {
        autoUpdater.quitAndInstall(false, true);
      } catch (err) {
        console.error('quitAndInstall failed:', err);
      }
    }
  }).catch((err) => {
    console.error('Update install prompt failed:', err);
  });
}

function setupAutoUpdater(mainWindow, { isDev }) {
  mainWindowRef = mainWindow;
  isDevMode = Boolean(isDev);

  if (isDev || listenersReady) return;

  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.autoDownload = true;

  autoUpdater.on('update-available', (info) => {
    downloadInProgress = true;
    if (canNotify()) {
      new Notification({
        title: 'Update available',
        body: `Mintzy Plugin v${info.version} is downloading in the background…`,
        icon: resolveIconPath() || undefined,
      }).show();
    }
  });

  autoUpdater.on('update-not-available', () => {
    downloadInProgress = false;
  });

  autoUpdater.on('update-downloaded', (info) => {
    downloadInProgress = false;
    downloadedInfo = info;
    if (canNotify()) {
      const notification = new Notification({
        title: 'Update ready',
        body: `Mintzy Plugin v${info.version} is ready. Click to restart and install.`,
        icon: resolveIconPath() || undefined,
      });
      notification.on('click', () => {
        try {
          autoUpdater.quitAndInstall(false, true);
        } catch (err) {
          console.error('quitAndInstall from notification failed:', err);
        }
      });
      notification.show();
    }
    promptInstall(info);
  });

  autoUpdater.on('error', (err) => {
    downloadInProgress = false;
    // Log for diagnostics only — never surface raw updater errors to users.
    console.error('Auto-updater error:', err);
  });

  listenersReady = true;

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Background update check failed:', err);
  });
}

/**
 * Manual check from Settings.
 * @returns {Promise<{ status: string, version?: string, message: string }>}
 */
async function checkForUpdatesManual() {
  if (isDevMode || !app.isPackaged) {
    return {
      status: 'error',
      message: 'Updates are only available in the installed Windows app.',
    };
  }

  if (downloadedInfo) {
    promptInstall(downloadedInfo);
    return {
      status: 'downloaded',
      version: downloadedInfo.version,
      message: `Version ${downloadedInfo.version} is ready to install.`,
    };
  }

  if (downloadInProgress) {
    return {
      status: 'available',
      message: 'An update is already downloading. You’ll be notified when it’s ready to install.',
    };
  }

  if (checking) {
    return { status: 'checking', message: 'Already checking for updates…' };
  }

  checking = true;
  try {
    return await new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      const onAvailable = (info) => {
        downloadInProgress = true;
        finish({
          status: 'available',
          version: info.version,
          message: `Version ${info.version} is available and downloading…`,
        });
      };
      const onNotAvailable = () => {
        finish({
          status: 'up-to-date',
          message: 'You’re on the latest version.',
        });
      };
      const onDownloaded = (info) => {
        downloadInProgress = false;
        downloadedInfo = info;
        finish({
          status: 'downloaded',
          version: info.version,
          message: `Version ${info.version} is ready to install.`,
        });
      };
      const onError = (err) => {
        downloadInProgress = false;
        console.error('Manual update check error:', err);
        finish({
          status: 'error',
          message: userFacingUpdateError(err),
        });
      };

      const cleanup = () => {
        autoUpdater.off('update-available', onAvailable);
        autoUpdater.off('update-not-available', onNotAvailable);
        autoUpdater.off('update-downloaded', onDownloaded);
        autoUpdater.off('error', onError);
      };

      autoUpdater.on('update-available', onAvailable);
      autoUpdater.on('update-not-available', onNotAvailable);
      autoUpdater.on('update-downloaded', onDownloaded);
      autoUpdater.on('error', onError);

      autoUpdater.checkForUpdates().catch((err) => {
        console.error('checkForUpdates rejected:', err);
        finish({
          status: 'error',
          message: userFacingUpdateError(err),
        });
      });

      setTimeout(() => {
        finish({
          status: 'error',
          message: 'The update check timed out. Check your connection and try again.',
        });
      }, 45000);
    });
  } finally {
    checking = false;
  }
}

function installDownloadedUpdate() {
  if (!downloadedInfo) {
    return { success: false, message: 'No update is ready to install yet.' };
  }
  try {
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  } catch (err) {
    console.error('installDownloadedUpdate failed:', err);
    return {
      success: false,
      message: 'Could not start the installer. Please restart the app and try again.',
    };
  }
}

module.exports = {
  setupAutoUpdater,
  checkForUpdatesManual,
  installDownloadedUpdate,
};
