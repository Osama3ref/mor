// ---------- rendering: screens ----------
function fan(ids, w = 34) { return `<div class="fanlogo" style="width:${w * 2.1}px;height:${w * 1.75}px">${ids.map((id, i) => cardHTML(id, '', `style="--w:${w}px;left:${i * w * 0.5}px;transform:rotate(${(i - 1) * 13}deg)"`)).join('')}</div>`; }
const toastHTML = () => (ui.toast ? `<div class="toast" role="status">${esc(ui.toast)}</div>` : '');
const sheet = (inner, close = 'closePop', mid = false) => `<div class="ov ${mid ? 'cen' : ''}" data-a="${close}"><div class="box" data-stop="1">${mid ? '' : '<div class="grab"></div>'}${inner}</div></div>`;
const sheetHead = (title, close = 'closePop') => `<div class="row" style="justify-content:space-between;margin-bottom:6px"><h2>${title}</h2><button class="ic" data-a="${close}" aria-label="سكّر">${ICON.x}</button></div>`;
function nav() {
  const fr = friendReqs(), un = unreadChats();
  const b = (t, ic, label, n) => `<button class="${ui.tab === t ? 'on' : ''}" data-a="tab" data-t="${t}">${ic}<span>${label}</span>${n ? `<span class="badge">${n}</span>` : ''}</button>`;
  return `<nav class="nav">${b('home', ICON.home, 'الرئيسية')}${b('friends', ICON.users, 'الأصدقاء', fr)}${b('msgs', ICON.msgs, 'الرسائل', un)}${b('me', ICON.user, 'حسابي')}</nav>`;
}
function meBar() {
  return `<button class="me-bar" data-a="tab" data-t="me" style="width:100%;text-align:start">${avatarHTML(prof.av, prof.name)}<div style="flex:1"><div class="nm">${esc(prof.name || 'ضيف')}</div><div class="muted">${prof.code ? 'ID ' + prof.code : online() ? '' : isServed ? 'بدون إنترنت: الشبكة المحلية متاحة' : ''}</div></div><span class="ic">${ICON.gear}</span></button>`;
}
function onboarding() {
  const sel = ui.obAv || prof.av;
  const [c] = sel.split('|');
  return `<div class="scr"><div class="in">
  <div class="brand">${fan(['H1a', 'S13a', 'J0a'], 44)}<h1>سهرة ورق</h1><div class="muted">مور، طرنيب وتركس مع رفقاتك</div></div>
  <div class="card"><h2>أهلاً فيك! عرّفنا عليك</h2><div class="muted">بتختارهم مرة وحدة، وفيك تغيّرهم بعدين من حسابي.</div>
    <div style="margin-top:12px"><label class="muted" for="obn">اسمك باللعب</label><input id="obn" maxlength="14" autocomplete="nickname" value="${esc(prof.name)}" placeholder="مثلاً: أبو أحمد"></div>
    <div class="muted" style="margin-top:14px">صورتك</div>
    <div class="avpick">${AVG.concat(['A']).slice(0, 10).map(g => `<button data-a="obAv" data-v="${c}|${g}" class="${sel === c + '|' + g ? 'on' : ''}">${avatarHTML(c + '|' + g, prof.name || 'أ')}</button>`).join('')}</div>
    <div class="swatches">${AVC.map((col, i) => `<button data-a="obCol" data-v="${i}" class="${+c === i ? 'on' : ''}" style="background:${col}" aria-label="لون ${i + 1}"></button>`).join('')}</div>
    <div class="acts"><button class="btn wide" data-a="obDone">يلا نلعب</button></div></div>
  </div></div>${toastHTML()}`;
}
function homeTab() {
  const last = ls.get('mor-room');
  const saved = ALL.filter(g => { const s = ls.get(saveKey(g.id)); return s && s.phase !== 'over'; });
  const canCreate = online() || native;
  return `<div class="brand" style="margin:4px 0 0">${fan(['H1a', 'S13a', 'J0a'], 30)}<h1 style="font-size:30px">سهرة ورق</h1></div>
  ${meBar()}
  <button class="big-act main" data-a="newRoom" ${canCreate ? '' : 'disabled'}><span class="bi">${ICON.plus}</span><div><b>إنشاء غرفة</b><span>${canCreate ? 'افتح طاولة وادعي رفقاتك' : 'بدها إنترنت أو التطبيق على الواي فاي'}</span></div></button>
  <button class="big-act" data-a="joinPop"><span class="bi">${ICON.key}</span><div><b>دخول برمز</b><span>عندك كود غرفة من صاحبك؟</span></div></button>
  <button class="big-act" data-a="tab" data-t="solo"><span class="bi">${ICON.bot}</span><div><b>لعب ضد الكمبيوتر</b><span>تدرّب مع بوتات قوية</span></div></button>
  ${last && last.mode ? `<div class="row" style="justify-content:center"><button class="chip" data-a="rejoin">ارجع للغرفة ${esc(last.key)}</button></div>` : ''}
  ${saved.length ? `<div class="muted" style="margin:10px 4px 4px">ألعاب محفوظة</div><div class="resume">${saved.map(g => `<button class="chip" data-a="resume" data-g="${g.id}">كمّل ${esc(g.name)}</button>`).join('')}</div>` : ''}
  ${!native && isServed ? `<button class="btn alt wide" data-a="joinHere" style="margin-top:8px">ادخل غرفة هالمضيف</button>` : ''}`;
}
function gameGrid(action, selected) {
  return `<div class="glist">${ALL.map(g => {
    const saved = action === 'soloPick' && (s => s && s.phase !== 'over')(ls.get(saveKey(g.id)));
    return `<button class="gcard ${selected === g.id ? 'on' : ''}" data-a="${action}" data-g="${g.id}"><span class="info" data-a="rules" data-g="${g.id}" aria-label="القوانين">؟</span>${saved ? '<span class="saved" aria-label="محفوظة"></span>' : ''}${fan(GICON[g.id] || GICON.mor, 30)}<b>${esc(g.name)}</b><span class="muted">${esc(g.sub)}</span></button>`;
  }).join('')}</div>`;
}
function soloTab() {
  return `<div class="hdr"><button class="ic" data-a="tab" data-t="home" aria-label="رجوع">${ICON.back}</button><h1>لعب ضد الكمبيوتر</h1></div>
  <div class="muted">اختار اللعبة. بالألعاب الشراكة البوت شريكك.</div>
  ${gameGrid('soloPick')}
  <div class="card"><h2>على جوال واحد</h2><div class="muted">بتمرّروا الجوال لبعض، وفيك تخلّي بعض الكراسي بوت.</div><div class="acts"><button class="btn alt sm" data-a="passPop">رتّب اللعبة</button></div></div>`;
}
function friendsTab() {
  if (!online()) return `<div class="hdr"><h1>الأصدقاء</h1></div><div class="card empty">الأصدقاء بدهم إنترنت. ${window.FB ? '<div class="acts" style="justify-content:center"><button class="btn alt sm" data-a="fbRetry">جرّب كمان مرة</button></div>' : ''}</div>`;
  const inn = ui.friends.filter(f => f.st === 'in'), ok = ui.friends.filter(f => f.st === 'ok'), out = ui.friends.filter(f => f.st === 'out');
  return `<div class="hdr"><h1>الأصدقاء</h1></div>
  <div class="card"><div class="row"><div style="flex:1"><div class="muted">الـ ID تبعك</div><div class="roomcode" style="font-size:30px;letter-spacing:4px;text-align:start">${esc(prof.code || '…')}</div></div><button class="btn alt sm" data-a="copyId">${ICON.copy} انسخ</button></div>
    <div class="row" style="margin-top:12px"><input id="fcode" class="grow" inputmode="numeric" maxlength="6" placeholder="ID صاحبك" style="direction:ltr;text-align:center"><button class="btn" data-a="addFriend">${ICON.invite} أضف</button></div></div>
  ${inn.length ? `<div class="card"><h2>طلبات صداقة</h2>${inn.map(f => `<div class="li">${avatarHTML(f.av, f.name, 'sm')}<div class="t"><b>${esc(f.name)}</b><span>ID ${esc(f.code || '')}</span></div><button class="btn sm" data-a="accept" data-f="${f.id}">قبول</button><button class="btn ghost sm" data-a="unfriend" data-f="${f.id}">رفض</button></div>`).join('')}</div>` : ''}
  <div class="card"><h2>أصدقائي ${ok.length ? `<span class="muted">(${ok.length})</span>` : ''}</h2>${ok.length ? ok.map(f => `<div class="li">${avatarHTML(f.av, f.name, 'sm')}<div class="t"><b>${esc(f.name)}</b><span>ID ${esc(f.code || '')}</span></div>${ui.mode === 'fb' ? `<button class="btn sm" data-a="invite" data-to="f:${f.id}">ادعوه</button>` : ''}<button class="ic" data-a="dm" data-f="${f.id}" aria-label="رسالة">${ICON.chat}</button><button class="ic" data-a="friendMenu" data-f="${f.id}" aria-label="خيارات">⋯</button></div>`).join('') : '<div class="empty">لسا ما عندك أصدقاء. ابعت الـ ID تبعك لرفقاتك.</div>'}</div>
  ${out.length ? `<div class="card"><h2>طلبات بعتّها</h2>${out.map(f => `<div class="li">${avatarHTML(f.av, f.name, 'sm')}<div class="t"><b>${esc(f.name)}</b><span>ناطرين يقبل</span></div><button class="btn ghost sm" data-a="unfriend" data-f="${f.id}">إلغاء</button></div>`).join('')}</div>` : ''}`;
}
function msgsTab() {
  if (!online()) return `<div class="hdr"><h1>الرسائل</h1></div><div class="card empty">الرسائل بدها إنترنت.</div>`;
  return `<div class="hdr"><h1>الرسائل</h1><button class="btn sm" data-a="groupPop">${ICON.group} جروب جديد</button></div>
  <div class="card">${ui.chats.length ? ui.chats.map(c => { const un = c.last && c.last.by !== fb.uid && c.last.t > (readMap[c.id] || 0);
    return `<button class="li" data-a="openChat" data-c="${c.id}" style="width:100%;text-align:start">${chatAv(c)}<div class="t"><b>${esc(chatTitle(c))}</b><span>${c.last ? (c.last.by === fb.uid ? 'إنت: ' : c.group ? esc(c.last.name || '') + ': ' : '') + (c.last.kind === 'invite' ? '🎴 دعوة لغرفة' : esc(c.last.text)) : 'ابدأ المحادثة'}</span></div>${un ? '<span class="badge" style="position:static">●</span>' : ''}</button>`; }).join('') : '<div class="empty">ما في محادثات لسا. افتح محادثة من صفحة الأصدقاء.</div>'}</div>`;
}
function meTab() {
  const tileSkin = s => `<button class="tile ${prof.skin === s[0] ? 'on' : ''}" data-a="setP" data-k="skin" data-v="${s[0]}"><span class="sw" style="background:${s[2]}"><i style="background:${s[3]};box-shadow:0 0 0 3px ${s[4]}"></i></span>${s[1]}</button>`;
  const tileCard = s => `<button class="tile ${prof.cards === s[0] ? 'on' : ''}" data-a="setP" data-k="cards" data-v="${s[0]}"><span class="cards" data-cards="${s[0]}">${cardHTML('S13')}${cardHTML('H7')}${cardHTML('D14')}</span>${s[1]}</button>`;
  const tileBack = s => `<button class="tile ${prof.back === s[0] ? 'on' : ''}" data-a="setP" data-k="back" data-v="${s[0]}"><span class="cards" data-back="${s[0]}">${cardHTML('back')}</span>${s[1]}</button>`;
  const stats = online() ? rankPanel(GG(ui.statGame || prof.lastGame || 'mor')) : '';
  return `<div class="hdr"><h1>حسابي</h1></div>
  <div class="card" style="text-align:center">
    <button data-a="avPop" aria-label="غيّر الصورة" style="position:relative;display:inline-block">${avatarHTML(prof.av, prof.name, 'lg')}<span class="ic" style="position:absolute;bottom:-4px;left:-8px;width:32px;height:32px">${ICON.gear}</span></button>
    <div class="row" style="margin-top:12px"><input id="pname" class="grow" maxlength="14" value="${esc(prof.name)}" aria-label="الاسم"><button class="btn sm" data-a="saveName">حفظ</button></div>
    ${prof.code ? `<div class="muted" style="margin-top:8px">ID <b class="gold" style="font-size:16px;letter-spacing:2px">${prof.code}</b></div>` : ''}
  </div>
  ${online() ? `<div class="card"><h2>استرجاع الحساب</h2>${prof.email ? `<div class="muted">حسابك مربوط بـ <b dir="ltr">${esc(prof.email)}</b>. إذا غيّرت الجوال، ادخل بنفس الإيميل.</div><div class="acts"><button class="btn alt sm" data-a="emailPop" data-m="rec">دخول بحساب تاني</button></div>`
    : `<div class="muted">اربط حسابك بإيميل (اختياري) لترجّع أصدقاءك وترتيبك إذا غيّرت الجوال.</div><div class="acts"><button class="btn sm" data-a="emailPop" data-m="link">اربط إيميل</button><button class="btn ghost sm" data-a="emailPop" data-m="rec">عندي حساب</button></div>`}</div>` : ''}
  <div class="card"><h2>شكل الطاولة</h2><div class="tiles">${SKINS.map(tileSkin).join('')}</div></div>
  <div class="card"><h2>شكل الورق</h2><div class="tiles">${CSTY.map(tileCard).join('')}</div></div>
  <div class="card"><h2>ظهر الورق</h2><div class="tiles">${BACKS.map(tileBack).join('')}</div></div>
  <div class="card"><h2>الصوت</h2><div class="row"><button class="ic ${prof.mute ? '' : 'on'}" data-a="mute" aria-label="${prof.mute ? 'شغّل الصوت' : 'كتم الصوت'}">${prof.mute ? ICON.spkoff : ICON.spk}</button><input type="range" id="vol" min="0" max="1" step="0.05" value="${prof.vol}" class="grow" aria-label="مستوى الصوت" ${prof.mute ? 'disabled' : ''}><button class="btn alt sm" data-a="testSnd">جرّب</button></div></div>
  ${native ? `<div class="card"><h2>اتجاه الشاشة</h2><div class="seg"><button class="${ui.orient === 'portrait' ? 'on' : ''}" data-a="orient" data-v="portrait">طولي</button><button class="${ui.orient === 'landscape' ? 'on' : ''}" data-a="orient" data-v="landscape">عرضي</button></div></div>` : ''}
  ${online() ? `<div class="card"><h2>ترتيبي</h2><div class="resume">${ALL.map(g => `<button class="chip ${(ui.statGame || prof.lastGame || 'mor') === g.id ? 'on' : ''}" data-a="statGame" data-g="${g.id}">${esc(g.name)}</button>`).join('')}</div></div>${stats}` : ''}
  <p class="muted" style="text-align:center">سهرة ورق · الإصدار 1.7.1</p>`;
}
function home() {
  if (!prof.name) return onboarding();
  const body = { home: homeTab, solo: soloTab, friends: friendsTab, msgs: msgsTab, me: meTab }[ui.tab] || homeTab;
  return `<div class="scr" id="scr"><div class="in">${body()}</div></div>${nav()}${pops()}${rankOverlays()}${toastHTML()}`;
}
function pops() {
  const p = ui.pop; if (!p) return '';
  if (p.k === 'newRoom') return sheet(`${sheetHead('إنشاء غرفة')}<div class="muted">وين بدكم تلعبوا؟</div>
    ${online() ? `<button class="big-act main" data-a="createFb"><span class="bi">${ICON.share}</span><div><b>أونلاين</b><span>كل واحد من بيته، بكود من 4 حروف</span></div></button>` : ''}
    ${native ? `<button class="big-act" data-a="createLan"><span class="bi">${ICON.home}</span><div><b>على نفس الواي فاي</b><span>بدون إنترنت، كلكم على نفس الشبكة</span></div></button>` : ''}`);
  if (p.k === 'join') return sheet(`${sheetHead('دخول برمز')}<div class="muted">اكتب كود الغرفة (أونلاين) أو عنوان المضيف (واي فاي).</div>
    <input id="jcode" maxlength="15" placeholder="ABCD  أو  192.168.1.5" style="direction:ltr;text-align:center;text-transform:uppercase;font:600 24px Oswald,sans-serif;letter-spacing:4px;margin-top:12px;min-height:58px" autocomplete="off">
    ${native ? `<div class="muted" style="margin-top:6px">عنوانك على الواي فاي: <b dir="ltr">${esc(myIp() || 'مش متصل')}</b></div>` : ''}
    <div class="acts"><button class="btn wide" data-a="joinGo">ادخل</button></div>`);
  if (p.k === 'tmenu') { const G = ui.st ? gameOf(ui.st) : GG('mor'); return sheet(`${sheetHead(esc(G.name))}
    <div class="row"><button class="ic ${prof.mute ? '' : 'on'}" data-a="mute" aria-label="${prof.mute ? 'شغّل الصوت' : 'كتم الصوت'}">${prof.mute ? ICON.spkoff : ICON.spk}</button><input type="range" id="vol" min="0" max="1" step="0.05" value="${prof.vol}" class="grow" aria-label="مستوى الصوت" ${prof.mute ? 'disabled' : ''}></div>
    <div class="muted" style="margin-top:12px">شكل الورق</div><div class="resume" style="margin-top:6px">${CSTY.map(c => `<button class="chip ${prof.cards === c[0] ? 'on' : ''}" data-a="setP" data-k="cards" data-v="${c[0]}">${c[1]}</button>`).join('')}</div>
    <div class="acts">${native ? `<button class="btn alt sm" data-a="rotate">${ICON.rot} ${ui.orient === 'portrait' ? 'خلّيها عرضي' : 'خلّيها طولي'}</button>` : ''}<button class="btn alt sm" data-a="rules" data-g="${G.id}">${ICON.info} القوانين</button></div>`); }
  if (p.k === 'rules') { const G = GG(p.g); return sheet(`${sheetHead(esc(G.name))}<div class="rules">${G.rules}</div>`); }
  if (p.k === 'soloStart') { const G = GG(p.g); return sheet(`${sheetHead(esc(G.name))}<div class="muted">عندك لعبة محفوظة.</div><div class="acts"><button class="btn" data-a="soloGo" data-g="${G.id}" data-r="1">كمّل المحفوظة</button><button class="btn alt" data-a="soloGo" data-g="${G.id}">لعبة جديدة</button></div>`); }
  if (p.k === 'pass') {
    const cfg = ui.localCfg || (ui.localCfg = [false, false, false, false]), G = GG(p.g || prof.lastGame || 'mor');
    return sheet(`${sheetHead('على جوال واحد')}<div class="resume">${ALL.map(g => `<button class="chip ${g.id === G.id ? 'on' : ''}" data-a="passGame" data-g="${g.id}">${esc(g.name)}</button>`).join('')}</div>
      ${[0, 1, 2, 3].map(i => `<div class="row" style="margin-top:8px"><input id="ln${i}" class="grow" placeholder="${G.teams ? TEAM[i % 2] + ': ' : ''}لاعب ${i + 1}" maxlength="14"><button class="chip ${cfg[i] ? 'on' : ''}" data-a="cfgBot" data-s="${i}">بوت</button></div>`).join('')}
      <div class="acts"><button class="btn wide" data-a="local" data-g="${G.id}">ابدأ</button></div>`);
  }
  if (p.k === 'gamePick') return sheet(`${sheetHead('اختار اللعبة')}${gameGrid('setGame', ui.room && ui.room.game)}`);
  if (p.k === 'invite') {
    const ok = ui.friends.filter(f => f.st === 'ok'), groups = ui.chats.filter(c => c.group);
    return sheet(`${sheetHead('ادعي على الغرفة')}<div class="muted">بتوصلهم دعوة بالرسائل بيدخلوا فيها بكبسة.</div>
      ${groups.map(c => `<div class="li">${chatAv(c)}<div class="t"><b>${esc(c.title)}</b><span>جروب</span></div><button class="btn sm" data-a="invite" data-to="${c.id}">ادعي</button></div>`).join('')}
      ${ok.map(f => `<div class="li">${avatarHTML(f.av, f.name, 'sm')}<div class="t"><b>${esc(f.name)}</b></div><button class="btn sm" data-a="invite" data-to="f:${f.id}">ادعي</button></div>`).join('') || '<div class="empty">ما عندك أصدقاء لسا. ضيفهم من صفحة الأصدقاء بالـ ID.</div>'}
      <div class="sep"></div><div class="muted">أو ابعتلهم الكود: <b class="gold" style="letter-spacing:3px">${esc(ui.code)}</b></div>`);
  }
  if (p.k === 'email') return sheet(`${sheetHead(p.m === 'link' ? 'اربط إيميل' : 'دخول بحسابي')}<div class="muted">${p.m === 'link' ? 'اختار كلمة سر 6 خانات أو أكتر.' : 'حسابك الحالي على هالجوال رح يتبدّل بالحساب اللي بتدخل عليه.'}</div>
    <input id="em" type="email" placeholder="الإيميل" style="direction:ltr;margin-top:10px" autocomplete="email"><input id="pw" type="password" placeholder="كلمة السر" style="direction:ltr;margin-top:8px" autocomplete="${p.m === 'link' ? 'new-password' : 'current-password'}">
    <div class="acts"><button class="btn wide" data-a="${p.m === 'link' ? 'linkEmail' : 'recoverEmail'}">${p.m === 'link' ? 'اربط' : 'ادخل'}</button></div>`);
  if (p.k === 'group') {
    const ok = ui.friends.filter(f => f.st === 'ok');
    return sheet(`${sheetHead('جروب جديد')}<input id="gtitle" maxlength="30" placeholder="اسم الجروب، مثلاً: شلّة الخميس">
      <div class="muted" style="margin-top:10px">مين بالجروب؟</div>${ok.map(f => `<button class="li" data-a="gmT" data-gm="${f.id}" style="width:100%;text-align:start">${avatarHTML(f.av, f.name, 'sm')}<div class="t"><b>${esc(f.name)}</b></div><span class="ic">${ICON.check}</span></button>`).join('') || '<div class="empty">ضيف أصدقاء أول.</div>'}
      <div class="acts"><button class="btn wide" data-a="mkGroup">اعمل الجروب</button></div>`);
  }
  if (p.k === 'friend') { const f = ui.friends.find(x => x.id === p.f) || {}; return sheet(`${sheetHead(esc(f.name || ''))}<div class="acts"><button class="btn" data-a="dm" data-f="${p.f}">${ICON.chat} رسالة</button><button class="btn red" data-a="unfriend" data-f="${p.f}">احذفه من الأصدقاء</button></div>`); }
  if (p.k === 'av') {
    const [c] = (ui.obAv || prof.av).split('|'), sel = ui.obAv || prof.av;
    return sheet(`${sheetHead('صورتك')}<div class="avpick">${AVG.concat(['A']).slice(0, 10).map(g => `<button data-a="obAv" data-v="${c}|${g}" class="${sel === c + '|' + g ? 'on' : ''}">${avatarHTML(c + '|' + g, prof.name)}</button>`).join('')}</div>
      <div class="swatches">${AVC.map((col, i) => `<button data-a="obCol" data-v="${i}" class="${+c === i ? 'on' : ''}" style="background:${col}" aria-label="لون ${i + 1}"></button>`).join('')}</div>
      <div class="acts"><button class="btn wide" data-a="avSave">حفظ</button></div>`);
  }
  return '';
}
function dmView() {
  const c = ui.chats.find(x => x.id === (ui.dm && ui.dm.id)) || { id: ui.dm.id, members: [], names: {} };
  return `<div class="chatv"><div class="hd"><button class="ic" data-a="closeChat" aria-label="رجوع">${ICON.back}</button>${chatAv(c)}<div style="flex:1"><b>${esc(chatTitle(c))}</b>${c.group ? `<div class="muted">${(c.members || []).map(m => esc((c.names || {})[m] || '')).join('، ')}</div>` : ''}</div>${ui.mode === 'fb' ? `<button class="btn sm" data-a="invite" data-to="${c.id}">ادعي للغرفة</button>` : ''}</div>
  <div class="msgs" id="dmmsgs">${ui.dmMsgs.map(m => {
    const mine = m.by === fb.uid;
    if (m.kind === 'invite') return `<div class="msg inv ${mine ? 'me' : ''}"><small>${esc(m.name)}</small>🎴 دعوة لغرفة <b>${esc(GG(m.game).name)}</b> · <span dir="ltr">${esc(m.room)}</span>${mine ? '' : `<div style="margin-top:6px"><button class="btn sm" data-a="acceptInv" data-r="${esc(m.room)}">ادخل الغرفة</button></div>`}</div>`;
    return `<div class="msg ${mine ? 'me' : ''}">${c.group && !mine ? `<small>${esc(m.name)}</small>` : ''}${esc(m.text)}</div>`;
  }).join('') || '<div class="empty">قول مرحبا 👋</div>'}</div>
  <div class="inp"><input id="dmin" class="grow" placeholder="اكتب رسالة" maxlength="300"><button class="ic on" data-a="sendDM" aria-label="ابعت">${ICON.send}</button></div></div>${toastHTML()}`;
}
function lobby() {
  const G = GG(ui.room && ui.room.game || 'mor'), host = isHost(), mine = ui.players.find(p => p.id === uid);
  const teams = G.teams;
  const seat = s => {
    const p = ui.players.find(x => x.seat === s), me = p && p.id === uid;
    const hostTag = p && ui.room && p.id === ui.room.host ? ' 👑' : '';
    return `<button class="st s${(s - (mine && mine.seat >= 0 ? mine.seat : 0) + 4) % 4} ${me ? 'me' : ''}" data-a="sit" data-s="${s}">
      ${p ? avatarHTML(p.av, p.name) : '<span class="empty-seat">+</span>'}<span>${p ? esc(p.name) + hostTag : 'اقعد هون'}</span>${teams ? `<span class="team" style="color:${TC[s % 2]}">${TEAM[s % 2]}</span>` : ''}</button>`;
  };
  const watchers = ui.players.filter(p => p.seat < 0);
  const sat = ui.players.filter(p => p.seat >= 0).length;
  const shown = esc(ui.code === location.hostname ? (myIp() || ui.code) : ui.code);
  return `<div class="scr"><div class="in">
  <div class="hdr"><button class="ic" data-a="exit" aria-label="اطلع">${ICON.x}</button><h1>الغرفة</h1>
    <button class="ic" data-a="chat" aria-label="الدردشة">${ICON.chat}${ui.unread ? `<span class="badge">${ui.unread}</span>` : ''}</button>
    <button class="ic ${vc.on ? (vc.muted ? 'vmute' : 'von') : ''}" data-a="voice" aria-label="المكالمة">${vc.on ? (vc.muted || !vc.stream ? ICON.micoff : ICON.mic) : ICON.phone}${!vc.on && vc.members.length ? `<span class="badge" style="background:var(--b);color:#03212d">${vc.members.length}</span>` : ''}</button></div>
  <div class="card" style="text-align:center;padding:12px">${ui.mode === 'lan' ? `<div class="muted">رفقاتك بيكتبوا هالعنوان بـ «دخول برمز»</div><div class="roomcode" style="font-size:32px;letter-spacing:2px">${shown}</div><div class="muted">أو من المتصفح: <b dir="ltr">http://${shown}:${PORT}</b></div>`
    : `<div class="muted">كود الغرفة</div><div class="roomcode">${esc(ui.code)}</div><div class="acts" style="justify-content:center;margin-top:8px"><button class="btn alt sm" data-a="copyCode">${ICON.copy} انسخ</button>${online() ? `<button class="btn sm" data-a="invitePop">${ICON.invite} ادعي أصدقاء</button>` : ''}</div>`}</div>
  <div class="gsel">${fan(GICON[G.id] || GICON.mor, 26)}<div style="flex:1"><div class="muted">اللعبة</div><b>${esc(G.name)}</b><div class="muted" style="font-size:12px">${esc(G.sub)}</div></div>${host ? `<button class="btn alt sm" data-a="gamePick">غيّر</button>` : ''}<button class="ic" data-a="rules" data-g="${G.id}" aria-label="القوانين">${ICON.info}</button></div>
  <div class="minitable"><div class="felt">${teams ? 'المتقابلين فريق واحد' : 'كل واحد لحاله'}<br>اكبس على كرسي لتقعد</div>${[0, 1, 2, 3].map(seat).join('')}</div>
  ${watchers.length ? `<div class="muted" style="text-align:center">بيتفرّجوا: </div><div class="spect" style="justify-content:center">${watchers.map(p => `<span class="chip">${avatarHTML(p.av, p.name, 'xs')} ${esc(p.name)}</span>`).join('')}</div>` : ''}
  ${host ? `<div class="acts"><button class="btn wide" data-a="start" ${sat === 4 ? '' : 'disabled'}>ابدأ اللعب</button>${sat < 4 ? `<button class="btn alt wide" data-a="startBots" ${sat ? '' : 'disabled'}>${ICON.bot} ابدأ وكمّل الكراسي الفاضية بالبوت</button>` : ''}</div>`
    : `<p class="muted" style="text-align:center">صاحب الغرفة بيختار اللعبة وبيبلّش. اللي ما بيقعد بيتفرّج.</p>`}
  </div></div>${ui.chatOpen ? chatPanel() : ''}${pops()}${ui.confirmExit ? exitBox() : ''}${toastHTML()}`;
}
const exitBox = () => sheet(`<h2>بدك تطلع؟</h2><p class="muted">${ui.mode === 'local' ? 'اللعبة بتنحفظ وفيك تكمّلها بعدين.' : 'بتطلع من الغرفة، وفيك ترجع بنفس الكود.'}</p><div class="acts"><button class="btn red" data-a="leave">إيه، اطلع</button><button class="btn alt" data-a="stay">لا، كمّل</button></div>`, 'stay', true);
