// ---------- rendering: table ----------
function seatHTML(st, s, me, cls = '') {
  const b = ui.bubbles[s] && Date.now() - ui.bubbles[s].t < 4000 ? ui.bubbles[s] : null;
  const name = st.names[s];
  return `<div class="seatv ${st.turn === s && st.phase === 'play' ? 'on' : ''} ${cls}" data-seat="${s}" style="--tc:${TC[s % 2]}">${tmrBadge(s)}
    ${b ? `<div class="bubble">${esc(b.text)}</div>` : ''}
    ${avatarHTML(seatAv(st, s), name, '', `<span class="cnt">${st.hands[s].length}</span>`)}
    <div><div class="nm">${esc(name)}</div>${st.pending[s] ? '<span class="tag">مور</span>' : ''}${st.seats && vc.members.includes(st.seats[s]) ? '<span class="tag" style="color:var(--b)">في المكالمة</span>' : ''}${st.declared && st.declared.seat === s ? `<span class="tag" style="color:var(--a)">${st.declared.kind === 'mor' ? 'أعلن المور' : 'أعلن الضمان'}</span>` : ''}</div></div>`;
}
function meldHTML(m, canTap, them) {
  const a = Mor.analyze(m.cards), v = Mor.meldValue(m);
  return `<div class="meld mini ${canTap ? 'tap' : ''} ${them ? 'them' : ''}" data-meld="${m.id}"><span class="val ${v ? '' : 'z'}">${v || m.cards.length}</span>${m.cards.map(id => cardHTML(id, a && a.wild.includes(id) ? 'w' : '')).join('')}</div>`;
}
function game() {
  const st = ui.st, me = mySeat(), base = me >= 0 ? me : 0, myT = Mor.teamOf(base);
  const myTurn = st.phase === 'play' && st.turn === me && !ui.hidden;
  const g = [Mor.ground(st, 0), Mor.ground(st, 1)];
  const hand = me >= 0 && !ui.hidden ? handOrder(me, st.hands[me]) : [];
  for (const id of [...ui.sel]) if (!hand.includes(id)) ui.sel.delete(id);
  const nSel = ui.sel.size, R = (base + 1) % 4, P = (base + 2) % 4, L = (base + 3) % 4;
  const zone = t => { const ms = st.melds.filter(m => m.team === t); return `<div class="zone"><div class="zl"><span>${t === myT ? 'تنزيلاتنا' : 'تنزيلاتهم'}</span><b>${g[t]}</b></div><div class="melds">${ms.length ? ms.map(m => meldHTML(m, myTurn && st.step === 'play' && t === myT && nSel > 0, t !== myT)).join('') : '<span class="empty">لا يوجد بعد</span>'}</div></div>`; };
  const canDraw = myTurn && st.step === 'draw';
  const piles = `<div class="piles"><div class="pile ${canDraw && st.stock.length ? 'can' : ''} ${st.stock.length ? '' : 'gone'}" data-a="${canDraw && st.stock.length ? 'draw' : ''}">${cardHTML('back')}<span class="n">${st.stock.length}</span><span>السحبة</span></div>
    ${[0, 1].map(k => `<div class="pile ${st.mor[k] ? '' : 'gone'}">${cardHTML('back')}<span>${st.morBy[k] != null ? (st.morBy[k] === myT ? 'لنا' : 'لهم') : 'مور'}</span></div>`).join('')}</div>`;
  const topK = st.discard.length + ':' + st.discard[st.discard.length - 1], dropNew = ui.topK && ui.topK !== topK && st.discard.length; ui.topK = topK;
  const disc = `<div class="disc ${canDraw ? 'can' : ''}" id="disc">${st.discard.map((id, i) => cardHTML(id, dropNew && i === st.discard.length - 1 ? 'drop' : '', `data-di="${i}"`)).join('') || '<span class="empty">الأرض فارغة</span>'}</div>`;
  let status = '', acts = '';
  const last = st.log[st.log.length - 1] || '';
  if (st.phase === 'play') {
    if (me < 0) status = `تشاهد · دور ${esc(st.names[st.turn])} <span class="last">${esc(last)}</span>`;
    else if (!myTurn) status = `دور ${esc(st.names[st.turn])}${st.bots && st.bots[st.turn] ? ' (بوت)' : ''} <span class="last">${esc(last)}</span>`;
    else if (st.step === 'draw') { status = st.stock.length ? 'دورك: اسحب من السحبة أو خذ من الأرض' : 'آخر دور! خذ من الأرض'; if (st.stock.length) acts = `<button class="btn sm" data-a="draw">اسحب</button>`; }
    else if (st.step === 'play') {
      const decl = st.declared && st.declared.seat === me ? st.declared.kind : null;
      status = !hand.length ? 'أنهيت أوراقك!' : decl ? (decl === 'mor' ? 'أعلنت: تريد المور' : 'أعلنت: تريد الضمان') : 'نزّل أو ارمِ ورقة';
      acts = `<button class="btn sm" data-a="meld" ${nSel >= 3 ? '' : 'disabled'}>نزّل${nSel ? ' (' + nSel + ')' : ''}</button><button class="btn alt sm" data-a="discard" ${nSel === 1 ? '' : 'disabled'}>ارمِ</button>`;
      if (!st.melded && !decl && hand.length) acts += `<button class="btn sky sm" data-a="declMor">أريد المور</button><button class="btn sky sm" data-a="declClose">أريد الضمان</button>`;
      if (decl && !st.melded) acts += `<button class="btn alt sm" data-a="undecl">إلغاء الإعلان</button>`;
      if (!hand.length && Mor.okMor(st, me)) acts += `<button class="btn sm" data-a="morNow">خذ المور</button>`;
      if (!hand.length && Mor.okClose(st, me)) acts += `<button class="btn red sm" data-a="close">اضمن</button>`;
    }
  }
  const fresh = st.got && st.got.seat === me && st.turn === me ? st.got.ids : [];
  const chatBtn = social() ? `<button class="ic" data-a="chat" aria-label="الدردشة">${ICON.chat}${ui.unread ? `<span class="badge">${ui.unread}</span>` : ''}</button>
    ${voiceBtns()}` : '';
  return `<div class="game">
  <div class="top"><button class="ic" data-a="exit" aria-label="خروج">${ICON.x}</button>
    <div class="score"><span class="sp"><span class="dot" style="background:var(--a)"></span>${myT === 0 ? 'نحن' : 'هم'} <b>${st.scores[0]}</b></span><span class="sp"><span class="dot" style="background:var(--b)"></span>${myT === 1 ? 'نحن' : 'هم'} <b>${st.scores[1]}</b></span><span class="sp">ج ${st.round + 1}</span></div>
    ${chatBtn}<button class="ic" data-a="tmenu" aria-label="الإعدادات">${ICON.gear}</button></div>
  <div class="partner">${seatHTML(st, P, me)}</div>
  <div class="mid">${seatHTML(st, R, me)}<div class="board">${zone(1 - myT)}<div class="strip">${piles}${disc}</div>${zone(myT)}</div>${seatHTML(st, L, me)}</div>
  <div class="bar">${st.finalTurn && st.phase === 'play' ? `<div class="banner">انتهت السحبة: الدور الأخير من الأرض فقط</div>` : ''}<div class="status">${tmrBadge(me)}${status}</div><div class="acts2">${acts}${me >= 0 && hand.length ? `<button class="btn alt sm" data-a="sort">رتّب</button>` : ''}</div></div>
  <div class="handwrap"><div class="hand" id="hand">${hand.map(id => cardHTML(id, (ui.sel.has(id) ? 'sel ' : '') + (fresh.includes(id) ? 'fresh ' : '') + (st.pending[me] && st.turn !== me ? 'lock' : ''))).join('')}</div></div>
  </div>${overlays(me)}`;
}
function endActs(st, can) {
  const room = ui.mode === 'lan' || ui.mode === 'fb';
  if (st.phase !== 'over') return can ? `<div class="acts"><button class="btn" data-a="nextRound">الجولة التالية</button><button class="btn alt" data-a="exit">خروج</button></div>` : '<p class="muted">بانتظار اللاعبين…</p>';
  if (!room) return `<div class="acts"><button class="btn" data-a="newMatch">لعبة جديدة</button><button class="btn alt" data-a="exit">خروج</button></div>`;
  if (isHost()) return `<div class="acts"><button class="btn" data-a="backRoom">العودة إلى الغرفة واختيار لعبة</button><button class="btn alt" data-a="newMatch">اللعبة نفسها مرة أخرى</button></div>`;
  return '<p class="muted">سيعيدكم صاحب الغرفة إليها لتختاروا اللعبة التالية.</p><div class="acts"><button class="btn alt sm" data-a="exit">خروج</button></div>';
}
function overlays(me) {
  const st = ui.st; let h = '';
  if (ui.confirmExit) h += exitBox();
  else if (ui.mode === 'local' && ui.hidden && st.phase === 'play' && !st.bots[st.turn]) h += `<div class="ov cen handoff"><div class="box" style="text-align:center" role="dialog" aria-modal="true" aria-label="تسليم الجهاز"><h2>دور ${esc(st.names[st.turn])}</h2><p class="muted">سلّموه الجهاز، ولا ينظر أحد.</p><button class="btn" data-a="reveal">أظهر أوراقي</button><div class="acts" style="justify-content:center"><button class="btn alt sm" data-a="exit">حفظ وخروج</button></div></div></div>`;
  else if (st.phase === 'play' && st.turn === me && st.step === 'choice') {
    h += `<div class="ov cen"><div class="box"><h2>رميت آخر ورقة</h2><div class="acts">${Mor.okMor(st, me) ? '<button class="btn" data-a="chooseMor">خذ المور (منقطع)</button>' : ''}${Mor.okClose(st, me) ? '<button class="btn red" data-a="close">اضمن</button>' : ''}</div></div></div>`;
  } else if (ui.sheet) {
    h += `<div class="ov" data-a="noSheet"><div class="box" data-stop="1"><h2>${ui.sheet.title}</h2><div class="acts">${ui.sheet.opts.map((o, i) => `<button class="btn ${i ? 'alt' : ''}" data-a="sheet" data-i="${i}">${o.label}</button>`).join('')}<button class="btn alt" data-a="noSheet">إلغاء</button></div></div></div>`;
  } else if (st.phase === 'roundEnd' || st.phase === 'over') {
    const s = st.summary || { ground: [0, 0], bonus: [0, 0], notes: [] };
    const can = ui.mode === 'local' || me >= 0;
    h += `<div class="ov cen"><div class="box"><h2>${st.phase === 'over' ? 'فاز ' + TEAM[st.winner] + '!' : s.void ? 'تُعاد الجولة' : 'انتهت الجولة'}</h2>
    <table><tr><th></th><th style="color:var(--a)">${TEAM[0]}</th><th style="color:var(--b)">${TEAM[1]}</th></tr>
    <tr><td>المشاريع</td><td>${s.ground[0]}</td><td>${s.ground[1]}</td></tr>
    <tr><td>زيادة/خصم</td><td>${s.bonus[0]}</td><td>${s.bonus[1]}</td></tr>
    <tr><td><b>المجموع</b></td><td><b>${st.scores[0]}</b></td><td><b>${st.scores[1]}</b></td></tr></table>
    <p class="muted">${s.notes.map(esc).join('<br>')}</p>
    ${endActs(st, can)}</div></div>`;
  }
  if (ui.chatOpen && social()) h += chatPanel();
  h += pops();
  if (ui.toast) h += `<div class="toast" role="status">${esc(ui.toast)}</div>`;
  return h;
}


// ---------- rendering: trick games (Tarneeb, Trix) ----------
const liveHs = (st, i) => (st.hs && !['handEnd', 'over'].includes(st.phase) ? st.hs[i] : 0);
function seatT(st, s, me) {
  const G = gameOf(st), b = ui.bubbles[s] && Date.now() - ui.bubbles[s].t < 4000 ? ui.bubbles[s] : null, name = st.names[s];
  const act = G.actor(st) === s;
  let info = '';
  if (st.game === 'tarneeb41') info = `طلب ${st.bids[s] ?? '–'} · أكل ${st.tricks[s]}`;
  else if (st.game === 'tarneeb61') info = `أكل ${st.tricks[s]}${st.passed && st.passed[s] && st.phase === 'bid' ? ' · باس' : ''}`;
  else info = `${st.scores[s] + liveHs(st, s)}`;
  const tags = [];
  if (G.trixFamily && st.owner === s) tags.push('<span class="tag" style="color:var(--a)">المملكة</span>');
  if (st.dealer === s && !G.trixFamily) tags.push('<span class="tag">موزّع</span>');
  if (st.game === 'tarneeb61' && st.bid && st.bid.seat === s) tags.push(`<span class="tag" style="color:var(--a)">طالب ${st.bid.val}</span>`);
  if (st.finished && st.finished.includes(s)) tags.push(`<span class="tag" style="color:var(--a)">أنهِ ${st.finished.indexOf(s) + 1}</span>`);
  if (st.seats && vc.members.includes(st.seats[s])) tags.push('<span class="tag" style="color:var(--b)">في المكالمة</span>');
  return `<div class="seatv ${act ? 'on' : ''}" data-seat="${s}" style="--tc:${G.teams || st.partner ? TC[s % 2] : 'var(--a)'}">${tmrBadge(s)}
    ${b ? `<div class="bubble">${esc(b.text)}</div>` : ''}
    ${avatarHTML(seatAv(st, s), name, '', `<span class="cnt">${st.hands[s].length}</span>`)}
    <div><div class="nm">${esc(name)}</div><div class="sinfo">${info}</div>${tags.join('')}</div>${dblFor(st, s)}</div>`;
}
function dblFor(st, s) {
  if (!st.doubled || st.phase === 'choose' || st.phase === 'double') return '';
  const ids = [];
  if (st.doubled.K === s) ids.push('H13');
  for (const [c, by] of Object.entries(st.doubled.Q || {})) if (by === s) ids.push(c);
  const live = ids.filter(c => st.hands[s].includes(c));
  return live.length ? `<div class="dblrow" aria-label="مدبّل">${live.map(c => cardHTML(c)).join('')}</div>` : '';
}
function trickTable() {
  const st = ui.st, G = gameOf(st), me = mySeat(), base = me >= 0 ? me : 0, myT = base % 2;
  const a = G.actor(st), myAct = a === me && me >= 0 && !ui.hidden;
  const hand = me >= 0 && !ui.hidden ? Games.sortIds(st.hands[me]) : [];
  const legalSet = myAct && st.phase === 'play' ? Games.legal(st, me) : myAct && st.phase === 'trix' ? G.trixLegal(st, me) : null;
  const R = (base + 1) % 4, P = (base + 2) % 4, L = (base + 3) % 4;
  const dk = st.handNo + ':' + st.deal + ':' + me, dealNew = ui.dealtKey !== dk; ui.dealtKey = dk;
  if (ui.armed && !hand.includes(ui.armed)) ui.armed = null;
  const teamSum = t => st.game === 'tarneeb61' ? st.tscores[t] : st.scores[t] + st.scores[t + 2] + liveHs(st, t) + liveHs(st, t + 2);
  const pills = (G.teams || st.partner)
    ? `<span class="sp"><span class="dot" style="background:var(--a)"></span>${myT === 0 ? 'نحن' : 'هم'} <b>${teamSum(0)}</b></span><span class="sp"><span class="dot" style="background:var(--b)"></span>${myT === 1 ? 'نحن' : 'هم'} <b>${teamSum(1)}</b></span>`
    : `<span class="sp">لك <b>${me >= 0 ? st.scores[me] + liveHs(st, me) : 0}</b></span>`;
  // info chips
  const chips = [];
  if (st.trump) chips.push(`<span class="ichip">الطرنيب <b class="${'HD'.includes(st.trump) ? 'red' : ''}">${SUIT[st.trump]}</b> ${Games.SN[st.trump]}</span>`);
  const ctext = c => { const x = Games.cr(c); return `<b class="${'HD'.includes(x.s) ? 'red' : ''}" dir="ltr">${RK[x.r] || x.r}${SUIT[x.s]}</b>`; };
  if (st.game === 'tarneeb41' && st.reveal) chips.push(`<span class="ichip">الورقة المقلوبة ${ctext(st.reveal)}</span>`);
  if (st.game === 'tarneeb61') chips.push(`<span class="ichip">${st.bid ? 'الطلب <b>' + st.bid.val + '</b>' : 'مزايدة'} · لـ ${G.target}</span>`);
  if (st.game === 'tarneeb41') chips.push(`<span class="ichip">مجموع الطلبات <b>${st.bids.reduce((x, y) => x + (y || 0), 0)}</b> · لـ 41</span>`);
  if (G.trixFamily) {
    chips.push(`<span class="ichip">مملكة <b>${st.kingdom + 1}</b>/4 · ${esc(st.names[st.owner])}</span>`);
    if (st.contract && st.phase !== 'choose') chips.push(`<span class="ichip"><b>${Games.CN[st.contract]}</b></span>`);
  }
  // centre
  let centre;
  if (st.phase === 'trix' || (G.trixFamily && st.contract === 'trix' && st.phase !== 'choose')) {
    centre = `<div class="ladders">${['S', 'H', 'C', 'D'].map(su => {
      const Lr = st.ladder[su]; let cards = '';
      if (Lr) for (let r = Lr[0]; r <= Lr[1]; r++) cards += cardHTML(su + r);
      return `<div class="lad"><span class="ls ${'HD'.includes(su) ? 'red' : ''}">${SUIT[su]}</span><div class="mini lrow">${cards || '<span class="empty">بانتظار الشبّ</span>'}</div></div>`;
    }).join('')}</div>`;
  } else {
    const posOf = x => (x === base ? 'pb' : x === R ? 'pr' : x === P ? 'pt' : 'pl');
    const doneKey = st.handNo + ':' + st.tricks.reduce((x, y) => x + y, 0);
    let cls = '', delay = 0, hideAll = false;
    if (st.trickDone) {
      const t0 = ui.doneAt[doneKey] || (ui.doneAt[doneKey] = Date.now()), el = Date.now() - t0;
      if (el > 2700) hideAll = true; else { cls = 'collect c-' + posOf(st.lastWinner); delay = 2000 - el; setTimeout(render, 2760 - el); }
    }
    const slot = (x, pos) => {
      const t = hideAll ? null : st.trick.find(y => y.seat === x); let extra = '';
      if (t) { const k = st.handNo + ':' + t.card; if (!ui.seenCard.has(k)) { ui.seenCard.add(k); extra = 'in-' + pos; } }
      return `<div class="slot ${pos} ${st.trickDone && st.lastWinner === x && !hideAll ? 'win' : ''}">${t ? cardHTML(t.card, extra) : ''}</div>`;
    };
    const pt = st.prevTrick && (!st.trickDone || hideAll) ? st.prevTrick : (st.trickDone && hideAll ? st.prevTrick : null);
    const lastBox = pt && st.phase === 'play' ? `<div class="lastt"><span>آخر لطشة · ${esc(st.names[pt.winner])}</span><div class="mini lrow">${pt.cards.map(t => cardHTML(t.card)).join('')}</div></div>` : '';
    centre = `${lastBox}<div class="trickbox ${cls}" style="--cd:${delay}ms">${slot(P, 'pt')}${slot(L, 'pl')}${slot(R, 'pr')}${slot(base, 'pb')}</div>`;
  }
  // status + actions
  let status = '', acts = '';
  const nm = s => esc(st.names[s]);
  if (a >= 0 && !myAct) status = { bid: 'يزايد', trump: 'يختار الطرنيب', choose: 'يختار الطلب', double: 'يقرّر الدبل', play: 'دوره', trix: 'دوره' }[st.phase] + ': ' + nm(a) + (st.bots[a] ? ' (بوت)' : '');
  if (myAct) {
    if (st.phase === 'bid' && st.game === 'tarneeb61') {
      const min = st.bid ? st.bid.val + 1 : 7; status = 'كم تطلب؟';
      for (let v = min; v <= 13; v++) acts += `<button class="btn sm" data-a="bid" data-n="${v}">${v}</button>`;
      acts += `<button class="btn alt sm" data-a="bid" data-n="0">باس</button>`;
    } else if (st.phase === 'bid') {
      status = 'كم لمّة ستأخذ؟';
      for (let v = 2; v <= 13; v++) acts += `<button class="btn ${v <= 5 ? '' : 'alt'} sm bidb" data-a="bid" data-n="${v}">${v}</button>`;
    } else if (st.phase === 'trump') {
      status = 'اختر الطرنيب';
      acts = ['S', 'H', 'C', 'D'].map(su => `<button class="btn alt sm suitb ${'HD'.includes(su) ? 'red' : ''}" data-a="trump" data-s="${su}">${SUIT[su]} ${Games.SN[su]}</button>`).join('');
    } else if (st.phase === 'choose') {
      status = 'مملكتك: اختر الطلب';
      acts = G.contracts.map((c, i) => st.used.includes(i) ? '' : `<button class="btn sm" data-a="choose" data-i="${i}">${Games.CN[c]}</button>`).join('');
    } else if (st.phase === 'double') {
      const el = G.dblCards(st, me); ui.dblSel = (ui.dblSel || []).filter(x => el.includes(x));
      status = 'هل تريد الدبل؟ اختر الأوراق التي تريد دبلها';
      acts = `<div class="mini dbl">${el.map(c => `<span data-a="dblT" data-c="${c}" class="${ui.dblSel.includes(c) ? 'dsel' : ''}">${cardHTML(c)}</span>`).join('')}</div>
        <button class="btn sm" data-a="dblDone">${ui.dblSel.length ? 'دبّل (' + ui.dblSel.length + ')' : 'بدون دبل'}</button>`;
    } else if (st.phase === 'play') status = 'دورك: العب ورقة';
    else if (st.phase === 'trix') { status = legalSet.length ? 'دورك: نزّل ورقة على الأرض' : 'لا تملك ورقة مناسبة'; if (!legalSet.length) acts = `<button class="btn sm" data-a="trixPass">باس</button>`; }
  }
  const last = st.log[st.log.length - 1] || '';
  const chatBtn = social() ? `<button class="ic" data-a="chat" aria-label="الدردشة">${ICON.chat}${ui.unread ? `<span class="badge">${ui.unread}</span>` : ''}</button>
    ${voiceBtns()}` : '';
  return `<div class="game tg">
  <div class="top"><button class="ic" data-a="exit" aria-label="خروج">${ICON.x}</button><div class="score">${pills}</div>${chatBtn}<button class="ic" data-a="tmenu" aria-label="الإعدادات">${ICON.gear}</button></div>
  <div class="partner">${seatT(st, P, me)}</div>
  <div class="mid">${seatT(st, R, me)}<div class="board tboard"><div class="chips">${chips.join('')}</div>${centre}<div class="last">${esc(last)}</div></div>${seatT(st, L, me)}</div>
  <div class="bar"><div class="status">${tmrBadge(me)}${status}</div>${acts ? `<div class="acts2">${acts}</div>` : ''}</div>
  <div class="handwrap"><div class="hand" id="hand">${hand.map((id, i) => cardHTML(id, (legalSet && !legalSet.includes(id) ? 'dim ' : '') + (ui.armed === id ? 'sel ' : '') + (dealNew ? 'deal' : ''), dealNew ? `style="animation-delay:${i * 45}ms"` : '')).join('')}</div>${myAct && (st.phase === 'play' || st.phase === 'trix') && legalSet && legalSet.length ? '<div class="hint">اضغط مرتين على الورقة أو اسحبها إلى الأعلى لتلعبها</div>' : ''}</div>
  </div>${overlays2(me)}`;
}
function overlays2(me) {
  const st = ui.st, G = gameOf(st); let h = '';
  if (ui.confirmExit) h += exitBox();
  else if (ui.mode === 'local' && ui.hidden && G.actor(st) >= 0 && !st.bots[G.actor(st)]) h += `<div class="ov cen handoff"><div class="box" style="text-align:center" role="dialog" aria-modal="true" aria-label="تسليم الجهاز"><h2>دور ${esc(st.names[G.actor(st)])}</h2><p class="muted">سلّموه الجهاز، ولا ينظر أحد.</p><button class="btn" data-a="reveal">أظهر أوراقي</button><div class="acts" style="justify-content:center"><button class="btn alt sm" data-a="exit">حفظ وخروج</button></div></div></div>`;
  else if (st.phase === 'handEnd' || st.phase === 'over') {
    const S = st.summary || { rows: [], notes: [] };
    const cols = S.kind === 'team' ? [TEAM[0], TEAM[1]] : st.names;
    let title = 'انتهت الجولة';
    if (st.phase === 'over') title = st.winner != null ? 'فاز ' + TEAM[st.winner] + '!' : 'فاز ' + st.names[st.winnerSeat] + '!';
    const teamRow = S.kind === 'players' && (G.teams || st.partner) ? `<tr><td>مجموع الفريق</td>${[0, 1, 2, 3].map(i => `<td><b>${st.scores[i % 2] + st.scores[i % 2 + 2]}</b></td>`).join('')}</tr>` : '';
    h += `<div class="ov cen"><div class="box"><h2>${title}</h2>
    <div class="scroll"><table><tr><th></th>${cols.map((c, i) => `<th style="color:${S.kind === 'team' ? TC[i] : (G.teams || st.partner ? TC[i % 2] : 'inherit')}">${esc(c)}</th>`).join('')}</tr>
    ${S.rows.map(r => `<tr><td>${esc(r[0])}</td>${r.slice(1).map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}${teamRow}</table></div>
    <p class="muted">${(S.notes || []).map(esc).join('<br>')}</p>
    ${endActs(st, ui.mode === 'local' || me >= 0)}</div></div>`;
  }
  if (ui.chatOpen && social()) h += chatPanel();
  h += pops();
  if (ui.toast) h += `<div class="toast" role="status">${esc(ui.toast)}</div>`;
  return h;
}

function chatPanel() { return `<div class="ov" data-a="chatClose" style="background:rgba(0,0,0,.3)"></div><div class="chat"><div class="row" style="justify-content:space-between"><b>الدردشة</b>${vc.on ? `<button class="chip" data-a="callPop">🎙️ المكالمة</button>` : `<button class="chip on" data-a="voice">انضم إلى المكالمة</button>`}<button class="ic" data-a="chatClose" aria-label="إغلاق">${ICON.x}</button></div>
    <div class="msgs" id="msgs" data-stop="1">${ui.chat.map(m => `<div class="msg ${m.id === uid ? 'me' : ''}"><small>${esc(m.name)}</small>${m.audio ? `<button class="chip" data-a="play" data-m="${m.mid}">▶ رسالة صوتية</button>` : esc(m.text)}</div>`).join('') || '<div class="muted">لا توجد رسائل بعد</div>'}</div>
    <div class="row"><input id="chatin" class="grow" placeholder="اكتب رسالة" maxlength="200"><button class="ic" data-a="send" aria-label="أرسل">${ICON.send}</button><button class="mic ${rec.mr ? 'rec' : ''}" id="mic" aria-label="اضغط مطوّل وسجّل">${ICON.mic}</button></div>
    <div class="muted">اضغط مطوّلاً على الميكروفون وسجّل، وارفع إصبعك للإرسال.</div></div>`; }