/* 自分メニュー：個人の目標・制約・種目で週プログラムを組む（科学的な型＋手動＋AI取り込み） */
(function () {
  'use strict';
  const G = window.GQ;
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  const r25 = x => Math.round(x / 2.5) * 2.5;
  const e1rm = (w, r) => (!w || !r) ? null : (r === 1 ? w : w * (1 + r / 30)); // Epley
  const isLower = ex => /スクワット|デッド|squat|dead|レッグ|脚/i.test(ex || '');

  // 筋力の型（波状：重い日／軽い日／強い日）。Rhea 2002・Grgic 2018：週2〜3回・強度を日ごとに変える方が線形より伸びる
  // 休憩：ジムの台は20分しか使えない。準備運動（約5分）込みで収めるため重い日・強い日も2.5分。
  // 筋力には2分以上あれば足り、2.5分と3〜3.5分の差は小さい（Grgic 2017・Schoenfeld 2016）
  const STRENGTH_DAYS = [
    { key: 'heavy', nm: '重い日', sets: 5, reps: 5, pct: 0.82, rest: 150, note: '' },
    { key: 'light', nm: '軽い日', sets: 4, reps: 8, pct: 0.72, rest: 120, note: '胸（最下点）で1秒止めてから押す' },
    { key: 'strong', nm: '強い日', sets: 5, reps: 3, pct: 0.88, rest: 150, note: '' },
  ];
  const CROWDED = 6; // 土曜はジムが混む → 強い日（一番大事な日）を置かない
  // 土曜が強い日なら、軽い日（なければ重い日）の曜日と入れ替える。入れ替えたら true
  function avoidCrowded(plan) {
    const tagOf = d => plan[d] && plan[d][0] && plan[d][0].tag;
    if (tagOf(CROWDED) !== '強い日') return false;
    const ds = Object.keys(plan).map(Number).filter(d => d !== CROWDED);
    const to = ds.find(d => tagOf(d) === '軽い日') ?? ds.find(d => tagOf(d) === '重い日');
    if (to == null) return false;
    [plan[CROWDED], plan[to]] = [plan[to], plan[CROWDED]];
    return true;
  }
  function generate(spec) {
    const g = spec.goal, max = e1rm(Number(g.current_w), Number(g.current_r)) || Number(g.target) * 0.7;
    const days = (spec.days || []).slice().sort((a, b) => (a + 6) % 7 - (b + 6) % 7); // 月始まり
    const order = days.length >= 3 ? ['heavy', 'light', 'strong', 'light', 'heavy', 'light', 'strong'] : days.length === 2 ? ['heavy', 'strong'] : ['heavy'];
    const plan = {};
    days.forEach((d, i) => {
      const t = STRENGTH_DAYS.find(x => x.key === order[i % order.length]);
      plan[d] = [{ ex: g.ex, sets: t.sets, reps: t.reps, weight: r25(max * t.pct), rest: t.rest, note: t.note, tag: t.nm }];
    });
    avoidCrowded(plan);
    return plan;
  }
  // AIが出した文を取り込む。行の形：「月: ベンチプレス 5x5 62.5kg 休憩3分」
  function parseImport(text) {
    const plan = {}; let n = 0;
    String(text || '').split(/\n/).forEach(line => {
      const m = line.match(/^[\s\-・*]*([日月火水木金土])(?:曜日?)?\s*[:：]\s*(.+)$/);
      if (!m) return;
      const d = DOW.indexOf(m[1]);
      m[2].split(/[、,／\/]/).forEach(part => {
        const p = part.trim().match(/^(.+?)\s+(\d+)\s*[x×X＊*]\s*(\d+)\s*(?:回)?\s*(?:@?\s*(\d+(?:\.\d+)?)\s*kg)?(?:.*?休憩\s*(\d+)\s*分)?/);
        if (!p) return;
        (plan[d] = plan[d] || []).push({ ex: p[1].trim(), sets: Number(p[2]), reps: Number(p[3]), weight: p[4] ? Number(p[4]) : null, rest: p[5] ? Number(p[5]) * 60 : 150, note: '' });
        n++;
      });
    });
    return n ? plan : null;
  }
  function active(d) { const p = (d.programs || []).find(p => p.active) || null; if (p) upgrade(p); return p; }
  // 2026-10-10以前に作ったメニューを今の型に直す（休憩3〜3.5分→2.5分、土曜の強い日を入れ替え）。1回だけ保存
  const upgraded = new Set();
  function upgrade(prog) {
    if (upgraded.has(prog.id)) return; upgraded.add(prog.id);
    const plan = (prog.spec || {}).plan; if (!plan) return;
    let msg = [];
    Object.values(plan).flat().forEach(r => { if ((r.tag === '重い日' || r.tag === '強い日') && r.rest > 150) { r.rest = 150; if (!msg[0]) msg[0] = '休憩を2.5分に短縮'; } });
    if (prog.spec.type === 'strength' && avoidCrowded(plan)) msg.push('土曜の強い日を平日へ移動');
    if (!msg.length) return;
    G.write('gq_save_program', { p: { id: prog.id, name: prog.name, spec: prog.spec, active: true } })
      .then(() => G.toast('メニューを直しました：' + msg.filter(Boolean).join('・'))).catch(() => upgraded.delete(prog.id));
  }
  function todayKey() { return G.jst().getUTCDay(); }
  function weekNo(prog) { const s = new Date((prog.spec.started || prog.created_at.slice(0, 10)) + 'T00:00:00+09:00').getTime(); return Math.floor((Date.now() - s) / (7 * G.DAY)) + 1; }
  function isDeload(prog) { const e = Number(prog.spec.deload_every) || 4; return weekNo(prog) % (e + 1) === 0; }
  // 今日のメニュー（軽く週は重量-15%・セット半分）
  function menuFor(prog, day) {
    const rows = (prog.spec.plan || {})[day] || [];
    const dl = isDeload(prog);
    return rows.map(r => ({ ex: r.ex, sets: dl ? Math.max(1, Math.ceil(r.sets / 2)) : r.sets, reps: r.reps, rest: r.rest || 150, weight: true, inc: r.inc || (isLower(r.ex) ? 5 : 2.5),
      w: r.weight != null ? (dl ? r25(r.weight * 0.85) : r.weight) : '', note: (dl ? '【軽く週】' : '') + (r.note || ''), tag: r.tag || '' }));
  }
  // 次回の重量提案（2-for-2：同じ曜日の直近2回、全セット達成かつRPE8以下 → 上げる。2回連続未達 → -10%）
  function progression(d, prog, day) {
    const ss = d.workouts.filter(w => w.kind === 'custom' && w.program_id === prog.id && w.day_key === day).slice(-2);
    if (ss.length < 2) return [];
    const out = [];
    ((prog.spec.plan || {})[day] || []).forEach(row => {
      const per = ss.map(w => (w.sets || []).filter(s => s.ex === row.ex && Number(s.weight) === Number(row.weight)));
      if (per.some(p => p.length === 0)) return;
      const inc = row.inc || (isLower(row.ex) ? 5 : 2.5);
      const hit = per.every(p => p.length >= row.sets && p.every(s => s.reps >= row.reps && (s.rpe || 0) <= 8));
      const fail = per.every(p => p.some(s => s.reps < row.reps));
      if (hit) out.push({ ex: row.ex, day, from: row.weight, to: Number(row.weight) + inc, msg: `${DOW[day]}曜の${row.ex}：2回連続で全セット達成（余裕あり）。次回は +${inc}kg → ${Number(row.weight) + inc}kg` });
      else if (fail) out.push({ ex: row.ex, day, from: row.weight, to: r25(Number(row.weight) * 0.9), msg: `${DOW[day]}曜の${row.ex}：2回連続で未達。次回は -10% → ${r25(Number(row.weight) * 0.9)}kg（1週だけ）` });
    });
    return out;
  }
  async function applyProgression(d, prog, items) {
    const spec = JSON.parse(JSON.stringify(prog.spec));
    items.forEach(it => { (spec.plan[it.day] || []).forEach(r => { if (r.ex === it.ex && Number(r.weight) === Number(it.from)) r.weight = it.to; }); });
    await G.write('gq_save_program', { p: { id: prog.id, name: prog.name, spec, active: true } });
  }
  // 目標への進み具合（推定1RM）
  function goalStatus(d, prog) {
    const g = prog.spec.goal || {}; if (!g.ex) return null;
    const pts = d.workouts.filter(w => w.kind === 'custom' && w.program_id === prog.id).map(w => {
      const best = Math.max(0, ...(w.sets || []).filter(s => s.ex === g.ex && s.weight && s.reps).map(s => e1rm(Number(s.weight), Number(s.reps))));
      return best ? { t: w.done_at, v: Math.round(best * 10) / 10 } : null;
    }).filter(Boolean);
    const start = e1rm(Number(g.current_w), Number(g.current_r));
    const cur = pts.length ? Math.max(...pts.slice(-3).map(p => p.v)) : start; // 軽い日で下がって見えないよう直近3回の最高
    const heavy = Object.values(prog.spec.plan || {}).flat().filter(r => r.ex === g.ex && r.weight).reduce((a, r) => Math.max(a, Number(r.weight)), 0);
    const inc = isLower(g.ex) ? 5 : 2.5;
    const weeks = heavy && Number(g.target) > heavy ? Math.ceil((Number(g.target) - heavy) / inc * 2) : 0; // 2週に1段
    return { start, cur, target: Number(g.target), pts, weeks, eta: weeks ? new Date(Date.now() + weeks * 7 * G.DAY) : null, heavy };
  }
  function chart(pts, target) {
    if (pts.length < 2) return '';
    const W = 600, H = 160, P = 24, v = pts.map(p => p.v), min = Math.min(...v), max = Math.max(...v, target || 0), span = (max - min) || 1;
    const d = v.map((y, i) => [P + i * (W - 2 * P) / (v.length - 1), H - P - (y - min) / span * (H - 2 * P)]);
    const ty = target ? H - P - (target - min) / span * (H - 2 * P) : null;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}">${ty != null ? `<line x1="${P}" x2="${W - P}" y1="${ty}" y2="${ty}" stroke="var(--shu)" stroke-dasharray="6 4"/>` : ''}<polyline fill="none" stroke="var(--ai)" stroke-width="2.5" points="${d.map(p => p.join(',')).join(' ')}"/>${d.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--ai)"/>`).join('')}</svg>`;
  }
  function aiPrompt(spec) {
    const g = spec.goal || {};
    return `筋トレの1週間プログラムを組んでください。条件：
・目標：${g.ex || '（種目）'} ${g.target || '?'}kg（現在 ${g.current_w || '?'}kg×${g.current_r || '?'}回）${g.deadline ? '、期限 ' + g.deadline : ''}
・行ける曜日：${(spec.days || []).map(d => DOW[d]).join('・') || '未定'}
・制約：${spec.constraints || 'なし'}
・科学的根拠のある方法で（週2〜3回、強度を日ごとに変える波状、2回連続達成で重量アップ、4〜5週に1回は軽く）
・補助種目は本人が希望した場合のみ

出力は必ず次の形式の行だけにしてください（アプリに取り込みます）：
月: ベンチプレス 5x5 62.5kg 休憩3分
木: ベンチプレス 4x8 55kg 休憩2分
土: ベンチプレス 5x3 67.5kg 休憩3分`;
  }

  // ---------- 画面：作る／編集 ----------
  G.routes.program = function () {
    const d = G.data(), prog = active(d);
    const spec = prog ? JSON.parse(JSON.stringify(prog.spec)) : { goal: {}, days: [1, 4, 6], type: 'strength', constraints: '', plan: null, deload_every: 4 };
    let plan = spec.plan;
    const render = () => {
      G.view.innerHTML = `
        <h1>自分メニュー</h1>
        <p class="muted">ゴルフのためだけにジムに行く人はいない。目標・ケガ・行ける曜日は人で違う。ここで自分用に組む。yamadaの段位クエストとは別に進み具合を見せる。</p>
        <div class="card">
          <label class="f">メニューの名前</label><input id="p_name" value="${G.esc(prog ? prog.name : '')}" placeholder="例：ベンチ100kg計画">
          <h3>目標</h3>
          <div class="grid2">
            <div><label class="f">種目</label><input id="g_ex" value="${G.esc(spec.goal.ex || '')}" placeholder="例：ベンチプレス"></div>
            <div><label class="f">目標重量 kg</label><input id="g_target" type="number" step="2.5" value="${spec.goal.target ?? ''}"></div>
            <div><label class="f">今できる重量 kg</label><input id="g_w" type="number" step="2.5" value="${spec.goal.current_w ?? ''}"></div>
            <div><label class="f">その回数</label><input id="g_r" type="number" value="${spec.goal.current_r ?? ''}"></div>
            <div><label class="f">期限（任意）</label><input id="g_dl" type="date" value="${spec.goal.deadline || ''}"></div>
          </div>
          <h3>行ける曜日</h3>
          <div class="chips" id="days">${[1, 2, 3, 4, 5, 6, 0].map(x => `<button class="chip ${(spec.days || []).includes(x) ? 'on' : ''}" data-d="${x}">${DOW[x]}</button>`).join('')}</div>
          <h3>組み方</h3>
          <div class="chips" id="type">${[['strength', '筋力（波状・科学の型）'], ['manual', '自分で決める']].map(([k, l]) => `<button class="chip ${spec.type === k ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div>
          <label class="f">制約（ケガ・使えない部位・やりたくない事）</label><textarea id="cons" placeholder="例：左足首ケガ中でレッグドライブ不可。補助種目なし。">${G.esc(spec.constraints || '')}</textarea>
          <div class="row" style="margin-top:8px"><button class="btn primary" id="gen">この条件で組む</button><button class="btn" id="ai">AIに組ませる</button></div>
          <div id="aiBox" hidden><p class="muted">下の質問文で${G.aiName()}に組ませ、返ってきた「月: 種目 5x5 62.5kg 休憩3分」の行を貼り付けて取り込む。</p>${G.aiButtons(aiPrompt(spec))}<textarea id="imp" placeholder="月: ベンチプレス 5x5 62.5kg 休憩3分"></textarea><button class="btn small" id="doImp">取り込む</button></div>
        </div>
        <div id="planBox">${planHtml()}</div>
        <button class="btn primary wide" id="save" ${plan ? '' : 'disabled'}>保存する</button>
        ${prog ? '<button class="btn wide ghost" id="stopP">このメニューをやめる</button>' : ''}
        <p class="muted">休憩は重い日・強い日も2.5分（台を使える20分に準備運動込みで収まる）。土曜は混むので強い日は入れない。</p>
        <p class="muted">上げ方：同じ曜日で2回連続「全セット達成・きつさ8以下」なら次回+2.5kg（脚は+5kg）。2回連続未達なら-10%。4週ごとに1週「軽く」（重量-15%・セット半分）。</p>`;
      bind();
    };
    const planHtml = () => {
      if (!plan) return '';
      return `<div class="card"><h3 style="margin-top:0">週のメニュー（数字は直せる）</h3>
        ${Object.keys(plan).map(Number).sort((a, b) => (a + 6) % 7 - (b + 6) % 7).map(dk => `<div class="item"><div class="ttl">${DOW[dk]}曜 ${plan[dk][0] && plan[dk][0].tag ? '<span class="tag">' + G.esc(plan[dk][0].tag) + '</span>' : ''}</div>
          ${plan[dk].map((r, i) => `<div class="grid3" data-row="${dk}:${i}" style="margin:6px 0"><input class="r-ex" value="${G.esc(r.ex)}" placeholder="種目" style="grid-column:span 3"><input class="r-sets" type="number" value="${r.sets}" placeholder="セット"><input class="r-reps" type="number" value="${r.reps}" placeholder="回数"><input class="r-w" type="number" step="2.5" value="${r.weight ?? ''}" placeholder="kg"><input class="r-note" value="${G.esc(r.note || '')}" placeholder="メモ" style="grid-column:span 2"><button class="btn small ghost r-del">削除</button></div>`).join('')}
          <button class="btn small" data-add="${dk}">＋種目を足す</button></div>`).join('')}</div>`;
    };
    const readForm = () => {
      spec.goal = { ex: G.$('#g_ex').value.trim(), target: G.$('#g_target').value, current_w: G.$('#g_w').value, current_r: G.$('#g_r').value, deadline: G.$('#g_dl').value };
      spec.days = [...G.view.querySelectorAll('#days .chip.on')].map(b => Number(b.dataset.d));
      spec.type = (G.view.querySelector('#type .chip.on') || {}).dataset ? G.view.querySelector('#type .chip.on').dataset.t : 'strength';
      spec.constraints = G.$('#cons').value;
    };
    const readPlan = () => {
      if (!plan) return;
      G.view.querySelectorAll('[data-row]').forEach(row => {
        const [dk, i] = row.dataset.row.split(':').map(Number); const r = plan[dk][i]; if (!r) return;
        r.ex = row.querySelector('.r-ex').value.trim(); r.sets = Number(row.querySelector('.r-sets').value) || 1; r.reps = Number(row.querySelector('.r-reps').value) || 1;
        const w = row.querySelector('.r-w').value; r.weight = w === '' ? null : Number(w); r.note = row.querySelector('.r-note').value;
      });
    };
    const bind = () => {
      G.view.querySelectorAll('#days .chip').forEach(b => b.onclick = () => b.classList.toggle('on'));
      G.view.querySelectorAll('#type .chip').forEach(b => b.onclick = () => G.view.querySelectorAll('#type .chip').forEach(x => x.classList.toggle('on', x === b)));
      G.$('#gen').onclick = () => {
        readForm();
        if (!spec.goal.ex) { G.toast('目標の種目を入れてください'); return; }
        if (!spec.days.length) { G.toast('行ける曜日を選んでください'); return; }
        if (spec.type === 'strength') { if (!spec.goal.current_w || !spec.goal.current_r) { G.toast('今できる重量と回数を入れてください'); return; } plan = generate(spec); }
        else { plan = {}; spec.days.forEach(dk => plan[dk] = [{ ex: spec.goal.ex, sets: 5, reps: 5, weight: Number(spec.goal.current_w) || null, rest: 180, note: '' }]); }
        render();
      };
      G.$('#ai').onclick = () => { readForm(); G.$('#aiBox').hidden = !G.$('#aiBox').hidden; };
      const imp = G.$('#doImp'); if (imp) imp.onclick = () => { const p = parseImport(G.$('#imp').value); if (!p) { G.toast('読み取れる行がありません（月: 種目 5x5 60kg の形）'); return; } readForm(); spec.type = 'imported'; plan = p; spec.days = Object.keys(p).map(Number); render(); };
      G.view.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { readForm(); readPlan(); plan[b.dataset.add].push({ ex: '', sets: 3, reps: 8, weight: null, rest: 120, note: '' }); render(); });
      G.view.querySelectorAll('.r-del').forEach(b => b.onclick = () => { readForm(); readPlan(); const [dk, i] = b.closest('[data-row]').dataset.row.split(':').map(Number); plan[dk].splice(i, 1); if (!plan[dk].length) delete plan[dk]; render(); });
      G.$('#save').onclick = async () => {
        readForm(); readPlan();
        if (!plan || !Object.keys(plan).length) { G.toast('先にメニューを組んでください'); return; }
        spec.plan = plan; spec.days = Object.keys(plan).map(Number); if (!spec.started) spec.started = G.todayKey();
        const name = G.$('#p_name').value.trim() || (spec.goal.ex ? `${spec.goal.ex}${spec.goal.target ? spec.goal.target + 'kg' : ''}計画` : '自分メニュー');
        G.$('#save').disabled = true;
        try { await G.write('gq_save_program', { p: { id: prog ? prog.id : '', name, spec, active: true } }); G.toast('保存しました'); location.hash = '#train'; G.route(); } catch (e) { G.toast(e.message); G.$('#save').disabled = false; }
      };
      const st = G.$('#stopP'); if (st) st.onclick = async () => { if (!G.confirmBox('このメニューをやめますか？（記録は残ります）')) return; try { await G.write('gq_save_program', { p: { id: prog.id, name: prog.name, spec: prog.spec, active: false } }); location.hash = '#train'; G.route(); } catch (e) { G.toast(e.message); } };
    };
    render();
  };

  // 筋トレタブに出すカード
  function card(d) {
    const prog = active(d);
    if (!prog) return `<div class="card"><h3 style="margin-top:0">自分メニュー</h3><p class="muted">目標（例：ベンチ100kg）・ケガ・行ける曜日から、自分用の週プログラムを組む。AIに組ませて取り込むこともできる。</p><a class="btn wide" href="#program">自分メニューを作る</a></div>`;
    const day = todayKey(), menu = menuFor(prog, day), gs = goalStatus(d, prog);
    const days = Object.keys(prog.spec.plan || {}).map(Number);
    const next = [1, 2, 3, 4, 5, 6, 7].map(i => (day + i) % 7).find(x => days.includes(x));
    const doneToday = d.workouts.some(w => w.kind === 'custom' && w.program_id === prog.id && G.dayKey(w.done_at) === G.todayKey());
    const wk = G.weekKey(), doneWk = d.workouts.filter(w => w.kind === 'custom' && w.program_id === prog.id && G.weekKey(w.done_at) === wk).length;
    return `<div class="card">
      <div class="row between"><h3 style="margin:0">${G.esc(prog.name)} <span class="tag">自分メニュー</span></h3><a class="btn small ghost" href="#program">編集</a></div>
      ${gs ? `<div class="muted">推定1RM ${G.n1(gs.cur)}kg → 目標 ${gs.target}kg${gs.weeks ? `（今の上げ幅なら約${gs.weeks}週・${gs.eta.getFullYear()}年${gs.eta.getMonth() + 1}月ごろ）` : ''}</div>${G.meter(Math.max(0, gs.cur - gs.start), Math.max(1, gs.target - gs.start), gs.cur >= gs.target)}${chart(gs.pts, gs.target)}` : ''}
      <p class="muted">第${weekNo(prog)}週${isDeload(prog) ? '・<b>軽く週</b>（重量-15%・セット半分）' : ''} ／ 今週 ${doneWk}/${days.length}回</p>
      ${menu.length ? `${menu.map(x => `<div class="item"><div class="ttl">${G.esc(x.ex)} ${x.reps}回 × ${x.sets}セット ${x.w !== '' ? x.w + 'kg' : ''} ${x.tag ? '<span class="tag">' + G.esc(x.tag) + '</span>' : ''}</div><div class="sub">休憩${Math.round(x.rest / 60 * 10) / 10}分 ${G.esc(x.note)}</div></div>`).join('')}
        ${doneToday ? '<div class="note ok">今日の分は記録済み。</div>' : ''}<button class="btn primary wide big" id="startCustom">今日のメニューを開始</button>`
      : `<p class="muted">今日（${DOW[day]}）は休み。次は${DOW[next]}曜。</p>`}
      ${progression(d, prog, day).map(p => `<div class="note ok">${G.esc(p.msg)}</div>`).join('')}
    </div>`;
  }

  G.program = { active, todayKey, menuFor, progression, applyProgression, goalStatus, card, e1rm, DOW };
})();
