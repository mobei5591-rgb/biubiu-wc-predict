/**
 * GET /api/wx-login — generates WeChat OAuth URL + QR code page
 *
 * Query: ?redirect=URL (where to go after login, optional)
 */
const { getOAuthUrl, getConfig } = require('../lib/wx-auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { appid } = getConfig();

  if (!appid || appid === 'wx_your_appid_here') {
    return res.status(200).json({
      ready: false,
      message: '请在 .env 配置 WX_APPID 和 WX_SECRET（微信公众号测试号）'
    });
  }

  // Generate random state for CSRF protection
  const state = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  const oauthUrl = getOAuthUrl(state);
  const redirectTo = req.query?.redirect || '/';

  // Store state in redirect URL so callback can pass user back
  const finalUrl = `${oauthUrl}&redirect_to=${encodeURIComponent(redirectTo)}`;

  res.status(200).json({
    ready: true,
    state,
    oauthUrl: finalUrl,
    redirectTo,
    // Mobile: redirect directly to WeChat OAuth
    // Desktop: show QR code pointing to this URL
    qrUrl: finalUrl
  });
};
