const fs = require('fs')
const path = require('path')

const {
  createMockVersionConfig,
  createFetchMock
} = require('../utils/testUtils')

// Mock Electron dependencies before importing VersionController
const mockApp = {
  getVersion: jest.fn(() => '1.0.0'),
  getPath: jest.fn((name) => {
    if (name === 'userData') return '/tmp/test-user-data'
    return '/tmp'
  }),
  getAppPath: jest.fn(() => '/test/app/path')
}

// Mock electron app
jest.mock('electron', () => ({
  app: mockApp
}))

// Import VersionController directly from TypeScript source
const { VersionController } = require('../../src/main/modules/versionControl.ts')

describe('Version Control Integration Tests', () => {
  let tempDir
  let versionController
  let fetchMock

  beforeAll(() => {
    // Create real temp directory
    tempDir = fs.mkdtempSync(path.join(fs.realpathSync('/tmp'), 'integration-test-'))
  })

  afterAll(() => {
    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Create unique temp dir for each test  
    const testTempDir = fs.mkdtempSync(path.join(tempDir, 'test-'))
    
    // Set up fetch mock
    fetchMock = createFetchMock()
    global.fetch = fetchMock.mockFetch
    
    // Configure app mock
    mockApp.getVersion.mockReturnValue('1.0.0')
    mockApp.getPath.mockImplementation((name) => {
      if (name === 'userData') return testTempDir
      return '/tmp'
    })
    
    versionController = new VersionController(
      'https://example.com/version-config.json',
      testTempDir,
      { maxCacheAge: 1000, networkTimeout: 2000 } // Short times for testing
    )
  })

  test('should create cache file and read it back', async () => {
    const mockConfig = createMockVersionConfig({
      latestVersion: '1.2.0',
      updateMessage: 'Test update message'
    })

    fetchMock.mockSuccess(mockConfig)

    // First call should create cache
    const result1 = await versionController.checkVersionStatus()
    expect(result1.isOffline).toBe(false)

    // Verify cache file exists
    const cacheFile = versionController.getCacheFilePath()
    expect(fs.existsSync(cacheFile)).toBe(true)

    // Verify cache content
    const cacheContent = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
    expect(cacheContent.config.latestVersion).toBe('1.2.0')
    expect(cacheContent.config.updateMessage).toBe('Test update message')
    expect(cacheContent.isOfflineMode).toBe(false)
    expect(typeof cacheContent.lastFetched).toBe('number')

    // Second call with network failure should use cache
    fetchMock.mockNetworkError('Network error')
    const result2 = await versionController.checkVersionStatus()
    
    expect(result2.isOffline).toBe(true)
    expect(result2.config.latestVersion).toBe('1.2.0')
    expect(result2.config.updateMessage).toBe('Test update message')
  })

  test('should handle cache expiration correctly', async () => {
    const mockConfig = createMockVersionConfig({
      latestVersion: '1.2.0'
    })

    fetchMock.mockSuccess(mockConfig)

    // Create cache
    await versionController.checkVersionStatus()

    // Manually modify cache to be expired
    const cacheFile = versionController.getCacheFilePath()
    const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
    cacheData.lastFetched = Date.now() - 10000 // 10 seconds ago (older than maxCacheAge of 1000ms)
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData))

    // Should recognize cache as stale when offline
    fetchMock.mockNetworkError('Network error')
    const result = await versionController.checkVersionStatus()
    
    expect(result.cacheAge).toBeGreaterThan(1000) // Should detect stale cache
    expect(result.isOffline).toBe(true)
  })

  test('should handle real file system operations', async () => {
    // Test with actual file operations (no mocks)
    const realConfig = createMockVersionConfig({
      latestVersion: '1.5.0',
      updateMessage: 'Real test message'
    })

    fetchMock.mockSuccess(realConfig)

    const result = await versionController.checkVersionStatus()
    
    // Verify cache file was actually created
    const cacheFile = versionController.getCacheFilePath()
    expect(fs.existsSync(cacheFile)).toBe(true)
    
    // Verify cache content
    const cacheContent = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
    expect(cacheContent.config.latestVersion).toBe('1.5.0')
    expect(cacheContent.config.updateMessage).toBe('Real test message')
    expect(cacheContent.isOfflineMode).toBe(false)
    expect(typeof cacheContent.lastFetched).toBe('number')
    
    // Verify we can read it back
    expect(result.status).toBe('allowed')
    expect(result.config.latestVersion).toBe('1.5.0')
  })

  test('should handle directory creation for cache', () => {
    const deepDir = path.join(tempDir, 'deep', 'nested', 'directory')
    
    // Should not throw even if directory doesn't exist
    expect(() => {
      new VersionController(
        'https://example.com/config.json',
        deepDir
      )
    }).not.toThrow()
    
    // Directory should be created
    expect(fs.existsSync(path.dirname(path.join(deepDir, 'version-cache.json')))).toBe(true)
  })

  test('should persist cache across multiple instances', async () => {
    // Create a shared temp directory for this test
    const sharedTempDir = fs.mkdtempSync(path.join(tempDir, 'shared-'))
    
    const mockConfig = createMockVersionConfig({
      latestVersion: '1.3.0'
    })

    fetchMock.mockSuccess(mockConfig)

    // First instance creates cache
    const controller1 = new VersionController(
      'https://example.com/config.json',
      sharedTempDir
    )
    const result1 = await controller1.checkVersionStatus()
    expect(result1.config.latestVersion).toBe('1.3.0')

    // Second instance should read from cache when offline
    fetchMock.mockNetworkError('Network error')
    const controller2 = new VersionController(
      'https://example.com/config.json',
      sharedTempDir
    )
    const result2 = await controller2.checkVersionStatus()
    
    expect(result2.isOffline).toBe(true)
    expect(result2.config.latestVersion).toBe('1.3.0') // Should read from cache
  })

  test('should handle corrupted cache files gracefully', async () => {
    // Create a corrupted cache file
    const cacheFile = path.join(tempDir, 'version-cache.json')
    fs.writeFileSync(cacheFile, 'invalid json content')

    fetchMock.mockNetworkError('Network error')

    const result = await versionController.checkVersionStatus()
    
    // Should fall back to default config when cache is corrupted
    expect(result.isOffline).toBe(true)
    expect(result.config.minimumVersion).toBe('1.0.0') // Fallback config
  })

  test('should handle file permission errors gracefully', async () => {
    const mockConfig = createMockVersionConfig()

    fetchMock.mockSuccess(mockConfig)

    // Mock write permission error by creating a read-only directory
    const readOnlyDir = path.join(tempDir, 'readonly')
    fs.mkdirSync(readOnlyDir)
    
    try {
      // Try to make directory read-only (may not work on all systems)
      fs.chmodSync(readOnlyDir, 0o444)
    } catch {
      // Skip this test if we can't create read-only directory
      return
    }

    const controller = new VersionController(
      'https://example.com/config.json',
      readOnlyDir
    )

    // Should not throw even if cache write fails
    const result = await controller.checkVersionStatus()
    expect(result.status).toBe('allowed')
  })

  test('should maintain cache consistency under concurrent access', async () => {
    // Create shared temp directory for concurrent access test
    const concurrentTempDir = fs.mkdtempSync(path.join(tempDir, 'concurrent-'))
    
    const mockConfig1 = createMockVersionConfig({
      latestVersion: '1.4.0'
    })
    const mockConfig2 = createMockVersionConfig({
      latestVersion: '1.5.0'
    })

    // Set up manual fetch mock for different responses
    let callCount = 0
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++
      const config = callCount === 1 ? mockConfig1 : mockConfig2
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(config)
      })
    })

    const controller1 = new VersionController(
      'https://example.com/config1.json',
      concurrentTempDir
    )
    const controller2 = new VersionController(
      'https://example.com/config2.json',
      concurrentTempDir
    )

    // Both should complete without errors
    const [result1, result2] = await Promise.all([
      controller1.checkVersionStatus(),
      controller2.checkVersionStatus()
    ])

    expect(result1.config.latestVersion).toBe('1.4.0')
    expect(result2.config.latestVersion).toBe('1.5.0')
    expect(result1.isOffline).toBe(false)
    expect(result2.isOffline).toBe(false)
  })

  test('should handle large cache files efficiently', async () => {
    // Set app version to something not in deprecated list
    mockApp.getVersion.mockReturnValue('2.0.0')
    
    // Create a config with large data
    const largeConfig = createMockVersionConfig({
      updateMessage: 'A'.repeat(10000), // Large message
      deprecatedVersions: Array.from({ length: 100 }, (_, i) => `1.0.${i}`),
      forceUpdateVersions: Array.from({ length: 50 }, (_, i) => `0.9.${i}`)
    })

    fetchMock.mockSuccess(largeConfig)

    const start = Date.now()
    const result = await versionController.checkVersionStatus()
    const duration = Date.now() - start

    // Should complete within reasonable time (less than 1 second)
    expect(duration).toBeLessThan(1000)
    expect(result.status).toBe('allowed')
    
    // Verify cache was created
    const cacheFile = versionController.getCacheFilePath()
    expect(fs.existsSync(cacheFile)).toBe(true)
    
    // Verify we can read large cache back quickly
    fetchMock.mockNetworkError('Network error')
    const start2 = Date.now()
    const result2 = await versionController.checkVersionStatus()
    const duration2 = Date.now() - start2
    
    expect(duration2).toBeLessThan(500) // Reading cache should be faster
    expect(result2.isOffline).toBe(true)
    expect(result2.config.updateMessage).toBe(largeConfig.updateMessage)
  })

  test('should clean up properly on errors', async () => {
    // Simulate network error during fetch
    fetchMock.mockNetworkError('Network timeout')

    const result = await versionController.checkVersionStatus()
    
    // Should handle error gracefully
    expect(result.isOffline).toBe(true)
    expect(result.status).toBe('allowed') // Should default to allowed
    
    // No partial or corrupted cache files should be left
    const cacheFile = versionController.getCacheFilePath()
    if (fs.existsSync(cacheFile)) {
      // If cache exists, it should be valid JSON
      // eslint-disable-next-line jest/no-conditional-expect
      expect(() => {
        JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
      }).not.toThrow()
    }
  })
})
