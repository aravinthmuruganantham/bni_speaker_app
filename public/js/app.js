// Shared client code: live-state polling with server-clock sync, time formatting, admin (PIN) requests.
(function () {
  const App = (window.App = { live: null, offset: 0, connected: null, listeners: [], pollHidden: false });
  const p2 = n => String(n).padStart(2, '0');
  const emit = k => App.listeners.forEach(f => { try { f(k); } catch (e) { console.error(e); } });

  // ---------- clock sync: keep the offset from the fastest recent round-trip ----------
  const samples = [];
  function sample(t0, t1, serverNow) {
    samples.push({ rtt: t1 - t0, off: serverNow - (t0 + t1) / 2 });
    if (samples.length > 10) samples.shift();
    let best = samples[0];
    samples.forEach(s => { if (s.rtt < best.rtt) best = s; });
    App.offset = best.off;
  }
  App.now = () => Date.now() + App.offset;

  // ---------- live state ----------
  let sig = '';
  App.apply = function (live) {
    App.live = live;
    const s = JSON.stringify([live.status, live.startedAt, live.baseElapsed, live.duration, live.title, live.speakerId, live.guest, live.rev]);
    if (s !== sig) { sig = s; emit('state'); }
  };

  let timer = null, inflight = false;
  async function poll() {
    if (inflight) return;
    inflight = true;
    if (!document.hidden || App.pollHidden) {
      try {
        const t0 = Date.now();
        const r = await fetch('/api/state', { cache: 'no-store' });
        const t1 = Date.now();
        const d = await r.json();
        if (!r.ok || !d.live) throw new Error(d.error || 'bad state');
        sample(t0, t1, d.now);
        if (App.connected !== true) { App.connected = true; emit('conn'); }
        App.apply(d.live);
      } catch (e) {
        if (App.connected !== false) { App.connected = false; emit('conn'); }
      }
    }
    inflight = false;
    timer = setTimeout(poll, 1000);
  }
  App.start = function () { poll(); };
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { clearTimeout(timer); poll(); }
  });

  // ---------- time helpers ----------
  App.elapsed = function () {
    const l = App.live;
    if (!l) return 0;
    return l.baseElapsed + (l.status === 'running' ? App.now() - l.startedAt : 0);
  };
  App.remaining = () => (App.live ? App.live.duration - App.elapsed() : 0);
  App.warnMs = d => Math.min(60000, Math.max(10000, Math.round(d * 0.15)));
  // 00:30 ... 00:01, 00:00, then -00:01, -00:02 ...
  App.fmt = function (rem) {
    if (rem > 0) { const s = Math.ceil(rem / 1000); return p2(Math.floor(s / 60)) + ':' + p2(s % 60); }
    const o = Math.floor(-rem / 1000);
    return (o > 0 ? '-' : '') + p2(Math.floor(o / 60)) + ':' + p2(o % 60);
  };
  App.mmss = function (ms) { const s = Math.round(ms / 1000); return p2(Math.floor(s / 60)) + ':' + p2(s % 60); };
  App.phase = function () {
    const l = App.live;
    if (!l || l.status === 'idle') return 'idle';
    const rem = App.remaining();
    if (rem <= 0) return 'over';
    if (l.status === 'done') return 'go';
    return rem <= App.warnMs(l.duration) ? 'warn' : 'go';
  };
  // -1 when not in overtime; 0 = just reached zero; 1 = one second over ...
  App.overIndex = function () {
    const l = App.live;
    if (!l || l.status !== 'running') return -1;
    const over = -App.remaining();
    return over >= 0 ? Math.floor(over / 1000) : -1;
  };

  // ---------- admin requests (PIN) ----------
  let pin = '';
  try { pin = localStorage.getItem('bniPin') || ''; } catch (e) {}
  App.admin = async function (path, opts) {
    opts = opts || {};
    for (let attempt = 0; attempt < 2; attempt++) {
      const headers = { 'x-pin': pin };
      let body;
      if (opts.body !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(opts.body); }
      const r = await fetch(path, { method: opts.method || 'POST', headers, body, cache: 'no-store' });
      if (r.status !== 401) return r;
      const p = prompt(attempt ? 'Wrong PIN. Try again' : 'Enter the PIN');
      if (!p) throw new Error('PIN needed');
      pin = p;
      try { localStorage.setItem('bniPin', pin); } catch (e) {}
    }
    try { localStorage.removeItem('bniPin'); } catch (e) {}
    throw new Error('Wrong PIN');
  };

  App.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  App.initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
  App.avatar = function (sp, size) {
    const st = '--s:' + (size || 44) + 'px';
    if (sp && sp.photoV && sp.id) return '<span class="av" style="' + st + '"><img alt="" src="/api/photo?id=' + encodeURIComponent(sp.id) + '&v=' + sp.photoV + '"></span>';
    return '<span class="av" style="' + st + '">' + App.esc(App.initials(sp && sp.name)) + '</span>';
  };
  App.toast = function (msg, isErr) {
    const t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.className = isErr ? 'err' : ''; t.style.display = 'block';
    clearTimeout(App.toast.h); App.toast.h = setTimeout(() => { t.style.display = 'none'; }, 2800);
  };
})();
