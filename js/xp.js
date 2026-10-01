/* 経験値（順番を守った球だけで貯まる）と推定スコア（ラウンド実績から）
   教材の「量より順番」と矛盾させない：崩して打った球はゼロ。段位とは別の、小さな手応え */
(function () {
  'use strict';
  const G = window.GQ;
  const BONUS = 20; // 完走（メトロノームON）
  // 1回の練習場セッションで得た経験値。正しい球＝サーキット完走周×4＋素振り付きマン振り（15球上限）
  function session(r) {
    const circuit = (Number(r.circuits_done) || 0) * 4;
    const man = Math.min(15, Number(r.manburi_balls) || 0);
    const bonus = r.completed && r.metronome_on ? BONUS : 0;
    return { correct: circuit + man, bonus, xp: circuit + man + bonus };
  }
  const need = L => 100 * L * (L + 1) / 2; // Lv.L に到達する累計（Lv1=100, Lv2=300, Lv3=600…）
  function compute(d) {
    const rs = d.ranges || [];
    let xp = 0, correct = 0, sets100 = 0;
    rs.forEach(r => { const s = session(r); xp += s.xp; correct += s.correct; if (r.completed && Number(r.balls_plan) >= 100) sets100++; });
    let L = 0; while (need(L + 1) <= xp) L++;
    const cur = xp - need(L), span = need(L + 1) - need(L);
    const last = rs.length ? session(rs[rs.length - 1]) : null;
    return { xp, level: L, cur, span, toNext: span - cur, correct, sets100, sessions: rs.length, last };
  }
  // 推定スコア：直近5ラウンドの平均。傾向＝その前の5ラウンド（3つ以上あれば）との差
  function score(d) {
    const rs = (d.rounds || []).filter(r => r.score != null);
    if (!rs.length) return null;
    const a = rs.slice(-5), b = rs.slice(-10, -5);
    const mean = x => x.reduce((s, r) => s + Number(r.score), 0) / x.length;
    const est = mean(a), trend = b.length >= 3 ? Math.round((est - mean(b)) * 10) / 10 : null;
    const best = Math.min(...a.map(r => Number(r.score))), under100 = a.filter(r => Number(r.score) < 100).length;
    return { est: Math.round(est * 10) / 10, n: a.length, trend, best, under100 };
  }
  function card(d) {
    const x = compute(d);
    return `<div class="card">
      <div class="row between"><div class="ttl" style="font-weight:700">経験値 <span class="tag k">Lv.${x.level}</span></div><span class="muted">次のLvまで ${x.toNext}</span></div>
      ${G.meter(x.cur, x.span, false)}
      <div class="muted" style="font-size:12px">順番を守った球だけで貯まる：サーキット完走周×4球・素振り付きマン振り（15球まで）・完走＋メトロノームONで+${BONUS}。崩して打った球はゼロ。<br>累計 正しい球 ${x.correct}球 ／ 正しい100球セット ${x.sets100}回 ／ 練習場 ${x.sessions}回</div>
    </div>`;
  }
  G.xp = { session, compute, score, card, need };
})();
