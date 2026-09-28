/* 起動 */
(function () {
  'use strict';
  const G = window.GQ;
  G.applyTheme();
  if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { })); }
  G.route();
  if (G.S.code) { G.sync(true).then(() => G.route()).catch(() => { if (!G.S.data) G.toast('通信できません。つながる場所で開き直してください'); }); }
})();
