import { desktopCapturer, screen, systemPreferences, DesktopCapturerSource } from 'electron'

interface CaptureArea {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Screen capture utility that handles screen recording permissions and image capture
 * Supports macOS-specific permission handling and multi-display setups
 */
export default class ScreenCapture {
  /**
   * Creates a ScreenCapture instance
   */
  constructor() {
    // No initialization required
  }

  /**
   * Checks if the application has screen recording permissions
   * On macOS, this requires explicit user permission in System Preferences
   * @returns True if permissions are granted or not required, false otherwise
   */
  checkPermissions(): boolean {
    // Check macOS screen recording permissions
    if (process.platform === 'darwin') {
      const hasPermission = systemPreferences.getMediaAccessStatus('screen')
      console.log('Screen recording permission status:', hasPermission)
      
      if (hasPermission !== 'granted') {
        console.warn('Screen recording permission not granted. User must enable it manually in System Preferences.')
        return false
      }
      return true
    }
    return true // Non-macOS platforms don't require explicit permission
  }

  /**
   * Captures a specific rectangular area of the screen
   * Handles display scaling and permission checks automatically
   * @param bounds - The screen area to capture
   * @returns PNG image buffer of the captured area
   * @throws If permissions are not granted or capture fails
   */
  async captureArea(bounds: CaptureArea): Promise<Buffer> {
    try {
      console.log('Starting screen capture for bounds:', bounds)
      
      // Check permissions first - required on macOS
      const hasPermission = this.checkPermissions()
      if (!hasPermission) {
        throw new Error('Screen recording permission not granted.\n\nTo enable:\n1. Open System Preferences (or System Settings on macOS 13+)\n2. Go to Privacy & Security > Screen Recording\n3. Add this application and enable it\n4. Restart the application')
      }

      // Get the primary display to calculate proper scaling for high-DPI displays
      const primaryDisplay = screen.getPrimaryDisplay()
      const scaleFactor = primaryDisplay.scaleFactor

      console.log('Primary display info:', {
        bounds: primaryDisplay.bounds,
        scaleFactor: scaleFactor
      })

      // Request screen capture sources from Electron
      const sources: DesktopCapturerSource[] = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: primaryDisplay.bounds.width * scaleFactor,
          height: primaryDisplay.bounds.height * scaleFactor
        }
      })

      console.log('Retrieved sources:', sources.length)

      if (sources.length === 0) {
        throw new Error('No screen sources available. This might be due to permission issues.')
      }

      // Use the first available screen source (primary display)
      const source = sources[0]
      console.log('Using source:', {
        id: source.id,
        name: source.name,
        thumbnailSize: {
          width: source.thumbnail.getSize().width,
          height: source.thumbnail.getSize().height
        }
      })

      // Calculate the actual crop area based on display scale factor
      // This ensures proper capture on Retina/high-DPI displays
      const cropX = Math.floor(bounds.x * scaleFactor)
      const cropY = Math.floor(bounds.y * scaleFactor)
      const cropWidth = Math.floor(bounds.width * scaleFactor)
      const cropHeight = Math.floor(bounds.height * scaleFactor)

      console.log('Crop parameters:', {
        cropX, cropY, cropWidth, cropHeight,
        scaleFactor,
        originalBounds: bounds
      })

      // Crop the captured screenshot to the specified area
      const croppedImage = source.thumbnail.crop({
        x: cropX,
        y: cropY,
        width: cropWidth,
        height: cropHeight
      })

      return croppedImage.toPNG()
    } catch (error) {
      console.error('Screen capture failed:', error)
      throw new Error(`Failed to capture screen: ${(error as Error).message}`)
    }
  }
}
