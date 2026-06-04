/**
 * GET /api/me — return current user identity from JWT
 * Free users: { vip: false }
 * VIP users: { vip: true, vipExpiry: '...' }
 */
const { verifyToken } = require('../lib/auth');

module.exports = async function handler(req, res) {
  const payload = verifyToken(req);

  if (!payload) {
    return res.status(200).json({ vip: false, name: null, avatar: null });
  }

  return res.status(200).json({
    openid: payload.sub || null,
    name: payload.name || null,
    avatar: payload.avatar || null,
    vip: payload.vip || false,
    vipExpiry: payload.vipExpiry || null
  });
};
