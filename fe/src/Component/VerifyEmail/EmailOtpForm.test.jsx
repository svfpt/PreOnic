import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EmailOtpForm from './EmailOtpForm';
import authService from '../../services/auth.service';
import { ROUTES } from '../../constants';
const mockNavigate = jest.fn();
const mockUpdateUser = jest.fn();
jest.mock('../../services/auth.service', () => ({ verifyEmail: jest.fn(), resendVerification: jest.fn() }));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ updateUser: mockUpdateUser }) }));

beforeEach(() => jest.resetAllMocks());
const setup = props => render(<EmailOtpForm initialEmail="user@example.com" {...props} />);

test.each([['farmer', ROUTES.FARMER], ['enterprise', ROUTES.ENTERPRISE], ['admin', ROUTES.ADMIN]])('logs in and redirects %s after verification', async (role, destination) => {
  const user = { role, email: 'user@example.com' };
  authService.verifyEmail.mockResolvedValue({ success: true, data: { user, accessToken: 'test-token' } });
  setup();
  fireEvent.change(screen.getByLabelText('Mã OTP'), { target: { value: '012345' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác thực OTP' }));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(destination, { replace: true }));
  expect(authService.verifyEmail).toHaveBeenCalledWith({ email: 'user@example.com', otp: '012345' });
  expect(mockUpdateUser).toHaveBeenCalledWith(user);
});

test('requires all six digits before calling the API', () => {
  setup();
  fireEvent.change(screen.getByLabelText('Mã OTP'), { target: { value: '123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác thực OTP' }));
  expect(screen.getByRole('alert').textContent).toContain('6 chữ số');
  expect(authService.verifyEmail).not.toHaveBeenCalled();
});

test('shows expired-code errors and permits requesting a new code', async () => {
  authService.verifyEmail.mockRejectedValue({ message: 'OTP đã hết hạn' });
  authService.resendVerification.mockResolvedValue({ message: 'Đã gửi OTP', data: { resendAfterSeconds: 60 } });
  setup();
  fireEvent.change(screen.getByLabelText('Mã OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác thực OTP' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('OTP đã hết hạn'));
  expect(mockUpdateUser).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Gửi mã OTP' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Đã gửi OTP'));
  expect(authService.resendVerification).toHaveBeenCalledWith('user@example.com');
  expect(screen.getByLabelText('Mã OTP').value).toBe('');
  expect(screen.getByRole('button', { name: 'Gửi lại sau 60s' }).disabled).toBe(true);
});

test('does not resend automatically after registration or on mounting', () => {
  setup({ initiallySent: true });
  expect(screen.getByRole('button', { name: 'Gửi lại sau 60s' }).disabled).toBe(true);
  expect(authService.resendVerification).not.toHaveBeenCalled();
});

test('shows delivery failures without displaying a fallback verification link', async () => {
  authService.resendVerification.mockRejectedValue({ message: 'Chưa cấu hình email' });
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Gửi mã OTP' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Chưa cấu hình email'));
  expect(screen.queryByRole('link', { name: /xác minh/i })).toBeNull();
});
