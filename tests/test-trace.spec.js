/**
 * @fileoverview Basic smoke test for trace function and rtcstats initialization
 *
 * This test verifies that the trace function works and getUserMedia
 * calls are properly intercepted in a real browser context.
 */

/* global process */
import { test, expect } from '@playwright/test';
import path from 'path';

import {
    MockWebSocketServer,
    loadRTCStats,
    findMessageByEventName
} from './helpers/test-utils.js';

/**
 * Basic integration test to verify trace function and getUserMedia interception
 * work together in an HTTPS context
 */
test('Test trace function', async ({ page, context }) => {
    // Use local test page for consistent testing
    const testPagePath = path.join(process.cwd(), 'tests', 'helpers', 'test-page.html');

    await page.goto(`file://${testPagePath}`);

    // Grant permissions for fake devices
    await context.grantPermissions([ 'camera', 'microphone' ]);

    // Setup mock WebSocket
    const mockWS = new MockWebSocketServer();

    await mockWS.setup(page);


    // Load RTCStats bundle
    await loadRTCStats(page, mockWS);

    // Test direct trace call - not available with full bundle
    // The full bundle traces internally but doesn't expose a window.trace function

    await page.waitForTimeout(100);

    // Test getUserMedia interception
    await page.evaluate(async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (e) {
            // Expected to fail in test environment without real devices
        }
    });

    await page.waitForTimeout(500);

    const messages = mockWS.getMessages();

    // Verify that messages were sent to the WebSocket
    expect(messages.length).toBeGreaterThan(0);

    // Verify we have getUserMedia messages
    const getUserMediaMessage = findMessageByEventName(
        messages,
        'navigator.mediaDevices.getUserMedia'
    );

    expect(getUserMediaMessage).toBeTruthy();

    // Also verify either success or failure message
    const outcomeMessage = findMessageByEventName(
        messages,
        'navigator.mediaDevices.getUserMediaOnFailure',
        'navigator.mediaDevices.getUserMediaOnSuccess'
    );

    expect(outcomeMessage).toBeTruthy();
});
