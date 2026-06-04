/**
 * Minimal JWT sign/verify — zero dependencies, uses Node.js crypto
 */
const crypto = require('crypto');

function base64url(str) {
  return Buffer.from(str).toString('base64url');
}

function sign(payload, secret, expiresIn = '7d') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = expiresIn === '7d' ? now + 7 * 86400 :
              expiresIn === '1h' ? now + 3600 : now + parseInt(expiresIn);

  const payloadWithExp = { ...payload, iat: now, exp };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payloadWithExp));
  const signature = crypto.createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  return `${headerB64}.${payloadB64}.${signature}`;
}

function verify(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const signature = crypto.createHmac('sha256', secret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest('base64url');

    if (signature !== parts[2]) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

module.exports = { sign, verify };
