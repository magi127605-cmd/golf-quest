/* 段位＝クエストの進捗度（仕様 3章）。飛距離は昇格条件にしない */
(function () {
  'use strict';
  const G = window.GQ;
  const RANKS = ['入門', '習慣', '定着', 'マン振り', '筋力解禁', '両立', 'yamada級'];
  const EXPLOSIVE_EX = { home: ['jump_squat'], gym: ['high_pull', 'box_jump'] };
  const EXNAME = { jump_squat: 'ジャンプスクワット', high_pull: 'ハイプル', box_jump: 'ボックスジャンプ', squat: 'スクワット', dead: 'デッドリフト', bench: 'ベンチプレス' };

  function weeksSince(dateStr) { if (!dateStr) return 0; return Math.floor((Date.now() - new Date(dateStr + 'T00:00:00+09:00').getTime()) / (7 * G.DAY)); }

  // 48時間違反の数（爆発トレ同士の間隔が48時間未満）
  function restViolations(ws) {
    const ex = ws.filter(w => w.kind === 'explosive').map(w => new Date(w.done_at).getTime()).sort((a, b) => a - b);
    let v = 0; for (let i = 1; i < ex.length; i++) if (ex[i] - ex[i - 1] < 48 * G.HOUR) v++;
    return v;
  }
  function byWeek(items, key) { const m = {}; items.forEach(x => { const k = G.weekKey(x[key]); m[k] = (m[k] || 0) + 1; }); return m; }
  function impactTotal(r) { return Object.values(r.impact || {}).reduce((a, b) => a + (Number(b) || 0), 0); }

  // BIG3で「重量が上がった回数」（前回より重い重量で同じ種目をやった回数）
  function big3Progressions(ws) {
    const last = {}; let n = 0;
    ws.filter(w => w.kind === 'big3').sort((a, b) => new Date(a.done_at) - new Date(b.done_at)).forEach(w => {
      const per = {};
      (w.sets || []).forEach(s => { if (s.weight != null) per[s.ex] = Math.max(per[s.ex] || 0, Number(s.weight)); });
      Object.entries(per).forEach(([ex, wt]) => { if (last[ex] != null && wt > last[ex]) n++; last[ex] = wt; });
    });
    return n;
  }
  function swingOK(swings, rank) { return swings.some(s => s.status === 'judged' && s.verdict === 'ok' && s.rank_target >= rank); }

  // 週の遵守率（予定に対してやれた割合。休みを守ることも含む）
  function adherence(data, wk) {
    const m = data.member || {}, plan = Object.assign({ explosive: 2, range: 1, big3: 0 }, m.plan || {});
    const ws = data.workouts.filter(w => G.weekKey(w.done_at) === wk), rs = data.ranges.filter(r => G.weekKey(r.done_at) === wk);
    const done = { explosive: ws.filter(w => w.kind === 'explosive').length, range: rs.filter(r => r.completed).length, big3: ws.filter(w => w.kind === 'big3').length };
    const parts = [];
    ['explosive', 'range', 'big3'].forEach(k => { if (plan[k] > 0) parts.push(Math.min(1, done[k] / plan[k])); });
    parts.push(restViolations(ws) === 0 && done.explosive <= 3 ? 1 : 0);
    return { rate: parts.reduce((a, b) => a + b, 0) / parts.length, done, plan };
  }
  function recentAdherence(data, weeks) {
    const out = []; const d = G.jst();
    for (let i = 0; i < weeks; i++) { const t = new Date(d.getTime() - i * 7 * G.DAY - 9 * G.HOUR); out.push(adherence(data, G.weekKey(t)).rate); }
    return out;
  }

  function compute(data) {
    if (!data) return null;
    const m = data.member || {}, ws = data.workouts || [], rs = data.ranges || [], ms = data.measurements || [], sw = (data.swings || []).filter(s => !s.deleted);
    const ex = ws.filter(w => w.kind === 'explosive'), b3 = ws.filter(w => w.kind === 'big3');
    const rDone = rs.filter(r => r.completed);
    const exWeeks = byWeek(ex, 'done_at'); const weeks2 = Object.values(exWeeks).filter(n => n >= 2).length;
    const weeksSinceStart = weeksSince(m.started_at);
    const now = Date.now();
    const exLast14 = ex.filter(w => now - new Date(w.done_at).getTime() < 14 * G.DAY).length;
    const item = (label, cur, need, extra) => Object.assign({ label, cur, need, done: cur >= need }, extra || {});
    const flag = (label, ok) => ({ label, cur: ok ? 1 : 0, need: 1, done: !!ok, flag: true });

    const quests = [
      { rank: 0, name: RANKS[0], src: 'note② 2-4', items: [
        flag('自重コース／ジムコースを選ぶ', !!m.course),
        flag('自分のテンポ（BPM）を決めて保存', !!m.bpm),
        item('計測を1回記録（基準値）', ms.length, 1),
      ] },
      { rank: 1, name: RANKS[1], src: 'note①第3・4章、note②Part1', items: [
        item('爆発トレ 4回', ex.length, 4),
        item('爆発トレ 週2回の週 ×2週', weeks2, 2),
        item('100球メニュー完走 2回', rDone.length, 2),
      ] },
      { rank: 2, name: RANKS[2], src: 'note①鉄則⑧、note②5-2', items: [
        item('爆発トレ 累計12回', ex.length, 12),
        flag('48時間ルール違反ゼロ', restViolations(ws) === 0 && ex.length > 0),
        item('100球メニュー完走 累計6回', rDone.length, 6),
        flag('マン振り15球厳守（全回）', rDone.length > 0 && rDone.every(r => r.manburi_balls <= 15)),
        flag('メトロノーム使用率100%', rDone.length > 0 && rDone.every(r => r.metronome_on)),
      ] },
      { rank: 3, name: RANKS[3], src: 'note② Part3', items: [
        item('素振り3回つきマン振り 累計15セット', rs.reduce((a, r) => a + (r.manburi_sets || 0), 0), 15),
        item('打点記録 累計300球', rs.reduce((a, r) => a + impactTotal(r), 0), 300),
        flag('スイング判定 OK（段位3）', swingOK(sw, 3)),
      ] },
      { rank: 4, name: RANKS[4], src: 'note①第5章', items: [
        item('開始から12週経過', Math.min(weeksSinceStart, 12), 12, { unit: '週' }),
        item('BIG3（3〜5回×3セット・別日）累計8回', b3.length, 8),
        item('爆発トレ継続（直近2週で3回以上）', Math.min(exLast14, 3), 3),
        flag('スイング判定 OK（段位4）', swingOK(sw, 4)),
      ] },
      { rank: 5, name: RANKS[5], src: 'note①第5章', items: [
        item('BIG3「2回連続達成→重量アップ」3回以上', big3Progressions(ws), 3),
        item('爆発トレ 累計40回', ex.length, 40),
        item('100球メニュー 累計20回', rDone.length, 20),
        flag('スイング判定 OK（段位5）', swingOK(sw, 5)),
      ] },
      { rank: 6, name: RANKS[6], src: '—', items: [
        item('段位5の内容を12週継続（遵守率80%以上の週）', recentAdherence(data, 12).filter(x => x >= 0.8).length, 12, { unit: '週' }),
        flag('スイング判定 OK（段位6）', swingOK(sw, 6)),
      ] },
    ];
    let rank = -1;
    for (const q of quests) { q.done = q.items.every(i => i.done); if (q.done && q.rank === rank + 1) rank = q.rank; }
    // 段位 = 達成済みの最上位（0の内容ができていなければ「入門前」= 0 表示）
    const current = Math.max(0, rank + 1 > 6 ? 6 : rank);
    const next = quests.find(q => q.rank === rank + 1) || null;
    const thisWeek = adherence(data, G.weekKey());
    return {
      rank: current, rankName: rank < 0 ? '入門（クエスト未達）' : RANKS[current], next, quests, thisWeek,
      adherence4: recentAdherence(data, 4), big3Unlocked: weeksSinceStart >= 12, weeksSinceStart,
      restViolations: restViolations(ws),
    };
  }

  G.rank = { compute, RANKS, EXNAME, EXPLOSIVE_EX, weeksSince, adherence, impactTotal, big3Progressions };
})();
