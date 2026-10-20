'use strict';
// CSV of the speaker log (opens in Excel). Needs the PIN header, so the remote downloads it with fetch().
const auth = require('../lib/auth');
const logic = require('../lib/logic');

module.exports = async (req, res) => {
  if (!auth.ok(req)) return auth.deny(res);
  try {
    const ctx = await logic.load();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="speaker-log.csv"');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).end(logic.csv(ctx.log));
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
