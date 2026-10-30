import crypto from 'crypto';
import { readJson, updateJson, PATHS } from '../storage/jsonStore.js';

const SESSIONS = new Map(); // token -> { playerId, expiresAt }
const RATE_LIMIT_RECOVERY = new Map(); // ip/key -> { count, resetAt }

/**
 * Sinh chuỗi ngẫu nhiên an toàn
 */
function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Sinh mã khôi phục thân thiện ví dụ: DTNN-7K2M-9P4X
 */
function generateRecoveryCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars[crypto.randomInt(0, chars.length)];
    part2 += chars[crypto.randomInt(0, chars.length)];
  }
  return `DTNN-${part1}-${part2}`;
}

/**
 * Hash mã khôi phục bằng SHA-256
 */
function hashRecoveryCode(code) {
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(clean).digest('hex');
}

/**
 * Tạo hồ sơ người chơi mới
 */
export async function createPlayer(displayName, studentId = '', studentClass = '', publicClass = false) {
  const name = displayName?.trim();
  if (!name || name.length < 2 || name.length > 50) {
    throw new Error('Tên hiển thị phải từ 2 đến 50 ký tự.');
  }

  const playerId = 'ply_' + crypto.randomUUID();
  const rawRecoveryCode = generateRecoveryCode();
  const recoveryCodeHash = hashRecoveryCode(rawRecoveryCode);
  const now = new Date().toISOString();

  const newPlayer = {
    playerId,
    displayName: name,
    studentId: studentId?.trim() || '',
    studentClass: studentClass?.trim() || '',
    publicClass: Boolean(publicClass),
    recoveryCodeHash,
    recoveryCodeAttempts: 0,
    recoveryCodeLockedUntil: null,
    createdAt: now,
    lastActiveAt: now
  };

  await updateJson(PATHS.PLAYERS, (players = []) => {
    players.push(newPlayer);
    return players;
  }, []);

  const sessionToken = generateToken();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 ngày
  SESSIONS.set(sessionToken, { playerId, expiresAt });

  return {
    player: sanitizePlayerProfile(newPlayer, true),
    rawRecoveryCode,
    sessionToken
  };
}

/**
 * Lấy thông tin người chơi theo Token
 */
export async function getPlayerByToken(token) {
  if (!token) return null;
  const session = SESSIONS.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) SESSIONS.delete(token);
    return null;
  }

  const players = await readJson(PATHS.PLAYERS, []);
  const player = players.find(p => p.playerId === session.playerId);
  if (!player) return null;

  // Cập nhật lastActiveAt không đồng bộ nhẹ
  player.lastActiveAt = new Date().toISOString();
  return player;
}

/**
 * Khôi phục hồ sơ bằng mã khôi phục
 */
export async function recoverPlayer(recoveryCode, clientIp = 'global') {
  if (!recoveryCode || !recoveryCode.trim()) {
    throw new Error('Vui lòng nhập mã khôi phục.');
  }

  // Rate limit theo IP
  const now = Date.now();
  const rateKey = `recover_${clientIp}`;
  const rate = RATE_LIMIT_RECOVERY.get(rateKey) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (rate.resetAt < now) {
    rate.count = 0;
    rate.resetAt = now + 15 * 60 * 1000;
  }
  if (rate.count >= 5) {
    const waitMins = Math.ceil((rate.resetAt - now) / 60000);
    throw new Error(`Bạn đã thử quá 5 lần. Vui lòng thử lại sau ${waitMins} phút.`);
  }

  rate.count++;
  RATE_LIMIT_RECOVERY.set(rateKey, rate);

  const targetHash = hashRecoveryCode(recoveryCode);
  const players = await readJson(PATHS.PLAYERS, []);

  const player = players.find(p => {
    if (p.recoveryCodeLockedUntil && new Date(p.recoveryCodeLockedUntil).getTime() > now) {
      return false;
    }
    return p.recoveryCodeHash === targetHash;
  });

  if (!player) {
    throw new Error('Mã khôi phục không chính xác hoặc đã hết hiệu lực.');
  }

  // Reset rate count nếu thành công
  RATE_LIMIT_RECOVERY.delete(rateKey);

  const sessionToken = generateToken();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  SESSIONS.set(sessionToken, { playerId: player.playerId, expiresAt });

  return {
    player: sanitizePlayerProfile(player, true),
    sessionToken
  };
}

/**
 * Cấp lại mã khôi phục mới cho người chơi hiện tại
 */
export async function regenerateRecoveryCode(playerId) {
  const rawRecoveryCode = generateRecoveryCode();
  const recoveryCodeHash = hashRecoveryCode(rawRecoveryCode);

  let updatedPlayer = null;
  await updateJson(PATHS.PLAYERS, (players = []) => {
    const p = players.find(item => item.playerId === playerId);
    if (!p) throw new Error('Không tìm thấy người chơi.');
    p.recoveryCodeHash = recoveryCodeHash;
    p.recoveryCodeAttempts = 0;
    p.recoveryCodeLockedUntil = null;
    p.lastActiveAt = new Date().toISOString();
    updatedPlayer = p;
    return players;
  });

  return {
    rawRecoveryCode,
    player: sanitizePlayerProfile(updatedPlayer, true)
  };
}

/**
 * Cập nhật thông tin cá nhân của người chơi
 */
export async function updatePlayerProfile(playerId, { displayName, studentId, studentClass, publicClass }) {
  let updatedPlayer = null;
  await updateJson(PATHS.PLAYERS, (players = []) => {
    const p = players.find(item => item.playerId === playerId);
    if (!p) throw new Error('Không tìm thấy người chơi.');

    if (displayName !== undefined) {
      const name = displayName?.trim();
      if (!name || name.length < 2 || name.length > 50) {
        throw new Error('Tên hiển thị phải từ 2 đến 50 ký tự.');
      }
      p.displayName = name;
    }

    if (studentId !== undefined) p.studentId = studentId?.trim() || '';
    if (studentClass !== undefined) p.studentClass = studentClass?.trim() || '';
    if (publicClass !== undefined) p.publicClass = Boolean(publicClass);

    p.lastActiveAt = new Date().toISOString();
    updatedPlayer = p;
    return players;
  });

  return sanitizePlayerProfile(updatedPlayer, true);
}

/**
 * Đăng xuất / Hủy session hiện tại trên thiết bị
 */
export function revokeSession(token) {
  if (token) {
    SESSIONS.delete(token);
  }
}

/**
 * Lọc thông tin an toàn trả về cho frontend
 */
export function sanitizePlayerProfile(player, isOwner = false) {
  if (!player) return null;
  const base = {
    playerId: player.playerId,
    displayName: player.displayName,
    publicClass: player.publicClass,
    createdAt: player.createdAt
  };

  if (isOwner) {
    base.studentId = player.studentId;
    base.studentClass = player.studentClass;
    base.lastActiveAt = player.lastActiveAt;
  } else if (player.publicClass) {
    base.studentClass = player.studentClass;
  }

  return base;
}
