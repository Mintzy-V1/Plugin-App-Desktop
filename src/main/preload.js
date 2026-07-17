const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mintzy', {
  auth: {
    login: (apiKey) => ipcRenderer.invoke('auth:login', apiKey),
    logout: () => ipcRenderer.invoke('auth:logout'),
    check: () => ipcRenderer.invoke('auth:check'),
  },
  navigation: {
    showTerminal: () => ipcRenderer.send('nav:show-terminal'),
    showError: (type) => ipcRenderer.send('nav:show-error', type),
    showLogin: () => ipcRenderer.send('nav:show-login'),
  },
  window: {
    getState: () => ipcRenderer.invoke('window:get-state'),
    saveState: (bounds) => ipcRenderer.send('window:save-state', bounds),
  },
  system: {
    getAutoLaunch: () => ipcRenderer.invoke('system:get-auto-launch'),
    setAutoLaunch: (enable) => ipcRenderer.invoke('system:set-auto-launch', enable),
    showNotification: (title, body) => ipcRenderer.send('system:show-notification', { title, body }),
    onResume: (callback) => {
      ipcRenderer.on('system:resume', () => callback());
    },
  },
});
