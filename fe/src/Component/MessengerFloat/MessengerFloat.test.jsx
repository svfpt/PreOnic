import { act, fireEvent, render as baseRender, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MessengerFloat from './MessengerFloat';
import Messaging from '../Messaging/Messaging';
import messagingService from '../../services/messaging.service';
import { subscribeMessaging } from '../../services/messaging-events';
import { MessengerProvider, useMessenger } from '../../contexts/MessengerContext';

const render = ui => baseRender(ui, { wrapper: MessengerProvider });

const mockNavigate = jest.fn();
let mockSearch = '';
let mockUser;
const mockListeners = new Set();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(mockSearch)],
}), { virtual: true });
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../Navbar/Navbar', () => () => <div data-testid="page-navbar" />);
jest.mock('../../services/messaging-events', () => ({ subscribeMessaging: jest.fn() }));
jest.mock('../../services/messaging.service', () => ({
  getUnreadCount: jest.fn(), getConversations: jest.fn(), getMessages: jest.fn(), createConversation: jest.fn(),
  sendMessage: jest.fn(), setTyping: jest.fn(), markRead: jest.fn(), getReceipts: jest.fn(),
  uploadAttachment: jest.fn(), downloadAttachment: jest.fn(), removeAttachment: jest.fn(),
  getConversationProducts: jest.fn(), attachProduct: jest.fn(),
}));
const conversation = { _id: 'chat', partner: { _id: 'seller', fullName: 'Người bán', role: 'farmer' }, unreadCount: 0 };
const message = { _id: '01', sender: 'seller', text: 'Tin đã đọc trước đây', readBy: ['seller', 'buyer'], createdAt: new Date().toISOString() };

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  mockListeners.clear();
  mockSearch = '';
  mockUser = { id: 'buyer', role: 'enterprise' };
  Element.prototype.scrollIntoView = jest.fn();
  subscribeMessaging.mockImplementation(callback => { mockListeners.add(callback); return () => mockListeners.delete(callback); });
  messagingService.getUnreadCount.mockResolvedValue({ data: { total: 0 } });
  messagingService.getConversations.mockResolvedValue({ data: [conversation] });
  messagingService.getMessages.mockResolvedValue({ data: [message] });
  messagingService.getReceipts.mockResolvedValue({ data: [] });
  messagingService.setTyping.mockResolvedValue({});
  messagingService.markRead.mockResolvedValue({ data: {} });
});

const openChat = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Mở tin nhắn' }));
  fireEvent.click(await screen.findByText('Người bán'));
  await screen.findByText('Tin đã đọc trước đây');
};

test('shows all conversations and sends messages directly in the popup without navigating', async () => {
  messagingService.sendMessage.mockResolvedValue({ data: { ...message, _id: '02', sender: 'buyer', text: 'Trả lời ngay' } });
  render(<MessengerFloat />);
  await openChat();
  expect(screen.queryByTestId('page-navbar')).toBeNull();
  fireEvent.change(screen.getByPlaceholderText('Nhập tin nhắn...'), { target: { value: 'Trả lời ngay' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));
  await waitFor(() => expect(messagingService.sendMessage).toHaveBeenCalledWith('chat', 'Trả lời ngay', []));
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(screen.getByRole('region', { name: 'Tin nhắn nhanh' })).toBeVisible();
});

test('preserves the active conversation and draft when minimized or the surrounding page changes', async () => {
  const { rerender } = render(<><div>Trang sản phẩm</div><MessengerFloat /></>);
  await openChat();
  fireEvent.change(screen.getByPlaceholderText('Nhập tin nhắn...'), { target: { value: 'Bản nháp đang soạn' } });
  fireEvent.click(screen.getByRole('button', { name: 'Thu nhỏ tin nhắn' }));
  expect(screen.getByRole('button', { name: 'Mở tin nhắn' })).toHaveAttribute('aria-expanded', 'false');
  mockSearch = 'productId=unrelated&partnerId=someone';
  rerender(<><div>Trang hồ sơ</div><MessengerFloat /></>);
  fireEvent.click(screen.getByRole('button', { name: 'Mở tin nhắn' }));
  expect(screen.getByPlaceholderText('Nhập tin nhắn...')).toHaveValue('Bản nháp đang soạn');
  expect(messagingService.createConversation).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Xem tất cả' }));
  expect(mockNavigate).toHaveBeenCalledWith('/messaging?conversationId=chat');
});

test('updates the badge from realtime events and removes private UI on logout', async () => {
  const { rerender } = render(<MessengerFloat />);
  await waitFor(() => expect(subscribeMessaging).toHaveBeenCalled());
  messagingService.getUnreadCount.mockResolvedValue({ data: { total: 3 } });
  await act(async () => { mockListeners.forEach(listener => listener({ type: 'message', conversationId: 'chat' })); });
  expect(await screen.findByLabelText('3 tin nhắn chưa đọc')).toBeInTheDocument();
  mockUser = null;
  rerender(<MessengerFloat />);
  expect(screen.queryByRole('button', { name: 'Mở tin nhắn' })).toBeNull();
  expect(mockListeners.size).toBe(0);
});

test('shares drafts between the full page and the floating composer', async () => {
  render(<><Messaging /><MessengerFloat /></>);
  await screen.findByText('Tin đã đọc trước đây');
  const fullPageInput = screen.getByPlaceholderText('Nhập tin nhắn...');
  fireEvent.change(fullPageInput, { target: { value: 'Bản nháp dùng chung' } });
  fireEvent.click(screen.getByRole('button', { name: 'Mở tin nhắn' }));
  await waitFor(() => expect(screen.getAllByText('Người bán').length).toBe(3));
  const rows = screen.getAllByText('Người bán');
  fireEvent.click(rows[rows.length - 1]);
  await waitFor(() => expect(screen.getAllByPlaceholderText('Nhập tin nhắn...')).toHaveLength(2));
  const inputs = screen.getAllByPlaceholderText('Nhập tin nhắn...');
  expect(inputs[1]).toHaveValue('Bản nháp dùng chung');
  fireEvent.change(inputs[1], { target: { value: 'Sửa trong popup' } });
  expect(inputs[0]).toHaveValue('Sửa trong popup');
});

test('opens the popup for a product contact action without leaving the product page', async () => {
  function ContactSeller() {
    const { openMessenger } = useMessenger();
    return <button onClick={() => openMessenger({ partnerId: 'seller', productId: 'mango' })}>Liên hệ người bán</button>;
  }
  messagingService.createConversation.mockResolvedValue({ data: conversation });
  mockSearch = 'conversationId=return-to-chat';
  render(<><ContactSeller /><MessengerFloat /></>);
  fireEvent.click(screen.getByRole('button', { name: 'Liên hệ người bán' }));
  await screen.findByText('Tin đã đọc trước đây');
  expect(messagingService.createConversation).toHaveBeenCalledWith('seller', 'mango');
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(screen.getByRole('region', { name: 'Tin nhắn nhanh' })).toBeVisible();
});

test('sends file attachments directly from the popup', async () => {
  const file = { _id: 'file', originalName: 'bao-gia.pdf', mimeType: 'application/pdf', size: 12 };
  messagingService.uploadAttachment.mockResolvedValue({ data: file });
  messagingService.sendMessage.mockResolvedValue({ data: { ...message, _id: '02', sender: 'buyer', text: '', attachments: [file] } });
  render(<MessengerFloat />);
  await openChat();
  fireEvent.change(screen.getByLabelText('Chọn ảnh và tệp đính kèm'), {
    target: { files: [new File(['%PDF-1.7'], 'bao-gia.pdf', { type: 'application/pdf' })] },
  });
  await screen.findByLabelText('Bỏ bao-gia.pdf');
  fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));
  await waitFor(() => expect(messagingService.sendMessage).toHaveBeenCalledWith('chat', '', ['file']));
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('does not acknowledge incoming messages while minimized and resumes when reopened', async () => {
  const observers = [];
  global.IntersectionObserver = jest.fn(function(callback) {
    this.observe = jest.fn();
    this.disconnect = jest.fn();
    observers.push({ callback, instance: this });
  });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  messagingService.getMessages.mockResolvedValue({ data: [{ ...message, readBy: ['seller'] }] });
  const { unmount } = render(<MessengerFloat />);
  await openChat();
  const firstObserver = observers.at(-1);
  fireEvent.click(screen.getByRole('button', { name: 'Thu nhỏ tin nhắn' }));
  expect(firstObserver.instance.disconnect).toHaveBeenCalled();
  const bubble = screen.getByText('Tin đã đọc trước đây').closest('[data-message-id]');
  await act(async () => {
    firstObserver.callback([{ target: bubble, isIntersecting: true, intersectionRatio: 1 }]);
    await new Promise(resolve => setTimeout(resolve, 200));
  });
  expect(messagingService.markRead).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Mở tin nhắn' }));
  await act(async () => { observers.at(-1).callback([{ target: bubble, isIntersecting: true, intersectionRatio: 1 }]); });
  await waitFor(() => expect(messagingService.markRead).toHaveBeenCalledWith('chat', ['01']));
  unmount();
  delete global.IntersectionObserver;
});
