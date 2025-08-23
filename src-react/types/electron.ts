export interface ElectronAPI {
  getScreenSources: () => Promise<any[]>;
  processQR: (imageData: any) => Promise<QRResult>;
  processOCR: (imageData: any) => Promise<OCRResult>;
  captureAndProcessQR: (bounds: ScreenBounds) => Promise<QRResult>;
  captureAndProcessOCR: (bounds: ScreenBounds) => Promise<OCRResult>;
  copyToClipboard: (text: string) => Promise<void>;
  
  captureComplete: (bounds?: ScreenBounds) => void;
  showResult: (data: ResultData) => void;
  closeResult: () => void;
  
  onInitCapture: (callback: (event: any, data: { mode: CaptureMode }) => void) => void;
  onShowData: (callback: (event: any, data: ResultData) => void) => void;
}

export interface ScreenBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QRResult {
  success: boolean;
  data?: string;
  capturedImage?: string;
  error?: string;
}

export interface OCRResult {
  success: boolean;
  text?: string;
  confidence?: number;
  capturedImage?: string;
  error?: string;
}

export interface ResultData {
  type: CaptureMode;
  result: QRResult | OCRResult;
}

export type CaptureMode = 'qr' | 'ocr';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
