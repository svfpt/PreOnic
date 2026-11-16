import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Messaging from './Messaging';
import messagingService from '../../services/messaging.service';
import { subscribeMessaging } from '../../services/messaging-events';

const mockNavigate = jest.fn();
let mockSearch = 'partnerId=seller';
let mockVideoCall = null;

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(mockSearch)],
}), { virtual: true });
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'buyer' } }) }));
jest.mock('../Navbar/Navbar', () => () => null);
jest.mock('../../services/messaging.service', () => ({
  getConversations: jest.fn(), createConversation: jest.fn(), getMessages: jest.fn(), sendMessage: jest.fn(),
  uploadAttachment: jest.fn(), downloadAttachment: jest.fn(), removeAttachment: jest.fn(),
  markRead: jest.fn(), setTyping: jest.fn(), getReceipts: jest.fn(),
  getConversationProducts: jest.fn(), attachProduct: jest.fn(),
}));
jest.mock('../../services/messaging-events', () => ({ subscribeMessaging: jest.fn() }));
jest.mock('../../contexts/VideoCallContext', () => ({ useVideoCall: () => mockVideoCall }));

const existing = { _id: 'old-chat', partner: { _id: 'other', fullName: 'Đối tác cũ' } };
const target = { _id: 'seller-chat', partner: { _id: 'seller', fullName: 'Người bán xoài' } };

beforeEach(() => {
  jest.clearAllMocks();
  mockSearch = 'partnerId=seller';
  mockVideoCall = null;
  sessionStorage.clear();
  messagingService.setTyping.mockResolvedValue({});
  messagingService.markRead.mockResolvedValue({ data: {} });
  messagingService.getReceipts.mockResolvedValue({ data: [] });
  messagingService.removeAttachment.mockResolvedValue({});
  Element.prototype.scrollIntoView = jest.fn();
  messagingService.getConversations.mockResolvedValue({ data: [existing] });
  messagingService.createConversation.mockResolvedValue({ data: target });
  messagingService.getMessages.mockResolvedValue({ data: [] });
  subscribeMessaging.mockReturnValue(jest.fn());
});

test('opens the product seller conversation even when other conversations exist', async () => {
  render(<Messaging />);
  await screen.findAllByRole('heading', { name: 'Người bán xoài' });
  expect(messagingService.createConversation).toHaveBeenCalledWith('seller');
  await waitFor(() => expect(messagingService.getMessages).toHaveBeenCalledWith('seller-chat'));
});

test('displays incoming messages immediately on a realtime event', async () => {
  render(<Messaging />);
  await screen.findAllByRole('heading', { name: 'Người bán xoài' });
  messagingService.getConversations.mockResolvedValue({ data: [target, existing] });
  messagingService.getMessages.mockResolvedValue({ data: [{
    _id: 'message-1', sender: { _id: 'seller' }, text: 'Có thể giao vào thứ hai', createdAt: new Date().toISOString(),
  }] });
  await act(async () => {
    const callback = subscribeMessaging.mock.calls[subscribeMessaging.mock.calls.length - 1][0];
    await callback({ type: 'message', conversationId: 'seller-chat' });
  });
  expect(screen.getByText('Có thể giao vào thứ hai')).toBeInTheDocument();
});

test('shows a send failure and restores the draft without displaying it as sent', async () => {
  messagingService.sendMessage.mockRejectedValue(new Error('offline'));
  render(<Messaging />);
  await screen.findAllByRole('heading', { name: 'Người bán xoài' });
  const input = screen.getByPlaceholderText('Nhập tin nhắn...');
  fireEvent.change(input, { target: { value: 'Tôi muốn mua 100kg' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Không thể gửi tin nhắn');
  expect(input).toHaveValue('Tôi muốn mua 100kg');
  expect(screen.queryByText('Tôi muốn mua 100kg')).toBeNull();
});

test('uploads and sends a file without requiring text, then displays the download action', async () => {
  const file = { _id: 'file-1', originalName: 'hop-dong.pdf', mimeType: 'application/pdf', size: 100 };
  messagingService.uploadAttachment.mockResolvedValue({ data: file });
  messagingService.sendMessage.mockResolvedValue({ data: {
    _id: 'file-message', sender: 'buyer', text: '', attachments: [file], createdAt: new Date().toISOString(),
  } });
  render(<Messaging />);
  await screen.findAllByRole('heading', { name: 'Người bán xoài' });
  fireEvent.change(screen.getByLabelText('Chọn ảnh và tệp đính kèm'), {
    target: { files: [new File(['%PDF-1.7'], 'hop-dong.pdf', { type: 'application/pdf' })] },
  });
  await screen.findByLabelText('Bỏ hop-dong.pdf');
  expect(messagingService.uploadAttachment).toHaveBeenCalledWith('seller-chat', expect.any(File));
  messagingService.getMessages.mockResolvedValue({ data: [{
    _id: 'file-message', sender: 'buyer', text: '', attachments: [file], createdAt: new Date().toISOString(),
  }] });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));
  await waitFor(() => expect(messagingService.sendMessage).toHaveBeenCalledWith('seller-chat', '', ['file-1']));
  expect(await screen.findByLabelText('Tải xuống hop-dong.pdf')).toBeInTheDocument();
});

test('rejects oversized files before uploading and allows removing selected files', async () => {
  const file = { _id: 'file-1', originalName: 'notes.txt', mimeType: 'text/plain', size: 5 };
  messagingService.uploadAttachment.mockResolvedValue({ data: file });
  render(<Messaging />);
  await screen.findAllByRole('heading', { name: 'Người bán xoài' });
  const picker = screen.getByLabelText('Chọn ảnh và tệp đính kèm');
  fireEvent.change(picker, { target: { files: [new File(['a'.repeat(5 * 1024 * 1024 + 1)], 'big.txt')] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('5 MB');
  expect(messagingService.uploadAttachment).not.toHaveBeenCalled();
  fireEvent.change(picker, { target: { files: [new File(['hello'], 'notes.txt')] } });
  fireEvent.click(await screen.findByLabelText('Bỏ notes.txt'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled());
});

test('previews received images using authenticated downloads', async () => {
  URL.createObjectURL = jest.fn(() => 'blob:test-photo');
  URL.revokeObjectURL = jest.fn();
  const file = { _id: 'photo-1', originalName: 'xoai.png', mimeType: 'image/png', size: 128 };
  messagingService.downloadAttachment.mockResolvedValue(new Blob(['photo'], { type: 'image/png' }));
  messagingService.getMessages.mockResolvedValue({ data: [{
    _id: 'photo-message', sender: 'seller', text: '', attachments: [file], createdAt: new Date().toISOString(),
  }] });
  const { unmount } = render(<Messaging />);
  const image = await screen.findByAltText('xoai.png');
  expect(image).toHaveAttribute('src', 'blob:test-photo');
  expect(messagingService.downloadAttachment).toHaveBeenCalledWith('photo-1');
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-photo');
});

test('keeps separate text and file drafts when switching chats and after remounting', async () => {
  messagingService.uploadAttachment.mockResolvedValue({ data: {
    _id: 'draft-file', originalName: 'draft.txt', mimeType: 'text/plain', size: 10,
  } });
  const { unmount } = render(<Messaging />);
  await screen.findAllByRole('heading', { name: 'Người bán xoài' });
  fireEvent.change(screen.getByPlaceholderText('Nhập tin nhắn...'), { target: { value: 'Bản nháp cho người bán' } });
  fireEvent.change(screen.getByLabelText('Chọn ảnh và tệp đính kèm'), { target: { files: [new File(['draft'], 'draft.txt')] } });
  await screen.findByLabelText('Bỏ draft.txt');
  fireEvent.click(screen.getByText('Đối tác cũ'));
  expect(screen.getByPlaceholderText('Nhập tin nhắn...')).toHaveValue('');
  fireEvent.change(screen.getByPlaceholderText('Nhập tin nhắn...'), { target: { value: 'Bản nháp khác' } });
  fireEvent.click(screen.getByText('Người bán xoài'));
  expect(screen.getByPlaceholderText('Nhập tin nhắn...')).toHaveValue('Bản nháp cho người bán');
  expect(screen.getByLabelText('Bỏ draft.txt')).toBeInTheDocument();
  unmount();
  render(<Messaging />);
  await screen.findAllByRole('heading', { name: 'Người bán xoài' });
  expect(screen.getByPlaceholderText('Nhập tin nhắn...')).toHaveValue('Bản nháp cho người bán');
  expect(screen.getByLabelText('Bỏ draft.txt')).toBeInTheDocument();
});

test('loads older messages without losing them when a realtime message arrives', async () => {
  messagingService.getMessages.mockResolvedValueOnce({ data: [
    { _id: '02', sender: 'seller', text: 'Tin gần đây', createdAt: new Date().toISOString() },
  ], pagination: { hasMore: true, nextCursor: '02' } });
  render(<Messaging />);
  await screen.findByText('Tin gần đây');
  messagingService.getMessages.mockResolvedValueOnce({ data: [
    { _id: '01', sender: 'seller', text: 'Tin cũ nhất', createdAt: new Date().toISOString() },
  ], pagination: { hasMore: false, nextCursor: '01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tải tin nhắn cũ hơn' }));
  expect(await screen.findByText('Tin cũ nhất')).toBeInTheDocument();
  expect(messagingService.getMessages).toHaveBeenCalledWith('seller-chat', { before: '02' });
  messagingService.getMessages.mockResolvedValue({ data: [
    { _id: '03', sender: 'seller', text: 'Tin realtime mới', createdAt: new Date().toISOString() },
  ], pagination: { hasMore: false, nextCursor: '03' } });
  messagingService.getConversations.mockResolvedValue({ data: [target, existing] });
  await act(async () => {
    await subscribeMessaging.mock.calls.at(-1)[0]({ type: 'message', conversationId: 'seller-chat' });
  });
  expect(screen.getByText('Tin cũ nhất')).toBeInTheDocument();
  expect(screen.getByText('Tin gần đây')).toBeInTheDocument();
  expect(screen.getByText('Tin realtime mới')).toBeInTheDocument();
});

test('acknowledges only visible incoming messages while the document is visible', async () => {
  const observers = [];
  global.IntersectionObserver = jest.fn(function(callback) {
    this.observe = jest.fn();
    this.disconnect = jest.fn();
    observers.push(callback);
  });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  messagingService.getMessages.mockResolvedValue({ data: [
    { _id: 'visible', sender: 'seller', text: 'Tin trong vùng xem', readBy: ['seller'], createdAt: new Date().toISOString() },
    { _id: 'unseen', sender: 'seller', text: 'Tin ngoài vùng xem', readBy: ['seller'], createdAt: new Date().toISOString() },
  ] });
  const { unmount } = render(<Messaging />);
  const bubble = (await screen.findByText('Tin trong vùng xem')).closest('[data-message-id]');
  await act(async () => { observers.at(-1)([{ target: bubble, isIntersecting: true, intersectionRatio: 0.5 }]); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 200)); });
  expect(messagingService.markRead).not.toHaveBeenCalled();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  fireEvent(document, new Event('visibilitychange'));
  await waitFor(() => expect(messagingService.markRead).toHaveBeenCalledWith('seller-chat', ['visible']));
  expect(messagingService.markRead.mock.calls.every(([, ids]) => !ids.includes('unseen'))).toBe(true);
  unmount();
  delete global.IntersectionObserver;
});

test('updates connection, typing and read receipt states from realtime events', async () => {
  messagingService.getConversations.mockResolvedValue({ data: [target, existing] });
  messagingService.getMessages.mockResolvedValue({ data: [{
    _id: 'mine', sender: 'buyer', text: 'Đã gửi cho đối tác', readBy: ['buyer'], createdAt: new Date().toISOString(),
  }] });
  render(<Messaging />);
  await screen.findByText('Đã gửi cho đối tác');
  await act(async () => {
    const callback = subscribeMessaging.mock.calls.at(-1)[0];
    await callback({ type: 'connection', status: 'reconnecting' });
    await callback({ type: 'typing', conversationId: 'seller-chat', typing: true });
    await callback({ type: 'read', conversationId: 'seller-chat', userId: 'seller', messageIds: ['mine'] });
  });
  expect(screen.getByText('Mất kết nối · Đang kết nối lại…')).toBeInTheDocument();
  expect(screen.getByText('Đang nhập…')).toBeInTheDocument();
  expect(screen.getByText(/Đã xem/)).toBeInTheDocument();
});

test('restores read receipts missed during a disconnect', async () => {
  messagingService.getConversations.mockResolvedValue({ data: [target, existing] });
  messagingService.getMessages.mockResolvedValue({ data: [{
    _id: 'mine', sender: 'buyer', text: 'Tin chờ xác nhận', readBy: ['buyer'], createdAt: new Date().toISOString(),
  }] });
  render(<Messaging />);
  await screen.findByText('Tin chờ xác nhận');
  messagingService.getMessages.mockResolvedValue({ data: [] });
  messagingService.getReceipts.mockResolvedValue({ data: [{ _id: 'mine', readBy: ['buyer', 'seller'] }] });
  await act(async () => { await subscribeMessaging.mock.calls.at(-1)[0]({ type: 'connected' }); });
  expect(screen.getByText(/Đã xem/)).toBeInTheDocument();
});

test('lets an existing conversation select a product and display its card', async () => {
  const product = { _id: 'mango', name: 'Xoài Cát Hòa Lộc', priceMin: 20000, priceMax: 25000, unit: 'kg' };
  messagingService.getConversationProducts.mockResolvedValue({ data: [product], pagination: { hasMore: false } });
  messagingService.attachProduct.mockResolvedValue({ data: product });
  render(<Messaging />);
  await screen.findAllByRole('heading', { name: 'Người bán xoài' });
  expect(screen.getByText('Chưa gắn sản phẩm cho cuộc trò chuyện này')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '+ Gắn sản phẩm' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Gắn sản phẩm Xoài Cát Hòa Lộc' }));
  await waitFor(() => expect(messagingService.attachProduct).toHaveBeenCalledWith('seller-chat', 'mango'));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.getByRole('button', { name: /Đang trao đổi về sản phẩm.*Xoài Cát Hòa Lộc/ })).toBeInTheDocument();
  expect(screen.getByText('Xoài Cát Hòa Lộc')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Đổi sản phẩm' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Đang trao đổi về sản phẩm.*Xoài Cát Hòa Lộc/ }));
  expect(mockNavigate).toHaveBeenCalledWith('/products/mango?conversationId=seller-chat');
});

test('shows the selected product in the other participant chat through realtime', async () => {
  render(<Messaging />);
  await screen.findAllByRole('heading', { name: 'Người bán xoài' });
  await act(async () => {
    await subscribeMessaging.mock.calls.at(-1)[0]({ type: 'product', conversationId: 'seller-chat',
      product: { _id: 'mango', name: 'Xoài mới', priceMin: 20000 } });
  });
  expect(screen.getByText('Xoài mới')).toBeInTheDocument();
});

test('opens a merged conversation through its old link and preserves both drafts', async () => {
  mockSearch = 'conversationId=old-duplicate';
  const file = { _id: 'pending-file', originalName: 'draft.txt', mimeType: 'text/plain', size: 5 };
  sessionStorage.setItem('messaging-drafts:buyer', JSON.stringify({
    'old-duplicate': { text: 'Bản nháp cũ', attachments: [file] },
    'seller-chat': { text: 'Bản nháp hiện tại', attachments: [] },
  }));
  messagingService.getConversations.mockResolvedValue({ data: [existing, { ...target, aliases: ['old-duplicate'] }] });
  render(<Messaging />);
  await screen.findAllByRole('heading', { name: 'Người bán xoài' });
  await waitFor(() => expect(messagingService.getMessages).toHaveBeenCalledWith('seller-chat'));
  expect(screen.getByPlaceholderText('Nhập tin nhắn...')).toHaveValue('Bản nháp hiện tại · Bản nháp cũ');
  expect(screen.getByLabelText('Bỏ draft.txt')).toBeInTheDocument();
  expect(JSON.parse(sessionStorage.getItem('messaging-drafts:buyer'))['old-duplicate']).toBeUndefined();
  expect(messagingService.createConversation).not.toHaveBeenCalled();
});

test('starts video calling for the active conversation and disables another call while busy', async () => {
  const start = jest.fn();
  mockVideoCall = { enabled: true, busy: false, start };
  const { rerender } = render(<Messaging />);
  fireEvent.click(await screen.findByRole('button', { name: 'Gọi video' }));
  expect(start).toHaveBeenCalledWith('seller-chat', 'Người bán xoài');
  mockVideoCall = { enabled: true, busy: true, start };
  rerender(<Messaging />);
  expect(screen.getByRole('button', { name: 'Gọi video' })).toBeDisabled();
});
