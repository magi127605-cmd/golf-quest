/* 計測（手入力＋スクショ取り込み）とラウンド */
(function () {
  'use strict';
  const G = window.GQ;
  const F = [['hs', 'HS (m/s)', 'decimal'], ['ball_speed', 'ボール初速 (m/s)', 'decimal'], ['carry', 'キャリー (y)', 'decimal'], ['total', 'トータル (y)', 'decimal'], ['launch', '打ち出し角 (°)', 'decimal'], ['spin', 'スピン (rpm)', 'numeric']];

  G.routes.measure = function (arg) {
    const d = G.data();
    const tab = arg === 'round' ? 'round' : 'meas';
    G.view.innerHTML = `
      <h1>計測</h1>
      <div class="chips"><a class="chip ${tab === 'meas' ? 'on' : ''}" href="#measure">飛距離・HS</a><a class="chip ${tab === 'round' ? 'on' : ''}" href="#measure/round">ラウンド</a></div>
      ${tab === 'meas' ? meas(d) : round(d)}`;
    if (tab === 'meas') bindMeas(); else bindRound();
  };

  function meas(d) {
    return `
      <div class="card">
        <p class="muted">HSとキャリーの2つで十分。あるものだけ入れる。同じ計測器・同じ条件で比べること。</p>
        <div class="row"><button class="btn small" id="shot">計測器のスクショから読み取る</button><input type="file" id="img" accept="image/*" hidden><span class="muted" id="ocr"></span></div>
        <div class="grid2">
          <div><label class="f">日付</label><input id="m_date" type="date" value="${G.todayKey()}"></div>
          ${F.map(([k, l, im]) => `<div><label class="f">${l}</label><input id="m_${k}" type="number" inputmode="${im}" step="any"></div>`).join('')}
        </div>
        <label class="f">メモ（計測器・条件など）</label><input id="m_note" placeholder="例：練習場のGarmin R10、ドライバー10球">
        <button class="btn primary wide" id="m_save" style="margin-top:10px">記録する</button>
      </div>
      <h2>記録</h2>
      ${d.measurements.length ? `<table class="t"><tr><th>日付</th><th class="num">HS</th><th class="num">初速</th><th class="num">キャリー</th><th class="num">トータル</th><th></th></tr>
        ${d.measurements.slice().reverse().map(x => `<tr><td>${x.measured_at.slice(5)}${x.source === 'screenshot' ? ' <span class="tag">ス</span>' : ''}</td><td class="num">${G.n1(x.hs)}</td><td class="num">${G.n1(x.ball_speed)}</td><td class="num">${G.n1(x.carry)}</td><td class="num">${G.n1(x.total)}</td><td><button class="btn small ghost" data-del="${x.id}">取消</button></td></tr>`).join('')}</table>` : '<p class="muted">まだ記録がありません。最初の1回が「基準値」になります。</p>'}`;
  }
  function bindMeas() {
    let source = 'manual';
    G.$('#shot').onclick = () => G.$('#img').click();
    G.$('#img').onchange = async e => { const f = e.target.files[0]; if (f) await ocr(f, () => { source = 'screenshot'; }); };
    G.$('#m_save').onclick = async () => {
      const p = { measured_at: G.$('#m_date').value, note: G.$('#m_note').value, source };
      let any = false; F.forEach(([k]) => { const v = G.$('#m_' + k).value; if (v !== '') { p[k] = Number(v); any = true; } });
      if (!any) { G.toast('数値を1つ以上入れてください'); return; }
      G.$('#m_save').disabled = true;
      try { await G.write('gq_add_measurement', { p }); G.toast('記録しました'); G.route(); } catch (e) { G.toast(e.message); G.$('#m_save').disabled = false; }
    };
    G.view.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!G.confirmBox('この記録を取り消しますか？')) return; try { await G.write('gq_delete_row', { p_table: 'measurements', p_id: b.dataset.del }); G.route(); } catch (e) { G.toast(e.message); } });
  }

  // スクショ読み取り（端末内で文字認識。外部にAI費用はかからない）
  async function ocr(file, onOk) {
    const st = G.$('#ocr'); st.textContent = '読み取り中…（初回は少し時間がかかります）';
    try {
      if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'; s.onload = res; s.onerror = () => rej(new Error('読み取り部品を取得できません（通信を確認）')); document.head.appendChild(s); });
      const { data } = await window.Tesseract.recognize(file, 'eng');
      const txt = data.text.replace(/,/g, '');
      const pick = (labels, lo, hi) => {
        for (const lb of labels) {
          const re = new RegExp(lb + '[^0-9\\n]{0,20}(\\d+(?:\\.\\d+)?)', 'i'); const m = txt.match(re);
          if (m) { const v = Number(m[1]); if (v >= lo && v <= hi) return v; }
        }
        return null;
      };
      let hs = pick(['club ?speed', 'head ?speed', 'clubhead', 'CHS', 'HS'], 20, 150);
      let bs = pick(['ball ?speed', 'BS'], 30, 220);
      let carry = pick(['carry'], 30, 400), total = pick(['total'], 30, 420), launch = pick(['launch ?(?:angle|ang)?', 'LA'], 0, 30), spin = pick(['spin ?(?:rate)?', 'back ?spin'], 300, 8000);
      // mph らしければ m/s に、m らしければ y に
      if (hs != null && hs > 65) hs = Math.round(hs * 0.44704 * 10) / 10;
      if (bs != null && bs > 95) bs = Math.round(bs * 0.44704 * 10) / 10;
      if (/\bm\b|meters|メートル/i.test(txt) && !/yds|yards|\by\b/i.test(txt)) { if (carry) carry = Math.round(carry * 1.0936); if (total) total = Math.round(total * 1.0936); }
      const got = { hs, ball_speed: bs, carry, total, launch, spin };
      let n = 0; Object.entries(got).forEach(([k, v]) => { if (v != null) { G.$('#m_' + k).value = v; n++; } });
      st.textContent = n ? `${n}項目を読み取りました。数値を確認して「記録する」` : '数値を見つけられませんでした。手入力してください';
      if (n) onOk();
    } catch (e) { st.textContent = e.message || '読み取れませんでした'; }
  }

  function round(d) {
    return `
      <div class="card">
        <p class="muted">100切りは「ボギー＋ダブルボギー」の繰り返し。大叩きの原因はティーショットのOBと取り返そうとした2打目。</p>
        <div class="grid2">
          <div><label class="f">日付</label><input id="r_date" type="date" value="${G.todayKey()}"></div>
          <div><label class="f">コース名</label><input id="r_course" placeholder="任意"></div>
          <div><label class="f">スコア</label><input id="r_score" type="number" inputmode="numeric"></div>
          <div><label class="f">パット数</label><input id="r_putts" type="number" inputmode="numeric"></div>
          <div><label class="f">FWキープ（回）</label><input id="r_fw" type="number" inputmode="numeric"></div>
          <div><label class="f">OB（回）</label><input id="r_ob" type="number" inputmode="numeric"></div>
          <div><label class="f">ダボ以上のホール数</label><input id="r_dbl" type="number" inputmode="numeric"></div>
        </div>
        <label class="f">崩れたホール・気づき</label><input id="r_note" placeholder="例：3番でOB→取り返そうとして2打目も林">
        <button class="btn primary wide" id="r_save" style="margin-top:10px">記録する</button>
      </div>
      <h2>記録</h2>
      ${d.rounds.length ? `<table class="t"><tr><th>日付</th><th class="num">スコア</th><th class="num">パット</th><th class="num">OB</th><th class="num">ダボ+</th><th></th></tr>
        ${d.rounds.slice().reverse().map(x => `<tr><td>${x.played_at.slice(5)}<div class="muted">${G.esc(x.course_name || '')}</div></td><td class="num">${x.score ?? '—'}</td><td class="num">${x.putts ?? '—'}</td><td class="num">${x.ob ?? '—'}</td><td class="num">${x.dbl_plus ?? '—'}</td><td><button class="btn small ghost" data-del="${x.id}">取消</button></td></tr>`).join('')}</table>` : '<p class="muted">まだ記録がありません。</p>'}`;
  }
  function bindRound() {
    G.$('#r_save').onclick = async () => {
      const v = id => { const x = G.$(id).value; return x === '' ? null : Number(x); };
      if (v('#r_score') == null) { G.toast('スコアを入れてください'); return; }
      G.$('#r_save').disabled = true;
      try { await G.write('gq_add_round', { p: { played_at: G.$('#r_date').value, course_name: G.$('#r_course').value, score: v('#r_score'), putts: v('#r_putts'), fw_keep: v('#r_fw'), ob: v('#r_ob'), dbl_plus: v('#r_dbl'), note: G.$('#r_note').value } }); G.toast('記録しました'); G.route(); } catch (e) { G.toast(e.message); G.$('#r_save').disabled = false; }
    };
    G.view.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!G.confirmBox('この記録を取り消しますか？')) return; try { await G.write('gq_delete_row', { p_table: 'rounds', p_id: b.dataset.del }); G.route(); } catch (e) { G.toast(e.message); } });
  }
})();
