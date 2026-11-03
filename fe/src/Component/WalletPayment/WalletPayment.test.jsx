import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WalletPayment from './WalletPayment';
import paymentService from '../../services/payment.service';

const mockError = jest.fn();
const mockSuccess = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { virtualBalance: 0 } }) }));
jest.mock('../../contexts/ToastContext', () => ({ useToast: () => ({ error: mockError, success: mockSuccess }) }));
jest.mock('../../hooks/useApiData', () => ({ formatMoney: amount => `${(amount ?? 0).toLocaleString('vi-VN')} VNĐ` }));
jest.mock('./WithdrawTab', () => () => null);
jest.mock('../../services/payment.service', () => ({
  getWallet: jest.fn(), getTransactions: jest.fn(), createTopup: jest.fn(),
  verifyTopup: jest.fn(), cancelTopup: jest.fn(), demoTopup: jest.fn(),
}));
const originalLocation = window.location;
const mockAssign = jest.fn();

beforeAll(() => {
  delete window.location;
  window.location = { assign: mockAssign };
});
afterAll(() => { window.location = originalLocation; });
beforeEach(() => {
  jest.clearAllMocks();
  paymentService.getWallet.mockResolvedValue({ data: { data: { balance: 0, recentTransactions: [] } } });
  paymentService.getTransactions.mockResolvedValue({ data: { data: { transactions: [] } } });
});

async function openTopup() {
  render(<WalletPayment role="farmer" />);
  await waitFor(() => expect(screen.queryByText('Đang tải ví...')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Nạp tiền', exact: true }));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10000' } });
}

test('creating a payment redirects to payOS immediately and prevents repeated submission', async () => {
  let finish;
  paymentService.createTopup.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await openTopup();
  const button = screen.getByRole('button', { name: /Tạo lệnh payOS/ });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(paymentService.createTopup).toHaveBeenCalledTimes(1);
  finish({ data: { data: { checkoutUrl: 'https://pay.payos.vn/web/test-link' } } });
  await waitFor(() => expect(mockAssign).toHaveBeenCalledWith('https://pay.payos.vn/web/test-link'));
});

test('a failed creation stays in the wallet and allows retry', async () => {
  paymentService.createTopup.mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ data: { data: { checkoutUrl: 'https://pay.payos.vn/web/retry' } } });
  await openTopup();
  fireEvent.click(screen.getByRole('button', { name: /Tạo lệnh payOS/ }));
  await waitFor(() => expect(mockError).toHaveBeenCalled());
  expect(mockAssign).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Tạo lệnh payOS/ }));
  await waitFor(() => expect(mockAssign).toHaveBeenCalledWith('https://pay.payos.vn/web/retry'));
});

test('an amount above the payment limit cannot create a link', async () => {
  await openTopup();
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '500000001' } });
  const button = screen.getByRole('button', { name: /Tạo lệnh payOS/ });
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(paymentService.createTopup).not.toHaveBeenCalled();
});

test('cancellation that races with payment shows success without another verification request', async () => {
  paymentService.getWallet.mockResolvedValue({ data: { data: { balance: 0, recentTransactions: [
    { _id: 'pending-1', type: 'topup', paymentMethod: 'payos', status: 'pending', orderCode: 123456, amount: 10000 },
  ] } } });
  paymentService.cancelTopup.mockResolvedValue({ data: {
    message: 'Giao dịch đã thanh toán thành công', data: { success: true, status: 'completed' },
  } });
  render(<WalletPayment role="farmer" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Hủy', exact: true }));
  await waitFor(() => expect(screen.queryByText('Nạp tiền thành công!')).not.toBeNull());
  expect(mockSuccess).toHaveBeenCalledWith('Giao dịch đã thanh toán thành công');
  expect(paymentService.verifyTopup).not.toHaveBeenCalled();
});
