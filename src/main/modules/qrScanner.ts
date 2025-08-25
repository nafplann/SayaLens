import jsQR, { QRCode } from 'jsqr'
import sharp from 'sharp'

interface QRScanResult {
  success: boolean
  data?: string
  location?: QRCode['location']
  error?: string
}

/**
 * QR Code scanner that processes image buffers to detect and decode QR codes
 */
export default class QRScanner {
  /**
   * Scans an image buffer for QR codes and extracts their data
   * @param imageBuffer - The image data as a Buffer
   * @returns The scan result object
   */
  async scanImage(imageBuffer: Buffer): Promise<QRScanResult> {
    try {
      // Convert image to RGBA format using Sharp for consistent processing
      const { data, info } = await sharp(imageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

      // Convert to Uint8ClampedArray format required by jsQR
      const imageData = new Uint8ClampedArray(data)

      // Attempt to scan for QR code using jsQR library
      const result = jsQR(imageData, info.width, info.height)
      
      if (result) {
        return {
          success: true,
          data: result.data,
          location: result.location
        }
      } else {
        return {
          success: false,
          error: 'No QR code found'
        }
      }
    } catch (error) {
      console.error('QR scanning failed:', error)
      return {
        success: false,
        error: 'Failed to process image'
      }
    }
  }
}
