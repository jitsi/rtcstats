/**
 * @fileoverview Entry point for Rollup bundling in test environment
 *
 * This file imports and re-exports all RTCStats modules for test usage.
 * Rollup will handle replacing Jitsi dependencies with mocks during bundling.
 */

// Import real RTCStats modules - Rollup will handle replacing Jitsi deps with mocks
import * as constants from '../../constants.js';
import * as events from '../../events.js';
import obfuscator from '../../obfuscator.js';
import rtcstatsInit from '../../rtcstats.js';
import traceInit from '../../trace-ws.js';

// Export everything for test usage
export {
    traceInit,
    rtcstatsInit,
    obfuscator,
    constants,
    events
};
