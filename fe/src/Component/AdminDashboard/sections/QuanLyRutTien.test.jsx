import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import QuanLyRutTien from './QuanLyRutTien';
import adminService from '../../../services/admin.service';
const mockSuccess = jest.fn();
const mockError = jest.fn();
const mockToast = { success: mockSuccess, error: mockError };
jest.mock('../../../contexts/ToastContext', () => ({ useToast: () => mockToast }));
jest.mock('../../../hooks/useApiData', () => ({ formatMoney: amount => String(amount ?? 0) }));
jest.mock('../../../services/admin.service', () => ({ getWithdrawals: jest.fn(), approveWithdrawal: jest.fn(), rejectWithdrawal: jest.fn(), syncWithdrawal: jest.fn() }));
const request = { _id: 'request-1', amount: 10000, status: 'pending', bankName: 'Vietcombank', bankAccountNumber: '1234567890', bankAccountHolder: 'NGUYEN VAN A' };
beforeEach(() => {
  jest.clearAllMocks();
  adminService.getWithdrawals.mockResolvedValue({ data: { requests: [request], page: 1, total: 1, totalPages: 1 } });
});

test('approves a transfer with a recipient confirmation and displays the server result', async () => {
  adminService.approveWithdrawal.mockResolvedValue({ message: 'Đang chuyển tiền', data: { request: { ...request, status: 'processing' } } });
  render(<QuanLyRutTien />);
  fireEvent.click(await screen.findByRole('button', { name: 'Phê duyệt', exact: true }));
  expect(screen.queryByText(/1234567890\. Hệ thống sẽ gửi/)).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Phê duyệt chuyển tiền', exact: true }));
  await waitFor(() => expect(adminService.approveWithdrawal).toHaveBeenCalledWith('request-1', ''));
  await waitFor(() => expect(mockSuccess).toHaveBeenCalledWith('Đang chuyển tiền'));
});

test('requires a reason to reject a withdrawal', async () => {
  render(<QuanLyRutTien />);
  fireEvent.click(await screen.findByRole('button', { name: 'Từ chối', exact: true }));
  expect(screen.getByRole('button', { name: 'Xác nhận từ chối' }).disabled).toBe(true);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Sai tài khoản' } });
  adminService.rejectWithdrawal.mockResolvedValue({});
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận từ chối' }));
  await waitFor(() => expect(adminService.rejectWithdrawal).toHaveBeenCalledWith('request-1', 'Sai tài khoản'));
});

test('processing withdrawals offer reconciliation instead of approval or rejection', async () => {
  adminService.getWithdrawals.mockResolvedValue({ data: { requests: [{ ...request, status: 'processing' }] } });
  render(<QuanLyRutTien />);
  await screen.findByRole('button', { name: 'Kiểm tra trạng thái' });
  expect(screen.queryByRole('button', { name: 'Phê duyệt', exact: true })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Từ chối', exact: true })).toBeNull();
});
