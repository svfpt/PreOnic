import { useEffect, useRef, useState } from 'react';
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiPhoneOff, FiMinimize2, FiMaximize2, FiX } from 'react-icons/fi';
import './VideoCallWindow.css';

const endedText = reason => ({ declined: 'Đối tác đã từ chối cuộc gọi.', missed: 'Cuộc gọi không được trả lời.',
  disconnected: 'Cuộc gọi kết thúc vì mất kết nối.', failed: 'Không thể kết nối cuộc gọi.' }[reason] || 'Cuộc gọi đã kết thúc.');

function StreamVideo({ stream, muted = false, label, className = '' }) {
  const ref = useRef(null);
  const [needsPlay, setNeedsPlay] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return undefined;
    let current = true;
    video.srcObject = stream;
    if (stream) video.play()?.catch(() => { if (current) setNeedsPlay(true); });
    return () => { current = false; video.srcObject = null; };
  }, [stream]);
  return <div className={className}>
    <video ref={ref} autoPlay playsInline muted={muted} aria-label={label} />
    {needsPlay && !muted && <button onClick={() => ref.current.play().then(() => setNeedsPlay(false)).catch(() => undefined)}>Bật âm thanh và video</button>}
  </div>;
}

export default function VideoCallWindow({ state, actions }) {
  const [minimized, setMinimized] = useState(false);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!state.connectedAt) { setSeconds(0); return undefined; }
    const tick = () => setSeconds(Math.floor((Date.now() - state.connectedAt) / 1000));
    tick(); const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [state.connectedAt]);
  useEffect(() => { setMinimized(false); }, [state.call?._id]);
  if (state.phase === 'idle') return null;
  if (state.phase === 'ended') return <section className="vc-result" role="status">
    <p>{state.error || endedText(state.endReason)}</p><button onClick={actions.dismiss} aria-label="Đóng thông báo cuộc gọi"><FiX /></button>
  </section>;
  const incoming = state.phase === 'incoming';
  const status = state.phase === 'preparing' ? 'Đang xin quyền camera và micro…'
    : state.phase === 'ringing' ? 'Đang đổ chuông…' : state.phase === 'connecting' ? 'Đang kết nối video…'
      : `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  return <section className={`vc-window ${minimized ? 'vc-minimized' : ''}`} role={incoming ? 'alertdialog' : 'region'}
    aria-label={incoming ? `Cuộc gọi video từ ${state.partnerName}` : `Gọi video với ${state.partnerName}`}>
    <header><FiVideo /><div><strong>{state.partnerName || 'Đối tác'}</strong><span>{incoming ? 'Cuộc gọi video đến' : status}</span></div>
      {!incoming && <button onClick={() => setMinimized(value => !value)} aria-label={minimized ? 'Phóng to cuộc gọi' : 'Thu nhỏ cuộc gọi'}>{minimized ? <FiMaximize2 /> : <FiMinimize2 />}</button>}
    </header>
    {incoming ? <div className="vc-incoming"><p>{state.partnerName} muốn gọi video với bạn.</p>
      <button className="vc-accept" onClick={actions.accept}>Nhận cuộc gọi</button>
      <button className="vc-decline" onClick={actions.decline}>Từ chối</button>
    </div> : <>
      {!minimized && <div className="vc-stage">
        <StreamVideo stream={state.remoteStream} label="Video của đối tác" className="vc-remote" />
        {!state.remoteStream && <p>{status}</p>}
        {state.localStream && <StreamVideo stream={state.localStream} muted label="Video của bạn" className="vc-local" />}
      </div>}
      <div className="vc-controls">
        <button disabled={!state.localStream} aria-label={state.muted ? 'Bật micro' : 'Tắt micro'} aria-pressed={state.muted} onClick={actions.toggleMic}>{state.muted ? <FiMicOff /> : <FiMic />}</button>
        <button disabled={!state.localStream} aria-label={state.cameraOff ? 'Bật camera' : 'Tắt camera'} aria-pressed={state.cameraOff} onClick={actions.toggleCamera}>{state.cameraOff ? <FiVideoOff /> : <FiVideo />}</button>
        <button className="vc-decline" aria-label="Kết thúc cuộc gọi" onClick={actions.end}><FiPhoneOff /> Kết thúc</button>
      </div>
    </>}
  </section>;
}
