"use strict";
const electron = require("electron");
const path = require("path");
const jsQR = require("jsqr");
const sharp = require("sharp");
const tesseract_js = require("tesseract.js");
const node_os = require("node:os");
const node_fs = require("node:fs");
const is = {
  dev: !electron.app.isPackaged
};
({
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
});
class ScreenCapture {
  /**
   * Creates a ScreenCapture instance
   */
  constructor() {
  }
  /**
   * Checks if the application has screen recording permissions
   * On macOS, this requires explicit user permission in System Preferences
   * @returns True if permissions are granted or not required, false otherwise
   */
  checkPermissions() {
    if (process.platform === "darwin") {
      const hasPermission = electron.systemPreferences.getMediaAccessStatus("screen");
      console.log("Screen recording permission status:", hasPermission);
      if (hasPermission !== "granted") {
        console.warn("Screen recording permission not granted. User must enable it manually in System Preferences.");
        return false;
      }
      return true;
    }
    return true;
  }
  /**
   * Captures a specific rectangular area of the screen
   * Handles display scaling and permission checks automatically
   * @param bounds - The screen area to capture
   * @returns PNG image buffer of the captured area
   * @throws If permissions are not granted or capture fails
   */
  async captureArea(bounds) {
    try {
      console.log("Starting screen capture for bounds:", bounds);
      const hasPermission = this.checkPermissions();
      if (!hasPermission) {
        throw new Error("Screen recording permission not granted.\n\nTo enable:\n1. Open System Preferences (or System Settings on macOS 13+)\n2. Go to Privacy & Security > Screen Recording\n3. Add this application and enable it\n4. Restart the application");
      }
      const primaryDisplay = electron.screen.getPrimaryDisplay();
      const scaleFactor = primaryDisplay.scaleFactor;
      console.log("Primary display info:", {
        bounds: primaryDisplay.bounds,
        scaleFactor
      });
      const sources = await electron.desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: {
          width: primaryDisplay.bounds.width * scaleFactor,
          height: primaryDisplay.bounds.height * scaleFactor
        }
      });
      console.log("Retrieved sources:", sources.length);
      if (sources.length === 0) {
        throw new Error("No screen sources available. This might be due to permission issues.");
      }
      const source = sources[0];
      console.log("Using source:", {
        id: source.id,
        name: source.name,
        thumbnailSize: {
          width: source.thumbnail.getSize().width,
          height: source.thumbnail.getSize().height
        }
      });
      const cropX = Math.floor(bounds.x * scaleFactor);
      const cropY = Math.floor(bounds.y * scaleFactor);
      const cropWidth = Math.floor(bounds.width * scaleFactor);
      const cropHeight = Math.floor(bounds.height * scaleFactor);
      console.log("Crop parameters:", {
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        scaleFactor,
        originalBounds: bounds
      });
      const croppedImage = source.thumbnail.crop({
        x: cropX,
        y: cropY,
        width: cropWidth,
        height: cropHeight
      });
      return croppedImage.toPNG();
    } catch (error) {
      console.error("Screen capture failed:", error);
      throw new Error(`Failed to capture screen: ${error.message}`);
    }
  }
}
class QRScanner {
  /**
   * Scans an image buffer for QR codes and extracts their data
   * @param imageBuffer - The image data as a Buffer
   * @returns The scan result object
   */
  async scanImage(imageBuffer) {
    try {
      const { data, info } = await sharp(imageBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const imageData = new Uint8ClampedArray(data);
      const result = jsQR(imageData, info.width, info.height);
      if (result) {
        return {
          success: true,
          data: result.data,
          location: result.location
        };
      } else {
        return {
          success: false,
          error: "No QR code found"
        };
      }
    } catch (error) {
      console.error("QR scanning failed:", error);
      return {
        success: false,
        error: "Failed to process image"
      };
    }
  }
}
class OCRProcessor {
  worker = null;
  currentLanguage = "eng";
  /**
   * Creates an OCRProcessor instance
   */
  constructor() {
    this.worker = null;
  }
  /**
   * Initializes or returns existing Tesseract worker instance
   * Worker is created once and reused for performance
   * @private
   * @returns The Tesseract worker instance
   */
  async initWorker() {
    if (!this.worker) {
      this.worker = await tesseract_js.createWorker(this.currentLanguage);
    }
    return this.worker;
  }
  /**
   * Changes the OCR language and reinitializes the worker
   * @param language - The language code (e.g., 'eng', 'jpn', 'fra')
   */
  async setLanguage(language) {
    if (this.currentLanguage === language) {
      return;
    }
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    this.currentLanguage = language;
    await this.initWorker();
  }
  /**
   * Gets the current language being used for OCR
   * @returns The current language code
   */
  getCurrentLanguage() {
    return this.currentLanguage;
  }
  /**
   * Extracts text from an image file using OCR
   * @param filePath - The path to the image file
   * @returns The OCR result object
   */
  async extractText(filePath) {
    try {
      const worker = await this.initWorker();
      const { data: { text, confidence } } = await worker.recognize(filePath);
      const cleanText = text.trim();
      if (cleanText && confidence > 30) {
        return {
          success: true,
          text: cleanText,
          confidence: Math.round(confidence)
        };
      } else {
        return {
          success: false,
          error: "No readable text found"
        };
      }
    } catch (error) {
      console.error("OCR processing failed:", error);
      return {
        success: false,
        error: "Failed to process image"
      };
    }
  }
  /**
   * Cleanup method to terminate the worker
   */
  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}
class TrayScanner {
  tray = null;
  screenCapture = null;
  qrScanner = null;
  ocrProcessor = null;
  captureWindow = null;
  resultWindow = null;
  async init() {
    this.screenCapture = new ScreenCapture();
    this.qrScanner = new QRScanner();
    this.ocrProcessor = new OCRProcessor();
    if (process.platform === "darwin") {
      this.checkInitialPermissions();
    }
    this.createTray();
    this.setupThemeChangeListener();
    this.setupIpcHandlers();
    electron.app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        electron.app.quit();
      }
    });
  }
  checkInitialPermissions() {
    try {
      console.log("Checking initial screen recording permissions...");
      const hasPermission = this.screenCapture?.checkPermissions();
      if (!hasPermission) {
        console.warn("Screen recording permission not granted. User will need to enable it manually.");
      } else {
        console.log("Screen recording permission is granted.");
      }
    } catch (error) {
      console.warn("Permission check failed:", error);
    }
  }
  showPermissionDialog() {
    const macOSVersion = process.getSystemVersion();
    const versionMajor = parseInt(macOSVersion.split(".")[0]);
    const settingsName = versionMajor >= 13 ? "System Settings" : "System Preferences";
    electron.dialog.showMessageBox({
      type: "warning",
      title: "Screen Recording Permission Required",
      message: "This app needs permission to record your screen to capture QR codes and text.",
      detail: `To enable screen recording:

1. Open ${settingsName}
2. Go to Privacy & Security > Screen Recording
3. Add this application and enable it
4. Restart the application

After enabling the permission, try again.`,
      buttons: ["OK", "Open System Preferences"],
      defaultId: 0,
      cancelId: 0
    }).then((result) => {
      if (result.response === 1) {
        electron.shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
      }
    });
  }
  /**
   * Get the appropriate tray icon path based on the current system theme
   */
  getTrayIconPath() {
    const isDarkMode = electron.nativeTheme.shouldUseDarkColors;
    const iconName = isDarkMode ? "tray-icon-light.png" : "tray-icon-dark.png";
    return path.join(process.cwd(), "resources", iconName);
  }
  /**
   * Create a tray icon image with theme awareness and fallback handling
   */
  createTrayIconImage() {
    const fallbackIconData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAaCxAAAAsQHGLUmNAAAAGXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAAAVBJREFUSInF1bEuBFEUxvEfUWyzRKMgsSKiIEGvVSoUKgkPQAXQKjyDJyBEQSGRrbR6JBQiEiIkGkIhFEuxd3bHZGzs7Gx8yeROzj33/03uOXMvbVZH7L2EORQSOUe4+GX9OGYTsXcc4jYeLOEFX0mngrUGH7gWcpJrngOzptUwMdYA9feNBdYrdIVgTxgv0YkFDDQJvsduYNSYXSmJC9huEh7pK5jU1JmSNJIRDqPJQGTwircWwEm9BWZtizZxkKPBFB7iBp/qfXuD44zgm8TYfkV/8jTWpRc9iyrYwElewP9TR0psCYsZedvYigeiLiqgX7X6w5jJaHASxiE84iOqwTJOM0LTdI4V6l3TjWKOBsXATG3L6xbAV8lA2mm6o9rHE03Cz7D322TbLpxIJdVrLs8rc5D6Ft1iEvPoiwEqKDcwKKPXz1o+YR93Ddblp2/k9U7YtyTYYgAAAABJRU5ErkJggg==";
    if (process.platform === "darwin") {
      try {
        const iconPath = this.getTrayIconPath();
        return electron.nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
      } catch (error) {
        console.warn("Failed to load theme-aware tray icon, using fallback:", error.message);
      }
    }
    return electron.nativeImage.createFromDataURL(fallbackIconData).resize({ width: 16, height: 16 });
  }
  /**
   * Set up theme change listener for macOS
   */
  setupThemeChangeListener() {
    if (process.platform === "darwin") {
      electron.nativeTheme.on("updated", () => {
        console.log("System theme changed, updating tray icon...");
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
      console.log(`Tray icon updated for ${electron.nativeTheme.shouldUseDarkColors ? "dark" : "light"} mode`);
    }
  }
  createTray() {
    const icon = this.createTrayIconImage();
    console.log(`Created tray icon for ${process.platform === "darwin" ? (electron.nativeTheme.shouldUseDarkColors ? "dark" : "light") + " mode" : "default mode"}`);
    this.tray = new electron.Tray(icon);
    this.tray.setToolTip("SayaLens - A text grabber");
    const contextMenu = electron.Menu.buildFromTemplate([
      {
        label: "Capture Text",
        click: () => this.startOCR()
      },
      {
        label: "Scan QR",
        click: () => this.startQRScan()
      },
      { type: "separator" },
      {
        label: "Exit",
        click: () => {
          electron.app.quit();
        }
      }
    ]);
    this.tray.setContextMenu(contextMenu);
  }
  setupIpcHandlers() {
    electron.ipcMain.handle("get-screen-sources", async () => {
      const sources = await electron.desktopCapturer.getSources({
        types: ["screen"]
      });
      return sources;
    });
    electron.ipcMain.handle("process-qr", async (_event, imageData) => {
      return await this.qrScanner?.scanImage(imageData);
    });
    electron.ipcMain.handle("process-ocr", async (_event, imageData) => {
      return await this.ocrProcessor?.extractText(imageData);
    });
    electron.ipcMain.handle("capture-and-process-qr", async (_event, bounds) => {
      try {
        console.log("Starting QR capture process...");
        const imageBuffer = await this.screenCapture?.captureArea(bounds);
        console.log("Screen capture successful, processing QR...");
        const qrResult = await this.qrScanner?.scanImage(imageBuffer);
        return {
          ...qrResult,
          capturedImage: `data:image/png;base64,${imageBuffer?.toString("base64")}`
        };
      } catch (error) {
        console.error("QR capture failed:", error);
        if (process.platform === "darwin" && error.message.includes("Screen recording permission not granted")) {
          this.showPermissionDialog();
        }
        return {
          success: false,
          error: error.message
        };
      }
    });
    electron.ipcMain.handle("capture-and-process-ocr", async (_event, bounds) => {
      try {
        console.log("Starting OCR capture process...");
        const imageBuffer = await this.screenCapture?.captureArea(bounds);
        console.log("Screen capture successful, processing OCR...");
        const tempDir = node_os.tmpdir();
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2);
        const tempFilePath = path.join(tempDir, `SayaLens_ocr_temp_${timestamp}_${randomSuffix}.png`);
        node_fs.writeFileSync(tempFilePath, imageBuffer);
        const ocrResult = await this.ocrProcessor?.extractText(tempFilePath);
        console.info("Ocr result:", {
          ...ocrResult,
          capturedImage: tempFilePath
        });
        return {
          ...ocrResult,
          capturedImage: tempFilePath
        };
      } catch (error) {
        console.error("OCR capture failed:", error);
        if (process.platform === "darwin" && error.message.includes("Screen recording permission not granted")) {
          this.showPermissionDialog();
        }
        return {
          success: false,
          error: error.message
        };
      }
    });
    electron.ipcMain.handle("copy-to-clipboard", (_event, text) => {
      electron.clipboard.writeText(text);
    });
    electron.ipcMain.handle("set-ocr-language", async (_event, language) => {
      try {
        await this.ocrProcessor?.setLanguage(language);
        return { success: true };
      } catch (error) {
        console.error("Failed to set OCR language:", error);
        return { success: false, error: error.message };
      }
    });
    electron.ipcMain.handle("reprocess-ocr", async (_event, imagePath) => {
      try {
        console.log("Reprocessing OCR with new language for image:", imagePath);
        const ocrResult = await this.ocrProcessor?.extractText(imagePath);
        return {
          ...ocrResult,
          capturedImage: imagePath
        };
      } catch (error) {
        console.error("OCR reprocessing failed:", error);
        return {
          success: false,
          error: error.message
        };
      }
    });
    electron.ipcMain.on("capture-complete", () => {
      if (this.captureWindow) {
        this.captureWindow.close();
        this.captureWindow = null;
      }
    });
    electron.ipcMain.on("show-result", (_event, data) => {
      this.showResult(data);
    });
    electron.ipcMain.on("close-result", () => {
      if (this.resultWindow) {
        this.resultWindow.close();
        this.resultWindow = null;
      }
    });
  }
  async startQRScan() {
    this.createCaptureWindow("qr");
  }
  async startOCR() {
    this.createCaptureWindow("ocr");
  }
  createCaptureWindow(mode) {
    const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
    console.log("Creating capture window");
    console.log("displaySize: ", width, height);
    this.captureWindow = new electron.BrowserWindow({
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
        preload: path.join(__dirname, "../preload/index.js")
      },
      title: "SayaLens"
    });
    console.log("captureSize: ", this.captureWindow.getContentSize());
    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      this.captureWindow.loadURL(process.env["ELECTRON_RENDERER_URL"] + "/capture");
    } else {
      this.captureWindow.loadFile(path.join(__dirname, "../renderer/capture.html"));
    }
    this.captureWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
      console.error("Preload script error:", preloadPath);
      console.error("Preload script error:", error);
    });
    this.captureWindow.webContents.once("did-finish-load", () => {
      console.log("Capture window finished loading");
      this.captureWindow?.webContents.send("init-capture", { mode });
    });
    this.captureWindow.webContents.on("dom-ready", () => {
      console.log("Capture window DOM ready");
    });
    this.captureWindow.on("closed", () => {
      this.captureWindow = null;
    });
  }
  showResult(data) {
    console.log("Creating result window");
    this.resultWindow = new electron.BrowserWindow({
      width: 720,
      height: 640,
      resizable: false,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "../preload/index.js")
      }
    });
    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      this.resultWindow.loadURL(process.env["ELECTRON_RENDERER_URL"] + "/result");
    } else {
      this.resultWindow.loadFile(path.join(__dirname, "../renderer/result.html"));
    }
    this.resultWindow.webContents.once("did-finish-load", () => {
      this.resultWindow?.webContents.send("show-data", data);
    });
    this.resultWindow.on("closed", () => {
      this.resultWindow = null;
    });
  }
}
const trayScanner = new TrayScanner();
electron.protocol.registerSchemesAsPrivileged([
  {
    scheme: "media",
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
      standard: true
    }
  }
]);
electron.app.whenReady().then(() => {
  if (process.platform === "darwin") {
    electron.app.dock.hide();
  }
  electron.protocol.handle("media", async (request) => {
    const url = request.url.replace(/^media:\/\//, "/");
    return electron.net.fetch(`file://${url}`);
  });
  trayScanner.init();
});
electron.app.on("before-quit", () => {
  electron.globalShortcut.unregisterAll();
});
