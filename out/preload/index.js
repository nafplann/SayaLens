"use strict";
const electron = require("electron");
const electronAPI = {
  ipcRenderer: {
    send(channel, ...args) {
      electron.ipcRenderer.send(channel, ...args);
    },
    sendTo(webContentsId, channel, ...args) {
      const electronVer = process.versions.electron;
      const electronMajorVer = electronVer ? parseInt(electronVer.split(".")[0]) : 0;
      if (electronMajorVer >= 28) {
        throw new Error('"sendTo" method has been removed since Electron 28.');
      } else {
        electron.ipcRenderer.sendTo(webContentsId, channel, ...args);
      }
    },
    sendSync(channel, ...args) {
      return electron.ipcRenderer.sendSync(channel, ...args);
    },
    sendToHost(channel, ...args) {
      electron.ipcRenderer.sendToHost(channel, ...args);
    },
    postMessage(channel, message, transfer) {
      electron.ipcRenderer.postMessage(channel, message, transfer);
    },
    invoke(channel, ...args) {
      return electron.ipcRenderer.invoke(channel, ...args);
    },
    on(channel, listener) {
      electron.ipcRenderer.on(channel, listener);
      return () => {
        electron.ipcRenderer.removeListener(channel, listener);
      };
    },
    once(channel, listener) {
      electron.ipcRenderer.once(channel, listener);
      return () => {
        electron.ipcRenderer.removeListener(channel, listener);
      };
    },
    removeListener(channel, listener) {
      electron.ipcRenderer.removeListener(channel, listener);
      return this;
    },
    removeAllListeners(channel) {
      electron.ipcRenderer.removeAllListeners(channel);
    }
  },
  webFrame: {
    insertCSS(css) {
      return electron.webFrame.insertCSS(css);
    },
    setZoomFactor(factor) {
      if (typeof factor === "number" && factor > 0) {
        electron.webFrame.setZoomFactor(factor);
      }
    },
    setZoomLevel(level) {
      if (typeof level === "number") {
        electron.webFrame.setZoomLevel(level);
      }
    }
  },
  webUtils: {
    getPathForFile(file) {
      return electron.webUtils.getPathForFile(file);
    }
  },
  process: {
    get platform() {
      return process.platform;
    },
    get versions() {
      return process.versions;
    },
    get env() {
      return { ...process.env };
    }
  }
};
const api = {
  // Screen capture and scanning
  getScreenSources: () => electron.ipcRenderer.invoke("get-screen-sources"),
  processQR: (imageData) => electron.ipcRenderer.invoke("process-qr", imageData),
  processOCR: (imageData) => electron.ipcRenderer.invoke("process-ocr", imageData),
  captureAndProcessQR: (bounds) => electron.ipcRenderer.invoke("capture-and-process-qr", bounds),
  captureAndProcessOCR: (bounds) => electron.ipcRenderer.invoke("capture-and-process-ocr", bounds),
  // Utility functions
  copyToClipboard: (text) => electron.ipcRenderer.invoke("copy-to-clipboard", text),
  setOCRLanguage: (language) => electron.ipcRenderer.invoke("set-ocr-language", language),
  reprocessOCR: (imagePath) => electron.ipcRenderer.invoke("reprocess-ocr", imagePath),
  getStoredLanguage: () => electron.ipcRenderer.invoke("get-stored-language"),
  syncLanguagePreference: (language) => electron.ipcRenderer.invoke("sync-language-preference", language),
  openExternalUrl: (url) => electron.ipcRenderer.invoke("open-external-url", url),
  // Window management
  captureComplete: () => electron.ipcRenderer.send("capture-complete"),
  showResult: (data) => electron.ipcRenderer.send("show-result", data),
  closeResult: () => electron.ipcRenderer.send("close-result"),
  // Event listeners
  onInitCapture: (callback) => electron.ipcRenderer.on("init-capture", callback),
  onShowData: (callback) => electron.ipcRenderer.on("show-data", callback),
  // Remove listeners
  removeAllListeners: (channel) => electron.ipcRenderer.removeAllListeners(channel)
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = electronAPI;
  window.api = api;
}
