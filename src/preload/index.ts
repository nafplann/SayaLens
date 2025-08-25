import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Screen capture and scanning
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  processQR: (imageData: Buffer) => ipcRenderer.invoke('process-qr', imageData),
  processOCR: (imageData: Buffer) => ipcRenderer.invoke('process-ocr', imageData),
  captureAndProcessQR: (bounds: { x: number; y: number; width: number; height: number }) => 
    ipcRenderer.invoke('capture-and-process-qr', bounds),
  captureAndProcessOCR: (bounds: { x: number; y: number; width: number; height: number }) => 
    ipcRenderer.invoke('capture-and-process-ocr', bounds),
  
  // Utility functions
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),
  
  // Window management
  captureComplete: () => ipcRenderer.send('capture-complete'),
  showResult: (data: any) => ipcRenderer.send('show-result', data),
  closeResult: () => ipcRenderer.send('close-result'),
  
  // Event listeners
  onInitCapture: (callback: (event: any, data: { mode: 'qr' | 'ocr' }) => void) => 
    ipcRenderer.on('init-capture', callback),
  onShowData: (callback: (event: any, data: any) => void) => 
    ipcRenderer.on('show-data', callback),
  
  // Remove listeners
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

export type API = typeof api
