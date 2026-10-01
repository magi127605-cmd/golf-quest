/* 推定MAX（BIG3）：全ワークアウトの記録から種目ごとに推定1RM（Epley）・推移・体重比を出す */
(function () {
  'use strict';
  const G = window.GQ;
  // 体重比の目安（成人男性の一般的な筋力基準を丸めた参考値。断定しない）
  const LIFTS = [
    { key: 'bench', nm: 'ベンチプレス', names: ['bench', 'ベンチプレス'], std: [0.75, 1.0, 1.5, 2.0] },
    { key: 'squat', nm: 'スクワット', names: ['squat', 'スクワット'], std: [1.0, 1.5, 2.0, 2.5] },
    { key: 'dead', nm: 'デッドリフト', names: ['dead', 'デッドリフト'], std: [1.25, 1.75, 2.25, 3.0] },
  ];
  const LEVELS = ['入門', '初級', '中級', '上級', 'エリート'];
  // Epley：1回ならそのまま、13回以上は精度が落ちるので使わない
  const e1rm = (w, r) => { w = Number(w); r = Number(r); if (!w || !r || r > 12) return null; return r === 1 ? w : w * (1 + r / 30); };
  const r1 = x => Math.round(x * 10) / 10;

  function bodyweight(d) { const v = Number(((d.member || {}).lifts || {}).bw); return v > 0 ? v : null; }
  function level(L, ratio) { if (ratio == null) return null; let i = 0; L.std.forEach(t => { if (ratio >= t) i++; }); return LEVELS[i]; }

  // 種目1つの推定MAX（セッションごとの最高・現在値＝直近3回の最高・自己ベスト・前の期間との差）
  function compute(d, L) {
    const pts = [];
    (d.workouts || []).forEach(w => {
      let best = null;
      (w.sets || []).forEach(s => {
        if (!L.names.includes(s.ex)) return;
        const v = e1rm(s.weight, s.reps); if (v == null) return;
        if (!best || v > best.v) best = { t: w.done_at, v: r1(v), w: Number(s.weight), r: Number(s.reps) };
      });
      if (best) pts.push(best);
    });
    if (!pts.length) return { pts, cur: null, best: null, delta: null, ratio: null, level: null };
    const cur = Math.max(...pts.slice(-3).map(p => p.v));
    const best = pts.reduce((a, p) => (!a || p.v > a.v) ? p : a, null);
    const prev = pts.slice(-6, -3); const delta = prev.length ? r1(cur - Math.max(...prev.map(p => p.v))) : null;
    const bw = bodyweight(d), ratio = bw ? Math.round(cur / bw * 100) / 100 : null;
    return { pts, cur, best, delta, ratio, level: level(L, ratio) };
  }
  function all(d) { return LIFTS.map(L => Object.assign({ L }, compute(d, L))); }

  function chart(pts) {
    if (pts.length < 2) return '<p class="muted">記録が2回以上たまると推移グラフが出ます。</p>';
    const ps = pts.slice(-24), W = 600, H = 150, P = 24, v = ps.map(p => p.v), min = Math.min(...v), max = Math.max(...v), span = (max - min) || 1;
    const d = v.map((y, i) => [P + i * (W - 2 * P) / (v.length - 1), H - P - (y - min) / span * (H - 2 * P)]);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}"><polyline fill="none" stroke="var(--ai)" stroke-width="2.5" points="${d.map(p => p.join(',')).join(' ')}"/>${d.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--ai)"/>`).join('')}</svg>
      <div class="row between muted" style="font-size:12px"><span>${G.fmtDate(ps[0].t)} ${G.n1(ps[0].v)}kg</span><span>${G.fmtDate(ps[ps.length - 1].t)} ${G.n1(ps[ps.length - 1].v)}kg</span></div>`;
  }
  const deltaHtml = x => x.delta == null ? '' : `<span class="d ${x.delta > 0 ? 'up' : ''}">${x.delta > 0 ? '↑ +' : x.delta < 0 ? '↓ ' : '→ ±'}${G.n1(Math.abs(x.delta))}kg</span>`;

  // 筋トレタブに出すカード（常時表示）
  function card(d) {
    const xs = all(d), bw = bodyweight(d), total = xs.every(x => x.cur != null) ? xs.reduce((a, x) => a + x.cur, 0) : null;
    return `<div class="card">
      <div class="row between"><div class="ttl" style="font-weight:700">推定MAX（BIG3）</div><a class="btn small ghost" href="#maxes">詳しく</a></div>
      <div class="stats4" style="grid-template-columns:repeat(3,1fr);margin-top:8px">
        ${xs.map(x => `<div class="stat"><div class="n">${G.esc(x.L.nm)}</div><div class="v">${x.cur == null ? '—' : G.n1(x.cur)}<small>kg</small></div>
          <div class="d">${x.cur == null ? '記録なし' : x.ratio != null ? `体重の${x.ratio}倍・${x.level}` : deltaHtml(x) || '&nbsp;'}</div></div>`).join('')}
      </div>
      <div class="muted" style="margin-top:6px;font-size:12px">1回だけ挙げられる重さの目安。${total != null ? `合計 ${G.n1(total)}kg${bw ? `（体重の${Math.round(total / bw * 100) / 100}倍）` : ''}。` : ''}${bw ? '' : '<a href="#maxes">体重を入れる</a>と体重比（相対筋力）が出ます。'}</div>
    </div>`;
  }

  // 詳しい画面
  G.routes.maxes = function () {
    const d = G.data(), xs = all(d), bw = bodyweight(d);
    G.view.innerHTML = `
      <h1>推定MAX（BIG3）</h1>
      <p class="muted">筋トレの記録から、種目ごとに「1回だけなら挙げられる重さ」を推定する。BIG3・自分メニュー・空のワークアウト、どこで記録しても拾う。</p>
      <div class="card">
        <div class="row between"><label class="f" style="margin:0">体重 kg（体重比を出すのに使う）</label></div>
        <div class="row" style="margin-top:6px"><input id="bw" type="number" inputmode="decimal" step="0.1" value="${bw ?? ''}" placeholder="例：70" style="max-width:140px"><button class="btn small" id="bwSave">保存</button></div>
      </div>
      ${xs.map(x => `<div class="card">
        <div class="row between"><div class="ttl" style="font-weight:700;font-size:17px">${G.esc(x.L.nm)}</div>${x.best ? `<span class="muted">自己ベスト ${G.n1(x.best.v)}kg（${G.fmtDate(x.best.t)}・${x.best.w}kg×${x.best.r}）</span>` : ''}</div>
        ${x.cur == null ? '<p class="muted">まだ記録がありません。重量と回数（12回以下）を記録すると出ます。</p>' : `
        <div class="row" style="align-items:baseline;gap:12px;margin:6px 0"><div class="bignum">${G.n1(x.cur)}<small>kg</small></div>${deltaHtml(x) ? `<span class="stat" style="padding:4px 8px">${deltaHtml(x)} <span class="muted">前の3回比</span></span>` : ''}</div>
        ${x.ratio != null ? `<div class="row" style="gap:8px;align-items:center"><span>体重の <b>${x.ratio}</b> 倍</span><span class="tag ${x.level === '入門' ? '' : 'ok'}">${x.level}</span><span class="muted" style="font-size:12px">次：${nextLevel(x)}</span></div>` : ''}
        ${chart(x.pts)}
        <details style="margin-top:6px"><summary class="muted">記録（直近8回）</summary><table class="t"><tr><th>日付</th><th>最高セット</th><th>推定1RM</th></tr>${x.pts.slice(-8).reverse().map(p => `<tr><td>${G.fmtDate(p.t)}</td><td>${p.w}kg×${p.r}回</td><td>${G.n1(p.v)}kg</td></tr>`).join('')}</table></details>`}
      </div>`).join('')}
      <div class="card flat">
        <p class="muted" style="margin:0">出し方：重量×（1＋回数÷30）（Epley式）。1回の記録はそのまま、13回以上は精度が落ちるので使わない。現在値は直近3回の最高（軽い日で下がって見えないように）。体重比の段階は成人男性の一般的な筋力基準を丸めた参考値で、ゴルフに必要な値ではない。</p>
      </div>
      <a class="btn wide ghost" href="#train">筋トレに戻る</a>`;
    G.$('#bwSave').onclick = async () => {
      const v = Number(G.$('#bw').value);
      if (!(v >= 30 && v <= 200)) { G.toast('体重を30〜200の範囲で入れてください'); return; }
      const lifts = Object.assign({}, G.member().lifts || {}, { bw: v });
      G.$('#bwSave').disabled = true;
      try { await G.updateMember({ lifts }); G.toast('保存しました'); G.route(); } catch (e) { G.toast(e.message); G.$('#bwSave').disabled = false; }
    };
  };
  function nextLevel(x) {
    const i = LEVELS.indexOf(x.level); if (i >= LEVELS.length - 1) return '最上位';
    const bw = bodyweight(G.data()), t = x.L.std[i];
    return `${LEVELS[i + 1]}は体重の${t}倍＝${G.n1(t * bw)}kg（あと${G.n1(Math.max(0, t * bw - x.cur))}kg）`;
  }

  G.maxes = { LIFTS, e1rm, compute, all, card, bodyweight };
})();
