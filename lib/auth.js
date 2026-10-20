'use strict';
const crypto = require('crypto');

// If ADMIN_PIN is not set, everything is open (fine for local testing, NOT for production).
exports.ok = function (req) {
  const pin = process.env.ADMIN_PIN || '';
  if (!pin) return true;
  const a = Buffer.from(String(req.headers['x-pin'] || ''));
  const b = Buffer.from(pin);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

exports.deny = function (res) {
  res.status(401).json({ ok: false, error: 'PIN required' });
};
