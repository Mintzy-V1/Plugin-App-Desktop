const { Notification, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { getSettings } = require('./settings');
const { resolveIconPath } = require('./icon');

let mainWindowRef = null;
let listenersReady = false;
let downloadedInfo = null;
let checking = false;

function canNotify() {
  return Notification.isSupported() && getSettings().notificationsEnabled !== false;
}

function promptInstall(info) {
  const version = info?.version || downloadedInfo?.version || '';
  if (mainWindowRef && !mainWindowRef.isDestroyed() && mainWindowRef.isVisible()) {
    dialog.showMessageBox(mainWindowRef, {
      type: 'info',
      buttons: ['Restart and Install Now', 'Later'],
      title: 'Application Update',
      message: version ? `Version ${version} is available.` : 'An update is ready to install.',
      detail: 'A new version has been downloaded. Restart the application to apply the updates.',
    }).then((returnValue) => {
      if (returnValue.response === 0) autoUpdater.quitAndInstall();
    });
  }
}

function setupAutoUpdater(mainWindow, { isDev }) {
  mainWindowRef = mainWindow;
  if (isDev || listenersReady) return;

  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.autoDownload = true;

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
    downloadedInfo = info;
    if (canNotify()) {
      const notification = new Notification({
        title: 'Update Ready to Install',
        body: `Mintzy Plugin v${info.version} has been downloaded. Click to install.`,
        icon: resolveIconPath() || undefined,
      });
      notification.on('click', () => autoUpdater.quitAndInstall());
      notification.show();
    }
    promptInstall(info);
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
  });

  listenersReady = true;

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Error checking for updates:', err);
  });
}

/**
 * Manual check from Settings.
 * @returns {Promise<{ status: string, version?: string, message: string }>}
 */
async function checkForUpdatesManual() {
  if (downloadedInfo) {
    promptInstall(downloadedInfo);
    return {
      status: 'downloaded',
      version: downloadedInfo.version,
      message: `Version ${downloadedInfo.version} is ready to install.`,
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
        checking = false;
        resolve(result);
      };

      const onAvailable = (info) => {
        finish({
          status: 'available',
          version: info.version,
          message: `Version ${info.version} is available and downloading…`,
        });
      };
      const onNotAvailable = () => {
        finish({
          status: 'up-to-date',
          message: 'You are on the latest version.',
        });
      };
      const onDownloaded = (info) => {
        downloadedInfo = info;
        finish({
          status: 'downloaded',
          version: info.version,
          message: `Version ${info.version} is ready to install.`,
        });
      };
      const onError = (err) => {
        finish({
          status: 'error',
          message: err?.message || 'Could not check for updates. Try again later.',
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
        finish({
          status: 'error',
          message: err?.message || 'Could not check for updates. Try again later.',
        });
      });

      // Safety timeout so Settings never hangs forever
      setTimeout(() => {
        finish({
          status: 'error',
          message: 'Update check timed out. Check your connection and try again.',
        });
      }, 45000);
    });
  } finally {
    checking = false;
  }
}

function installDownloadedUpdate() {
  if (!downloadedInfo) return { success: false, message: 'No update is ready to install yet.' };
  autoUpdater.quitAndInstall();
  return { success: true };
}

module.exports = {
  setupAutoUpdater,
  checkForUpdatesManual,
  installDownloadedUpdate,
};
