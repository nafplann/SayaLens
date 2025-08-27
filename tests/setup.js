const path = require('path')
const fs = require('fs')

// Ensure temp directory exists for tests
const tempDir = path.join(__dirname, 'temp')
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true })
}

// Mock console methods to reduce noise in tests (but preserve original functionality)
const originalConsole = { ...console }

global.console = {
  ...console,
  log: jest.fn((...args) => {
    // Optionally uncomment the line below to see logs during tests
    // originalConsole.log(...args)
  }),
  warn: jest.fn((...args) => {
    // Optionally uncomment the line below to see warnings during tests
    // originalConsole.warn(...args)
  }),
  error: jest.fn((...args) => {
    // Optionally uncomment the line below to see errors during tests
    // originalConsole.error(...args)
  }),
  info: jest.fn((...args) => {
    // originalConsole.info(...args)
  })
}

// Global test utilities
global.testUtils = {
  restoreConsole: () => {
    global.console = originalConsole
  },
  enableConsole: () => {
    global.console = originalConsole
  }
}

// Mock fetch globally if not already mocked
if (!global.fetch) {
  global.fetch = jest.fn()
}

// Mock AbortController for timeout testing
if (!global.AbortController) {
  global.AbortController = jest.fn().mockImplementation(() => ({
    abort: jest.fn(),
    signal: { aborted: false }
  }))
}

// Mock setTimeout and clearTimeout for controlled testing
const originalSetTimeout = global.setTimeout
const originalClearTimeout = global.clearTimeout

global.mockTimers = {
  enable: () => {
    jest.useFakeTimers()
  },
  disable: () => {
    jest.useRealTimers()
  },
  advance: (ms) => {
    jest.advanceTimersByTime(ms)
  }
}

// Cleanup after all tests
afterAll(() => {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true })
  } catch (error) {
    // Ignore cleanup errors
  }
})

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks()
  
  if (global.fetch && typeof global.fetch.mockClear === 'function') {
    global.fetch.mockClear()
  }
})

// Custom matchers for version testing
expect.extend({
  toBeValidVersion(received) {
    const pass = /^\d+\.\d+\.\d+$/.test(received)
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid version format`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be a valid version format (x.y.z)`,
        pass: false,
      }
    }
  },
  
  toBeVersionHigherThan(received, expected) {
    const receivedParts = received.split('.').map(Number)
    const expectedParts = expected.split('.').map(Number)
    
    let isHigher = false
    for (let i = 0; i < 3; i++) {
      if (receivedParts[i] > expectedParts[i]) {
        isHigher = true
        break
      } else if (receivedParts[i] < expectedParts[i]) {
        break
      }
    }
    
    if (isHigher) {
      return {
        message: () => `expected ${received} not to be higher than ${expected}`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be higher than ${expected}`,
        pass: false,
      }
    }
  }
})
