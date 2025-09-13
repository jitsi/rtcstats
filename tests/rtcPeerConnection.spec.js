/**
 * @fileoverview Tests for RTCPeerConnection API interception
 *
 * This test suite verifies that rtcstats properly intercepts and tracks:
 * - RTCPeerConnection constructor calls
 * - PeerConnection method calls (createOffer, setLocalDescription, etc.)
 * - ICE candidate events
 * - Connection state changes
 * - Legacy constraint parameters
 * - Data channel creation
 */

import { test, expect } from '@playwright/test';

import { MockWebSocketServer, loadRTCStats } from './helpers/test-utils.js';

test.describe('RTCPeerConnection interception', () => {
    let mockWS;

    test.beforeEach(async ({ page }) => {
        mockWS = new MockWebSocketServer();
        await mockWS.setup(page);
    });

    /**
     * Test that RTCPeerConnection constructor is intercepted
     * and initial configuration is tracked
     */
    test('should intercept RTCPeerConnection constructor', async ({ page }) => {
        await loadRTCStats(page);

        const pcInfo = await page.evaluate(() => {
            const config = {
                iceServers: [ { urls: 'stun:stun.l.google.com:19302' } ]
            };
            const pc = new RTCPeerConnection(config);

            return {
                isRTCPeerConnection: pc instanceof RTCPeerConnection,
                signalingState: pc.signalingState,
                iceConnectionState: pc.iceConnectionState
            };
        });

        expect(pcInfo.isRTCPeerConnection).toBe(true);
        expect(pcInfo.signalingState).toBe('stable');

        await page.waitForTimeout(100);

        const messages = mockWS.getMessages();
        const createMessages = messages.filter(m => {
            const parsed = JSON.parse(m.data);

            return parsed[0] === 'create';
        });

        expect(createMessages.length).toBe(1);
    });

    /**
     * Test that various RTCPeerConnection methods are tracked
     * including createOffer, createAnswer, setLocalDescription, and close
     */
    test('should track RTCPeerConnection methods', async ({ page }) => {
        await loadRTCStats(page);

        await page.evaluate(async () => {
            const pc = new RTCPeerConnection();

            const offer = await pc.createOffer();

            await pc.setLocalDescription(offer);

            const answer = await pc.createAnswer();

            await pc.setLocalDescription(answer);

            pc.close();
        });

        await page.waitForTimeout(200);

        const messages = mockWS.getMessages();
        const methodCalls = messages.map(m => JSON.parse(m.data)[0]);

        expect(methodCalls).toContain('create');
        expect(methodCalls).toContain('createOffer');
        expect(methodCalls).toContain('setLocalDescription');
        expect(methodCalls).toContain('close');
    });

    /**
     * Test that ICE candidate events are properly intercepted
     * and traced to the WebSocket
     */
    test('should track ice candidates', async ({ page }) => {
        await loadRTCStats(page);

        const candidateAdded = await page.evaluate(async () => {
            const pc = new RTCPeerConnection({
                iceServers: [ { urls: 'stun:stun.l.google.com:19302' } ]
            });

            let candidateReceived = false;

            pc.onicecandidate = event => {
                if (event.candidate) {
                    candidateReceived = true;
                }
            };

            const offer = await pc.createOffer();

            await pc.setLocalDescription(offer);

            await new Promise(resolve => setTimeout(resolve, 1000));

            pc.close();

            return candidateReceived;
        });

        await page.waitForTimeout(100);

        const messages = mockWS.getMessages();
        const iceCandidateMessages = messages.filter(m => {
            const parsed = JSON.parse(m.data);

            return parsed[0] === 'onicecandidate' || parsed[0] === 'icecandidate';
        });

        if (candidateAdded) {
            expect(iceCandidateMessages.length).toBeGreaterThan(0);
        }
    });

    /**
     * Test support for legacy Jitsi constraints passed as the second
     * parameter to RTCPeerConnection (rtcStatsClientId, rtcStatsPeerId, etc.)
     */
    test('should support legacy constraints', async ({ page }) => {
        await loadRTCStats(page);

        await page.evaluate(() => {
            const pc = new RTCPeerConnection(
                { iceServers: [] },
                {
                    optional: [
                        { rtcStatsClientId: 'test-client-123' },
                        { rtcStatsPeerId: 'peer-456' },
                        { rtcStatsConferenceId: 'conference-789' }
                    ]
                }
            );

            pc.close();
        });

        await page.waitForTimeout(100);

        const messages = mockWS.getMessages();
        const createMessage = messages.find(m => {
            const parsed = JSON.parse(m.data);

            return parsed[0] === 'create';
        });

        expect(createMessage).toBeTruthy();
        const parsed = JSON.parse(createMessage.data);

        expect(parsed[2]).toMatchObject({
            optional: expect.arrayContaining([
                { rtcStatsClientId: 'test-client-123' },
                { rtcStatsPeerId: 'peer-456' },
                { rtcStatsConferenceId: 'conference-789' }
            ])
        });
    });

    /**
     * Test that connection state change events are tracked
     * when establishing a peer-to-peer connection
     */
    test('should track connection state changes', async ({ page }) => {
        await loadRTCStats(page);

        await page.evaluate(async () => {
            window.pc1 = new RTCPeerConnection();
            window.pc2 = new RTCPeerConnection();

            window.pc1.createDataChannel('test');

            window.pc1.onicecandidate = e => {
                if (e.candidate) {
                    window.pc2.addIceCandidate(e.candidate);
                }
            };
            window.pc2.onicecandidate = e => {
                if (e.candidate) {
                    window.pc1.addIceCandidate(e.candidate);
                }
            };

            const offer = await window.pc1.createOffer();

            await window.pc1.setLocalDescription(offer);
            await window.pc2.setRemoteDescription(offer);

            const answer = await window.pc2.createAnswer();

            await window.pc2.setLocalDescription(answer);
            await window.pc1.setRemoteDescription(answer);
        });

        await page.waitForTimeout(500);

        const messages = mockWS.getMessages();
        const stateChanges = messages.filter(m => {
            const parsed = JSON.parse(m.data);

            return parsed[0].includes('statechange');
        });

        expect(stateChanges.length).toBeGreaterThan(0);
    });
});

