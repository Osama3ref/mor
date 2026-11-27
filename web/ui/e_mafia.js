// ---------- Mafia ----------
const RICON = { mafia: '🕴️', town: '🏠', doctor: '💉', detective: '🔎', notmafia: '✔︎' };
const RDESC = {
  mafia: 'كل ليلة تختار مع فريقك من تقتلون. وفي النهار أخفِ نفسك واتّهم غيرك.',
  town: 'ليس لك شيء في الليل. في النهار ركّز وناقش وصوّت على من تشكّ فيه.',
  doctor: 'كل ليلة تختار شخصاً تحميه من القتل (يمكنك حماية نفسك)، ولا يمكنك حماية الشخص نفسه ليلتين متتاليتين.',
  detective: 'كل ليلة تسأل عن لاعب لتعرف إن كان من المافيا أم لا. استعمل المعلومة بذكاء.'
};
const mafCfg = () => (ui.mafCfg = ui.mafCfg || Object.assign({ mafia: 0, doctor: true, detective: true, reveal: true, narr: false, stepTime: 30, voice: ui.mode === 'lan' ? 'host' : 'all' }, ls.get('mor-mafia') || {}));
function saveMafCfg() { ls.set('mor-mafia', ui.mafCfg); }
async function startMafia() {
  const c = mafCfg(), narrator = c.narr ? uid : null;
  const ps = ui.players.filter(p => p.id !== narrator).map(p => ({ id: p.id, name: p.name, av: p.av }));
  let st;
  try { st = Mafia.newGame(ps, { mafia: c.mafia || Mafia.defMafia(ps.length), doctor: c.doctor && ps.length >= 5, detective: c.detective && ps.length >= 5, reveal: c.reveal, narrator, voice: c.voice, stepTime: c.narr ? 0 : c.stepTime }); }
  catch (e) { return toast(e.message); }
  st.deal = Date.now(); ui.st = { v: (ui.room && ui.room.sv) || 0 }; ui.mafSel = null; ui.mafPeek = false;
  await commit(st);
}
function mafiaLobby() {
  const host = isHost(), c = mafCfg(), n = ui.players.length - (c.narr ? 1 : 0);
  const m = Math.min(c.mafia || Mafia.defMafia(Math.max(n, 4)), Mafia.maxMafia(Math.max(n, 4)));
  const tog = (k, label, hint) => `<button class="li" data-a="mafT" data-k="${k}" style="width:100%;text-align:start"><div class="t"><b>${label}</b><span>${hint}</span></div><span class="chip ${c[k] ? 'on' : ''}">${c[k] ? 'مفعّل' : 'لا'}</span></button>`;
  const shown = esc(ui.code === location.hostname ? (myIp() || ui.code) : ui.code);
  return `<div class="scr"><div class="in">
  <div class="hdr"><button class="ic" data-a="exit" aria-label="اخرج">${ICON.x}</button><h1>الغرفة</h1>
    <button class="ic" data-a="chat" aria-label="الدردشة">${ICON.chat}${ui.unread ? `<span class="badge">${ui.unread}</span>` : ''}</button>
    ${voiceBtns()}</div>
  <div class="card" style="text-align:center;padding:12px">${ui.mode === 'lan' ? `<div class="muted">يكتب أصدقاؤك هذا العنوان في «دخول برمز»</div><div class="roomcode" style="font-size:32px;letter-spacing:2px">${shown}</div><div class="acts" style="justify-content:center;margin-top:8px"><button class="btn sm" data-a="shareRoom">${ICON.share} شارك الدعوة</button></div>`
    : `<div class="muted">رمز الغرفة</div><div class="roomcode">${esc(ui.code)}</div><div class="acts" style="justify-content:center;margin-top:8px"><button class="btn sm" data-a="shareRoom">${ICON.share} شارك الدعوة</button><button class="btn alt sm" data-a="copyCode">${ICON.copy} انسخ</button>${online() ? `<button class="btn sm" data-a="invitePop">${ICON.invite} ادعُ أصدقاء</button>` : ''}</div>`}</div>
  <div class="gsel">${gameIcon(MafiaG, 26)}<div style="flex:1"><div class="muted">اللعبة</div><b>المافيا</b><div class="muted" style="font-size:12px">يلعب كل من في الغرفة</div></div>${host ? `<button class="btn alt sm" data-a="gamePick">غيّر</button>` : ''}<button class="ic" data-a="rules" data-g="mafia" aria-label="القوانين">${ICON.info}</button></div>
  <div class="card"><h2>اللاعبين <span class="muted">(${ui.players.length})</span></h2><div class="mgrid">${ui.players.map(p => `<div class="mp">${avatarHTML(pav(p), p.name)}<span class="nm">${esc(p.name)}${ui.room && p.id === ui.room.host ? ' 👑' : ''}</span>${c.narr && host && p.id === uid ? '<span class="tag">الراوي</span>' : ''}</div>`).join('')}</div>
    ${ui.players.length < 4 ? `<div class="muted" style="margin-top:8px">تحتاجون إلى 4 على الأقل${c.narr ? ' غير الراوي' : ''}. ادعُ أصدقاءك بالرمز.</div>` : ''}</div>
  ${host ? `<div class="card"><h2>الإعدادات</h2>
    <div class="li"><div class="t"><b>الراوي</b><span>${c.narr ? 'أنت تدير اللعبة وترى كل الأدوار' : 'يدير التطبيق الليل والنهار تلقائياً'}</span></div><div class="seg" style="width:150px"><button class="${c.narr ? '' : 'on'}" data-a="mafNarr" data-v="0">التطبيق</button><button class="${c.narr ? 'on' : ''}" data-a="mafNarr" data-v="1">أنا</button></div></div>
    <div class="li"><div class="t"><b>عدد المافيا</b><span>${n >= 4 ? `لـ ${n} لاعبين` : ''}</span></div><button class="ic" data-a="mafN" data-d="-1" aria-label="أقل">−</button><b style="font:600 22px Oswald,sans-serif;min-width:26px;text-align:center">${m}</b><button class="ic" data-a="mafN" data-d="1" aria-label="أكثر">+</button></div>
    ${c.narr ? '' : `<div class="li"><div class="t"><b>🔊 صوت الراوي</b><span>${{ all: 'يُسمع على أجهزة الجميع (للعب عن بُعد)', host: 'يُسمع على جهازك فقط (إذا كنتم في غرفة واحدة)', off: 'بلا صوت' }[c.voice]}</span></div><div class="seg" style="width:190px"><button class="${c.voice === 'all' ? 'on' : ''}" data-a="mafVoice" data-v="all">الكل</button><button class="${c.voice === 'host' ? 'on' : ''}" data-a="mafVoice" data-v="host">جهازي</button><button class="${c.voice === 'off' ? 'on' : ''}" data-a="mafVoice" data-v="off">بلا</button></div></div>`}
    ${c.narr ? '' : `<div class="li"><div class="t"><b>⏱️ وقت كل دور في الليل</b><span>إذا انتهى الوقت ينتقل الراوي إلى الدور التالي</span></div><div class="seg" style="width:200px">${[0, 20, 30, 45].map(v => `<button class="${(c.stepTime || 0) === v ? 'on' : ''}" data-a="mafStepT" data-v="${v}">${v ? v + 'ث' : 'بلا'}</button>`).join('')}</div></div>`}
    ${tog('doctor', '💉 الطبيب', 'من 5 لاعبين فأكثر')}${tog('detective', '🔎 المحقق', 'من 5 لاعبين فأكثر')}${tog('reveal', 'كشف الدور', 'عندما يخرج أحد، يظهر دوره للجميع')}
    <div class="acts"><button class="btn wide" data-a="mafStart" ${n >= 4 ? '' : 'disabled'}>🎭 وزّع الأدوار وابدأ</button></div></div>`
    : `<p class="muted" style="text-align:center">يجهّز صاحب الغرفة الإعدادات ويبدأ. افتحوا المكالمة للنقاش 🎙️</p>`}
  </div></div>${ui.chatOpen ? chatPanel() : ''}${pops()}${ui.confirmExit ? exitBox() : ''}${toastHTML()}`;
}
function mafiaView() {
  const st = ui.st, me = Mafia.P(st, uid), narr = st.cfg.narrator === uid, host = isHost();
  const ctl = st.cfg.narrator ? narr : host;
  const ph = st.phase, night = ph === 'night' || ph === 'roles';
  const ev = st.events[st.events.length - 1];
  const title = { roles: 'توزيع الأدوار', night: 'الليلة ' + st.day, day: 'النهار ' + st.day, vote: 'التصويت', result: 'النتيجة', over: 'انتهت اللعبة' }[ph];
  const role = me ? me.role : null;
  const counts = ph === 'vote' || ph === 'result' ? (ph === 'vote' ? Mafia.tally(st) : (ev && ev.counts) || {}) : {};
  const mafiaPicks = {}; if (ph === 'night' && (role === 'mafia' || narr)) for (const [k, v] of Object.entries(st.night.kill)) (mafiaPicks[v] = mafiaPicks[v] || []).push(k);
  const myPick = ph === 'night' && me ? (role === 'mafia' ? st.night.kill[uid] : role === 'doctor' ? st.night.save : role === 'detective' ? st.night.check : null) : ph === 'vote' && me ? st.votes[uid] : null;
  const canPick = me && me.alive && ((ph === 'night' && role === st.night.step && !(role === 'detective' && st.night.check)) || ph === 'vote');
  const sel = ui.mafSel;
  const tile = p => {
    const isMe = p.id === uid, seen = isMe && st.phase !== 'over' ? null : Mafia.seenRole(st, uid, p);
    const picked = sel === p.id || (!sel && myPick === p.id);
    const voters = ph === 'vote' && (narr || !me || !me.alive || true) ? Object.entries(st.votes).filter(([, t]) => t === p.id).map(([v]) => Mafia.P(st, v)).filter(Boolean) : [];
    return `<button class="mp ${p.alive ? '' : 'dead'} ${picked ? 'pick' : ''} ${isMe ? 'me' : ''}" data-a="mafPick" data-p="${p.id}" ${canPick && p.alive ? '' : 'data-off="1"'}>
      ${avatarHTML(pav(p), p.name, '', p.alive ? '' : '<span class="skull">☠</span>')}
      <span class="nm">${esc(p.name)}${isMe ? ' (أنت)' : ''}</span>
      ${seen ? `<span class="rtag r-${seen}">${RICON[seen]} ${seen === 'notmafia' ? 'ليس مافيا' : Mafia.ROLE[seen]}</span>` : ''}
      ${ph === 'roles' && (narr || host) ? `<span class="tag">${st.ready[p.id] ? 'جاهز ✓' : 'يطّلع على دوره'}</span>` : ''}
      ${counts[p.id] ? `<span class="vcnt">${counts[p.id]}</span>` : ''}
      ${mafiaPicks[p.id] ? `<span class="mk">🔪${mafiaPicks[p.id].length > 1 ? '×' + mafiaPicks[p.id].length : ''}</span>` : ''}
      ${narr && ph === 'night' && st.night.save === p.id ? '<span class="mk" style="left:auto;right:-4px">💉</span>' : ''}
      ${voters.length && ph === 'vote' ? `<span class="voters">${voters.map(v => esc(v.name)).join('، ')}</span>` : ''}
    </button>`;
  };
  let banner = '';
  if (ev && (ph === 'day' || ph === 'vote' || ph === 'result' || ph === 'over')) {
    const who = id => esc((Mafia.P(st, id) || {}).name || '');
    const rl = r => (r && (st.cfg.reveal || ph === 'over') ? ` وكان <b>${RICON[r]} ${Mafia.ROLE[r]}</b>` : '');
    if (ev.kind === 'night') banner = ev.victim ? `☠ قُتل ليلاً <b>${who(ev.victim)}</b>${rl(ev.role)}` : ev.saved ? '💉 حاولت المافيا قتل أحدهم، لكن الطبيب أنقذه!' : '🌅 ليلة هادئة، لم يُقتل أحد';
    else banner = ev.out ? `⚖️ أخرجت الأغلبية <b>${who(ev.out)}</b>${rl(ev.role)}` : ev.tie ? '⚖️ تعادلت الأصوات، ولم يخرج أحد' : '⚖️ لم يخرج أحد';
  }
  let panel = '';
  const myChecks = (role === 'detective' && st.checks[uid]) || [];
  if (ph === 'over') {
    panel = `<div class="mban big">${st.winner === 'town' ? '🏠 فاز الشعب!' : '🕴️ فازت المافيا!'}</div>
      ${host ? `<div class="acts"><button class="btn" data-a="backRoom">العودة إلى الغرفة</button><button class="btn alt" data-a="mafStart">اللعبة نفسها مرة أخرى</button></div>` : '<p class="muted">سيعيدكم صاحب الغرفة إلى الغرفة.</p>'}`;
  } else if (ph === 'roles') {
    if (narr) panel = `<p class="muted">أنت الراوي وترى كل الأدوار. عندما يجهز الجميع، ابدأ الليلة.</p><div class="acts"><button class="btn wide" data-a="mafNext">🌙 ابدأ الليلة الأولى</button></div>`;
    else if (me) {
      const mates = role === 'mafia' ? st.players.filter(p => p.role === 'mafia' && p.id !== uid) : [];
      panel = `<button class="rolecard ${ui.mafPeek ? 'open' : ''}" data-a="mafPeek">${ui.mafPeek ? `<span class="ri">${RICON[role]}</span><b>${Mafia.ROLE[role]}</b><span>${RDESC[role]}</span>${mates.length ? `<span class="mates">فريقك: ${mates.map(p => esc(p.name)).join('، ')}</span>` : ''}` : '<span class="ri">🎴</span><b>اضغط لترى دورك</b><span>أخفِ الشاشة عمّن بجانبك</span>'}</button>
      <div class="acts"><button class="btn wide" data-a="mafReady" ${st.ready[uid] ? 'disabled' : ''}>${st.ready[uid] ? 'بانتظار الآخرين…' : 'رأيت دوري، أنا جاهز'}</button></div>`;
    } else panel = '<p class="muted">أنت تشاهد هذه اللعبة.</p>';
  } else if (ph === 'night') {
    const step = st.night.step, SN = { mafia: 'المافيا', doctor: 'الطبيب', detective: 'المحقق', done: '' };
    const left = mafLeft(st), wait = (step === 'done' ? 'انتهى الجميع من الاختيار' : `الدور الآن على: ${SN[step]}`) + (left >= 0 && step !== 'done' ? ` · <span class="tmr" style="position:static;display:inline-grid" data-maft>${left}</span>` : '');
    const myStep = me && me.alive && role === step;
    if (narr) panel = `<p class="muted">${wait}. هدف المافيا: <b>${esc((Mafia.P(st, Mafia.mafiaTarget(st)) || {}).name || '—')}</b></p><div class="acts"><button class="btn wide" data-a="mafNext">${step === 'done' ? '☀️ أعلن الصباح' : '⏭️ التالي'}</button></div>`;
    else if (!me || !me.alive) panel = `<p class="muted">${me ? 'خرجت من اللعبة، وأنت الآن تشاهد.' : 'أنت تشاهد.'} ${wait}</p>`;
    else if (!myStep) {
      const last = myChecks.filter(c => c.day === st.day)[0];
      panel = (last ? `<div class="mban">${esc(Mafia.P(st, last.id).name)} ${last.mafia ? '<b class="red">من المافيا 🕴️</b>' : '<b style="color:var(--ok)">ليس من المافيا ✔︎</b>'}</div>` : '') + `<div class="mban">😴 أغمض عينيك… <span class="muted">${wait}</span></div>`;
    } else {
      const ask = { mafia: '🔪 اختر من ستقتلون الليلة', doctor: '💉 اختر من تريد أن تحميه', detective: '🔎 اختر من تريد التحقق منه' }[role];
      panel = `<div class="mban">${ask}</div><div class="acts"><button class="btn wide" data-a="mafGo" ${sel ? '' : 'disabled'}>${sel ? 'تأكيد: ' + esc(Mafia.P(st, sel).name) : 'اضغط على لاعب'}</button></div><p class="muted">${myPick ? 'اخترت: ' + esc(Mafia.P(st, myPick).name) : ''}</p>`;
    }
  } else if (ph === 'day') {
    panel = `<p class="muted" style="text-align:center">تناقشوا في المكالمة أو الدردشة: من المافيا؟</p>${ctl ? `<div class="acts"><button class="btn wide" data-a="mafVote">⚖️ ابدأ التصويت</button></div>` : '<p class="muted" style="text-align:center">' + (st.cfg.narrator ? 'الراوي' : 'صاحب الغرفة') + ' يبدأ التصويت.</p>'}`;
  } else if (ph === 'vote') {
    const left = Mafia.alive(st).filter(p => !st.votes[p.id]).length;
    panel = me && me.alive ? `<div class="mban">⚖️ صوّت على من تشكّ فيه</div><div class="acts"><button class="btn" data-a="mafGo" ${sel ? '' : 'disabled'} style="flex:1">${sel ? 'صوّت على ' + esc(Mafia.P(st, sel).name) : 'اضغط على لاعب'}</button><button class="btn alt" data-a="mafSkip">لا أحد</button></div><p class="muted">${myPick ? 'صوتك: ' + (myPick === 'skip' ? 'لا أحد' : esc(Mafia.P(st, myPick).name)) + ' (يمكنك تغييره) · ' : ''}بقي ${left} لم يصوّتوا</p>`
      : `<p class="muted">بقي ${left} لم يصوّتوا</p>`;
    if (narr) panel += `<div class="acts"><button class="btn wide" data-a="mafNext">أنهِ التصويت</button></div>`;
  } else if (ph === 'result') {
    panel = ctl ? `<div class="acts"><button class="btn wide" data-a="mafNight">🌙 الليلة التالية</button></div>` : '<p class="muted" style="text-align:center">بانتظار الليلة التالية…</p>';
  }
  const myBadge = me && ph !== 'roles' ? `<button class="mybadge" data-a="mafPeek">${ui.mafPeek ? `${RICON[role]} ${Mafia.ROLE[role]}` : '👁 دوري'}</button>` : narr ? '<span class="mybadge">🎙️ الراوي</span>' : '';
  return `<div class="mafia ${night ? 'night' : 'day'}">
  <div class="top"><button class="ic" data-a="exit" aria-label="اخرج">${ICON.x}</button><div class="mtitle">${night ? '🌙' : '☀️'} ${title}</div>
    <button class="ic" data-a="chat" aria-label="الدردشة">${ICON.chat}${ui.unread ? `<span class="badge">${ui.unread}</span>` : ''}</button>
    ${voiceBtns()}
    <button class="ic" data-a="tmenu" aria-label="الإعدادات">${ICON.gear}</button></div>
  <div class="mbody">${banner ? `<div class="mban">${banner}</div>` : ''}
    <div class="mgrid">${st.players.map(tile).join('')}</div>
    ${myChecks.length && ph !== 'over' ? `<div class="muted" style="text-align:center;margin-top:6px">🔎 من تحقّقت منهم: ${myChecks.map(c => esc(Mafia.P(st, c.id).name) + (c.mafia ? ' 🕴️' : ' ✔︎')).join(' · ')}</div>` : ''}
  </div>
  <div class="mpanel">${panel}${myBadge}</div>
  ${ui.chatOpen && social() ? chatPanel() : ''}${pops()}${ui.confirmExit ? exitBox() : ''}${toastHTML()}</div>`;
}
const mafiaActs = {
  mafT: t => { const c = mafCfg(); c[t.dataset.k] = !c[t.dataset.k]; saveMafCfg(); render(); },
  mafNarr: t => { mafCfg().narr = t.dataset.v === '1'; saveMafCfg(); render(); },
  mafN: t => { const c = mafCfg(), n = Math.max(4, ui.players.length - (c.narr ? 1 : 0)); c.mafia = Math.min(Mafia.maxMafia(n), Math.max(1, (c.mafia || Mafia.defMafia(n)) + +t.dataset.d)); saveMafCfg(); render(); },
  mafStart: () => startMafia(),
  mafStepT: t => { mafCfg().stepTime = +t.dataset.v; saveMafCfg(); render(); },
  mafVoice: t => { mafCfg().voice = t.dataset.v; saveMafCfg(); if (t.dataset.v !== 'off') speak('صوت الراوي جاهز'); render(); },
  mafPeek: () => { ui.mafPeek = !ui.mafPeek; SFX.tap(); render(); },
  mafReady: () => { ui.mafPeek = false; actR(Mafia.setReady, uid); },
  mafPick: t => { if (t.dataset.off) return; ui.mafSel = ui.mafSel === t.dataset.p ? null : t.dataset.p; SFX.tap(); render(); },
  mafGo: () => { const s = ui.mafSel; if (!s) return; ui.mafSel = null; actR(ui.st.phase === 'vote' ? Mafia.vote : Mafia.nightAct, uid, s); },
  mafSkip: () => { ui.mafSel = null; actR(Mafia.vote, uid, 'skip'); },
  mafNext: () => { ui.mafSel = null; actR(Mafia.narrNext, uid); },
  mafVote: () => actR(Mafia.startVote, uid, isHost()),
  mafNight: () => { ui.mafSel = null; actR(Mafia.nextFromResult, uid, isHost()); }
};

// ---------- narrator voice ----------
function speak(text) {
  if (prof.mute) return;
  try { if (native && native.speak) { native.speak(text); return; } } catch (e) {}
  try {
    const u = new SpeechSynthesisUtterance(text); u.lang = 'ar-SA'; u.rate = 0.9; u.volume = prof.vol;
    const v = speechSynthesis.getVoices().find(x => /^ar/i.test(x.lang)); if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) {}
}
const STEP_LINE = {
  mafia: 'المافيا، افتحوا أعينكم واختاروا ضحيتكم.',
  doctor: 'المافيا، أغمضوا أعينكم. الطبيب، افتح عينيك واختر من تريد أن تحميه.',
  detective: 'المحقق، افتح عينيك واختر من تريد التحقق منه.',
  done: 'الجميع، أغمضوا أعينكم.'
};
function mafiaNarrate(prev, st) {
  if (st.cfg.narrator || st.cfg.voice === 'off' || (st.cfg.voice === 'host' && !isHost())) return;
  const nm = id => (Mafia.P(st, id) || {}).name || '';
  const role = r => (st.cfg.reveal ? '، وكان ' + Mafia.ROLE[r] : '');
  const lines = [];
  if (st.phase === 'night' && (prev.phase !== 'night' || prev.day !== st.day)) lines.push('حلّ الليل. الجميع يغمض عينيه.', STEP_LINE.mafia);
  else if (st.phase === 'night' && prev.night && prev.night.step !== st.night.step) {
    if (st.night.step === 'detective' && prev.night.step === 'doctor') lines.push('الطبيب، أغمض عينيك.');
    if (st.night.step === 'detective' && prev.night.step === 'mafia') lines.push('المافيا، أغمضوا أعينكم.');
    lines.push(STEP_LINE[st.night.step]);
  }
  const ev = st.events[st.events.length - 1];
  if (st.phase === 'day' && prev.phase === 'night') {
    lines.push('أشرق الصباح. الجميع يفتح عينيه.');
    if (ev) lines.push(ev.victim ? 'قُتل الليلة ' + nm(ev.victim) + role(ev.role) + '.' : ev.saved ? 'حاولت المافيا القتل، لكن الطبيب أنقذ الضحية!' : 'كانت ليلة هادئة، لم يُقتل أحد.');
    if (st.phase === 'day') lines.push('تناقشوا الآن: من هم المافيا؟');
  }
  if (st.phase === 'vote' && prev.phase !== 'vote') lines.push('حان وقت التصويت. صوّتوا على من تشكّون فيه.');
  if ((st.phase === 'result' || st.phase === 'over') && prev.phase === 'vote' && ev && ev.kind === 'vote') lines.push(ev.out ? 'قررت الأغلبية إخراج ' + nm(ev.out) + role(ev.role) + '.' : ev.tie ? 'تعادلت الأصوات، ولم يخرج أحد.' : 'لم يخرج أحد.');
  if (st.phase === 'over' && prev.phase !== 'over') {
    if (prev.phase === 'night' && ev && ev.victim) lines.push('قُتل الليلة ' + nm(ev.victim) + '.');
    lines.push(st.winner === 'town' ? 'انتهت اللعبة. فاز الشعب!' : 'انتهت اللعبة. فازت المافيا!');
  }
  lines.forEach(speak);
}
let mafSkipKey = null;
const mafClock = { key: null, at: 0 };
function mafLeft(st) {
  if (st.game !== 'mafia' || st.phase !== 'night' || !st.cfg.stepTime) return -1;
  return Math.max(0, Math.ceil((mafClock.at + st.cfg.stepTime * 1000 - Date.now()) / 1000));
}
function mafiaAuto(st) {
  if (st.game !== 'mafia' || st.phase !== 'night' || st.cfg.narrator) return;
  const key = st.deal + ':' + st.day + ':' + st.night.step;
  if (mafClock.key !== key) { mafClock.key = key; mafClock.at = Date.now(); }
  if (!isHost() || mafSkipKey === key) return;
  // a role whose players are all dead is still called (so nobody learns who died), then skipped after a natural pause;
  // a living role gets the time the host chose
  const empty = Mafia.stepEmpty(st);
  if (!empty && !st.cfg.stepTime) return;
  mafSkipKey = key;
  const wait = empty ? 5000 + Math.random() * 3000 : st.cfg.stepTime * 1000;
  setTimeout(() => { if (ui.st && ui.st.game === 'mafia' && ui.st.phase === 'night' && ui.st.night.step === st.night.step && ui.st.day === st.day) actR(Mafia.skipStep, uid, true); }, wait);
}
setInterval(() => { const st = ui.st; if (!st || st.game !== 'mafia') return; const n = mafLeft(st); document.querySelectorAll('[data-maft]').forEach(el => { el.textContent = n; el.classList.toggle('low', n <= 5); }); }, 500);
