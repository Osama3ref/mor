// ---------- Coup ----------
const CICON = { duke: '👑', assassin: '🗡️', captain: '⚓', ambassador: '🕊️', contessa: '💃' };
const CABIL = { duke: 'ضريبة +3 · يمنع المساعدة', assassin: 'اغتيال بـ 3', captain: 'يسرق 2 · يمنع السرقة', ambassador: 'تبديل الأوراق · يمنع السرقة', contessa: 'تمنع الاغتيال' };
const AICON = { income: '🪙', aid: '🤝', coup: '💥', tax: '👑', assassinate: '🗡️', steal: '⚓', exchange: '🕊️' };
function ccard(ch, opts = {}) {
  return `<button class="ccard c-${ch} ${opts.dead ? 'dead' : ''} ${opts.on ? 'on' : ''}" ${opts.a ? `data-a="${opts.a}" data-i="${opts.i}"` : 'tabindex="-1"'}><span class="ce">${CICON[ch]}</span><b>${Coup.CH[ch]}</b><span class="cab">${CABIL[ch]}</span>${opts.dead ? '<span class="cx">✕</span>' : ''}</button>`;
}
async function startCoup() {
  const ps = ui.players.map(p => ({ id: p.id, name: p.name, av: p.av }));
  let st; try { st = Coup.newGame(ps); } catch (e) { return toast(e.message); }
  st.deal = Date.now(); ui.st = { v: (ui.room && ui.room.sv) || 0 }; ui.coupAct = null; ui.coupSel = [];
  await commit(st);
}
function roomHeadHTML(G, note) {
  const host = isHost(), shown = esc(ui.code === location.hostname ? (myIp() || ui.code) : ui.code);
  return `<div class="hdr"><button class="ic" data-a="exit" aria-label="اخرج">${ICON.x}</button><h1>الغرفة</h1>
    <button class="ic" data-a="chat" aria-label="الدردشة">${ICON.chat}${ui.unread ? `<span class="badge">${ui.unread}</span>` : ''}</button>
    ${voiceBtns()}</div>
  <div class="card" style="text-align:center;padding:12px">${ui.mode === 'lan' ? `<div class="muted">يكتب أصدقاؤك هذا العنوان في «دخول برمز»</div><div class="roomcode" style="font-size:32px;letter-spacing:2px">${shown}</div><div class="acts" style="justify-content:center;margin-top:8px"><button class="btn sm" data-a="shareRoom">${ICON.share} شارك الدعوة</button></div>`
    : `<div class="muted">رمز الغرفة</div><div class="roomcode">${esc(ui.code)}</div><div class="acts" style="justify-content:center;margin-top:8px"><button class="btn sm" data-a="shareRoom">${ICON.share} شارك الدعوة</button><button class="btn alt sm" data-a="copyCode">${ICON.copy} انسخ</button>${online() ? `<button class="btn sm" data-a="invitePop">${ICON.invite} ادعُ أصدقاء</button>` : ''}</div>`}</div>
  <div class="gsel">${gameIcon(G, 26)}<div style="flex:1"><div class="muted">اللعبة</div><b>${esc(G.name)}</b><div class="muted" style="font-size:12px">${note}</div></div>${host ? `<button class="btn alt sm" data-a="gamePick">غيّر</button>` : ''}<button class="ic" data-a="rules" data-g="${G.id}" aria-label="القوانين">${ICON.info}</button></div>`;
}
function coupLobby() {
  const host = isHost(), n = ui.players.length;
  return `<div class="scr"><div class="in">${roomHeadHTML(CoupG, 'من 2 إلى 6 لاعبين، يلعب كل من في الغرفة')}
  <div class="card"><h2>اللاعبين <span class="muted">(${n}/6)</span></h2><div class="mgrid">${ui.players.map(p => `<div class="mp">${avatarHTML(pav(p), p.name)}<span class="nm">${esc(p.name)}${ui.room && p.id === ui.room.host ? ' 👑' : ''}</span></div>`).join('')}</div>
    ${n > 6 ? '<div class="muted" style="margin-top:8px">أكثر من 6، يجب أن يخرج أحدكم.</div>' : n < 2 ? '<div class="muted" style="margin-top:8px">تحتاجون إلى لاعبَين على الأقل.</div>' : ''}</div>
  <div class="card"><h2>الشخصيات</h2><div class="cgrid">${Object.keys(Coup.CH).map(c => ccard(c)).join('')}</div><p class="muted">مع كل لاعب ورقتان مخفيتان وقطعتان نقديتان. يمكنك الكذب وادّعاء أي شخصية، ويستطيع الآخرون التشكيك فيك.</p></div>
  ${host ? `<div class="acts"><button class="btn wide" data-a="coupStart" ${n >= 2 && n <= 6 ? '' : 'disabled'}>🃏 وزّع وابدأ</button></div>` : `<p class="muted" style="text-align:center">صاحب الغرفة يبدأ اللعبة. افتحوا المكالمة، فالكذب أمتع بالصوت 😄</p>`}
  </div></div>${ui.chatOpen ? chatPanel() : ''}${pops()}${ui.confirmExit ? exitBox() : ''}${toastHTML()}`;
}
function coupView() {
  const st = ui.st, me = Coup.P(st, uid), turnP = Coup.cur(st), myTurn = st.phase === 'turn' && turnP.id === uid;
  const meAlive = me && Coup.live(me).length;
  const a = st.act, A = a && Coup.ACT[a.k];
  const el = (st.phase === 'respond' || st.phase === 'block') ? Coup.eligible(st) : [];
  const waitingOn = el.filter(x => !st.resp[x]);
  const tgtMode = myTurn && ui.coupAct && Coup.ACT[ui.coupAct].target;
  const others = st.players.filter(p => p.id !== uid);
  const tile = p => {
    const out = !Coup.live(p).length, isTurn = turnP.id === p.id && st.phase !== 'over';
    const canT = tgtMode && !out;
    const waiting = waitingOn.includes(p.id) || (st.phase === 'lose' && st.lose.p === p.id) || (st.phase === 'exchange' && a.by === p.id);
    return `<button class="mp cp ${out ? 'dead' : ''} ${isTurn ? 'turn' : ''} ${ui.coupT === p.id ? 'pick' : ''}" ${canT ? `data-a="coupT" data-p="${p.id}"` : 'tabindex="-1"'}>
      ${avatarHTML(pav(p), p.name)}<span class="nm">${esc(p.name)}</span>
      <span class="coins">🪙 ${p.coins}</span>
      <span class="minic">${p.cards.map(c => c.dead || st.phase === 'over' ? `<i class="c-${c.c} ${c.dead ? 'dead' : ''}">${CICON[c.c]}</i>` : '<i class="hid">?</i>').join('')}</span>
      ${waiting ? '<span class="think">…</span>' : ''}</button>`;
  };
  // prompt and controls
  let prompt = '', ctl = '';
  const who = id => esc((Coup.P(st, id) || {}).name || '');
  const actTxt = a ? `${who(a.by)}: ${AICON[a.k]} ${A.name}${a.target ? ' على ' + who(a.target) : ''}${A.claim ? ` <span class="muted">(يدّعي ${Coup.CH[A.claim]})</span>` : ''}` : '';
  if (st.phase === 'over') {
    prompt = `<div class="mban big">🏆 فاز ${who(st.winner)}!</div>`;
    ctl = isHost() ? `<div class="acts"><button class="btn" data-a="backRoom">العودة إلى الغرفة</button><button class="btn alt" data-a="coupStart">مرة أخرى</button></div>` : '<p class="muted">سيعيدكم صاحب الغرفة إلى الغرفة.</p>';
  } else if (st.phase === 'turn') {
    if (myTurn) {
      const must = me.coins >= 10;
      prompt = `<div class="mban">دورك! ${must ? '<b>معك 10، يجب أن تنفّذ انقلاباً</b>' : 'ماذا تريد أن تفعل؟'}</div>`;
      if (tgtMode) ctl = `<div class="mban">${AICON[ui.coupAct]} ${Coup.ACT[ui.coupAct].name}: اضغط على اللاعب</div><div class="acts"><button class="btn" data-a="coupGo" ${ui.coupT ? '' : 'disabled'} style="flex:1">${ui.coupT ? 'تأكيد على ' + who(ui.coupT) : 'اختر لاعباً'}</button><button class="btn alt" data-a="coupCancel">إلغاء</button></div>`;
      else ctl = `<div class="agrid">${Object.entries(Coup.ACT).map(([k, x]) => { const dis = (must && k !== 'coup') || (x.cost && me.coins < x.cost);
        return `<button class="abtn ${x.claim ? 'c-' + x.claim : ''}" data-a="coupAct" data-k="${k}" ${dis ? 'disabled' : ''}><span>${AICON[k]}</span><b>${x.name}</b><small>${k === 'income' ? '+1' : k === 'aid' ? '+2' : k === 'tax' ? '+3' : k === 'steal' ? 'خذ 2' : k === 'exchange' ? 'بدّل' : '−' + x.cost}${x.claim ? ' · ' + Coup.CH[x.claim] : ''}</small></button>`; }).join('')}</div>`;
    } else prompt = `<div class="mban">دور <b>${who(turnP.id)}</b>…</div>`;
  } else if (st.phase === 'respond') {
    prompt = `<div class="mban">${actTxt}</div>`;
    if (el.includes(uid) && !st.resp[uid]) {
      const canCh = A.claim && !a.challenged, canBl = A.blockBy && (A.anyBlock || a.target === uid);
      ctl = `<div class="acts rs"><button class="btn alt" data-a="coupPass">✔︎ اسمح</button>${canCh ? `<button class="btn red" data-a="coupChal">❗ شكّك</button>` : ''}${canBl ? A.blockBy.map(b => `<button class="btn sky" data-a="coupBlock" data-b="${b}">🛡️ امنع بـ ${Coup.CH[b]}</button>`).join('') : ''}</div>`;
    } else ctl = `<p class="muted">بانتظار: ${waitingOn.map(who).join('، ')}</p>`;
  } else if (st.phase === 'block') {
    prompt = `<div class="mban">${actTxt}<br>🛡️ <b>${who(st.block.by)}</b> يمنع بـ ${CICON[st.block.as]} ${Coup.CH[st.block.as]}</div>`;
    if (el.includes(uid) && !st.resp[uid]) ctl = `<div class="acts rs"><button class="btn alt" data-a="coupPass">✔︎ قبلت المنع</button><button class="btn red" data-a="coupChal">❗ شكّك في المنع</button></div>`;
    else ctl = `<p class="muted">بانتظار: ${waitingOn.map(who).join('، ')}</p>`;
  } else if (st.phase === 'lose') {
    prompt = `<div class="mban">${st.lose.p === uid ? '💔 يجب أن تخسر ورقة. اضغط على إحدى أوراقك' : `${who(st.lose.p)} يختار الورقة التي سيخسرها`} <span class="muted">(${esc(st.lose.why || '')})</span></div>`;
  } else if (st.phase === 'exchange') {
    if (a.by === uid) {
      const sel = ui.coupSel || [];
      prompt = `<div class="mban">🕊️ أبقِ ${st.exch.keep} أوراق وأعِد الباقي</div>`;
      ctl = `<div class="cgrid">${st.exch.opts.map((c, i) => ccard(c, { a: 'coupKeep', i, on: sel.includes(i) })).join('')}</div><div class="acts"><button class="btn wide" data-a="coupExch" ${sel.length === st.exch.keep ? '' : 'disabled'}>احتفظ بها</button></div>`;
    } else prompt = `<div class="mban">${who(a.by)} يبدّل أوراقه 🕊️</div>`;
  }
  const loseMode = st.phase === 'lose' && st.lose.p === uid;
  const mine = me ? `<div class="mine"><div class="cgrid two">${me.cards.map((c, i) => ccard(c.c, { dead: c.dead, a: loseMode && !c.dead ? 'coupLose' : null, i })).join('')}</div><div class="mycoins">🪙 <b>${me.coins}</b>${meAlive ? '' : ' · خرجت من اللعبة، وأنت تشاهد'}</div></div>` : '<p class="muted" style="text-align:center">تشاهد</p>';
  return `<div class="mafia coupv">
  <div class="top"><button class="ic" data-a="exit" aria-label="اخرج">${ICON.x}</button><div class="mtitle">🃏 كو · الجولة ${st.round}</div>
    <button class="ic" data-a="chat" aria-label="الدردشة">${ICON.chat}${ui.unread ? `<span class="badge">${ui.unread}</span>` : ''}</button>
    ${voiceBtns()}
    <button class="ic" data-a="tmenu" aria-label="الإعدادات">${ICON.gear}</button></div>
  <div class="mbody"><div class="mgrid cgrid-p">${others.map(tile).join('')}</div>${prompt}
    <div class="clog">${st.log.slice(-4).map(l => `<div>${esc(l)}</div>`).join('')}</div></div>
  <div class="mpanel">${ctl}${mine}</div>
  ${ui.chatOpen && social() ? chatPanel() : ''}${pops()}${ui.confirmExit ? exitBox() : ''}${toastHTML()}</div>`;
}
const coupActs = {
  coupStart: () => startCoup(),
  coupAct: t => { const k = t.dataset.k; if (Coup.ACT[k].target) { ui.coupAct = k; ui.coupT = null; SFX.tap(); return render(); } actR(Coup.act, uid, k, null); },
  coupT: t => { ui.coupT = t.dataset.p; SFX.tap(); render(); },
  coupGo: () => { const k = ui.coupAct, tg = ui.coupT; ui.coupAct = null; ui.coupT = null; actR(Coup.act, uid, k, tg); },
  coupCancel: () => { ui.coupAct = null; ui.coupT = null; render(); },
  coupPass: () => actR(Coup.pass, uid),
  coupChal: () => actR(Coup.challenge, uid),
  coupBlock: t => actR(Coup.block, uid, t.dataset.b),
  coupLose: t => actR(Coup.loseCard, uid, +t.dataset.i),
  coupKeep: t => { const i = +t.dataset.i, s = ui.coupSel = ui.coupSel || []; s.includes(i) ? s.splice(s.indexOf(i), 1) : s.length < ui.st.exch.keep && s.push(i); render(); },
  coupExch: () => { const s = (ui.coupSel || []).slice(); ui.coupSel = []; actR(Coup.exchange, uid, s); }
};
