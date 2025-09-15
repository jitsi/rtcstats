/**
 * @fileoverview Tests for getUserMedia and getDisplayMedia API interception
 *
 * This test suite verifies that rtcstats properly intercepts and tracks:
 * - navigator.mediaDevices.getUserMedia() calls
 * - navigator.mediaDevices.getDisplayMedia() calls
 * - Success and failure scenarios
 * - Constraint tracking
 *
 * These tests verify the interception behavior and trace message formatting
 * using the full RTCStats bundle.
 */

/* global process */
import { test, expect } from '@playwright/test';
import path from 'path';

import {
    MockWebSocketServer,
    loadRTCStats,
    findMessageByEventName,
    filterMessagesByEventName,
    getEventPayload,
    parseStatsMessage
} from './helpers/test-utils.js';

test.describe('getUserMedia interception', () => {
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
     * Test that successful getUserMedia calls are intercepted and traced to WebSocket
     * Verifies the initial call and success event are properly tracked
     */
    test('should intercept successful getUserMedia calls', async ({ page, context }, testInfo) => {
        // Skip on chromium-no-fake-ui project
        test.skip(testInfo.project.name === 'chromium-no-fake-ui');

        // Grant permissions for fake devices
        await context.grantPermissions([ 'camera', 'microphone' ]);
        await loadRTCStats(page);

        // Call getUserMedia - should succeed with fake devices
        const streamId = await page.evaluate(async () => {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true
            });

            const id = stream.id;

            // Clean up the stream
            stream.getTracks().forEach(track => track.stop());

            return id;
        });

        // Stream should have been created
        expect(streamId).toBeTruthy();

        // Small delay for mock WebSocket to process messages
        await page.waitForTimeout(1000);

        const messages = mockWS.getMessages();

        // Verify getUserMedia was called with correct constraints
        const gumCall = findMessageByEventName(
            messages,
            'getUserMedia',
            'navigator.mediaDevices.getUserMedia'
        );

        expect(gumCall).toBeTruthy();
        const constraints = getEventPayload(gumCall);

        expect(constraints).toHaveProperty('audio', true);

        // Verify we got a success message
        const successMessage = findMessageByEventName(
            messages,
            'getUserMediaOnSuccess',
            'navigator.mediaDevices.getUserMediaOnSuccess'
        );

        expect(successMessage).toBeTruthy();

        // Verify the success message contains stream info
        const successData = getEventPayload(successMessage);

        expect(successData).toHaveProperty('id', streamId);
        expect(successData).toHaveProperty('tracks');
        expect(successData.tracks).toBeInstanceOf(Array);
        expect(successData.tracks.length).toBeGreaterThan(0);
    });

    /**
     * Test that getUserMedia failures are properly tracked when an OverconstrainedError occurs
     * This happens when constraints cannot be satisfied by available hardware
     */
    test('should track OverconstrainedError when video constraints cannot be satisfied', async ({ page }, testInfo) => {
        // Skip on chromium-no-fake-ui project
        test.skip(testInfo.project.name === 'chromium-no-fake-ui');
        await loadRTCStats(page, mockWS);

        const result = await page.evaluate(async () => {
            try {
                // Request impossible video dimensions that fake devices cannot satisfy
                await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { exact: 99999 },
                        height: { exact: 99999 }
                    }
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
        expect(result.error).toBe('OverconstrainedError');

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

        // Verify the error message contains the error name
        const errorData = parseStatsMessage(errorMessages[0]);

        expect(errorData[0]).toMatch(/getUserMediaOnFailure|getUserMediaFailed/);

        // The error data should contain "OverconstrainedError"
        expect(errorMessages[0].data).toContain('OverconstrainedError');
    });

    /**
     * Test that getUserMedia failures are tracked when impossible audio constraints are specified
     * This tests a different type of OverconstrainedError for audio instead of video
     */
    test('should track OverconstrainedError for impossible audio constraints', async ({ page }, testInfo) => {
        // Skip on chromium-no-fake-ui project
        test.skip(testInfo.project.name === 'chromium-no-fake-ui');
        await loadRTCStats(page, mockWS);

        const result = await page.evaluate(async () => {
            try {
                // Request impossible audio sample rate that fake devices cannot satisfy
                await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: { exact: 999999 },
                        echoCancellation: { exact: true },
                        channelCount: { exact: 99 }
                    }
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
        expect(result.error).toBe('OverconstrainedError');

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

        // The error data should contain "OverconstrainedError"
        expect(errorMessages[0].data).toContain('OverconstrainedError');
    });

    /**
     * Test that getUserMedia failures are tracked when permissions are not available
     * This test only runs on chromium-no-fake-ui project to test permission/access errors
     * Note: file:// protocol returns NotSupportedError instead of NotAllowedError
     */
    test('should track permission errors when media access is denied', async ({ page }, testInfo) => {
        // Only run on chromium-no-fake-ui project
        test.skip(testInfo.project.name !== 'chromium-no-fake-ui');

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

    /**
     * Test that getUserMedia handles invalid constraint formats (TypeError)
     * This verifies API contract validation and error tracking
     */
    test('should track TypeError when constraints are invalid', async ({ page }, testInfo) => {
        // Skip on chromium-no-fake-ui project
        test.skip(testInfo.project.name === 'chromium-no-fake-ui');
        await loadRTCStats(page, mockWS);

        const result = await page.evaluate(async () => {
            try {
                // Pass invalid constraints (must be at least one of audio/video)
                await navigator.mediaDevices.getUserMedia({});

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
        expect(result.error).toBe('TypeError');

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

        // The error data should contain "TypeError"
        expect(errorMessages[0].data).toContain('TypeError');
    });
});

