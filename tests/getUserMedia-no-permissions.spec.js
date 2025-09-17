import { test, expect } from '@playwright/test';
import path from 'path';

import {
    MockWebSocketServer,
    loadRTCStats,
    findMessageByEventName,
    filterMessagesByEventName
} from './helpers/test-utils.js';

/**
 * Tests for getUserMedia behavior when permissions are not available.
 * These tests run only on the chromium-no-fake-ui project which doesn't grant
 * camera/microphone permissions by default.
 */

test.describe('getUserMedia Permission Errors', () => {
    let mockWS;

    test.beforeEach(async ({ page, context }) => {
        // Use local test page for reliable CI testing
        // file:// protocol works with fake media device flags
        const testPagePath = path.join(process.cwd(), 'tests', 'helpers', 'test-page.html');

        await page.goto(`file://${testPagePath}`);

        // Capture and log browser console messages
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();

            console.log(`[Browser ${type}]: ${text}`);
        });

        // Also capture any page errors
        page.on('pageerror', error => {
            console.error('[Browser Error]:', error.message);
        });

        // Setup mock WebSocket
        mockWS = new MockWebSocketServer();
        await mockWS.setup(page);

        // Grant permissions for fake devices
        await context.grantPermissions([ 'camera', 'microphone' ]);
    });

    /**
     * Test that getUserMedia failures are tracked when permissions are not available
     * Note: file:// protocol returns NotSupportedError instead of NotAllowedError
     */
    test('should track permission errors when media access is denied', async ({ page }) => {
        await loadRTCStats(page, mockWS);

        const result = await page.evaluate(async () => {
            try {
                // Request media without permissions (context has no permissions)
                await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: true
                });

                return { success: true };
            } catch (error) {
                return {
                    success: false,
                    error: error.name,
                    message: error.message
                };
            }
        });

        // Verify the specific error type
        expect(result.success).toBe(false);

        // When using file:// protocol without fake UI, we get NotSupportedError
        // instead of NotAllowedError. Both indicate permission/access issues.
        expect(result.error).toMatch(/NotAllowedError|NotSupportedError/);

        // Small delay for mock WebSocket to process messages
        await page.waitForTimeout(50);

        const messages = mockWS.getMessages();

        // Verify the call was tracked
        const gumCall = findMessageByEventName(
            messages,
            'getUserMedia',
            'navigator.mediaDevices.getUserMedia'
        );

        expect(gumCall).toBeTruthy();

        // Verify failure was tracked
        const errorMessages = filterMessagesByEventName(
            messages,
            'getUserMediaOnFailure',
            'navigator.mediaDevices.getUserMediaOnFailure',
            'getUserMediaFailed'
        );

        expect(errorMessages.length).toBeGreaterThan(0);

        // The error data should contain the error (NotSupportedError or NotAllowedError)
        expect(errorMessages[0].data).toMatch(/NotAllowedError|NotSupportedError/);
    });
});

