import dotenv from 'dotenv';
import app from './server/app.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`🚀 ĐẤU TRƯỜNG NGÔN NGỮ - FPT POLYTECHNIC`);
  console.log(`📍 Máy chủ đang chạy tại: http://localhost:${PORT}`);
  console.log(`🛠️  Trang quản trị Admin: http://localhost:${PORT}/admin`);
  console.log(`📱 Mạng LAN (cùng Wi-Fi): http://<địa_chỉ_IP_máy>:${PORT}`);
  console.log(`⏰ Múi giờ hệ thống: ${process.env.TIMEZONE || 'Asia/Ho_Chi_Minh'}`);
  console.log('====================================================');
});
