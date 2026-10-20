'use strict';
// Lineup, saved slots and log. Needs the PIN (when ADMIN_PIN is set).
const auth = require('../lib/auth');
const logic = require('../lib/logic');

module.exports = async (req, res) => {
  if (!auth.ok(req)) return auth.deny(res);
  try {
    const ctx = await logic.load();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, presets: ctx.presets, lineup: ctx.lineup, log: ctx.log });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
