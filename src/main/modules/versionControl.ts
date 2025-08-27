import { app } from 'electron'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

export interface VersionConfig {
  minimumVersion: string
  latestVersion: string
  isKillSwitchActive: boolean
  deprecatedVersions: string[]
  forceUpdateVersions: string[]
  updateMessage: string
  downloadUrl: string
  killSwitchMessage?: string
  lastUpdated: number
}

export interface CachedVersionData {
  config: VersionConfig
  lastFetched: number
  isOfflineMode: boolean
}

export interface VersionCheckResult {
  status: 'allowed' | 'deprecated' | 'force_update' | 'blocked'
  config: VersionConfig
  userVersion: string
  isOffline: boolean
  cacheAge: number
}

export class VersionController {
  private readonly configUrl: string
  private readonly cacheFilePath: string
  private readonly maxCacheAge: number
  private readonly networkTimeout: number
  
  private readonly fallbackConfig: VersionConfig = {
    minimumVersion: '1.0.0',
    latestVersion: '1.0.0',
    isKillSwitchActive: false,
    deprecatedVersions: [],
    forceUpdateVersions: [],
    updateMessage: 'Please update to the latest version',
    downloadUrl: 'https://github.com/nafplann/sayalens/releases/latest',
    lastUpdated: Date.now()
  }

  constructor(
    configUrl?: string,
    cacheDir?: string,
    options: {
      maxCacheAge?: number
      networkTimeout?: number
    } = {}
  ) {
    this.configUrl = configUrl || 'https://raw.githubusercontent.com/nafplann/sayalens/main/version-config.json'
    this.maxCacheAge = options.maxCacheAge || (24 * 60 * 60 * 1000) // 24 hours
    this.networkTimeout = options.networkTimeout || 10000 // 10 seconds
    
    // Use provided cache directory or app's userData
    const userDataPath = cacheDir || (app ? app.getPath('userData') : '/tmp')
    this.cacheFilePath = join(userDataPath, 'version-cache.json')
    
    // Ensure cache directory exists
    try {
      const dir = dirname(this.cacheFilePath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    } catch (error) {
      console.warn('Failed to create cache directory:', error)
    }
  }

  async checkVersionStatus(): Promise<VersionCheckResult> {
    const currentVersion = this.getCurrentVersion()
    let config: VersionConfig
    let isOffline = false
    let cacheAge = 0

    try {
      // Try to fetch fresh config with timeout
      const freshConfig = await this.fetchConfigWithTimeout()
      config = freshConfig
      
      // Cache the fresh config
      this.cacheConfig(config)
      console.log('✅ Version config fetched successfully (online)')
      
    } catch (error) {
      console.warn('🌐 Network fetch failed, using cached config:', error)
      
      // Use cached config
      const cachedData = this.getCachedConfig()
      config = cachedData.config
      isOffline = true
      cacheAge = Date.now() - cachedData.lastFetched
      
      console.log(`📦 Using cached config (age: ${Math.round(cacheAge / (60 * 1000))} minutes)`)
    }

    // Determine version status
    const status = this.determineVersionStatus(currentVersion, config, isOffline, cacheAge)
    
    return {
      status,
      config,
      userVersion: currentVersion,
      isOffline,
      cacheAge
    }
  }

  private async fetchConfigWithTimeout(): Promise<VersionConfig> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.networkTimeout)

    try {
      const response = await fetch(this.configUrl, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'User-Agent': 'SayaLens-VersionChecker'
        }
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const config = await response.json()
      config.lastUpdated = Date.now()
      
      // Validate config structure
      this.validateConfig(config)
      
      return config
      
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  private validateConfig(config: any): void {
    const required = ['minimumVersion', 'latestVersion', 'isKillSwitchActive', 'updateMessage', 'downloadUrl']
    const missing = required.filter(field => config[field] === undefined)
    
    if (missing.length > 0) {
      throw new Error(`Invalid config: missing fields ${missing.join(', ')}`)
    }
    
    // Validate version format
    if (!this.isValidVersionFormat(config.minimumVersion) || !this.isValidVersionFormat(config.latestVersion)) {
      throw new Error('Invalid version format in config')
    }
  }

  private isValidVersionFormat(version: string): boolean {
    return /^\d+\.\d+\.\d+$/.test(version)
  }

  public getCachedConfig(): CachedVersionData {
    try {
      if (existsSync(this.cacheFilePath)) {
        const cached = JSON.parse(readFileSync(this.cacheFilePath, 'utf8'))
        console.log('📄 Loaded cached version config')
        
        // Validate cached config
        if (cached.config && cached.lastFetched) {
          return cached
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to load cached config:', error)
    }

    // Return fallback if no cache exists or cache is invalid
    console.log('🔄 No valid cache found, using fallback config')
    return {
      config: this.fallbackConfig,
      lastFetched: Date.now(),
      isOfflineMode: true
    }
  }

  private cacheConfig(config: VersionConfig): void {
    try {
      const cacheData: CachedVersionData = {
        config,
        lastFetched: Date.now(),
        isOfflineMode: false
      }
      
      writeFileSync(this.cacheFilePath, JSON.stringify(cacheData, null, 2))
      console.log('💾 Version config cached successfully')
      
    } catch (error) {
      console.warn('⚠️ Failed to cache version config:', error)
    }
  }

  private determineVersionStatus(
    currentVersion: string, 
    config: VersionConfig, 
    isOffline: boolean, 
    cacheAge: number
  ): 'allowed' | 'deprecated' | 'force_update' | 'blocked' {
    
    // OFFLINE SAFETY: If cache is extremely stale (>6 hours), allow app to run completely
    if (isOffline && cacheAge > 6 * 60 * 60 * 1000) { // 6 hours
      console.log('🔒 Offline with very stale cache - allowing app to run')
      return 'allowed'
    }

    // OFFLINE SAFETY: Never enforce kill switch when offline
    if (config.isKillSwitchActive && !isOffline) {
      return 'blocked'
    }

    // Force update check (handle offline grace period)
    if (config.forceUpdateVersions.includes(currentVersion)) {
      if (isOffline && cacheAge > 60 * 60 * 1000) { // 1 hour grace period
        console.log('🌐 Offline mode - downgrading force update to deprecated')
        return 'deprecated'
      }
      return 'force_update'
    }

    // OFFLINE SAFETY: Be lenient with minimum version when offline
    if (this.isVersionBelow(currentVersion, config.minimumVersion)) {
      if (isOffline) {
        console.log('🌐 Offline mode - downgrading blocked to deprecated')
        return 'deprecated' // Downgrade from blocked to deprecated when offline
      }
      return 'blocked'
    }

    // Deprecation check
    if (config.deprecatedVersions.includes(currentVersion)) {
      return 'deprecated'
    }

    return 'allowed'
  }

  public isVersionBelow(current: string, minimum: string): boolean {
    try {
      const currentParts = current.split('.').map(Number)
      const minimumParts = minimum.split('.').map(Number)
      
      for (let i = 0; i < 3; i++) {
        const currentPart = currentParts[i] || 0
        const minimumPart = minimumParts[i] || 0
        
        if (currentPart < minimumPart) return true
        if (currentPart > minimumPart) return false
      }
      return false
    } catch (error) {
      console.warn('Version comparison failed:', error)
      return false // Safe default
    }
  }

  public isVersionNewer(remote: string, local: string): boolean {
    try {
      const remoteParts = remote.split('.').map(Number)
      const localParts = local.split('.').map(Number)
      
      for (let i = 0; i < 3; i++) {
        const remotePart = remoteParts[i] || 0
        const localPart = localParts[i] || 0
        
        if (remotePart > localPart) return true
        if (remotePart < localPart) return false
      }
      return false
    } catch (error) {
      console.warn('Version comparison failed:', error)
      return false // Safe default
    }
  }

  public shouldCheckForUpdates(): boolean {
    const cached = this.getCachedConfig()
    const cacheAge = Date.now() - cached.lastFetched
    
    // Check for updates if cache is older than 1 hour (for periodic checks)
    return cacheAge > (60 * 60 * 1000)
  }

  private getCurrentVersion(): string {
    try {
      return app ? app.getVersion() : '1.0.0'
    } catch (error) {
      console.warn('Failed to get app version:', error)
      return '1.0.0'
    }
  }

  // Test utilities (exposed for testing)
  public getConfigUrl(): string {
    return this.configUrl
  }

  public getCacheFilePath(): string {
    return this.cacheFilePath
  }

  public getFallbackConfig(): VersionConfig {
    return { ...this.fallbackConfig }
  }
}
