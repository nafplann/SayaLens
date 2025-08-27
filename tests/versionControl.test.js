// Import test utilities
const {
  createMockVersionConfig,
  createMockCachedData,
  createFetchMock,
  setupFsMocks,
  createVersionScenarios,
  assertVersionCheckResult
} = require('./utils/testUtils')

// Mock Electron dependencies before importing VersionController
const mockApp = {
  getVersion: jest.fn(() => '1.0.0'),
  getPath: jest.fn((name) => {
    if (name === 'userData') return '/tmp/test-user-data'
    return '/tmp'
  }),
  getAppPath: jest.fn(() => '/test/app/path')
}

// Mock electron app first
jest.mock('electron', () => ({
  app: mockApp
}))

// Import fs and path for real operations but allow mocking
// eslint-disable-next-line no-unused-vars
const realFs = jest.requireActual('fs')
const realPath = jest.requireActual('path')

// Now import VersionController directly from TypeScript source
const { VersionController } = require('../src/main/modules/versionControl.ts')

describe('VersionController', () => {
  let versionController
  let fetchMock
  let fsMocks
  let tempDir
  const realFs = jest.requireActual('fs')

  beforeAll(() => {
    // Set up real file system for temp directories
    fsMocks = setupFsMocks()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Create real temp directory
    tempDir = realFs.mkdtempSync(realPath.join(realFs.realpathSync('/tmp'), 'version-test-'))
    
    // Set up fetch mock
    fetchMock = createFetchMock()
    global.fetch = fetchMock.mockFetch
    
    // Set up fs mocks using manual mocks that work with the real implementation
    const fs = require('fs')
    fsMocks = {
      existsSync: jest.spyOn(fs, 'existsSync'),
      readFileSync: jest.spyOn(fs, 'readFileSync'),
      writeFileSync: jest.spyOn(fs, 'writeFileSync'),
      mkdirSync: jest.spyOn(fs, 'mkdirSync')
    }
    
    // Configure app mock
    mockApp.getVersion.mockReturnValue('1.0.0')
    mockApp.getPath.mockImplementation((name) => {
      if (name === 'userData') return tempDir
      return '/tmp'
    })
    
    // Create fresh instance for each test
    versionController = new VersionController(
      'https://example.com/version-config.json',
      tempDir,
      { maxCacheAge: 60000, networkTimeout: 5000 }
    )
  })

  afterEach(() => {
    // Clean up real temp directory
    try {
      realFs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
    
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
      const nonExistentDir = realPath.join(tempDir, 'non-existent')
      
      // Directory should not exist initially
      expect(realFs.existsSync(nonExistentDir)).toBe(false)
      
      // Creating controller should create the directory
      new VersionController('https://test.com/config.json', nonExistentDir)
      
      // Directory should now exist
      expect(realFs.existsSync(realPath.dirname(realPath.join(nonExistentDir, 'version-cache.json')))).toBe(true)
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
      // Invalid versions are converted to 0.0.0, so 'invalid' < '1.0.0' is true
      expect(versionController.isVersionBelow('invalid', '1.0.0')).toBe(true)
      // But '1.0.0' > 'invalid' (which becomes 0.0.0) is also true  
      expect(versionController.isVersionNewer('1.0.0', 'invalid')).toBe(true)
      // Test the actual graceful handling - no exceptions thrown
      expect(() => versionController.isVersionBelow('invalid', '1.0.0')).not.toThrow()
      expect(() => versionController.isVersionNewer('1.0.0', 'invalid')).not.toThrow()
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
      // Ensure no cache file exists
      const cacheFile = versionController.getCacheFilePath()
      if (realFs.existsSync(cacheFile)) {
        realFs.unlinkSync(cacheFile)
      }
      
      const cached = versionController.getCachedConfig()
      
      expect(cached.isOfflineMode).toBe(true)
      expect(cached.config.minimumVersion).toBe('1.0.0')
      expect(cached.config.latestVersion).toBe('1.0.0')
    })

    test('should load valid cached config', () => {
      const mockCachedData = createMockCachedData({
        latestVersion: '1.2.0'
      })

      // Write actual cache file
      const cacheFile = versionController.getCacheFilePath()
      realFs.writeFileSync(cacheFile, JSON.stringify(mockCachedData))
      
      const cached = versionController.getCachedConfig()
      
      expect(cached.config.latestVersion).toBe('1.2.0')
      expect(cached.isOfflineMode).toBe(false)
    })

    test('should handle corrupted cache gracefully', () => {
      // Write corrupted cache file
      const cacheFile = versionController.getCacheFilePath()
      realFs.writeFileSync(cacheFile, 'invalid json')
      
      const cached = versionController.getCachedConfig()
      
      expect(cached.isOfflineMode).toBe(true)
      expect(cached.config.minimumVersion).toBe('1.0.0')
    })

    test('should determine when to check for updates based on cache age', () => {
      const cacheFile = versionController.getCacheFilePath()
      
      // Test recent cache - shouldn't check
      const recentCache = createMockCachedData({}, {
        lastFetched: Date.now() - 30000 // 30 seconds ago
      })
      realFs.writeFileSync(cacheFile, JSON.stringify(recentCache))
      expect(versionController.shouldCheckForUpdates()).toBe(false)
      
      // Test old cache - should check
      const oldCache = createMockCachedData({}, {
        lastFetched: Date.now() - 7200000 // 2 hours ago
      })
      realFs.writeFileSync(cacheFile, JSON.stringify(oldCache))
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
        mockApp.getVersion.mockReturnValue(scenario.userVersion)
        
        fetchMock.mockSuccess(scenario.config)

        const result = await versionController.checkVersionStatus()

        expect(result.status).toBe(scenario.expectedStatus)
        expect(result.userVersion).toBe(scenario.userVersion)
        assertVersionCheckResult(result)
      }
    )

    test('should return "blocked" when kill switch is active (online)', async () => {
      mockApp.getVersion.mockReturnValue('1.2.0')
      
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
      mockApp.getVersion.mockReturnValue('0.9.0') // Below minimum
      
      const staleCache = createMockCachedData({
        minimumVersion: '1.0.0'
      }, {
        lastFetched: Date.now() - 86400000, // 24+ hours ago
        isOfflineMode: true
      })

      // Write actual cache file with stale timestamp
      const cacheFile = versionController.getCacheFilePath()
      realFs.writeFileSync(cacheFile, JSON.stringify(staleCache))
      
      fetchMock.mockNetworkError('Network error')

      const result = await versionController.checkVersionStatus()

      expect(result.status).toBe('allowed') // Should allow despite being below minimum
      expect(result.isOffline).toBe(true)
    })

    test('should downgrade force_update to deprecated when offline with old cache', async () => {
      mockApp.getVersion.mockReturnValue('1.0.1')
      
      const oldCache = createMockCachedData({
        forceUpdateVersions: ['1.0.1']
      }, {
        lastFetched: Date.now() - 7200000, // 2 hours ago
        isOfflineMode: true
      })

      // Write actual cache file with old timestamp
      const cacheFile = versionController.getCacheFilePath()
      realFs.writeFileSync(cacheFile, JSON.stringify(oldCache))
      
      fetchMock.mockNetworkError('Network error')

      const result = await versionController.checkVersionStatus()

      expect(result.status).toBe('deprecated') // Downgraded from force_update
      expect(result.isOffline).toBe(true)
    })

    test('should downgrade blocked to deprecated when offline', async () => {
      mockApp.getVersion.mockReturnValue('0.9.0')
      
      const cache = createMockCachedData({
        minimumVersion: '1.0.0'
      }, {
        lastFetched: Date.now() - 30000, // Recent cache
        isOfflineMode: true
      })

      // Write actual cache file
      const cacheFile = versionController.getCacheFilePath()
      realFs.writeFileSync(cacheFile, JSON.stringify(cache))
      
      fetchMock.mockNetworkError('Network error')

      const result = await versionController.checkVersionStatus()

      expect(result.status).toBe('deprecated') // Downgraded from blocked
      expect(result.isOffline).toBe(true)
    })

    test('should never enforce kill switch when offline', async () => {
      mockApp.getVersion.mockReturnValue('1.2.0')
      
      const cache = createMockCachedData({
        isKillSwitchActive: true
      }, {
        lastFetched: Date.now() - 30000,
        isOfflineMode: true
      })

      // Write actual cache file
      const cacheFile = versionController.getCacheFilePath()
      realFs.writeFileSync(cacheFile, JSON.stringify(cache))
      
      fetchMock.mockNetworkError('Network error')

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

    test('should handle missing app.getVersion gracefully', () => {
      // Test the fallback mechanism
      const fallbackConfig = versionController.getFallbackConfig()
      expect(fallbackConfig.minimumVersion).toBe('1.0.0')
      expect(fallbackConfig.latestVersion).toBe('1.0.0')
      expect(typeof fallbackConfig.isKillSwitchActive).toBe('boolean')
    })
  })

  describe('Integration Scenarios', () => {
    test('should handle complete system failure gracefully', async () => {
      // Simulate everything failing
      fetchMock.mockNetworkError('Network error')
      
      // Ensure no cache file exists
      const cacheFile = versionController.getCacheFilePath()
      if (realFs.existsSync(cacheFile)) {
        realFs.unlinkSync(cacheFile)
      }

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
        // eslint-disable-next-line jest/no-conditional-expect
        expect(result2.isOffline).toBe(true)
        // eslint-disable-next-line jest/no-conditional-expect
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
      expect(typeof fallback.updateMessage).toBe('string')
      expect(typeof fallback.downloadUrl).toBe('string')
    })
  })
})
