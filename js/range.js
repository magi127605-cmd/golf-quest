/* 練習場（note② 100球メニュー）：サーキット周回・マン振り15球上限・メトロノーム内蔵 */
(function () {
  'use strict';
  const G = window.GQ;
  const CLUBS = [
    { nm: 'ウェッジ ハイティー 10y', tip: '最下点を自分で合わせる。力むと打点がブレる' },
    { nm: 'ドライバー ハーフ 100y', tip: '緩く打たない。加速しながらインパクト' },
    { nm: 'アイアン ハイティー', tip: 'ウェッジの感覚を大きいスイングで' },
    { nm: 'ドライバー フル', tip: '前3球を全部持ち込んで1球。コースの1打' },
  ];
  // 球数ごとの段取り（c=サーキット周回数 / m=マン振り5球 / b=端数の球）
  const PROGRAMS = {
    50: [['c', 1], ['m'], ['c', 4], ['m'], ['c', 5]],
    100: [['c', 2], ['m'], ['c', 5], ['m'], ['c', 5], ['m'], ['c', 9, 1]],
    150: [['c', 3], ['m'], ['c', 8], ['m'], ['c', 8], ['m'], ['c', 14, 3]],
    200: [['c', 4], ['m'], ['c', 11], ['m'], ['c', 11], ['m'], ['c', 20, 1]],
  };
  const CELLS = [['tl', '上・先'], ['t', '上'], ['th', '上・根'], ['l', '先'], ['c', '芯'], ['h', '根'], ['bl', '下・先'], ['b', '下'], ['bh', '下・根']];

  // ---------- メトロノーム（WebAudio） ----------
  const metro = { ctx: null, on: false, bpm: 60, beats: 3, next: 0, beat: 0, h: null, el: null, muted: false };
  function metroStart(bpm, beats) {
    try { if (!metro.ctx) metro.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (metro.ctx.state === 'suspended') metro.ctx.resume(); } catch (e) { G.toast('この端末では音が出せません'); return; }
    metro.bpm = bpm; metro.beats = beats; metro.on = true; metro.next = metro.ctx.currentTime + 0.1; metro.beat = 0;
    clearInterval(metro.h); metro.h = setInterval(schedule, 50);
  }
  function schedule() {
    if (!metro.on || !metro.ctx) return;
    while (metro.next < metro.ctx.currentTime + 0.15) {
      const t = metro.next, acc = metro.beat % metro.beats === 0;
      if (!metro.muted) {
        const o = metro.ctx.createOscillator(), g = metro.ctx.createGain();
        o.frequency.value = acc ? 1200 : 800; g.gain.setValueAtTime(acc ? 0.6 : 0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        o.connect(g); g.connect(metro.ctx.destination); o.start(t); o.stop(t + 0.07);
      }
      const b = metro.beat % metro.beats; setTimeout(() => flash(b), Math.max(0, (t - metro.ctx.currentTime) * 1000));
      metro.beat++; metro.next += 60 / metro.bpm;
    }
  }
  function flash(b) { if (!metro.el) return; metro.el.querySelectorAll('.beat').forEach((x, i) => x.classList.toggle('on', i === b)); }
  function metroStop() { metro.on = false; clearInterval(metro.h); metro.h = null; }
  G.metro = { start: metroStart, stop: metroStop, state: metro };
  function metroBox(active) {
    return `<div class="metro card flat" id="metroBox">
      <div class="row" style="gap:6px">${Array.from({ length: metro.beats }, () => '<span class="beat"></span>').join('')}</div>
      <span class="muted grow">メトロノーム BPM${metro.bpm}・${metro.beats}拍 ${active ? (metro.muted ? '（消音中）' : 'ON') : 'OFF（マン振り中）'}</span>
      ${active ? `<button class="btn small" id="mute">${metro.muted ? '音を出す' : '消音'}</button>` : ''}
    </div>`;
  }

  // ---------- 画面 ----------
  G.routes.range = function () {
    const d = G.data(), m = d.member;
    if (G.S.wip.range) return runner();
    G.view.innerHTML = `
      <h1>練習場 <span class="tag">100球メニュー</span></h1>
      ${!m.bpm ? `<div class="note warn">先に自分のテンポ（BPM）を決めてください。<a href="#settings">設定へ</a>（BPM60〜90で一番振りやすいもの。決めたら変えない）</div>` : `<p class="muted">テンポ BPM${m.bpm}・${m.beats}拍（<a href="#settings">変更</a>）</p>`}
      <div class="card">
        <h3 style="margin-top:0">今日の球数</h3>
        <div class="chips" id="balls">${[50, 100, 150, 200].map(n => `<button class="chip ${n === 100 ? 'on' : ''}" data-n="${n}">${n}球</button>`).join('')}</div>
        <p class="muted" id="plan"></p>
        <h3>ウォーミングアップ5分（必須）</h3>
        <label class="row"><input type="checkbox" id="w1" style="width:auto;min-height:0"> 肩・腰・手首のストレッチ 2〜3分</label>
        <label class="row"><input type="checkbox" id="w2" style="width:auto;min-height:0"> ドライバーでゆるい素振り 5〜10回（力まない）</label>
        <button class="btn primary wide big" id="start" style="margin-top:12px" ${m.bpm ? '' : 'disabled'}>練習を始める</button>
        <p class="muted">サーキット1周＝ウェッジ10y → ドライバーハーフ100y → アイアンハイティー → ドライバーフル。順番は変えない。ショットマーカーは全球つけっぱなし。</p>
      </div>
      <h2>記録</h2>
      ${d.ranges.slice().reverse().slice(0, 30).map(r => `<div class="item ${r.completed ? 'done' : ''}"><div class="row between"><div class="ttl">${G.fmtDateTime(r.done_at)} ${r.balls_hit}/${r.balls_plan}球 ${r.completed ? '<span class="tag ok">完走</span>' : '<span class="tag">途中終了</span>'}</div><button class="btn small ghost" data-del="${r.id}">取消</button></div>
        <div class="sub">サーキット${r.circuits_done}周・マン振り${r.manburi_balls}球・メトロノーム${r.metronome_on ? 'ON' : 'OFF'}${G.rank.impactTotal(r) ? `・打点${G.rank.impactTotal(r)}球（芯${Math.round(100 * (Number((r.impact || {}).c) || 0) / G.rank.impactTotal(r))}%）` : ''}${r.carry_y ? '・キャリー' + r.carry_y + 'y' : ''}${r.note ? '<br>' + G.esc(r.note) : ''}</div></div>`).join('') || '<p class="muted">まだ記録がありません。</p>'}`;
    let n = 100;
    const showPlan = () => { const p = PROGRAMS[n]; const c = p.filter(s => s[0] === 'c').reduce((a, s) => a + s[1] * 4 + (s[2] || 0), 0), mb = p.filter(s => s[0] === 'm').length * 5; G.$('#plan').textContent = `サーキット${c}球＋マン振り${mb}球（${p.filter(s => s[0] === 'm').length}セット）。マン振りは15球が上限、16球目は打てません。`; };
    showPlan();
    G.view.querySelectorAll('#balls .chip').forEach(b => b.onclick = () => { n = Number(b.dataset.n); G.view.querySelectorAll('#balls .chip').forEach(x => x.classList.toggle('on', x === b)); showPlan(); });
    G.$('#start').onclick = () => {
      if (!G.$('#w1').checked || !G.$('#w2').checked) { G.toast('ウォーミングアップを先に。冷えた筋肉でいきなり振るとケガをする'); return; }
      G.S.wip.range = { plan: n, steps: PROGRAMS[n], si: 0, k: 0, ball: 0, circuits: 0, mSets: 0, mBalls: 0, swings: 0, hit: 0, metroUsed: true, mutedInCircuit: false, startedAt: Date.now(), bpm: m.bpm, beats: m.beats || 3, rest: false };
      G.save(); runner();
    };
    G.view.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!G.confirmBox('この記録を取り消しますか？')) return; try { await G.write('gq_delete_row', { p_table: 'ranges', p_id: b.dataset.del }); G.toast('取り消しました'); G.route(); } catch (e) { G.toast(e.message); } });
  };

  function runner() {
    const R = G.S.wip.range, step = R.steps[R.si];
    if (!step) return finish(true);
    metro.bpm = R.bpm; metro.beats = R.beats;
    if (R.rest) return mRest(R);
    if (step[0] === 'c') return circuit(R, step);
    return manburi(R);
  }

  function circuit(R, step) {
    const totalBalls = step[1] * 4 + (step[2] || 0);
    const club = CLUBS[R.ball % 4];
    if (!metro.on) metroStart(R.bpm, R.beats);
    G.view.innerHTML = `
      <div class="row between"><h1 style="margin:0">サーキット</h1><span class="muted">${R.hit}/${R.plan}球</span></div>
      ${metroBox(true)}
      <div class="card">
        <div class="muted center">段階${R.si + 1}/${R.steps.length}：${step[1]}周${step[2] ? '＋' + step[2] + '球' : ''}（${R.k}/${totalBalls}球）</div>
        <div class="dots">${CLUBS.map((_, i) => `<i class="${i === R.ball % 4 ? 'on' : ''}"></i>`).join('')}</div>
        <div class="club"><div class="idx">${Math.floor(R.k / 4) + 1}周目・${R.ball % 4 + 1}球目</div><div class="nm">${club.nm}</div><div class="tip">${club.tip}</div></div>
        <button class="btn huge primary" id="hit">打った<small>次：${CLUBS[(R.ball + 1) % 4].nm}</small></button>
      </div>
      <button class="btn wide ghost" id="quit">ここで終了する</button>`;
    metro.el = G.$('#metroBox');
    G.$('#mute').onclick = () => { metro.muted = !metro.muted; if (metro.muted) R.mutedInCircuit = true; G.save(); circuit(R, step); };
    G.$('#hit').onclick = () => {
      R.k++; R.hit++; R.ball++;
      if (R.ball % 4 === 0) R.circuits++;
      if (R.k >= totalBalls) { R.si++; R.k = 0; }
      G.save(); runner();
    };
    G.$('#quit').onclick = () => finish(false);
  }

  function manburi(R) {
    metroStop();
    if (R.mBalls >= 15) { R.si++; G.save(); return runner(); }
    if (R.rest) return mRest(R);
    const setNo = R.mSets + 1;
    const inSet = R.mBalls % 5;
    G.view.innerHTML = `
      <div class="row between"><h1 style="margin:0">マン振り セット${setNo}</h1><span class="muted">${R.hit}/${R.plan}球</span></div>
      ${metroBox(false)}
      <div class="card">
        ${R.swings < 3 ? `
          <div class="club"><div class="idx">プライミング</div><div class="nm">全力素振り ${R.swings + 1}/3回</div><div class="tip">当てるつもりで振らない。風を切る音の大きさだけ。球数に数えない</div></div>
          <button class="btn huge" id="swing">素振りした<small>${R.swings + 1}回目</small></button>`
        : `
          <div class="dots">${[0, 1, 2, 3, 4].map(i => `<i class="${i < inSet ? 'on' : ''}"></i>`).join('')}</div>
          <div class="club"><div class="idx">マン振り ${R.mBalls + 1}/15球（このセット ${inSet + 1}/5）</div><div class="nm">全力で振る</div><div class="tip">脳のリミッターを外す。6球目以降は速度が落ちるので5球で打ち切る</div></div>
          <button class="btn huge primary" id="hit">打った<small>${inSet + 1}球目</small></button>`}
        <p class="muted">痛みが出たら即中止。マン振りは一番ケガしやすい。</p>
      </div>
      <button class="btn wide ghost" id="quit">ここで終了する</button>`;
    const sw = G.$('#swing'); if (sw) sw.onclick = () => { R.swings++; G.save(); manburi(R); };
    const hit = G.$('#hit'); if (hit) hit.onclick = () => {
      R.mBalls++; R.hit++;
      if (R.mBalls % 5 === 0) { R.mSets++; R.swings = 0; R.si++; R.rest = true; R.restMs = 150000; }
      G.save(); runner();
    };
    G.$('#quit').onclick = () => finish(false);
  }
  function mRest(R) {
    G.view.innerHTML = `
      <h1>セット間の休憩</h1>
      <div class="card center">
        <div class="timer" id="tm">--:--</div>
        <p class="muted">2〜3分休む。筋肉は1分で回復するが神経は2〜3分かかる。休んだ方が上達する。</p>
        <button class="btn primary wide" id="next" disabled>次へ（2分経ったら押せます）</button>
      </div>`;
    const el = G.$('#tm');
    el.addEventListener('minreached', () => { const b = G.$('#next'); if (b) { b.disabled = false; b.textContent = '次へ'; } }, { once: true });
    G.startTimer(el, R.restMs || 150000, () => { G.alarm.ring('休憩おわり', 'マン振りの次のセットへ'); const b = G.$('#next'); if (b) { b.disabled = false; b.textContent = '次へ'; } }, 120000);
    G.$('#next').onclick = () => { R.rest = false; G.stopTimer(); G.save(); runner(); };
  }

  function finish(completed) {
    const R = G.S.wip.range; metroStop(); G.stopTimer();
    const impact = {}; CELLS.forEach(([k]) => impact[k] = 0);
    G.view.innerHTML = `
      <h1>${completed ? '完走' : '途中終了'}：${R.hit}球</h1>
      <div class="card">
        <h3 style="margin-top:0">打点（ショットマーカーを見て）</h3>
        <p class="muted">今日の球をおおまかに振り分けてタップ。打点は「振り返る」ためのもの。打つ時は意識しない。</p>
        <div class="face" id="face">${CELLS.map(([k, l]) => `<button data-k="${k}" class="${k === 'c' ? 'c' : ''}"><span id="n-${k}">0</span><small>${l}</small></button>`).join('')}</div>
        <div class="row" style="justify-content:center"><button class="chip" id="minus">減らすモード</button><span class="muted" id="tot">合計 0球</span></div>
        <label class="f">今日の飛距離の手応え（キャリー y・任意）</label><input id="carry" type="number" inputmode="numeric" placeholder="例：210">
        <label class="f">気づき1行（任意）</label><input id="note" placeholder="例：ドライバーハーフで芯に当たる感覚">
        <button class="btn primary wide" id="save" style="margin-top:10px">記録する</button>
        <button class="btn wide ghost" id="discard">記録せずに捨てる</button>
      </div>`;
    let minus = false;
    G.$('#minus').onclick = () => { minus = !minus; G.$('#minus').classList.toggle('on', minus); };
    G.view.querySelectorAll('#face button').forEach(b => b.onclick = () => { const k = b.dataset.k; impact[k] = Math.max(0, impact[k] + (minus ? -1 : 1)); G.$('#n-' + k).textContent = impact[k]; G.$('#tot').textContent = `合計 ${Object.values(impact).reduce((a, b) => a + b, 0)}球`; });
    G.$('#discard').onclick = () => { if (G.confirmBox('記録せずに捨てますか？')) { G.S.wip.range = null; G.save(); G.route(); } };
    G.$('#save').onclick = async () => {
      G.$('#save').disabled = true;
      try {
        await G.write('gq_add_range', { p: { balls_plan: R.plan, balls_hit: R.hit, circuits_done: R.circuits, manburi_sets: R.mSets, manburi_balls: R.mBalls, warmup: true, metronome_on: !R.mutedInCircuit, bpm: R.bpm, completed: !!completed, impact, carry_y: G.$('#carry').value || null, note: G.$('#note').value } });
        G.S.wip.range = null; G.save(); G.toast('記録しました'); location.hash = '#range'; G.route();
      } catch (e) { G.toast(e.message); G.$('#save').disabled = false; }
    };
  }
})();
