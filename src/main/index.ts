import { 
  app, 
  BrowserWindow, 
  Tray, 
  Menu, 
  ipcMain, 
  globalShortcut, 
  screen, 
  desktopCapturer, 
  clipboard, 
  nativeImage, 
  nativeTheme, 
  dialog, 
  shell,
  protocol,
  net,
} from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import ScreenCapture from './modules/screenCapture.js'
import QRScanner from './modules/qrScanner.js'
import OCRProcessor from './modules/ocrProcessor.js'
import { tmpdir } from 'node:os'
import { writeFileSync } from 'node:fs'

interface CaptureResult {
  success: boolean
  data?: string
  text?: string
  confidence?: number
  location?: any
  capturedImage?: string
  error?: string
}

class TrayScanner {
  private tray: Tray | null = null
  private screenCapture: ScreenCapture | null = null
  private qrScanner: QRScanner | null = null
  private ocrProcessor: OCRProcessor | null = null
  private captureWindow: BrowserWindow | null = null
  private resultWindow: BrowserWindow | null = null
  private aboutWindow: BrowserWindow | null = null
  private storedLanguage: string = 'eng'

  async init(): Promise<void> {
    // Initialize modules
    this.screenCapture = new ScreenCapture()
    this.qrScanner = new QRScanner()
    this.ocrProcessor = new OCRProcessor()

    // Check screen recording permissions on startup for macOS
    if (process.platform === 'darwin') {
      this.checkInitialPermissions()
    }

    // Create tray
    this.createTray()

    // Set up theme change listener for macOS
    this.setupThemeChangeListener()

    // Set up IPC handlers
    this.setupIpcHandlers()

    // Set up global keyboard shortcuts
    this.setupGlobalShortcuts()

    // Prevent app from quitting when all windows are closed
    app.on('window-all-closed', () => {
      // On macOS, keep the app running in the background
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })
  }

  private checkInitialPermissions(): void {
    try {
      console.log('Checking initial screen recording permissions...')
      const hasPermission = this.screenCapture?.checkPermissions()
      if (!hasPermission) {
        console.warn('Screen recording permission not granted. User will need to enable it manually.')
      } else {
        console.log('Screen recording permission is granted.')
      }
    } catch (error) {
      console.warn('Permission check failed:', error)
    }
  }

  private showPermissionDialog(): void {
    const macOSVersion = process.getSystemVersion()
    const versionMajor = parseInt(macOSVersion.split('.')[0])
    const settingsName = versionMajor >= 13 ? 'System Settings' : 'System Preferences'
    
    dialog.showMessageBox({
      type: 'warning',
      title: 'Screen Recording Permission Required',
      message: 'This app needs permission to record your screen to capture QR codes and text.',
      detail: `To enable screen recording:\n\n1. Open ${settingsName}\n2. Go to Privacy & Security > Screen Recording\n3. Add this application and enable it\n4. Restart the application\n\nAfter enabling the permission, try again.`,
      buttons: ['OK', 'Open System Preferences'],
      defaultId: 0,
      cancelId: 0
    }).then((result) => {
      if (result.response === 1) {
        // Open System Preferences to the Screen Recording section
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
      }
    })
  }

  /**
   * Get the appropriate tray icon path based on the current system theme
   */
  private getTrayIconPath(): string {
    const isDarkMode = nativeTheme.shouldUseDarkColors
    const iconName = isDarkMode ? 'tray-icon-light.png' : 'tray-icon-dark.png'
    return join(process.cwd(), 'resources', iconName)
  }

  /**
   * Create a tray icon image with theme awareness and fallback handling
   */
  private createTrayIconImage(): Electron.NativeImage {
    const fallbackIconData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAaCxAAAAsQHGLUmNAAAAGXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAAAVBJREFUSInF1bEuBFEUxvEfUWyzRKMgsSKiIEGvVSoUKgkPQAXQKjyDJyBEQSGRrbR6JBQiEiIkGkIhFEuxd3bHZGzs7Gx8yeROzj33/03uOXMvbVZH7L2EORQSOUe4+GX9OGYTsXcc4jYeLOEFX0mngrUGH7gWcpJrngOzptUwMdYA9feNBdYrdIVgTxgv0YkFDDQJvsduYNSYXSmJC9huEh7pK5jU1JmSNJIRDqPJQGTwircWwEm9BWZtizZxkKPBFB7iBp/qfXuD44zgm8TYfkV/8jTWpRc9iyrYwElewP9TR0psCYsZedvYigeiLiqgX7X6w5jJaHASxiE84iOqwTJOM0LTdI4V6l3TjWKOBsXATG3L6xbAV8lA2mm6o9rHE03Cz7D322TbLpxIJdVrLs8rc5D6Ft1iEvPoiwEqKDcwKKPXz1o+YR93Ddblp2/k9U7YtyTYYgAAAABJRU5ErkJggg=='

    // For macOS, try to use theme-aware icons
    if (process.platform === 'darwin') {
      try {
        const iconPath = this.getTrayIconPath()
        return nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
      } catch (error) {
        console.warn('Failed to load theme-aware tray icon, using fallback:', (error as Error).message)
      }
    }
    
    // Use fallback icon for non-macOS platforms or when theme-specific icons fail
    return nativeImage.createFromDataURL(fallbackIconData).resize({ width: 16, height: 16 })
  }

  /**
   * Set up theme change listener for macOS
   */
  private setupThemeChangeListener(): void {
    if (process.platform === 'darwin') {
      nativeTheme.on('updated', () => {
        console.log('System theme changed, updating tray icon...')
        this.updateTrayIcon()
      })
    }
  }

  /**
   * Update the tray icon when theme changes
   */
  private updateTrayIcon(): void {
    if (this.tray) {
      const icon = this.createTrayIconImage()
      this.tray.setImage(icon)
      console.log(`Tray icon updated for ${nativeTheme.shouldUseDarkColors ? 'dark' : 'light'} mode`)
    }
  }

  private createTray(): void {
    // Create tray icon using the consolidated method
    const icon = this.createTrayIconImage()
    console.log(`Created tray icon for ${process.platform === 'darwin' ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light') + ' mode' : 'default mode'}`)

    this.tray = new Tray(icon)
    this.tray.setToolTip('SayaLens - A text grabber')

    // Platform-specific modifier key display
    const modifierDisplay = process.platform === 'darwin' ? 'Cmd' : 'Ctrl'
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: `Capture Text`,
        click: () => this.startOCR()
      },
      {
        label: `Scan QR`,
        click: () => this.startQRScan()
      },
      {
        label: 'Global Shortcuts',
        submenu: [
          {
            label: `${modifierDisplay}+Shift+1 - Scan QR Code`,
            enabled: false
          },
          {
            label: `${modifierDisplay}+Shift+2 - Capture Text`,
            enabled: false
          }
        ]
      },
      { type: 'separator' },
      {
        label: 'About SayaLens',
        click: () => this.showAboutWindow()
      },
      {
        label: 'Exit',
        click: () => {
          app.quit()
        }
      }
    ])

    this.tray.setContextMenu(contextMenu)
  }

  private setupIpcHandlers(): void {
    ipcMain.handle('get-screen-sources', async () => {
      const sources = await desktopCapturer.getSources({
        types: ['screen']
      })
      return sources
    })

    ipcMain.handle('process-qr', async (_event, imageData) => {
      return await this.qrScanner?.scanImage(imageData)
    })

    ipcMain.handle('process-ocr', async (_event, imageData) => {
      return await this.ocrProcessor?.extractText(imageData)
    })

    ipcMain.handle('capture-and-process-qr', async (_event, bounds) => {
      try {
        console.log('Starting QR capture process...')
        const imageBuffer = await this.screenCapture?.captureArea(bounds)
        console.log('Screen capture successful, processing QR...')
        const qrResult = await this.qrScanner?.scanImage(imageBuffer!)
        
        // Add the captured image to the result
        return {
          ...qrResult,
          capturedImage: `data:image/png;base64,${imageBuffer?.toString('base64')}`
        }
      } catch (error) {
        console.error('QR capture failed:', error)
        
        // Show permission dialog if it's a permission error on macOS
        if (process.platform === 'darwin' && (error as Error).message.includes('Screen recording permission not granted')) {
          this.showPermissionDialog()
        }
        
        return {
          success: false,
          error: (error as Error).message
        } as CaptureResult
      }
    })

    ipcMain.handle('capture-and-process-ocr', async (_event, bounds) => {
      try {
        console.log('Starting OCR capture process...')
        const imageBuffer = await this.screenCapture?.captureArea(bounds)
        console.log('Screen capture successful, processing OCR...')

        // Create a temporary image file
        const tempDir = tmpdir()
        const timestamp = Date.now()
        const randomSuffix = Math.random().toString(36).substring(2)
        const tempFilePath = join(tempDir, `SayaLens_ocr_temp_${timestamp}_${randomSuffix}.png`)

        // Write the image buffer to the temporary file
        writeFileSync(tempFilePath, imageBuffer!)

        const ocrResult = await this.ocrProcessor?.extractText(tempFilePath)

        console.info('Ocr result:', {
          ...ocrResult,
          capturedImage: tempFilePath
        })

        // Add the captured image to the result
        return {
          ...ocrResult,
          capturedImage: tempFilePath
        }
      } catch (error) {
        console.error('OCR capture failed:', error)
        
        // Show permission dialog if it's a permission error on macOS
        if (process.platform === 'darwin' && (error as Error).message.includes('Screen recording permission not granted')) {
          this.showPermissionDialog()
        }
        
        return {
          success: false,
          error: (error as Error).message
        } as CaptureResult
      }
    })

    ipcMain.handle('copy-to-clipboard', (_event, text: string) => {
      clipboard.writeText(text)
    })

    ipcMain.handle('set-ocr-language', async (_event, language: string) => {
      try {
        await this.ocrProcessor?.setLanguage(language)
        this.storedLanguage = language
        console.log(`OCR language set and stored: ${language}`)
        return { success: true }
      } catch (error) {
        console.error('Failed to set OCR language:', error)
        return { success: false, error: (error as Error).message }
      }
    })

    ipcMain.handle('reprocess-ocr', async (_event, imagePath: string) => {
      try {
        console.log('Reprocessing OCR with new language for image:', imagePath)
        const ocrResult = await this.ocrProcessor?.extractText(imagePath)
        
        return {
          ...ocrResult,
          capturedImage: imagePath
        }
      } catch (error) {
        console.error('OCR reprocessing failed:', error)
        return {
          success: false,
          error: (error as Error).message
        } as CaptureResult
      }
    })

    ipcMain.handle('get-stored-language', async () => {
      try {
        // Return the stored language preference
        return {
          success: true,
          language: this.storedLanguage
        }
      } catch (error) {
        console.error('Failed to get stored language:', error)
        return {
          success: false,
          language: 'eng'
        }
      }
    })

    ipcMain.handle('sync-language-preference', async (_event, language: string) => {
      try {
        // Sync the language preference from renderer to main process
        this.storedLanguage = language
        console.log(`Language preference synced: ${language}`)
        return { success: true }
      } catch (error) {
        console.error('Failed to sync language preference:', error)
        return { success: false, error: (error as Error).message }
      }
    })

    ipcMain.handle('open-external-url', async (_event, url: string) => {
      try {
        await shell.openExternal(url)
        return { success: true }
      } catch (error) {
        console.error('Failed to open external URL:', error)
        return { success: false, error: (error as Error).message }
      }
    })

    ipcMain.on('capture-complete', () => {
      if (this.captureWindow) {
        this.captureWindow.close()
        this.captureWindow = null
      }
    })

    ipcMain.on('show-result', (_event, data) => {
      this.showResult(data)
    })

    ipcMain.on('close-result', () => {
      if (this.resultWindow) {
        this.resultWindow.close()
        this.resultWindow = null
      }
    })
  }

  private setupGlobalShortcuts(): void {
    // Platform-specific modifier key (Cmd on macOS, Ctrl on Windows/Linux)
    const modifier = process.platform === 'darwin' ? 'CommandOrControl' : 'Ctrl'

    // Register global shortcut for text capture (Cmd/Ctrl + Shift + 1)
    const ocrShortcut = `${modifier}+Shift+1`
    const registerOCRResult = globalShortcut.register(ocrShortcut, () => {
      console.log(`Global shortcut triggered: ${ocrShortcut} (Text Capture)`)
      this.startOCR()
    })

    if (registerOCRResult) {
      console.log(`Successfully registered global shortcut: ${ocrShortcut} for text capture`)
    } else {
      console.error(`Failed to register global shortcut: ${ocrShortcut} for text capture - shortcut may already be in use`)
    }

    // Register global shortcut for QR scanning (Cmd/Ctrl + Shift + 2)
    const qrShortcut = `${modifier}+Shift+2`
    const registerQRResult = globalShortcut.register(qrShortcut, () => {
      console.log(`Global shortcut triggered: ${qrShortcut} (QR Scan)`)
      this.startQRScan()
    })

    if (registerQRResult) {
      console.log(`Successfully registered global shortcut: ${qrShortcut} for QR scanning`)
    } else {
      console.error(`Failed to register global shortcut: ${qrShortcut} for QR scanning - shortcut may already be in use`)
    }

    // Log completion of shortcut registration
    console.log('Global keyboard shortcuts setup completed')
  }

  private async startQRScan(): Promise<void> {
    this.createCaptureWindow('qr')
  }

  private async startOCR(): Promise<void> {
    // Ensure OCR processor uses the stored language preference
    try {
      const currentLanguage = this.ocrProcessor?.getCurrentLanguage() || 'eng'
      
      if (this.storedLanguage !== currentLanguage) {
        console.log(`Updating OCR language to stored preference: ${this.storedLanguage}`)
        await this.ocrProcessor?.setLanguage(this.storedLanguage)
      } else {
        console.log(`Starting OCR with language: ${this.storedLanguage}`)
      }
    } catch (error) {
      console.warn('Error setting stored language for OCR:', error)
    }
    
    this.createCaptureWindow('ocr')
  }

  private createCaptureWindow(mode: 'qr' | 'ocr'): void {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    
    console.log('Creating capture window')
    console.log('displaySize: ', width, height)

    this.captureWindow = new BrowserWindow({
      width,
      height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      fullscreen: false,
      skipTaskbar: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, '../preload/index.js')
      },
      title: 'SayaLens'
    })

    console.log('captureSize: ', this.captureWindow.getContentSize())

    // Load the capture React app
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.captureWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/capture')
    } else {
      this.captureWindow.loadFile(join(__dirname, '../renderer/capture.html'))
    }

    // Add error handling for preload script
    this.captureWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
      console.error('Preload script error:', preloadPath)
      console.error('Preload script error:', error)
    })

    this.captureWindow.webContents.once('did-finish-load', () => {
      console.log('Capture window finished loading')
      this.captureWindow?.webContents.send('init-capture', { mode })
    })

    this.captureWindow.webContents.on('dom-ready', () => {
      console.log('Capture window DOM ready')
    })

    this.captureWindow.on('closed', () => {
      this.captureWindow = null
    })
  }

  private showResult(data: any): void {
    console.log('Creating result window')

    this.resultWindow = new BrowserWindow({
      width: 720,
      height: 640,
      resizable: false,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, '../preload/index.js')
      },
    })

    // Load the result React app
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.resultWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/result')
    } else {
      this.resultWindow.loadFile(join(__dirname, '../renderer/result.html'))
    }

    this.resultWindow.webContents.once('did-finish-load', () => {
      this.resultWindow?.webContents.send('show-data', data)
    })

    this.resultWindow.on('closed', () => {
      this.resultWindow = null
    })
  }

  private showAboutWindow(): void {
    // Don't create a new window if one already exists
    if (this.aboutWindow) {
      this.aboutWindow.focus()
      return
    }

    console.log('Creating about window')

    this.aboutWindow = new BrowserWindow({
      width: 900,
      height: 800,
      resizable: false,
      minimizable: false,
      maximizable: true,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, '../preload/index.js')
      },
      title: 'About SayaLens'
    })

    // Load the about React app
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.aboutWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/about')
    } else {
      this.aboutWindow.loadFile(join(__dirname, '../renderer/about.html'))
    }

    this.aboutWindow.on('closed', () => {
      this.aboutWindow = null
    })
  }
}

// App initialization
const trayScanner = new TrayScanner()

// Add custom file protocol
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
      standard: true,
    },
  },
]);

app.whenReady().then(() => {
  // Hide Dock icon on macOS to make it an agent app
  if (process.platform === 'darwin') {
    app.dock.hide()
  }

  // Handle protocol call
  protocol.handle('media', async request => {
    const url = request.url.replace(/^media:\/\//, '/'); // remove media:// and return the path from root
    return net.fetch(`file://${url}`);
  });

  trayScanner.init()
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
})
