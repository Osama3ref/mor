// ---------- rendering: screens ----------
function fan(ids, w = 34) { return `<div class="fanlogo" style="width:${w * 2.1}px;height:${w * 1.75}px">${ids.map((id, i) => cardHTML(id, '', `style="--w:${w}px;left:${i * w * 0.5}px;transform:rotate(${(i - 1) * 13}deg)"`)).join('')}</div>`; }
const toastHTML = () => (ui.toast ? `<div class="toast" role="status">${esc(ui.toast)}</div>` : '');
const sheet = (inner, close = 'closePop', mid = false) => `<div class="ov ${mid ? 'cen' : ''}" data-a="${close}"><div class="box" data-stop="1">${mid ? '' : '<div class="grab"></div>'}${inner}</div></div>`;
const sheetHead = (title, close = 'closePop') => `<div class="row" style="justify-content:space-between;margin-bottom:6px"><h2>${title}</h2><button class="ic" data-a="${close}" aria-label="إغلاق">${ICON.x}</button></div>`;
function nav() {
  const fr = friendReqs(), un = unreadChats();
  const b = (t, ic, label, n) => `<button class="${ui.tab === t ? 'on' : ''}" data-a="tab" data-t="${t}">${ic}<span>${label}</span>${n ? `<span class="badge">${n}</span>` : ''}</button>`;
  return `<nav class="nav">${b('home', ICON.home, 'الرئيسية')}${b('friends', ICON.users, 'الأصدقاء', fr)}${b('msgs', ICON.msgs, 'الرسائل', un)}${b('me', ICON.user, 'حسابي')}</nav>`;
}
function meBar() {
  return `<button class="me-bar" data-a="tab" data-t="me" style="width:100%;text-align:start">${avatarHTML(myAv(), prof.name)}<div style="flex:1"><div class="nm">${esc(prof.name || 'ضيف')}</div><div class="muted">${prof.code ? 'ID ' + prof.code : online() ? '' : isServed ? 'دون إنترنت: الشبكة المحلية متاحة' : ''}</div></div><span class="ic">${ICON.gear}</span></button>`;
}
function onboarding() {
  const sel = ui.obAv || prof.av;
  const [c] = sel.split('|');
  return `<div class="scr"><div class="in">
  <div class="brand">${fan(['H1a', 'S13a', 'J0a'], 44)}<h1>سهرة ورق</h1><div class="muted">مور وطرنيب وتركس مع أصدقائك</div></div>
  <div class="card"><h2>أهلاً بك! عرّفنا بنفسك</h2><div class="muted">تختارهما مرة واحدة، ويمكنك تغييرهما لاحقاً من «حسابي».</div>
    <div style="margin-top:12px"><label class="muted" for="obn">اسمك في اللعب</label><input id="obn" maxlength="14" autocomplete="nickname" value="${esc(prof.name)}" placeholder="مثلاً: أبو أحمد"></div>
    <div class="muted" style="margin-top:14px">صورتك</div>
    <div class="avpick">${AVG.concat(['A']).slice(0, 10).map(g => `<button data-a="obAv" data-v="${c}|${g}" class="${sel === c + '|' + g ? 'on' : ''}">${avatarHTML(c + '|' + g, prof.name || 'أ')}</button>`).join('')}</div>
    <div class="swatches">${AVC.map((col, i) => `<button data-a="obCol" data-v="${i}" class="${+c === i ? 'on' : ''}" style="background:${col}" aria-label="لون ${i + 1}"></button>`).join('')}</div>
    <div class="acts"><button class="btn alt" data-a="pickPhoto">📷 صورة من جهازي</button></div><div class="acts"><button class="btn wide" data-a="obDone">هيا نلعب</button></div></div>
  </div></div>${toastHTML()}`;
}
function homeTab() {
  const last = ls.get('mor-room');
  const saved = ALL.filter(g => savedGame(g.id));
  const canCreate = online() || native;
  return `<div class="brand" style="margin:4px 0 0">${fan(['H1a', 'S13a', 'J0a'], 30)}<h1 style="font-size:30px">سهرة ورق</h1></div>
  ${meBar()}
  ${saved.length ? `<section class="card saved-games"><h2>أكمل لعبك</h2><div class="resume">${saved.map(g => `<button class="chip" data-a="resume" data-g="${g.id}">${esc(g.name)}</button>`).join('')}</div></section>` : ''}
  <button class="big-act main" data-a="newRoom" ${canCreate ? '' : 'disabled'}><span class="bi">${ICON.plus}</span><div><b>إنشاء غرفة</b><span>${canCreate ? 'افتح طاولة وادعُ أصدقاءك' : 'تحتاج إلى الإنترنت أو التطبيق على الواي فاي'}</span></div></button>
  <button class="big-act" data-a="joinPop"><span class="bi">${ICON.key}</span><div><b>دخول برمز</b><span>هل لديك رمز غرفة من صديقك؟</span></div></button>
  <button class="big-act" data-a="tab" data-t="solo"><span class="bi">${ICON.bot}</span><div><b>اللعب ضد الكمبيوتر</b><span>تدرّب مع بوتات قوية</span></div></button>
  ${last && last.mode ? `<div class="row" style="justify-content:center"><button class="chip" data-a="rejoin">عُد إلى الغرفة ${esc(last.key)}</button></div>` : ''}
  <button class="big-act" data-a="passPop"><span class="bi">${ICON.users}</span><div><b>على جهاز واحد</b><span>العبوا ومرّروا الجهاز بينكم، دون إنترنت</span></div></button>
  ${!native && isServed ? `<button class="btn alt wide" data-a="joinHere" style="margin-top:8px">ادخل غرفة هذا المضيف</button>` : ''}`;
}
function gameGrid(action, selected) {
  return `<div class="glist">${(action === 'setGame' ? ROOMG : ALL).map(g => {
    const saved = action === 'soloPick' && savedGame(g.id);
    return `<div class="gentry"><button class="gcard ${selected === g.id ? 'on' : ''}" data-a="${action}" data-g="${g.id}">${saved ? '<span class="saved" aria-label="محفوظة"></span>' : ''}${gameIcon(g, 30)}<b>${esc(g.name)}</b><span class="muted">${esc(g.sub)}</span></button><button class="info" data-a="rules" data-g="${g.id}" aria-label="قوانين ${esc(g.name)}"><span aria-hidden="true">؟</span></button></div>`;
  }).join('')}</div>`;
}
function botLevelButtons() {
  const mode = ['normal','expert'].includes(prof.botLevel) ? prof.botLevel : 'hard';
  return `<div class="seg" role="group" aria-label="قوّة البوتات للعب المحلّي">${[['normal','عادي'], ['hard','قوي'], ['expert','خبير']].map(([v,label]) => `<button class="${mode === v ? 'on' : ''}" data-a="setP" data-k="botLevel" data-v="${v}" aria-pressed="${mode === v}">${label}</button>`).join('')}</div>`;
}
function soloTab() {
  return `<div class="hdr"><button class="ic" data-a="tab" data-t="home" aria-label="رجوع">${ICON.back}</button><h1>اللعب ضد الكمبيوتر</h1></div>
  <div class="muted">اختر اللعبة. في ألعاب الشراكة يكون البوت شريكك.</div>
  <div class="card"><h2>قوّة البوتات</h2>${botLevelButtons()}</div>
  ${gameGrid('soloPick')}
  <div class="card"><h2>على جهاز واحد</h2><div class="muted">تمرّرون الجهاز بينكم، ويمكنك جعل بعض المقاعد بوتات.</div><div class="acts"><button class="btn alt sm" data-a="passPop">جهّز اللعبة</button></div></div>`;
}
function friendsTab() {
  if (!online()) return `<div class="hdr"><h1>الأصدقاء</h1></div><div class="card empty">الأصدقاء يحتاجون إلى الإنترنت. ${window.FB ? '<div class="acts" style="justify-content:center"><button class="btn alt sm" data-a="fbRetry">حاول مرة أخرى</button></div>' : ''}</div>`;
  const inn = ui.friends.filter(f => f.st === 'in'), ok = ui.friends.filter(f => f.st === 'ok'), out = ui.friends.filter(f => f.st === 'out');
  return `<div class="hdr"><h1>الأصدقاء</h1></div>
  <div class="card"><div class="row"><div style="flex:1"><div class="muted">معرّفك (ID)</div><div class="roomcode" style="font-size:30px;letter-spacing:4px;text-align:start">${esc(prof.code || '…')}</div></div><button class="btn alt sm" data-a="copyId">${ICON.copy} انسخ</button></div>
    <div class="row" style="margin-top:12px"><input id="fcode" class="grow" inputmode="numeric" maxlength="6" placeholder="ID صاحبك" style="direction:ltr;text-align:center"><button class="btn" data-a="addFriend">${ICON.invite} أضف</button></div></div>
  ${inn.length ? `<div class="card"><h2>طلبات صداقة</h2>${inn.map(f => `<div class="li">${avatarHTML(pav(f), f.name, 'sm')}<div class="t"><b>${esc(f.name)}</b><span>ID ${esc(f.code || '')}</span></div><button class="btn sm" data-a="accept" data-f="${f.id}">قبول</button><button class="btn ghost sm" data-a="unfriend" data-f="${f.id}">رفض</button></div>`).join('')}</div>` : ''}
  <div class="card"><h2>أصدقائي ${ok.length ? `<span class="muted">(${ok.length})</span>` : ''}</h2>${ok.length ? ok.map(f => `<div class="li">${avatarHTML(pav(f), f.name, 'sm')}<div class="t"><b>${esc(f.name)}</b><span>ID ${esc(f.code || '')}</span></div>${ui.mode === 'fb' ? `<button class="btn sm" data-a="invite" data-to="f:${f.id}">ادعوه</button>` : ''}<button class="ic" data-a="dm" data-f="${f.id}" aria-label="رسالة">${ICON.chat}</button><button class="ic" data-a="friendMenu" data-f="${f.id}" aria-label="خيارات">⋯</button></div>`).join('') : '<div class="empty">ليس لديك أصدقاء بعد. أرسل معرّفك (ID) إلى أصدقائك.</div>'}</div>
  ${out.length ? `<div class="card"><h2>طلبات أرسلتها</h2>${out.map(f => `<div class="li">${avatarHTML(pav(f), f.name, 'sm')}<div class="t"><b>${esc(f.name)}</b><span>بانتظار قبوله</span></div><button class="btn ghost sm" data-a="unfriend" data-f="${f.id}">إلغاء</button></div>`).join('')}</div>` : ''}`;
}
function msgsTab() {
  if (!online()) return `<div class="hdr"><h1>الرسائل</h1></div><div class="card empty">الرسائل تحتاج إلى الإنترنت.</div>`;
  return `<div class="hdr"><h1>الرسائل</h1><button class="btn sm" data-a="groupPop">${ICON.group} مجموعة جديدة</button></div>
  <div class="card">${ui.chats.length ? ui.chats.map(c => { const un = c.last && c.last.by !== fb.uid && c.last.t > (readMap[c.id] || 0);
    return `<button class="li" data-a="openChat" data-c="${c.id}" style="width:100%;text-align:start">${chatAv(c)}<div class="t"><b>${esc(chatTitle(c))}</b><span>${c.last ? (c.last.by === fb.uid ? 'أنت: ' : c.group ? esc(c.last.name || '') + ': ' : '') + (c.last.kind === 'invite' ? '🎴 دعوة لغرفة' : esc(c.last.text)) : 'ابدأ المحادثة'}</span></div>${un ? '<span class="badge" style="position:static">●</span>' : ''}</button>`; }).join('') : '<div class="empty">لا توجد محادثات بعد. افتح محادثة من صفحة الأصدقاء.</div>'}</div>`;
}
function meTab() {
  const tileSkin = s => `<button class="tile ${prof.skin === s[0] ? 'on' : ''}" data-a="setP" data-k="skin" data-v="${s[0]}"><span class="sw" style="background:${s[2]}"><i style="background:${s[3]};box-shadow:0 0 0 3px ${s[4]}"></i></span>${s[1]}</button>`;
  const tileCard = s => `<button class="tile ${prof.cards === s[0] ? 'on' : ''}" data-a="setP" data-k="cards" data-v="${s[0]}"><span class="cards" data-cards="${s[0]}">${cardHTML('S13')}${cardHTML('H7')}${cardHTML('D14')}</span>${s[1]}</button>`;
  const tileBack = s => `<button class="tile ${prof.back === s[0] ? 'on' : ''}" data-a="setP" data-k="back" data-v="${s[0]}"><span class="cards" data-back="${s[0]}">${cardHTML('back')}</span>${s[1]}</button>`;
  const stats = online() ? rankPanel(GG(ui.statGame || prof.lastGame || 'mor')) : '';
  return `<div class="hdr"><h1>حسابي</h1></div>
  <div class="card" style="text-align:center">
    <button data-a="avPop" aria-label="غيّر الصورة" style="position:relative;display:inline-block">${avatarHTML(myAv(), prof.name, 'lg')}<span class="ic" style="position:absolute;bottom:-4px;left:-8px;width:32px;height:32px">${ICON.gear}</span></button>
    <div class="row" style="margin-top:12px"><input id="pname" class="grow" maxlength="14" value="${esc(prof.name)}" aria-label="الاسم"><button class="btn sm" data-a="saveName">حفظ</button></div>
    ${prof.code ? `<div class="muted" style="margin-top:8px">ID <b class="gold" style="font-size:16px;letter-spacing:2px">${prof.code}</b></div>` : ''}
  </div>
  ${online() ? `<div class="card"><h2>حماية الحساب</h2>${prof.email ? (prof.emailOk ? `<div class="muted">حسابك مربوط بالبريد <b dir="ltr">${esc(prof.email)}</b> ومؤكَّد ✓. إذا غيّرت جهازك، سجّل الدخول بالبريد نفسه.</div><div class="acts"><button class="btn alt sm" data-a="emailPop" data-m="rec">الدخول بحساب آخر</button></div>`
      : `<div class="muted">ربطتَ البريد <b dir="ltr">${esc(prof.email)}</b>، لكنه <b class="red">غير مؤكَّد</b> بعد. افتح رابط التأكيد الذي وصلك، ثم اضغط الزر.</div><div class="acts"><button class="btn sm" data-a="checkVerify">أكّدت بريدي</button><button class="btn alt sm" data-a="resendVerify">أعد إرسال الرابط</button></div>`)
    : `<div class="muted">اربط حسابك ببريد إلكتروني (اختياري) لتستعيد أصدقاءك وترتيبك إذا غيّرت جهازك. سنرسل إليك رابطاً لتأكيد البريد.</div><div class="acts"><button class="btn sm" data-a="emailPop" data-m="link">اربط بريداً</button><button class="btn ghost sm" data-a="emailPop" data-m="rec">لديّ حساب</button></div>`}</div>` : ''}
  <div class="card"><h2>قوّة البوتات</h2>${botLevelButtons()}<p class="muted" style="margin-bottom:0">تنطبق على اللعب ضد الكمبيوتر وعلى جهاز واحد.</p></div>
  <div class="card"><h2>شكل الطاولة</h2><div class="tiles">${SKINS.map(tileSkin).join('')}</div></div>
  <div class="card"><h2>شكل الورق</h2><div class="tiles">${CSTY.map(tileCard).join('')}</div></div>
  <div class="card"><h2>ظهر الورق</h2><div class="tiles">${BACKS.map(tileBack).join('')}</div></div>
  <div class="card"><h2>الصوت</h2><div class="row"><button class="ic ${prof.mute ? '' : 'on'}" data-a="mute" aria-label="${prof.mute ? 'شغّل الصوت' : 'كتم الصوت'}">${prof.mute ? ICON.spkoff : ICON.spk}</button><input type="range" id="vol" min="0" max="1" step="0.05" value="${prof.vol}" class="grow" aria-label="مستوى الصوت" ${prof.mute ? 'disabled' : ''}><button class="btn alt sm" data-a="testSnd">جرّب</button></div></div>
  ${native ? `<div class="card"><h2>اتجاه الشاشة</h2><div class="seg"><button class="${ui.orient === 'portrait' ? 'on' : ''}" data-a="orient" data-v="portrait">عمودي</button><button class="${ui.orient === 'landscape' ? 'on' : ''}" data-a="orient" data-v="landscape">أفقي</button></div></div>` : ''}
  ${online() ? `<div class="card"><h2>ترتيبي</h2><div class="resume">${ALL.map(g => `<button class="chip ${(ui.statGame || prof.lastGame || 'mor') === g.id ? 'on' : ''}" data-a="statGame" data-g="${g.id}">${esc(g.name)}</button>`).join('')}</div></div>${stats}` : ''}
  <p class="muted" style="text-align:center">سهرة ورق · الإصدار 1.12</p>`;
}
function home() {
  if (!prof.name) return onboarding();
  const body = { home: homeTab, solo: soloTab, friends: friendsTab, msgs: msgsTab, me: meTab }[ui.tab] || homeTab;
  return `<div class="scr" id="scr"><div class="in">${body()}</div></div>${nav()}${pops()}${rankOverlays()}${toastHTML()}`;
}
function pops() {
  const p = ui.pop; if (!p) return '';
  if (p.k === 'newRoom') return sheet(`${sheetHead('إنشاء غرفة')}<div class="muted">أين تريدون اللعب؟</div>
    ${online() ? `<button class="big-act main" data-a="createFb"><span class="bi">${ICON.share}</span><div><b>عبر الإنترنت</b><span>كلٌّ من بيته، برمز من 4 أحرف</span></div></button>` : ''}
    ${native ? `<button class="big-act" data-a="createLan"><span class="bi">${ICON.home}</span><div><b>على شبكة الواي فاي نفسها</b><span>دون إنترنت، كلكم على الشبكة نفسها</span></div></button>` : ''}`);
  if (p.k === 'join') return sheet(`${sheetHead('دخول برمز')}<div class="muted">اكتب رمز الغرفة (عبر الإنترنت) أو عنوان المضيف (واي فاي).</div>
    <input id="jcode" maxlength="15" placeholder="ABCD  أو  192.168.1.5" style="direction:ltr;text-align:center;text-transform:uppercase;font:600 24px Oswald,sans-serif;letter-spacing:4px;margin-top:12px;min-height:58px" autocomplete="off">
    ${native ? `<div class="muted" style="margin-top:6px">عنوانك على شبكة الواي فاي: <b dir="ltr">${esc(myIp() || 'غير متصل')}</b></div>` : ''}
    <div class="acts"><button class="btn wide" data-a="joinGo">ادخل</button></div>`);
  if (p.k === 'call') return vc.on ? callSheet() : '';
  if (p.k === 'discPick' && ui.st && ui.st.discard) {
    const d = ui.st.discard, sel = p.sel, n = d.length - sel;
    const cnt = n === 1 ? 'ورقة واحدة' : n === 2 ? 'ورقتين' : n <= 10 ? n + ' أوراق' : n + ' ورقة';
    return sheet(`${sheetHead('الأخذ من الأرض')}<div class="muted">اختر الورقة التي تبدأ منها، وستأخذها مع كل ما فوقها (الأحدث في الآخر).</div>
      <div class="dpick">${d.map((id, i) => `<button class="dp ${i >= sel ? 'on' : ''} ${i === sel ? 'first' : ''}" data-a="discSel" data-i="${i}" aria-label="${i + 1}"><span class="dn">${i + 1}</span>${cardHTML(id)}</button>`).join('')}</div>
      <div class="acts"><button class="btn wide" data-a="discTake">خذ ${cnt}</button></div>`);
  }
  if (p.k === 'tmenu') { const G = ui.st ? gameOf(ui.st) : GG('mor'); return sheet(`${sheetHead(esc(G.name))}
    <div class="row"><button class="ic ${prof.mute ? '' : 'on'}" data-a="mute" aria-label="${prof.mute ? 'شغّل الصوت' : 'كتم الصوت'}">${prof.mute ? ICON.spkoff : ICON.spk}</button><input type="range" id="vol" min="0" max="1" step="0.05" value="${prof.vol}" class="grow" aria-label="مستوى الصوت" ${prof.mute ? 'disabled' : ''}></div>
    <div class="muted" style="margin-top:12px">شكل الورق</div><div class="resume" style="margin-top:6px">${CSTY.map(c => `<button class="chip ${prof.cards === c[0] ? 'on' : ''}" data-a="setP" data-k="cards" data-v="${c[0]}">${c[1]}</button>`).join('')}</div>
    <div class="acts">${native ? `<button class="btn alt sm" data-a="rotate">${ICON.rot} ${ui.orient === 'portrait' ? 'اجعلها أفقية' : 'اجعلها عمودية'}</button>` : ''}<button class="btn alt sm" data-a="rules" data-g="${G.id}">${ICON.info} القوانين</button></div>`); }
  if (p.k === 'rules') { const G = GG(p.g); return sheet(`${sheetHead(esc(G.name))}<div class="rules">${G.rules}</div>`); }
  if (p.k === 'replaceLocal') {
    const G = GG(p.g);
    return sheet(`${sheetHead(esc(G.name), 'cancelLocal')}<p class="muted">لديك لعبة محفوظة. إذا بدأت لعبة جديدة فستُحذف المحفوظة لهذه اللعبة فقط.</p><div class="acts"><button class="btn" data-a="resume" data-g="${G.id}">أكمل المحفوظة</button><button class="btn red" data-a="replaceLocal">استبدلها بلعبة جديدة</button><button class="btn alt" data-a="cancelLocal">إلغاء</button></div>`, 'cancelLocal');
  }
  if (p.k === 'pass') {
    const cfg = ui.localCfg || (ui.localCfg = [false, false, false, false]), G = GG(p.g || prof.lastGame || 'mor');
    return sheet(`${sheetHead('على جهاز واحد')}<div class="resume">${ALL.map(g => `<button class="chip ${g.id === G.id ? 'on' : ''}" data-a="passGame" data-g="${g.id}">${esc(g.name)}</button>`).join('')}</div>
      ${[0, 1, 2, 3].map(i => `<div class="row" style="margin-top:8px"><input id="ln${i}" class="grow" placeholder="${G.teams ? TEAM[i % 2] + ': ' : ''}لاعب ${i + 1}" aria-label="اسم اللاعب ${i + 1}" maxlength="14" value="${esc(ui.passNames?.[i] || '')}"><button class="chip ${cfg[i] ? 'on' : ''}" data-a="cfgBot" data-s="${i}" aria-pressed="${!!cfg[i]}" aria-label="بوت للمقعد ${i + 1}">بوت</button></div>`).join('')}
      <div class="acts"><button class="btn wide" data-a="local" data-g="${G.id}">ابدأ</button></div>`);
  }
  if (p.k === 'gamePick') return sheet(`${sheetHead('اختر اللعبة')}${gameGrid('setGame', ui.room && ui.room.game)}`);
  if (p.k === 'invite') {
    const ok = ui.friends.filter(f => f.st === 'ok'), groups = ui.chats.filter(c => c.group);
    return sheet(`${sheetHead('ادعُ إلى الغرفة')}<div class="muted">تصلهم دعوة في الرسائل يدخلون بها بضغطة.</div>
      ${groups.map(c => `<div class="li">${chatAv(c)}<div class="t"><b>${esc(c.title)}</b><span>مجموعة</span></div><button class="btn sm" data-a="invite" data-to="${c.id}">ادعُ</button></div>`).join('')}
      ${ok.map(f => `<div class="li">${avatarHTML(pav(f), f.name, 'sm')}<div class="t"><b>${esc(f.name)}</b></div><button class="btn sm" data-a="invite" data-to="f:${f.id}">ادعُ</button></div>`).join('') || '<div class="empty">ليس لديك أصدقاء بعد. أضفهم من صفحة الأصدقاء بالمعرّف (ID).</div>'}
      <div class="sep"></div><div class="muted">أو أرسل إليهم الرمز: <b class="gold" style="letter-spacing:3px">${esc(ui.code)}</b></div>`);
  }
  if (p.k === 'email') return sheet(`${sheetHead(p.m === 'link' ? 'ربط بريد إلكتروني' : 'تسجيل الدخول بحسابي')}<div class="muted">${p.m === 'link' ? 'اختر كلمة مرور من 8 خانات على الأقل، فيها حروف وأرقام. سنرسل رابط تأكيد إلى بريدك.' : 'سيُستبدل الحساب الحالي على هذا الجهاز بالحساب الذي تدخل إليه. يجب أن يكون البريد مؤكَّداً.'}</div>
    <input id="em" type="email" placeholder="البريد الإلكتروني" style="direction:ltr;margin-top:10px" autocomplete="email"><input id="pw" type="password" placeholder="كلمة المرور" style="direction:ltr;margin-top:8px" autocomplete="${p.m === 'link' ? 'new-password' : 'current-password'}">
    <div class="acts"><button class="btn wide" data-a="${p.m === 'link' ? 'linkEmail' : 'recoverEmail'}">${p.m === 'link' ? 'اربط وأرسل رابط التأكيد' : 'دخول'}</button>${p.m === 'link' ? '' : '<button class="btn ghost sm" data-a="resetPw">نسيت كلمة المرور</button>'}</div>`);
  if (p.k === 'group') {
    const ok = ui.friends.filter(f => f.st === 'ok');
    return sheet(`${sheetHead('مجموعة جديدة')}<input id="gtitle" maxlength="30" placeholder="اسم المجموعة، مثلاً: سهرة الخميس">
      <div class="muted" style="margin-top:10px">من في المجموعة؟</div>${ok.map(f => `<button class="li" data-a="gmT" data-gm="${f.id}" style="width:100%;text-align:start">${avatarHTML(pav(f), f.name, 'sm')}<div class="t"><b>${esc(f.name)}</b></div><span class="ic">${ICON.check}</span></button>`).join('') || '<div class="empty">أضف أصدقاء أولاً.</div>'}
      <div class="acts"><button class="btn wide" data-a="mkGroup">أنشئ المجموعة</button></div>`);
  }
  if (p.k === 'friend') { const f = ui.friends.find(x => x.id === p.f) || {}; return sheet(`${sheetHead(esc(f.name || ''))}<div class="acts"><button class="btn" data-a="dm" data-f="${p.f}">${ICON.chat} رسالة</button><button class="btn red" data-a="unfriend" data-f="${p.f}">احذفه من الأصدقاء</button></div>`); }
  if (p.k === 'av') {
    const [c] = (ui.obAv || prof.av).split('|'), sel = ui.obAv || prof.av;
    return sheet(`${sheetHead('صورتك')}<div class="avpick">${AVG.concat(['A']).slice(0, 10).map(g => `<button data-a="obAv" data-v="${c}|${g}" class="${sel === c + '|' + g ? 'on' : ''}">${avatarHTML(c + '|' + g, prof.name)}</button>`).join('')}</div>
      <div class="swatches">${AVC.map((col, i) => `<button data-a="obCol" data-v="${i}" class="${+c === i ? 'on' : ''}" style="background:${col}" aria-label="لون ${i + 1}"></button>`).join('')}</div>
      <div class="acts"><button class="btn alt" data-a="pickPhoto">📷 صورة من جهازي</button>${prof.photo ? '<button class="btn ghost" data-a="rmPhoto">إزالة الصورة</button>' : ''}<button class="btn" data-a="avSave" style="flex:1">حفظ</button></div>`);
  }
  return '';
}
function dmView() {
  const c = ui.chats.find(x => x.id === (ui.dm && ui.dm.id)) || { id: ui.dm.id, members: [], names: {} };
  return `<div class="chatv"><div class="hd"><button class="ic" data-a="closeChat" aria-label="رجوع">${ICON.back}</button>${chatAv(c)}<div style="flex:1"><b>${esc(chatTitle(c))}</b>${c.group ? `<div class="muted">${(c.members || []).map(m => esc((c.names || {})[m] || '')).join('، ')}</div>` : ''}</div>${ui.mode === 'fb' ? `<button class="btn sm" data-a="invite" data-to="${c.id}">ادعُ إلى الغرفة</button>` : ''}</div>
  <div class="msgs" id="dmmsgs">${ui.dmMsgs.map(m => {
    const mine = m.by === fb.uid;
    if (m.kind === 'invite') return `<div class="msg inv ${mine ? 'me' : ''}"><small>${esc(m.name)}</small>🎴 دعوة لغرفة <b>${esc(GG(m.game).name)}</b> · <span dir="ltr">${esc(m.room)}</span>${mine ? '' : `<div style="margin-top:6px"><button class="btn sm" data-a="acceptInv" data-r="${esc(m.room)}">ادخل الغرفة</button></div>`}</div>`;
    return `<div class="msg ${mine ? 'me' : ''}">${c.group && !mine ? `<small>${esc(m.name)}</small>` : ''}${esc(m.text)}</div>`;
  }).join('') || '<div class="empty">قل مرحباً 👋</div>'}</div>
  <div class="inp"><input id="dmin" class="grow" placeholder="اكتب رسالة" maxlength="300"><button class="ic on" data-a="sendDM" aria-label="أرسل">${ICON.send}</button></div></div>${toastHTML()}`;
}
function lobby() {
  const G = GG(ui.room && ui.room.game || 'mor'), host = isHost(), mine = ui.players.find(p => p.id === uid);
  if (G.id === 'mafia') return mafiaLobby();
  if (G.id === 'coup') return coupLobby();
  const teams = G.teams;
  const seat = s => {
    const p = ui.players.find(x => x.seat === s), me = p && p.id === uid;
    const hostTag = p && ui.room && p.id === ui.room.host ? ' 👑' : '';
    return `<button class="st s${(s - (mine && mine.seat >= 0 ? mine.seat : 0) + 4) % 4} ${me ? 'me' : ''}" data-a="sit" data-s="${s}">
      ${p ? avatarHTML(pav(p), p.name) : '<span class="empty-seat">+</span>'}<span>${p ? esc(p.name) + hostTag : 'اجلس هنا'}</span>${teams ? `<span class="team" style="color:${TC[s % 2]}">${TEAM[s % 2]}</span>` : ''}</button>`;
  };
  const watchers = ui.players.filter(p => p.seat < 0);
  const sat = ui.players.filter(p => p.seat >= 0).length;
  const shown = esc(ui.code === location.hostname ? (myIp() || ui.code) : ui.code);
  return `<div class="scr"><div class="in">
  <div class="hdr"><button class="ic" data-a="exit" aria-label="اخرج">${ICON.x}</button><h1>الغرفة</h1>
    <button class="ic" data-a="chat" aria-label="الدردشة">${ICON.chat}${ui.unread ? `<span class="badge">${ui.unread}</span>` : ''}</button>
    ${voiceBtns()}</div>
  <div class="card" style="text-align:center;padding:12px">${ui.mode === 'lan' ? `<div class="muted">يكتب أصدقاؤك هذا العنوان في «دخول برمز»</div><div class="roomcode" style="font-size:32px;letter-spacing:2px">${shown}</div><div class="acts" style="justify-content:center;margin-top:8px"><button class="btn sm" data-a="shareRoom">${ICON.share} شارك الدعوة</button></div><div class="muted">أو من المتصفح: <b dir="ltr">http://${shown}:${PORT}</b></div>`
    : `<div class="muted">رمز الغرفة</div><div class="roomcode">${esc(ui.code)}</div><div class="acts" style="justify-content:center;margin-top:8px"><button class="btn sm" data-a="shareRoom">${ICON.share} شارك الدعوة</button><button class="btn alt sm" data-a="copyCode">${ICON.copy} انسخ</button>${online() ? `<button class="btn sm" data-a="invitePop">${ICON.invite} ادعُ أصدقاء</button>` : ''}</div>`}</div>
  <div class="gsel">${gameIcon(G, 26)}<div style="flex:1"><div class="muted">اللعبة</div><b>${esc(G.name)}</b><div class="muted" style="font-size:12px">${esc(G.sub)}</div></div>${host ? `<button class="btn alt sm" data-a="gamePick">غيّر</button>` : ''}<button class="ic" data-a="rules" data-g="${G.id}" aria-label="القوانين">${ICON.info}</button></div>
  <div class="minitable"><div class="felt">${teams ? 'المتقابلان فريق واحد' : 'كلٌّ بمفرده'}<br>اضغط على مقعد لتجلس</div>${[0, 1, 2, 3].map(seat).join('')}</div>
  ${watchers.length ? `<div class="muted" style="text-align:center">يشاهدون: </div><div class="spect" style="justify-content:center">${watchers.map(p => `<span class="chip">${avatarHTML(pav(p), p.name, 'xs')} ${esc(p.name)}</span>`).join('')}</div>` : ''}
  ${host ? `<div class="card"><h2>⏱️ وقت الدور</h2><div class="muted">إذا انتهى الوقت يلعب الكمبيوتر عن اللاعب.</div><div class="seg" style="margin-top:8px">${[0, 15, 30, 60].map(v => `<button class="${(+(ui.room && ui.room.timer) || 0) === v ? 'on' : ''}" data-a="setTimer" data-v="${v}">${v ? v + ' ثانية' : 'بلا وقت'}</button>`).join('')}</div></div>` : (ui.room && +ui.room.timer ? `<p class="muted" style="text-align:center">⏱️ وقت الدور: ${ui.room.timer} ثانية</p>` : '')}
  ${host ? `<div class="acts"><button class="btn wide" data-a="start" ${sat === 4 ? '' : 'disabled'}>ابدأ اللعب</button>${sat < 4 ? `<button class="btn alt wide" data-a="startBots" ${sat ? '' : 'disabled'}>${ICON.bot} ابدأ وأكمل المقاعد الفارغة ببوتات</button>` : ''}</div>`
    : `<p class="muted" style="text-align:center">يختار صاحب الغرفة اللعبة ويبدأ. ومن لا يجلس يشاهد.</p>`}
  </div></div>${ui.chatOpen ? chatPanel() : ''}${pops()}${ui.confirmExit ? exitBox() : ''}${toastHTML()}`;
}
const exitBox = () => sheet(`<h2>هل تريد الخروج؟</h2><p class="muted">${ui.mode === 'local' ? 'تُحفظ اللعبة ويمكنك إكمالها لاحقاً.' : 'ستخرج من الغرفة، ويمكنك العودة بالرمز نفسه.'}</p><div class="acts"><button class="btn red" data-a="leave">نعم، اخرج</button><button class="btn alt" data-a="stay">لا، أكمل</button></div>`, 'stay', true);
