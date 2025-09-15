# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Test Helper Functions**: New message parsing utilities in `test-utils.js`
  - `parseStatsMessage()` - Handles double-encoded JSON from RTCStats bundle
  - `findMessageByEventName()` - Finds messages by event name
  - `filterMessagesByEventName()` - Filters messages by event name
  - `getEventPayload()` - Extracts event payload from stats messages
  - These helpers make tests more readable and maintainable

### Changed
- **Test Infrastructure**: Replaced simplified mock implementation with actual RTCStats bundle
  - Tests now use the production RTCStats bundle instead of `simple-rtcstats.js`
  - WebSocket mock enhanced to support full trace-ws protocol including sequence number messages
  - Message parsing updated throughout tests to handle bundle's double-encoded JSON format
  - All tests updated to properly initialize RTCStats with `trace.connect()` and proper configuration
- **Test Refactoring**: Improved test readability
  - Replaced verbose message parsing code with clean helper function calls
  - Tests now clearly show intent without parsing boilerplate

### Removed
- `tests/helpers/simple-rtcstats.js` - Simplified mock implementation removed in favor of using actual bundle
  - This ensures tests accurately reflect production behavior
  - Eliminates maintenance burden of keeping mock in sync with actual implementation
- `loadRTCStatsBundle()` - Removed redundant alias function
  - Standardized on using `loadRTCStats()` everywhere

### Fixed
- Test reliability improved by using actual RTCStats bundle behavior
- WebSocket initialization now properly handles the trace-ws handshake protocol

## [9.7.0] - 2024-01-13

### Added
- **Playwright Testing Framework**: Complete migration from Puppeteer to Playwright
  - New test files: `getUserMedia.spec.js`, `rtcPeerConnection.spec.js`, `stats.spec.js`, `websocket.spec.js`
  - Mock WebSocket server implementation for reliable testing
  - Support for Chrome, Firefox, and Safari testing
  - Comprehensive test utilities and helpers

### Changed
- ESLint configuration converted from `.eslintrc.js` to `.eslintrc.cjs` format
- Test directory restructured: old tests moved to `test_deprecated/`
- Build configuration updated with new Rollup config for test bundling

### Removed
- Puppeteer-based test infrastructure (moved to `test_deprecated/` for reference)

## [9.6.0] - Previous Releases

### Fixed
- Made second RTCPeerConnection constructor parameter optional (#32, #33)
- Fixed relay obfuscation (#31)
- Browser checking for new JS utils (#30)
- Check if connection exists when checking its state (#29)

### Added
- Reconnect functionality (#28)

## Notes on Testing Changes

### Migration from simple-rtcstats to RTCStats Bundle (2025-09-13)

**Problem**: The simplified mock (`simple-rtcstats.js`) was diverging from the actual RTCStats implementation, potentially hiding real integration issues.

**Solution**: Use the actual RTCStats bundle in all tests.

**Key Technical Changes**:
1. Message format: Bundle sends `{type: 'stats-entry', data: JSON.stringify([...])}` instead of direct arrays
2. Initialization: Requires `meetingFqn`, `onCloseCallback`, and `trace.connect()` call
3. WebSocket mock: Must send sequence number message `{type: 'sn', body: {value: 0, state: 'initial'}}`
4. Message parsing: Requires double JSON decoding due to stringified data field

**Impact**: 
- ✅ Tests now catch real integration issues
- ✅ Single source of truth for RTCStats behavior
- ⚠️ Tests slightly more complex due to message format handling
- ⚠️ WebSocket mock must match server protocol expectations