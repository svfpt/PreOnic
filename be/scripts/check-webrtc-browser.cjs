// Local-only WebRTC smoke test using fake camera/microphone devices. No account or real device is accessed.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const browser = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const source = fs.readFileSync(path.resolve(__dirname, '../../fe/src/services/video-call-controller.js'), 'utf8')
  .replace(/^import videoCallService from .*;\r?\n/m, 'const videoCallService = {};\n')
  .replace('export const emptyVideoCallState', 'const emptyVideoCallState')
  .replace('export default class VideoCallController', 'class VideoCallController');
const harness = `
let stored;
const copy = value => value ? JSON.parse(JSON.stringify(value)) : null;
const services = {
  config: async () => ({ iceServers: [], turnConfigured: false }),
  start: async (conversationId, sessionId) => copy(stored = { _id: 'test-call', conversationId, state: 'ringing',
    caller: { _id: 'buyer', fullName: 'Buyer' }, callee: { _id: 'seller', fullName: 'Seller' }, callerSessionId: sessionId, signals: [] }),
  current: async () => stored?.state !== 'ended' ? copy(stored) : null,
  get: async () => copy(stored),
  accept: async (_id, sessionId) => copy(stored = { ...stored, state: 'active', calleeSessionId: sessionId }),
  signal: async (_id, sessionId, kind, payload) => { stored.signals.push({ sessionId, kind, payload: copy(payload) }); },
  end: async () => { stored.state = 'ended'; }, heartbeat: async () => {}, endOnUnload: () => {},
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const buyer = new VideoCallController({ userId: 'buyer', sessionId: 'buyer-browser-session', service: services, onChange: () => {} });
  const seller = new VideoCallController({ userId: 'seller', sessionId: 'seller-browser-session', service: services, onChange: () => {} });
  try {
    await buyer.start('test-conversation', 'Seller');
    if (!buyer.state.call) throw new Error('Caller setup failed: ' + buyer.state.error);
    await seller.sync();
    if (seller.state.phase !== 'incoming' || seller.state.localStream) throw new Error('Unexpected incoming permission behavior');
    await seller.accept();
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline && !(buyer.state.phase === 'connected' && seller.state.phase === 'connected' && buyer.state.remoteStream && seller.state.remoteStream)) {
      await buyer.sync(); await seller.sync(); await wait(100);
    }
    if (buyer.state.phase !== 'connected' || seller.state.phase !== 'connected') throw new Error('Peer connection did not complete');
    const peers = [buyer.peer, seller.peer];
    const localTracks = [...buyer.state.localStream.getTracks(), ...seller.state.localStream.getTracks()];
    const videos = [buyer, seller].map(controller => {
      const video = document.createElement('video'); video.autoplay = true; video.muted = true; video.playsInline = true;
      video.srcObject = controller.state.remoteStream; document.body.appendChild(video); return video;
    });
    await Promise.all(videos.map(video => video.play()));
    while (Date.now() < deadline && videos.some(video => !video.videoWidth)) await wait(100);
    if (videos.some(video => !video.videoWidth)) throw new Error('Remote video frames were not received');
    const media = [buyer, seller].map(controller => ({ audio: controller.state.remoteStream.getAudioTracks().length,
      video: controller.state.remoteStream.getVideoTracks().length }));
    buyer.toggleMic(); buyer.toggleCamera();
    const controls = !buyer.state.localStream.getAudioTracks()[0].enabled && !buyer.state.localStream.getVideoTracks()[0].enabled;
    if (!controls) throw new Error('Media controls failed');
    const frames = videos.map(video => ({ width: video.videoWidth, height: video.videoHeight }));
    await buyer.end(); await seller.sync();
    const cleanup = localTracks.every(track => track.readyState === 'ended') && peers.every(peer => peer.connectionState === 'closed');
    if (!cleanup) throw new Error('Media cleanup failed');
    globalThis.browserResult = { ok: true, peerConnections: 2, remoteMedia: media, remoteFrames: frames, controls, cleanup };
  } finally { buyer.dispose(); seller.dispose(); }
})().catch(error => { globalThis.browserResult = { ok: false, error: error.message }; });
`;

let child;
let server;
let socket;
let profile;
const pending = new Map();
let commandId = 0;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++commandId;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Browser command timed out: ' + method)); }, 10000);
    pending.set(id, { resolve: result => { clearTimeout(timeout); resolve(result); }, reject });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
(async () => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'preonic-webrtc-'));
  server = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><html><body><script>' + source + '\n' + harness + '</script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  child = spawn(browser, ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((resolve, reject) => {
    let buffer = '';
    const timeout = setTimeout(() => reject(new Error('Browser did not start')), 10000);
    child.on('error', reject);
    child.stderr.on('data', chunk => {
      buffer += chunk.toString();
      const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(buffer);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const request = pending.get(data.id); pending.delete(data.id);
      data.error ? request.reject(new Error(data.error.message)) : request.resolve(data.result);
    }
  };
  const target = await command('Target.createTarget', { url: `http://127.0.0.1:${server.address().port}` });
  const { sessionId } = await command('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const deadline = Date.now() + 35000;
  let result;
  while (Date.now() < deadline) {
    const evaluated = await command('Runtime.evaluate', { expression: 'globalThis.browserResult', returnByValue: true }, sessionId);
    result = evaluated.result?.value;
    if (result) break;
    await delay(400);
  }
  if (!result) throw new Error('WebRTC browser check timed out');
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
})().catch(error => { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; })
.finally(async () => {
  if (socket?.readyState === 1) {
    socket.close();
  }
  if (child) {
    child.kill();
    await delay(500);
  }
  if (server) await new Promise(resolve => server.close(resolve));
  if (profile) {
    const resolved = path.resolve(profile);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('preonic-webrtc-')) {
      fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
    }
  }
});
