/**
 * @fileoverview Test utilities for rtcstats Playwright tests
 *
 * Provides mock WebSocket server and RTCStats loading utilities
 * for testing WebRTC API interception and statistics collection.
 */

/* eslint-env node */
import fs from 'fs';
import path from 'path';

/**
 * Mock WebSocket server for testing
 * Captures WebSocket connections and messages for assertion
 */
export class MockWebSocketServer {
    /**
     * Constructor
     */
    constructor() {
        this.connections = [];
        this.messages = [];
    }


    /**
     * Setup mock WebSocket server on page
     * @param {Page} page - Playwright page object
     */
    async setup(page) {
        await page.exposeFunction('mockWSConnect', url => {
            this.connections.push({ url,
                time: Date.now() });
        });

        await page.exposeFunction('mockWSSend', data => {
            this.messages.push({ data,
                time: Date.now() });
        });

        await page.evaluate(() => {
            window.originalWebSocket = window.WebSocket;

            window.WebSocket = class MockWebSocket extends EventTarget {
                static CONNECTING = 0;
                static OPEN = 1;
                static CLOSING = 2;
                static CLOSED = 3;

                /**
                 * Mock WebSocket constructor
                 * @param {string} url - WebSocket URL
                 */
                constructor(url) {
                    super();
                    this.url = url;
                    this.readyState = 0;
                    window.mockWSConnect(url);

                    setTimeout(() => {
                        this.readyState = 1;
                        this.dispatchEvent(new Event('open'));

                        // Send initial sequence number message to enable sending
                        setTimeout(() => {
                            if (this.onmessage) {
                                this.onmessage({
                                    data: JSON.stringify({
                                        type: 'sn',
                                        body: {
                                            value: 0,
                                            state: 'initial'
                                        }
                                    })
                                });
                            }
                        }, 20);
                    }, 10);
                }

                /**
                 * Mock send method
                 * @param {string} data - Data to send
                 */
                send(data) {
                    window.mockWSSend(data);
                }

                /**
                 * Mock close method
                 * @param {number} code - Close code
                 * @param {string} reason - Close reason
                 */
                close(code, reason) {
                    this.readyState = 3;
                    this.dispatchEvent(new CloseEvent('close', { code,
                        reason }));
                }
            };
        });
    }

    /**
     * Get all messages sent
     * @returns {Array} messages
     */
    getMessages() {
        return this.messages;
    }

    /**
     * Get all connections made
     * @returns {Array} connections
     */
    getConnections() {
        return this.connections;
    }

    /**
     * Clear all messages and connections
     */
    clear() {
        this.messages = [];
        this.connections = [];
    }
}

/**
 * Load RTCStats modules into page
 * @param {Page} page - Playwright page object
 * @param {Object} config - Configuration options
 * @returns {Object} Final configuration used
 */
export async function loadRTCStats(page, config = {}) {
    const defaultConfig = {
        endpoint: 'wss://mock-rtcstats-server.test',
        pollInterval: 1000,
        useLegacy: false
    };

    const finalConfig = { ...defaultConfig,
        ...config };

    const rootDir = process.cwd();

    // Check if bundle exists, build if not
    const bundlePath = path.join(rootDir, 'tests/helpers/rtcstats-bundle.js');

    if (!fs.existsSync(bundlePath)) {
        throw new Error('RTCStats bundle not found. Run "npm run build:test" first.');
    }

    // Load the bundled code
    const bundleCode = fs.readFileSync(bundlePath, 'utf8');

    // Inject the bundle into the page
    await page.evaluate(bundleCode);

    // Initialize rtcstats with our configuration
    await page.evaluate(rtcConfig => {
        // Validate that the bundle loaded correctly
        if (!window.RTCStatsBundle) {
            throw new Error('RTCStats bundle failed to load');
        }

        const { traceInit, rtcstatsInit, obfuscator, constants, events } = window.RTCStatsBundle;

        if (!traceInit || !rtcstatsInit) {
            throw new Error('Required functions not found in RTCStats bundle');
        }

        // Expose functions globally for backward compatibility with existing tests
        window.traceInit = traceInit;
        window.rtcstatsInit = rtcstatsInit;
        window.obfuscator = obfuscator;

        // Expose constants and events globally
        if (constants) {
            Object.keys(constants).forEach(key => {
                window[key] = constants[key];
            });
        }

        if (events) {
            Object.keys(events).forEach(key => {
                window[key] = events[key];
            });
        }

        window.rtcstatsConfig = rtcConfig;

        // Initialize trace-ws which returns the trace function
        const trace = traceInit({
            endpoint: rtcConfig.endpoint,
            meetingFqn: 'test-meeting',
            onCloseCallback: event => {
                console.log('WebSocket closed:', event);
            },
            useLegacy: rtcConfig.useLegacy,
            obfuscate: false // Disable obfuscation for testing
        });

        window.trace = trace;

        // Connect the WebSocket
        trace.connect();

        // Debug logging for verification
        console.log('navigator.mediaDevices exists?', Boolean(navigator.mediaDevices));
        console.log('getUserMedia exists?', Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));

        // Initialize rtcstats with trace and config
        console.log('Calling rtcstatsInit...');
        const result = rtcstatsInit(
            { statsEntry: trace.statsEntry },
            {
                pollInterval: rtcConfig.pollInterval,
                prefixesToWrap: [ '' ], // Only wrap the standard prefix for now
                useLegacy: rtcConfig.useLegacy
            }
        );

        console.log('rtcstatsInit returned:', result);

        // Verify APIs were wrapped
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const isWrapped = !navigator.mediaDevices.getUserMedia.toString().includes('[native code]');

            console.log('getUserMedia wrapped?', isWrapped);

            if (!isWrapped) {
                console.warn('getUserMedia was not wrapped - rtcstats may not be monitoring properly');
            }
        }
    }, finalConfig);

    return finalConfig;
}

/**
 * Wait for a specific number of messages
 * @param {MockWebSocketServer} mockWS - Mock WebSocket server instance
 * @param {number} count - Number of messages to wait for
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise} Promise that resolves with messages
 */
export function waitForMessages(mockWS, count, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const checkMessages = () => {
            if (mockWS.getMessages().length >= count) {
                resolve(mockWS.getMessages());
            } else if (Date.now() - startTime > timeout) {
                reject(new Error(`Timeout waiting for ${count} messages, got ${mockWS.getMessages().length}`));
            } else {
                setTimeout(checkMessages, 100);
            }
        };

        checkMessages();
    });
}

/**
 * Parse a stats message from the WebSocket
 * Handles the double-encoded JSON format from RTCStats bundle
 * @param {Object} message - Raw WebSocket message with {data: string}
 * @returns {Array|null} Parsed data array [eventName, id, payload, timestamp, sequence] or null
 * @throws {Error} If message.data exists but contains invalid JSON
 */
export function parseStatsMessage(message) {
    if (!message || !message.data) {
        return null;
    }

    // Parse outer JSON - let it throw if invalid
    const msg = JSON.parse(message.data);

    if (msg && msg.type === 'stats-entry' && msg.data) {
        // Parse inner JSON - let it throw if invalid
        const parsedData = JSON.parse(msg.data);

        // Validate that it's an array with at least the event name
        if (Array.isArray(parsedData) && parsedData.length > 0) {
            return parsedData;
        }
    }

    return null;
}

/**
 * Find the first message matching any of the given event names
 * @param {Array} messages - Array of WebSocket messages
 * @param {...string} eventNames - Event names to match (e.g., 'getUserMedia', 'navigator.mediaDevices.getUserMedia')
 * @returns {Object|undefined} The first matching message or undefined
 * @throws {Error} If message parsing fails
 */
export function findMessageByEventName(messages, ...eventNames) {
    if (!Array.isArray(messages) || eventNames.length === 0) {
        return undefined;
    }

    return messages.find(m => {
        const data = parseStatsMessage(m);

        return data && eventNames.includes(data[0]);
    });
}

/**
 * Filter messages matching any of the given event names
 * @param {Array} messages - Array of WebSocket messages
 * @param {...string} eventNames - Event names to match
 * @returns {Array} Array of matching messages
 * @throws {Error} If message parsing fails
 */
export function filterMessagesByEventName(messages, ...eventNames) {
    if (!Array.isArray(messages) || eventNames.length === 0) {
        return [];
    }

    return messages.filter(m => {
        const data = parseStatsMessage(m);

        return data && eventNames.includes(data[0]);
    });
}

/**
 * Get the event data from a stats message
 * @param {Object} message - WebSocket message
 * @returns {Object|null} The event payload (third element of data array) or null
 * @throws {Error} If message parsing fails
 */
export function getEventPayload(message) {
    const data = parseStatsMessage(message);

    // Check that the data array has at least 3 elements (event, id, payload)
    return data && data.length > 2 ? data[2] : null;
}

