import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Profile from './Profile';
import authService from '../../services/auth.service';
import productService from '../../services/product.service';
const mockUser = { fullName: 'Test Farmer', email: 'farmer@example.com', role: 'farmer', phone: '0901234567', province: 'Đà Nẵng', farmName: 'Green Farm', isVerified: true };
const mockUpdateUser = jest.fn();
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn(), useSearchParams: () => [new URLSearchParams()] }), { virtual: true });
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser, updateUser: mockUpdateUser }) }));
jest.mock('../../contexts/ToastContext', () => ({ useToast: () => mockToast }));
jest.mock('../../hooks/useApiData', () => ({ formatMoney: value => String(value) }));
jest.mock('../../services/auth.service', () => ({ getMe: jest.fn(), updateProfile: jest.fn(), updatePassword: jest.fn() }));
jest.mock('../../services/product.service', () => ({ uploadImage: jest.fn() }));
beforeAll(() => { URL.createObjectURL = jest.fn(() => 'blob:avatar-preview'); URL.revokeObjectURL = jest.fn(); });
beforeEach(() => { jest.clearAllMocks(); URL.createObjectURL.mockReturnValue('blob:avatar-preview'); authService.getMe.mockResolvedValue({ data: { user: mockUser } }); });
const edit = async () => {
  render(<Profile />);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Test Farmer' })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
};
test('requires province even when a street address exists', async () => {
  await edit();
  fireEvent.change(screen.getByLabelText('Tỉnh/Thành phố'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Địa chỉ chi tiết'), { target: { value: '123 Main Street' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  expect(screen.getByText('Vui lòng nhập tỉnh/thành phố')).toBeTruthy();
  expect(authService.updateProfile).not.toHaveBeenCalled();
});
test('rejects negative farm area', async () => {
  await edit();
  fireEvent.change(screen.getByLabelText('Diện tích (ha)'), { target: { value: '-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  expect(screen.getByText('Diện tích phải là số không âm')).toBeTruthy();
  expect(authService.updateProfile).not.toHaveBeenCalled();
});
test('saves profile changes and updates the signed-in user', async () => {
  const updated = { ...mockUser, farmName: 'Updated Farm' };
  authService.updateProfile.mockResolvedValue({ data: { user: updated } });
  await edit();
  fireEvent.change(screen.getByLabelText('Tên nông trại'), { target: { value: updated.farmName } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith(updated));
  expect(authService.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ farmName: updated.farmName }));
});
test('cancel discards unsaved profile changes', async () => {
  await edit();
  fireEvent.change(screen.getByLabelText('Tên nông trại'), { target: { value: 'Unsaved Farm' } });
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }));
  expect(screen.getByLabelText('Tên nông trại').value).toBe(mockUser.farmName);
  expect(authService.updateProfile).not.toHaveBeenCalled();
});

test('previews an avatar, then uploads and saves it only after confirmation', async () => {
  const avatar = 'https://res.cloudinary.com/test/image/upload/avatar.jpg';
  productService.uploadImage.mockResolvedValue(avatar);
  authService.updateProfile.mockResolvedValue({ data: { user: { ...mockUser, avatar } } });
  render(<Profile />);
  await waitFor(() => expect(authService.getMe).toHaveBeenCalled());
  const file = new File(['photo'], 'avatar.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Chọn ảnh đại diện'), { target: { files: [file] } });
  expect(screen.getByAltText('Ảnh đại diện').getAttribute('src')).toBe('blob:avatar-preview');
  expect(productService.uploadImage).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Lưu ảnh đại diện' }));
  await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith(expect.objectContaining({ avatar })));
  expect(authService.updateProfile).toHaveBeenCalledWith({ avatar });
});

test('rejects unsupported files and oversized photos before uploading', async () => {
  render(<Profile />);
  await waitFor(() => expect(authService.getMe).toHaveBeenCalled());
  const input = screen.getByLabelText('Chọn ảnh đại diện');
  fireEvent.change(input, { target: { files: [new File(['pdf'], 'document.pdf', { type: 'application/pdf' })] } });
  expect(screen.getByRole('alert').textContent).toContain('JPG, PNG hoặc WebP');
  const big = new File(['photo'], 'big.png', { type: 'image/png' });
  Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1 });
  fireEvent.change(input, { target: { files: [big] } });
  expect(screen.getByRole('alert').textContent).toContain('5MB');
  expect(productService.uploadImage).not.toHaveBeenCalled();
});

test('keeps the current avatar when saving fails', async () => {
  productService.uploadImage.mockRejectedValue(new Error('Cloudinary không khả dụng'));
  render(<Profile />);
  await waitFor(() => expect(authService.getMe).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText('Chọn ảnh đại diện'), { target: { files: [new File(['photo'], 'avatar.png', { type: 'image/png' })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu ảnh đại diện' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Cloudinary không khả dụng'));
  expect(authService.updateProfile).not.toHaveBeenCalled();
  expect(mockUpdateUser).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Hủy đổi ảnh' }));
  expect(screen.queryByAltText('Ảnh đại diện')).toBeNull();
});
