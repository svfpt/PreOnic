# Video calling

Video calling uses browser WebRTC media, with authenticated REST signaling stored in MongoDB and notifications over the existing messaging SSE stream. Polling recovers signaling notifications missed during reconnects. Only the two conversation members can access call state; SDP and ICE expire after one day and are not application log data.

## Deployment

- Serve the frontend over HTTPS. Camera/microphone capture also works on localhost during development.
- Set `WEBRTC_STUN_URLS` (comma separated). The default is Google's public STUN endpoint.
- For calls across restrictive NAT/firewalls, run a TURN server such as coturn. Set `WEBRTC_TURN_URLS` and `WEBRTC_TURN_SECRET` on the backend. The secret must match coturn's `static-auth-secret` with REST authentication enabled. Clients receive one-hour HMAC credentials; the secret is never returned.
- Expose the TURN server's configured TCP/UDP listening and relay port ranges through its firewall. Add a `turns:` endpoint when TLS relay is required. A STUN-only deployment cannot guarantee calls across different networks.

## Behavior

The caller grants camera/microphone permission before inviting the recipient. The recipient's camera/microphone are requested only after Accept. A database unique index reserves both users for one call, including simultaneous crossed calls. A specific browser session owns each side; another tab cannot accept twice or signal for the selected tab.

Unanswered calls expire after 45 seconds. Active calls use heartbeats and expire if a participant disappears for 45 seconds. Media connection setup times out after 30 seconds. Hangup, failed setup, logout, and page exit stop local tracks and close the peer connection. Calls remain mounted while navigating between app routes and can be minimized. Media is not recorded or routed through the application backend.

## Validation

Automated tests cover authorization, busy-user locking, session ownership, stale-call cleanup, signaling validation, temporary TURN credentials, permission denial, early ICE candidates, cancellation, and media cleanup. A real two-device test is still required before production rollout:

`node be/scripts/check-webrtc-browser.cjs` additionally checks two actual Chrome WebRTC peers on localhost using fake devices, verifies incoming audio/video tracks and received video frames, and verifies mic/camera toggles and track cleanup. It creates and removes its own temporary browser profile. Set `CHROME_PATH` if Chrome is installed at a different path. This test does not access real camera/microphone hardware or application accounts.

1. Log in to two accounts on two devices with cameras and microphones.
2. Use separate networks (for example home Wi-Fi and mobile data), call, accept, and confirm audio/video in both directions.
3. Test decline, no answer, mic/camera controls, page navigation, minimize, page close, and reconnects.
4. Test a restrictive network with TURN configured. Confirm relay usage via browser WebRTC diagnostics.

References: [MDN signaling and video calling](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling), [Google WebRTC codelab](https://developers.google.com/codelabs/webrtc-web), [coturn REST authentication](https://github.com/coturn/coturn/wiki/turnserver).
