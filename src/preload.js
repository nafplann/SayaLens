const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  processQR: (imageData) => ipcRenderer.invoke('process-qr', imageData),
  processOCR: (imageData) => ipcRenderer.invoke('process-ocr', imageData),
  captureAndProcessQR: (bounds) => ipcRenderer.invoke('capture-and-process-qr', bounds),
  captureAndProcessOCR: (bounds) => ipcRenderer.invoke('capture-and-process-ocr', bounds),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),

  captureComplete: (bounds) => ipcRenderer.send('capture-complete', bounds),
  showResult: (data) => ipcRenderer.send('show-result', data),
  closeResult: () => ipcRenderer.send('close-result'),

  onInitCapture: (callback) => ipcRenderer.on('init-capture', callback),
  onShowData: (callback) => ipcRenderer.on('show-data', callback)
});