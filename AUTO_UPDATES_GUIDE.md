# Auto Updates Implementation Guide

This guide details how to configure auto-updates for the Mintzy Plugin desktop app using Amazon S3 as the release host, and how to prompt the user with a native dialog to "Install Now" or "Later".

## Step 1: Install Dependencies
Run the following command to install the required package:
```bash
npm install electron-updater
```

## Step 2: Configure `electron-builder.yml`
Add the `publish` block to your `electron-builder.yml`. This tells `electron-builder` to generate a `latest.yml` file and instructs the app where to look for updates.

Add this block at the root level of `electron-builder.yml`:
```yaml
publish:
  provider: s3
  bucket: YOUR_S3_BUCKET_NAME
  region: YOUR_S3_REGION
  acl: public-read
```

## Step 3: Implement Auto-Updater in `src/main/main.js`

Add the following implementation to `src/main/main.js`. This logic checks for updates silently in the background and prompts the user with a native dialog box when an update is fully downloaded and ready to install.

**1. Import the required modules at the top of the file:**
```javascript
const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
```

**2. Add the Auto-Update logic:**
Place this block right inside your `app.whenReady().then(...)` function, near the bottom of it:

```javascript
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
```

## Step 4: Releasing an Update
When you are ready to publish an update:
1. Increment the `version` number in your `package.json`.
2. Build the Windows installer: `npm run build`
3. Upload BOTH the generated `.exe` file (e.g. `Mintzy Plugin Setup 1.0.1.exe`) AND the `latest.yml` file from your `release/` folder to your S3 bucket.
4. Ensure the files in the S3 bucket are publicly readable.

Users on the old version will automatically download the new files and be prompted to install them!
