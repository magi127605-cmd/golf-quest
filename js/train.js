/* 筋トレ（note①）：爆発トレ 5回×5セット・48時間ロック・速度が落ちたら終了・BIG3は12週後 */
(function () {
  'use strict';
  const G = window.GQ, EXNAME = () => G.rank.EXNAME;
  const MENU = {
    home: [{ ex: 'jump_squat', sets: 5, reps: 5, rest: 120, weight: false, tip: '肩幅・半分しゃがむ・全力で真上・着地1〜2秒で次。膝が内に入らない' }],
    gym: [
      { ex: 'high_pull', sets: 5, reps: 5, rest: 150, weight: true, tip: 'ハングから胸の高さまで全力で引き上げ。キャッチしない。バーが遅くなったら重すぎ（目安デッドMAXの40〜60%）' },
      { ex: 'box_jump', sets: 3, reps: 5, rest: 120, weight: false, tip: '50〜60cmの台に全力で飛び乗る。降りる時は歩いて。不安な高さはやらない' },
    ],
    big3: [
      { ex: 'squat', sets: 3, reps: 5, rest: 180, weight: true, inc: 5 },
      { ex: 'dead', sets: 3, reps: 5, rest: 180, weight: true, inc: 5 },
      { ex: 'bench', sets: 3, reps: 5, rest: 180, weight: true, inc: 2.5 },
    ],
  };
  const SPEED_LBL = { jump_squat: '高く速く飛べたか', high_pull: 'バーの速さ', box_jump: '着地が静かで速かったか', big3: 'きつさ(RPE)' };

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
        if (hit && same) out.push({ ex: mn.ex, msg: `${EXNAME()[mn.ex]}：2回連続で全セット達成。次回は +${mn.inc}kg（${Number(per[1][0].weight) + mn.inc}kg）`, newWeight: Number(per[1][0].weight) + mn.inc });
        else if (fail) out.push({ ex: mn.ex, msg: `${EXNAME()[mn.ex]}：2回連続で未達。次回は重量-10%で1週（ディロード）`, newWeight: Math.round(Number(per[1][0].weight) * 0.9 / 2.5) * 2.5 });
      } else {
        const fast = per.every(p => p.length >= mn.sets && p.every(s => (s.speed || 0) >= 4 && s.reps >= mn.reps));
        const slow = per.every(p => p.some(s => (s.speed || 0) <= 2));
        if (fast) out.push({ ex: mn.ex, msg: mn.ex === 'jump_squat' ? 'ジャンプスクワット：2回連続「全部速い」。次段階＝ダンベル保持（体重の10〜20%）か片脚。それ以上は重くしない'
          : mn.ex === 'high_pull' ? `ハイプル：2回連続で全レップ速い。次回 +2.5kg` : 'ボックスジャンプ：2回連続で着地が静か。箱を1段高く' });
        if (slow) out.push({ ex: mn.ex, msg: `${EXNAME()[mn.ex]}：2回連続で速度が落ちた。負荷を下げるか、休みを増やす` });
      }
    });
    return out;
  }

  // ---------- 画面 ----------
  G.routes.train = function (arg) {
    const d = G.data(), m = d.member, r = G.rank.compute(d);
    if (G.S.wip.workout) return runner();
    if (!m.course) return chooseCourse();
    const last = lastExplosive(d), lockLeft = last ? new Date(last.done_at).getTime() + 48 * G.HOUR - Date.now() : 0;
    const wc = weekCount(d, 'explosive'), todayEx = last && G.dayKey(last.done_at) === G.todayKey();
    const b3today = d.workouts.some(w => w.kind === 'big3' && G.dayKey(w.done_at) === G.todayKey());
    const menu = MENU[m.course];
    const prog = progression(d, 'explosive', m.course);
    G.view.innerHTML = `
      <h1>筋トレ <span class="tag">${m.course === 'gym' ? 'ジムコース' : '自重コース'}</span> <a class="btn small ghost" href="#train/course">切替</a></h1>
      <div class="card">
        <h3 style="margin-top:0">今日の爆発トレ</h3>
        ${menu.map(x => `<div class="item"><div class="ttl">${EXNAME()[x.ex]} ${x.reps}回 × ${x.sets}セット</div><div class="sub">休憩${Math.round(x.rest / 60 * 10) / 10}分・${G.esc(x.tip)}</div></div>`).join('')}
        <p class="muted">週${wc}回目${wc >= 3 ? '（週3回が上限。4回目は逆効果）' : ''} ／ 前回 ${last ? G.fmtDateTime(last.done_at) : 'なし'}</p>
        ${lockLeft > 0 ? `<div class="note warn">48時間ロック中。次にできるのは <b>${G.fmtDur(lockLeft)}</b>（神経の回復に48時間）</div>` : ''}
        ${b3today ? `<div class="note warn">今日はBIG3をやった日。同じ日にやるなら「重い→3〜5分休む→速い」の順だけ。</div>` : ''}
        <button class="btn primary wide big" id="startEx" ${lockLeft > 0 ? 'disabled' : ''}>開始する</button>
        ${prog.length ? `<div class="note ok">${prog.map(p => G.esc(p.msg)).join('<br>')}</div>` : ''}
        <p class="muted">絶対のルール：スピードが落ちたら終了。予定の回数が残っていてもやめる（減点にならない）。</p>
      </div>

      <div class="card">
        <h3 style="margin-top:0">BIG3（開始3か月後から・別日）</h3>
        ${r.big3Unlocked ? `
          <p class="muted">スクワット・デッドリフト・ベンチプレス 3〜5回×3セット。2回連続で全セット達成→+5kg（ベンチ+2.5kg）。RPE9以上なら据え置き。</p>
          ${todayEx ? `<div class="note warn">今日は爆発トレをやった日。ジャンプの後に重いスクワットはケガの元。別日が基本。</div>` : ''}
          <button class="btn wide" id="startB3">BIG3を開始する</button>
          ${progression(d, 'big3').map(p => `<div class="note ok">${G.esc(p.msg)}</div>`).join('')}`
        : `<p class="muted">解禁まであと <b>${Math.max(0, 12 - r.weeksSinceStart)}週</b>。最初の3か月は爆発系だけ。爆発力の天井は筋力で決まるが、順番を守れ。</p>`}
      </div>

      <h2>記録</h2>
      ${d.workouts.slice().reverse().slice(0, 30).map(w => `<div class="item"><div class="row between"><div class="ttl">${G.fmtDateTime(w.done_at)} ${w.kind === 'big3' ? 'BIG3' : '爆発トレ'}${w.stopped_early ? ' <span class="tag ok">速度低下で終了</span>' : ''}</div><button class="btn small ghost" data-del="${w.id}">取消</button></div>
        <div class="sub">${(w.sets || []).map(s => `${EXNAME()[s.ex] || s.ex}${s.weight != null && s.weight !== '' ? ' ' + s.weight + 'kg' : ''}×${s.reps}${s.speed ? ' 速' + s.speed : ''}${s.rpe ? ' RPE' + s.rpe : ''}`).join(' ／ ')}${w.note ? '<br>' + G.esc(w.note) : ''}</div></div>`).join('') || '<p class="muted">まだ記録がありません。</p>'}`;
    G.$('#startEx').onclick = () => { if (wc >= 3 && !G.confirmBox('今週すでに3回やっています。4回目は逆効果です。それでも始めますか？')) return; start('explosive', m.course); };
    const b3 = G.$('#startB3'); if (b3) b3.onclick = () => start('big3', m.course);
    G.view.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!G.confirmBox('この記録を取り消しますか？')) return; try { await G.write('gq_delete_row', { p_table: 'workouts', p_id: b.dataset.del }); G.toast('取り消しました'); G.route(); } catch (e) { G.toast(e.message); } });
    if (arg === 'course') chooseCourse();
  };

  function chooseCourse() {
    const m = G.member();
    G.view.innerHTML = `
      <h1>コースを選ぶ</h1>
      <p class="muted">途中で切り替えられます。どちらも目的は同じ＝脳にスイング用の神経回路を刻む。</p>
      <div class="card"><div class="ttl" style="font-weight:700">自重コース（家トレ）</div><p class="muted">ジャンプスクワット1種目。5回×5セット・休憩2分・週2〜3回・1回10分。</p><button class="btn primary wide" data-course="home">自重コースにする</button></div>
      <div class="card"><div class="ttl" style="font-weight:700">ジムコース</div><p class="muted">ハイプル5×5＋ボックスジャンプ5×3。休憩2〜3分・週2回・1回30〜40分。</p><button class="btn primary wide" data-course="gym">ジムコースにする</button></div>
      ${m.course ? '<a class="btn wide ghost" href="#train">戻る</a>' : ''}`;
    G.view.querySelectorAll('[data-course]').forEach(b => b.onclick = async () => { try { await G.updateMember({ course: b.dataset.course }); location.hash = '#train'; G.route(); } catch (e) { G.toast(e.message); } });
  }

  function start(kind, course) {
    const m = G.member();
    const menu = (kind === 'big3' ? MENU.big3 : MENU[course]).map(x => ({ ex: x.ex, sets: x.sets, reps: x.reps, rest: x.rest, weight: x.weight, inc: x.inc, w: kind === 'big3' ? ((m.lifts || {})[x.ex] || '') : '' }));
    G.S.wip.workout = { kind, course, startedAt: Date.now(), menu, ei: 0, si: 0, done: [], resting: false };
    G.save(); runner();
  }

  function runner() {
    const W = G.S.wip.workout, cur = W.menu[W.ei];
    const isB3 = W.kind === 'big3';
    const total = W.menu.reduce((a, x) => a + x.sets, 0);
    if (W.resting) return rest();
    G.view.innerHTML = `
      <div class="row between"><h1 style="margin:0">${isB3 ? 'BIG3' : '爆発トレ'}</h1><span class="muted">${W.done.length}/${total}セット</span></div>
      <div class="card">
        <div class="muted">${W.ei + 1}/${W.menu.length}種目 ・ セット ${W.si + 1}/${cur.sets}</div>
        <div style="font-size:24px;font-weight:800">${EXNAME()[cur.ex]}</div>
        <div class="muted">${cur.reps}回${isB3 ? '（3〜5回）' : ''}</div>
        <div class="grid2">
          <div><label class="f">回数</label><input id="reps" type="number" inputmode="numeric" value="${cur.reps}" min="0" max="20"></div>
          ${cur.weight ? `<div><label class="f">重量 kg</label><input id="wt" type="number" inputmode="decimal" step="2.5" value="${cur.w}"></div>` : `<div><label class="f">追加負荷 kg（なしは空欄）</label><input id="wt" type="number" inputmode="decimal" step="1" value="${cur.w}"></div>`}
        </div>
        <label class="f">${isB3 ? 'きつさ RPE（10＝限界）' : SPEED_LBL[cur.ex] + '（5＝最高に速い）'}</label>
        <div class="speed" id="spd">${(isB3 ? [6, 7, 8, 9, 10] : [1, 2, 3, 4, 5]).map(v => `<button data-v="${v}">${v}</button>`).join('')}</div>
        <button class="btn primary wide big" id="doneSet" style="margin-top:12px">セット完了</button>
        <button class="btn wide ng" id="stopSlow" style="margin-top:8px">${isB3 ? 'ここで終了する' : '速度が落ちたので終了'}</button>
        <p class="muted">${isB3 ? '同じ重さで2回連続「全セット達成」なら次回重量アップ。RPE9以上なら据え置き。' : '遅くなった動作を繰り返すと脳が「遅く動く」ことを学習する。落ちたら止めるのが正解。'}</p>
      </div>
      <button class="btn wide ghost" id="abort">記録せずに中止</button>`;
    let val = null;
    G.view.querySelectorAll('#spd button').forEach(b => b.onclick = () => { val = Number(b.dataset.v); G.view.querySelectorAll('#spd button').forEach(x => x.classList.toggle('on', x === b)); });
    const push = () => {
      if (val == null) { G.toast(isB3 ? 'きつさを選んでください' : '速さを選んでください'); return false; }
      const wt = G.$('#wt').value; const set = { ex: cur.ex, reps: Number(G.$('#reps').value) || 0, weight: wt === '' ? null : Number(wt) };
      if (isB3) set.rpe = val; else set.speed = val;
      cur.w = wt; W.done.push(set); G.save(); return true;
    };
    G.$('#doneSet').onclick = () => {
      if (!push()) return;
      W.si++;
      if (W.si >= cur.sets) { W.ei++; W.si = 0; }
      if (W.ei >= W.menu.length) return finish(false);
      W.resting = true; W.restMs = cur.rest * 1000; G.save(); rest();
    };
    G.$('#stopSlow').onclick = () => { if (val != null) push(); finish(!isB3); };
    G.$('#abort').onclick = () => { if (G.confirmBox('記録せずに中止しますか？')) { G.S.wip.workout = null; G.save(); G.route(); } };
  }
  function rest() {
    const W = G.S.wip.workout, next = W.menu[W.ei];
    G.view.innerHTML = `
      <h1>休憩</h1>
      <div class="card center">
        <div class="timer" id="tm">--:--</div>
        <p class="muted">次：${EXNAME()[next.ex]} セット${W.si + 1}/${next.sets}。筋肉は1分で回復するが神経は2〜3分かかる。</p>
        <button class="btn primary wide" id="skip">次のセットへ</button>
      </div>`;
    G.startTimer(G.$('#tm'), W.restMs || 120000, () => { try { navigator.vibrate && navigator.vibrate(200); } catch (e) { } });
    G.$('#skip').onclick = () => { W.resting = false; G.save(); runner(); };
  }
  async function finish(stoppedEarly) {
    const W = G.S.wip.workout;
    if (!W.done.length) { G.S.wip.workout = null; G.save(); G.route(); return; }
    G.stopTimer();
    G.view.innerHTML = `<h1>お疲れ</h1><div class="card"><label class="f">一言メモ（任意）</label><input id="note" placeholder="例：3セット目から遅くなった"><button class="btn primary wide" id="save" style="margin-top:10px">記録する</button></div>`;
    G.$('#save').onclick = async () => {
      G.$('#save').disabled = true;
      try {
        await G.write('gq_add_workout', { p: { kind: W.kind, course: W.course, sets: W.done, stopped_early: !!stoppedEarly, note: G.$('#note').value } });
        // BIG3 の重量を控えておく（次回の初期値）
        if (W.kind === 'big3') { const lifts = Object.assign({}, G.member().lifts || {}); W.done.forEach(s => { if (s.weight != null) lifts[s.ex] = s.weight; }); try { await G.updateMember({ lifts }); } catch (e) { } }
        G.S.wip.workout = null; G.save();
        const prog = progression(G.data(), W.kind, W.course);
        G.toast('記録しました');
        if (prog.length) alert(prog.map(p => p.msg).join('\n'));
        location.hash = '#train'; G.route();
      } catch (e) { G.toast(e.message); G.$('#save').disabled = false; }
    };
  }
})();
