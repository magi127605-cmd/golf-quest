/* 飛距離診断：推定飛距離・目標に必要なHS・「筋力／速さ／当たり」のどこが足りないか
   数式と閾値の出典は knowledge/golf/distance/300y-diagnosis-model.md（TrackMan最適化表・Johansen&Aagaard・Ehlert 2021 等）。すべて目安 */
(function () {
  'use strict';
  const G = window.GQ;
  const r1 = x => Math.round(x * 10) / 10;
  // TrackMan CARRY/TOTAL Optimizer（入射角0°・最適打ち出し）の直線近似
  const optCarry = hs => 7.06 * hs - 82.6;
  const optTotal = hs => 7.09 * hs - 40;
  const hsForTotal = y => (y + 40) / 7.09;
  // 必要な垂直跳び（CMJ）: Johansen&Aagaard 遅い群(49.6m/s→32.1cm)〜速い群(55.1m/s→41cm) を直線補間
  const cmjNeeded = hs => Math.min(45, Math.max(25, 32.1 + (hs - 49.6) * 1.6));
  const TH = { smashOk: 1.45, smashNg: 1.40, effOk: 0.92, effNg: 0.85, lowerOk: 1.3, lowerNg: 1.1, upperOk: 1.0, upperNg: 0.8, cmjRatioNg: 0.9 };
  const RSI = v => v == null ? null : v < 1.0 ? '低い' : v < 1.5 ? 'ふつう' : v < 2.0 ? '良い' : '優秀';

  function latest(ms, k, n) { return ms.filter(x => x[k] != null).slice(-(n || 3)).map(x => Number(x[k])); }
  const med = a => a.length ? G.median(a) : null;

  function compute(d) {
    const ms = d.measurements || [], m = d.member || {};
    const target = Number(m.target_y) || 300;
    const hs = med(latest(ms, 'hs')), bs = med(latest(ms, 'ball_speed')), carry = med(latest(ms, 'carry')), total = med(latest(ms, 'total'));
    const cmjArr = latest(ms, 'jump_cm'), cmj = cmjArr.length ? Math.max(...cmjArr) : null, rsi = med(latest(ms, 'rsi'));
    const needHs = hsForTotal(target);
    const smash = hs && bs ? r1(bs / hs * 100) / 100 : null;
    const eff = hs && carry ? Math.round(carry / optCarry(hs) * 100) / 100 : null;
    const bw = G.maxes.bodyweight(d), mx = {}; G.maxes.all(d).forEach(x => mx[x.L.key] = x.cur);
    const lowerKg = mx.squat != null ? mx.squat : (mx.dead != null ? mx.dead / 1.2 : null);
    const lower = bw && lowerKg != null ? Math.round(lowerKg / bw * 100) / 100 : null;
    const upper = bw && mx.bench != null ? Math.round(mx.bench / bw * 100) / 100 : null;
    const needCmj = r1(cmjNeeded(needHs));
    // 3本柱の判定：ok / ng / mid / null(データ無し)
    const grade = (v, ok, ng) => v == null ? null : v >= ok ? 'ok' : v < ng ? 'ng' : 'mid';
    const legs = {
      hit: { nm: '当たり', smash, eff, st: (() => { const a = grade(smash, TH.smashOk, TH.smashNg), b = grade(eff, TH.effOk, TH.effNg); if (a == null && b == null) return null; if (a === 'ng' || b === 'ng') return 'ng'; if (a === 'ok' || b === 'ok') return (a === 'mid' || b === 'mid') ? 'mid' : 'ok'; return 'mid'; })() },
      speed: { nm: '速さ（SSC）', cmj, needCmj, rsi, st: cmj == null ? null : cmj >= needCmj ? 'ok' : cmj < needCmj * TH.cmjRatioNg ? 'ng' : 'mid' },
      power: { nm: '筋力', lower, upper, lowerKg, st: (() => { const a = grade(lower, TH.lowerOk, TH.lowerNg), b = grade(upper, TH.upperOk, TH.upperNg); if (a == null && b == null) return null; if (a === 'ng') return 'ng'; if (a === 'ok' && (b == null || b !== 'ng')) return b === 'mid' ? 'mid' : 'ok'; return 'mid'; })() },
    };
    return { target, hs, bs, carry, total, cmj, rsi, smash, eff, bw, needHs: r1(needHs), needBs: r1(needHs * 1.48), gapHs: hs ? r1(needHs - hs) : null,
      lowerKg, estCarry: hs ? Math.round(optCarry(hs)) : null, estTotal: hs ? Math.round(optTotal(hs)) : null, needCmj, lower, upper, legs, missing: { hs: !hs, bs: !bs, carry: !carry, cmj: cmj == null, bw: !bw, lifts: lowerKg == null && mx.bench == null } };
  }

  // 診断文（yamada教材の順番：当たり → 速さ → 筋力 → 技術）
  function verdict(c) {
    const L = c.legs, out = [];
    if (c.hs && c.gapHs <= 0) out.push({ k: 'ok', t: `今のHS ${G.n1(c.hs)}m/s は目標${c.target}yに届く速さ。あとは当たりと打ち出し（ミート率・打ち出し角・スピン）を揃えるだけ。` });
    if (L.hit.st === 'ng') out.push({ k: 'warn', t: `まず「当たり」。${c.smash != null && c.smash < TH.smashNg ? `ミート率${c.smash}（目安1.45以上）` : ''}${c.eff != null && c.eff < TH.effNg ? `${c.smash != null && c.smash < TH.smashNg ? '・' : ''}打ち出し効率${Math.round(c.eff * 100)}%（目安92%以上）` : ''}。速さを上げる前に、練習場のサーキット（メトロノーム固定テンポ）で芯に当てる。ここが一番安く飛距離が伸びる。` });
    if (L.speed.st === 'ng' && L.power.st === 'ok') out.push({ k: 'warn', t: `筋力は足りている（下半身 体重の${c.lower}倍）が、速さ（SSC）が足りない：垂直跳び${G.n1(c.cmj)}cm、目標HSの目安は約${c.needCmj}cm。筋肉を「速く使う」回路が未完成。爆発トレ（ジャンプスクワット／ハイプル／ボックスジャンプ）を週2〜3回、重さより速さ。` });
    else if (L.speed.st === 'ng' && L.power.st === 'ng') out.push({ k: 'warn', t: `速さも筋力も不足：垂直跳び${G.n1(c.cmj)}cm（目安約${c.needCmj}cm）、下半身 体重の${c.lower}倍（目安1.3倍）。順番は教材どおり爆発トレが先、BIG3は解禁後に別日で。両方を同じ日にやるなら「重い→休む→速い」。` });
    else if (L.speed.st === 'ng') out.push({ k: 'warn', t: `速さ（SSC）が足りない：垂直跳び${G.n1(c.cmj)}cm、目標HSの目安は約${c.needCmj}cm。爆発トレを続ける。${L.power.st == null ? '筋力側は体重とBIG3の記録があれば判定できる。' : ''}` });
    else if (L.power.st === 'ng') out.push({ k: 'warn', t: `速さはある（垂直跳び${G.n1(c.cmj)}cm）が、土台の筋力が足りない：下半身 体重の${c.lower}倍（目安1.3倍）${c.upper != null && c.upper < TH.upperNg ? `・上半身 体重の${c.upper}倍（目安1.0倍）` : ''}。出せる力の上限が低い。BIG3で土台を上げると爆発トレの効きが良くなる。` });
    if (L.hit.st !== 'ng' && L.speed.st === 'ok' && L.power.st === 'ok' && c.hs && c.gapHs > 0) out.push({ k: 'warn', t: `身体は目標HSに見合っている（垂直跳び${G.n1(c.cmj)}cm・下半身 体重の${c.lower}倍）のにHSが${G.n1(c.gapHs)}m/s足りない。原因は身体の使い方＝技術。スイング動画をyamadaに送る。` });
    if (!out.length) out.push({ k: '', t: 'データが足りない。下の「足りない記録」を埋めると診断が出る。' });
    return out;
  }

  function stTag(st) { return st == null ? '<span class="tag">未計測</span>' : st === 'ok' ? '<span class="tag ok">足りている</span>' : st === 'ng' ? '<span class="tag warn">足りない</span>' : '<span class="tag">もう少し</span>'; }

  G.routes.diagnose = function () {
    const d = G.data(), c = compute(d), L = c.legs, m = d.member || {};
    const miss = [];
    if (c.missing.hs) miss.push('HS（計測タブの「飛距離・HS」）'); if (c.missing.bs) miss.push('ボール初速（ミート率に必要）'); if (c.missing.carry) miss.push('キャリー（打ち出し効率に必要）');
    if (c.missing.cmj) miss.push('垂直跳び（下の欄）'); if (c.missing.bw) miss.push('体重（筋トレ→推定MAX→詳しく）'); if (c.missing.lifts) miss.push('BIG3の記録（筋トレで記録すると自動で拾う）');
    G.view.innerHTML = `
      <h1>飛距離診断</h1>
      <div class="chips"><a class="chip" href="#measure">飛距離・HS</a><a class="chip on" href="#diagnose">診断</a><a class="chip" href="#measure/round">ラウンド</a></div>
      <div class="card">
        <div class="row between"><div class="ttl" style="font-weight:700">目標（トータル）</div><select id="tgt" style="width:auto">${[250, 270, 280, 300, 320].map(y => `<option value="${y}" ${c.target === y ? 'selected' : ''}>${y}y</option>`).join('')}</select></div>
        <div class="stats4" style="margin-top:8px">
          <div class="stat"><div class="n">必要なHS（目安）</div><div class="v">${c.needHs}<small>m/s</small></div><div class="d">初速 ${c.needBs}m/s（ミート率1.48）</div></div>
          <div class="stat"><div class="n">今のHS（直近3回の中央値）</div><div class="v">${c.hs ? G.n1(c.hs) : '—'}<small>m/s</small></div><div class="d ${c.gapHs != null && c.gapHs <= 0 ? 'up' : ''}">${c.gapHs == null ? '未計測' : c.gapHs <= 0 ? '目標に届く速さ' : `あと ${G.n1(c.gapHs)} m/s`}</div></div>
          <div class="stat"><div class="n">今のHSで最適に当たれば</div><div class="v">${c.estTotal ?? '—'}<small>y</small></div><div class="d">キャリー ${c.estCarry ?? '—'}y</div></div>
          <div class="stat"><div class="n">実測</div><div class="v">${c.total ? Math.round(c.total) : '—'}<small>y</small></div><div class="d">キャリー ${c.carry ? Math.round(c.carry) : '—'}y${c.eff != null ? `・効率${Math.round(c.eff * 100)}%` : ''}</div></div>
        </div>
      </div>
      <h2>診断</h2>
      ${verdict(c).map(v => `<div class="note ${v.k}">${G.esc(v.t)}</div>`).join('')}
      <div class="card">
        <div class="row between"><div class="ttl" style="font-weight:700">① 当たり</div>${stTag(L.hit.st)}</div>
        <div class="sub muted">ミート率 ${c.smash ?? '—'}（目安1.45以上・上限1.50）／ 打ち出し効率 ${c.eff != null ? Math.round(c.eff * 100) + '%' : '—'}（同じHSの最適キャリーに対して・目安92%以上）</div>
      </div>
      <div class="card">
        <div class="row between"><div class="ttl" style="font-weight:700">② 速さ（SSC＝反動を使う速さ）</div>${stTag(L.speed.st)}</div>
        <div class="sub muted">垂直跳び ${c.cmj != null ? G.n1(c.cmj) + 'cm' : '—'}（目標HS ${c.needHs}m/s の目安 約${c.needCmj}cm）${c.rsi != null ? `／ RSI ${c.rsi}（${RSI(c.rsi)}・参考）` : ''}</div>
        <div class="sub muted">根拠：国内トップ級男子ゴルファーでHS49.6m/sの群が32cm、55m/sの群が41cm。垂直跳びとHSの相関 r=0.75。</div>
      </div>
      <div class="card">
        <div class="row between"><div class="ttl" style="font-weight:700">③ 筋力（土台）</div>${stTag(L.power.st)}</div>
        <div class="sub muted">下半身 ${c.lower != null ? `体重の${c.lower}倍（${c.lowerKg != null ? G.n1(c.lowerKg) + 'kg' : ''}）` : '—'}（スクワット推定MAX・目安1.3倍）／ 上半身 ${c.upper != null ? `体重の${c.upper}倍` : '—'}（ベンチ・目安1.0倍）</div>
        <div class="sub muted">根拠：エリートゴルファーの典型値 スクワット112±25kg（体重比約1.3）。スクワット1RMとHSの相関 r=0.63。</div>
      </div>
      ${miss.length ? `<div class="card flat"><div class="ttl" style="font-weight:700">足りない記録</div><ul class="muted" style="margin:6px 0 0;padding-left:18px">${miss.map(x => `<li>${G.esc(x)}</li>`).join('')}</ul></div>` : ''}
      <div class="card">
        <h3 style="margin-top:0">垂直跳びを記録する</h3>
        <p class="muted">反動あり・手は腰（CMJ）で3回跳んで最高値。スマホの無料アプリ（My Jump Lab 等）か、壁にチョークで「最高到達点−立って届く高さ」。月1回、筋トレ前のウォームアップ後に。毎回同じやり方で。</p>
        <div class="grid3">
          <div><label class="f">日付</label><input id="j_date" type="date" value="${G.todayKey()}"></div>
          <div><label class="f">高さ cm</label><input id="j_cm" type="number" inputmode="decimal" step="0.1" placeholder="例：32"></div>
          <div><label class="f">RSI（任意）</label><input id="j_rsi" type="number" inputmode="decimal" step="0.01" placeholder="例：1.4"></div>
        </div>
        <p class="muted" style="font-size:12px">RSI＝30cm台から落ちて跳ぶ「跳んだ高さ(m)÷接地時間(秒)」。ゴルフとの直接の研究は無いので参考表示のみ。</p>
        <button class="btn primary wide" id="j_save">記録する</button>
        ${d.measurements.some(x => x.jump_cm != null) ? `<table class="t" style="margin-top:10px"><tr><th>日付</th><th class="num">高さ</th><th class="num">RSI</th><th></th></tr>${d.measurements.filter(x => x.jump_cm != null).slice().reverse().slice(0, 10).map(x => `<tr><td>${x.measured_at.slice(5)}</td><td class="num">${G.n1(x.jump_cm)}cm</td><td class="num">${x.rsi ?? '—'}</td><td><button class="btn small ghost" data-del="${x.id}">取消</button></td></tr>`).join('')}</table>` : ''}
      </div>
      <div class="card flat"><p class="muted" style="margin:0">出し方：推定飛距離はTrackManの最適化表（入射角0°・最適打ち出し）の直線近似。必要HSは入射角で±2m/s動く（上から打てれば少なく済む）。速さ・筋力の目安は男子エリートの研究値を丸めたもので、個人差が大きい。測定器や条件が違う数値は比べない。</p></div>`;
    G.$('#tgt').onchange = async e => { try { await G.updateMember({ target_y: Number(e.target.value) }); G.route(); } catch (err) { G.toast(err.message); } };
    G.$('#j_save').onclick = async () => {
      const cm = Number(G.$('#j_cm').value), rsi = G.$('#j_rsi').value === '' ? null : Number(G.$('#j_rsi').value);
      if (!(cm >= 5 && cm <= 100)) { G.toast('高さを5〜100cmで入れてください'); return; }
      const p = { measured_at: G.$('#j_date').value, jump_cm: cm, source: 'manual', note: '垂直跳び' }; if (rsi != null) p.rsi = rsi;
      G.$('#j_save').disabled = true;
      try { await G.write('gq_add_measurement', { p }); G.toast('記録しました'); G.route(); } catch (e) { G.toast(e.message); G.$('#j_save').disabled = false; }
    };
    G.view.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!G.confirmBox('この記録を取り消しますか？')) return; try { await G.write('gq_delete_row', { p_table: 'measurements', p_id: b.dataset.del }); G.route(); } catch (e) { G.toast(e.message); } });
  };

  G.diagnose = { compute, verdict, optCarry, optTotal, hsForTotal, cmjNeeded };
})();
