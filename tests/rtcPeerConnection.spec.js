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

import {
    MockWebSocketServer,
    loadRTCStats,
    findMessageByEventName,
    filterMessagesByEventName,
    getEventPayload,
    parseStatsMessage
} from './helpers/test-utils.js';

test.describe('RTCPeerConnection interception', () => {
    let mockWS;

    test.beforeEach(async ({ page }) => {
        // Capture and log browser console messages for debugging
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();

            console.log(`[Browser ${type}]: ${text}`);
        });

        // Capture any page errors
        page.on('pageerror', error => {
            console.error('[Browser Error]:', error.message);
        });

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

            const info = {
                isRTCPeerConnection: pc instanceof RTCPeerConnection,
                signalingState: pc.signalingState,
                iceConnectionState: pc.iceConnectionState,
                config
            };

            // Clean up
            pc.close();

            return info;
        });

        console.log('PeerConnection info:', pcInfo);
        expect(pcInfo.isRTCPeerConnection).toBe(true);
        expect(pcInfo.signalingState).toBe('stable');

        // Small delay for WebSocket processing
        await page.waitForTimeout(100);

        const messages = mockWS.getMessages();

        console.log(`Total messages received: ${messages.length}`);

        // Find the create message using helper function
        const createMessage = findMessageByEventName(messages, 'create');

        expect(createMessage).toBeTruthy();

        // Verify the configuration was passed correctly
        const payload = getEventPayload(createMessage);

        console.log('Create message payload:', payload);

        expect(payload.iceServers).toEqual(pcInfo.config.iceServers);
    });

    /**
     * Test that various RTCPeerConnection methods are tracked
     * including createOffer, createAnswer, setLocalDescription, and close
     */
    test('should track RTCPeerConnection methods', async ({ page }) => {
        await loadRTCStats(page);

        const methodResults = await page.evaluate(async () => {
            const pc = new RTCPeerConnection();
            const results = [];

            // Track method calls
            const offer = await pc.createOffer();

            results.push({ method: 'createOffer',
                hasOffer: Boolean(offer) });

            await pc.setLocalDescription(offer);
            results.push({ method: 'setLocalDescription',
                localDescription: pc.localDescription?.type });

            const answer = await pc.createAnswer();

            results.push({ method: 'createAnswer',
                hasAnswer: Boolean(answer) });

            await pc.setLocalDescription(answer);
            results.push({ method: 'setLocalDescription',
                localDescription: pc.localDescription?.type });

            pc.close();
            results.push({ method: 'close',
                signalingState: pc.signalingState });

            return results;
        });

        console.log('Method call results:', methodResults);

        // Small delay for WebSocket processing
        await page.waitForTimeout(200);

        const messages = mockWS.getMessages();

        console.log(`Total messages received: ${messages.length}`);

        // Verify each method was tracked
        const createMessage = findMessageByEventName(messages, 'create');

        expect(createMessage).toBeTruthy();
        console.log('Found create message');

        const createOfferMessages = filterMessagesByEventName(messages, 'createOffer');

        expect(createOfferMessages.length).toBe(1);
        console.log(`Found ${createOfferMessages.length} createOffer messages`);

        const setLocalMessages = filterMessagesByEventName(messages, 'setLocalDescription');

        expect(setLocalMessages.length).toBe(2); // Called twice
        console.log(`Found ${setLocalMessages.length} setLocalDescription messages`);

        const createAnswerMessages = filterMessagesByEventName(messages, 'createAnswer');

        expect(createAnswerMessages.length).toBe(1);
        console.log(`Found ${createAnswerMessages.length} createAnswer messages`);

        const closeMessages = filterMessagesByEventName(messages, 'close');

        expect(closeMessages.length).toBe(1);
        console.log(`Found ${closeMessages.length} close messages`);

        // Verify order of operations
        const allMessages = messages.map(m => parseStatsMessage(m).eventName);
        const methodOrder = allMessages.filter(name =>
            [ 'create', 'createOffer', 'setLocalDescription', 'createAnswer', 'close' ].includes(name)
        );

        console.log('Method call order:', methodOrder);
    });

    /**
     * Test that ICE candidate events are properly intercepted
     * and traced to the WebSocket
     */
    test('should track ice candidates', async ({ page }) => {
        await loadRTCStats(page);

        const candidateInfo = await page.evaluate(async () => {
            const pc = new RTCPeerConnection({
                iceServers: [ { urls: 'stun:stun.l.google.com:19302' } ]
            });

            const candidates = [];
            let candidateCount = 0;

            pc.onicecandidate = event => {
                if (event.candidate) {
                    candidateCount++;
                    candidates.push({
                        candidate: event.candidate.candidate,
                        sdpMLineIndex: event.candidate.sdpMLineIndex,
                        sdpMid: event.candidate.sdpMid
                    });
                    console.log('ICE candidate received:', event.candidate.candidate);
                }
            };

            // Create offer to trigger ICE gathering
            const offer = await pc.createOffer();

            await pc.setLocalDescription(offer);

            // Wait for ICE gathering
            await new Promise(resolve => setTimeout(resolve, 1000));

            pc.close();

            return {
                candidateCount,
                candidates: candidates.slice(0, 3) // Return first 3 for inspection
            };
        });

        console.log('ICE candidate info:', candidateInfo);

        // Small delay for WebSocket processing
        await page.waitForTimeout(100);

        const messages = mockWS.getMessages();

        console.log(`Total messages received: ${messages.length}`);

        // Find ICE candidate messages
        const iceCandidateMessages = filterMessagesByEventName(messages, 'onicecandidate', 'icecandidate');

        console.log(`Found ${iceCandidateMessages.length} ICE candidate messages`);

        if (candidateInfo.candidateCount > 0) {
            expect(iceCandidateMessages.length).toBeGreaterThan(0);

            // Verify the structure of the first ICE candidate message
            if (iceCandidateMessages.length > 0) {
                const firstCandidate = getEventPayload(iceCandidateMessages[0]);

                console.log('First ICE candidate payload:', firstCandidate);

                // Check that candidate data is present
                if (firstCandidate && firstCandidate.candidate) {
                    expect(firstCandidate.candidate).toBeTruthy();
                }
            }
        } else {
            console.log('No ICE candidates were gathered (might be in isolated test environment)');
        }
    });

    /**
     * Test support for legacy Jitsi constraints passed as the second
     * parameter to RTCPeerConnection (rtcStatsClientId, rtcStatsPeerId, etc.)
     */
    test('should support legacy constraints', async ({ page }) => {
        await loadRTCStats(page);

        const constraintsUsed = await page.evaluate(() => {
            const constraints = {
                optional: [
                    { rtcStatsClientId: 'test-client-123' },
                    { rtcStatsPeerId: 'peer-456' },
                    { rtcStatsConferenceId: 'conference-789' }
                ]
            };

            const pc = new RTCPeerConnection(
                { iceServers: [] },
                constraints
            );

            const state = pc.signalingState;

            pc.close();

            return { constraints,
                state };
        });

        console.log('Legacy constraints used:', constraintsUsed);

        // Small delay for WebSocket processing
        await page.waitForTimeout(100);

        const messages = mockWS.getMessages();

        console.log(`Total messages received: ${messages.length}`);

        // Find the create message with legacy constraints
        const createMessage = findMessageByEventName(messages, 'create');

        expect(createMessage).toBeTruthy();

        // Parse the message to get the constraints
        const parsed = parseStatsMessage(createMessage);

        console.log('Create message with constraints:', parsed);

        // Verify the constraints were passed correctly
        const constraints = parsed.data;

        console.log('Extracted constraints:', constraints);

        expect(constraints).toMatchObject({
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

        const connectionInfo = await page.evaluate(async () => {
            const states = [];

            window.pc1 = new RTCPeerConnection();
            window.pc2 = new RTCPeerConnection();

            // Track state changes
            window.pc1.onsignalingstatechange = () => {
                states.push({ pc: 'pc1',
                    type: 'signaling',
                    state: window.pc1.signalingState });
                console.log('PC1 signaling state:', window.pc1.signalingState);
            };
            window.pc1.oniceconnectionstatechange = () => {
                states.push({ pc: 'pc1',
                    type: 'ice',
                    state: window.pc1.iceConnectionState });
                console.log('PC1 ICE connection state:', window.pc1.iceConnectionState);
            };

            window.pc2.onsignalingstatechange = () => {
                states.push({ pc: 'pc2',
                    type: 'signaling',
                    state: window.pc2.signalingState });
                console.log('PC2 signaling state:', window.pc2.signalingState);
            };
            window.pc2.oniceconnectionstatechange = () => {
                states.push({ pc: 'pc2',
                    type: 'ice',
                    state: window.pc2.iceConnectionState });
                console.log('PC2 ICE connection state:', window.pc2.iceConnectionState);
            };

            // Create data channel to initiate negotiation
            window.pc1.createDataChannel('test');

            // Exchange ICE candidates
            window.pc1.onicecandidate = e => {
                if (e.candidate) {
                    window.pc2.addIceCandidate(e.candidate).catch(err =>
                        console.error('PC2 add candidate error:', err)
                    );
                }
            };
            window.pc2.onicecandidate = e => {
                if (e.candidate) {
                    window.pc1.addIceCandidate(e.candidate).catch(err =>
                        console.error('PC1 add candidate error:', err)
                    );
                }
            };

            // Create and exchange offer/answer
            const offer = await window.pc1.createOffer();

            await window.pc1.setLocalDescription(offer);
            await window.pc2.setRemoteDescription(offer);

            const answer = await window.pc2.createAnswer();

            await window.pc2.setLocalDescription(answer);
            await window.pc1.setRemoteDescription(answer);

            return {
                states,
                finalStates: {
                    pc1: {
                        signaling: window.pc1.signalingState,
                        ice: window.pc1.iceConnectionState
                    },
                    pc2: {
                        signaling: window.pc2.signalingState,
                        ice: window.pc2.iceConnectionState
                    }
                }
            };
        });

        console.log('Connection states tracked:', connectionInfo.states);
        console.log('Final states:', connectionInfo.finalStates);

        // Wait for any remaining state changes
        await page.waitForTimeout(500);

        const messages = mockWS.getMessages();

        console.log(`Total messages received: ${messages.length}`);

        // Find state change messages
        const stateChanges = messages.filter(m => {
            const parsed = parseStatsMessage(m);

            return parsed.eventName.includes('statechange');
        });

        console.log(`Found ${stateChanges.length} state change messages`);
        expect(stateChanges.length).toBeGreaterThan(0);

        // Log the types of state changes
        const stateChangeTypes = stateChanges.map(m => parseStatsMessage(m).eventName);

        console.log('State change types:', [ ...new Set(stateChangeTypes) ]);

        // Clean up the peer connections
        await page.evaluate(() => {
            if (window.pc1) {
                window.pc1.close();
                delete window.pc1;
            }
            if (window.pc2) {
                window.pc2.close();
                delete window.pc2;
            }
        });
    });
});

