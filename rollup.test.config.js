import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
    input: 'tests/helpers/test-entry.js',
    output: {
        file: 'tests/helpers/rtcstats-bundle.js',
        format: 'iife',
        name: 'RTCStatsBundle',
        globals: {
            // External globals that should not be bundled
        }
    },
    plugins: [
        replace({
            preventAssignment: true,
            delimiters: ['', ''],
            values: {
                // Replace Jitsi module imports with local mocks
                "from '@jitsi/js-utils/browser-detection'": `from '${path.join(__dirname, 'tests/helpers/test-mocks.js')}'`,
                "from '@jitsi/logger'": `from '${path.join(__dirname, 'tests/helpers/test-mocks.js')}'`
            }
        }),
        resolve({
            browser: true,
            preferBuiltins: false
        }),
        commonjs()
    ],
    external: []
};