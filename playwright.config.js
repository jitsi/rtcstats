/* global process */
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    outputDir: './test-output/results',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [ [ 'list', { outputFolder: './test-output/report' } ] ],
    use: {
        trace: 'on-first-retry',
        video: 'retain-on-failure',
        screenshot: 'only-on-failure'
    },

    projects: [
        {
            name: 'chromium',
            use: {
                permissions: [ 'camera', 'microphone' ],
                launchOptions: {
                    args: [
                        '--use-fake-device-for-media-stream',
                        '--use-fake-ui-for-media-stream'
                    ]
                }
            }
        },
        {
            name: 'firefox',
            use: {
                permissions: [ 'camera', 'microphone' ],
                launchOptions: {
                    args: [
                        '--use-fake-device-for-media-stream',
                        '--use-fake-ui-for-media-stream'
                    ]
                }
            }
        },
        {
            name: 'webkit',
            use: {
                permissions: [ 'camera', 'microphone' ],
                launchOptions: {
                    args: [
                        '--use-fake-device-for-media-stream',
                        '--use-fake-ui-for-media-stream'
                    ]
                }
            }
        }
    ]
});
