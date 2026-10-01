/* 筋トレタブ（Hevy型）：空のワークアウト／ルーティン（自分メニュー・yamada爆発トレ・BIG3）／履歴 */
(function () {
  'use strict';
  const G = window.GQ, disp = ex => G.workout.disp(ex);
  const MENU = {
    home: [{ ex: 'jump_squat', sets: 5, reps: 5, rest: 120, tip: '肩幅・半分しゃがむ・全力で真上・着地1〜2秒で次。膝が内に入らない' }],
    gym: [
      { ex: 'high_pull', sets: 5, reps: 5, rest: 150, tip: 'ハングから胸の高さまで全力で引き上げ。キャッチしない。バーが遅くなったら重すぎ' },
      { ex: 'box_jump', sets: 3, reps: 5, rest: 120, tip: '50〜60cmの台に全力で飛び乗る。降りる時は歩いて' },
    ],
    big3: [
      { ex: 'squat', sets: 3, reps: 5, rest: 180, inc: 5 },
      { ex: 'dead', sets: 3, reps: 5, rest: 180, inc: 5 },
      { ex: 'bench', sets: 3, reps: 5, rest: 180, inc: 2.5 },
    ],
  };
  function lastExplosive(d) { const ex = d.workouts.filter(w => w.kind === 'explosive'); return ex.length ? ex[ex.length - 1] : null; }
  function weekCount(d, kind) { const wk = G.weekKey(); return d.workouts.filter(w => w.kind === kind && G.weekKey(w.done_at) === wk).length; }

  // 次のレベル判定（仕様4章）。直近2回のセッションを見る
  function progression(d, kind, course) {
    const ss = d.workouts.filter(w => w.kind === kind && (kind === 'big3' || w.course === course)).slice(-2);
    if (ss.length < 2) return [];
    const out = [];
    const menu = kind === 'big3' ? MENU.big3 : MENU[course];
    menu.forEach(mn => {
      const per = ss.map(w => (w.sets || []).filter(s => s.ex === mn.ex));
      if (per.some(p => p.length === 0)) return;
      if (kind === 'big3') {
        const hit = per.every(p => p.length >= mn.sets && p.every(s => s.reps >= mn.reps && (s.rpe || 0) < 9));
        const same = per[0][0].weight != null && per[0][0].weight === per[1][0].weight;
        const fail = per.every(p => p.some(s => s.reps < mn.reps));
        if (hit && same) out.push({ ex: mn.ex, msg: `${disp(mn.ex)}：2回連続で全セット達成。次回は +${mn.inc}kg（${Number(per[1][0].weight) + mn.inc}kg）` });
        else if (fail) out.push({ ex: mn.ex, msg: `${disp(mn.ex)}：2回連続で未達。次回は重量-10%で1週（ディロード）` });
      } else {
        const fast = per.every(p => p.length >= mn.sets && p.every(s => (s.speed || 0) >= 4 && s.reps >= mn.reps));
        const slow = per.every(p => p.some(s => (s.speed || 0) <= 2));
        if (fast) out.push({ ex: mn.ex, msg: mn.ex === 'jump_squat' ? 'ジャンプスクワット：2回連続「全部速い」。次段階＝ダンベル保持（体重の10〜20%）か片脚。それ以上は重くしない'
          : mn.ex === 'high_pull' ? `ハイプル：2回連続で全レップ速い。次回 +2.5kg` : 'ボックスジャンプ：2回連続で着地が静か。箱を1段高く' });
        if (slow) out.push({ ex: mn.ex, msg: `${disp(mn.ex)}：2回連続で速度が落ちた。負荷を下げるか、休みを増やす` });
      }
    });
    return out;
  }
  G.train = { progression };

  const KIND = { explosive: '爆発トレ', big3: 'BIG3', custom: '自分メニュー' };
  function bestSet(sets) { let b = null; sets.forEach(s => { const v = (Number(s.weight) || 0) * 1000 + (Number(s.reps) || 0); if (!b || v > b.v) b = { v, s }; }); return b ? b.s : null; }
  function summary(w) {
    const by = {}; (w.sets || []).forEach(s => (by[disp(s.ex)] = by[disp(s.ex)] || []).push(s));
    return Object.entries(by).map(([ex, ss]) => { const b = bestSet(ss); return `<div class="row between"><span>${G.esc(ex)} <span class="muted">${ss.length}セット</span></span><span class="muted">${b ? (b.weight != null ? b.weight + 'kg×' : '') + b.reps + (b.weight == null ? '回' : '') : ''}</span></div>`; }).join('');
  }

  G.routes.train = function (arg) {
    const d = G.data(), m = d.member, r = G.rank.compute(d);
    if (G.S.wip.workout) return G.workout.resume();
    if (arg === 'course') return chooseCourse();
    const last = lastExplosive(d), lockLeft = last ? new Date(last.done_at).getTime() + 48 * G.HOUR - Date.now() : 0;
    const wc = weekCount(d, 'explosive'), todayEx = last && G.dayKey(last.done_at) === G.todayKey();
    const b3today = d.workouts.some(w => w.kind === 'big3' && G.dayKey(w.done_at) === G.todayKey());
    const prog = G.program.active(d), today = G.program.todayKey(), DOW = G.program.DOW;
    const gs = prog ? G.program.goalStatus(d, prog) : null;
    const progDays = prog ? Object.keys(prog.spec.plan || {}).map(Number).sort((a, b) => (a + 6) % 7 - (b + 6) % 7) : [];
    const exProg = m.course ? progression(d, 'explosive', m.course) : [];

    G.view.innerHTML = `
      <h1>筋トレ</h1>
      <button class="btn primary wide big" id="startEmpty">＋ 空のワークアウトを開始</button>
      ${G.maxes.card(d)}

      <div class="row between" style="margin-top:20px"><h2 style="margin:0">ルーティン</h2><a class="btn small ghost" href="#program">${prog ? '自分メニューを編集' : '自分メニューを作る'}</a></div>
      ${prog ? `<div class="card">
        <div class="ttl" style="font-weight:700">${G.esc(prog.name)}</div>
        ${gs ? `<div class="muted">推定1RM ${G.n1(gs.cur)}kg → 目標 ${gs.target}kg${gs.weeks ? `（約${gs.weeks}週・${gs.eta.getFullYear()}年${gs.eta.getMonth() + 1}月ごろ）` : ''}</div>${G.meter(Math.max(0, gs.cur - gs.start), Math.max(1, gs.target - gs.start), gs.cur >= gs.target)}` : ''}
        ${progDays.map(dk => { const rows = G.program.menuFor(prog, dk); const isToday = dk === today; return `<div class="item ${isToday ? 'done' : ''}"><div class="row between"><div class="ttl">${DOW[dk]}曜 ${rows[0] && rows[0].tag ? '<span class="tag">' + G.esc(rows[0].tag) + '</span>' : ''}${isToday ? '<span class="tag ok">今日</span>' : ''}</div><button class="btn small ${isToday ? 'primary' : ''}" data-prog-day="${dk}">開始</button></div><div class="sub">${rows.map(x => `${G.esc(x.ex)} ${x.sets}×${x.reps}${x.w !== '' ? ' ' + x.w + 'kg' : ''}`).join('・')}</div></div>`; }).join('')}
        ${G.program.progression(d, prog, today).map(p => `<div class="note ok">${G.esc(p.msg)}</div>`).join('')}
      </div>` : ''}

      <div class="card">
        <div class="row between"><div class="ttl" style="font-weight:700">yamadaの爆発トレ ${m.course ? `<span class="tag">${m.course === 'gym' ? 'ジム' : '自重'}</span>` : ''}</div>${m.course ? '<a class="btn small ghost" href="#train/course">切替</a>' : ''}</div>
        ${!m.course ? `<p class="muted">飛距離は「筋力を出す速さ」で決まる。まず自重／ジムを選ぶ（段位0のクエスト）。</p><a class="btn wide" href="#train/course">コースを選ぶ</a>` : `
        <div class="sub muted">${MENU[m.course].map(x => `${disp(x.ex)} ${x.sets}×${x.reps}`).join('・')}・週2〜3回・48時間空ける・速度が落ちたら終了</div>
        <p class="muted">週${wc}回目${wc >= 3 ? '（週3回が上限）' : ''} ／ 前回 ${last ? G.fmtDateTime(last.done_at) : 'なし'}</p>
        ${lockLeft > 0 ? `<div class="note warn">48時間ロック中。次にできるのは <b>${G.fmtDur(lockLeft)}</b></div>` : ''}
        ${b3today ? `<div class="note warn">今日はBIG3をやった日。同じ日にやるなら「重い→3〜5分休む→速い」の順だけ。</div>` : ''}
        <button class="btn wide ${lockLeft > 0 ? '' : 'primary'}" id="startEx" ${lockLeft > 0 ? 'disabled' : ''}>開始</button>
        ${exProg.length ? `<div class="note ok">${exProg.map(p => G.esc(p.msg)).join('<br>')}</div>` : ''}`}
      </div>

      <div class="card">
        <div class="ttl" style="font-weight:700">BIG3 <span class="muted">開始3か月後から・別日</span></div>
        ${r.big3Unlocked ? `<div class="sub muted">スクワット・デッドリフト・ベンチプレス 3〜5回×3セット。2回連続達成→+5kg（ベンチ+2.5kg）</div>
          ${todayEx ? `<div class="note warn">今日は爆発トレをやった日。ジャンプの後に重いスクワットはケガの元。</div>` : ''}
          <button class="btn wide" id="startB3">開始</button>
          ${progression(d, 'big3').map(p => `<div class="note ok">${G.esc(p.msg)}</div>`).join('')}`
        : `<p class="muted">解禁まであと <b>${Math.max(0, 12 - r.weeksSinceStart)}週</b>。個別の目標（ベンチ等）は「自分メニュー」で。</p>`}
      </div>

      <h2>履歴</h2>
      ${d.workouts.slice().reverse().slice(0, 30).map(w => `<div class="card flat"><div class="row between"><div><div class="ttl" style="font-weight:700">${G.esc(w.title || KIND[w.kind] || w.kind)}</div><div class="muted">${G.fmtDateTime(w.done_at)}${w.duration_sec ? ' ・ ' + Math.round(w.duration_sec / 60) + '分' : ''}${w.stopped_early ? ' ・ 速度低下で終了' : ''}</div></div><button class="btn small ghost" data-del="${w.id}">取消</button></div>
        <div style="margin-top:6px">${summary(w)}</div>${w.note ? `<div class="muted">${G.esc(w.note)}</div>` : ''}</div>`).join('') || '<p class="muted">まだ記録がありません。</p>'}`;

    G.$('#startEmpty').onclick = () => G.workout.start({ kind: 'custom', title: 'ワークアウト', exercises: [] });
    const se = G.$('#startEx'); if (se) se.onclick = () => {
      if (wc >= 3 && !G.confirmBox('今週すでに3回やっています。4回目は逆効果です。それでも始めますか？')) return;
      G.workout.start({ kind: 'explosive', course: m.course, title: '爆発トレ', exercises: MENU[m.course].map(x => ({ ex: x.ex, rest: x.rest, mode: 'speed', note: x.tip, sets: Array.from({ length: x.sets }, () => ({ reps: x.reps })) })) });
    };
    const b3 = G.$('#startB3'); if (b3) b3.onclick = () => G.workout.start({ kind: 'big3', course: m.course, title: 'BIG3', exercises: MENU.big3.map(x => ({ ex: x.ex, rest: x.rest, mode: 'rpe', sets: Array.from({ length: x.sets }, () => ({ reps: x.reps, weight: (m.lifts || {})[x.ex] ?? '' })) })) });
    G.view.querySelectorAll('[data-prog-day]').forEach(b => b.onclick = () => {
      const dk = Number(b.dataset.progDay), rows = G.program.menuFor(prog, dk);
      G.workout.start({ kind: 'custom', program_id: prog.id, day_key: dk, title: `${prog.name}・${DOW[dk]}曜${rows[0] && rows[0].tag ? ' ' + rows[0].tag : ''}`,
        exercises: rows.map(x => ({ ex: x.ex, rest: x.rest, mode: 'rpe', note: x.note, sets: Array.from({ length: x.sets }, () => ({ reps: x.reps, weight: x.w })) })) });
    });
    G.view.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!G.confirmBox('この記録を取り消しますか？')) return; try { await G.write('gq_delete_row', { p_table: 'workouts', p_id: b.dataset.del }); G.toast('取り消しました'); G.route(); } catch (e) { G.toast(e.message); } });
  };

  function chooseCourse() {
    G.view.innerHTML = `
      <h1>コースを選ぶ</h1>
      <p class="muted">途中で切り替えられます。どちらも目的は同じ＝脳にスイング用の神経回路を刻む。</p>
      <div class="card"><div class="ttl" style="font-weight:700">自重コース（家トレ）</div><p class="muted">ジャンプスクワット1種目。5回×5セット・休憩2分・週2〜3回・1回10分。</p><button class="btn primary wide" data-course="home">自重コースにする</button></div>
      <div class="card"><div class="ttl" style="font-weight:700">ジムコース</div><p class="muted">ハイプル5×5＋ボックスジャンプ5×3。休憩2〜3分・週2回・1回30〜40分。</p><button class="btn primary wide" data-course="gym">ジムコースにする</button></div>
      <a class="btn wide ghost" href="#train">戻る</a>`;
    G.view.querySelectorAll('[data-course]').forEach(b => b.onclick = async () => { try { await G.updateMember({ course: b.dataset.course }); location.hash = '#train'; G.route(); } catch (e) { G.toast(e.message); } });
  }
})();
