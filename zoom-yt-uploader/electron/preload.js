const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // We will add Zoom and YouTube API handlers here
  startUploadProcess: (data) => ipcRenderer.invoke('start-upload-process', data),
  onUploadProgress: (callback) => ipcRenderer.on('upload-progress', (_event, data) => callback(data)),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  authGoogle: () => ipcRenderer.invoke('auth-google'),
  removeYoutubeAccount: (accountId) => ipcRenderer.invoke('remove-youtube-account', accountId),
  checkYoutubeAuth: () => ipcRenderer.invoke('check-youtube-auth'),
  fetchZoomInstances: (meetingId) => ipcRenderer.invoke('fetch-zoom-instances', meetingId),
  getHistory: () => ipcRenderer.invoke('get-history'),
  saveHistory: (item) => ipcRenderer.invoke('save-history', item),
  renameHistory: (data) => ipcRenderer.invoke('rename-history', data),
  cancelUpload: () => ipcRenderer.invoke('cancel-upload')
});
