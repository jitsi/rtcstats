# RTCStats Test Documentation

## Overview

The RTCStats test suite uses Playwright for browser automation testing. The tests verify that rtcstats properly intercepts WebRTC APIs, collects statistics, and manages WebSocket connections for telemetry.

## Test Structure

```
tests/
├── getUserMedia.spec.js      # Tests for getUserMedia/getDisplayMedia interception
├── rtcPeerConnection.spec.js # Tests for RTCPeerConnection API tracking
├── stats.spec.js             # Tests for statistics collection and compression
├── websocket.spec.js         # Tests for WebSocket connection management
├── test-trace.spec.js        # Basic smoke test for trace function
└── helpers/
    ├── rtcstats-bundle.js    # Bundled rtcstats code for tests (generated)
    ├── simple-rtcstats.js    # Simplified rtcstats implementation
    ├── test-utils.js         # Test utilities and mock WebSocket server
    ├── test-entry.js         # Rollup entry point for bundling
    ├── test-mocks.js         # Mock Jitsi dependencies
    └── test-page.html        # Test HTML page for browser context
```

## Test Files Description

### getUserMedia.spec.js
Tests the interception of media device APIs (3 focused tests):
- **Successful getUserMedia calls**: Verifies successful stream creation with proper permissions and traces
- **getUserMedia failure tracking**: Tests failure scenarios with impossible constraints  
- **Constraint validation failures**: Tests when constraints cannot be satisfied (e.g., impossible resolution/sample rate)

### rtcPeerConnection.spec.js
Tests RTCPeerConnection tracking:
- Constructor interception with configuration
- Method call tracking (createOffer, setLocalDescription, etc.)
- ICE candidate event tracking
- Connection state change monitoring
- Legacy Jitsi constraint support (rtcStatsClientId, etc.)

### stats.spec.js
Tests statistics collection features:
- Periodic `getStats()` collection at configured intervals
- Delta compression for reducing payload size
- Multiple peer connection tracking
- Data channel creation tracking
- Track management (addTrack/removeTrack)
- IP address obfuscation for privacy

### websocket.spec.js
Tests WebSocket connection management:
- Initial connection establishment
- Automatic reconnection with exponential backoff
- Message buffering during disconnection (up to 1000 messages)
- Keep-alive ping mechanism

### test-trace.spec.js
Basic integration test that verifies:
- Direct trace function calls work
- getUserMedia interception works in HTTPS context
- Messages are properly sent to WebSocket

## Helper Utilities

### test-utils.js
Provides two main utilities:

1. **MockWebSocketServer**: Captures WebSocket connections and messages for testing
   - `setup(page)`: Injects mock WebSocket into the page
   - `getMessages()`: Returns all captured messages
   - `getConnections()`: Returns all connection attempts

2. **loadRTCStats(page, config)**: Loads the bundled rtcstats into a page
   - Validates bundle exists
   - Initializes trace-ws and rtcstats
   - Verifies API wrapping

### simple-rtcstats.js
Lightweight rtcstats implementation for basic testing:
- Directly wraps WebRTC APIs without complex module loading
- Used for testing basic interception functionality
- Provides `initSimpleRTCStats()` and `loadSimpleRTCStats()` functions

### test-mocks.js
Mock implementations of Jitsi dependencies:
- **BrowserDetection**: Always returns Chrome/Chromium for consistency
- **getLogger**: Returns console-based logger for test debugging

## Running Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Build the test bundle
npm run build:test
```

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npx playwright test tests/getUserMedia.spec.js
```

### Run Tests in Headed Mode (see browser)
```bash
npx playwright test --headed
```

### Run Tests with Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Debug Tests
```bash
npx playwright test --debug
```

## Common Patterns

### Setting Up Mock WebSocket
```javascript
let mockWS;

test.beforeEach(async ({ page }) => {
    mockWS = new MockWebSocketServer();
    await mockWS.setup(page);
});
```

### Loading RTCStats
```javascript
// Full rtcstats with bundled modules
await loadRTCStats(page, {
    endpoint: 'wss://mock-server.test',
    pollInterval: 1000
});

```

### Asserting WebSocket Messages
```javascript
const messages = mockWS.getMessages();
const getUserMediaCalls = messages.filter(m => {
    const parsed = JSON.parse(m.data);
    return parsed[0] === 'getUserMedia';
});
expect(getUserMediaCalls.length).toBeGreaterThan(0);
```

## Test Configuration

Tests use Playwright configuration from `playwright.config.js`:
- Runs tests in Chromium, Firefox, and WebKit
- Uses fake media devices for getUserMedia tests
- Configures test output directory
- Sets up HTML reporter for test results

## Recent Changes (September 2024)

### Test Suite Cleanup
- Removed unnecessary files (test-setup-context.md, duplicate test-page.html, test.html)
- Added comprehensive JSDoc documentation to all test files
- Cleaned up debug console.log statements
- Refactored getUserMedia tests for better separation of concerns

### getUserMedia Test Improvements
- Split success and failure scenarios into separate tests
- Added proper permission handling for fake devices
- Improved constraint validation testing
- Enhanced verification of traced messages
- Removed redundant tests (getDisplayMedia basic check, getUserMedia wrapping verification)

### WebSocket Connection Issues
Check that the mock WebSocket is properly set up before loading rtcstats.

## Best Practices

1. **Always clean up resources**: Stop media streams and close peer connections
2. **Use appropriate timeouts**: WebRTC operations are asynchronous
3. **Test both success and failure paths**: Separate tests for each scenario
4. **Verify and log message contents**: Don't just check message count
5. **Use descriptive test names**: Clearly state what is being tested
6. **Add JSDoc comments**: Document test purpose and expectations
7. **Handle permissions properly**: Grant permissions for success tests, use impossible constraints for failure tests
8. **Keep tests focused**: One test should verify one specific behavior