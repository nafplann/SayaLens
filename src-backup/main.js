import { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, screen, desktopCapturer, clipboard, nativeImage, nativeTheme, dialog, shell } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import ScreenCapture from './modules/screenCapture.js';
import QRScanner from './modules/qrScanner.js';
import OCRProcessor from './modules/ocrProcessor.js';
import { tmpdir } from "node:os";
import { writeFile } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class TrayScanner {
  constructor() {
    this.tray = null;
    this.screenCapture = null;
    this.qrScanner = null;
    this.ocrProcessor = null;
    this.captureWindow = null;
    this.resultWindow = null;
  }

  async init() {
    // Initialize modules
    this.screenCapture = new ScreenCapture();
    this.qrScanner = new QRScanner();
    this.ocrProcessor = new OCRProcessor();

    // Check screen recording permissions on startup for macOS
    if (process.platform === 'darwin') {
      this.checkInitialPermissions();
    }

    // Create tray
    this.createTray();

    // Set up theme change listener for macOS
    this.setupThemeChangeListener();

    // Set up IPC handlers
    this.setupIpcHandlers();

    // Prevent app from quitting when all windows are closed
    app.on('window-all-closed', (e) => {
      e.preventDefault();
    });
  }

  checkInitialPermissions() {
    try {
      console.log('Checking initial screen recording permissions...');
      const hasPermission = this.screenCapture.checkPermissions();
      if (!hasPermission) {
        console.warn('Screen recording permission not granted. User will need to enable it manually.');
      } else {
        console.log('Screen recording permission is granted.');
      }
    } catch (error) {
      console.warn('Permission check failed:', error);
    }
  }

  showPermissionDialog() {
    const macOSVersion = process.getSystemVersion();
    const versionMajor = parseInt(macOSVersion.split('.')[0]);
    const settingsName = versionMajor >= 13 ? 'System Settings' : 'System Preferences';
    
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
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
      }
    });
  }

  /**
   * Get the appropriate tray icon path based on the current system theme
   * @returns {string} Path to the tray icon
   */
  getTrayIconPath() {
    const isDarkMode = nativeTheme.shouldUseDarkColors;
    const iconName = isDarkMode ? 'tray-icon-light.png' : 'tray-icon-dark.png';
    return join(__dirname, '..', 'assets', iconName);
  }

  /**
   * Create a tray icon image with theme awareness and fallback handling
   * @returns {Electron.NativeImage} The created tray icon
   */
  createTrayIconImage() {
    const fallbackIconData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAaCxAAAAsQHGLUmNAAAAGXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAAAVBJREFUSInF1bEuBFEUxvEfUWyzRKMgsSKiIEGvVSoUKgkPQAXQKjyDJyBEQSGRrbR6JBQiEiIkGkIhFEuxd3bHZGzs7Gx8yeROzj33/03uOXMvbVZH7L2EORQSOUe4+GX9OGYTsXcc4jYeLOEFX0mngrUGH7gWcpJrngOzptUwMdYA9feNBdYrdIVgTxgv0YkFDDQJvsduYNSYXSmJC9huEh7pK5jU1JmSNJIRDqPJQGTwircWwEm9BWZtizZxkKPBFB7iBp/qfXuD44zgm8TYfkV/8jTWpRc9iyrYwElewP9TR0psCYsZedvYigeiLiqgX7X6w5jJaHASxiE84iOqwTJOM0LTdI4V6l3TjWKOBsXATG3L6xbAV8lA2mm6o9rHE03Cz7D322TbLpxIJdVrLs8rc5D6Ft1iEvPoiwEqKDcwKKPXz1o+YR93Ddblp2/k9U7YtyTYYgAAAABJRU5ErkJggg==';

    // For macOS, try to use theme-aware icons
    if (process.platform === 'darwin') {
      try {
        const iconPath = this.getTrayIconPath();
        return nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
      } catch (error) {
        console.warn('Failed to load theme-aware tray icon, using fallback:', error.message);
      }
    }
    
    // Use fallback icon for non-macOS platforms or when theme-specific icons fail
    return nativeImage.createFromDataURL(fallbackIconData).resize({ width: 16, height: 16 });
  }

  /**
   * Set up theme change listener for macOS
   */
  setupThemeChangeListener() {
    if (process.platform === 'darwin') {
      nativeTheme.on('updated', () => {
        console.log('System theme changed, updating tray icon...');
        this.updateTrayIcon();
      });
    }
  }

  /**
   * Update the tray icon when theme changes
   */
  updateTrayIcon() {
    if (this.tray) {
      const icon = this.createTrayIconImage();
      this.tray.setImage(icon);
      console.log(`Tray icon updated for ${nativeTheme.shouldUseDarkColors ? 'dark' : 'light'} mode`);
    }
  }

  createTray() {
    // Create tray icon using the consolidated method
    const icon = this.createTrayIconImage();
    console.log(`Created tray icon for ${process.platform === 'darwin' ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light') + ' mode' : 'default mode'}`);

    this.tray = new Tray(icon);
    this.tray.setToolTip('SayaLens - A text grabber');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Capture Text',
        click: () => this.startOCR()
      },
      {
        label: 'Scan QR',
        click: () => this.startQRScan()
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  setupIpcHandlers() {
    ipcMain.handle('get-screen-sources', async () => {
      const sources = await desktopCapturer.getSources({
        types: ['screen']
      });
      return sources;
    });

    ipcMain.handle('process-qr', async (_event, imageData) => {
      return await this.qrScanner.scanImage(imageData);
    });

    ipcMain.handle('process-ocr', async (_event, imageData) => {
      return await this.ocrProcessor.extractText(imageData);
    });

    ipcMain.handle('capture-and-process-qr', async (_event, bounds) => {
      try {
        console.log('Starting QR capture process...');
        const imageBuffer = await this.screenCapture.captureArea(bounds);
        console.log('Screen capture successful, processing QR...');
        const qrResult = await this.qrScanner.scanImage(imageBuffer);
        
        // Add the captured image to the result
        return {
          ...qrResult,
          capturedImage: `data:image/png;base64,${imageBuffer.toString('base64')}`
        };
      } catch (error) {
        console.error('QR capture failed:', error);
        
        // Show permission dialog if it's a permission error on macOS
        if (process.platform === 'darwin' && error.message.includes('Screen recording permission not granted')) {
          this.showPermissionDialog();
        }
        
        return {
          success: false,
          error: error.message
        };
      }
    });

    ipcMain.handle('capture-and-process-ocr', async (_event, bounds) => {
      try {
        console.log('Starting OCR capture process...');
        const imageBuffer = await this.screenCapture.captureArea(bounds);
        console.log('Screen capture successful, processing OCR...');

        // Create a temporary image file
        const tempDir = tmpdir();
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2);
        const tempFilePath = join(tempDir, `SayaLens_ocr_temp_${timestamp}_${randomSuffix}.png`);

        // Write the image buffer to the temporary file
        await writeFile(tempFilePath, imageBuffer, () => {});

        const ocrResult = await this.ocrProcessor.extractText(tempFilePath);
        
        // Add the captured image to the result
        return {
          ...ocrResult,
          capturedImage: tempFilePath
        };
      } catch (error) {
        console.error('OCR capture failed:', error);
        
        // Show permission dialog if it's a permission error on macOS
        if (process.platform === 'darwin' && error.message.includes('Screen recording permission not granted')) {
          this.showPermissionDialog();
        }
        
        return {
          success: false,
          error: error.message
        };
      } finally { /* empty */ }
    });

    ipcMain.handle('copy-to-clipboard', (_event, text) => {
      clipboard.writeText(text);
    });

    ipcMain.on('capture-complete', () => {
      if (this.captureWindow) {
        this.captureWindow.close();
        this.captureWindow = null;
      }
    });

    ipcMain.on('show-result', (_event, data) => {
      this.showResult(data);
    });

    ipcMain.on('close-result', () => {
      if (this.resultWindow) {
        this.resultWindow.close();
        this.resultWindow = null;
      }
    });
  }

  async startQRScan() {
    this.createCaptureWindow('qr');
  }

  async startOCR() {
    this.createCaptureWindow('ocr');
  }

  createCaptureWindow(mode) {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const preloadPath = join(__dirname, 'preload.js');
    
    console.log('Creating capture window with preload path:', preloadPath);
    console.log('displaySize: ', width, height);

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
        preload: preloadPath
      },
      title: 'SayaLens'
    });

    console.log('captureSize: ', this.captureWindow.getContentSize());

    this.captureWindow.loadFile(join(__dirname, 'capture.html'));

    // Add error handling for preload script
    this.captureWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
      console.error('Preload script error:', preloadPath);
      console.error('Preload script error:', error);
    });

    this.captureWindow.webContents.once('did-finish-load', () => {
      console.log('Capture window finished loading');
      this.captureWindow.webContents.send('init-capture', { mode });
    });

    this.captureWindow.webContents.on('dom-ready', () => {
      console.log('Capture window DOM ready');
    });

    this.captureWindow.on('closed', () => {
      this.captureWindow = null;
    });
  }

  showResult(data) {
    const preloadPath = join(__dirname, 'preload.js');
    
    console.log('Creating result window with preload path:', preloadPath);

    this.resultWindow = new BrowserWindow({
      width: 400,
      height: 500,
      resizable: true,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: preloadPath
      }
    });

    this.resultWindow.loadFile(join(__dirname, 'result.html'));

    this.resultWindow.webContents.once('did-finish-load', () => {
      this.resultWindow.webContents.send('show-data', data);
    });

    this.resultWindow.on('closed', () => {
      this.resultWindow = null;
    });
  }
}

// App initialization
const trayScanner = new TrayScanner();

app.whenReady().then(() => {
  // Hide Dock icon on macOS to make it an agent app
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
  
  trayScanner.init();
});

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
});