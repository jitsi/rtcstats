/**
 * @fileoverview Tests for WebSocket connection management
 *
 * This test suite verifies:
 * - Initial WebSocket connection establishment
 * - Automatic reconnection on disconnect
 * - Message buffering during disconnection
 * - Keep-alive ping mechanism
 */

import { test, expect } from '@playwright/test';

test.describe('WebSocket connection and reconnection', () => {
    /**
     * Test that rtcstats connects to the configured WebSocket endpoint
     * immediately after initialization
     */
    test('should connect to WebSocket server on initialization', async ({ page }) => {
        const connections = [];

        await page.exposeFunction('wsConnect', url => {
            connections.push(url);
        });

        await page.evaluate(() => {
            window.WebSocket = class MockWebSocket extends EventTarget {
                /**
                 * Mock WebSocket constructor
                 * @param {string} url - WebSocket URL
                 */
                constructor(url) {
                    super();
                    window.wsConnect(url);
                    setTimeout(() => this.dispatchEvent(new Event('open')), 10);
                }

                /**
                 * Mock send method
                 */
                send() {
                    // Intentionally empty for mock
                }

                /**
                 * Mock close method
                 */
                close() {
                    // Intentionally empty for mock
                }
            };
        });

        // Load the modules using the simplified approach
        const { loadRTCStats } = await import('./helpers/test-utils.js');

        await loadRTCStats(page, {
            endpoint: 'wss://test-server.com',
            useLegacy: false
        });

        await page.waitForTimeout(100);
        expect(connections).toContain('wss://test-server.com');
    });

    /**
     * Test automatic reconnection with exponential backoff
     * when the WebSocket connection is lost
     */
    test('should handle reconnection on disconnect', async ({ page }) => {
        let connectCount = 0;

        await page.exposeFunction('wsConnected', () => {
            connectCount++;
        });

        await page.evaluate(() => {
            window.WebSocket = class MockWebSocket extends EventTarget {
                /**
                 * Mock WebSocket constructor
                 * @param {string} url - WebSocket URL
                 */
                constructor(url) {
                    super();
                    this.url = url;
                    this.readyState = 0;
                    window.wsConnected();
                    window.lastWebSocket = this;

                    setTimeout(() => {
                        this.readyState = 1;
                        this.dispatchEvent(new Event('open'));
                    }, 10);
                }

                /**
                 * Mock send method
                 */
                send() {
                    // Intentionally empty for mock
                }

                /**
                 * Mock close method
                 * @param {number} code - Close code
                 */
                close(code) {
                    this.readyState = 3;
                    this.dispatchEvent(new CloseEvent('close', { code }));
                }
            };
        });

        // Load the modules using the simplified approach
        const { loadRTCStats } = await import('./helpers/test-utils.js');

        await loadRTCStats(page, {
            endpoint: 'wss://test-reconnect.com',
            useLegacy: false
        });

        await page.waitForTimeout(200);
        expect(connectCount).toBe(1);

        await page.evaluate(() => {
            window.lastWebSocket.close(1006);
        });

        await page.waitForTimeout(2500);
        expect(connectCount).toBeGreaterThan(1);
    });

    /**
     * Test that messages are buffered (up to 1000) when disconnected
     * and sent when the connection is restored
     */
    test('should buffer messages when disconnected', async ({ page }) => {
        const sentMessages = [];

        await page.exposeFunction('wsSend', data => {
            sentMessages.push(data);
        });

        await page.evaluate(() => {
            let wsInstance;

            window.WebSocket = class MockWebSocket extends EventTarget {
                /**
                 * Mock WebSocket constructor
                 */
                constructor() {
                    super();
                    this.readyState = 0;
                    wsInstance = this; // eslint-disable-line consistent-this

                    setTimeout(() => {
                        this.readyState = 1;
                        this.dispatchEvent(new Event('open'));
                    }, 10);
                }

                /**
                 * Mock send method
                 * @param {string} data - Data to send
                 */
                send(data) {
                    if (this.readyState === 1) {
                        window.wsSend(data);
                    }
                }

                /**
                 * Mock close method
                 */
                close() {
                    this.readyState = 3;
                    this.dispatchEvent(new CloseEvent('close'));
                }
            };

            window.getWsInstance = () => wsInstance;
        });

        // Load the modules using the simplified approach
        const { loadRTCStats } = await import('./helpers/test-utils.js');

        await loadRTCStats(page, {
            endpoint: 'wss://test-buffer.com',
            useLegacy: false
        });

        await page.waitForTimeout(100);

        await page.evaluate(() => {
            window.trace('test', null, { data: 'message1' });
        });

        await page.waitForTimeout(50);
        const beforeDisconnect = sentMessages.length;

        await page.evaluate(() => {
            window.getWsInstance().readyState = 3;
            window.trace('test', null, { data: 'buffered1' });
            window.trace('test', null, { data: 'buffered2' });
        });

        await page.evaluate(() => {
            window.getWsInstance().readyState = 1;
            window.getWsInstance().dispatchEvent(new Event('open'));
        });

        await page.waitForTimeout(100);

        expect(sentMessages.length).toBeGreaterThan(beforeDisconnect);
    });

    /**
     * Test that keep-alive pings are sent periodically
     * to maintain the WebSocket connection
     */
    test('should send keep-alive pings', async ({ page }) => {
        const pings = [];

        await page.exposeFunction('wsPing', data => {
            const parsed = JSON.parse(data);

            if (parsed[0] === 'keepalive') {
                pings.push(Date.now());
            }
        });

        await page.evaluate(() => {
            window.WebSocket = class MockWebSocket extends EventTarget {
                /**
                 * Mock WebSocket constructor
                 */
                constructor() {
                    super();
                    setTimeout(() => {
                        this.readyState = 1;
                        this.dispatchEvent(new Event('open'));
                    }, 10);
                }

                /**
                 * Mock send method
                 * @param {string} data - Data to send
                 */
                send(data) {
                    window.wsPing(data);
                }

                /**
                 * Mock close method
                 */
                close() {
                    // Intentionally empty for mock
                }
            };
        });

        // Load the modules using the simplified approach
        const { loadRTCStats } = await import('./helpers/test-utils.js');

        await loadRTCStats(page, {
            endpoint: 'wss://test-ping.com',
            pingInterval: 500
        });

        await page.waitForTimeout(1500);
        expect(pings.length).toBeGreaterThanOrEqual(2);
    });
});

