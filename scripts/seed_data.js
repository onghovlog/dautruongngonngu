import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { round1Questions } from './data_round1.js';
import { round2Questions } from './data_round2.js';
import { round3Questions } from './data_round3.js';
import { round4Questions } from './data_round4.js';
import { findCrosswordSet } from './test_crossword_builder.js';
import { writeJson, PATHS } from '../server/storage/jsonStore.js';

dotenv.config();

async function seed() {
  console.log("=== BẮT ĐẦU SEED DỮ LIỆU ĐẤU TRƯỜNG NGÔN NGỮ ===");

  // 1. Ghi 4 kho câu hỏi
  console.log("1. Đang lưu 4 kho câu hỏi chuẩn (400 câu)...");
  await writeJson(PATHS.ROUND1, round1Questions);
  console.log(`   ✓ Vòng 1 (Khởi động): ${round1Questions.length} câu`);

  await writeJson(PATHS.ROUND2, round2Questions);
  console.log(`   ✓ Vòng 2 (Tranh tài): ${round2Questions.length} câu`);

  await writeJson(PATHS.ROUND3, round3Questions);
  console.log(`   ✓ Vòng 3 (Bán kết): ${round3Questions.length} câu`);

  await writeJson(PATHS.ROUND4, round4Questions);
  console.log(`   ✓ Vòng 4 (Chung kết): ${round4Questions.length} câu`);

  // 2. Tạo và lưu 5 bộ ô chữ chuẩn đã duyệt
  console.log("2. Đang tạo 5 bộ ô chữ Chung kết đã duyệt...");
  const targets = [
    { keyword: "ĐẤT NƯỚC TÔI", title: "Đất Nước Tôi" },
    { keyword: "VĂN HÓA VIỆT", title: "Văn Hóa Việt" },
    { keyword: "TRÍ TUỆ VIỆT", title: "Trí Tuệ Việt" },
    { keyword: "NGÔN NGỮ TÔI", title: "Ngôn Ngữ Tôi" },
    { keyword: "BẢN SẮC VIỆT", title: "Bản Sắc Việt" }
  ];

  const crosswords = [];
  for (const t of targets) {
    const cw = findCrosswordSet(t.keyword, t.title);
    crosswords.push(cw);
  }
  await writeJson(PATHS.CROSSWORDS, crosswords);
  console.log(`   ✓ Đã lưu ${crosswords.length} bộ ô chữ chuẩn.`);

  // 3. Tạo mùa giải mặc định
  console.log("3. Đang khởi tạo Mùa giải (Season)...");
  const seasons = [
    {
      id: "season_2026_01",
      name: "Mùa Khởi Tranh 2026",
      description: "Mùa giải tranh tài tiếng Việt dành cho sinh viên FPT Polytechnic",
      status: "active",
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      endedAt: null,
      rules: {
        pointsPerRound: {
          khoi_dong: 10,
          tranh_tai: 20,
          ban_ket: 30,
          chung_ket: 40
        },
        keywordBonus: 100,
        timePerQuestionSeconds: 10,
        keywordGuessTimeSeconds: 10,
        difficultyRatio: {
          khoi_dong: { de: 6, vua: 3, kho: 1 },
          tranh_tai: { de: 3, vua: 5, kho: 2 },
          ban_ket: { de: 2, vua: 4, kho: 4 },
          chung_ket: { de: 1, vua: 3, kho: 6 }
        }
      }
    }
  ];
  await writeJson(PATHS.SEASONS, seasons);
  console.log(`   ✓ Đã kích hoạt Mùa giải: ${seasons[0].name}`);

  // 4. Khởi tạo Admin Account
  console.log("4. Đang thiết lập tài khoản Admin...");
  const adminUser = process.env.ADMIN_USERNAME || "admin";
  const adminPass = process.env.ADMIN_PASSWORD || "AdminPoly@2026";
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(adminPass, salt);

  const adminConfig = {
    username: adminUser,
    passwordHash,
    role: "admin",
    updatedAt: new Date().toISOString()
  };
  await writeJson(PATHS.ADMIN, adminConfig);
  console.log(`   ✓ Đã cấu hình Admin: ${adminUser}`);

  // 5. Khởi tạo các file dữ liệu người chơi, lượt chơi, audit log nếu chưa có
  if (!fs.existsSync(PATHS.PLAYERS)) {
    await writeJson(PATHS.PLAYERS, []);
  }
  if (!fs.existsSync(PATHS.ATTEMPTS)) {
    await writeJson(PATHS.ATTEMPTS, []);
  }
  if (!fs.existsSync(PATHS.AUDIT_LOGS)) {
    await writeJson(PATHS.AUDIT_LOGS, []);
  }

  console.log("=== HOÀN TẤT SEED DỮ LIỆU THÀNH CÔNG ===");
}

seed().catch(err => {
  console.error("Lỗi khi seed dữ liệu:", err);
  process.exit(1);
});
