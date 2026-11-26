// ---------- Mafia ----------
const RICON = { mafia: '🕴️', town: '🏠', doctor: '💉', detective: '🔎', notmafia: '✔︎' };
const RDESC = {
  mafia: 'كل ليلة بتختاروا إنت وجماعتك مين تقتلوا. بالنهار خبّي حالك واتّهم غيرك.',
  town: 'ما عندك شي بالليل. بالنهار ركّز، ناقش، وصوّت على اللي شاكك فيه.',
  doctor: 'كل ليلة بتختار حدا تحميه من القتل (فيك تحمي حالك). ما فيك تحمي نفس الشخص ليلتين ورا بعض.',
  detective: 'كل ليلة بتسأل عن لاعب وبتعرف إذا هو مافيا ولا لأ. استعمل المعلومة بذكاء.'
};
const mafCfg = () => (ui.mafCfg = ui.mafCfg || Object.assign({ mafia: 0, doctor: true, detective: true, reveal: true, narr: false }, ls.get('mor-mafia') || {}));
function saveMafCfg() { ls.set('mor-mafia', ui.mafCfg); }
async function startMafia() {
  const c = mafCfg(), narrator = c.narr ? uid : null;
  const ps = ui.players.filter(p => p.id !== narrator).map(p => ({ id: p.id, name: p.name, av: p.av }));
  let st;
  try { st = Mafia.newGame(ps, { mafia: c.mafia || Mafia.defMafia(ps.length), doctor: c.doctor && ps.length >= 5, detective: c.detective && ps.length >= 5, reveal: c.reveal, narrator }); }
  catch (e) { return toast(e.message); }
  st.deal = Date.now(); ui.st = { v: (ui.room && ui.room.sv) || 0 }; ui.mafSel = null; ui.mafPeek = false;
  await commit(st);
}
function mafiaLobby() {
  const host = isHost(), c = mafCfg(), n = ui.players.length - (c.narr ? 1 : 0);
  const m = Math.min(c.mafia || Mafia.defMafia(Math.max(n, 4)), Mafia.maxMafia(Math.max(n, 4)));
  const tog = (k, label, hint) => `<button class="li" data-a="mafT" data-k="${k}" style="width:100%;text-align:start"><div class="t"><b>${label}</b><span>${hint}</span></div><span class="chip ${c[k] ? 'on' : ''}">${c[k] ? 'مفعّل' : 'لأ'}</span></button>`;
  const shown = esc(ui.code === location.hostname ? (myIp() || ui.code) : ui.code);
  return `<div class="scr"><div class="in">
  <div class="hdr"><button class="ic" data-a="exit" aria-label="اطلع">${ICON.x}</button><h1>الغرفة</h1>
    <button class="ic" data-a="chat" aria-label="الدردشة">${ICON.chat}${ui.unread ? `<span class="badge">${ui.unread}</span>` : ''}</button>
    <button class="ic ${vc.on ? (vc.muted ? 'vmute' : 'von') : ''}" data-a="voice" aria-label="المكالمة">${vc.on ? (vc.muted || !vc.stream ? ICON.micoff : ICON.mic) : ICON.phone}</button></div>
  <div class="card" style="text-align:center;padding:12px">${ui.mode === 'lan' ? `<div class="muted">رفقاتك بيكتبوا هالعنوان بـ «دخول برمز»</div><div class="roomcode" style="font-size:32px;letter-spacing:2px">${shown}</div>`
    : `<div class="muted">كود الغرفة</div><div class="roomcode">${esc(ui.code)}</div><div class="acts" style="justify-content:center;margin-top:8px"><button class="btn alt sm" data-a="copyCode">${ICON.copy} انسخ</button>${online() ? `<button class="btn sm" data-a="invitePop">${ICON.invite} ادعي أصدقاء</button>` : ''}</div>`}</div>
  <div class="gsel">${gameIcon(MafiaG, 26)}<div style="flex:1"><div class="muted">اللعبة</div><b>المافيا</b><div class="muted" style="font-size:12px">كل اللي بالغرفة بيلعبوا</div></div>${host ? `<button class="btn alt sm" data-a="gamePick">غيّر</button>` : ''}<button class="ic" data-a="rules" data-g="mafia" aria-label="القوانين">${ICON.info}</button></div>
  <div class="card"><h2>اللاعبين <span class="muted">(${ui.players.length})</span></h2><div class="mgrid">${ui.players.map(p => `<div class="mp">${avatarHTML(p.av, p.name)}<span class="nm">${esc(p.name)}${ui.room && p.id === ui.room.host ? ' 👑' : ''}</span>${c.narr && host && p.id === uid ? '<span class="tag">الراوي</span>' : ''}</div>`).join('')}</div>
    ${ui.players.length < 4 ? `<div class="muted" style="margin-top:8px">بدكم 4 على الأقل${c.narr ? ' غير الراوي' : ''}. ادعي رفقاتك بالكود.</div>` : ''}</div>
  ${host ? `<div class="card"><h2>الإعدادات</h2>
    <div class="li"><div class="t"><b>الراوي</b><span>${c.narr ? 'إنت بتدير اللعبة وبتشوف كل الأدوار' : 'التطبيق بيدير الليل والنهار لحاله'}</span></div><div class="seg" style="width:150px"><button class="${c.narr ? '' : 'on'}" data-a="mafNarr" data-v="0">التطبيق</button><button class="${c.narr ? 'on' : ''}" data-a="mafNarr" data-v="1">أنا</button></div></div>
    <div class="li"><div class="t"><b>عدد المافيا</b><span>${n >= 4 ? `لـ ${n} لاعبين` : ''}</span></div><button class="ic" data-a="mafN" data-d="-1" aria-label="أقل">−</button><b style="font:600 22px Oswald,sans-serif;min-width:26px;text-align:center">${m}</b><button class="ic" data-a="mafN" data-d="1" aria-label="أكتر">+</button></div>
    ${tog('doctor', '💉 الطبيب', 'من 5 لاعبين وطالع')}${tog('detective', '🔎 المحقق', 'من 5 لاعبين وطالع')}${tog('reveal', 'كشف الدور', 'لما حدا يطلع، دوره بيبيّن للكل')}
    <div class="acts"><button class="btn wide" data-a="mafStart" ${n >= 4 ? '' : 'disabled'}>🎭 وزّع الأدوار وابدأ</button></div></div>`
    : `<p class="muted" style="text-align:center">صاحب الغرفة بيجهّز الإعدادات وبيبلّش. فتّحوا المكالمة للنقاش 🎙️</p>`}
  </div></div>${ui.chatOpen ? chatPanel() : ''}${pops()}${ui.confirmExit ? exitBox() : ''}${toastHTML()}`;
}
function mafiaView() {
  const st = ui.st, me = Mafia.P(st, uid), narr = st.cfg.narrator === uid, host = isHost();
  const ctl = st.cfg.narrator ? narr : host;
  const ph = st.phase, night = ph === 'night' || ph === 'roles';
  const ev = st.events[st.events.length - 1];
  const title = { roles: 'توزيع الأدوار', night: 'الليلة ' + st.day, day: 'النهار ' + st.day, vote: 'التصويت', result: 'النتيجة', over: 'خلصت اللعبة' }[ph];
  const role = me ? me.role : null;
  const counts = ph === 'vote' || ph === 'result' ? (ph === 'vote' ? Mafia.tally(st) : (ev && ev.counts) || {}) : {};
  const mafiaPicks = {}; if (ph === 'night' && (role === 'mafia' || narr)) for (const [k, v] of Object.entries(st.night.kill)) (mafiaPicks[v] = mafiaPicks[v] || []).push(k);
  const myPick = ph === 'night' && me ? (role === 'mafia' ? st.night.kill[uid] : role === 'doctor' ? st.night.save : role === 'detective' ? st.night.check : null) : ph === 'vote' && me ? st.votes[uid] : null;
  const canPick = me && me.alive && ((ph === 'night' && ['mafia', 'doctor', 'detective'].includes(role) && !(role === 'detective' && st.night.check)) || ph === 'vote');
  const sel = ui.mafSel;
  const tile = p => {
    const isMe = p.id === uid, seen = isMe && st.phase !== 'over' ? null : Mafia.seenRole(st, uid, p);
    const picked = sel === p.id || (!sel && myPick === p.id);
    const voters = ph === 'vote' && (narr || !me || !me.alive || true) ? Object.entries(st.votes).filter(([, t]) => t === p.id).map(([v]) => Mafia.P(st, v)).filter(Boolean) : [];
    return `<button class="mp ${p.alive ? '' : 'dead'} ${picked ? 'pick' : ''} ${isMe ? 'me' : ''}" data-a="mafPick" data-p="${p.id}" ${canPick && p.alive ? '' : 'data-off="1"'}>
      ${avatarHTML(p.av, p.name, '', p.alive ? '' : '<span class="skull">☠</span>')}
      <span class="nm">${esc(p.name)}${isMe ? ' (إنت)' : ''}</span>
      ${seen ? `<span class="rtag r-${seen}">${RICON[seen]} ${seen === 'notmafia' ? 'مش مافيا' : Mafia.ROLE[seen]}</span>` : ''}
      ${ph === 'roles' && (narr || host) ? `<span class="tag">${st.ready[p.id] ? 'جاهز ✓' : 'عم يشوف دوره'}</span>` : ''}
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
    if (ev.kind === 'night') banner = ev.victim ? `☠ انقتل بالليل <b>${who(ev.victim)}</b>${rl(ev.role)}` : ev.saved ? '💉 المافيا حاولوا يقتلوا حدا، بس الطبيب أنقذه!' : '🌅 ليلة هادية، ما حدا انقتل';
    else banner = ev.out ? `⚖️ الأغلبية طلّعت <b>${who(ev.out)}</b>${rl(ev.role)}` : ev.tie ? '⚖️ تعادل بالأصوات، ما حدا طلع' : '⚖️ ما حدا طلع';
  }
  let panel = '';
  const myChecks = (role === 'detective' && st.checks[uid]) || [];
  if (ph === 'over') {
    panel = `<div class="mban big">${st.winner === 'town' ? '🏠 ربح الشعب!' : '🕴️ ربحت المافيا!'}</div>
      ${host ? `<div class="acts"><button class="btn" data-a="backRoom">رجوع للغرفة</button><button class="btn alt" data-a="mafStart">نفس اللعبة كمان مرة</button></div>` : '<p class="muted">صاحب الغرفة بيرجّعكم للغرفة.</p>'}`;
  } else if (ph === 'roles') {
    if (narr) panel = `<p class="muted">إنت الراوي: شايف كل الأدوار. لما الكل يجهز، ابدأ الليلة.</p><div class="acts"><button class="btn wide" data-a="mafNext">🌙 ابدأ الليلة الأولى</button></div>`;
    else if (me) {
      const mates = role === 'mafia' ? st.players.filter(p => p.role === 'mafia' && p.id !== uid) : [];
      panel = `<button class="rolecard ${ui.mafPeek ? 'open' : ''}" data-a="mafPeek">${ui.mafPeek ? `<span class="ri">${RICON[role]}</span><b>${Mafia.ROLE[role]}</b><span>${RDESC[role]}</span>${mates.length ? `<span class="mates">جماعتك: ${mates.map(p => esc(p.name)).join('، ')}</span>` : ''}` : '<span class="ri">🎴</span><b>اكبس لتشوف دورك</b><span>خبّي الشاشة عن اللي حدّك</span>'}</button>
      <div class="acts"><button class="btn wide" data-a="mafReady" ${st.ready[uid] ? 'disabled' : ''}>${st.ready[uid] ? 'ناطرين الباقيين…' : 'شفت دوري، جاهز'}</button></div>`;
    } else panel = '<p class="muted">بتتفرّج على هاللعبة.</p>';
  } else if (ph === 'night') {
    const need = [];
    if (Mafia.alive(st).some(p => p.role === 'mafia' && !st.night.kill[p.id])) need.push('المافيا');
    if (st.cfg.doctor && Mafia.alive(st).some(p => p.role === 'doctor') && !st.night.save) need.push('الطبيب');
    if (st.cfg.detective && Mafia.alive(st).some(p => p.role === 'detective') && !st.night.check) need.push('المحقق');
    const wait = need.length ? `ناطرين: ${need.join('، ')}` : 'الكل اختار';
    if (narr) panel = `<p class="muted">${wait}. هدف المافيا: <b>${esc((Mafia.P(st, Mafia.mafiaTarget(st)) || {}).name || '—')}</b></p><div class="acts"><button class="btn wide" data-a="mafNext">☀️ خلّص الليل واعلن</button></div>`;
    else if (!me || !me.alive) panel = `<p class="muted">${me ? 'إنت طلعت من اللعبة، بتتفرّج.' : 'بتتفرّج.'} ${wait}</p>`;
    else if (role === 'town') panel = `<div class="mban">😴 غمّض عيونك… الكل نايم. <span class="muted">${wait}</span></div>`;
    else {
      const ask = { mafia: '🔪 اختار مين تقتلوا الليلة', doctor: '💉 اختار مين بدك تحمي', detective: '🔎 اختار مين بدك تسأل عنه' }[role];
      const last = myChecks.filter(c => c.day === st.day)[0];
      panel = last ? `<div class="mban">${esc(Mafia.P(st, last.id).name)} ${last.mafia ? '<b class="red">مافيا 🕴️</b>' : '<b style="color:var(--ok)">مش مافيا ✔︎</b>'}</div><p class="muted">${wait}</p>`
        : `<div class="mban">${ask}</div><div class="acts"><button class="btn wide" data-a="mafGo" ${sel ? '' : 'disabled'}>${sel ? 'تأكيد: ' + esc(Mafia.P(st, sel).name) : 'اكبس على لاعب'}</button></div><p class="muted">${myPick ? 'اخترت: ' + esc(Mafia.P(st, myPick).name) + ' · ' : ''}${wait}</p>`;
    }
  } else if (ph === 'day') {
    panel = `<p class="muted" style="text-align:center">ناقشوا بالمكالمة أو الدردشة: مين المافيا؟</p>${ctl ? `<div class="acts"><button class="btn wide" data-a="mafVote">⚖️ ابدأ التصويت</button></div>` : '<p class="muted" style="text-align:center">' + (st.cfg.narrator ? 'الراوي' : 'صاحب الغرفة') + ' بيبلّش التصويت.</p>'}`;
  } else if (ph === 'vote') {
    const left = Mafia.alive(st).filter(p => !st.votes[p.id]).length;
    panel = me && me.alive ? `<div class="mban">⚖️ صوّت على اللي شاكك فيه</div><div class="acts"><button class="btn" data-a="mafGo" ${sel ? '' : 'disabled'} style="flex:1">${sel ? 'صوّت على ' + esc(Mafia.P(st, sel).name) : 'اكبس على لاعب'}</button><button class="btn alt" data-a="mafSkip">ما حدا</button></div><p class="muted">${myPick ? 'صوتك: ' + (myPick === 'skip' ? 'ما حدا' : esc(Mafia.P(st, myPick).name)) + ' (فيك تغيّره) · ' : ''}ضل ${left} ما صوّتوا</p>`
      : `<p class="muted">ضل ${left} ما صوّتوا</p>`;
    if (narr) panel += `<div class="acts"><button class="btn wide" data-a="mafNext">خلّص التصويت</button></div>`;
  } else if (ph === 'result') {
    panel = ctl ? `<div class="acts"><button class="btn wide" data-a="mafNight">🌙 الليلة الجاية</button></div>` : '<p class="muted" style="text-align:center">ناطرين الليلة الجاية…</p>';
  }
  const myBadge = me && ph !== 'roles' ? `<button class="mybadge" data-a="mafPeek">${ui.mafPeek ? `${RICON[role]} ${Mafia.ROLE[role]}` : '👁 دوري'}</button>` : narr ? '<span class="mybadge">🎙️ الراوي</span>' : '';
  return `<div class="mafia ${night ? 'night' : 'day'}">
  <div class="top"><button class="ic" data-a="exit" aria-label="اطلع">${ICON.x}</button><div class="mtitle">${night ? '🌙' : '☀️'} ${title}</div>
    <button class="ic" data-a="chat" aria-label="الدردشة">${ICON.chat}${ui.unread ? `<span class="badge">${ui.unread}</span>` : ''}</button>
    <button class="ic ${vc.on ? (vc.muted ? 'vmute' : 'von') : ''}" data-a="voice" aria-label="المكالمة">${vc.on ? (vc.muted || !vc.stream ? ICON.micoff : ICON.mic) : ICON.phone}</button>
    <button class="ic" data-a="tmenu" aria-label="الإعدادات">${ICON.gear}</button></div>
  <div class="mbody">${banner ? `<div class="mban">${banner}</div>` : ''}
    <div class="mgrid">${st.players.map(tile).join('')}</div>
    ${myChecks.length && ph !== 'over' ? `<div class="muted" style="text-align:center;margin-top:6px">🔎 اللي سألت عنهم: ${myChecks.map(c => esc(Mafia.P(st, c.id).name) + (c.mafia ? ' 🕴️' : ' ✔︎')).join(' · ')}</div>` : ''}
  </div>
  <div class="mpanel">${panel}${myBadge}</div>
  ${ui.chatOpen && social() ? chatPanel() : ''}${pops()}${ui.confirmExit ? exitBox() : ''}${toastHTML()}</div>`;
}
const mafiaActs = {
  mafT: t => { const c = mafCfg(); c[t.dataset.k] = !c[t.dataset.k]; saveMafCfg(); render(); },
  mafNarr: t => { mafCfg().narr = t.dataset.v === '1'; saveMafCfg(); render(); },
  mafN: t => { const c = mafCfg(), n = Math.max(4, ui.players.length - (c.narr ? 1 : 0)); c.mafia = Math.min(Mafia.maxMafia(n), Math.max(1, (c.mafia || Mafia.defMafia(n)) + +t.dataset.d)); saveMafCfg(); render(); },
  mafStart: () => startMafia(),
  mafPeek: () => { ui.mafPeek = !ui.mafPeek; SFX.tap(); render(); },
  mafReady: () => { ui.mafPeek = false; actR(Mafia.setReady, uid); },
  mafPick: t => { if (t.dataset.off) return; ui.mafSel = ui.mafSel === t.dataset.p ? null : t.dataset.p; SFX.tap(); render(); },
  mafGo: () => { const s = ui.mafSel; if (!s) return; ui.mafSel = null; actR(ui.st.phase === 'vote' ? Mafia.vote : Mafia.nightAct, uid, s); },
  mafSkip: () => { ui.mafSel = null; actR(Mafia.vote, uid, 'skip'); },
  mafNext: () => { ui.mafSel = null; actR(Mafia.narrNext, uid); },
  mafVote: () => actR(Mafia.startVote, uid, isHost()),
  mafNight: () => { ui.mafSel = null; actR(Mafia.nextFromResult, uid, isHost()); }
};
