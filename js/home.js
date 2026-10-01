/* 現在地 */
(function () {
  'use strict';
  const G = window.GQ;

  function last5med(ms, k) { return G.median(ms.slice(-5).map(x => x[k])); }
  function centerRate(rs) {
    const rec = rs.filter(r => G.rank.impactTotal(r) > 0).slice(-5);
    const tot = rec.reduce((a, r) => a + G.rank.impactTotal(r), 0), c = rec.reduce((a, r) => a + (Number((r.impact || {}).c) || 0), 0);
    return tot ? Math.round(100 * c / tot) : null;
  }
  function chart(ms) {
    const pts = ms.filter(x => x.carry != null || x.hs != null);
    if (pts.length < 2) return `<p class="muted">計測が2回以上たまると成長グラフが出ます。</p>`;
    const W = 600, H = 200, P = 28;
    const series = [['carry', 'キャリー(y)', 'var(--ai)'], ['hs', 'HS(m/s)', 'var(--shu)']].map(([k, nm, col]) => {
      const v = pts.map(x => x[k] == null ? null : Number(x[k]));
      const nums = v.filter(x => x != null); if (nums.length < 2) return null;
      const min = Math.min(...nums), max = Math.max(...nums), span = (max - min) || 1;
      const d = v.map((y, i) => y == null ? null : [P + i * (W - 2 * P) / (v.length - 1), H - P - (y - min) / span * (H - 2 * P)]).filter(Boolean);
      return { nm, col, d, min, max, last: nums[nums.length - 1] };
    }).filter(Boolean);
    const lines = series.map(s => `<polyline fill="none" stroke="${s.col}" stroke-width="2.5" points="${s.d.map(p => p.join(',')).join(' ')}"/>` + s.d.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${s.col}"/>`).join('')).join('');
    const legend = series.map(s => `<span class="tag" style="color:${s.col}">● ${s.nm} ${s.min}→${s.max}</span>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}"><rect x="0" y="0" width="${W}" height="${H}" fill="none"/>${lines}</svg><div>${legend}</div>`;
  }
  function aiPrompt(d, r) {
    const m = d.member;
    const ws = d.workouts.slice(-6).map(w => `${G.fmtDate(w.done_at)} ${w.kind === 'big3' ? 'BIG3' : '爆発トレ'} ${(w.sets || []).map(s => `${G.rank.EXNAME[s.ex] || s.ex}${s.weight ? s.weight + 'kg' : ''}×${s.reps}${s.speed ? '(速さ' + s.speed + ')' : ''}${s.rpe ? '(RPE' + s.rpe + ')' : ''}`).join('、')}${w.stopped_early ? '（速度低下で終了）' : ''}`).join('\n');
    const rs = d.ranges.slice(-4).map(x => `${G.fmtDate(x.done_at)} ${x.balls_hit}/${x.balls_plan}球 マン振り${x.manburi_balls}球 メトロノーム${x.metronome_on ? 'ON' : 'OFF'} 打点${JSON.stringify(x.impact || {})}${x.completed ? '' : '（途中終了）'}`).join('\n');
    const ms = d.measurements.slice(-5).map(x => `${x.measured_at} HS${x.hs ?? '-'} 初速${x.ball_speed ?? '-'} キャリー${x.carry ?? '-'} トータル${x.total ?? '-'}`).join('\n');
    const rd = d.rounds.slice(-3).map(x => `${x.played_at} ${x.score}打 パット${x.putts ?? '-'} OB${x.ob ?? '-'} ダボ以上${x.dbl_plus ?? '-'}ホール`).join('\n');
    const nx = r.next ? r.next.items.filter(i => !i.done).map(i => `・${i.label}（${i.cur}/${i.need}）`).join('\n') : 'なし';
    return `ゴルフ上達のため、次の教材ルールで練習しています。ルール：飛距離は「筋力を出す速さ」で決まるので、爆発系（ジャンプスクワット／ハイプル／ボックスジャンプ）を5回×5セット・週2〜3回・48時間空ける。速度が落ちたら終了。BIG3は開始3か月後から別日に3〜5回×3セット。練習場は100球メニュー（サーキット＝ウェッジ10y→ドライバーハーフ100y→アイアン→ドライバーフル、メトロノーム固定テンポ）、マン振りは素振り3回→5球×最大3セット＝15球上限、セット間2〜3分。高回数の持久系・アームカール・柔軟性トレは飛距離目的ではやらない。
このルールから外れない範囲で、私の記録を見て「今週やる1つ」と気づきを教えてください。ケガや痛みの相談は医師に相談すべき旨を先に伝えてください。

コース：${m.course === 'gym' ? 'ジム' : '自重'}／テンポ：BPM${m.bpm || '未設定'}／開始から${r.weeksSinceStart}週／段位：${r.rank}
次の段位の残り：
${nx}

直近の筋トレ：
${ws || 'なし'}

直近の練習場：
${rs || 'なし'}

計測：
${ms || 'なし'}

ラウンド：
${rd || 'なし'}`;
  }

  G.routes.home = function () {
    const d = G.data(), m = d.member, r = G.rank.compute(d);
    const carry = last5med(d.measurements, 'carry'), hs = last5med(d.measurements, 'hs');
    const base = d.measurements[0] || {};
    const cr = centerRate(d.ranges);
    const sc = G.xp.score(d);
    const tw = r.thisWeek;
    const ex = d.workouts.filter(w => w.kind === 'explosive'), lastEx = ex.length ? new Date(ex[ex.length - 1].done_at).getTime() : 0;
    const nextEx = lastEx + 48 * G.HOUR - Date.now();
    const pendQ = d.questions.filter(q => q.status === 'answered' && !G.S.seen[q.id]).length;
    const pendS = d.swings.filter(s => s.status === 'judged' && !G.S.seen[s.id]).length;

    G.view.innerHTML = `
      <div class="card hero">
        <div class="muted">${G.esc(m.name || '')} さんの現在地</div>
        <div class="rank"><span class="no">${r.rank < 0 ? '—' : r.rank}</span><span class="nm">${G.esc(r.rankName)}</span></div>
        <div class="muted">開始から${r.weeksSinceStart}週 ／ 今週の遵守率 ${Math.round(tw.rate * 100)}%</div>
      </div>
      ${(pendQ || pendS) ? `<a class="card flat" href="#yamada" style="display:block;text-decoration:none"><b>yamadaから届いています</b> <span class="muted">${pendQ ? '回答' + pendQ + '件 ' : ''}${pendS ? 'スイング判定' + pendS + '件' : ''}</span></a>` : ''}

      ${G.xp.card(d)}
      ${r.next ? `<div class="card">
        <div class="row between"><h3 style="margin:0">次の段位 ${r.next.rank}「${G.esc(r.next.name)}」まで</h3><span class="muted">${G.esc(r.next.src)}</span></div>
        ${r.next.items.map(i => `<div class="quest ${i.done ? 'done' : ''}"><div class="q-ttl"><span>${i.done ? '✓ ' : ''}${G.esc(i.label)}</span><span class="st">${i.flag ? (i.done ? '達成' : '未') : `${i.cur}/${i.need}${i.unit || ''}`}</span></div>${i.flag ? '' : G.meter(i.cur, i.need, i.done)}</div>`).join('')}
      </div>` : `<div class="card"><b>全段位達成。</b> yamada級だ。型を崩さず続けろ。</div>`}

      <div class="stats4">
        <div class="stat"><div class="n">飛距離（直近5回の中央値）</div><div class="v">${G.n1(carry)}<small> y</small></div><div class="d ${carry != null && base.carry != null && carry > base.carry ? 'up' : ''}">${carry != null && base.carry != null ? `基準 ${G.n1(base.carry)} → ${carry >= base.carry ? '+' : ''}${G.n1(carry - base.carry)}` : 'HS ' + G.n1(hs) + ' m/s'}</div></div>
        <div class="stat"><div class="n">再現性（打点が中央の割合）</div><div class="v">${cr == null ? '—' : cr}<small> %</small></div><div class="d">直近5回の練習場</div></div>
        <div class="stat"><div class="n">推定スコア（直近${sc ? sc.n : 5}R平均）</div><div class="v">${sc == null ? '—' : G.n1(sc.est)}</div><div class="d ${sc && sc.trend != null && sc.trend < 0 ? 'up' : ''}">${sc == null ? 'ラウンドを記録すると出る' : sc.trend != null ? `前の5Rより ${sc.trend <= 0 ? '' : '+'}${sc.trend}打` : `ベスト ${sc.best}・100切り ${sc.under100}/${sc.n}`}</div></div>
        <div class="stat"><div class="n">遵守率（今週）</div><div class="v">${Math.round(tw.rate * 100)}<small> %</small></div><div class="d">4週平均 ${Math.round(100 * r.adherence4.reduce((a, b) => a + b, 0) / r.adherence4.length)}%</div></div>
      </div>

      <div class="card">
        <h3 style="margin-top:0">今週の予定</h3>
        <table class="t">
          <tr><th>爆発トレ</th><td class="num">${tw.done.explosive} / ${tw.plan.explosive}回</td><td class="muted">次にできるのは ${G.fmtDur(nextEx)}</td></tr>
          <tr><th>練習場</th><td class="num">${tw.done.range} / ${tw.plan.range}回</td><td class="muted">100球メニュー</td></tr>
          <tr><th>BIG3</th><td class="num">${r.big3Unlocked ? `${tw.done.big3} / ${tw.plan.big3}回` : '—'}</td><td class="muted">${r.big3Unlocked ? '別日に' : `解禁まで${12 - r.weeksSinceStart}週`}</td></tr>
        </table>
        ${r.restViolations ? `<div class="note ng">48時間ルール違反が${r.restViolations}回あります。神経の回復に48時間かかる。</div>` : ''}
      </div>

      <div class="card"><h3 style="margin-top:0">成長グラフ（計測）</h3>${chart(d.measurements)}</div>

      <div class="card">
        <h3 style="margin-top:0">AIに聞く</h3>
        <p class="muted">直近の記録を質問文にして、あなたの${G.aiName()}を開きます。</p>
        ${G.aiButtons(aiPrompt(d, r))}
      </div>
      <p class="muted center">最終同期 ${G.S.syncedAt ? G.fmtDateTime(G.S.syncedAt) : '—'} ・ <a href="#home" id="resync">今すぐ同期</a></p>`;
    G.$('#resync').onclick = e => { e.preventDefault(); G.sync().then(() => { G.toast('同期しました'); G.route(); }).catch(() => { }); };
  };
})();
