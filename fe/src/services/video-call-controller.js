import videoCallService from './video-call.service';

const userIdOf = user => String(user?._id || user?.id || user || '');
export const emptyVideoCallState = () => ({ call: null, phase: 'idle', partnerName: '', localStream: null,
  remoteStream: null, muted: false, cameraOff: false, error: '', endReason: '', connectedAt: null, turnConfigured: false });

const mediaError = error => {
  if (error?.name === 'NotAllowedError') return 'Bạn chưa cho phép dùng camera và micro. Hãy cấp quyền trong trình duyệt rồi gọi lại.';
  if (error?.name === 'NotFoundError') return 'Không tìm thấy camera hoặc micro trên thiết bị.';
  if (error?.name === 'NotReadableError') return 'Camera hoặc micro đang được ứng dụng khác sử dụng.';
  return error?.response?.data?.message || error?.message || 'Không thể bắt đầu cuộc gọi video.';
};

export default class VideoCallController {
  constructor({ userId, sessionId, onChange, service = videoCallService, mediaDevices = navigator.mediaDevices,
    PeerConnection = window.RTCPeerConnection }) {
    Object.assign(this, { userId, sessionId, onChange, service, mediaDevices, PeerConnection });
    this.state = emptyVideoCallState();
    this.generation = 0;
    this.cursor = 0;
    this.pendingIce = [];
    this.disposed = false;
  }
  emit(patch) { this.state = { ...this.state, ...patch }; if (!this.disposed) this.onChange(this.state); }
  isSelected(call) {
    return (userIdOf(call.caller) === this.userId && call.callerSessionId === this.sessionId)
      || (userIdOf(call.callee) === this.userId && call.calleeSessionId === this.sessionId);
  }
  cleanupMedia() {
    clearTimeout(this.connectTimer);
    clearTimeout(this.disconnectTimer);
    if (this.peer) {
      this.peer.ontrack = null;
      this.peer.onicecandidate = null;
      this.peer.onconnectionstatechange = null;
      this.peer.close();
      this.peer = null;
    }
    this.state.localStream?.getTracks().forEach(track => track.stop());
    this.state.remoteStream?.getTracks().forEach(track => track.stop());
    this.cursor = 0;
    this.pendingIce = [];
    this.offered = false;
  }
  async acquireMedia(generation) {
    if (!this.mediaDevices?.getUserMedia || !this.PeerConnection) throw new Error('Gọi video cần trình duyệt hỗ trợ camera trên HTTPS hoặc localhost.');
    this.config = await this.service.config();
    if (this.disposed || generation !== this.generation) return null;
    const stream = await this.mediaDevices.getUserMedia({ audio: true, video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } } });
    if (this.disposed || generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return null; }
    this.emit({ localStream: stream, turnConfigured: this.config.turnConfigured, muted: false, cameraOff: false });
    return stream;
  }
  async start(conversationId, partnerName) {
    if (this.state.call || this.state.phase === 'preparing') return;
    const generation = ++this.generation;
    this.emit({ ...emptyVideoCallState(), phase: 'preparing', partnerName });
    try {
      if (!await this.acquireMedia(generation)) return;
      const call = await this.service.start(conversationId, this.sessionId);
      if (this.disposed || generation !== this.generation) {
        await this.service.end(call._id, this.sessionId, 'ended').catch(() => undefined); return;
      }
      this.emit({ call, phase: 'ringing' });
    } catch (error) {
      if (generation !== this.generation || this.disposed) return;
      this.cleanupMedia();
      this.emit({ call: null, phase: 'ended', localStream: null, remoteStream: null, error: mediaError(error) });
    }
  }
  async accept() {
    const call = this.state.call;
    if (!call || this.state.phase !== 'incoming') return;
    const generation = ++this.generation;
    this.emit({ phase: 'preparing', error: '' });
    try {
      if (!await this.acquireMedia(generation)) return;
      const accepted = await this.service.accept(call._id, this.sessionId);
      if (this.disposed || generation !== this.generation) {
        await this.service.end(call._id, this.sessionId, 'ended').catch(() => undefined); return;
      }
      this.emit({ call: accepted, phase: 'connecting' });
      await this.sync();
    } catch (error) {
      if (generation !== this.generation || this.disposed) return;
      await this.service.end(call._id, this.sessionId, 'failed').catch(() => undefined);
      this.cleanupMedia();
      this.emit({ call: null, phase: 'ended', localStream: null, remoteStream: null, error: mediaError(error) });
    }
  }
  async end(reason = 'ended', error = '') {
    const call = this.state.call;
    ++this.generation;
    this.cleanupMedia();
    this.emit({ call: null, phase: 'ended', localStream: null, remoteStream: null, error,
      endReason: reason, connectedAt: null });
    if (call) await this.service.end(call._id, this.sessionId, reason).catch(() => undefined);
  }
  dismiss() { if (!this.state.call) this.emit(emptyVideoCallState()); }
  toggleMic() {
    const muted = !this.state.muted;
    this.state.localStream?.getAudioTracks().forEach(track => { track.enabled = !muted; });
    this.emit({ muted });
  }
  toggleCamera() {
    const cameraOff = !this.state.cameraOff;
    this.state.localStream?.getVideoTracks().forEach(track => { track.enabled = !cameraOff; });
    this.emit({ cameraOff });
  }
  async send(kind, payload) {
    const call = this.state.call;
    if (call && !this.disposed) await this.service.signal(call._id, this.sessionId, kind, payload);
  }
  buildPeer() {
    if (this.peer || !this.state.localStream) return;
    const peer = this.peer = new this.PeerConnection({ iceServers: this.config?.iceServers || [] });
    this.state.localStream.getTracks().forEach(track => peer.addTrack(track, this.state.localStream));
    peer.onicecandidate = event => {
      if (event.candidate) this.send('ice', event.candidate.toJSON()).catch(() => undefined);
    };
    peer.ontrack = event => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      this.emit({ remoteStream: stream });
    };
    peer.onconnectionstatechange = () => {
      clearTimeout(this.disconnectTimer);
      if (peer.connectionState === 'connected') {
        clearTimeout(this.connectTimer);
        this.emit({ phase: 'connected', error: '', connectedAt: this.state.connectedAt || Date.now() });
      } else if (peer.connectionState === 'failed') {
        void this.end('failed', 'Không thể kết nối video. Hãy thử mạng khác hoặc liên hệ bộ phận hỗ trợ.');
      } else if (peer.connectionState === 'disconnected') {
        this.emit({ phase: 'connecting' });
        this.disconnectTimer = setTimeout(() => {
          if (peer.connectionState === 'disconnected') void this.end('failed', 'Cuộc gọi bị ngắt do mất kết nối mạng.');
        }, 10000);
      }
    };
    this.connectTimer = setTimeout(() => {
      if (peer.connectionState !== 'connected') void this.end('failed', 'Không kết nối được sau 30 giây. Hãy thử mạng khác hoặc liên hệ bộ phận hỗ trợ.');
    }, 30000);
  }
  async flushIce() {
    while (this.peer?.remoteDescription && this.pendingIce.length) await this.peer.addIceCandidate(this.pendingIce.shift());
  }
  async applyCall(call) {
    if (!call || this.disposed) return;
    if (call.state === 'ended') {
      if (this.state.call?._id === call._id) {
        ++this.generation;
        this.cleanupMedia();
        this.emit({ call: null, phase: 'ended', localStream: null, remoteStream: null, endReason: call.reason, connectedAt: null });
      }
      return;
    }
    const incoming = userIdOf(call.callee) === this.userId && call.state === 'ringing';
    if (!incoming && !this.isSelected(call)) {
      if (this.state.call?._id === call._id) {
        ++this.generation; this.cleanupMedia();
        this.emit({ call: null, phase: 'ended', localStream: null, remoteStream: null, error: 'Cuộc gọi đang được xử lý ở tab khác.' });
      }
      return;
    }
    // Do not steal a pending local permission request from accept()/start().
    if (this.state.phase === 'preparing') return;
    const callerHere = userIdOf(call.caller) === this.userId;
    this.emit({ call, partnerName: (callerHere ? call.callee : call.caller)?.fullName || this.state.partnerName || 'Đối tác',
      phase: incoming ? 'incoming' : call.state === 'ringing' ? 'ringing' : this.state.phase === 'connected' ? 'connected' : 'connecting' });
    if (call.state !== 'active' || !this.state.localStream) return;
    this.buildPeer();
    const peer = this.peer;
    if (callerHere && !this.offered) {
      this.offered = true;
      await peer.setLocalDescription(await peer.createOffer());
      await this.send('offer', { type: peer.localDescription.type, sdp: peer.localDescription.sdp });
    }
    const signals = call.signals || [];
    while (this.cursor < signals.length && this.peer === peer) {
      const signal = signals[this.cursor];
      if (signal.sessionId !== this.sessionId) {
        if (signal.kind === 'ice') {
          this.pendingIce.push(signal.payload);
          await this.flushIce();
        } else if (signal.kind === 'offer' && !callerHere) {
          await peer.setRemoteDescription(signal.payload);
          await this.flushIce();
          await peer.setLocalDescription(await peer.createAnswer());
          await this.send('answer', { type: peer.localDescription.type, sdp: peer.localDescription.sdp });
        } else if (signal.kind === 'answer' && callerHere) {
          await peer.setRemoteDescription(signal.payload);
          await this.flushIce();
        }
      }
      this.cursor++;
    }
  }
  async sync() {
    if (this.disposed) return;
    if (this.syncing) { this.resync = true; return this.syncing; }
    this.syncing = (async () => {
      do {
        this.resync = false;
        const generation = this.generation;
        let call;
        try { call = this.state.call ? await this.service.get(this.state.call._id) : await this.service.current(); }
        catch { return; } // Temporary signaling outages are recovered by the next poll.
        if (generation !== this.generation || this.disposed) continue;
        try { await this.applyCall(call); }
        catch { if (this.state.call && this.isSelected(this.state.call)) await this.end('failed', 'Không thể thiết lập kết nối video. Vui lòng gọi lại.'); }
      } while (this.resync && !this.disposed);
    })();
    try { await this.syncing; } finally { this.syncing = null; }
  }
  async poll() {
    if (this.disposed) return;
    const now = Date.now();
    if (this.state.call || now - (this.lastIdlePoll || 0) >= 15000) { this.lastIdlePoll = now; await this.sync(); }
    const call = this.state.call;
    if (call && this.isSelected(call) && now - (this.lastHeartbeat || 0) >= 10000) {
      this.lastHeartbeat = now;
      await this.service.heartbeat(call._id, this.sessionId).catch(() => undefined);
    }
  }
  releaseOnUnload() {
    const call = this.state.call;
    if (call && this.isSelected(call)) this.service.endOnUnload(call._id, this.sessionId);
    ++this.generation; this.cleanupMedia();
    this.emit({ call: null, phase: 'idle', localStream: null, remoteStream: null });
  }
  dispose() { this.disposed = true; this.releaseOnUnload(); }
}
