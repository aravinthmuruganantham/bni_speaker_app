'use strict';
// Storage layer. Production: Upstash Redis (REST) connected through the Vercel Marketplace.
// Local dev without Redis: falls back to in-memory storage (data is lost when the process stops).
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
const PREFIX = 'bnitimer:';
const remote = !!(URL_ && TOKEN);
const mem = (global.__bniMem = global.__bniMem || new Map());

function assertReady() {
  if (!remote && process.env.VERCEL) {
    throw new Error('Redis is not connected. In Vercel: Storage > add Upstash Redis, then redeploy.');
  }
}

async function pipeline(cmds) {
  const r = await fetch(URL_.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error('Redis request failed (' + r.status + ')');
  const out = await r.json();
  return out.map(x => { if (x.error) throw new Error(x.error); return x.result; });
}

// JSON values -------------------------------------------------------------
async function mget(keys) {
  assertReady();
  if (!remote) return keys.map(k => (mem.has(PREFIX + k) ? JSON.parse(mem.get(PREFIX + k)) : null));
  const [vals] = await pipeline([['MGET', ...keys.map(k => PREFIX + k)]]);
  return vals.map(v => (v == null ? null : JSON.parse(v)));
}

async function setMany(obj) {
  assertReady();
  const entries = Object.entries(obj);
  if (!entries.length) return;
  if (!remote) { entries.forEach(([k, v]) => mem.set(PREFIX + k, JSON.stringify(v))); return; }
  await pipeline(entries.map(([k, v]) => ['SET', PREFIX + k, JSON.stringify(v)]));
}

// Raw strings (photos) ----------------------------------------------------
async function getRaw(key) {
  assertReady();
  if (!remote) return mem.has(PREFIX + key) ? mem.get(PREFIX + key) : null;
  const [v] = await pipeline([['GET', PREFIX + key]]);
  return v == null ? null : v;
}

async function setRaw(key, value) {
  assertReady();
  if (!remote) { mem.set(PREFIX + key, value); return; }
  await pipeline([['SET', PREFIX + key, value]]);
}

async function del(keys) {
  assertReady();
  if (!keys.length) return;
  if (!remote) { keys.forEach(k => mem.delete(PREFIX + k)); return; }
  await pipeline([['DEL', ...keys.map(k => PREFIX + k)]]);
}

module.exports = { mget, setMany, getRaw, setRaw, del, remote };
