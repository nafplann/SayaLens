# SayaLens Version Control System

## Overview

The SayaLens Version Control system provides a robust, offline-safe mechanism for managing app updates and version deprecation. It's designed to ensure user safety while maintaining functionality even when the device is offline.

## Features

✅ **Offline-Safe Operation** - App always works, even without internet  
✅ **Smart Caching** - Persistent version config with intelligent fallbacks  
✅ **Graceful Degradation** - Less restrictive policies when offline  
✅ **Comprehensive Analytics** - Track update adoption and user behavior  
✅ **Multiple Update Strategies** - From gentle warnings to forced updates  
✅ **Network Resilience** - Handles timeouts, errors, and connectivity issues  

## Version Status Types

### 1. **Allowed** 
- ✅ App runs normally
- No restrictions or warnings
- User has current or acceptable version

### 2. **Deprecated**
- ⚠️ Shows warning but allows continued use
- Recommends updating but doesn't block
- Used for older versions that still work

### 3. **Force Update**
- 🚨 Critical security/stability issues
- Blocks app usage (online) or warns strongly (offline)
- User must update to continue

### 4. **Blocked**
- 🚫 Version no longer supported
- App cannot run (online) or shows warning (offline)
- Used for versions with serious issues

## Configuration

### Remote Config File (`version-config.json`)

```json
{
  "minimumVersion": "1.0.0",
  "latestVersion": "1.2.0", 
  "isKillSwitchActive": false,
  "deprecatedVersions": ["1.0.0"],
  "forceUpdateVersions": ["1.0.1"],
  "updateMessage": "🚀 New version available with improved features!",
  "downloadUrl": "https://github.com/nafplann/sayalens/releases/latest",
  "killSwitchMessage": "App temporarily unavailable for maintenance."
}
```

### Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `minimumVersion` | string | Lowest version allowed to run |
| `latestVersion` | string | Current latest version available |
| `isKillSwitchActive` | boolean | Emergency shutdown for all versions |
| `deprecatedVersions` | array | Versions that show deprecation warning |
| `forceUpdateVersions` | array | Versions requiring immediate update |
| `updateMessage` | string | Message shown to users about updates |
| `downloadUrl` | string | Where users can download latest version |
| `killSwitchMessage` | string | Message shown when kill switch is active |

## Usage Examples

### Deprecate Version 1.0.0
```json
{
  "deprecatedVersions": ["1.0.0"],
  "updateMessage": "Version 1.0.0 contains known bugs. Please update for better stability."
}
```

### Force Update for Security Issue
```json
{
  "forceUpdateVersions": ["1.0.1"],
  "updateMessage": "Critical security vulnerability found in 1.0.1. Immediate update required."
}
```

### Block Old Versions
```json
{
  "minimumVersion": "1.1.0",
  "updateMessage": "Versions below 1.1.0 are no longer supported due to compatibility issues."
}
```

### Emergency Kill Switch
```json
{
  "isKillSwitchActive": true,
  "killSwitchMessage": "SayaLens is temporarily unavailable for maintenance. Please check back in a few hours."
}
```

## Offline Safety Mechanisms

### 1. **Cache-Based Fallbacks**
- Persistent cache in app's userData directory
- Graceful degradation when cache is stale
- Fallback config when all else fails

### 2. **Lenient Offline Policies**
- `blocked` → `deprecated` when offline
- `force_update` → `deprecated` after 1-hour grace period
- Kill switch disabled when offline

### 3. **Network Resilience**
- 10-second timeout on network requests
- Automatic retry when connection restored
- AbortController for clean request cancellation

### 4. **Smart Cache Management**
- 24-hour cache expiration for normal operations
- Extended cache validity during network issues
- Cache corruption recovery

## Analytics Integration

The system tracks comprehensive metrics:

### Version Events
- `version_check_performed` - Version check completed
- `version_blocked` - User blocked by version policy
- `force_update_required` - Force update triggered
- `version_deprecated_warning` - Deprecation warning shown
- `manual_update_check` - User manually checked for updates

### Network Events
- `offline_mode_detected` - App running in offline mode
- `network_restored` - Internet connection restored
- `config_cache_hit/miss` - Cache usage statistics

### User Actions
- `update_download_initiated` - User clicked download
- `force_update_continued_offline` - User continued despite force update

## Testing

### Run Tests
```bash
# Run all tests
npm test

# Run only version control tests
npm run test:version

# Run integration tests
npm run test:integration

# Run tests with coverage
npm run test:coverage
```

### Test Coverage
- ✅ Version comparison logic
- ✅ Cache management
- ✅ Network operations with timeouts
- ✅ Offline safety mechanisms
- ✅ Error handling
- ✅ Real file system operations
- ✅ Configuration validation

## Implementation Details

### File Structure
```
src/main/modules/
├── versionControl.ts     # Core version control logic
tests/
├── versionControl.test.js        # Unit tests
├── integration/
│   └── versionIntegration.test.js # Integration tests
├── utils/
│   └── testUtils.js               # Test utilities
└── setup.js                      # Test configuration
```

### Main Integration Points

1. **App Startup** - Version check before app initialization
2. **Periodic Checks** - Every 30 minutes (configurable)
3. **Network Events** - Automatic checks when connection restored
4. **Manual Checks** - User-triggered via tray menu
5. **Analytics** - Comprehensive event tracking

### Error Handling Philosophy

🎯 **Core Principle**: *Never break the app due to version control failures*

- Network timeouts → Use cached config
- Invalid config → Use fallback config  
- Cache corruption → Regenerate with defaults
- Complete failure → Allow app to start normally

## Security Considerations

### 1. **Config Validation**
- Validates JSON structure and required fields
- Checks version format (semantic versioning)
- Sanitizes user-facing messages

### 2. **Network Security** 
- HTTPS-only config URLs
- Request timeout limits
- No sensitive data in requests

### 3. **Cache Security**
- Stored in user's secure app data directory
- No executable code in cache
- Cache invalidation on corruption

### 4. **Graceful Failures**
- No security-critical dependencies on version control
- App functionality preserved during failures
- Clear error messaging to users

## Deployment Workflow

### 1. **Update Remote Config**
```bash
# Update version-config.json in your repository
git add version-config.json
git commit -m "Update version policy"
git push origin main
```

### 2. **Test Configuration**
```bash
# Test with development URL
npm run test:version
```

### 3. **Monitor Analytics**
- Track version adoption rates
- Monitor offline usage patterns
- Watch for error rates in version checks

### 4. **Gradual Rollout**
```json
{
  "deprecatedVersions": ["1.0.0"],  // Week 1: Warn users
  "forceUpdateVersions": ["1.0.0"], // Week 2: Force update  
  "minimumVersion": "1.0.1"         // Week 3: Block completely
}
```

## Troubleshooting

### Common Issues

**Q: Users reporting they can't update despite being online**  
A: Check if `downloadUrl` is accessible and valid

**Q: App not respecting version policies**  
A: Verify remote config URL and JSON structure

**Q: High offline mode detection rates**  
A: Check network timeout settings and CDN availability

**Q: Version checks taking too long**  
A: Reduce `networkTimeout` or improve config hosting

### Debug Mode

Enable detailed logging by setting:
```bash
NODE_ENV=development
```

This provides:
- Detailed network request logs
- Cache operation details  
- Version comparison traces
- Offline mode indicators

## Best Practices

### 1. **Version Policy Strategy**
- 🟢 **Gentle Warning** → `deprecatedVersions`
- 🟡 **Strong Warning** → `forceUpdateVersions` 
- 🔴 **Complete Block** → `minimumVersion`
- ⚫ **Emergency Stop** → `isKillSwitchActive`

### 2. **Rollout Timeline**
```
Week 1: Add to deprecatedVersions
Week 2: Move to forceUpdateVersions  
Week 3: Update minimumVersion
```

### 3. **Message Guidelines**
- Clear, actionable language
- Include version numbers
- Explain why update is needed
- Provide easy update path

### 4. **Analytics Monitoring**
- Track adoption rates by version
- Monitor offline usage patterns
- Watch for geographic update barriers
- Identify user experience issues

### 5. **Testing Strategy**
- Test offline scenarios thoroughly
- Verify cache behavior across restarts
- Test network failure recovery
- Validate all version status transitions

## License

This version control system is part of SayaLens and follows the same MIT license.
