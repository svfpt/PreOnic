import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoCallWindow from './VideoCallWindow';
import { emptyVideoCallState } from '../../services/video-call-controller';

const actions = { accept: jest.fn(), decline: jest.fn(), end: jest.fn(), toggleMic: jest.fn(), toggleCamera: jest.fn(), dismiss: jest.fn() };
beforeEach(() => {
  jest.clearAllMocks();
  HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue();
});

test('incoming invitations offer accept and decline without rendering media', () => {
  render(<VideoCallWindow actions={actions} state={{ ...emptyVideoCallState(), phase: 'incoming', partnerName: 'Người bán', call: { _id: 'call' } }} />);
  expect(screen.getByRole('alertdialog', { name: 'Cuộc gọi video từ Người bán' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Video của bạn')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Nhận cuộc gọi' }));
  expect(actions.accept).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }));
  expect(actions.decline).toHaveBeenCalled();
});

test('active calls provide microphone, camera, minimize and hangup controls', () => {
  render(<VideoCallWindow actions={actions} state={{ ...emptyVideoCallState(), phase: 'connected', partnerName: 'Người bán',
    call: { _id: 'call' }, localStream: {}, remoteStream: {}, connectedAt: Date.now() }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Tắt micro' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tắt camera' }));
  expect(actions.toggleMic).toHaveBeenCalled(); expect(actions.toggleCamera).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Thu nhỏ cuộc gọi' }));
  expect(screen.queryByLabelText('Video của đối tác')).toBeNull();
  expect(screen.getByRole('button', { name: 'Phóng to cuộc gọi' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Kết thúc cuộc gọi' }));
  expect(actions.end).toHaveBeenCalled();
});
