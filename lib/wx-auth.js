/**
 * WeChat Official Account OAuth — test account (free, no enterprise cert needed)
 *
 * Flow:
 * 1. GET /api/wx-login → returns { url, state } for OAuth redirect
 * 2. User authorizes in WeChat
 * 3. WeChat redirects to /api/wx-callback?code=XXX&state=YYY
 * 4. Server exchanges code for openid + userinfo
 * 5. Returns JWT token + user data
 */

// Config from env
function getConfig() {
  const appid = process.env.WX_APPID || '';
  const secret = process.env.WX_SECRET || '';
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  return { appid, secret, siteUrl };
}

/**
 * Generate WeChat OAuth redirect URL
 * scope: snsapi_base (silent, only openid) or snsapi_userinfo (gets nickname+avatar)
 */
function getOAuthUrl(state) {
  const { appid, siteUrl } = getConfig();
  const redirectUri = encodeURIComponent(`${siteUrl}/api/wx-callback`);
  return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appid}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo&state=${state}#wechat_redirect`;
}

/**
 * Exchange OAuth code for access_token + openid
 */
async function exchangeCode(code) {
  const { appid, secret } = getConfig();
  const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appid}&secret=${secret}&code=${code}&grant_type=authorization_code`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.errcode) throw new Error(`WeChat error: ${data.errmsg}`);
  return { accessToken: data.access_token, openid: data.openid, refreshToken: data.refresh_token };
}

/**
 * Get user info (nickname, avatar) from WeChat
 */
async function getUserInfo(accessToken, openid) {
  const url = `https://api.weixin.qq.com/sns/userinfo?access_token=${accessToken}&openid=${openid}&lang=zh_CN`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.errcode) throw new Error(`WeChat userinfo error: ${data.errmsg}`);
  return {
    openid: data.openid,
    nickname: data.nickname,
    avatar: data.headimgurl,
    sex: data.sex,
    province: data.province,
    city: data.city,
    country: data.country
  };
}

module.exports = { getConfig, getOAuthUrl, exchangeCode, getUserInfo };
