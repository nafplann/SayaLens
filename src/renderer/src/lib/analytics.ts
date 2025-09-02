// Analytics module for renderer - uses IPC to communicate with main process

// Track page views - sends to main process via IPC
export const trackPageView = async (page: string) => {
  try {
    await window.api?.trackPageView({
      page,
    })
    console.log('Page view tracked via IPC:', page)
  } catch (error) {
    console.warn('Failed to track page view:', error)
  }
}

// Track custom events - sends to main process via IPC
export const trackEvent = async (action: string, category: string, label?: string, value?: number) => {
  try {
    await window.api?.trackAnalyticsEvent({
      action,
      category,
      label,
      value
    })
    console.log('Event tracked via IPC:', { action, category, label, value })
  } catch (error) {
    console.warn('Failed to track event:', error)
  }
}

// Analytics methods actually used by renderer components
export const Analytics = {
  // App lifecycle events (used in main.tsx)
  appClosed: () => trackEvent('app_closed', 'app_lifecycle'),
  pageVisited: (page: string) => trackPageView(page),
  
  // Capture events (used in Capture.tsx)
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
  
  // User interactions (used in Result.tsx and About.tsx)
  textCopied: () => trackEvent('text_copied', 'user_interaction'),
  languageChanged: (language: string) => trackEvent('language_changed', 'settings', language),
  urlOpened: () => trackEvent('url_opened', 'user_interaction')
}