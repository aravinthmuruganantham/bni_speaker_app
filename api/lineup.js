'use strict';
// Replace the whole speaker lineup (order, name, category, company, photo).
// A speaker's photo is only sent when it is new or changed; otherwise the stored photo is kept.
const auth = require('../lib/auth');
const logic = require('../lib/logic');
const store = require('../lib/store');

const MAX_SPEAKERS = 60;
const MAX_PHOTO_CHARS = 60000; // base64 text of a small JPEG

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  if (!auth.ok(req)) return auth.deny(res);
  try {
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
    if (!b || !Array.isArray(b.speakers)) return res.status(400).json({ ok: false, error: 'Bad request' });
    if (b.speakers.length > MAX_SPEAKERS) return res.status(200).json({ ok: false, error: 'Maximum ' + MAX_SPEAKERS + ' speakers' });

    const ctx = await logic.load();
    const old = new Map(ctx.lineup.map(s => [s.id, s]));
    const now = Date.now();
    const photoWrites = [];
    const seen = new Set();
    const lineup = [];

    for (const s of b.speakers) {
      const name = logic.clean(s && s.name, 60);
      if (!name) continue;
      let id = s.id && /^[a-z0-9]{6,20}$/.test(s.id) && !seen.has(s.id) ? s.id : logic.newId();
      seen.add(id);
      const prev = old.get(id);
      let photoV = prev ? prev.photoV || 0 : 0;
      if (typeof s.photo === 'string' && s.photo.startsWith('data:image/jpeg;base64,') && s.photo.length <= MAX_PHOTO_CHARS) {
        photoWrites.push(store.setRaw('photo:' + id, s.photo));
        photoV = now;
      }
      if (s.removePhoto === true) { photoV = 0; photoWrites.push(store.del(['photo:' + id])); }
      lineup.push({
        id, name,
        category: logic.clean(s.category, 60),
        company: logic.clean(s.company, 80),
        photoV,
      });
    }

    const removed = [...old.keys()].filter(id => !seen.has(id)).map(id => 'photo:' + id);
    await Promise.all(photoWrites);
    await store.del(removed);

    ctx.lineup = lineup;
    ctx.dirty.add('lineup');
    ctx.live.rev.lineup = now;
    if (ctx.live.speakerId && !lineup.some(s => s.id === ctx.live.speakerId)) ctx.live.speakerId = '';
    await logic.save(ctx);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, lineup });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
