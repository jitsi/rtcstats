/**
 * @fileoverview Tests for WebRTC statistics collection and compression
 *
 * This test suite verifies:
 * - Periodic getStats() collection at configured intervals
 * - Delta compression for reducing stats payload size
 * - Multiple peer connection tracking
 * - Data channel creation tracking
 * - Track management (addTrack/removeTrack)
 * - IP address obfuscation for privacy
 */

import { test, expect } from '@playwright/test';

import { MockWebSocketServer, loadRTCStats } from './helpers/test-utils.js';

test.describe('Stats collection and compression', () => {
    let mockWS;

    test.beforeEach(async ({ page }) => {
        mockWS = new MockWebSocketServer();
        await mockWS.setup(page);
    });

    /**
     * Test that getStats() is called periodically at the configured interval
     * and results are sent via WebSocket
     */
    test('should collect periodic getStats', async ({ page }) => {
        await loadRTCStats(page, { pollInterval: 500 });

        await page.evaluate(async () => {
            const pc = new RTCPeerConnection();

            pc.createDataChannel('test');

            const offer = await pc.createOffer();

            await pc.setLocalDescription(offer);

            window.testPc = pc;
        });

        await page.waitForTimeout(1500);

        const messages = mockWS.getMessages();
        const statsMessages = messages.filter(m => {
            const parsed = JSON.parse(m.data);

            return parsed[0] === 'getStats';
        });

        expect(statsMessages.length).toBeGreaterThanOrEqual(2);
    });

    /**
     * Test that delta compression reduces the size of subsequent stats messages
     * by only sending changed values after the initial snapshot
     */
    test('should apply delta compression to stats', async ({ page }) => {
        await loadRTCStats(page, { pollInterval: 300 });

        await page.evaluate(async () => {
            window.pc = new RTCPeerConnection();
            await window.pc.createOffer();
        });

        await page.waitForTimeout(1000);

        const messages = mockWS.getMessages();
        const statsMessages = messages.filter(m => {
            const parsed = JSON.parse(m.data);

            return parsed[0] === 'getStats';
        });

        if (statsMessages.length >= 2) {
            const firstStats = JSON.parse(statsMessages[0].data)[2];
            const secondStats = JSON.parse(statsMessages[1].data)[2];

            const firstSize = JSON.stringify(firstStats).length;
            const secondSize = JSON.stringify(secondStats).length;

            expect(secondSize).toBeLessThan(firstSize);
        }
    });

    /**
     * Test that multiple RTCPeerConnection instances are tracked independently
     * with separate create messages for each
     */
    test('should handle multiple peer connections', async ({ page }) => {
        await loadRTCStats(page);

        await page.evaluate(async () => {
            const pc1 = new RTCPeerConnection();
            const pc2 = new RTCPeerConnection();
            const pc3 = new RTCPeerConnection();

            const ids = [ pc1, pc2, pc3 ].map(pc => pc.toString());

            pc1.close();
            pc2.close();
            pc3.close();

            return ids;
        });

        await page.waitForTimeout(200);

        const messages = mockWS.getMessages();
        const createMessages = messages.filter(m => {
            const parsed = JSON.parse(m.data);

            return parsed[0] === 'create';
        });

        expect(createMessages.length).toBe(3);
    });

    /**
     * Test that createDataChannel calls are intercepted and tracked
     * with channel name and configuration
     */
    test('should track data channel creation', async ({ page }) => {
        await loadRTCStats(page);

        await page.evaluate(() => {
            const pc = new RTCPeerConnection();

            pc.createDataChannel('chat', { ordered: true });
            pc.createDataChannel('file-transfer', { ordered: false });

            pc.close();
        });

        await page.waitForTimeout(100);

        const messages = mockWS.getMessages();
        const dcMessages = messages.filter(m => {
            const parsed = JSON.parse(m.data);

            return parsed[0] === 'createDataChannel';
        });

        expect(dcMessages.length).toBe(2);

        const firstDc = JSON.parse(dcMessages[0].data);

        expect(firstDc[2]).toBe('chat');

        const secondDc = JSON.parse(dcMessages[1].data);

        expect(secondDc[2]).toBe('file-transfer');
    });

    /**
     * Test that addTrack and removeTrack methods are properly intercepted
     * when managing media tracks on a peer connection
     */
    test('should capture addTrack and removeTrack', async ({ page, context }) => {
        await context.grantPermissions([ 'camera', 'microphone' ]);
        await loadRTCStats(page);

        await page.evaluate(async () => {
            const pc = new RTCPeerConnection();
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            const tracks = stream.getTracks();
            const senders = [];

            for (const track of tracks) {
                const sender = pc.addTrack(track, stream);

                senders.push(sender);
            }

            await new Promise(resolve => setTimeout(resolve, 100));

            for (const sender of senders) {
                pc.removeTrack(sender);
            }

            pc.close();
            stream.getTracks().forEach(track => track.stop());
        });

        await page.waitForTimeout(200);

        const messages = mockWS.getMessages();

        const addTrackMessages = messages.filter(m => {
            const parsed = JSON.parse(m.data);

            return parsed[0] === 'addTrack';
        });

        const removeTrackMessages = messages.filter(m => {
            const parsed = JSON.parse(m.data);

            return parsed[0] === 'removeTrack';
        });

        expect(addTrackMessages.length).toBe(2);
        expect(removeTrackMessages.length).toBe(2);
    });

    /**
     * Test that IP addresses in ICE candidates are properly obfuscated
     * for privacy while preserving address family information
     */
    test('should obfuscate IP addresses', async ({ page }) => {
        await loadRTCStats(page);

        const obfuscationResults = await page.evaluate(() => {
            const ipv4 = window.obfuscator.obfuscateCandidate(
                'candidate:1 1 UDP 2122194687 192.168.1.100 54321 typ host'
            );

            const ipv6 = window.obfuscator.obfuscateCandidate(
                'candidate:1 1 UDP 2122194687 2001:db8::8a2e:370:7334 54321 typ host'
            );

            return { ipv4,
                ipv6 };
        });

        expect(obfuscationResults.ipv4).toContain('192.168.1.x');
        expect(obfuscationResults.ipv6).toContain('2001:db8:0:x:x:x:x:x');
    });
});

