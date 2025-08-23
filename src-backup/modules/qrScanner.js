import jsQR from 'jsqr';
import sharp from 'sharp';

/**
 * QR Code scanner that processes image buffers to detect and decode QR codes
 * @class QRScanner
 */
export default class QRScanner {
  /**
   * Scans an image buffer for QR codes and extracts their data
   * @async
   * @param {Buffer} imageBuffer - The image data as a Buffer
   * @returns {Promise<Object>} The scan result object
   * @returns {boolean} returns.success - Whether the scan was successful
   * @returns {string} [returns.data] - The decoded QR code data (if successful)
   * @returns {Object} [returns.location] - QR code corner coordinates (if successful)
   * @returns {string} [returns.error] - Error message (if unsuccessful)
   * 
   * @example
   * const scanner = new QRScanner();
   * const result = await scanner.scanImage(imageBuffer);
   * if (result.success) {
   *   console.log('QR Code data:', result.data);
   * } else {
   *   console.error('Scan failed:', result.error);
   * }
   */
  async scanImage(imageBuffer) {
    try {
      // Convert image to RGBA format using Sharp for consistent processing
      const { data, info } = await sharp(imageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Convert to Uint8ClampedArray format required by jsQR
      const imageData = new Uint8ClampedArray(data);

      // Attempt to scan for QR code using jsQR library
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
          error: 'No QR code found'
        };
      }
    } catch (error) {
      console.error('QR scanning failed:', error);
      return {
        success: false,
        error: 'Failed to process image'
      };
    }
  }
}