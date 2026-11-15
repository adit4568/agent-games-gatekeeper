// HMAC-SHA256 over raw body — protocol: x-agent-games-signature header.
const crypto = require('crypto');

function sign(secret, rawBody) {
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function decodeSig(headerValue) {
  if (typeof headerValue !== 'string') return null;
  let s = headerValue.trim();
  if (s.toLowerCase().startsWith('sha256=')) s = s.slice(7);
  if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0) return Buffer.from(s, 'hex');
  try {
    const buf = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (buf.length) return buf;
  } catch (_) {}
  return null;
}

function verify(secret, rawBody, headerValue) {
  if (!secret || !headerValue) return false;
  const expected = crypto.createHmac('sha256', secret)
    .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8')).digest();
  const provided = decodeSig(headerValue);
  if (!provided || provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}

module.exports = { sign, verify, decodeSig };
