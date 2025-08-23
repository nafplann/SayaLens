import { createWorker } from 'tesseract.js';

/**
 * OCR (Optical Character Recognition) processor that extracts text from images
 * Uses Tesseract.js engine for text recognition with configurable confidence thresholds
 * @class OCRProcessor
 */
export default class OCRProcessor {
  /**
   * Creates an OCRProcessor instance
   * @constructor
   */
  constructor() {
    /** @private {Object|null} Tesseract worker instance */
    this.worker = null;
  }

  /**
   * Initializes or returns existing Tesseract worker instance
   * Worker is created once and reused for performance
   * @async
   * @private
   * @returns {Promise<Object>} The Tesseract worker instance
   */
  async initWorker() {
    if (!this.worker) {
      this.worker = await createWorker('eng');
    }
    return this.worker;
  }

  /**
   * Extracts text from an image buffer using OCR
   * @async
   * @param {Buffer} imageBuffer - The image data as a Buffer
   * @returns {Promise<Object>} The OCR result object
   * @returns {boolean} returns.success - Whether text extraction was successful
   * @returns {string} [returns.text] - The extracted text (if successful)
   * @returns {number} [returns.confidence] - Confidence score 0-100 (if successful)
   * @returns {string} [returns.error] - Error message (if unsuccessful)
   * 
   * @example
   * const ocr = new OCRProcessor();
   * const result = await ocr.extractText(imageBuffer);
   * if (result.success) {
   *   console.log(`Text: ${result.text} (${result.confidence}% confident)`);
   * } else {
   *   console.error('OCR failed:', result.error);
   * }
   */
  async extractText(imageBuffer) {
    try {
      const worker = await this.initWorker();
      
      // Perform OCR recognition on the image buffer
      const { data: { text, confidence } } = await worker.recognize(imageBuffer);
      
      // Clean up extracted text by trimming whitespace
      const cleanText = text.trim();
      
      // Only return success if text was found and confidence is above threshold
      // Confidence threshold of 30% helps filter out noise and false positives
      if (cleanText && confidence > 30) {
        return {
          success: true,
          text: cleanText,
          confidence: Math.round(confidence)
        };
      } else {
        return {
          success: false,
          error: 'No readable text found'
        };
      }
    } catch (error) {
      console.error('OCR processing failed:', error);
      return {
        success: false,
        error: 'Failed to process image'
      };
    }
  }
}