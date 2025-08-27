import { createWorker, Worker } from 'tesseract.js'

interface OCRResult {
  success: boolean
  text?: string
  confidence?: number
  error?: string
}

/**
 * OCR (Optical Character Recognition) processor that extracts text from images
 * Uses Tesseract.js engine for text recognition with configurable confidence thresholds
 */
export default class OCRProcessor {
  private worker: Worker | null = null
  private currentLanguage: string = 'eng'

  /**
   * Creates an OCRProcessor instance
   */
  constructor() {
    this.worker = null
  }

  /**
   * Initializes or returns existing Tesseract worker instance
   * Worker is created once and reused for performance
   * @private
   * @returns The Tesseract worker instance
   */
  private async initWorker(): Promise<Worker> {
    if (!this.worker) {
      this.worker = await createWorker(this.currentLanguage)
    }
    return this.worker
  }

  /**
   * Changes the OCR language and reinitializes the worker
   * @param language - The language code (e.g., 'eng', 'jpn', 'fra')
   */
  async setLanguage(language: string): Promise<void> {
    if (this.currentLanguage === language) {
      return // No change needed
    }

    // Terminate existing worker if it exists
    if (this.worker) {
      await this.worker.terminate()
      this.worker = null
    }

    // Set new language and reinitialize worker
    this.currentLanguage = language
    await this.initWorker()
  }

  /**
   * Gets the current language being used for OCR
   * @returns The current language code
   */
  getCurrentLanguage(): string {
    return this.currentLanguage
  }

  /**
   * Extracts text from an image file using OCR
   * @param filePath - The path to the image file
   * @returns The OCR result object
   */
  async extractText(filePath: string): Promise<OCRResult> {
    try {
      const worker = await this.initWorker()
      
      // Perform OCR recognition on the image file
      const { data: { text, confidence } } = await worker.recognize(filePath)
      
      // Clean up extracted text by trimming whitespace
      const cleanText = text.trim()
      
      // Only return success if text was found and confidence is above threshold
      // Confidence threshold of 30% helps filter out noise and false positives
      if (cleanText && confidence > 30) {
        return {
          success: true,
          text: cleanText,
          confidence: Math.round(confidence)
        }
      } else {
        return {
          success: false,
          error: 'No readable text found'
        }
      }
    } catch (error) {
      console.error('OCR processing failed:', error)
      return {
        success: false,
        error: 'Failed to process image'
      }
    }
  }

  /**
   * Cleanup method to terminate the worker
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate()
      this.worker = null
    }
  }
}
