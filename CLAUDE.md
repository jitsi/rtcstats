# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RTCStats is a JavaScript client library for gathering WebRTC API traces and statistics. It's a Jitsi fork of the original rtcstats project, designed to integrate with jitsi-meet. The library intercepts WebRTC API calls (getUserMedia, RTCPeerConnection) and sends telemetry data to an rtcstats-server via WebSocket.

## Key Commands

```bash
# Lint the code
npm run lint

# Install dependencies
npm install
```

## Architecture

### Core Components

1. **rtcstats.js** - Main module that:
   - Overwrites native WebRTC APIs (getUserMedia, getDisplayMedia, RTCPeerConnection)
   - Hooks into RTCPeerConnection events and methods
   - Periodically calls getStats() and sends results
   - Applies delta compression to reduce data size

2. **trace-ws.js** - WebSocket transport layer that:
   - Manages connection to rtcstats-server
   - Handles reconnection logic with exponential backoff
   - Buffers messages when disconnected (up to 1000 messages)
   - Sends keep-alive pings every 30 seconds
   - Manages stats session IDs

3. **obfuscator.js** - Privacy protection that:
   - Masks IP addresses in candidates and stats
   - Preserves TURN relay addresses for debugging
   - Maintains address family information

4. **constants.js** - Shared configuration values

5. **events.js** - WebRTC event type definitions

### Integration Flow

1. Initialize trace channel: `traceInit(endpoint, handleClose)`
2. Initialize rtcstats: `rtcstatsInit(trace, pollInterval, prefixes, filter)`
3. RTCStats must be initialized BEFORE any WebRTC API usage or references are created

### Data Collection

The library tracks:
- getUserMedia/getDisplayMedia calls and outcomes
- RTCPeerConnection lifecycle (constructor params, events, method calls)
- Periodic getStats() snapshots
- Session identifiers (client, peer, conference) via legacy constraints

### Important Design Decisions

- ES6 modules only - relies on jitsi-meet for bundling/transpiling
- Delta compression reduces stats payload by ~90%
- Automatic reconnection with exponential backoff up to 10 minutes
- Messages buffered during disconnection (max 1000)
- IP addresses obfuscated for privacy (except TURN servers)

## Guidelines
- Make sure linting rules are followed when applying changes