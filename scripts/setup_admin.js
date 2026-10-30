import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { writeJson, PATHS } from '../server/storage/jsonStore.js';

dotenv.config();

async function setupAdmin() {
  const username = process.argv[2] || process.env.ADMIN_USERNAME || 'admin';
  const password = process.argv[3] || process.env.ADMIN_PASSWORD || 'AdminPoly@2026';

  console.log(`Đang cấu hình tài khoản Admin: [${username}]...`);
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const adminConfig = {
    username,
    passwordHash,
    role: 'admin',
    updatedAt: new Date().toISOString()
  };

  await writeJson(PATHS.ADMIN, adminConfig);
  console.log(`✓ Đã cập nhật thành công tài khoản Admin.`);
  console.log(`  Tài khoản: ${username}`);
  console.log(`  Mật khẩu:  ${password}`);
}

setupAdmin().catch(console.error);
