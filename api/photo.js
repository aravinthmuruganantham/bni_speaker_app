'use strict';
// Serves one member photo. The id is random and the URL carries a version, so browsers cache it hard.
const store = require('../lib/store');

module.exports = async (req, res) => {
  try {
    const id = String((req.query && req.query.id) || '');
    if (!/^[a-z0-9]{6,20}$/.test(id)) return res.status(400).end('Bad id');
    const raw = await store.getRaw('photo:' + id);
    const m = raw && raw.match(/^data:image\/jpeg;base64,(.+)$/);
    if (!m) return res.status(404).end('No photo');
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).end(Buffer.from(m[1], 'base64'));
  } catch (e) {
    res.status(500).end(e.message);
  }
};
