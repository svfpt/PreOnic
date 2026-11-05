# Xác thực email khi đăng ký

Đăng ký bằng email tạo tài khoản chưa xác thực, gửi OTP 6 chữ số và mở form nhập mã. Xác thực thành công sẽ tạo phiên đăng nhập và chuyển đến trang theo vai trò tài khoản. Không yêu cầu OTP cho mỗi lần đăng nhập.

## Cấu hình gửi email

Điền trực tiếp vào `be/.env` (không commit mật khẩu):

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="PreOnic <your-email@gmail.com>"
```

Với Gmail, dùng mật khẩu ứng dụng của tài khoản đã bật xác minh hai bước. Với nhà cung cấp SMTP khác, dùng host, port và thông tin đăng nhập do nhà cung cấp cấp. `SMTP_SECURE=true` dành cho kết nối TLS trực tiếp, thường là cổng 465.

Máy chủ chặn SMTP có thể dùng Brevo: điền `BREVO_API_KEY` và `SMTP_FROM` bằng địa chỉ người gửi đã xác minh trên Brevo. Khi có khóa Brevo, hệ thống ưu tiên API này.

Sau khi đổi `.env`, khởi động lại tiến trình backend đang chạy. Không mở thêm backend trên cùng cổng 8080.

## Kiểm tra trên giao diện

1. Đăng ký bằng email mới có thể nhận thư; kiểm tra cả Spam.
2. Thử đăng nhập trước khi xác thực: bị chặn và được đưa đến form OTP.
3. Nhập mã trong email: xác thực thành công và tự động vào trang theo vai trò, không cần nhập lại mật khẩu.
4. Thử mã sai/hết hạn. Mã hết hạn sau 10 phút, tối đa 5 lần sai. Mã đã dùng không thể dùng lại.
5. Sau 60 giây, gửi lại mã; chỉ mã mới có hiệu lực. Mỗi tài khoản được gửi tối đa 5 email/giờ. IP cũng có giới hạn riêng.

Nếu gửi email lỗi, tài khoản vẫn chưa được xác thực. Mở `/verify-email`, nhập email đã đăng ký và yêu cầu mã mới sau khi sửa cấu hình. Các link xác thực cũ không còn hiệu lực.

Tài khoản đã có `isVerified=true` tiếp tục đăng nhập bình thường. Tài khoản cũ chưa xác thực phải yêu cầu OTP mới; token đăng nhập/refresh cũ cũng bị chặn. Google chỉ được dùng với email mà Google xác nhận đã xác thực; tài khoản email đã tồn tại và chưa xác thực vẫn phải hoàn tất OTP.

## API

- `POST /api/v1/auth/register`: trả `requiresVerification`, email và thời gian chờ; không trả OTP, link hoặc token đăng nhập.
- `POST /api/v1/auth/verify-email`: body `{ "email": "...", "otp": "012345" }`.
- `POST /api/v1/auth/resend-verification`: body `{ "email": "..." }`, không cần đăng nhập. Phản hồi chung cho địa chỉ không tồn tại, đã xác thực hoặc đang bị giới hạn gửi.

OTP chỉ lưu dưới dạng HMAC trong MongoDB. Các kiểm thử tự động dùng database riêng và mô phỏng gửi email, không gửi thư thật.

Xác thực OTP thành công trả `data.user`, `data.accessToken` và đặt cookie refresh token HttpOnly giống đăng nhập. Mã sai, hết hạn hoặc đã dùng không tạo phiên đăng nhập.
