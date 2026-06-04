/**
 * Auth middleware — JWT verification for API endpoints
 * Uses lib/jwt.js verify(), zero external dependencies
 */
const { verify } = require('./jwt');

const JWT_SECRET = process.env.JWT_SECRET || 'biubiu_wc_2026_secret_change_me';

function verifyToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  return verify(token, JWT_SECRET);
}

function requireVip(req) {
  const payload = verifyToken(req);
  if (!payload) return { error: '请先登录', status: 401 };
  if (!payload.vip) return { error: '需要VIP权限', status: 403 };
  if (payload.vipExpiry && new Date(payload.vipExpiry) < new Date()) {
    return { error: 'VIP已过期', status: 403 };
  }
  return { payload };
}

module.exports = { verifyToken, requireVip };
