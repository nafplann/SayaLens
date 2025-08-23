class ResultDisplay {
  constructor() {
    this.icon = document.getElementById('icon');
    this.title = document.getElementById('title');
    this.content = document.getElementById('content');
    this.actions = document.getElementById('actions');
    this.copyFeedback = document.getElementById('copyFeedback');
    
    window.electronAPI.onShowData((event, data) => {
      this.displayResult(data);
    });
  }
  
  displayResult(data) {
    const { type, result } = data;
    
    if (result.success) {
      if (type === 'qr') {
        this.showQRResult(result);
      } else {
        this.showTextResult(result);
      }
    } else {
      this.showError(type, result.error);
    }
  }
  
  showQRResult(result) {
    this.icon.className = 'icon qr-icon';
    this.title.textContent = 'QR Code Detected';
    
    const capturedImageHtml = result.capturedImage ? `
      <div class="captured-image">
        <div class="image-label">Captured Area</div>
        <img src="${result.capturedImage}" alt="Captured QR Code">
      </div>
    ` : '';
    
    this.content.innerHTML = `
      <div class="result-text">${this.escapeHtml(result.data)}</div>
      ${capturedImageHtml}
    `;
    
    this.actions.innerHTML = `
      <button class="btn btn-primary" onclick="resultDisplay.copyToClipboard('${this.escapeHtml(result.data)}')">
        Copy to Clipboard
      </button>
      <button class="btn btn-secondary" onclick="resultDisplay.close()">
        Close
      </button>
    `;
  }
  
  showTextResult(result) {
    this.icon.className = 'icon text-icon';
    this.title.textContent = 'Text Extracted';
    
    const capturedImageHtml = result.capturedImage ? `
      <div class="captured-image">
        <div class="image-label">Captured Area</div>
        <img src="${result.capturedImage}" alt="Captured Text">
      </div>
    ` : '';
    
    this.content.innerHTML = `
      <div class="result-text">${this.escapeHtml(result.text)}</div>
      ${result.confidence ? `<div class="confidence">Confidence: ${result.confidence}%</div>` : ''}
      ${capturedImageHtml}
    `;
    
    this.actions.innerHTML = `
      <button class="btn btn-primary" onclick="resultDisplay.copyToClipboard(\`${this.escapeHtml(result.text)}\`)">
        Copy to Clipboard
      </button>
      <button class="btn btn-secondary" onclick="resultDisplay.close()">
        Close
      </button>
    `;
  }
  
  showError(type, error) {
    this.icon.className = 'icon error-icon';
    this.title.textContent = type === 'qr' ? 'QR Scan Failed' : 'Text Extraction Failed';
    
    this.content.innerHTML = `
      <div class="error-message">${this.escapeHtml(error)}</div>
    `;
    
    this.actions.innerHTML = `
      <button class="btn btn-secondary" onclick="resultDisplay.close()">
        Close
      </button>
    `;
  }
  
  async copyToClipboard(text) {
    try {
      await window.electronAPI.copyToClipboard(text);
      this.showCopyFeedback();
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }
  
  showCopyFeedback() {
    this.copyFeedback.classList.add('show');
    setTimeout(() => {
      this.copyFeedback.classList.remove('show');
    }, 2000);
  }
  
  close() {
    window.electronAPI.closeResult();
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

const resultDisplay = new ResultDisplay();

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    resultDisplay.close();
  } else if (e.metaKey && e.key === 'c') {
    // Allow native copy if text is selected
    if (window.getSelection().toString()) {
      return;
    }
    // Otherwise copy the main result
    const resultText = document.querySelector('.result-text');
    if (resultText) {
      resultDisplay.copyToClipboard(resultText.textContent);
    }
  }
});
