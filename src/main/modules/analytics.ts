import { app } from 'electron'
const ElectronGA = require('electron-google-analytics4').default
import {machineId} from 'node-machine-id';

// Configuration
export const GA_MEASUREMENT_ID = 'XXX' // Your Google Analytics Measurement ID
export const GA_SECRET_KEY = 'XXX' // Your Google Analytics Measurement ID

export class Analytics {
  private appVersion: string = '1.0.0'
  private initialized: boolean = false
  private app: any | undefined
  
  constructor() {
    this.appVersion = app.getVersion()
  }

  /**
   * Initialize Analytics
   */
  async initialize(): Promise<void> {
    try {
      // Initialize GA with proper configuration
      const clientID = await machineId(true);
      this.app = new ElectronGA(GA_MEASUREMENT_ID, GA_SECRET_KEY, clientID);
      this.app.set('engagement_time_msec', 1000);
      this.initialized = true

      console.log('GA initialized in main process with ID:', GA_MEASUREMENT_ID, 'Version:', this.appVersion)
      
      // Track app started and version info immediately
      await this.trackEvent('app_started', 'app_lifecycle')
      await this.trackEvent('app_version_tracked', 'app_lifecycle', this.appVersion)
    } catch (error) {
      console.warn('Failed to initialize analytics:', error)
    }
  }


  /**
   * Track custom events
   */
  async trackEvent(action: string, category: string, label?: string, value?: number): Promise<void> {
    if (!this.initialized) {
      console.warn('Analytics not initialized')
      return
    }

    try {
      await this.app?.setParams({
          event_category: category,
          event_label: label,
          value: value,
          app_version: this.appVersion
      }).event(action);


      console.log('Analytics event tracked:', {
        action,
        category,
        label,
        value,
        app_version: this.appVersion
      })


    } catch (error) {
      console.warn('Failed to track event:', error)
    }
  }

  /**
   * Track page views
   */
  async trackPageView(page: string, title?: string): Promise<void> {
    if (!this.initialized) {
      console.warn('Analytics not initialized')
      return
    }

    try {
      // Send pageview with a custom path
      await this.app?.setParams({
        page_path: page,
        page_title: title || page,
        app_version: this.appVersion
      }).event('page_view');

      console.log('Page view tracked:', page, title)
    } catch (error) {
      console.warn('Failed to track page view:', error)
    }
  }

  // Pre-defined analytics events for SayaLens
  async appClosed(): Promise<void> {
    await this.trackEvent('app_closed', 'app_lifecycle')
  }

  // Global shortcuts
  async globalShortcutUsed(shortcut: string): Promise<void> {
    await this.trackEvent('global_shortcut_used', 'shortcuts', shortcut)
  }

  async trayActionUsed(action: string): Promise<void> {
    await this.trackEvent('tray_action_used', 'tray', action)
  }

  // Version control events
  async versionCheckPerformed(status: string): Promise<void> {
    await this.trackEvent('version_check_performed', 'app_lifecycle', status)
  }

  async versionBlocked(version: string): Promise<void> {
    await this.trackEvent('version_blocked', 'app_lifecycle', version)
  }

  async forceUpdateRequired(version: string): Promise<void> {
    await this.trackEvent('force_update_required', 'app_lifecycle', version)
  }

  async forceUpdateContinuedOffline(version: string): Promise<void> {
    await this.trackEvent('force_update_continued_offline', 'app_lifecycle', version)
  }

  async versionDeprecatedWarning(version: string): Promise<void> {
    await this.trackEvent('version_deprecated_warning', 'app_lifecycle', version)
  }

  async manualUpdateCheck(): Promise<void> {
    await this.trackEvent('manual_update_check', 'user_actions', 'tray_menu')
  }

  async updateCheckFailed(error: string): Promise<void> {
    await this.trackEvent('update_check_failed', 'app_lifecycle', error)
  }

  async updateNotificationShown(version: string): Promise<void> {
    await this.trackEvent('update_notification_shown', 'app_updates', version)
  }

  async offlineModeDetected(cacheAge: number): Promise<void> {
    await this.trackEvent('offline_mode_detected', 'app_lifecycle', 'cache_age', cacheAge)
  }

  async networkRestored(): Promise<void> {
    await this.trackEvent('network_restored', 'app_lifecycle')
  }

  async killSwitchActivated(): Promise<void> {
    await this.trackEvent('kill_switch_activated', 'app_lifecycle')
  }

  // Recording lifecycle events
  async recordingStarted(settings: any): Promise<void> {
    await this.trackEvent('recording_started', 'screen_recording', settings.area)
  }

  async recordingCompleted(duration: number, format: string): Promise<void> {
    await this.trackEvent('recording_completed', 'screen_recording', format, Math.floor(duration / 1000))
  }

  async recordingFailed(error: string, stage: string): Promise<void> {
    await this.trackEvent('recording_failed', 'screen_recording', `${stage}: ${error}`)
  }

  async recordingPaused(duration: number): Promise<void> {
    await this.trackEvent('recording_paused', 'screen_recording', 'duration', Math.floor(duration / 1000))
  }

  async recordingResumed(): Promise<void> {
    await this.trackEvent('recording_resumed', 'screen_recording')
  }

  // Performance and quality metrics
  async recordingPerformance(metrics: any): Promise<void> {
    await this.trackEvent('recording_performance', 'screen_recording', 'memory_usage', metrics.memoryUsage)
  }

  async memoryUsageAlert(usage: number): Promise<void> {
    await this.trackEvent('memory_usage_alert', 'screen_recording', 'usage_mb', usage)
  }

  async fileSize(size: number, _duration: number): Promise<void> {
    const sizeMB = Math.floor(size / 1024 / 1024)
    await this.trackEvent('recording_file_size', 'screen_recording', 'size_mb', sizeMB)
  }

  // Format conversion events
  async formatConverted(fromFormat: string, toFormat: string, duration: number): Promise<void> {
    await this.trackEvent('format_converted', 'video_processing', `${fromFormat}_to_${toFormat}`, Math.floor(duration / 1000))
  }

  async conversionFailed(error: string, format: string): Promise<void> {
    await this.trackEvent('conversion_failed', 'video_processing', `${format}: ${error}`)
  }

  // User interaction events
  async recordingAction(action: string): Promise<void> {
    await this.trackEvent('recording_action', 'screen_recording', action)
  }

  async areaSelectionUsed(area: string): Promise<void> {
    await this.trackEvent('area_selection_used', 'screen_recording', area)
  }

  async settingsChanged(setting: string, value: any): Promise<void> {
    await this.trackEvent('recording_settings_changed', 'screen_recording', setting, value)
  }

  // Error and recovery events
  async permissionDenied(platform: string, permissionType: string): Promise<void> {
    await this.trackEvent('permission_denied', 'screen_recording', `${platform}_${permissionType}`)
  }

  async crashRecovery(tempFilesFound: number): Promise<void> {
    await this.trackEvent('crash_recovery', 'screen_recording', 'temp_files', tempFilesFound)
  }

  async diskSpaceWarning(availableSpace: number): Promise<void> {
    const spaceGB = Math.floor(availableSpace / 1024 / 1024 / 1024)
    await this.trackEvent('disk_space_warning', 'screen_recording', 'available_gb', spaceGB)
  }
}
