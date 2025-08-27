import ReactGA from 'react-ga4'

// Configuration
export const GA_MEASUREMENT_ID = 'G-XTXTKFDDVM' // Your Google Analytics Measurement ID

// Store app version for analytics
let appVersion: string = '1.0.0'

// Initialize Google Analytics with app version tracking
export const initializeAnalytics = async () => {
  // Get app version from main process
  try {
    if (window.api?.getAppVersion) {
      const versionResult = await window.api.getAppVersion()
      if (versionResult.success) {
        appVersion = versionResult.version
        console.log('App version retrieved for analytics:', appVersion)
      }
    }
  } catch (error) {
    console.warn('Failed to get app version for analytics:', error)
  }

  // Only initialize if we have a measurement ID
  if (GA_MEASUREMENT_ID) {
    ReactGA.initialize(GA_MEASUREMENT_ID, {
      testMode: process.env.NODE_ENV === 'development', // Set to true for development
      gtagOptions: {
        debug_mode: process.env.NODE_ENV === 'development',
        // Set app version as a custom parameter
        custom_map: {
          app_version: appVersion
        }
      }
    })
    
    // Set app version as a custom dimension
    ReactGA.gtag('config', GA_MEASUREMENT_ID, {
      custom_map: {
        app_version: appVersion
      }
    })
    
    console.log('Google Analytics initialized with ID:', GA_MEASUREMENT_ID, 'Version:', appVersion)
    
    // Set up listener for analytics events from main process
    if (window.api?.onTrackAnalytics) {
      window.api.onTrackAnalytics((_event: any, data: { action: string; category: string; label?: string; value?: number }) => {
        console.log('Received analytics event from main process:', data)
        trackEvent(data.action, data.category, data.label, data.value)
      })
    }
  } else {
    console.warn('Google Analytics not initialized: Missing measurement ID')
  }
}

// Get current app version
export const getAppVersion = () => appVersion

// Track page views
export const trackPageView = (page: string, title?: string) => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.send({
      hitType: 'pageview',
      page,
      title
    })
    console.log('Page view tracked:', page)
  }
}

// Track custom events with app version
export const trackEvent = (action: string, category: string, label?: string, value?: number) => {
  if (GA_MEASUREMENT_ID) {
    // Use gtag directly for custom parameters
    ReactGA.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
      app_version: appVersion
    })
    console.log('Event tracked:', { action, category, label, value, app_version: appVersion })
  }
}

// Common events for SayaLens
export const Analytics = {
  // App lifecycle events
  appStarted: () => trackEvent('app_started', 'app_lifecycle'),
  appClosed: () => trackEvent('app_closed', 'app_lifecycle'),
  appVersionInfo: () => trackEvent('app_version_tracked', 'app_lifecycle', appVersion),
  
  // Capture events
  ocrCaptureStarted: () => trackEvent('ocr_capture_started', 'capture'),
  ocrCaptureCompleted: (success: boolean) => trackEvent(
    success ? 'ocr_capture_success' : 'ocr_capture_failed', 
    'capture'
  ),
  qrCaptureStarted: () => trackEvent('qr_capture_started', 'capture'),
  qrCaptureCompleted: (success: boolean) => trackEvent(
    success ? 'qr_capture_success' : 'qr_capture_failed', 
    'capture'
  ),
  
  // User interactions
  textCopied: () => trackEvent('text_copied', 'user_interaction'),
  languageChanged: (language: string) => trackEvent('language_changed', 'settings', language),
  urlOpened: () => trackEvent('url_opened', 'user_interaction'),
  
  // Navigation events
  pageVisited: (page: string) => trackPageView(page, `SayaLens - ${page}`),
  
  // Global shortcuts
  globalShortcutUsed: (shortcut: string) => trackEvent('global_shortcut_used', 'shortcuts', shortcut),
  
  // Tray interactions
  trayMenuOpened: () => trackEvent('tray_menu_opened', 'tray'),
  trayActionUsed: (action: string) => trackEvent('tray_action_used', 'tray', action)
}
