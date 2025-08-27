const fs = require('fs')
const path = require('path')

/**
 * Create a mock version config for testing
 */
function createMockVersionConfig(overrides = {}) {
  return {
    minimumVersion: '1.0.0',
    latestVersion: '1.2.0',
    isKillSwitchActive: false,
    deprecatedVersions: [],
    forceUpdateVersions: [],
    updateMessage: 'Test update message',
    downloadUrl: 'https://example.com/download',
    lastUpdated: Date.now(),
    ...overrides
  }
}

/**
 * Create a mock cached version data
 */
function createMockCachedData(configOverrides = {}, cacheOverrides = {}) {
  return {
    config: createMockVersionConfig(configOverrides),
    lastFetched: Date.now(),
    isOfflineMode: false,
    ...cacheOverrides
  }
}

/**
 * Mock fetch with various scenarios
 */
function createFetchMock() {
  const mockFetch = jest.fn()
  
  return {
    mockFetch,
    
    // Success scenarios
    mockSuccess: (config) => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(config || createMockVersionConfig())
      })
    },
    
    // Network error scenarios
    mockNetworkError: (error = 'Network error') => {
      mockFetch.mockRejectedValue(new Error(error))
    },
    
    // HTTP error scenarios
    mockHttpError: (status = 404, statusText = 'Not Found') => {
      mockFetch.mockResolvedValue({
        ok: false,
        status,
        statusText
      })
    },
    
    // Timeout scenario
    mockTimeout: () => {
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      )
    }
  }
}

/**
 * Create a temporary directory for testing
 */
function createTempDir(prefix = 'version-test-') {
  const tempBase = path.join(__dirname, '..', 'temp')
  
  // Ensure temp directory exists
  if (!fs.existsSync(tempBase)) {
    fs.mkdirSync(tempBase, { recursive: true })
  }
  
  return fs.mkdtempSync(path.join(tempBase, prefix))
}

/**
 * Clean up temporary directory
 */
function cleanupTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch (error) {
    console.warn('Failed to cleanup temp dir:', error)
  }
}

/**
 * Mock Electron app for testing
 */
function createMockElectronApp(version = '1.0.0') {
  return {
    getVersion: jest.fn(() => version),
    getPath: jest.fn((path) => {
      if (path === 'userData') {
        return '/tmp/test-user-data'
      }
      return '/tmp'
    })
  }
}

/**
 * Setup file system mocks
 */
function setupFsMocks() {
  const fs = require('fs')
  
  return {
    existsSync: jest.spyOn(fs, 'existsSync'),
    readFileSync: jest.spyOn(fs, 'readFileSync'),
    writeFileSync: jest.spyOn(fs, 'writeFileSync'),
    mkdirSync: jest.spyOn(fs, 'mkdirSync')
  }
}

/**
 * Create version scenarios for testing
 */
function createVersionScenarios() {
  return {
    // User has current version
    current: {
      userVersion: '1.2.0',
      config: createMockVersionConfig({
        minimumVersion: '1.0.0',
        latestVersion: '1.2.0'
      }),
      expectedStatus: 'allowed'
    },
    
    // User has deprecated version
    deprecated: {
      userVersion: '1.0.0',
      config: createMockVersionConfig({
        deprecatedVersions: ['1.0.0']
      }),
      expectedStatus: 'deprecated'
    },
    
    // User has version requiring force update
    forceUpdate: {
      userVersion: '1.0.1',
      config: createMockVersionConfig({
        forceUpdateVersions: ['1.0.1']
      }),
      expectedStatus: 'force_update'
    },
    
    // User has version below minimum
    blocked: {
      userVersion: '0.9.0',
      config: createMockVersionConfig({
        minimumVersion: '1.0.0'
      }),
      expectedStatus: 'blocked'
    },
    
    // Kill switch active
    killSwitch: {
      userVersion: '1.2.0',
      config: createMockVersionConfig({
        isKillSwitchActive: true
      }),
      expectedStatus: 'blocked'
    }
  }
}

/**
 * Assert version check result structure
 */
function assertVersionCheckResult(result) {
  expect(result).toHaveProperty('status')
  expect(result).toHaveProperty('config')
  expect(result).toHaveProperty('userVersion')
  expect(result).toHaveProperty('isOffline')
  expect(result).toHaveProperty('cacheAge')
  
  expect(['allowed', 'deprecated', 'force_update', 'blocked']).toContain(result.status)
  expect(typeof result.isOffline).toBe('boolean')
  expect(typeof result.cacheAge).toBe('number')
  expect(typeof result.userVersion).toBe('string')
}

module.exports = {
  createMockVersionConfig,
  createMockCachedData,
  createFetchMock,
  createTempDir,
  cleanupTempDir,
  createMockElectronApp,
  setupFsMocks,
  createVersionScenarios,
  assertVersionCheckResult
}
