class ScreenCaptureUI {
  constructor() {
    this.isSelecting = false;
    this.startX = 0;
    this.startY = 0;
    this.mode = 'qr';

    this.overlay = document.querySelector('.overlay');
    this.selection = document.getElementById('selection');
    this.coordinates = document.getElementById('coordinates');
    this.instructions = document.getElementById('instructions');
    this.loading = document.getElementById('loading');
    this.loadingText = document.getElementById('loadingText');

    // Add debugging for electronAPI
    console.log('ScreenCaptureUI constructor - electronAPI:', typeof window.electronAPI, window.electronAPI);
    
    this.setupEventListeners();
  }

  init(mode) {
    this.mode = mode;
    this.instructions.textContent = mode === 'qr'
            ? 'Drag to select QR code area, then release to scan'
            : 'Drag to select text area, then release to capture';
  }

  setupEventListeners() {
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    document.addEventListener('keydown', this.handleKeyDown.bind(this));

    // Add safety check for electronAPI
    if (window.electronAPI && window.electronAPI.onInitCapture) {
      window.electronAPI.onInitCapture((event, data) => {
        this.init(data.mode);
      });
    } else {
      console.error('electronAPI not available, waiting for it to load...');
      // Try again after a short delay
      setTimeout(() => {
        if (window.electronAPI && window.electronAPI.onInitCapture) {
          console.log('electronAPI now available, setting up listener');
          window.electronAPI.onInitCapture((event, data) => {
            this.init(data.mode);
          });
        } else {
          console.error('electronAPI still not available after timeout');
        }
      }, 100);
    }
  }

  handleMouseDown(e) {
    this.isSelecting = true;
    this.startX = e.clientX;
    this.startY = e.clientY;

    this.selection.style.display = 'block';
    this.coordinates.style.display = 'block';
    this.instructions.style.display = 'none';

    document.body.style.cursor = 'crosshair';
  }

  handleMouseMove(e) {
    if (!this.isSelecting) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(this.startX, currentX);
    const top = Math.min(this.startY, currentY);
    const width = Math.abs(currentX - this.startX);
    const height = Math.abs(currentY - this.startY);

    this.selection.style.left = `${left}px`;
    this.selection.style.top = `${top}px`;
    this.selection.style.width = `${width}px`;
    this.selection.style.height = `${height}px`;

    this.coordinates.style.left = `${currentX + 10}px`;
    this.coordinates.style.top = `${currentY - 30}px`;
    this.coordinates.textContent = `${width} × ${height}`;
  }

  async handleMouseUp(e) {
    if (!this.isSelecting) return;

    this.isSelecting = false;
    document.body.style.cursor = 'default';

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(this.startX, currentX);
    const top = Math.min(this.startY, currentY);
    const width = Math.abs(currentX - this.startX);
    const height = Math.abs(currentY - this.startY);

    if (width < 10 || height < 10) {
      this.reset();
      return;
    }

    const menuBarHeight = 38;
    const bounds = { x: left, y: top + menuBarHeight, width, height };

    this.showLoading();

    try {
      await this.processCapture(bounds);
    } catch (error) {
      console.error('Capture processing failed:', error);
      this.showError('Processing failed');
    }
  }

  async processCapture(bounds) {
    console.log('Processing capture, electronAPI:', typeof window.electronAPI, window.electronAPI);
    
    if (!window.electronAPI) {
      console.error('electronAPI is not available');
      this.showError('Application communication error - electronAPI not available');
      return;
    }
    
    try {
      // Use the main process to capture the screen area
      let result;
      if (this.mode === 'qr') {
        this.loadingText.textContent = 'Scanning QR code...';
        result = await window.electronAPI.captureAndProcessQR(bounds);
      } else {
        this.loadingText.textContent = 'Extracting text...';
        result = await window.electronAPI.captureAndProcessOCR(bounds);
      }

      this.hideLoading();
      window.electronAPI.captureComplete(bounds);
      window.electronAPI.showResult({
        type: this.mode,
        result: result
      });

    } catch (error) {
      this.hideLoading();
      this.showError(error.message);
    }
  }

  handleKeyDown(e) {
    if (e.key === 'Escape') {
      if (window.electronAPI && window.electronAPI.captureComplete) {
        window.electronAPI.captureComplete();
      } else {
        console.error('Cannot close capture window - electronAPI not available');
      }
    }
  }

  showLoading() {
    setTimeout(() => {
      this.loading.style.display = 'block';
      this.selection.style.display = 'none';
      this.coordinates.style.display = 'none';
    }, 100);
  }

  hideLoading() {
    this.loading.style.display = 'none';
  }

  showError(message) {
    this.hideLoading();
    if (window.electronAPI && window.electronAPI.showResult) {
      window.electronAPI.showResult({
        type: this.mode,
        result: {
          success: false,
          error: message
        }
      });
    } else {
      console.error('Cannot show error result - electronAPI not available:', message);
    }
  }

  reset() {
    this.selection.style.display = 'none';
    this.coordinates.style.display = 'none';
    this.instructions.style.display = 'block';
    this.isSelecting = false;
  }
}

// Wait for DOM and electronAPI to be ready
function initializeCaptureUI() {
  if (window.electronAPI) {
    console.log('Initializing ScreenCaptureUI - electronAPI is available');
    new ScreenCaptureUI();
  } else {
    console.log('electronAPI not yet available, waiting...');
    setTimeout(initializeCaptureUI, 50);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCaptureUI);
} else {
  initializeCaptureUI();
}
