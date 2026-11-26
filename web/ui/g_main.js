function render() {
  const disc = document.getElementById('disc');
  const keep = {}; ['chatin', 'dmin', 'jcode', 'fcode', 'gtitle', 'em', 'pw', 'pname', 'obn', 'ln0', 'ln1', 'ln2', 'ln3'].forEach(k => { const el = document.getElementById(k); if (el) keep[k] = el.value; });
  const focus = document.activeElement && document.activeElement.id;
  const scr = document.getElementById('scr'), sTop = scr ? scr.scrollTop : 0, sTab = ui.tab;
  const gm = [...document.querySelectorAll('[data-gm].on')].map(x => x.dataset.gm);
  $app.innerHTML = !ready ? `<div class="scr"><div class="in"><div class="brand" style="margin-top:30vh">${fan(['H1a', 'S13a', 'J0a'], 44)}<h1>سهرة ورق</h1><p class="muted">عم يحمّل…</p></div></div></div>`
    : ui.view === 'dm' && ui.dm ? dmView()
    : ui.view === 'home' ? home()
    : ui.view === 'room' || !ui.st ? lobby()
    : ui.st.game === 'mafia' ? mafiaView()
    : ui.st.game === 'coup' ? coupView()
    : gameOf(ui.st).id === 'mor' ? game() : trickTable();
  layoutHand();
  for (const [k, v] of Object.entries(keep)) { const el = document.getElementById(k); if (el && v) el.value = v; }
  if (focus) { const el = document.getElementById(focus); if (el && el.tagName === 'INPUT' && el.type !== 'range') el.focus(); }
  gm.forEach(id => { const el = document.querySelector(`[data-gm="${id}"]`); if (el) el.classList.add('on'); });
  const s2 = document.getElementById('scr'); if (s2 && sTab === render.lastTab) s2.scrollTop = sTop; render.lastTab = ui.tab;
  const d2 = document.getElementById('disc'); if (d2) d2.scrollLeft = d2.scrollWidth;
  for (const id of ['msgs', 'dmmsgs']) { const m2 = document.getElementById(id); if (m2) m2.scrollTop = m2.scrollHeight; }
  if (ui.chatOpen) ui.unread = 0;
}
window.addEventListener('resize', () => layoutHand());

// ---------- events ----------
function copyText(t, msg) {
  const done = () => toast(msg);
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => toast(t));
  else toast(t);
}
$app.addEventListener('click', e => {
  let t = e.target.closest('[data-a]');
  if (t && t.classList.contains('ov') && e.target.closest('[data-stop]')) return;
  if (t && !t.dataset.a) t = null;
  if (!t) t = e.target.closest('[data-di]') || e.target.closest('[data-meld]') || e.target.closest('[data-seat]');
  if (!t) return;
  const a = t.dataset.a, st = ui.st, g = t.dataset.g;
  if (a) {
    e.stopPropagation();
    if (mafiaActs[a]) return mafiaActs[a](t);
    if (coupActs[a]) return coupActs[a](t);
    ({
      tab: () => { ui.tab = t.dataset.t; ui.view = 'home'; render(); },
      closePop: () => { ui.pop = null; ui.obAv = null; render(); },
      newRoom: () => { if (online() && native) { ui.pop = { k: 'newRoom' }; render(); } else createRoom(online() ? 'fb' : 'lan'); },
      createFb: () => createRoom('fb'), createLan: () => createRoom('lan'),
      joinPop: () => { ui.pop = { k: 'join' }; render(); setTimeout(() => document.getElementById('jcode')?.focus(), 60); },
      joinGo: () => joinAny(document.getElementById('jcode').value),
      joinHere: () => joinRoom('lan', location.hostname),
      rejoin: () => { const r = ls.get('mor-room'); if (r) joinRoom(r.mode, r.key); },
      resume: () => startLocal(g),
      soloPick: () => requestLocal(g, 'solo'),
      replaceLocal: () => { const p = ui.pop; if (p?.k === 'replaceLocal') startLocal(p.g, p.setup); },
      cancelLocal: () => { const p = ui.pop; ui.pop = p?.kind === 'pass' ? { k: 'pass', g: p.g } : null; render(); },
      rules: () => { e.stopPropagation(); ui.pop = { k: 'rules', g }; render(); },
      passPop: () => { ui.localCfg = [false, false, false, false]; ui.passNames = []; ui.pop = { k: 'pass', g: prof.lastGame }; render(); },
      passGame: () => { ui.pop.g = g; render(); },
      cfgBot: () => { ui.localCfg[+t.dataset.s] = !ui.localCfg[+t.dataset.s]; render(); },
      local: () => requestLocal(g, 'pass'),
      // onboarding and profile
      obAv: () => { ui.obAv = t.dataset.v; render(); },
      obCol: () => { const [, gl] = (ui.obAv || prof.av).split('|'); ui.obAv = t.dataset.v + '|' + gl; render(); },
      obDone: () => { const n = (document.getElementById('obn').value || '').trim(); if (!n) return toast('اكتب اسمك'); prof.name = n.slice(0, 14); if (ui.obAv) prof.av = ui.obAv; ui.obAv = null; saveProf(); ls.set('mor-name', prof.name); pushProfile(); SFX.deal(); render(); },
      avPop: () => { ui.obAv = prof.av; ui.pop = { k: 'av' }; render(); },
      avSave: () => { if (ui.obAv) prof.av = ui.obAv; ui.obAv = null; ui.pop = null; saveProf(); pushProfile(); render(); },
      saveName: () => { const n = (document.getElementById('pname').value || '').trim(); if (!n) return toast('الاسم فاضي'); prof.name = n.slice(0, 14); saveProf(); ls.set('mor-name', prof.name); pushProfile(); toast('انحفظ'); },
      setP: () => { prof[t.dataset.k] = t.dataset.v; saveProf(); SFX.tap(); render(); },
      mute: () => { prof.mute = !prof.mute; saveProf(); actx(); if (!prof.mute) SFX.card(); render(); },
      testSnd: () => { SFX.deal(); setTimeout(SFX.card, 700); setTimeout(SFX.collect, 1100); },
      orient: () => setOrient(t.dataset.v),
      statGame: () => { ui.statGame = g; render(); },
      emailPop: () => { ui.pop = { k: 'email', m: t.dataset.m }; render(); },
      linkEmail, recoverEmail,
      // friends and messages
      copyId: () => copyText(prof.code || '', 'انسخ الـ ID: ' + (prof.code || '')),
      addFriend, accept: () => acceptFriend(t.dataset.f), unfriend: () => dropFriend(t.dataset.f),
      friendMenu: () => { ui.pop = { k: 'friend', f: t.dataset.f }; render(); },
      dm: () => { ui.pop = null; openDM(t.dataset.f); }, openChat: () => openChat(t.dataset.c), closeChat,
      sendDM: () => sendDM(),
      groupPop: () => { ui.pop = { k: 'group' }; render(); }, gmT: () => t.classList.toggle('on'), mkGroup: createGroup,
      invitePop: () => { ui.pop = { k: 'invite' }; render(); }, invite: () => inviteTo(t.dataset.to),
      acceptInv: () => { const r = t.dataset.r; closeChat(); if (ui.mode) { if (ui.code === r) { ui.view = ui.st ? 'game' : 'room'; return render(); } leave(); } joinRoom('fb', r); },
      // room
      copyCode: () => copyText(ui.code, 'انسخ الكود: ' + ui.code),
      gamePick: () => { ui.pop = { k: 'gamePick' }; render(); }, setGame: () => setRoomGame(g),
      exit: () => { ui.confirmExit = true; render(); }, stay: () => { ui.confirmExit = false; render(); }, leave: () => { const local = ui.mode === 'local'; if (local) { cancelBot(); Object.assign(ui, { view: 'home', tab: 'home', mode: null, st: null, confirmExit: false }); prevSt = null; return render(); } leave(); },
      start: () => startOnline(false), startBots: () => startOnline(true), sit: () => sit(+t.dataset.s),
      backRoom: backToRoom,
      // Mor
      draw: () => act(Mor.draw), meld: () => act(Mor.meldNew, [...ui.sel]), discard: () => act(Mor.discard, [...ui.sel][0]),
      declMor: () => act(Mor.declare, 'mor'), declClose: () => act(Mor.declare, 'close'), undecl: () => act(Mor.undeclare),
      morNow: () => act(Mor.takeMorNow), chooseMor: () => act(Mor.chooseMor), close: () => act(Mor.close),
      sort: () => { const me = mySeat(); const h = ui.st.hands[me]; const cur = ui.order[me] || []; const s1 = sortIds(h, false); ui.order[me] = cur.join() === s1.join() ? sortIds(h, true) : s1; render(); },
      reveal: () => { ui.hidden = false; render(); }, nextRound, newMatch,
      noSheet: () => { ui.sheet = null; render(); }, sheet: () => { const o = ui.sheet.opts[+t.dataset.i]; ui.sheet = null; o.run(); },
      // chat & voice
      chat: () => { ui.chatOpen = true; ui.unread = 0; render(); setTimeout(() => document.getElementById('chatin')?.focus(), 50); },
      chatClose: () => { ui.chatOpen = false; render(); }, send: sendChat, play: () => playVoice(t.dataset.m),
      voice: () => (vc.on ? voiceMute() : voiceJoin()), voiceLeave: () => voiceLeave(),
      // trick games
      bid: () => act(gameOf(ui.st).bid, +t.dataset.n), trump: () => act(gameOf(ui.st).chooseTrump, t.dataset.s),
      choose: () => act(gameOf(ui.st).choose, +t.dataset.i),
      dblT: () => { const c = t.dataset.c; ui.dblSel = ui.dblSel || []; ui.dblSel.includes(c) ? ui.dblSel.splice(ui.dblSel.indexOf(c), 1) : ui.dblSel.push(c); render(); },
      dblDone: () => { const sel = (ui.dblSel || []).slice(); ui.dblSel = []; act(gameOf(ui.st).double, sel); },
      trixPass: () => act(gameOf(ui.st).trixPlay, null),
      fbRetry: () => fbInit(),
      board: () => openBoard(g), hist: () => openHistory(g),
      closeBoard: () => { ui.board = null; render(); }, closeHist: () => { ui.hist = null; render(); },
      sound: () => { prof.mute = !prof.mute; saveProf(); actx(); if (!prof.mute) SFX.card(); render(); },
      tmenu: () => { ui.pop = { k: 'tmenu' }; render(); },
      rotate: () => setOrient(ui.orient === 'portrait' ? 'landscape' : 'portrait')
    }[a] || (() => {}))();
    return;
  }
  if (t.dataset.di != null && st && st.turn === mySeat() && st.step === 'draw' && !ui.hidden) {
    const i = +t.dataset.di, n = st.discard.length - i;
    if (n === 1) return act(Mor.takeDiscard, i);
    ui.sheet = { title: `تاخد ${n} ورقات من الأرض؟`, opts: [{ label: 'إيه خدهم', run: () => act(Mor.takeDiscard, i) }] }; return render();
  }
  if (t.dataset.meld) {
    const m = st.melds.find(x => x.id === t.dataset.meld); const me = mySeat();
    if (!m || !ui.sel.size || st.turn !== me || st.step !== 'play' || m.team !== Mor.teamOf(me)) return;
    const ids = [...ui.sel], opts = [];
    if (Mor.analyze([...m.cards, ...ids])) opts.push({ label: 'زيد على التنزيلة', run: () => act(Mor.addToMeld, m.id, ids) });
    const sw = ids.length === 1 ? Mor.swapOptions(m, ids[0]) : [];
    if (sw.length) opts.push({ label: sw.some(o => Mor.isJ(o.w)) ? 'فكّ الجوكر بهالورقة' : 'بدّل الـ2', run: () => act(Mor.swapWild, m.id, ids[0]) });
    if (!opts.length) return toast('الورق المختار ما بيركب على هالتنزيلة');
    if (opts.length === 1) return opts[0].run();
    ui.sheet = { title: 'شو بدك تعمل؟', opts }; return render();
  }
  if (t.dataset.seat != null && st && ui.mode !== 'local' && isHost() && +t.dataset.seat !== mySeat()) {
    const s = +t.dataset.seat;
    ui.sheet = { title: esc(st.names[s]), opts: [{ label: st.bots[s] ? 'رجّعه يلعب بنفسه' : 'خلّي بوت يلعب مكانه', run: () => toggleBot(s) }] }; render();
  }
});
$app.addEventListener('input', e => {
  if (e.target.id === 'vol') { prof.vol = +e.target.value; ls.set('mor-prof', prof); actx(); clearTimeout(render.vt); render.vt = setTimeout(SFX.card, 120); }
});
$app.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const id = e.target.id;
  if (id === 'jcode') joinAny(e.target.value);
  if (id === 'chatin') sendChat();
  if (id === 'dmin') sendDM();
  if (id === 'fcode') addFriend();
  if (id === 'obn') $app.querySelector('[data-a=obDone]')?.click();
});
$app.addEventListener('pointerdown', e => { if (e.target.closest('#mic')) { e.preventDefault(); recStart(); } });
document.addEventListener('pointerup', () => { if (rec.mr) recStop(); });
setInterval(() => { if (Object.values(ui.bubbles).some(b => Date.now() - b.t < 4600 && Date.now() - b.t > 4000)) render(); }, 600);
window.addEventListener('popstate', () => {});

// ---------- boot ----------
(() => {
  let id = ls.get('mor-uid'); if (!id) { id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); ls.set('mor-uid', id); }
  uid = id;
  try { native && native.setOrientation(ui.orient); } catch (e) {}
  ready = true; render();
  if (window.FB) fbInit();
  setInterval(() => { if (!fb.ready && !fb.tried && window.FB && !ui.mode) fbInit(); }, 20000);
})();
