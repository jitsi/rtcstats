# RTCStats Test Guidelines

## Critical Information

### WebSocket Mock Requirements
- Mock must send initial sequence number: `{type: 'sn', body: {value: 0, state: 'initial'}}`
- Messages are double-JSON encoded: `{type: 'stats-entry', data: JSON.stringify([...])}`
- Must call `trace.connect()` after initialization
- Use `loadRTCStats(page, mockWS)` to load the bundled rtcstats

### Test Patterns
```javascript

```

## Commands
```bash
npm run build:test    # Build rtcstats bundle for tests
npm test              # Run all tests
npx playwright test tests/getUserMedia.spec.js --project=chromium
npx playwright test --debug  # Debug mode
```

## Key Files
- `test-utils.js` - MockWebSocketServer and loadRTCStats
- `rtcstats-bundle.js` - Generated bundle (run build:test first)
- Test specs: getUserMedia, rtcPeerConnection, stats, websocket

## Best Practices
1. One behavior per test - Keep tests focused
2. No timeouts - Avoid flaky time-dependent behavior  
3. Verify message contents - Don't just count messages
4. Properly log tests, log results, errors and intermediate results
5. Properly document and comment test
6. Check lint and fix it once done doing an iteration
7. Don't swallow errors, let them propagate so we know something went wrong

## Common Issues
- "No messages received" → Check WebSocket sends sequence number, trace.connect() called
- "Cannot parse message" → Remember double JSON decoding
