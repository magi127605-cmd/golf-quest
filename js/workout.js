/* ワークアウト記録画面（Hevy型：1ページに全種目・セット表・✓で完了→休憩タイマー） */
(function () {
  'use strict';
  const G = window.GQ;
  const LIB = [
    ['ベンチプレス', '胸'], ['インクラインベンチプレス', '胸'], ['ダンベルベンチプレス', '胸'], ['インクラインダンベルプレス', '胸'], ['ダンベルフライ', '胸'], ['ディップス', '胸'], ['腕立て伏せ', '胸'],
    ['スクワット', '脚'], ['フロントスクワット', '脚'], ['レッグプレス', '脚'], ['ブルガリアンスクワット', '脚'], ['ランジ', '脚'], ['レッグカール', '脚'], ['レッグエクステンション', '脚'], ['カーフレイズ', '脚'],
    ['デッドリフト', '背中'], ['ルーマニアンデッドリフト', '背中'], ['懸垂', '背中'], ['ラットプルダウン', '背中'], ['ベントオーバーロウ', '背中'], ['ダンベルロウ', '背中'], ['シーテッドロウ', '背中'],
    ['オーバーヘッドプレス', '肩'], ['ダンベルショルダープレス', '肩'], ['サイドレイズ', '肩'], ['フェイスプル', '肩'],
    ['ノルウェー式4×4（自転車）', '心肺'], ['ハイプル', '爆発'], ['ボックスジャンプ', '爆発'], ['ジャンプスクワット', '爆発'], ['パワークリーン', '爆発'], ['メディシンボールスロー', '爆発'],
    ['プランク', '体幹'], ['ハンギングレッグレイズ', '体幹'], ['キャプテンズチェア', '体幹'], ['パロフプレス', '体幹'], ['ケーブルウッドチョップ', '体幹'],
    ['アームカール', '腕'], ['トライセプスプッシュダウン', '腕'],
  ];
  const YNAME = { jump_squat: 'ジャンプスクワット', high_pull: 'ハイプル', box_jump: 'ボックスジャンプ', squat: 'スクワット', dead: 'デッドリフト', bench: 'ベンチプレス' };
  const disp = ex => YNAME[ex] || ex;
  // 台が埋まっていた時の代わり（同じ動きのダンベル版）。重さは片手＝バーベルの約4割、2kg刻み
  const SUB = { 'ベンチプレス': 'ダンベルベンチプレス', 'インクラインベンチプレス': 'インクラインダンベルプレス', 'オーバーヘッドプレス': 'ダンベルショルダープレス' };
  const dbW = w => w === '' || w == null ? '' : Math.max(2, Math.round(Number(w) * 0.4 / 2) * 2);
  let tick = null, restTick = null, workTick = null, libOpen = false, libQ = '';

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
        ex: e.ex, rest: e.rest || 120, mode: e.mode || 'rpe', note: e.note || '', nara: !!e.nara, cap: e.cap || null,
        sets: (e.sets && e.sets.length ? e.sets : [{}, {}, {}]).map(s => ({ weight: s.weight ?? '', reps: s.reps ?? '', hr: '', rpe: null, done: false })),
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
          <div class="row between"><div class="ttl" style="font-weight:700;font-size:17px">${G.esc(disp(e.ex))}${e.nara ? ' <span class="tag">慣らし</span>' : ''}</div><button class="btn small ghost ex-del">削除</button></div>
          ${e.nara ? `<div class="note">慣らし：重さを伸ばす日じゃない。<b>あと5回できる所で止める</b>（RPEは5＝余裕）。${e.cap ? `上限${e.cap}kg。` : ''}RPEを入れないと次の重さが決まらない。</div>` : ''}
          ${SUB[disp(e.ex)] && e.sets.some(s => !s.done) ? '<button class="btn small wide ex-sub">台が埋まってる → ダンベルに切り替え</button>' : ''}
          ${e.from && !e.sets.some(s => s.done) ? `<button class="btn small wide ex-back">台が空いた → ${G.esc(e.from.ex)}に戻す</button>` : ''}
          <input class="ex-note" placeholder="メモ（例：胸で1秒止める）" value="${G.esc(e.note)}">
          ${e.mode === 'interval' ? intervalHtml(e, prev) : `<table class="settbl"><tr><th>セット</th><th>前回</th><th>kg</th><th>回</th><th>${e.mode === 'speed' ? '速さ' : 'RPE'}</th><th></th></tr>
            ${e.sets.map((s, si) => `<tr class="${s.done ? 'done' : ''}" data-si="${si}">
              <td class="n">${si + 1}</td>
              <td class="prev">${prev[si] ? `${prev[si].weight != null ? prev[si].weight + 'kg' : '—'}×${prev[si].reps}` : '—'}</td>
              <td><input class="s-w" type="number" inputmode="decimal" step="2.5" value="${s.weight}" placeholder="${prev[si] && prev[si].weight != null ? prev[si].weight : ''}"></td>
              <td><input class="s-r" type="number" inputmode="numeric" value="${s.reps}" placeholder="${prev[si] ? prev[si].reps : ''}"></td>
              <td><select class="s-rpe"><option value="">-</option>${(e.mode === 'speed' ? [1, 2, 3, 4, 5] : e.nara ? [5, 6, 7, 8, 9, 10] : [6, 7, 8, 9, 10]).map(v => `<option ${s.rpe === v ? 'selected' : ''} value="${v}">${v}${e.nara && v === 5 ? ' 余裕' : ''}</option>`).join('')}</select></td>
              <td><button class="chk ${s.done ? 'on' : ''}">✓</button></td>
            </tr>`).join('')}
          </table>`}
          <div class="row"><button class="btn small set-add">＋ セットを追加</button><span class="muted grow">${e.mode === 'interval' ? '1本' : ''}休憩 ${Math.round(e.rest / 60 * 10) / 10}分</span><button class="btn small ghost set-del">最後のセットを削除</button></div>
        </div>`;
      }).join('')}
      <button class="btn wide" id="addEx">＋ 種目を追加</button>
      ${libOpen ? `<div class="card lib"><input id="libQ" placeholder="種目を検索（自由な名前でもOK）" value="${G.esc(libQ)}">
        <div class="lib-list">${LIB.filter(([n, g]) => !libQ || n.includes(libQ) || g.includes(libQ)).map(([n, g]) => `<button class="lib-item" data-ex="${G.esc(n)}"><span>${G.esc(n)}</span><span class="tag">${g}</span></button>`).join('')}
        ${libQ && !LIB.some(([n]) => n === libQ) ? `<button class="lib-item" data-ex="${G.esc(libQ)}"><span>「${G.esc(libQ)}」を追加</span></button>` : ''}</div></div>` : ''}
      <button class="btn wide ghost" id="discard" style="margin-top:16px">ワークアウトを破棄</button>
      <div class="rest-bar work" id="workBar" hidden><span class="rest-t" id="workT">0:00</span><button class="btn small" id="workStop">中止</button></div>
      <div class="rest-bar" id="restBar" hidden><span class="rest-t" id="restT">0:00</span><button class="btn small" id="restMinus">-15秒</button><button class="btn small" id="restPlus">+15秒</button><button class="btn small primary" id="restSkip">スキップ</button>${G.alarm.perm() === 'default' ? '<button class="btn small" id="restNotify">🔔 通知オン</button>' : ''}</div>`;
    bind(); startClock(); tickRest(); tickWork();
  }
  // 心肺（ノルウェー式）の表：本目／前回／分／心拍（任意）／きつさ。開始ボタンで「きつい区間」の合図タイマー
  function intervalHtml(e, prev) {
    const W = G.S.wip.workout, si = e.sets.findIndex(s => !s.done), running = W.work && W.work.ex === e.ex;
    return `<table class="settbl"><tr><th>本</th><th>前回</th><th>分</th><th>心拍</th><th>きつさ</th><th></th></tr>
      ${e.sets.map((s, i) => `<tr class="${s.done ? 'done' : ''}" data-si="${i}">
        <td class="n">${i + 1}</td>
        <td class="prev">${prev[i] ? `${prev[i].reps}分${prev[i].hr ? ' ' + prev[i].hr : ''}` : '—'}</td>
        <td><input class="s-r" type="number" inputmode="numeric" value="${s.reps}" placeholder="4"></td>
        <td><input class="s-hr" type="number" inputmode="numeric" value="${s.hr || ''}" placeholder="任意"></td>
        <td><select class="s-rpe"><option value="">-</option>${[6, 7, 8, 9, 10].map(v => `<option ${s.rpe === v ? 'selected' : ''} value="${v}">${v}${v === 9 ? ' 狙い' : ''}</option>`).join('')}</select></td>
        <td><button class="chk ${s.done ? 'on' : ''}">✓</button></td>
      </tr>`).join('')}
    </table>
    <div class="muted" style="font-size:12px">きつさ9＝しゃべれない・4分がぎりぎり（最大心拍の約9割。30歳の目安は165〜180拍）。準備はゆっくり5分。</div>
    ${si >= 0 && !running ? `<button class="btn primary wide work-go">▶ ${si + 1}本目 ${Number(e.sets[si].reps) || 4}分スタート</button>` : ''}`;
  }

  function bind() {
    const W = G.S.wip.workout;
    G.$('#woTitle').oninput = e => { W.title = e.target.value; G.save(); };
    G.view.querySelectorAll('.wo-ex').forEach(card => {
      const ei = Number(card.dataset.ei), e = W.exercises[ei];
      card.querySelector('.ex-note').oninput = ev => { e.note = ev.target.value; G.save(); };
      const go = card.querySelector('.work-go'); if (go) go.onclick = () => {
        const si = e.sets.findIndex(s => !s.done); if (si < 0) return;
        const ms = (Number(e.sets[si].reps) || 4) * 60000;
        G.alarm.prime(); W.rest = null; W.work = { ex: e.ex, ei, si, end: Date.now() + ms, total: ms }; G.save(); render();
      };
      const sb = card.querySelector('.ex-sub'); if (sb) sb.onclick = () => swap(ei);
      const bk = card.querySelector('.ex-back'); if (bk) bk.onclick = () => { const f = e.from; W.exercises[ei] = { ex: f.ex, rest: e.rest, mode: e.mode, note: f.note, sets: f.sets }; G.save(); render(); };
      card.querySelector('.ex-del').onclick = () => { if (G.confirmBox(`${disp(e.ex)} を外しますか？`)) { W.exercises.splice(ei, 1); G.save(); render(); } };
      card.querySelector('.set-add').onclick = () => { const last = e.sets[e.sets.length - 1] || {}; e.sets.push({ weight: last.weight ?? '', reps: last.reps ?? '', rpe: null, done: false }); G.save(); render(); };
      card.querySelector('.set-del').onclick = () => { if (e.sets.length) { e.sets.pop(); G.save(); render(); } };
      card.querySelectorAll('tr[data-si]').forEach(tr => {
        const si = Number(tr.dataset.si), s = e.sets[si];
        const sw = tr.querySelector('.s-w'); if (sw) sw.oninput = ev => { s.weight = ev.target.value; G.save(); };
        const sh = tr.querySelector('.s-hr'); if (sh) sh.oninput = ev => { s.hr = ev.target.value; G.save(); };
        tr.querySelector('.s-r').oninput = ev => { s.reps = ev.target.value; G.save(); };
        tr.querySelector('.s-rpe').onchange = ev => { s.rpe = ev.target.value === '' ? null : Number(ev.target.value); G.save(); };
        tr.querySelector('.chk').onclick = () => {
          if (!s.done) {
            const wIn = tr.querySelector('.s-w'), rIn = tr.querySelector('.s-r');
            if (wIn && wIn.value === '' && wIn.placeholder) wIn.value = wIn.placeholder; if (rIn.value === '' && rIn.placeholder) rIn.value = rIn.placeholder;
            s.weight = wIn ? wIn.value : ''; s.reps = rIn.value;
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
      const ex = b.dataset.ex, mode = /ジャンプ|ハイプル|クリーン|スロー/.test(ex) ? 'speed' : /ノルウェー|4×4|インターバル|HIIT/i.test(ex) ? 'interval' : 'rpe';
      W.exercises.push({ ex, rest: 120, mode, note: '', sets: [{ weight: '', reps: '', rpe: null, done: false }, { weight: '', reps: '', rpe: null, done: false }, { weight: '', reps: '', rpe: null, done: false }] });
      libOpen = false; libQ = ''; G.save(); render();
    });
    G.$('#discard').onclick = () => { if (G.confirmBox('記録せずに破棄しますか？')) { G.S.wip.workout = null; G.save(); stopClocks(); G.route(); } };
    G.$('#finish').onclick = finish;
    const rearm = () => { if (W.rest.end - Date.now() > G.alarm.warnSec() * 1000) W.rest.warned = false; };
    G.$('#restMinus').onclick = () => { if (W.rest) { W.rest.end -= 15000; rearm(); G.save(); } };
    G.$('#restPlus').onclick = () => { if (W.rest) { W.rest.end += 15000; W.rest.total += 15000; rearm(); G.save(); } };
    G.$('#workStop').onclick = () => { if (G.confirmBox('この本を中止しますか？（記録はされません）')) { W.work = null; G.save(); render(); } };
    G.$('#restSkip').onclick = () => { W.rest = null; G.save(); tickRest(); };
    const nb = G.$('#restNotify');
    if (nb) nb.onclick = async () => { const p = await G.alarm.ask(); nb.remove(); G.toast(p === 'granted' ? '休憩おわりを通知で知らせます' : '通知は許可されませんでした（設定から変えられます）'); };
  }
  // 台が埋まっていたらダンベル版へ。済んだセットは元の種目に残し、残りのセットだけ切り替える（回数・休憩はそのまま）
  function swap(ei) {
    const W = G.S.wip.workout, e = W.exercises[ei], name = disp(e.ex);
    const done = e.sets.filter(s => s.done), left = e.sets.filter(s => !s.done);
    const bw = (left.find(s => s.weight !== '') || {}).weight;
    const d = { ex: SUB[name], rest: e.rest, mode: e.mode, from: { ex: name, note: e.note, sets: left.map(s => Object.assign({}, s)) },
      note: `片手の重さ。${bw ? `バーベル${bw}kgの約4割` : '目安はバーベルの約4割'}。台が埋まってたので代わり`,
      sets: left.map(s => ({ weight: dbW(s.weight), reps: s.reps, rpe: null, done: false })) };
    if (done.length) { e.sets = done; W.exercises.splice(ei + 1, 0, d); } else W.exercises[ei] = d;
    G.save(); render(); G.toast(`${SUB[name]}に切り替えました（重さは片手）`);
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
  // 心肺のきつい区間の合図。終わったらその本を✓にして、休憩（ゆっくり漕ぐ）を始める
  function tickWork() {
    clearInterval(workTick);
    const f = () => {
      const W = G.S.wip.workout, bar = G.$('#workBar'); if (!bar) { clearInterval(workTick); return; }
      if (!W || !W.work) { bar.hidden = true; clearInterval(workTick); return; }
      const left = W.work.end - Date.now();
      bar.hidden = false; G.$('#workT').textContent = `${W.work.si + 1}本目 きつく ` + G.fmtTime(left);
      if (left <= 0) {
        const e = W.exercises.find(x => x.ex === W.work.ex), s = e && e.sets[W.work.si];
        if (s) { s.done = true; if (s.reps === '') s.reps = String(Math.round(W.work.total / 60000)); }
        const more = e && e.sets.some(x => !x.done);
        W.work = null; if (more) W.rest = { end: Date.now() + e.rest * 1000, total: e.rest * 1000 };
        G.save(); clearInterval(workTick);
        if (left > -60000) G.alarm.ring(more ? 'きつい区間おわり' : '最後の1本おわり', more ? `${Math.round(e.rest / 60)}分ゆっくり漕ぐ。きつさを入れておく` : 'ゆっくり3分漕いで整理運動。きつさを入れて終了');
        render();
      }
    };
    f(); workTick = setInterval(f, 250);
  }
  function stopClocks() { clearInterval(tick); clearInterval(restTick); clearInterval(workTick); }

  async function finish() {
    const W = G.S.wip.workout;
    const sets = [];
    W.exercises.forEach(e => e.sets.filter(s => s.done).forEach(s => { const o = { ex: e.ex, reps: Number(s.reps) || 0, weight: s.weight === '' ? null : Number(s.weight) }; if (e.nara) o.nara = true; if (e.mode === 'interval') { o.cardio = true; if (Number(s.hr)) o.hr = Number(s.hr); } if (s.rpe != null) { if (e.mode === 'speed') o.speed = s.rpe; else o.rpe = s.rpe; } sets.push(o); }));
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
        if (items.length && G.confirmBox(items.filter(p => p.msg).map(p => p.msg).join('\n') + '\n\nメニューの重量を書き換えますか？')) { try { await G.program.applyProgression(d, prog, items); G.toast('重量を更新しました'); } catch (e) { G.toast(e.message); } }
      } else if (G.train && (W.kind === 'explosive' || W.kind === 'big3')) {
        const p = G.train.progression(d, W.kind, W.course); if (p.length) alert(p.map(x => x.msg).join('\n'));
      }
      location.hash = '#train'; G.route();
    } catch (e) { G.toast(e.message); G.$('#finish').disabled = false; }
  }

  G.workout = { start, resume, disp, LIB };
})();
