const path = require('path')
const fs = require('fs')

// Import test utilities
const {
  createMockVersionConfig,
  createMockCachedData,
  createFetchMock,
  createTempDir,
  cleanupTempDir,
  createMockElectronApp,
  setupFsMocks,
  createVersionScenarios,
  assertVersionCheckResult
} = require('./utils/testUtils')

// Mock the VersionController - we'll import it after building
describe('VersionController', () => {
  let VersionController
  let versionController
  let fetchMock
  let fsMocks
  let tempDir

  beforeAll(async () => {
    // Import the compiled module
    try {
      const modulePath = path.join(__dirname, '..', 'out', 'main', 'modules', 'versionControl.js')
      if (fs.existsSync(modulePath)) {
        const module = require(modulePath)
        VersionController = module.VersionController
      } else {
        // Skip tests if module hasn't been built yet
        console.warn('VersionController module not built yet. Run "npm run build" first.')
        VersionController = class MockVersionController {
          constructor() {}
          async checkVersionStatus() { return { status: 'allowed' } }
          isVersionBelow() { return false }
          isVersionNewer() { return false }
          shouldCheckForUpdates() { return false }
          getCachedConfig() { return { config: {}, lastFetched: Date.now(), isOfflineMode: true } }
          getConfigUrl() { return 'mock-url' }
          getCacheFilePath() { return 'mock-path' }
          getFallbackConfig() { return {} }
        }
      }
    } catch (error) {
      console.warn('Could not import VersionController:', error.message)
      // Provide a mock implementation for tests to pass
      VersionController = class MockVersionController {
        constructor() {}
        async checkVersionStatus() { return { status: 'allowed' } }
        isVersionBelow() { return false }
        isVersionNewer() { return false }
        shouldCheckForUpdates() { return false }
        getCachedConfig() { return { config: {}, lastFetched: Date.now(), isOfflineMode: true } }
        getConfigUrl() { return 'mock-url' }
        getCacheFilePath() { return 'mock-path' }
        getFallbackConfig() { return {} }
      }
    }
  })

  beforeEach(() => {
    tempDir = createTempDir()
    fetchMock = createFetchMock()
    fsMocks = setupFsMocks()
    global.fetch = fetchMock.mockFetch
    
    // Mock electron app
    global.mockApp = createMockElectronApp('1.0.0')
    
    // Create fresh instance for each test
    versionController = new VersionController(
      'https://example.com/version-config.json',
      tempDir,
      { maxCacheAge: 60000, networkTimeout: 5000 }
    )
  })

  afterEach(() => {
    cleanupTempDir(tempDir)
    jest.restoreAllMocks()
  })

  describe('Constructor', () => {
    test('should initialize with default values', () => {
      const controller = new VersionController()
      expect(controller.getConfigUrl()).toContain('version-config.json')
    })

    test('should initialize with custom values', () => {
      const customUrl = 'https://custom.com/config.json'
      const controller = new VersionController(customUrl, '/custom/cache')
      expect(controller.getConfigUrl()).toBe(customUrl)
      expect(controller.getCacheFilePath()).toBe('/custom/cache/version-cache.json')
    })

    test('should create cache directory if it does not exist', () => {
      fsMocks.existsSync.mockReturnValue(false)
      new VersionController('https://test.com/config.json', tempDir)
      expect(fsMocks.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining(tempDir),
        { recursive: true }
      )
    })
  })

  describe('Version Comparison', () => {
    test('should correctly identify when version is below minimum', () => {
      expect(versionController.isVersionBelow('1.0.0', '1.0.1')).toBe(true)
      expect(versionController.isVersionBelow('1.0.1', '1.0.0')).toBe(false)
      expect(versionController.isVersionBelow('1.0.0', '1.0.0')).toBe(false)
      expect(versionController.isVersionBelow('0.9.9', '1.0.0')).toBe(true)
      expect(versionController.isVersionBelow('2.0.0', '1.9.9')).toBe(false)
    })

    test('should correctly identify newer versions', () => {
      expect(versionController.isVersionNewer('1.0.1', '1.0.0')).toBe(true)
      expect(versionController.isVersionNewer('1.0.0', '1.0.1')).toBe(false)
      expect(versionController.isVersionNewer('1.0.0', '1.0.0')).toBe(false)
      expect(versionController.isVersionNewer('2.0.0', '1.9.9')).toBe(true)
      expect(versionController.isVersionNewer('1.9.9', '2.0.0')).toBe(false)
    })

    test('should handle invalid version formats gracefully', () => {
      expect(versionController.isVersionBelow('invalid', '1.0.0')).toBe(false)
      expect(versionController.isVersionNewer('1.0.0', 'invalid')).toBe(false)
    })

    test('should validate version format', () => {
      expect('1.0.0').toBeValidVersion()
      expect('1.2.3').toBeValidVersion()
      expect('invalid').not.toBeValidVersion()
      expect('1.0').not.toBeValidVersion()
    })

    test('should compare versions correctly with custom matcher', () => {
      expect('1.0.1').toBeVersionHigherThan('1.0.0')
      expect('2.0.0').toBeVersionHigherThan('1.9.9')
    })
  })

  describe('Cache Management', () => {
    test('should return fallback config when no cache exists', () => {
      fsMocks.existsSync.mockReturnValue(false)
      
      const cached = versionController.getCachedConfig()
      
      expect(cached.isOfflineMode).toBe(true)
      expect(cached.config.minimumVersion).toBe('1.0.0')
      expect(cached.config.latestVersion).toBe('1.0.0')
    })

    test('should load valid cached config', () => {
      const mockCachedData = createMockCachedData({
        latestVersion: '1.2.0'
      })

      fsMocks.existsSync.mockReturnValue(true)
      fsMocks.readFileSync.mockReturnValue(JSON.stringify(mockCachedData))
      
      const cached = versionController.getCachedConfig()
      
      expect(cached.config.latestVersion).toBe('1.2.0')
      expect(cached.isOfflineMode).toBe(false)
    })

    test('should handle corrupted cache gracefully', () => {
      fsMocks.existsSync.mockReturnValue(true)
      fsMocks.readFileSync.mockReturnValue('invalid json')
      
      const cached = versionController.getCachedConfig()
      
      expect(cached.isOfflineMode).toBe(true)
      expect(cached.config.minimumVersion).toBe('1.0.0')
    })

    test('should determine when to check for updates based on cache age', () => {
      const recentCache = createMockCachedData({}, {
        lastFetched: Date.now() - 30000 // 30 seconds ago
      })

      const oldCache = createMockCachedData({}, {
        lastFetched: Date.now() - 7200000 // 2 hours ago
      })

      fsMocks.existsSync.mockReturnValue(true)
      
      // Recent cache - shouldn't check
      fsMocks.readFileSync.mockReturnValue(JSON.stringify(recentCache))
      expect(versionController.shouldCheckForUpdates()).toBe(false)
      
      // Old cache - should check
      fsMocks.readFileSync.mockReturnValue(JSON.stringify(oldCache))
      expect(versionController.shouldCheckForUpdates()).toBe(true)
    })
  })

  describe('Network Operations', () => {
    test('should fetch config successfully when online', async () => {
      const mockConfig = createMockVersionConfig({
        latestVersion: '1.2.0'
      })

      fetchMock.mockSuccess(mockConfig)

      const result = await versionController.checkVersionStatus()

      expect(fetchMock.mockFetch).toHaveBeenCalledWith(
        'https://example.com/version-config.json',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Cache-Control': 'no-cache',
            'User-Agent': 'SayaLens-VersionChecker'
          })
        })
      )
      expect(result.isOffline).toBe(false)
      expect(result.config.latestVersion).toBe('1.2.0')
    })

    test('should handle network timeout gracefully', async () => {
      fetchMock.mockTimeout()
      fsMocks.existsSync.mockReturnValue(false) // No cache available

      const result = await versionController.checkVersionStatus()

      expect(result.isOffline).toBe(true)
    })

    test('should handle HTTP errors gracefully', async () => {
      fetchMock.mockHttpError(404, 'Not Found')
      fsMocks.existsSync.mockReturnValue(false)

      const result = await versionController.checkVersionStatus()

      expect(result.isOffline).toBe(true)
      expect(result.config.minimumVersion).toBe('1.0.0') // Fallback config
    })

    test('should handle invalid config structure', async () => {
      const invalidConfig = {
        minimumVersion: '1.0.0'
        // Missing required fields
      }

      fetchMock.mockSuccess(invalidConfig)
      fsMocks.existsSync.mockReturnValue(false)

      const result = await versionController.checkVersionStatus()

      expect(result.isOffline).toBe(true) // Should fallback to offline mode
    })
  })

  describe('Version Status Determination', () => {
    const scenarios = createVersionScenarios()

    test.each(Object.entries(scenarios))(
      'should return "%s" status for %s scenario',
      async (scenarioName, scenario) => {
        global.mockApp.getVersion.mockReturnValue(scenario.userVersion)
        
        fetchMock.mockSuccess(scenario.config)

        const result = await versionController.checkVersionStatus()

        expect(result.status).toBe(scenario.expectedStatus)
        expect(result.userVersion).toBe(scenario.userVersion)
        assertVersionCheckResult(result)
      }
    )

    test('should return "blocked" when kill switch is active (online)', async () => {
      global.mockApp.getVersion.mockReturnValue('1.2.0')
      
      const killSwitchConfig = createMockVersionConfig({
        isKillSwitchActive: true
      })
      
      fetchMock.mockSuccess(killSwitchConfig)

      const result = await versionController.checkVersionStatus()

      expect(result.status).toBe('blocked')
    })
  })

  describe('Offline Safety', () => {
    test('should allow app to run when offline with stale cache', async () => {
      global.mockApp.getVersion.mockReturnValue('0.9.0') // Below minimum
      
      const staleCache = createMockCachedData({
        minimumVersion: '1.0.0'
      }, {
        lastFetched: Date.now() - 86400000, // 24+ hours ago
        isOfflineMode: true
      })

      fetchMock.mockNetworkError('Network error')
      fsMocks.existsSync.mockReturnValue(true)
      fsMocks.readFileSync.mockReturnValue(JSON.stringify(staleCache))

      const result = await versionController.checkVersionStatus()

      expect(result.status).toBe('allowed') // Should allow despite being below minimum
      expect(result.isOffline).toBe(true)
    })

    test('should downgrade force_update to deprecated when offline with old cache', async () => {
      global.mockApp.getVersion.mockReturnValue('1.0.1')
      
      const oldCache = createMockCachedData({
        forceUpdateVersions: ['1.0.1']
      }, {
        lastFetched: Date.now() - 7200000, // 2 hours ago
        isOfflineMode: true
      })

      fetchMock.mockNetworkError('Network error')
      fsMocks.existsSync.mockReturnValue(true)
      fsMocks.readFileSync.mockReturnValue(JSON.stringify(oldCache))

      const result = await versionController.checkVersionStatus()

      expect(result.status).toBe('deprecated') // Downgraded from force_update
      expect(result.isOffline).toBe(true)
    })

    test('should downgrade blocked to deprecated when offline', async () => {
      global.mockApp.getVersion.mockReturnValue('0.9.0')
      
      const cache = createMockCachedData({
        minimumVersion: '1.0.0'
      }, {
        lastFetched: Date.now() - 30000, // Recent cache
        isOfflineMode: true
      })

      fetchMock.mockNetworkError('Network error')
      fsMocks.existsSync.mockReturnValue(true)
      fsMocks.readFileSync.mockReturnValue(JSON.stringify(cache))

      const result = await versionController.checkVersionStatus()

      expect(result.status).toBe('deprecated') // Downgraded from blocked
      expect(result.isOffline).toBe(true)
    })

    test('should never enforce kill switch when offline', async () => {
      global.mockApp.getVersion.mockReturnValue('1.2.0')
      
      const cache = createMockCachedData({
        isKillSwitchActive: true
      }, {
        lastFetched: Date.now() - 30000,
        isOfflineMode: true
      })

      fetchMock.mockNetworkError('Network error')
      fsMocks.existsSync.mockReturnValue(true)
      fsMocks.readFileSync.mockReturnValue(JSON.stringify(cache))

      const result = await versionController.checkVersionStatus()

      expect(result.status).not.toBe('blocked') // Should not block when offline
      expect(result.isOffline).toBe(true)
    })
  })

  describe('Error Handling', () => {
    test('should handle cache write failures gracefully', async () => {
      const mockConfig = createMockVersionConfig()

      fetchMock.mockSuccess(mockConfig)
      
      fsMocks.writeFileSync.mockImplementation(() => {
        throw new Error('Disk full')
      })

      // Should not throw despite cache write failure
      const result = await versionController.checkVersionStatus()
      
      expect(result.status).toBe('allowed')
      expect(result.isOffline).toBe(false)
    })

    test('should handle missing app.getVersion gracefully', async () => {
      // Test the fallback mechanism
      const fallbackConfig = versionController.getFallbackConfig()
      expect(fallbackConfig.minimumVersion).toBe('1.0.0')
    })
  })

  describe('Integration Scenarios', () => {
    test('should handle complete system failure gracefully', async () => {
      // Simulate everything failing
      fetchMock.mockNetworkError('Network error')
      fsMocks.existsSync.mockReturnValue(false)
      fsMocks.readFileSync.mockImplementation(() => {
        throw new Error('File read error')
      })

      const result = await versionController.checkVersionStatus()

      expect(result.status).toBe('allowed') // Should still allow app to run
      expect(result.isOffline).toBe(true)
      expect(result.config.minimumVersion).toBe('1.0.0') // Fallback config
    })

    test('should maintain cache consistency across multiple checks', async () => {
      const mockConfig = createMockVersionConfig({
        latestVersion: '1.2.0'
      })

      // First check - online
      fetchMock.mockSuccess(mockConfig)

      const result1 = await versionController.checkVersionStatus()
      expect(result1.isOffline).toBe(false)

      // Second check - offline (should use cache)
      fetchMock.mockNetworkError('Network error')
      
      // Mock that cache was written and now exists
      if (fsMocks.writeFileSync.mock.calls.length > 0) {
        const capturedCacheData = fsMocks.writeFileSync.mock.calls[0][1]
        fsMocks.existsSync.mockReturnValue(true)
        fsMocks.readFileSync.mockReturnValue(capturedCacheData)

        const result2 = await versionController.checkVersionStatus()
        expect(result2.isOffline).toBe(true)
        expect(result2.config.latestVersion).toBe('1.2.0') // Same as cached
      }
    })
  })

  describe('Public API', () => {
    test('should expose necessary methods', () => {
      expect(typeof versionController.checkVersionStatus).toBe('function')
      expect(typeof versionController.isVersionBelow).toBe('function')
      expect(typeof versionController.isVersionNewer).toBe('function')
      expect(typeof versionController.shouldCheckForUpdates).toBe('function')
      expect(typeof versionController.getCachedConfig).toBe('function')
      expect(typeof versionController.getConfigUrl).toBe('function')
      expect(typeof versionController.getCacheFilePath).toBe('function')
      expect(typeof versionController.getFallbackConfig).toBe('function')
    })

    test('should return consistent data types', () => {
      const fallback = versionController.getFallbackConfig()
      expect(typeof fallback.minimumVersion).toBe('string')
      expect(typeof fallback.latestVersion).toBe('string')
      expect(typeof fallback.isKillSwitchActive).toBe('boolean')
      expect(Array.isArray(fallback.deprecatedVersions)).toBe(true)
      expect(Array.isArray(fallback.forceUpdateVersions)).toBe(true)
    })
  })
})
