/* 設定 */
(function () {
  'use strict';
  const G = window.GQ;
  function applyTheme() { const t = G.S.theme || 'auto'; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
  G.applyTheme = applyTheme;

  G.routes.settings = function () {
    const m = G.member(), plan = Object.assign({ explosive: 2, range: 1, big3: 0 }, m.plan || {}), lifts = m.lifts || {};
    G.view.innerHTML = `
      <h1>設定</h1>
      <div class="card">
        <label class="f">表示名（本名は入れない）</label><input id="name" value="${G.esc(m.name || '')}" maxlength="30">
        <label class="f">コース</label>
        <div class="chips">${[['home', '自重'], ['gym', 'ジム']].map(([k, l]) => `<button class="chip ${m.course === k ? 'on' : ''}" data-course="${k}">${l}</button>`).join('')}</div>
      </div>
      <div class="card">
        <h3 style="margin-top:0">自分のテンポ（決めたら変えない）</h3>
        <p class="muted">BPM60〜90でいくつか試し、一番「振りやすい」ものを。yamadaはBPM60の3拍（1静止・2トップ・3インパクト）。クラブごとに変えない。</p>
        <div class="grid2">
          <div><label class="f">BPM</label><input id="bpm" type="number" inputmode="numeric" min="40" max="140" value="${m.bpm || ''}" placeholder="60"></div>
          <div><label class="f">拍</label><div class="chips">${[3, 4].map(b => `<button class="chip ${(m.beats || 3) === b ? 'on' : ''}" data-beats="${b}">${b}拍</button>`).join('')}</div></div>
        </div>
        <div class="row"><button class="btn small" id="test">試しに鳴らす</button><button class="btn small ghost" id="stop">止める</button></div>
      </div>
      <div class="card">
        <h3 style="margin-top:0">週の予定（遵守率の分母）</h3>
        <div class="grid3">
          <div><label class="f">爆発トレ／週</label><input id="p_ex" type="number" min="1" max="3" value="${plan.explosive}"></div>
          <div><label class="f">練習場／週</label><input id="p_rg" type="number" min="0" max="3" value="${plan.range}"></div>
          <div><label class="f">BIG3／週</label><input id="p_b3" type="number" min="0" max="2" value="${plan.big3}"></div>
        </div>
        <p class="muted">爆発トレは週3回が上限（それ以上は逆効果）。</p>
      </div>
      <div class="card">
        <h3 style="margin-top:0">BIG3の現在重量（kg）と体重</h3>
        <div class="grid2" style="margin-bottom:8px"><div><label class="f">体重 kg（推定MAXの体重比に使う）</label><input id="l_bw" type="number" inputmode="decimal" step="0.1" value="${lifts.bw ?? ''}" placeholder="例：70"></div></div>
        <div class="grid3">
          <div><label class="f">スクワット</label><input id="l_squat" type="number" step="2.5" value="${lifts.squat ?? ''}"></div>
          <div><label class="f">デッド</label><input id="l_dead" type="number" step="2.5" value="${lifts.dead ?? ''}"></div>
          <div><label class="f">ベンチ</label><input id="l_bench" type="number" step="2.5" value="${lifts.bench ?? ''}"></div>
        </div>
      </div>
      <div class="card">
        <h3 style="margin-top:0">休憩おわりの知らせ</h3>
        <p class="muted">画面を見ている時は音、画面を消している・別のアプリの時はスマホの通知で知らせます（イヤホンにも鳴ります）。</p>
        <label class="f">おわる前の予告音（短いポーン1回）</label>
        <div class="chips">${[[0, 'なし'], [10, '10秒前'], [20, '20秒前'], [30, '30秒前'], [60, '1分前']].map(([k, l]) => `<button class="chip ${G.alarm.warnSec() === k ? 'on' : ''}" data-warn="${k}">${l}</button>`).join('')}</div>
        <p id="ntState"></p>
        <div class="row"><button class="btn small" id="ntOn">通知をオンにする</button><button class="btn small ghost" id="ntTest">10秒後に試す</button></div>
      </div>
      <div class="card">
        <label class="f">AIに聞く先</label>
        <div class="chips">${[['chatgpt', 'ChatGPT'], ['claude', 'Claude']].map(([k, l]) => `<button class="chip ${(m.ai_pref || 'chatgpt') === k ? 'on' : ''}" data-ai="${k}">${l}</button>`).join('')}</div>
        <label class="f">見た目</label>
        <div class="chips">${[['auto', '端末に合わせる'], ['light', '明るい'], ['dark', '暗い']].map(([k, l]) => `<button class="chip ${(G.S.theme || 'auto') === k ? 'on' : ''}" data-theme="${k}">${l}</button>`).join('')}</div>
      </div>
      <button class="btn primary wide" id="save">保存する</button>
      <div class="card" style="margin-top:20px">
        <p class="muted">合言葉：${G.esc((G.S.code || '').slice(0, 4))}••••••</p>
        <p class="muted">開始日 ${G.esc(m.started_at || '')} ／ 版 ${G.esc(window.GQ_CONFIG.version)}</p>
        <div class="row"><button class="btn small" id="resync">記録を取り直す</button><button class="btn small ghost" id="logout">この端末から外す</button></div>
        <p class="muted">別の端末で使う時は、同じ合言葉を入れれば記録が引き継がれます。</p>
      </div>`;
    const pick = (sel, attr) => { let v = null; G.view.querySelectorAll(sel).forEach(b => { if (b.classList.contains('on')) v = b.dataset[attr]; b.onclick = () => { G.view.querySelectorAll(sel).forEach(x => x.classList.toggle('on', x === b)); v = b.dataset[attr]; if (attr === 'theme') { G.S.theme = v; G.save(); applyTheme(); } if (attr === 'warn') { G.S.restWarn = Number(v); G.save(); } }; }); return () => v; };
    const course = pick('[data-course]', 'course'), beats = pick('[data-beats]', 'beats'), ai = pick('[data-ai]', 'ai'); pick('[data-theme]', 'theme'); pick('[data-warn]', 'warn');
    G.$('#test').onclick = () => { const b = Number(G.$('#bpm').value) || 60; G.metro.start(b, Number(beats()) || 3); };
    G.$('#stop').onclick = () => G.metro.stop();
    G.$('#save').onclick = async () => {
      G.metro.stop();
      const patch = { name: G.$('#name').value.trim(), ai_pref: ai() || 'chatgpt', beats: Number(beats()) || 3,
        plan: { explosive: Number(G.$('#p_ex').value) || 2, range: Number(G.$('#p_rg').value) || 0, big3: Number(G.$('#p_b3').value) || 0 }, lifts: {} };
      if (course()) patch.course = course();
      const bpm = Number(G.$('#bpm').value); if (bpm >= 40 && bpm <= 140) patch.bpm = bpm;
      ['squat', 'dead', 'bench', 'bw'].forEach(k => { const v = G.$('#l_' + k).value; if (v !== '') patch.lifts[k] = Number(v); });
      G.$('#save').disabled = true;
      try { await G.updateMember(patch); G.toast('保存しました'); location.hash = '#home'; G.route(); } catch (e) { G.toast(e.message); G.$('#save').disabled = false; }
    };
    const ntShow = () => {
      const p = G.alarm.perm();
      G.$('#ntState').innerHTML = { granted: '<b>オン</b>', denied: '<b>オフ</b>（ブラウザで止められています。Chromeならアドレス欄の左の印 → 権限 → 通知 を「許可」に）', default: 'まだオンになっていません', unsupported: 'このブラウザでは通知が使えません（iPhoneはホーム画面に追加したアプリから開くと使えます）。音とバイブだけで知らせます' }[p];
      G.$('#ntOn').style.display = p === 'default' ? '' : 'none';
    };
    ntShow();
    G.$('#ntOn').onclick = async () => { await G.alarm.ask(); ntShow(); };
    G.$('#ntTest').onclick = () => { G.alarm.prime(); G.toast(G.alarm.warnSec() ? '5秒後に予告音、10秒後に休憩おわりの音が鳴ります。画面を消して待ってください' : '10秒後に鳴ります。画面を消して待ってください'); const w = G.alarm.warnSec(); if (w) setTimeout(() => G.alarm.warn('これが予告の知らせです'), 5000); setTimeout(() => G.alarm.ring('休憩おわり（お試し）', 'これが休憩おわりの知らせです'), 10000); };
    G.$('#resync').onclick = () => G.sync().then(() => { G.toast('取り直しました'); }).catch(() => { });
    G.$('#logout').onclick = () => { if (!G.confirmBox('この端末から外しますか？（記録は倉庫に残ります。合言葉で戻せます）')) return; G.S.code = null; G.S.data = null; G.S.wip = { workout: null, range: null }; G.save(); location.hash = '#home'; G.route(); };
  };
})();
