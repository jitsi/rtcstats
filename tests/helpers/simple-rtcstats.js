/**
 * @fileoverview Simplified RTCStats implementation for testing
 *
 * This module provides a lightweight version of rtcstats that directly
 * wraps WebRTC APIs without the complex module loading and bundling.
 * Used for testing basic interception functionality.
 */

/**
 * Initialize simplified RTCStats wrappers
 * This directly wraps WebRTC APIs without the complex module loading
 * @param {Function} trace - Trace function to send events
 */
export function initSimpleRTCStats(trace) {
    // Wrap RTCPeerConnection
    const OrigRTC = window.RTCPeerConnection;
    let pcCounter = 0;

    window.RTCPeerConnection = function(config, constraints) {
        const pc = new OrigRTC(config, constraints);
        const id = `PC_${pcCounter++}`;

        pc.__rtcStatsId = id;

        trace('create', id, config);

        pc.addEventListener('icecandidate', e => {
            trace('onicecandidate', id, e.candidate);
        });

        pc.addEventListener('track', e => {
            trace('ontrack', id, `${e.track.kind}:${e.track.id}`);
        });

        return pc;
    };

    window.RTCPeerConnection.prototype = OrigRTC.prototype;

    // Wrap getUserMedia
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

        navigator.mediaDevices.getUserMedia = function(constraints) {
            trace('navigator.mediaDevices.getUserMedia', null, constraints);

            return origGetUserMedia(constraints).then(
                stream => {
                    trace('navigator.mediaDevices.getUserMediaOnSuccess', null, {
                        id: stream.id,
                        tracks: stream.getTracks().map(t => {
                            return { kind: t.kind,
                                id: t.id };
                        })
                    });

                    return stream;
                },
                err => {
                    trace('navigator.mediaDevices.getUserMediaOnFailure', null, err.name);

                    return Promise.reject(err);
                }
            );
        };
    }

    // Wrap getDisplayMedia
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        const origGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);

        navigator.mediaDevices.getDisplayMedia = function(constraints) {
            trace('getDisplayMedia', null, constraints);

            return origGetDisplayMedia(constraints).then(
                stream => {
                    trace('getDisplayMediaOnSuccess', null, {
                        id: stream.id,
                        tracks: stream.getTracks().map(t => {
                            return { kind: t.kind,
                                id: t.id };
                        })
                    });

                    return stream;
                },
                err => {
                    trace('getDisplayMediaOnFailure', null, err.name);

                    return Promise.reject(err);
                }
            );
        };
    }
}

/**
 * Load simple RTCStats into page for testing
 * @param {Page} page - Playwright page object
 * @param {Object} config - Configuration options
 * @returns {Object} Final configuration used
 */
export async function loadSimpleRTCStats(page, config = {}) {
    const defaultConfig = {
        endpoint: 'wss://mock-rtcstats-server.test',
        pollInterval: 1000,
        useLegacy: false
    };

    const finalConfig = { ...defaultConfig,
        ...config };

    // Define the init function in the page
    await page.evaluate(initFunc => {
        // eslint-disable-next-line no-eval
        eval(`window.initSimpleRTCStats = ${initFunc}`);
    }, initSimpleRTCStats.toString());

    // Initialize with trace function that sends to WebSocket
    await page.evaluate(rtcConfig => {
        window.rtcstatsConfig = rtcConfig;

        // Create trace function that sends to our mock WebSocket
        window.trace = function(event, label, data) {
            // Use the mocked WebSocket
            const ws = new WebSocket(rtcConfig.endpoint);

            // Wait for the mock WebSocket to be ready
            const waitForOpen = () => {
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify([ event, label, data ]));
                } else {
                    setTimeout(waitForOpen, 5);
                }
            };

            waitForOpen();
        };

        // Initialize the simple RTCStats
        window.initSimpleRTCStats(window.trace);
    }, finalConfig);

    return finalConfig;
}
