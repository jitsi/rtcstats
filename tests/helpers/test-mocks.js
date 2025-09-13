/**
 * @fileoverview Mock modules for testing RTCStats
 *
 * These mocks replace Jitsi-specific dependencies in the test environment,
 * allowing rtcstats to be tested independently of the Jitsi codebase.
 */

/**
 * Mock BrowserDetection class for browser detection
 * Always returns Chrome/Chromium for consistent test results
 */
export class BrowserDetection {
    /**
     * Check if browser is Chrome
     * @returns {boolean} Always true for testing
     */
    isChrome() {
        return true;
    }

    /**
     * Check if browser is Firefox
     * @returns {boolean} Always false for testing
     */
    isFirefox() {
        return false;
    }

    /**
     * Check if browser is WebKit
     * @returns {boolean} Always false for testing
     */
    isWebKit() {
        return false;
    }

    /**
     * Check if browser is Chromium-based
     * @returns {boolean} Always true for testing
     */
    isChromiumBased() {
        return true;
    }

    /**
     * Check if browser is WebKit-based
     * @returns {boolean} Always false for testing
     */
    isWebKitBased() {
        return false;
    }

    /**
     * Check if running in React Native
     * @returns {boolean} Always false for testing
     */
    isReactNative() {
        return false;
    }
}

/**
 * Mock logger factory
 * Returns a logger with console log methods for debugging tests
 */
export function getLogger(name) {
    return {
        info: (...args) => console.log(`[${name}] INFO:`, ...args),
        warn: (...args) => console.warn(`[${name}] WARN:`, ...args),
        error: (...args) => console.error(`[${name}] ERROR:`, ...args),
        debug: (...args) => console.debug(`[${name}] DEBUG:`, ...args)
    };
}
