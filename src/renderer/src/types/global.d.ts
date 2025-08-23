import type { API } from '../../preload/index'

declare global {
  interface Window {
    api: API
    electron: {
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>
        send: (channel: string, ...args: any[]) => void
        on: (channel: string, func: (...args: any[]) => void) => void
        removeAllListeners: (channel: string) => void
      }
    }
  }
}

export {}
