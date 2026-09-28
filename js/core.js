/* ゴルフクエスト 土台
   - 記録倉庫との窓口（招待コードが鍵。窓口関数 gq_* だけを呼ぶ）
   - 端末内の控え（localStorage "gq.v1"）
   - 画面の共通部品・ルーティング
*/
(function () {
  'use strict';
  const CFG = window.GQ_CONFIG;
  const DAY = 864e5, HOUR = 36e5;
  const KEY = 'gq.v1';

  // ---------- 端末内の控え ----------
  const S = load();
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    const base = { v: 1, code: null, data: null, syncedAt: 0, theme: 'auto', wip: { workout: null, range: null }, seen: {} };
    return Object.assign(base, s || {});
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('端末に保存できませんでした'); } }

  // ---------- 窓口 ----------
  const ERR = {
    invalid_code: '合言葉が違います', daily_limit: '今日の上限に達しました', consent_required: '先に同意が必要です',
    empty_question: '質問を書いてください', bad_path: '動画の置き場が不正です', bad_table: '取り消せない記録です',
  };
  async function rpc(name, params) {
    const r = await fetch(`${CFG.url}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {}),
    });
    const txt = await r.text();
    let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = null; }
    if (!r.ok) {
      const m = (j && (j.message || j.hint || j.details)) || txt || ('HTTP ' + r.status);
      const key = Object.keys(ERR).find(k => m.includes(k));
      const e = new Error(key ? ERR[key] : ('倉庫でエラー: ' + m)); e.code = key || 'http'; throw e;
    }
    return j;
  }
  async function uploadVideo(path, file) {
    const r = await fetch(`${CFG.url}/storage/v1/object/${CFG.bucket}/${path}`, {
      method: 'POST', headers: { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key, 'Content-Type': file.type || 'video/mp4', 'x-upsert': 'false' },
      body: file,
    });
    if (!r.ok) { const t = await r.text(); throw new Error('動画を送れませんでした: ' + t.slice(0, 120)); }
    return true;
  }

  // 全記録の取り直し
  let syncing = null;
  async function sync(quiet) {
    if (!S.code) return null;
    if (syncing) return syncing;
    syncing = rpc('gq_sync', { p_code: S.code }).then(d => {
      S.data = d; S.syncedAt = Date.now(); save(); syncing = null; return d;
    }).catch(e => { syncing = null; if (!quiet) toast(e.message); throw e; });
    return syncing;
  }
  // 記録を1件書く → 取り直す
  async function write(name, params) {
    const r = await rpc(name, Object.assign({ p_code: S.code }, params));
    try { await sync(true); } catch (e) { /* 控えのまま */ }
    return r;
  }
  async function updateMember(patch) {
    const m = await write('gq_update_member', { p: patch });
    if (S.data) { S.data.member = m; save(); }
    return m;
  }

  // ---------- 便利 ----------
  const $ = sel => document.querySelector(sel);
  const view = $('#view');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, 2200); }
  function jst(ts) { return new Date((ts ? new Date(ts).getTime() : Date.now()) + 9 * HOUR); } // UTC表示で日本時間になる Date
  function dayKey(ts) { return jst(ts).toISOString().slice(0, 10); }
  function todayKey() { return dayKey(); }
  function weekKey(ts) { // 月曜始まり（日本時間）
    const d = jst(ts); const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow); return d.toISOString().slice(0, 10);
  }
  function fmtDate(ts) { const d = jst(ts); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; }
  function fmtDateTime(ts) { const d = jst(ts); return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; }
  function fmtTime(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  function fmtDur(ms) { if (ms <= 0) return '今すぐ'; const h = Math.floor(ms / HOUR), m = Math.floor(ms % HOUR / 60000); return (h ? h + '時間' : '') + m + '分後'; }
  function median(arr) { const a = arr.filter(x => x != null && !isNaN(x)).map(Number).sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
  function n1(x) { return x == null ? '—' : (Math.round(x * 10) / 10).toString(); }
  function meter(cur, need, done) { const p = Math.min(100, Math.round(100 * (need ? cur / need : (done ? 1 : 0)))); return `<div class="meter"><div class="bar"><div class="fill ${done ? 'done' : ''}" style="width:${p}%"></div></div></div>`; }
  function confirmBox(msg) { return window.confirm(msg); }
  function online() { return navigator.onLine !== false; }

  // AIに聞く（利用者自身の ChatGPT / Claude を開く。こちらのAI費用ゼロ）
  function aiUrl(prompt) {
    const q = encodeURIComponent(prompt);
    const pref = (S.data && S.data.member && S.data.member.ai_pref) || 'chatgpt';
    return pref === 'claude' ? 'https://claude.ai/new?q=' + q : 'https://chatgpt.com/?q=' + q;
  }
  function aiName() { return ((S.data && S.data.member && S.data.member.ai_pref) === 'claude') ? 'Claude' : 'ChatGPT'; }
  function aiButtons(prompt) {
    return `<div class="row" style="margin-top:8px">
      <a class="btn small" target="_blank" rel="noopener" href="${aiUrl(prompt)}">${aiName()}に聞く</a>
      <button class="btn small ghost" data-copy="${esc(prompt)}">質問文をコピー</button>
    </div>`;
  }

  // 休憩タイマー（画面内・1個だけ）
  let timerH = null;
  function startTimer(el, ms, onDone, minMs) {
    clearInterval(timerH);
    const end = Date.now() + ms, minEnd = Date.now() + (minMs || 0);
    const tick = () => {
      const left = end - Date.now();
      el.textContent = fmtTime(left); el.classList.toggle('low', left < 15000);
      if (minMs && Date.now() >= minEnd) el.dispatchEvent(new CustomEvent('minreached'));
      if (left <= 0) { clearInterval(timerH); timerH = null; onDone && onDone(); }
    };
    tick(); timerH = setInterval(tick, 250);
  }
  function stopTimer() { clearInterval(timerH); timerH = null; }

  // ---------- ルーティング ----------
  const routes = {};
  function route() {
    const h = (location.hash || '#home').slice(1);
    const [name, arg] = h.split('/');
    stopTimer();
    if (window.GQ.metro) window.GQ.metro.stop();
    if (!S.code) { $('#tabs').hidden = true; $('#topRight').innerHTML = ''; window.GQ.login(); return; }
    $('#tabs').hidden = false;
    document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === name));
    const r = window.GQ.rank ? window.GQ.rank.compute(S.data) : null;
    $('#topRight').innerHTML = `${r ? `<span>段位 <b>${r.rank < 0 ? '—' : r.rank}</b></span>` : ''}<a href="#settings" title="設定">⚙</a>`;
    $('#brandSub').textContent = online() ? '' : 'オフライン';
    (routes[name] || routes.home)(arg);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('online', () => { sync(true).then(route).catch(() => { }); });
  view.addEventListener('click', e => {
    const b = e.target.closest('[data-copy]');
    if (b) { navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy).then(() => toast('コピーしました'), () => toast('コピーできませんでした')); }
  });

  // ---------- ログイン（合言葉） ----------
  function login() {
    view.innerHTML = `
      <div class="login">
        <h1 class="center">ゴルフクエスト</h1>
        <p class="muted center">noteで受け取った合言葉を入れてください。<br>入力は最初の1回だけです。</p>
        <div class="card">
          <input id="code" placeholder="GQ-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false">
          <button class="btn primary wide" id="go" style="margin-top:10px">はじめる</button>
          <p class="muted" id="err"></p>
        </div>
        <p class="muted">合言葉は、yamadaの有料noteを購入後、公式LINEに「アプリ」と送ると届きます。合言葉は他人に見せないでください。</p>
      </div>`;
    const go = async () => {
      const code = $('#code').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length < 6) { $('#err').textContent = '合言葉を入れてください'; return; }
      $('#go').disabled = true; $('#err').textContent = '確認中…';
      try {
        await rpc('gq_login', { p_code: code });
        S.code = code; save();
        await sync();
        location.hash = '#home'; route();
      } catch (e) { $('#err').textContent = e.message; $('#go').disabled = false; }
    };
    $('#go').onclick = go;
    $('#code').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    $('#code').focus();
  }

  // ---------- 公開 ----------
  window.GQ = Object.assign(window.GQ || {}, {
    S, save, sync, write, rpc, updateMember, uploadVideo,
    $, view, esc, toast, jst, dayKey, todayKey, weekKey, fmtDate, fmtDateTime, fmtTime, fmtDur, median, n1, meter, confirmBox, online,
    aiUrl, aiButtons, aiName, startTimer, stopTimer, routes, route, login, DAY, HOUR,
    member() { return (S.data && S.data.member) || {}; },
    data() { const d = S.data || { member: {}, workouts: [], ranges: [], measurements: [], rounds: [], questions: [], swings: [] }; d.programs = d.programs || []; d.requests = d.requests || []; return d; },
  });
})();
