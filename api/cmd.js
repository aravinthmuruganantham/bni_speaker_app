'use strict';
// All timer / log / slot commands from the remote.
const auth = require('../lib/auth');
const logic = require('../lib/logic');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  if (!auth.ok(req)) return auth.deny(res);
  try {
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
    if (!b || typeof b !== 'object') return res.status(400).json({ ok: false, error: 'Bad request' });

    const ctx = await logic.load();
    const now = Date.now();
    const err = logic.run(ctx, b, now);
    if (err) return res.status(200).json({ ok: false, error: err });
    await logic.save(ctx);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, live: ctx.live });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
