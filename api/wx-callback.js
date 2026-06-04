/**
 * GET /api/wx-callback — WeChat OAuth callback
 *
 * WeChat redirects user here with ?code=XXX&state=YYY
 * Server exchanges code for user info → creates JWT → redirects to login page with token
 */
const { exchangeCode, getUserInfo } = require('../lib/wx-auth');
const { sign } = require('../lib/jwt');

const JWT_SECRET = process.env.JWT_SECRET || 'biubiu_wc_2026_secret_change_me';

module.exports = async function handler(req, res) {
  const { code, state } = req.query || {};

  if (!code) {
    // No code - try to show login page via JSON
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`
      <!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
      <title>biubiu登录</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0e14;color:#e8e6e3;text-align:center;flex-direction:column;gap:16px}</style></head>
      <body><h2>⚽ biubiu陪我看球</h2><p>微信扫码登录</p><p style="color:#ffd700">请在微信内打开此链接</p><p style="font-size:12px;color:#8b95a5">或从网页端点击"微信登录"按钮</p></body></html>`);
  }

  try {
    // Exchange code for access_token
    const { accessToken, openid } = await exchangeCode(code);

    // Get user info (nickname, avatar)
    let userInfo;
    try {
      userInfo = await getUserInfo(accessToken, openid);
    } catch {
      // Fallback if userinfo fails (snsapi_base)
      userInfo = { openid, nickname: '球迷' + openid.slice(-6), avatar: '' };
    }

    // Check if user is VIP (from env var VIP_OPENIDS, comma-separated)
    const vipOpenids = (process.env.VIP_OPENIDS || '').split(',').map(s => s.trim()).filter(Boolean);
    const isVip = vipOpenids.includes(openid);
    const vipExpiry = isVip ? (process.env.VIP_EXPIRY || '2026-07-19') : null;

    // Create JWT token with vip flag
    const token = sign({
      sub: openid,
      name: userInfo.nickname,
      avatar: userInfo.avatar,
      provider: 'wechat',
      vip: isVip,
      vipExpiry
    }, JWT_SECRET);

    // Extract redirect_to from state or default to /
    const redirectTo = (req.query?.redirect_to) ? decodeURIComponent(req.query.redirect_to) : '/';

    // Redirect to homepage with token in URL hash (never goes to server logs)
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(`
      <!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
      <title>正在登录...</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0e14;color:#e8e6e3;flex-direction:column;gap:12px}</style></head>
      <body>
        <div style="font-size:48px">⚽</div>
        <p style="color:#ffd700;font-weight:700">biubiu登录成功！</p>
        <p style="font-size:13px;color:#8b95a5">${userInfo.nickname}，欢迎回来</p>
        <script>
          // Pass token via URL hash (secure, never sent to server)
          window.location.href = '${redirectTo}#token=${token}&name=${encodeURIComponent(userInfo.nickname)}&avatar=${encodeURIComponent(userInfo.avatar || '')}';
        </script>
      </body></html>`);
  } catch (err) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(`
      <!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
      <title>登录失败</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0e14;color:#e8e6e3;flex-direction:column;gap:12px}</style></head>
      <body>
        <div style="font-size:48px">😵</div>
        <p>登录失败：${err.message}</p>
        <a href="/" style="color:#ffd700">返回首页</a>
      </body></html>`);
  }
};
