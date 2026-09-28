/* yamada：質問（1日3件）とスイング動画（1日1本） */
(function () {
  'use strict';
  const G = window.GQ;
  const ST = { pending: ['回答待ち', ''], held: ['木曜に確認', 'warn'], answered: ['回答済', 'ok'] };

  G.routes.yamada = function () {
    const d = G.data(), m = d.member, r = G.rank.compute(d);
    const today = G.todayKey();
    const qToday = d.questions.filter(q => G.dayKey(q.asked_at) === today).length;
    const sToday = d.swings.filter(s => !s.deleted && G.dayKey(s.uploaded_at) === today).length;
    const nextRank = Math.max(3, r.next ? r.next.rank : 6); // スイング判定が要るのは段位3から
    G.view.innerHTML = `
      <h1>yamada</h1>
      <div class="card">
        <h3 style="margin-top:0">yamadaに質問 <span class="muted">今日 ${qToday}/3件</span></h3>
        <p class="muted">生活に合わせた調整（週何回行けるか、順番、記録の見方など）はここで。朝6:30と夜21:00の2回、まとめて返します。ケガ・痛み・医療の相談は木曜に本人が確認してから返します（急ぐ場合は医師へ）。</p>
        <textarea id="q" placeholder="例：仕事で週1しか練習場に行けない。ジャンプスクワットは週何回にすればいい？" ${qToday >= 3 ? 'disabled' : ''}></textarea>
        <button class="btn primary wide" id="ask" style="margin-top:8px" ${qToday >= 3 ? 'disabled' : ''}>送る</button>
      </div>
      ${d.questions.map(q => `<div class="item" data-seen="${q.id}"><div class="row between"><span class="muted">${G.fmtDateTime(q.asked_at)}</span><span class="tag ${ST[q.status][1]}">${ST[q.status][0]}</span></div>
        <div class="q-body">${G.esc(q.body)}</div>${q.answer ? `<div class="answer">${G.esc(q.answer)}</div>` : ''}</div>`).join('')}

      <div class="card" style="margin-top:20px">
        <h3 style="margin-top:0">スイング動画を送る <span class="muted">今日 ${sToday}/1本</span></h3>
        <p class="muted">正面・全身・1スイング。翌朝までに判定（所見＋「次の段位OK／まだ」＋参考数値）。段位3以上の昇格に必要。数値は撮影条件で揺れるので参考値。</p>
        ${m.consent ? '' : `<div class="note"><label class="row"><input type="checkbox" id="consent" style="width:auto;min-height:0"> 動画はyamada（運営）が判定のために預かり、30日後に自動削除されることに同意する。SNS等には出さない。</label></div>`}
        <div class="row"><input type="file" id="vid" accept="video/*" style="width:auto" ${sToday >= 1 ? 'disabled' : ''}><span class="muted" id="vst"></span></div>
        <p class="muted">判定を受ける段位：<b>${nextRank}</b></p>
        <button class="btn primary wide" id="up" ${sToday >= 1 ? 'disabled' : ''}>送る</button>
      </div>
      ${d.swings.filter(s => !s.deleted).map(s => `<div class="item" data-seen="${s.id}"><div class="row between"><span class="muted">${G.fmtDateTime(s.uploaded_at)}・段位${s.rank_target}</span><span class="tag ${s.status === 'judged' ? (s.verdict === 'ok' ? 'ok' : 'warn') : ''}">${s.status === 'judged' ? (s.verdict === 'ok' ? '次の段位 OK' : 'まだ') : '判定待ち'}</span></div>
        ${s.findings ? `<div class="answer">${G.esc(s.findings)}</div>` : ''}
        ${s.metrics ? `<div class="muted">${Object.entries(s.metrics).map(([k, v]) => `${G.esc(k)} ${G.esc(v)}`).join('・')}（参考値）</div>` : ''}
        <div class="muted">動画は ${G.fmtDate(s.expires_at)} に削除</div></div>`).join('')}`;
    // 既読
    let changed = false; G.view.querySelectorAll('[data-seen]').forEach(x => { if (!G.S.seen[x.dataset.seen]) { G.S.seen[x.dataset.seen] = 1; changed = true; } }); if (changed) G.save();

    G.$('#ask').onclick = async () => {
      const body = G.$('#q').value.trim(); if (!body) { G.toast('質問を書いてください'); return; }
      G.$('#ask').disabled = true;
      try { await G.write('gq_ask', { p_body: body }); G.toast('送りました。朝6:30／夜21:00に返ります'); G.route(); } catch (e) { G.toast(e.message); G.$('#ask').disabled = false; }
    };
    G.$('#up').onclick = async () => {
      const f = G.$('#vid').files[0]; if (!f) { G.toast('動画を選んでください'); return; }
      if (f.size > 80 * 1024 * 1024) { G.toast('80MBまで。短く切ってください'); return; }
      if (!m.consent) { const c = G.$('#consent'); if (!c || !c.checked) { G.toast('同意にチェックしてください'); return; } try { await G.updateMember({ consent: true }); } catch (e) { G.toast(e.message); return; } }
      G.$('#up').disabled = true; G.$('#vst').textContent = '送信中…';
      try {
        const ext = (f.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
        const path = `${G.member().upload_key}/${Date.now()}.${ext}`;
        await G.uploadVideo(path, f);
        await G.write('gq_add_swing', { p_path: path, p_rank: nextRank });
        G.toast('送りました。翌朝までに判定します'); G.route();
      } catch (e) { G.toast(e.message); G.$('#up').disabled = false; G.$('#vst').textContent = ''; }
    };
  };
})();
