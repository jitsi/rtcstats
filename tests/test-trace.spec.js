/**
 * @fileoverview Basic smoke test for trace function and rtcstats initialization
 *
 * This test verifies that the trace function works and getUserMedia
 * calls are properly intercepted in a real browser context.
 */

import { test, expect } from '@playwright/test';

import { loadSimpleRTCStats } from './helpers/simple-rtcstats.js';
import { MockWebSocketServer } from './helpers/test-utils.js';

/**
 * Basic integration test to verify trace function and getUserMedia interception
 * work together in an HTTPS context
 */
test('Test trace function', async ({ page }) => {
    // Navigate to HTTPS page
    await page.goto('https://example.com');

    // Setup mock WebSocket
    const mockWS = new MockWebSocketServer();

    await mockWS.setup(page);


    // Load simple RTCStats
    await loadSimpleRTCStats(page);

    // Test direct trace call
    await page.evaluate(() => {
        window.trace('test-event', 'test-label', { test: 'data' });
    });

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

    const messages2 = mockWS.getMessages();

    // Verify that messages were sent to the WebSocket
    expect(messages2.length).toBeGreaterThan(0);

    // Verify we have both trace and getUserMedia messages
    const hasTraceMessage = messages2.some(m => {
        const parsed = JSON.parse(m.data);

        return parsed[0] === 'test-event';
    });
    const hasGetUserMediaMessage = messages2.some(m => {
        const parsed = JSON.parse(m.data);

        return parsed[0] === 'navigator.mediaDevices.getUserMedia';
    });

    expect(hasTraceMessage).toBe(true);
    expect(hasGetUserMediaMessage).toBe(true);
});
