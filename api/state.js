'use strict';
// Public + tiny: polled about once a second by the display and the remote.
const store = require('../lib/store');
const logic = require('../lib/logic');

module.exports = async (req, res) => {
  try {
    const [live] = await store.mget(['live']);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ now: Date.now(), live: Object.assign(logic.defaultLive(), live || {}) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
