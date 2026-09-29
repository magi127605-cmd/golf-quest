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
        <div class="row"><button class="btn small" id="r_imp_btn">スコアカードのスクショから取り込む</button></div>
        <div id="r_imp" hidden class="note">
          <p class="muted" style="margin-top:0">①下の質問文をコピー → ②${G.aiName()}を開き、スコアカードのスクショを付けて質問文を貼る → ③返ってきた文をそのまま下に貼って「取り込む」</p>
          <div class="row"><button class="btn small" data-copy="${G.esc(ROUND_PROMPT)}">質問文をコピー</button><a class="btn small ghost" target="_blank" rel="noopener" href="${G.member().ai_pref === 'claude' ? 'https://claude.ai/new' : 'https://chatgpt.com/'}">${G.aiName()}を開く</a></div>
          <textarea id="r_txt" placeholder="日付: 2026-09-20&#10;コース: ○○CC&#10;スコア: 98&#10;パット: 36&#10;ホール: 5,6,4,5,7,4,5,6,5 / 4,6,5,5,4,6,5,6,5&#10;パー: 4,4,3,5,4,3,4,5,4 / 4,5,3,4,4,4,5,3,4"></textarea>
          <button class="btn small primary" id="r_imp_do">取り込む</button> <span class="muted" id="r_imp_st"></span>
        </div>
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
        ${d.rounds.slice().reverse().map(x => `<tr><td>${x.played_at.slice(5)}<div class="muted">${G.esc(x.course_name || '')}</div></td><td class="num">${x.score ?? '—'}</td><td class="num">${x.putts ?? '—'}</td><td class="num">${x.ob ?? '—'}</td><td class="num">${x.dbl_plus ?? '—'}</td><td><button class="btn small ghost" data-del="${x.id}">取消</button></td></tr>${Array.isArray(x.holes) ? `<tr><td colspan="6" class="muted" style="font-size:12px;font-variant-numeric:tabular-nums">${x.holes.slice(0, 9).join(' ')}${x.holes.length > 9 ? ' / ' + x.holes.slice(9).join(' ') : ''}${Array.isArray(x.pars) ? `<br><span style="opacity:.7">P ${x.pars.slice(0, 9).join(' ')}${x.pars.length > 9 ? ' / ' + x.pars.slice(9).join(' ') : ''}</span>` : ''}</td></tr>` : ''}`).join('')}</table>` : '<p class="muted">まだ記録がありません。</p>'}`;
  }
  const ROUND_PROMPT = `添付のゴルフスコアカードを読み取って、次の形式の行だけで返してください（説明文は不要。読めない項目は行ごと省く。ホールとパーは18個をカンマ区切り、OUT/INの間に「/」）：
日付: 2026-09-20
コース: ○○カントリークラブ
スコア: 98
パット: 36
FWキープ: 5
OB: 2
ホール: 5,6,4,5,7,4,5,6,5 / 4,6,5,5,4,6,5,6,5
パー: 4,4,3,5,4,3,4,5,4 / 4,5,3,4,4,4,5,3,4`;
  // AIが返した行を読む
  function parseRound(text) {
    const out = {}; const get = k => { const m = String(text).match(new RegExp('^\\s*' + k + '\\s*[:：]\\s*(.+)$', 'mi')); return m ? m[1].trim() : null; };
    const nums = s => s ? s.split(/[,、\/\s]+/).map(x => x.trim()).filter(x => x !== '').map(Number).filter(n => !isNaN(n)) : null;
    const dt = get('日付'); if (dt) { const m = dt.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/); if (m) out.played_at = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; }
    out.course_name = get('コース(?:名)?') || null;
    ['スコア', 'パット(?:数)?', 'FW(?:キープ)?', 'OB', 'ダボ(?:以上)?'].forEach((k, i) => { const v = get(k); const n = v ? parseInt(v.replace(/[^0-9]/g, ''), 10) : NaN; if (!isNaN(n)) out[['score', 'putts', 'fw_keep', 'ob', 'dbl_plus'][i]] = n; });
    const holes = nums(get('ホール(?:別)?')), pars = nums(get('パー'));
    if (holes && holes.length >= 9) { out.holes = holes; if (out.score == null) out.score = holes.reduce((a, b) => a + b, 0); }
    if (pars && holes && pars.length === holes.length) { out.pars = pars; if (out.dbl_plus == null) out.dbl_plus = holes.filter((h, i) => h - pars[i] >= 2).length; }
    return Object.keys(out).filter(k => out[k] != null).length ? out : null;
  }
  function bindRound() {
    let holes = null, pars = null;
    G.$('#r_imp_btn').onclick = () => { G.$('#r_imp').hidden = !G.$('#r_imp').hidden; };
    G.$('#r_imp_do').onclick = () => {
      const p = parseRound(G.$('#r_txt').value);
      if (!p) { G.$('#r_imp_st').textContent = '読み取れませんでした。「スコア: 98」のような行になっているか確認'; return; }
      if (p.played_at) G.$('#r_date').value = p.played_at; if (p.course_name) G.$('#r_course').value = p.course_name;
      [['score', '#r_score'], ['putts', '#r_putts'], ['fw_keep', '#r_fw'], ['ob', '#r_ob'], ['dbl_plus', '#r_dbl']].forEach(([k, id]) => { if (p[k] != null) G.$(id).value = p[k]; });
      holes = p.holes || null; pars = p.pars || null;
      G.$('#r_imp_st').textContent = `取り込みました${holes ? '（ホール別' + holes.length + 'H）' : ''}。数字を確認して「記録する」`;
    };
    G.$('#r_save').onclick = async () => {
      const v = id => { const x = G.$(id).value; return x === '' ? null : Number(x); };
      if (v('#r_score') == null) { G.toast('スコアを入れてください'); return; }
      G.$('#r_save').disabled = true;
      try { await G.write('gq_add_round', { p: { played_at: G.$('#r_date').value, course_name: G.$('#r_course').value, score: v('#r_score'), putts: v('#r_putts'), fw_keep: v('#r_fw'), ob: v('#r_ob'), dbl_plus: v('#r_dbl'), note: G.$('#r_note').value, holes, pars } }); G.toast('記録しました'); G.route(); } catch (e) { G.toast(e.message); G.$('#r_save').disabled = false; }
    };
    G.view.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!G.confirmBox('この記録を取り消しますか？')) return; try { await G.write('gq_delete_row', { p_table: 'rounds', p_id: b.dataset.del }); G.route(); } catch (e) { G.toast(e.message); } });
  }
})();
