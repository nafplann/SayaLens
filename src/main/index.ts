import {
  app,
  BrowserWindow,
  clipboard,
  desktopCapturer,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  net,
  protocol,
  screen,
  shell,
  Tray,
} from 'electron'
import {join} from 'path'
import {is} from '@electron-toolkit/utils'
import ScreenCapture from './modules/screenCapture.js'
import QRScanner from './modules/qrScanner.js'
import OCRProcessor from './modules/ocrProcessor.js'
import { VersionController, VersionCheckResult } from './modules/versionControl.js'
import { Analytics } from './modules/analytics.js'
import {tmpdir} from 'node:os'
import {writeFileSync} from 'node:fs'

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
  private versionController: VersionController | null = null
  private analytics: Analytics | null = null
  private captureWindow: BrowserWindow | null = null
  private resultWindow: BrowserWindow | null = null
  private aboutWindow: BrowserWindow | null = null
  private storedLanguage: string = 'eng'
  private activeDisplay: Electron.Display | null = null



  async init(): Promise<void> {
    // Initialize analytics first
    this.analytics = new Analytics()
    await this.analytics.initialize()

    // Initialize version controller
    this.versionController = new VersionController()
    
    // Check version status on startup with comprehensive error handling
    try {
      const versionStatus = await this.versionController.checkVersionStatus()
      const shouldContinue = await this.handleVersionStatus(versionStatus)
      
      if (!shouldContinue) {
        console.log('🚫 App terminated due to version policy')
        app.quit()
        return
      }
    } catch (error) {
      console.error('🔥 Version check failed completely, allowing app to start:', error)
      // CRITICAL: Always allow app to start if version check completely fails
    }

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

    // Set up periodic version checks with network awareness
    this.setupPeriodicVersionChecks()
    
    // Monitor network connectivity
    this.setupNetworkMonitoring()

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
      cancelId: 0,
      icon: this.getAppIcon()
    }).then((result) => {
      if (result.response === 1) {
        // Open System Preferences to the Screen Recording section
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
      }
    })
  }

  /**
   * Get the app icon for dialog boxes
   */
  private getAppIcon(): Electron.NativeImage {
    try {
      const iconPath = join(app.getAppPath(), 'resources', 'appicon.png')
      return nativeImage.createFromPath(iconPath)
    } catch (error) {
      console.warn('Failed to load app icon:', error)
      // Return empty image as fallback
      return nativeImage.createEmpty()
    }
  }

  /**
   * Get the appropriate tray icon path based on the current system theme
   */
  private getTrayIconPath(): string {
    const isDarkMode = nativeTheme.shouldUseDarkColors
    const iconName = isDarkMode ? 'tray-icon-light.png' : 'tray-icon-dark.png'
    
    // Use app.getAppPath() for production builds to get the correct application directory
    // In development, this will point to the project root
    // In production, this will point to the app bundle root where resources are located
    return join(app.getAppPath(), 'resources', iconName)
  }

  /**
   * Create a tray icon image with theme awareness and fallback handling
   */
  private createTrayIconImage(): Electron.NativeImage {
    const fallbackIconData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAaCxAAAAsQHGLUmNAAAAGXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAAAVBJREFUSInF1bEuBFEUxvEfUWyzRKMgsSKiIEGvVSoUKgkPQAXQKjyDJyBEQSGRrbR6JBQiEiIkGkIhFEuxd3bHZGzs7Gx8yeROzj33/03uOXMvbVZH7L2EORQSOUe4+GX9OGYTsXcc4jYeLOEFX0mngrUGH7gWcpJrngOzptUwMdYA9feNBdYrdIVgTxgv0YkFDDQJvsduYNSYXSmJC9huEh7pK5jU1JmSNJIRDqPJQGTwircWwEm9BWZtizZxkKPBFB7iBp/qfXuD44zgm8TYfkV/8jTWpRc9iyrYwElewP9TR0psCYsZedvYigeiLiqgX7X6w5jJaHASxiE84iOqwTJOM0LTdI4V6l3TjWKOBsXATG3L6xbAV8lA2mm6o9rHE03Cz7D322TbLpxIJdVrLs8rc5D6Ft1iEvPoiwEqKDcwKKPXz1o+YR93Ddblp2/k9U7YtyTYYgAAAABJRU5ErkJggg=='

    // Try to use theme-aware icons
    try {
      const iconPath = this.getTrayIconPath()
      return nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    } catch (error) {
      console.warn('Failed to load theme-aware tray icon, using fallback:', (error as Error).message)

      // Use fallback icon for non-macOS platforms or when theme-specific icons fail
      return nativeImage.createFromDataURL(fallbackIconData).resize({ width: 16, height: 16 })
    }
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
        click: async () => {
          console.log('Tray action: Capture Text')
          await this.analytics?.trayActionUsed('Capture Text')
          this.startOCR()
        }
      },
      {
        label: `Scan QR`,
        click: async () => {
          console.log('Tray action: Scan QR')
          await this.analytics?.trayActionUsed('Scan QR')
          this.startQRScan()
        }
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
        label: 'Check for Updates',
        click: async () => {
          console.log('Tray action: Check for Updates')
          await this.analytics?.trayActionUsed('Check for Updates')
          await this.performManualUpdateCheck()
        }
      },
      {
        label: 'About SayaLens',
        click: async () => {
          console.log('Tray action: About SayaLens')
          await this.analytics?.trayActionUsed('About SayaLens')
          this.showAboutWindow()
        }
      },
      {
        label: 'Exit',
        click: async () => {
          await this.analytics?.appClosed();
          app.quit()
        }
      }
    ])

    this.tray.setContextMenu(contextMenu)
  }

  private setupIpcHandlers(): void {
    ipcMain.handle('get-screen-sources', async () => {
      return await desktopCapturer.getSources({
        types: ['screen']
      })
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
        if (!this.activeDisplay) {
          throw new Error('No active display information available')
        }
        const imageBuffer = await this.screenCapture?.captureArea(bounds, this.activeDisplay)
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
        if (!this.activeDisplay) {
          throw new Error('No active display information available')
        }
        const imageBuffer = await this.screenCapture?.captureArea(bounds, this.activeDisplay)
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

    ipcMain.handle('track-analytics-event', async (_event, eventData: { action: string, category: string, label?: string, value?: number }) => {
      try {
        await this.analytics?.trackEvent(eventData.action, eventData.category, eventData.label, eventData.value)
        return { success: true }
      } catch (error) {
        console.error('Failed to track analytics event:', error)
        return { success: false, error: (error as Error).message }
      }
    })

    ipcMain.handle('track-page-view', async (_event, pageData: { page: string, title?: string }) => {
      try {
        await this.analytics?.trackPageView(pageData.page, pageData.title)
        return { success: true }
      } catch (error) {
        console.error('Failed to track page view:', error)
        return { success: false, error: (error as Error).message }
      }
    })

    ipcMain.handle('get-app-version', async () => {
      try {
        return {
          success: true,
          version: app.getVersion()
        }
      } catch (error) {
        console.error('Failed to get app version:', error)
        return {
          success: false,
          error: (error as Error).message,
          version: '1.0.0' // fallback version
        }
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
    const registerOCRResult = globalShortcut.register(ocrShortcut, async () => {
      console.log(`Global shortcut triggered: ${ocrShortcut} (Text Capture)`)
      await this.analytics?.globalShortcutUsed(ocrShortcut)
      this.startOCR()
    })

    if (registerOCRResult) {
      console.log(`Successfully registered global shortcut: ${ocrShortcut} for text capture`)
    } else {
      console.error(`Failed to register global shortcut: ${ocrShortcut} for text capture - shortcut may already be in use`)
    }

    // Register global shortcut for QR scanning (Cmd/Ctrl + Shift + 2)
    const qrShortcut = `${modifier}+Shift+2`
    const registerQRResult = globalShortcut.register(qrShortcut, async () => {
      console.log(`Global shortcut triggered: ${qrShortcut} (QR Scan)`)
      await this.analytics?.globalShortcutUsed(qrShortcut)
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
    // Get the current mouse cursor position and find the active display
    const cursorPoint = screen.getCursorScreenPoint()
    this.activeDisplay = screen.getDisplayNearestPoint(cursorPoint)
    
    console.log('Creating capture window')
    console.log('Mouse cursor position:', cursorPoint)
    console.log('Active display:', {
      id: this.activeDisplay.id,
      bounds: this.activeDisplay.bounds,
      workArea: this.activeDisplay.workArea
    })

    const { width, height } = this.activeDisplay.workAreaSize
    const { x, y } = this.activeDisplay.workArea
    
    console.log('Capture window size and position:', { x, y, width, height })

    this.captureWindow = new BrowserWindow({
      width,
      height,
      x,
      y,
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
      this.captureWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/capture`)
    } else {
      this.captureWindow.loadURL(join('file://', __dirname, '../renderer/index.html#/capture'))
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
      this.activeDisplay = null
    })
  }

  private showResult(data: any): void {
    console.log('Creating result window')

    // Calculate position for active display or fallback to primary display
    let windowPosition: { x?: number; y?: number } = {}
    
    if (this.activeDisplay) {
      // Center the result window on the active display
      const centerX = this.activeDisplay.workArea.x + (this.activeDisplay.workArea.width - 720) / 2
      const centerY = this.activeDisplay.workArea.y + (this.activeDisplay.workArea.height - 640) / 2
      windowPosition = { x: Math.floor(centerX), y: Math.floor(centerY) }
      
      console.log('Positioning result window on active display:', {
        display: this.activeDisplay.id,
        position: windowPosition
      })
    } else {
      console.log('No active display, using default positioning for result window')
    }

    this.resultWindow = new BrowserWindow({
      width: 720,
      height: 640,
      ...windowPosition,
      resizable: true,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, '../preload/index.js')
      },
    })

      this.resultWindow.webContents.openDevTools(); 

    // Load the result React app
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.resultWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/result`)
    } else {
      this.resultWindow.loadURL(join('file://', __dirname, '../renderer/index.html#/result'))
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

    // Calculate position for active display or determine from cursor position
    let windowPosition: { x?: number; y?: number } = {}
    let targetDisplay = this.activeDisplay
    
    if (!targetDisplay) {
      // If no active display from recent capture, use cursor position
      const cursorPoint = screen.getCursorScreenPoint()
      targetDisplay = screen.getDisplayNearestPoint(cursorPoint)
      console.log('No active display, using cursor position for about window:', cursorPoint)
    }
    
    if (targetDisplay) {
      // Center the about window on the target display
      const centerX = targetDisplay.workArea.x + (targetDisplay.workArea.width - 900) / 2
      const centerY = targetDisplay.workArea.y + (targetDisplay.workArea.height - 800) / 2
      windowPosition = { x: Math.floor(centerX), y: Math.floor(centerY) }
      
      console.log('Positioning about window on display:', {
        display: targetDisplay.id,
        position: windowPosition
      })
    } else {
      console.log('No target display found, using default positioning for about window')
    }

    this.aboutWindow = new BrowserWindow({
      width: 900,
      height: 800,
      ...windowPosition,
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
      this.aboutWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/about`)
    } else {
      this.aboutWindow.loadURL(join('file://', __dirname, '../renderer/index.html#/about'))
    }

    this.aboutWindow.on('closed', () => {
      this.aboutWindow = null
    })
  }

  private setupPeriodicVersionChecks(): void {
    // Check every 30 minutes, but only if we should (based on cache age)
    setInterval(async () => {
      if (this.versionController?.shouldCheckForUpdates()) {
        await this.performPeriodicVersionCheck()
      }
    }, 30 * 60 * 1000) // 30 minutes
  }

  private setupNetworkMonitoring(): void {
    // Monitor online/offline status
    process.on('online', () => {
      console.log('🌐 Network connection restored')
      this.analytics?.networkRestored()
      // Perform immediate version check when coming back online
      setTimeout(() => this.performPeriodicVersionCheck(), 5000)
    })

    process.on('offline', () => {
      console.log('📱 Network connection lost')
    })
  }

  private async handleVersionStatus(versionStatus: VersionCheckResult): Promise<boolean> {
    const { status, config, isOffline, cacheAge } = versionStatus

    // Track version check event with offline context
    await this.analytics?.versionCheckPerformed(`${status}_${isOffline ? 'offline' : 'online'}`)

    // Track offline mode detection when using stale cache
    if (isOffline && cacheAge > 0) {
      await this.analytics?.offlineModeDetected(cacheAge)
    }

    // Add offline indicator to messages
    const offlineNotice = isOffline ? '\n\n⚠️ You are currently offline.' : ''
    const staleNotice = (isOffline && cacheAge > 24 * 60 * 60 * 1000) 
      ? '\n📅 Version information may be outdated.' : ''

    switch (status) {
      case 'blocked':
        if (isOffline) {
          // Show warning but don't block when offline
          await dialog.showMessageBox({
            type: 'warning',
            title: 'Version Warning (Offline)',
            message: 'Update May Be Required',
            detail: `This version may need updating, but you're currently offline.${offlineNotice}${staleNotice}\n\nThe app will continue to work in offline mode.`,
            buttons: ['Continue Offline'],
            defaultId: 0,
            icon: this.getAppIcon()
          })
          return true // Allow to continue offline
        }
        
        const blockMessage = config.killSwitchMessage || 
          `This version (${versionStatus.userVersion}) is no longer supported and must be updated.`
        
        // Track kill switch activation when using kill switch message
        if (config.killSwitchMessage) {
          await this.analytics?.killSwitchActivated()
        }
        
        await dialog.showMessageBox({
          type: 'error',
          title: 'App Disabled',
          message: 'SayaLens Update Required',
          detail: blockMessage + offlineNotice,
          buttons: ['Download Update', 'Exit'],
          defaultId: 0,
          cancelId: 1,
          icon: this.getAppIcon()
        }).then((result) => {
          if (result.response === 0) {
            shell.openExternal(config.downloadUrl)
          }
        })
        
        await this.analytics?.versionBlocked(versionStatus.userVersion)
        return false

      case 'force_update':
        const forceMessage = isOffline 
          ? 'This version has issues, but you can continue offline. Please update when online.'
          : 'This version has critical issues and must be updated immediately.'
        
        const forceResult = await dialog.showMessageBox({
          type: 'warning',
          title: isOffline ? 'Update Recommended (Offline)' : 'Critical Update Required',
          message: forceMessage,
          detail: config.updateMessage + offlineNotice + staleNotice,
          buttons: isOffline ? ['Continue Offline', 'Exit'] : ['Update Now', 'Exit App'],
          defaultId: 0,
          cancelId: 1,
          icon: this.getAppIcon()
        })
        
        if (isOffline && forceResult.response === 0) {
          await this.analytics?.forceUpdateContinuedOffline(versionStatus.userVersion)
          return true // Allow to continue offline
        }
        
        if (!isOffline && forceResult.response === 0) {
          shell.openExternal(config.downloadUrl)
        }
        
        await this.analytics?.forceUpdateRequired(versionStatus.userVersion)
        return false

      case 'deprecated':
        // Always show deprecation warning but don't block
        dialog.showMessageBox({
          type: 'info',
          title: 'Update Recommended',
          message: 'Your version will be deprecated soon',
          detail: `${config.updateMessage}${offlineNotice}${staleNotice}\n\nYou can continue using this version for now.`,
          buttons: isOffline ? ['Continue'] : ['Download Update', 'Continue'],
          defaultId: 0,
          icon: this.getAppIcon()
        }).then((result) => {
          if (!isOffline && result.response === 0) {
            shell.openExternal(config.downloadUrl)
          }
        })
        
        await this.analytics?.versionDeprecatedWarning(versionStatus.userVersion)
        return true

      case 'allowed':
        // Check if there's a newer version available (only show when online)
        if (!isOffline && this.versionController?.isVersionNewer(config.latestVersion, versionStatus.userVersion)) {
          this.showOptionalUpdateNotification(config)
        }
        return true

      default:
        return true
    }
  }

  private async performPeriodicVersionCheck(): Promise<void> {
    if (!this.versionController) return
    
    try {
      console.log('🔄 Performing periodic version check...')
      const versionStatus = await this.versionController.checkVersionStatus()
      
      // Only take action for blocked or force_update status
      if (versionStatus.status === 'blocked' || versionStatus.status === 'force_update') {
        const shouldContinue = await this.handleVersionStatus(versionStatus)
        if (!shouldContinue) {
          app.quit()
        }
      }
      
    } catch (error) {
      console.warn('🔄 Periodic version check failed (continuing normally):', error)
      // CRITICAL: Never crash the app due to version check failures
    }
  }

  private showOptionalUpdateNotification(config: any): void {
    // Track update notification shown
    this.analytics?.updateNotificationShown(config.latestVersion)
    
    // Add update notification to tray icon (optional)
    if (this.tray) {
      try {
        this.tray.displayBalloon({
          title: 'SayaLens Update Available',
          content: 'A new version is ready to download!',
          icon: this.createTrayIconImage()
        })
      } catch (error) {
        console.warn('Failed to show update balloon:', error)
      }
    }
  }

  // Enhanced manual update check with offline awareness
  private async performManualUpdateCheck(): Promise<void> {
    if (!this.versionController) return
    
    // Track manual update check initiation
    await this.analytics?.manualUpdateCheck()
    
    try {
      const versionStatus = await this.versionController.checkVersionStatus()
      
      if (versionStatus.isOffline) {
        const cacheAgeHours = Math.round(versionStatus.cacheAge / (60 * 60 * 1000))
        dialog.showMessageBox({
          type: 'info',
          title: 'Offline Mode',
          message: 'Cannot check for updates while offline',
          detail: `Last update check: ${cacheAgeHours} hours ago\nCurrent version: ${versionStatus.userVersion}\n\nPlease connect to the internet to check for updates.`,
          buttons: ['OK'],
          icon: this.getAppIcon()
        })
        return
      }
      
      if (versionStatus.status === 'allowed' && 
          !this.versionController.isVersionNewer(versionStatus.config.latestVersion, versionStatus.userVersion)) {
        dialog.showMessageBox({
          type: 'info',
          title: 'No Updates Available',
          message: 'You have the latest version!',
          detail: `Current version: ${versionStatus.userVersion}`,
          buttons: ['OK'],
          icon: this.getAppIcon()
        })
      } else {
        await this.handleVersionStatus(versionStatus)
      }
      
    } catch (error) {
      // Track update check failure
      await this.analytics?.updateCheckFailed((error as Error).message)
      
      dialog.showMessageBox({
        type: 'error',
        title: 'Update Check Failed',
        message: 'Unable to check for updates',
        detail: 'Please check your internet connection and try again.',
        buttons: ['OK'],
        icon: this.getAppIcon()
      })
    }
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
    const params = new URLSearchParams(url);
    const filepath = atob(params.get('encoded'));
    return net.fetch(`file:///${filepath}`);
  });

  trayScanner.init()
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
})
