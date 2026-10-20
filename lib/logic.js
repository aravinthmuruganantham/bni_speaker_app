'use strict';
const store = require('./store');

const DEFAULT_PRESETS = [
  { title: '30-Second Speech', seconds: 30 },
  { title: 'Education Slot', seconds: 240 },
  { title: 'Feature Presentation', seconds: 480 },
];

const clean = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5);
const busy = l => l.status === 'running' || l.status === 'paused';
const elapsed = (l, now) => l.baseElapsed + (l.status === 'running' ? now - l.startedAt : 0);

function defaultLive() {
  return {
    title: DEFAULT_PRESETS[0].title,
    duration: DEFAULT_PRESETS[0].seconds * 1000,
    status: 'idle', // idle | running | paused | done
    startedAt: 0,
    baseElapsed: 0,
    speakerId: '',
    guest: '',
    rev: { lineup: 0, presets: 0, log: 0 },
  };
}

async function load() {
  const [live, lineup, presets, log] = await store.mget(['live', 'lineup', 'presets', 'log']);
  const l = Object.assign(defaultLive(), live || {});
  l.rev = Object.assign({ lineup: 0, presets: 0, log: 0 }, l.rev || {});
  return {
    live: l,
    lineup: lineup || [],
    presets: presets && presets.length ? presets : DEFAULT_PRESETS,
    log: log || [],
    dirty: new Set(['live']),
  };
}

async function save(ctx) {
  const out = {};
  ctx.dirty.forEach(k => { out[k] = ctx[k]; });
  await store.setMany(out);
}

function whoOf(ctx) {
  const l = ctx.live;
  if (l.speakerId) {
    const s = ctx.lineup.find(x => x.id === l.speakerId);
    if (s) return s;
  }
  if (l.guest) return { id: '', name: l.guest, category: 'Visitor', company: '' };
  return null;
}

// Next speaker in lineup order who has not been logged yet (wraps around).
function pickNext(ctx) {
  const L = ctx.lineup;
  if (!L.length) return '';
  const done = new Set(ctx.log.map(e => e.speakerId).filter(Boolean));
  const i = L.findIndex(s => s.id === ctx.live.speakerId);
  for (let k = 1; k <= L.length; k++) {
    const s = L[(i + k + L.length) % L.length];
    if (!done.has(s.id)) return s.id;
  }
  return '';
}

// Returns an error string, or null on success. Mutates ctx.
function run(ctx, b, now) {
  const l = ctx.live;
  const touch = k => { ctx.dirty.add(k); ctx.dirty.add('live'); if (k !== 'live') l.rev[k] = now; };

  switch (b.type) {
    case 'setup': {
      if (busy(l)) return 'Stop the current speaker first';
      const seconds = Math.round(Number(b.seconds));
      if (!(seconds >= 1 && seconds <= 10800)) return 'Invalid duration';
      const wasDone = l.status === 'done';
      l.title = clean(b.title, 60) || 'Speech';
      l.duration = seconds * 1000;
      l.status = 'idle'; l.baseElapsed = 0;
      if (wasDone) { l.speakerId = pickNext(ctx); l.guest = ''; }
      touch('live');
      return null;
    }
    case 'select': {
      if (busy(l)) return 'Stop the current speaker first';
      if (b.id) {
        if (!ctx.lineup.some(s => s.id === b.id)) return 'Speaker not found';
        l.speakerId = b.id; l.guest = '';
      } else { l.speakerId = ''; l.guest = clean(b.guest, 60); }
      if (l.status === 'done') { l.status = 'idle'; l.baseElapsed = 0; }
      touch('live');
      return null;
    }
    case 'start':
      if (l.status === 'idle') { l.baseElapsed = 0; l.startedAt = now; l.status = 'running'; }
      else if (l.status === 'paused') { l.startedAt = now; l.status = 'running'; }
      touch('live');
      return null;
    case 'pause':
      if (l.status === 'running') { l.baseElapsed = elapsed(l, now); l.status = 'paused'; }
      touch('live');
      return null;
    case 'reset':
      l.status = 'idle'; l.baseElapsed = 0;
      touch('live');
      return null;
    case 'stop': {
      if (!busy(l)) return null;
      const used = elapsed(l, now);
      const w = whoOf(ctx);
      l.baseElapsed = used; l.status = 'done';
      ctx.log.push({
        id: newId(), ts: now,
        speakerId: w ? w.id : '',
        name: w ? w.name : '(unnamed)',
        category: w ? w.category || '' : '',
        company: w ? w.company || '' : '',
        title: l.title, allowedMs: l.duration, usedMs: used,
      });
      if (ctx.log.length > 500) ctx.log = ctx.log.slice(-500);
      touch('log');
      return null;
    }
    case 'next':
      l.status = 'idle'; l.baseElapsed = 0; l.guest = '';
      l.speakerId = pickNext(ctx);
      touch('live');
      return null;
    case 'presets': {
      if (!Array.isArray(b.presets)) return 'Invalid slots';
      const list = b.presets
        .map(p => ({ title: clean(p && p.title, 60), seconds: Math.round(Number(p && p.seconds)) }))
        .filter(p => p.title && p.seconds >= 1 && p.seconds <= 10800)
        .slice(0, 20);
      if (!list.length) return 'Need at least one valid slot';
      ctx.presets = list; touch('presets');
      return null;
    }
    case 'deleteLog':
      ctx.log = ctx.log.filter(e => e.id !== b.id); touch('log');
      return null;
    case 'clearLog':
      ctx.log = []; touch('log');
      return null;
    default:
      return 'Unknown command';
  }
}

function csv(log) {
  const q = v => (typeof v === 'number' ? String(v) : '"' + String(v).replace(/"/g, '""') + '"');
  const p2 = n => String(n).padStart(2, '0');
  const rows = [['Date', 'Time (IST)', 'Slot', 'Speaker', 'Category', 'Company', 'Allowed (sec)', 'Used (sec)', 'Over (+) / Under (-) (sec)']];
  for (const e of log) {
    const d = new Date(e.ts + 5.5 * 3600 * 1000); // India time, independent of server timezone
    const used = Math.round(e.usedMs / 1000), allowed = Math.round(e.allowedMs / 1000);
    rows.push([
      `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`,
      `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`,
      e.title, e.name, e.category || '', e.company || '', allowed, used, used - allowed,
    ]);
  }
  return '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n') + '\r\n';
}

module.exports = { DEFAULT_PRESETS, clean, newId, defaultLive, load, save, run, csv };
