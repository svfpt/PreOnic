# Deploy PreOnic lên Render + Vercel

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