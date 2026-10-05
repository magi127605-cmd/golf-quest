/* ワークアウト記録画面（Hevy型：1ページに全種目・セット表・✓で完了→休憩タイマー） */
(function () {
  'use strict';
  const G = window.GQ;
  const LIB = [
    ['ベンチプレス', '胸'], ['インクラインベンチプレス', '胸'], ['ダンベルベンチプレス', '胸'], ['ダンベルフライ', '胸'], ['ディップス', '胸'], ['腕立て伏せ', '胸'],
    ['スクワット', '脚'], ['フロントスクワット', '脚'], ['レッグプレス', '脚'], ['ブルガリアンスクワット', '脚'], ['ランジ', '脚'], ['レッグカール', '脚'], ['レッグエクステンション', '脚'], ['カーフレイズ', '脚'],
    ['デッドリフト', '背中'], ['ルーマニアンデッドリフト', '背中'], ['懸垂', '背中'], ['ラットプルダウン', '背中'], ['ベントオーバーロウ', '背中'], ['ダンベルロウ', '背中'], ['シーテッドロウ', '背中'],
    ['オーバーヘッドプレス', '肩'], ['ダンベルショルダープレス', '肩'], ['サイドレイズ', '肩'], ['フェイスプル', '肩'],
    ['ハイプル', '爆発'], ['ボックスジャンプ', '爆発'], ['ジャンプスクワット', '爆発'], ['パワークリーン', '爆発'], ['メディシンボールスロー', '爆発'],
    ['プランク', '体幹'], ['ハンギングレッグレイズ', '体幹'], ['キャプテンズチェア', '体幹'], ['パロフプレス', '体幹'], ['ケーブルウッドチョップ', '体幹'],
    ['アームカール', '腕'], ['トライセプスプッシュダウン', '腕'],
  ];
  const YNAME = { jump_squat: 'ジャンプスクワット', high_pull: 'ハイプル', box_jump: 'ボックスジャンプ', squat: 'スクワット', dead: 'デッドリフト', bench: 'ベンチプレス' };
  const disp = ex => YNAME[ex] || ex;
  let tick = null, restTick = null, libOpen = false, libQ = '';

  // 前回の値（同じメニュー・同じ曜日を優先、なければ同じ種目の直近）
  function previous(ex, W) {
    const ws = G.data().workouts.slice().reverse();
    const has = w => (w.sets || []).some(s => disp(s.ex) === disp(ex));
    const w = ws.find(x => x.program_id && x.program_id === W.program_id && x.day_key === W.day_key && has(x)) || ws.find(has);
    return w ? (w.sets || []).filter(s => disp(s.ex) === disp(ex)) : [];
  }

  function start(opts) {
    const W = { v: 2, kind: opts.kind || 'custom', title: opts.title || 'ワークアウト', program_id: opts.program_id || null, day_key: opts.day_key ?? null, course: opts.course || null,
      startedAt: Date.now(), rest: null, exercises: (opts.exercises || []).map(e => ({
        ex: e.ex, rest: e.rest || 120, mode: e.mode || 'rpe', note: e.note || '',
        sets: (e.sets && e.sets.length ? e.sets : [{}, {}, {}]).map(s => ({ weight: s.weight ?? '', reps: s.reps ?? '', rpe: null, done: false })),
      })) };
    G.S.wip.workout = W; G.save(); render();
  }
  function resume() { const W = G.S.wip.workout; if (!W || W.v !== 2) { G.S.wip.workout = null; G.save(); G.route(); return; } render(); }

  function render() {
    const W = G.S.wip.workout; if (!W) return;
    const doneN = W.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
    const vol = W.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).reduce((b, s) => b + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0), 0);
    G.view.innerHTML = `
      <div class="wo-top">
        <div class="grow"><input class="wo-title" id="woTitle" value="${G.esc(W.title)}"><div class="muted"><span id="elapsed">0:00</span> ・ ${doneN}セット ・ ${Math.round(vol)}kg</div></div>
        <button class="btn primary" id="finish">終了</button>
      </div>
      ${W.exercises.map((e, ei) => {
        const prev = previous(e.ex, W);
        return `<div class="card wo-ex" data-ei="${ei}">
          <div class="row between"><div class="ttl" style="font-weight:700;font-size:17px">${G.esc(disp(e.ex))}</div><button class="btn small ghost ex-del">削除</button></div>
          <input class="ex-note" placeholder="メモ（例：胸で1秒止める）" value="${G.esc(e.note)}">
          <table class="settbl"><tr><th>セット</th><th>前回</th><th>kg</th><th>回</th><th>${e.mode === 'speed' ? '速さ' : 'RPE'}</th><th></th></tr>
            ${e.sets.map((s, si) => `<tr class="${s.done ? 'done' : ''}" data-si="${si}">
              <td class="n">${si + 1}</td>
              <td class="prev">${prev[si] ? `${prev[si].weight != null ? prev[si].weight + 'kg' : '—'}×${prev[si].reps}` : '—'}</td>
              <td><input class="s-w" type="number" inputmode="decimal" step="2.5" value="${s.weight}" placeholder="${prev[si] && prev[si].weight != null ? prev[si].weight : ''}"></td>
              <td><input class="s-r" type="number" inputmode="numeric" value="${s.reps}" placeholder="${prev[si] ? prev[si].reps : ''}"></td>
              <td><select class="s-rpe"><option value="">-</option>${(e.mode === 'speed' ? [1, 2, 3, 4, 5] : [6, 7, 8, 9, 10]).map(v => `<option ${s.rpe === v ? 'selected' : ''} value="${v}">${v}</option>`).join('')}</select></td>
              <td><button class="chk ${s.done ? 'on' : ''}">✓</button></td>
            </tr>`).join('')}
          </table>
          <div class="row"><button class="btn small set-add">＋ セットを追加</button><span class="muted grow">休憩 ${Math.round(e.rest / 60 * 10) / 10}分</span><button class="btn small ghost set-del">最後のセットを削除</button></div>
        </div>`;
      }).join('')}
      <button class="btn wide" id="addEx">＋ 種目を追加</button>
      ${libOpen ? `<div class="card lib"><input id="libQ" placeholder="種目を検索（自由な名前でもOK）" value="${G.esc(libQ)}">
        <div class="lib-list">${LIB.filter(([n, g]) => !libQ || n.includes(libQ) || g.includes(libQ)).map(([n, g]) => `<button class="lib-item" data-ex="${G.esc(n)}"><span>${G.esc(n)}</span><span class="tag">${g}</span></button>`).join('')}
        ${libQ && !LIB.some(([n]) => n === libQ) ? `<button class="lib-item" data-ex="${G.esc(libQ)}"><span>「${G.esc(libQ)}」を追加</span></button>` : ''}</div></div>` : ''}
      <button class="btn wide ghost" id="discard" style="margin-top:16px">ワークアウトを破棄</button>
      <div class="rest-bar" id="restBar" hidden><span class="rest-t" id="restT">0:00</span><button class="btn small" id="restMinus">-15秒</button><button class="btn small" id="restPlus">+15秒</button><button class="btn small primary" id="restSkip">スキップ</button>${G.alarm.perm() === 'default' ? '<button class="btn small" id="restNotify">🔔 通知オン</button>' : ''}</div>`;
    bind(); startClock(); tickRest();
  }

  function bind() {
    const W = G.S.wip.workout;
    G.$('#woTitle').oninput = e => { W.title = e.target.value; G.save(); };
    G.view.querySelectorAll('.wo-ex').forEach(card => {
      const ei = Number(card.dataset.ei), e = W.exercises[ei];
      card.querySelector('.ex-note').oninput = ev => { e.note = ev.target.value; G.save(); };
      card.querySelector('.ex-del').onclick = () => { if (G.confirmBox(`${disp(e.ex)} を外しますか？`)) { W.exercises.splice(ei, 1); G.save(); render(); } };
      card.querySelector('.set-add').onclick = () => { const last = e.sets[e.sets.length - 1] || {}; e.sets.push({ weight: last.weight ?? '', reps: last.reps ?? '', rpe: null, done: false }); G.save(); render(); };
      card.querySelector('.set-del').onclick = () => { if (e.sets.length) { e.sets.pop(); G.save(); render(); } };
      card.querySelectorAll('tr[data-si]').forEach(tr => {
        const si = Number(tr.dataset.si), s = e.sets[si];
        tr.querySelector('.s-w').oninput = ev => { s.weight = ev.target.value; G.save(); };
        tr.querySelector('.s-r').oninput = ev => { s.reps = ev.target.value; G.save(); };
        tr.querySelector('.s-rpe').onchange = ev => { s.rpe = ev.target.value === '' ? null : Number(ev.target.value); G.save(); };
        tr.querySelector('.chk').onclick = () => {
          if (!s.done) {
            const wIn = tr.querySelector('.s-w'), rIn = tr.querySelector('.s-r');
            if (wIn.value === '' && wIn.placeholder) wIn.value = wIn.placeholder; if (rIn.value === '' && rIn.placeholder) rIn.value = rIn.placeholder;
            s.weight = wIn.value; s.reps = rIn.value;
            if (s.reps === '') { G.toast('回数を入れてください'); return; }
            s.done = true; G.alarm.prime();
            const isLast = ei === W.exercises.length - 1 && si === e.sets.length - 1;
            if (!isLast) W.rest = { end: Date.now() + e.rest * 1000, total: e.rest * 1000 };
          } else { s.done = false; }
          G.save(); render();
        };
      });
    });
    G.$('#addEx').onclick = () => { libOpen = !libOpen; render(); if (libOpen) { const q = G.$('#libQ'); q && q.focus(); } };
    const q = G.$('#libQ'); if (q) { q.oninput = ev => { libQ = ev.target.value.trim(); const list = G.view.querySelector('.lib-list'); if (list) { render(); const q2 = G.$('#libQ'); q2.focus(); q2.setSelectionRange(q2.value.length, q2.value.length); } }; }
    G.view.querySelectorAll('.lib-item').forEach(b => b.onclick = () => {
      const ex = b.dataset.ex, mode = /ジャンプ|ハイプル|クリーン|スロー/.test(ex) ? 'speed' : 'rpe';
      W.exercises.push({ ex, rest: 120, mode, note: '', sets: [{ weight: '', reps: '', rpe: null, done: false }, { weight: '', reps: '', rpe: null, done: false }, { weight: '', reps: '', rpe: null, done: false }] });
      libOpen = false; libQ = ''; G.save(); render();
    });
    G.$('#discard').onclick = () => { if (G.confirmBox('記録せずに破棄しますか？')) { G.S.wip.workout = null; G.save(); stopClocks(); G.route(); } };
    G.$('#finish').onclick = finish;
    const rearm = () => { if (W.rest.end - Date.now() > G.alarm.warnSec() * 1000) W.rest.warned = false; };
    G.$('#restMinus').onclick = () => { if (W.rest) { W.rest.end -= 15000; rearm(); G.save(); } };
    G.$('#restPlus').onclick = () => { if (W.rest) { W.rest.end += 15000; W.rest.total += 15000; rearm(); G.save(); } };
    G.$('#restSkip').onclick = () => { W.rest = null; G.save(); tickRest(); };
    const nb = G.$('#restNotify');
    if (nb) nb.onclick = async () => { const p = await G.alarm.ask(); nb.remove(); G.toast(p === 'granted' ? '休憩おわりを通知で知らせます' : '通知は許可されませんでした（設定から変えられます）'); };
  }
  // 次にやるセット（通知の文に使う）
  function nextSetText(W) {
    for (const e of W.exercises) {
      const si = e.sets.findIndex(s => !s.done);
      if (si >= 0) { const s = e.sets[si]; return `次：${disp(e.ex)} ${si + 1}セット目${s.weight !== '' ? ' ' + s.weight + 'kg' : ''}${s.reps !== '' ? '×' + s.reps + '回' : ''}`; }
    }
    return '次のセットへ';
  }

  function startClock() {
    clearInterval(tick);
    const W = G.S.wip.workout;
    const f = () => { const el = G.$('#elapsed'); if (!el || !G.S.wip.workout) { clearInterval(tick); return; } const s = Math.floor((Date.now() - W.startedAt) / 1000); el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    f(); tick = setInterval(f, 1000);
  }
  function tickRest() {
    clearInterval(restTick);
    const f = () => {
      const W = G.S.wip.workout, bar = G.$('#restBar'); if (!bar) { clearInterval(restTick); return; }
      if (!W || !W.rest) { bar.hidden = true; clearInterval(restTick); return; }
      const left = W.rest.end - Date.now();
      bar.hidden = false; G.$('#restT').textContent = '休憩 ' + G.fmtTime(left);
      const wMs = G.alarm.warnSec() * 1000;
      if (wMs && !W.rest.warned && left > 0 && left <= wMs && W.rest.total > wMs + 5000) { W.rest.warned = true; G.save(); G.alarm.warn(nextSetText(W)); }
      if (left <= 0) { W.rest = null; G.save(); bar.hidden = true; clearInterval(restTick); if (left > -60000) G.alarm.ring('休憩おわり', nextSetText(W)); }
    };
    f(); restTick = setInterval(f, 250);
  }
  function stopClocks() { clearInterval(tick); clearInterval(restTick); }

  async function finish() {
    const W = G.S.wip.workout;
    const sets = [];
    W.exercises.forEach(e => e.sets.filter(s => s.done).forEach(s => { const o = { ex: e.ex, reps: Number(s.reps) || 0, weight: s.weight === '' ? null : Number(s.weight) }; if (s.rpe != null) { if (e.mode === 'speed') o.speed = s.rpe; else o.rpe = s.rpe; } sets.push(o); }));
    if (!sets.length) { G.toast('完了（✓）したセットがありません'); return; }
    const notes = W.exercises.filter(e => e.note).map(e => `${disp(e.ex)}：${e.note}`).join(' ／ ');
    G.$('#finish').disabled = true;
    try {
      await G.write('gq_add_workout', { p: { kind: W.kind, course: W.course, sets, note: notes, program_id: W.program_id, day_key: W.day_key, duration_sec: Math.round((Date.now() - W.startedAt) / 1000), title: W.title } });
      if (W.kind === 'big3') { const lifts = Object.assign({}, G.member().lifts || {}); sets.forEach(s => { if (s.weight != null && YNAME[s.ex]) lifts[s.ex] = s.weight; }); try { await G.updateMember({ lifts }); } catch (e) { } }
      G.S.wip.workout = null; G.save(); stopClocks(); G.toast('記録しました');
      const d = G.data();
      if (W.kind === 'custom' && W.program_id) {
        const prog = G.program.active(d); const items = prog ? G.program.progression(d, prog, W.day_key) : [];
        if (items.length && G.confirmBox(items.map(p => p.msg).join('\n') + '\n\nメニューの重量を書き換えますか？')) { try { await G.program.applyProgression(d, prog, items); G.toast('重量を更新しました'); } catch (e) { G.toast(e.message); } }
      } else if (G.train && (W.kind === 'explosive' || W.kind === 'big3')) {
        const p = G.train.progression(d, W.kind, W.course); if (p.length) alert(p.map(x => x.msg).join('\n'));
      }
      location.hash = '#train'; G.route();
    } catch (e) { G.toast(e.message); G.$('#finish').disabled = false; }
  }

  G.workout = { start, resume, disp, LIB };
})();
