import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WithdrawTab from './WithdrawTab';
import paymentService from '../../services/payment.service';
const mockSuccess = jest.fn();
const mockError = jest.fn();
jest.mock('../../contexts/ToastContext', () => ({ useToast: () => ({ success: mockSuccess, error: mockError }) }));
jest.mock('../../hooks/useApiData', () => ({ formatMoney: amount => String(amount ?? 0) }));
jest.mock('../../services/payment.service', () => ({ getWithdrawals: jest.fn(), getWithdrawalBanks: jest.fn(), createWithdrawal: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  paymentService.getWithdrawals.mockResolvedValue({ data: { data: { available: 100000, pendingTotal: 0, requests: [] } } });
  paymentService.getWithdrawalBanks.mockResolvedValue({ data: { data: { banks: [{ bin: '970436', shortName: 'Vietcombank', name: 'VCB' }] } } });
  paymentService.createWithdrawal.mockResolvedValue({ data: { data: {} } });
});

test('submits the bank BIN and withdrawal amount then refreshes the available balance', async () => {
  const changed = jest.fn();
  render(<WithdrawTab onChanged={changed} />);
  await screen.findByText('Vietcombank — VCB');
  fireEvent.change(screen.getByPlaceholderText('VD: 500,000'), { target: { value: '10000' } });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '970436' } });
  fireEvent.change(screen.getByPlaceholderText('Số tài khoản nhận tiền'), { target: { value: '1234567890' } });
  fireEvent.change(screen.getByPlaceholderText('Tên chủ tài khoản (in hoa)'), { target: { value: 'NGUYEN VAN A' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu rút tiền' }));
  await waitFor(() => expect(paymentService.createWithdrawal).toHaveBeenCalledWith(expect.objectContaining({ amount: 10000, bankBin: '970436', bankAccountNumber: '1234567890' })));
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
});

test('does not submit an amount exceeding available funds', async () => {
  render(<WithdrawTab />);
  await screen.findByText('Vietcombank — VCB');
  fireEvent.change(screen.getByPlaceholderText('VD: 500,000'), { target: { value: '200000' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Gửi yêu cầu rút tiền' }).closest('form'));
  expect(mockError).toHaveBeenCalledWith('Số tiền vượt quá số dư khả dụng');
  expect(paymentService.createWithdrawal).not.toHaveBeenCalled();
});

test('shows processing separately from a completed transfer', async () => {
  paymentService.getWithdrawals.mockResolvedValue({ data: { data: { available: 20000, pendingTotal: 80000,
    requests: [{ _id: 'request-1', amount: 80000, status: 'processing', bankName: 'Vietcombank' }] } } });
  render(<WithdrawTab />);
  await screen.findByText('Đang chuyển / đối soát');
  expect(screen.queryByText('Đã chuyển')).toBeNull();
});
