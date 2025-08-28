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
   * @param bounds - The screen area to capture (relative to the specified display)
   * @param targetDisplay - The display to capture from
   * @returns PNG image buffer of the captured area
   * @throws If permissions are not granted or capture fails
   */
  async captureArea(bounds: CaptureArea, targetDisplay: Electron.Display): Promise<Buffer> {
    try {
      console.log('Starting screen capture for bounds:', bounds)
      
      // Check permissions first - required on macOS
      const hasPermission = this.checkPermissions()
      if (!hasPermission) {
        throw new Error('Screen recording permission not granted.\n\nTo enable:\n1. Open System Preferences (or System Settings on macOS 13+)\n2. Go to Privacy & Security > Screen Recording\n3. Add this application and enable it\n4. Restart the application')
      }

      const scaleFactor = targetDisplay.scaleFactor

      console.log('Target display info:', {
        id: targetDisplay.id,
        bounds: targetDisplay.bounds,
        scaleFactor: scaleFactor
      })

      // Request screen capture sources from Electron
      const sources: DesktopCapturerSource[] = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: targetDisplay.bounds.width * scaleFactor,
          height: targetDisplay.bounds.height * scaleFactor
        }
      })

      console.log('Retrieved sources:', sources.length)

      if (sources.length === 0) {
        throw new Error('No screen sources available. This might be due to permission issues.')
      }

      // Find the correct screen source for the target display
      const allDisplays = screen.getAllDisplays()
      const source = this.findSourceForDisplay(sources, targetDisplay, allDisplays)
      console.log('Using source:', {
        id: source.id,
        name: source.name,
        thumbnailSize: {
          width: source.thumbnail.getSize().width,
          height: source.thumbnail.getSize().height
        }
      })
      
      // Bounds are already relative to the target display (from capture window)
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



  /**
   * Finds the screen source that corresponds to the target display
   * @param sources - Array of available screen sources
   * @param targetDisplay - The display to find source for
   * @param allDisplays - Array of all displays for context
   * @returns The corresponding screen source
   */
  private findSourceForDisplay(sources: DesktopCapturerSource[], targetDisplay: Electron.Display, allDisplays: Electron.Display[]): DesktopCapturerSource {
    // On single display systems, just use the first source
    if (allDisplays.length === 1) {
      return sources[0]
    }
    
    // For multi-display systems, try to match by display properties
    // This is a best-effort approach as Electron doesn't provide a direct mapping
    const primaryDisplay = screen.getPrimaryDisplay()
    
    if (targetDisplay.id === primaryDisplay.id) {
      // Return the first source for primary display
      return sources[0]
    } else {
      // For secondary displays, try to find the matching source
      // If we have multiple sources, assume they correspond to displays in order
      const displayIndex = allDisplays.findIndex(d => d.id === targetDisplay.id)
      if (displayIndex >= 0 && displayIndex < sources.length) {
        return sources[displayIndex]
      }
      
      // Fallback to first source if no specific match
      console.warn('Could not find specific source for display, using first available')
      return sources[0]
    }
  }


}
