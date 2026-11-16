import VideoCallController from './video-call-controller';

const callerSession = 'caller-session-123';
const calleeSession = 'callee-session-123';
const baseCall = () => ({ _id: 'call', conversationId: 'chat', caller: { _id: 'buyer', fullName: 'Buyer' },
  callee: { _id: 'seller', fullName: 'Seller' }, callerSessionId: callerSession, state: 'ringing', signals: [] });
const stream = () => {
  const audio = { enabled: true, stop: jest.fn() };
  const video = { enabled: true, stop: jest.fn() };
  return { getTracks: () => [audio, video], getAudioTracks: () => [audio], getVideoTracks: () => [video] };
};
let controller;
let service;
let mediaDevices;
let peers;
let local;

beforeEach(() => {
  jest.useFakeTimers();
  peers = [];
  local = stream();
  mediaDevices = { getUserMedia: jest.fn().mockResolvedValue(local) };
  service = {
    config: jest.fn().mockResolvedValue({ iceServers: [{ urls: ['stun:example.com'] }], turnConfigured: false }),
    start: jest.fn().mockResolvedValue(baseCall()), current: jest.fn().mockResolvedValue(null), get: jest.fn(),
    accept: jest.fn(), end: jest.fn().mockResolvedValue({}), signal: jest.fn().mockResolvedValue({}),
    heartbeat: jest.fn().mockResolvedValue({}), endOnUnload: jest.fn(),
  };
});
afterEach(() => { controller?.dispose(); jest.useRealTimers(); });

function makeController(userId = 'buyer', sessionId = callerSession) {
  class Peer {
    constructor(config) {
      this.config = config;
      this.connectionState = 'new';
      this.remoteDescription = null;
      this.addTrack = jest.fn();
      this.createOffer = jest.fn().mockResolvedValue({ type: 'offer', sdp: 'local-offer' });
      this.createAnswer = jest.fn().mockResolvedValue({ type: 'answer', sdp: 'local-answer' });
      this.setLocalDescription = jest.fn(async description => { this.localDescription = description; });
      this.setRemoteDescription = jest.fn(async description => { this.remoteDescription = description; });
      this.addIceCandidate = jest.fn().mockResolvedValue();
      this.close = jest.fn(() => { this.connectionState = 'closed'; });
      peers.push(this);
    }
  }
  controller = new VideoCallController({ userId, sessionId, service, mediaDevices, PeerConnection: Peer, onChange: jest.fn() });
  return controller;
}

test('caller negotiates after acceptance, buffers early ICE, and releases all tracks on hangup', async () => {
  const ctrl = makeController();
  await ctrl.start('chat', 'Seller');
  expect(service.start).toHaveBeenCalledWith('chat', callerSession);
  expect(peers).toHaveLength(0);
  service.get.mockResolvedValue({ ...baseCall(), state: 'active', calleeSessionId: calleeSession, signals: [
    { kind: 'ice', sessionId: calleeSession, payload: { candidate: 'remote-candidate' } },
    { kind: 'answer', sessionId: calleeSession, payload: { type: 'answer', sdp: 'remote-answer' } },
  ] });
  await ctrl.sync();
  const peer = peers[0];
  expect(service.signal).toHaveBeenCalledWith('call', callerSession, 'offer', { type: 'offer', sdp: 'local-offer' });
  expect(peer.addIceCandidate).toHaveBeenCalledWith({ candidate: 'remote-candidate' });
  expect(peer.addIceCandidate.mock.invocationCallOrder[0]).toBeGreaterThan(peer.setRemoteDescription.mock.invocationCallOrder[0]);
  peer.connectionState = 'connected'; peer.onconnectionstatechange();
  expect(ctrl.state.phase).toBe('connected');
  ctrl.toggleMic(); ctrl.toggleCamera();
  expect(local.getAudioTracks()[0].enabled).toBe(false);
  expect(local.getVideoTracks()[0].enabled).toBe(false);
  await ctrl.end();
  expect(service.end).toHaveBeenCalledWith('call', callerSession, 'ended');
  local.getTracks().forEach(track => expect(track.stop).toHaveBeenCalled());
  expect(peer.close).toHaveBeenCalled();
});

test('incoming calls never access devices before acceptance and answer an offer only once', async () => {
  const ctrl = makeController('seller', calleeSession);
  service.current.mockResolvedValue(baseCall());
  await ctrl.sync();
  expect(ctrl.state.phase).toBe('incoming');
  expect(mediaDevices.getUserMedia).not.toHaveBeenCalled();
  const active = { ...baseCall(), state: 'active', calleeSessionId: calleeSession, signals: [
    { kind: 'offer', sessionId: callerSession, payload: { type: 'offer', sdp: 'remote-offer' } },
  ] };
  service.accept.mockResolvedValue(active); service.get.mockResolvedValue(active);
  await ctrl.accept();
  expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  expect(service.signal).toHaveBeenCalledWith('call', calleeSession, 'answer', { type: 'answer', sdp: 'local-answer' });
  await ctrl.sync();
  expect(service.signal.mock.calls.filter(([, , kind]) => kind === 'answer')).toHaveLength(1);
});

test('declining a call does not acquire a camera or microphone', async () => {
  const ctrl = makeController('seller', calleeSession);
  service.current.mockResolvedValue(baseCall());
  await ctrl.sync(); await ctrl.end('declined');
  expect(mediaDevices.getUserMedia).not.toHaveBeenCalled();
  expect(service.end).toHaveBeenCalledWith('call', calleeSession, 'declined');
});

test('camera permission errors do not create a call or leave tracks running', async () => {
  const ctrl = makeController();
  mediaDevices.getUserMedia.mockRejectedValue({ name: 'NotAllowedError' });
  await ctrl.start('chat', 'Seller');
  expect(service.start).not.toHaveBeenCalled();
  expect(ctrl.state.error).toMatch(/chưa cho phép/);
  expect(ctrl.state.localStream).toBeNull();
});

test('cancelling while permission is pending stops tracks if the user later allows access', async () => {
  const ctrl = makeController();
  let grant;
  let permissionRequested;
  const requested = new Promise(resolve => { permissionRequested = resolve; });
  mediaDevices.getUserMedia.mockImplementation(() => {
    permissionRequested();
    return new Promise(resolve => { grant = resolve; });
  });
  const pending = ctrl.start('chat', 'Seller');
  await requested;
  expect(mediaDevices.getUserMedia).toHaveBeenCalled();
  await ctrl.end(); grant(local); await pending;
  local.getTracks().forEach(track => expect(track.stop).toHaveBeenCalled());
  expect(service.start).not.toHaveBeenCalled();
});

test('another tab accepting a ringing call closes the local invitation without opening devices', async () => {
  const ctrl = makeController('seller', calleeSession);
  service.current.mockResolvedValue(baseCall()); await ctrl.sync();
  service.get.mockResolvedValue({ ...baseCall(), state: 'active', calleeSessionId: 'other-tab-session' });
  await ctrl.sync();
  expect(ctrl.state.call).toBeNull();
  expect(ctrl.state.error).toMatch(/tab khác/);
  expect(mediaDevices.getUserMedia).not.toHaveBeenCalled();
});

test('stale signaling responses cannot resurrect a locally ended call', async () => {
  const ctrl = makeController();
  await ctrl.start('chat', 'Seller');
  let respond;
  service.get.mockReturnValue(new Promise(resolve => { respond = resolve; }));
  const pending = ctrl.sync(); await ctrl.end();
  respond({ ...baseCall(), state: 'active', calleeSessionId: calleeSession }); await pending;
  expect(ctrl.state.call).toBeNull();
  expect(peers).toHaveLength(0);
});

test('unmounting releases devices and sends a best-effort hangup for the selected session', async () => {
  const ctrl = makeController();
  await ctrl.start('chat', 'Seller'); ctrl.dispose();
  expect(service.endOnUnload).toHaveBeenCalledWith('call', callerSession);
  local.getTracks().forEach(track => expect(track.stop).toHaveBeenCalled());
});
