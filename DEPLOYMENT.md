# Deploy PreOnic lên Render + Vercel

## Thanh toán payOS

- Backend dùng SDK chính thức `@payos/node`: https://payos.vn/docs/sdks/back-end/node/
- Điền `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` trong `be/.env` ở máy local hoặc biến môi trường backend khi deploy. Không commit khóa thật.
- Đặt `FRONTEND_URL` bằng URL giao diện, ví dụ `http://localhost:3000` khi chạy local. payOS trả người dùng về `/payment/success` hoặc `/payment/cancel`.
- Trong kênh thanh toán tại https://my.payos.vn, đăng ký webhook `https://<backend-public>/api/v1/payment/webhook`. Backend local cần URL HTTPS public (tunnel) để nhận webhook.
- MongoDB phải hỗ trợ transaction: dùng Atlas hoặc replica set local. MongoDB standalone không thể hoàn tất bước cộng ví thật. Test tự chạy replica set riêng trong bộ nhớ.
- Giao diện Ví → Nạp tiền → Tạo lệnh payOS tự chuyển sang trang thanh toán payOS trong cùng tab. Hệ thống chỉ cộng số tiền của lệnh khi API payOS xác nhận `PAID`, không dựa vào query trên URL trả về. Giới hạn mỗi lệnh là 10.000–500.000.000 VND.
- payOS là cổng thanh toán duy nhất. Webhook và xác minh dùng chung bước cộng ví bằng transaction, chống cộng trùng. Chuyển khoản thiếu tiếp tục chờ; thanh toán thừa chỉ cộng giá trị lệnh và cần đối soát khoản thừa.
- Trước khi dùng thật: kiểm tra tạo link, thanh toán thành công, hủy, webhook gửi lại và đối chiếu số dư/lịch sử. Bộ test giả lập API payOS không thay thế thanh toán thử trên kênh thật.

## Chạy local trên máy đã cấu hình

## Rút tiền tự động qua payOS

- Cấu hình bộ khóa **riêng của kênh chi** trong `be/.env` hoặc biến môi trường backend: `PAYOS_PAYOUT_CLIENT_ID`, `PAYOS_PAYOUT_API_KEY`, `PAYOS_PAYOUT_CHECKSUM_KEY`. Không thay bộ khóa kênh thu `PAYOS_*` đang dùng để nạp tiền.
- Kích hoạt kênh chi, liên kết nguồn tiền, gói dịch vụ và hạn mức theo https://payos.vn/docs/huong-dan-su-dung/kenh-chi/tao-kenh-chuyen-tien/. IP được phép phải là IP public **đầu ra của backend**, không phải IP tunnel webhook.
- Build backend rồi chạy `node be/scripts/check-payout.cjs` từ thư mục dự án để kiểm tra kết nối và số dư nguồn chi. Lệnh này chỉ đọc, không chuyển tiền.
- Chỉ sau khi kiểm tra thành công, đặt `PAYOS_PAYOUT_ENABLED=true` và khởi động lại backend để cho phép phê duyệt gửi tiền thật. Mặc định là tắt.
- Người dùng tạo yêu cầu: số tiền được trừ khỏi **số dư khả dụng** và ghi giao dịch đang giữ. Không thể dùng tiền đang giữ để ký quỹ hoặc rút lần khác. Yêu cầu cũ đang chờ được chuyển sang giữ tiền khi backend kết nối DB; nếu số dư không đủ, admin phải kiểm tra và từ chối yêu cầu không còn đủ điều kiện.
- Admin dùng `PATCH /api/v1/admin/withdrawals/:id/approve`; endpoint `/complete` cũ đã bỏ. Duyệt không đồng nghĩa đã chuyển thành công. Backend kiểm tra nguồn tiền, gửi một lệnh chi bằng reference/idempotency key được lưu bền vững và chỉ hoàn tất sau khi giao dịch payOS là `SUCCEEDED` và khớp ngân hàng, số tài khoản, số tiền.
- Background job đối soát mỗi phút; admin có thể dùng `POST /api/v1/admin/withdrawals/:id/sync`. Không dùng webhook kênh thu để xác nhận lệnh chi.
- Khi timeout/crash sau khi bắt đầu gửi, hệ thống chỉ tra cứu lệnh theo reference, **không tự gửi lại**, không cho từ chối và không hoàn tiền khi chưa rõ kết quả. Nếu không tìm được lệnh, cần đối soát thủ công với kênh chi trước khi xử lý tiếp. Không tạo yêu cầu thay thế để chi lần hai.
- Khi payOS xác nhận chuyển thất bại hoặc admin từ chối trước khi gửi, số tiền giữ được hoàn lại đúng một lần. Không tự retry lệnh đã thất bại. Các trường hợp đảo giao dịch sau khi đã thành công cần đối soát vận hành với payOS.
- Không thay kênh chi khi còn yêu cầu đang xử lý; hệ thống giữ fingerprint kênh gốc và chặn đối soát bằng kênh khác.
- Danh mục BIN ngân hàng được lưu từ https://api.vietqr.io/v2/banks tại `be/src/data/banks.json`. Người dùng phải chọn ngân hàng trong danh sách và tự kiểm tra chính xác tài khoản nhận tiền; admin nhìn thấy thông tin người nhận trước khi duyệt.

### Khởi động local

Từ thư mục dự án, chạy `powershell -ExecutionPolicy Bypass -File .\start-local.ps1` để mở MongoDB replica set cổng 27018, backend và frontend. Database được sao chép từ dịch vụ MongoDB cũ và lưu ở `.local/mongo-rs/data`; dịch vụ cũ cổng 27017 giữ nguyên. Ứng dụng dùng URI trong `be/.env`.

Để mở lại tunnel và đăng ký URL webhook mới với payOS, chạy `powershell -ExecutionPolicy Bypass -File .\start-webhook.ps1`. Cần có `.local/tools/cloudflared.exe`. Tunnel thử nghiệm đổi URL khi khởi động lại; script tự cập nhật webhook bằng SDK. Chỉ endpoint webhook và health check được đưa ra public qua proxy cổng 8081. Thư mục `.local` chứa dữ liệu/log local, không commit lên Git.

## 1) Backend trên Render

- Tạo Web Service từ repo này, root directory là `be`.
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Health check path: `/health`
- Dùng các biến môi trường sau:
  - `NODE_ENV=production`
  - `API_PREFIX=/api/v1`
  - `MONGODB_URI=<MongoDB Atlas connection string>`
  - `JWT_SECRET=<secret mạnh>`
  - `JWT_REFRESH_SECRET=<secret mạnh khác>`
  - `FRONTEND_URL=https://<ten-frontend>.vercel.app`
  - `FRONTEND_URLS` nếu cần thêm preview URLs

## 2) Frontend trên Vercel

- Import repo này vào Vercel, root directory là `fe`.
- Framework preset: Create React App.
- Build command: `npm run build`
- Output directory: `build`
- Dùng biến môi trường:
  - `REACT_APP_API_URL=https://<ten-backend>.onrender.com/api/v1`

## 3) Trình tự deploy khuyến nghị

1. Deploy backend lên Render trước.
2. Lấy URL public của backend trên Render.
3. Deploy frontend lên Vercel và set `REACT_APP_API_URL` trỏ về backend Render.
4. Quay lại Render, set `FRONTEND_URL` đúng domain Vercel production.

## 4) Kiểm tra sau deploy

- Mở `https://<ten-backend>.onrender.com/health` để xác nhận backend sống.
- Mở frontend trên Vercel và kiểm tra đăng nhập, tải danh sách sản phẩm, upload ảnh.
- Nếu browser báo lỗi CORS, kiểm tra lại `FRONTEND_URL` và `FRONTEND_URLS` trên Render.
