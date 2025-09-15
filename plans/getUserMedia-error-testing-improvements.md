# getUserMedia Error Testing Improvements

**Date**: 2025-09-15  
**Author**: Claude Code  
**Purpose**: Improve getUserMedia error testing to follow best practices

## Background

The current getUserMedia test suite has two main issues:
1. Two tests (`should track getUserMedia failures` and `should handle getUserMedia when constraints cannot be satisfied`) are testing similar failure scenarios
2. Error checking uses a regex that matches 4 different error types, violating the "test one thing at a time" principle

## Current State

### Problematic Code (tests/getUserMedia.spec.js:194)
```javascript
expect(error.name).toMatch(/OverconstrainedError|NotFoundError|NotReadableError|NotAllowedError/);
```

This line checks for multiple error types in a single assertion, making it unclear which specific error condition is being tested.

## Proposed Changes

### 1. Remove Duplicate Test
- **Action**: Delete test "should handle getUserMedia when constraints cannot be satisfied" (lines 167-218)
- **Rationale**: This test duplicates the functionality of "should track getUserMedia failures"

### 2. Create Specific Error Tests

#### Test 1: OverconstrainedError
- **Trigger**: Use impossible video constraints `{ width: { exact: 99999 } }`
- **Why it works**: Fake devices in Playwright cannot satisfy these extreme constraints
- **Verification**: Check for exact error name "OverconstrainedError"

#### Test 2: NotAllowedError  
- **Trigger**: Clear permissions with `context.clearPermissions()` before calling getUserMedia
- **Why it works**: Simulates user denying permission
- **Verification**: Check for exact error name "NotAllowedError"

#### Test 3: TypeError
- **Trigger**: Pass invalid constraint format (e.g., string instead of object)
- **Why it works**: Tests API contract validation
- **Verification**: Check for exact error name "TypeError"

## Implementation Strategy

Each new test will:
1. Set up specific conditions to trigger one error type
2. Call getUserMedia with appropriate constraints
3. Verify the exact error name (no regex matching multiple types)
4. Confirm rtcstats properly tracks the specific failure
5. Include clear documentation about the error being tested

## Expected Benefits

- **Better test isolation**: Each test verifies one specific behavior
- **Improved debugging**: When a test fails, it's clear which error scenario broke
- **More predictable**: Specific error conditions are more reliable than catching any of 4 errors
- **Better coverage**: Tests different failure paths in the code
- **Follows best practices**: Aligns with the testing guideline "One behavior per test"

## Implementation Update (2025-09-15)

### Solution for NotAllowedError Testing

Created a separate Playwright project configuration `chromium-no-fake-ui` that:
- Uses `--use-fake-device-for-media-stream` (provides fake devices)
- Does NOT use `--use-fake-ui-for-media-stream` (doesn't auto-grant permissions)
- Has no permissions granted by default

This allows testing permission-related errors while still having fake devices available.

### Final Test Implementation

1. **OverconstrainedError (Video)**: Tests impossible video dimensions
2. **OverconstrainedError (Audio)**: Tests impossible audio constraints  
3. **Permission Errors**: Tests NotSupportedError/NotAllowedError on chromium-no-fake-ui
4. **TypeError**: Tests invalid constraint format

### Key Findings

- With file:// protocol and no fake UI, Chrome returns `NotSupportedError` instead of `NotAllowedError`
- Both errors indicate permission/access issues, so the test accepts either
- Other tests skip the chromium-no-fake-ui project to ensure they run with fake UI

## Notes

- OverconstrainedError is the most reliable to reproduce in Playwright with fake devices
- NotFoundError is harder to trigger with fake devices (they always provide audio/video)
- NotReadableError typically occurs with hardware issues, difficult to simulate
- Tests will focus on errors that can be reliably reproduced in the test environment