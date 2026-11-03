import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PaymentResult from './PaymentResult';
import paymentService from '../../services/payment.service';

let mockQuery = 'orderCode=123456';
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(mockQuery)],
  useNavigate: () => mockNavigate,
}), { virtual: true });
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'farmer' } }) }));
jest.mock('../../services/payment.service', () => ({
  verifyTopup: jest.fn(), cancelTopup: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery = 'orderCode=123456';
});
afterEach(() => { cleanup(); jest.useRealTimers(); });

test('missing order code reports an error instead of waiting indefinitely', () => {
  mockQuery = '';
  render(<PaymentResult type="success" />);
  expect(screen.queryByText('Có lỗi xảy ra')).not.toBeNull();
  expect(paymentService.verifyTopup).not.toHaveBeenCalled();
});

test('forged success parameters cannot display payment success', async () => {
  mockQuery += '&status=PAID';
  paymentService.verifyTopup.mockResolvedValue({ data: { data: { success: false, status: 'pending' } } });
  render(<PaymentResult type="success" />);
  await waitFor(() => expect(screen.queryByText('Giao dịch đang xử lý')).not.toBeNull());
  expect(screen.queryByText('Nạp tiền thành công!')).toBeNull();
});

test('polling moves a pending payment to success and returns to the wallet tab', async () => {
  jest.useFakeTimers();
  paymentService.verifyTopup
    .mockResolvedValueOnce({ data: { data: { success: false, status: 'pending' } } })
    .mockResolvedValue({ data: { data: { success: true, transaction: { amount: 10000 }, newBalance: 15000 } } });
  await act(async () => { render(<PaymentResult type="success" />); });
  expect(screen.queryByText('Giao dịch đang xử lý')).not.toBeNull();
  await act(async () => { jest.advanceTimersByTime(5000); });
  expect(screen.queryByText('Nạp tiền thành công!')).not.toBeNull();
  fireEvent.click(screen.getByText('Về ví của tôi'));
  expect(mockNavigate).toHaveBeenCalledWith('/farmer', { state: { activeNav: 'vi', activeTab: 'vi' } });
});

test('cancel return still shows success if the server reports a paid order', async () => {
  paymentService.cancelTopup.mockResolvedValue({ data: { data: { success: true } } });
  paymentService.verifyTopup.mockResolvedValue({ data: { data: { success: true, transaction: { amount: 10000 }, newBalance: 10000 } } });
  render(<PaymentResult type="cancel" />);
  await waitFor(() => expect(screen.queryByText('Nạp tiền thành công!')).not.toBeNull());
  expect(screen.queryByText('Giao dịch đã bị hủy')).toBeNull();
});

test('verification errors offer a manual retry', async () => {
  paymentService.verifyTopup.mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ data: { data: { success: false, status: 'cancelled' } } });
  render(<PaymentResult type="success" />);
  await waitFor(() => expect(screen.queryByText('Có lỗi xảy ra')).not.toBeNull());
  fireEvent.click(screen.getByText('Kiểm tra lại'));
  await waitFor(() => expect(screen.queryByText('Giao dịch đã bị hủy')).not.toBeNull());
});

test('polling stops after five minutes and offers a retry', async () => {
  jest.useFakeTimers();
  paymentService.verifyTopup.mockResolvedValue({ data: { data: { success: false, status: 'pending' } } });
  await act(async () => { render(<PaymentResult type="success" />); });
  for (let attempt = 1; attempt < 60; attempt++) {
    await act(async () => { jest.advanceTimersByTime(5000); });
  }
  expect(screen.queryByText('Chưa nhận được xác nhận thanh toán')).not.toBeNull();
  expect(paymentService.verifyTopup).toHaveBeenCalledTimes(60);
  await act(async () => { jest.advanceTimersByTime(10000); });
  expect(paymentService.verifyTopup).toHaveBeenCalledTimes(60);
});
