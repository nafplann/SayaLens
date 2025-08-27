import ReactGA from 'react-ga4'

// Configuration
export const GA_MEASUREMENT_ID = 'G-XTXTKFDDVM' // Your Google Analytics Measurement ID

// Initialize Google Analytics
export const initializeAnalytics = () => {
  // Only initialize if we have a measurement ID
  if (GA_MEASUREMENT_ID) {
    ReactGA.initialize(GA_MEASUREMENT_ID, {
      testMode: process.env.NODE_ENV === 'development', // Set to true for development
      gtagOptions: {
        debug_mode: process.env.NODE_ENV === 'development'
      }
    })
    console.log('Google Analytics initialized with ID:', GA_MEASUREMENT_ID)
    
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

// Track custom events
export const trackEvent = (action: string, category: string, label?: string, value?: number) => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.event({
      action,
      category,
      label,
      value
    })
    console.log('Event tracked:', { action, category, label, value })
  }
}

// Common events for SayaLens
export const Analytics = {
  // App lifecycle events
  appStarted: () => trackEvent('app_started', 'app_lifecycle'),
  appClosed: () => trackEvent('app_closed', 'app_lifecycle'),
  
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
