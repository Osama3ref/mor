// ---------- rooms ----------
function genCode() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
async function createRoom(mode) {
  if (!myName()) return toast('اكتب اسمك أولاً من «حسابي»');
  ui.pop = null; ui.mode = mode; let key;
  try { key = await B().create(); } catch (e) { ui.mode = null; return toast(mode === 'lan' ? 'تعذّر فتح الغرفة على الشبكة' : 'تعذّر إنشاء الغرفة، تأكد من الإنترنت'); }
  joinRoom(mode, key);
}
function joinAny(raw) {
  const k = (raw || '').trim();
  if (/^[\d.]+$|^localhost$/i.test(k)) return joinRoom('lan', k);
  if (/^[a-z0-9]{4}$/i.test(k)) { if (!online()) return toast('اللعب عبر الإنترنت غير متاح الآن، تأكد من الاتصال'); return joinRoom('fb', k); }
  toast('اكتب رمز الغرفة (4 أحرف) أو عنوان المضيف مثل 192.168.1.5');
}
async function joinRoom(mode, key) {
  const n = myName(); if (!n) return toast('اكتب اسمك أولاً من «حسابي»');
  key = (key || '').trim(); if (mode === 'fb') key = key.toUpperCase();
  unsub.forEach(u => u()); unsub = [];
  if (mode === 'fb' && fb.uid) uid = fb.uid;
  cancelBot();
  Object.assign(ui, { mode, code: key, st: null, room: null, players: [], chat: [], unread: 0, pop: null });
  prevSt = null;
  try { await B().open(key, n); } catch (e) { ui.mode = null; ui.code = null; return toast(e.message || 'تعذّر الدخول'); }
  if (ui.view !== 'game') ui.view = 'room';
  ls.set('mor-room', { mode, key }); render();
}
async function sit(seat) {
  const taken = ui.players.find(p => p.seat === seat && p.id !== uid);
  if (taken) return toast('المقعد محجوز');
  const mine = ui.players.find(p => p.id === uid);
  SFX.tap();
  await B().setSeat(mine && mine.seat === seat ? -1 : seat).catch(() => toast('تعذّر الجلوس'));
}
async function setRoomGame(gid) {
  if (gid !== 'mafia' && gid !== 'coup') prof.lastGame = gid; saveProf(); ui.pop = null;
  try { await B().meta({ game: gid }); } catch (e) { toast('تعذّر تغيير اللعبة'); }
  render();
}
async function startOnline(withBots) {
  if (ui.room && ui.room.game === 'mafia') return startMafia();
  if (ui.room && ui.room.game === 'coup') return startCoup();
  const bySeat = [0, 1, 2, 3].map(s => ui.players.find(p => p.seat === s));
  if (!withBots && bySeat.some(p => !p)) return toast('يلزم 4 لاعبين جالسين، أو أكمل بالبوتات');
  if (bySeat.every(p => !p)) return toast('اجلس على مقعد أولاً');
  const bots = bySeat.map(p => !p);
  const G = GG(ui.room && ui.room.game || 'mor');
  const st = G.newGame(bySeat.map((p, i) => p ? p.name : 'بوت ' + (i + 1)), bots);
  st.seats = bySeat.map(p => p ? p.id : null); st.avs = bySeat.map(p => p ? p.av || '' : 'bot'); st.deal = Date.now(); st.timer = +(ui.room && ui.room.timer) || 0;
  ui.st = { v: (ui.room && ui.room.sv) || 0 }; ui.order = {};
  await commit(st);
}
async function backToRoom() {
  if (!isHost()) return;
  try { await B().meta({ phase: 'lobby' }); } catch (e) { toast('تعذّرت العودة إلى الغرفة'); }
}
function leave() {
  cancelBot();
  if (vc.on) voiceLeave();
  if (ui.mode === 'lan' || ui.mode === 'fb') B().leave();
  unsub.forEach(u => u()); unsub = [];
  Object.assign(ui, { view: 'home', tab: 'home', mode: null, code: null, room: null, st: null, players: [], confirmExit: false, chatOpen: false, chat: [], dblSel: [], pop: null });
  if (fb.uid) uid = fb.uid;
  prevSt = null; ls.set('mor-room', null); render();
}
function localSetup(kind) {
  if (kind === 'solo') return { names: [myName() || 'أنا', 'بوت ١', 'بوت ٢', 'بوت ٣'], bots: [false, true, true, true], avs: [prof.av, 'bot', 'bot', 'bot'] };
  if (ui.localCfg.every(Boolean)) { toast('يجب وجود لاعب واحد على الأقل غير بوت'); return null; }
  const bots = ui.localCfg.slice(), drafts = ui.passNames = [0, 1, 2, 3].map(i => document.getElementById('ln' + i)?.value ?? '');
  return { names: drafts.map((name, i) => name.trim() || 'لاعب ' + (i + 1)), bots, avs: bots.map((b, i) => b ? 'bot' : i + '|A') };
}
function requestLocal(gid, kind) {
  const setup = localSetup(kind);
  if (!setup) return;
  if (savedGame(gid)) {
    ui.pop = { k: 'replaceLocal', g: gid, kind, setup };
    return render();
  }
  startLocal(gid, setup);
}
function startLocal(gid, setup) {
  const G = GG(gid);
  if (setup) {
    ui.st = G.newGame(setup.names, setup.bots); ui.st.deal = Date.now(); ui.st.avs = setup.avs; ls.set(saveKey(G.id), ui.st);
  } else {
    const st = savedGame(G.id);
    if (!st) return toast('لا توجد لعبة محفوظة');
    ui.st = st;
  }
  prof.lastGame = G.id; saveProf(); cancelBot();
  ui.order = {}; ui.sel.clear(); ui.armed = null; ui.sheet = null; ui.dblSel = []; ui.pop = null; prevSt = null;
  const hs = humans(ui.st), a = G.actor(ui.st);
  ui.mode = 'local'; ui.view = 'game'; ui.viewer = hs.includes(a) ? a : hs[0]; ui.hidden = hs.length > 1;
  afterState(); render();
}
async function nextRound() {
  let n; try { n = gameOf(ui.st).next(ui.st); } catch (e) { return toast(e.message); }
  n.deal = Date.now(); ui.order = {}; await commit(n);
}
async function newMatch() {
  const st = gameOf(ui.st).newGame(ui.st.names, ui.st.bots); st.seats = ui.st.seats; st.avs = ui.st.avs; st.timer = ui.st.timer; st.deal = Date.now(); ui.order = {}; await commit(st);
}
async function toggleBot(seat) {
  const st = JSON.parse(JSON.stringify(ui.st)); st.bots[seat] = !st.bots[seat];
  st.log.push(st.names[seat] + (st.bots[seat] ? ': بوت يلعب مكانه' : ': عاد ليلعب')); await commit(st);
}
function setOrient(o) { ui.orient = o; ls.set('mor-orient', o); try { native && native.setOrientation(o); } catch (e) {} render(); }

// ---------- account (Firebase) ----------
async function ensureUser() {
  const ref = fbB.ref('users', fb.uid);
  let d = {}; try { d = (await FB.getDoc(ref)).data() || {}; } catch (e) {}
  if (d.name && !prof.name) { prof.name = d.name; if (d.av) prof.av = d.av; if (d.ph) prof.photo = d.ph; saveProf(); }
  let code = d.code;
  if (!code) {
    for (let i = 0; i < 6 && !code; i++) {
      const c = String(100000 + Math.floor(Math.random() * 900000));
      try { const q = await FB.getDocs(FB.query(fbB.col('users'), FB.where('code', '==', c), FB.limit(1))); if (q.empty) code = c; } catch (e) { code = c; }
    }
  }
  prof.code = code; prof.email = fb.auth.currentUser.email || d.email || ''; saveProf();
  if (prof.name) await FB.setDoc(ref, { name: prof.name, av: prof.av, code, t: Date.now() }, { merge: true }).catch(() => {});
}
function pushProfile() {
  if (!fb.ready || !prof.name) return;
  FB.setDoc(fbB.ref('users', fb.uid), { name: prof.name, av: prof.av, ph: prof.photo || '', code: prof.code, t: Date.now() }, { merge: true }).catch(() => {});
  if (ui.mode === 'fb' && ui.code) FB.updateDoc(fbB.ref('rooms', ui.code, 'players', uid), { name: prof.name, av: prof.av, ph: prof.photo || '' }).catch(() => {});
  if (ui.mode === 'lan') lanB.setSeat((ui.players.find(p => p.id === uid) || { seat: -1 }).seat).catch(() => {});
}
const AUTHERR = { 'auth/email-already-in-use': 'هذا البريد مربوط بحساب آخر', 'auth/invalid-email': 'البريد الإلكتروني غير صحيح', 'auth/weak-password': 'كلمة المرور يجب أن تكون 6 خانات على الأقل', 'auth/wrong-password': 'البريد أو كلمة المرور غير صحيحة', 'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة', 'auth/user-not-found': 'لا يوجد حساب بهذا البريد', 'auth/credential-already-in-use': 'هذا البريد مربوط بحساب آخر', 'auth/operation-not-allowed': 'ربط البريد غير مفعّل بعد', 'auth/network-request-failed': 'تأكد من الإنترنت', 'auth/too-many-requests': 'محاولات كثيرة، حاول بعد قليل' };
function pwError(pw) {
  if (pw.length < 8) return 'كلمة المرور يجب أن تتكوّن من 8 خانات على الأقل';
  if (!/[A-Za-z\u0600-\u06FF]/.test(pw) || !/\d/.test(pw)) return 'كلمة المرور يجب أن تحتوي على حروف وأرقام معاً';
  return '';
}
async function linkEmail() {
  const em = (document.getElementById('em')?.value || '').trim(), pw = document.getElementById('pw')?.value || '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return toast('اكتب بريداً إلكترونياً صحيحاً');
  const bad = pwError(pw); if (bad) return toast(bad);
  try {
    await FB.linkWithCredential(fb.auth.currentUser, FB.EmailAuthProvider.credential(em, pw));
    await FB.sendEmailVerification(fb.auth.currentUser).catch(() => {});
    prof.email = em; prof.emailOk = false; saveProf(); FB.setDoc(fbB.ref('users', fb.uid), { email: em, emailOk: false }, { merge: true }).catch(() => {});
    ui.pop = null; toast('أرسلنا رابط تأكيد إلى بريدك. افتحه، ثم اضغط «أكّدت بريدي»'); render();
  } catch (e) { toast(AUTHERR[e.code] || 'تعذّر ربط البريد'); }
}
async function checkVerified() {
  try {
    await FB.reload(fb.auth.currentUser);
    if (fb.auth.currentUser.emailVerified) {
      prof.emailOk = true; saveProf(); FB.setDoc(fbB.ref('users', fb.uid), { emailOk: true }, { merge: true }).catch(() => {});
      toast('تم تأكيد بريدك، وأصبح حسابك محمياً ✓');
    } else toast('لم يتأكد البريد بعد. افتح الرابط الذي وصلك (تفقّد مجلد الرسائل غير المرغوبة)');
  } catch (e) { toast('تعذّر التحقق، تأكد من الاتصال'); }
  render();
}
async function resendVerify() {
  try { await FB.sendEmailVerification(fb.auth.currentUser); toast('أعدنا إرسال رابط التأكيد'); } catch (e) { toast(AUTHERR[e.code] || 'تعذّر الإرسال، حاول لاحقاً'); }
}
async function resetPw() {
  const em = (document.getElementById('em')?.value || '').trim();
  if (!em) return toast('اكتب بريدك أولاً');
  try { await FB.sendPasswordResetEmail(fb.auth, em); toast('أرسلنا رابط تغيير كلمة المرور إلى بريدك'); } catch (e) { toast(AUTHERR[e.code] || 'تعذّر الإرسال'); }
}
async function recoverEmail() {
  const em = (document.getElementById('em')?.value || '').trim(), pw = document.getElementById('pw')?.value || '';
  if (!em || !pw) return toast('اكتب البريد الإلكتروني وكلمة المرور');
  try {
    socialStop();
    await FB.signInWithEmailAndPassword(fb.auth, em, pw);
    if (!fb.auth.currentUser.emailVerified) {
      await FB.sendEmailVerification(fb.auth.currentUser).catch(() => {});
      await FB.signOut(fb.auth); await FB.signInAnonymously(fb.auth);
      fb.uid = fb.auth.currentUser.uid; if (!ui.mode) uid = fb.uid; await ensureUser(); socialStart();
      return toast('هذا البريد لم يُؤكَّد بعد. أرسلنا إليه رابط التأكيد، أكّده ثم حاول مجدداً');
    }
    fb.uid = fb.auth.currentUser.uid; if (!ui.mode) uid = fb.uid;
    const d = (await FB.getDoc(fbB.ref('users', fb.uid))).data() || {};
    if (d.name) prof.name = d.name; if (d.av) prof.av = d.av; prof.photo = d.ph || ''; prof.email = em; prof.emailOk = true; saveProf();
    await ensureUser(); socialStart(); ui.pop = null; toast('عاد حسابك، أهلاً ' + myName()); render();
  } catch (e) { socialStart(); toast(AUTHERR[e.code] || 'تعذّر استرجاع الحساب'); }
}

// ---------- friends, messages, groups ----------
let socialUnsub = [];
const readMap = ls.get('mor-read') || {};
function socialStop() { socialUnsub.forEach(u => u()); socialUnsub = []; ui.friends = []; ui.chats = []; }
function socialStart() {
  socialStop(); if (!fb.ready) return;
  socialUnsub.push(FB.onSnapshot(fbB.col('users', fb.uid, 'friends'), s => { ui.friends = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }, () => {}));
  socialUnsub.push(FB.onSnapshot(FB.query(fbB.col('chats'), FB.where('members', 'array-contains', fb.uid)), s => {
    const before = ui.chats;
    ui.chats = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ((b.last || {}).t || 0) - ((a.last || {}).t || 0));
    for (const c of ui.chats) {
      const o = before.find(x => x.id === c.id), l = c.last;
      if (l && l.by !== fb.uid && (!o || !o.last || o.last.t !== l.t) && before.length && (!ui.dm || ui.dm.id !== c.id)) {
        toast((l.name || '') + ': ' + (l.kind === 'invite' ? 'دعاك إلى غرفة لعب' : l.text)); SFX.turn();
      }
    }
    render();
  }, () => {}));
}
const unreadChats = () => ui.chats.filter(c => c.last && c.last.by !== fb.uid && c.last.t > (readMap[c.id] || 0)).length;
const friendReqs = () => ui.friends.filter(f => f.st === 'in').length;
async function addFriend() {
  const code = (document.getElementById('fcode')?.value || '').trim();
  if (!/^\d{6}$/.test(code)) return toast('المعرّف (ID) من 6 أرقام');
  if (code === prof.code) return toast('هذا معرّفك (ID) 🙂');
  try {
    const q = await FB.getDocs(FB.query(fbB.col('users'), FB.where('code', '==', code), FB.limit(1)));
    if (q.empty) return toast('لم أجد أحداً بهذا الـ ID');
    const t = q.docs[0], td = t.data();
    const ex = ui.friends.find(f => f.id === t.id);
    if (ex && ex.st === 'ok') return toast('إنه صديقك بالفعل');
    if (ex && ex.st === 'in') return acceptFriend(t.id);
    await FB.setDoc(fbB.ref('users', fb.uid, 'friends', t.id), { st: 'out', name: td.name || '', av: td.av || '', ph: td.ph || '', code, t: Date.now() });
    await FB.setDoc(fbB.ref('users', t.id, 'friends', fb.uid), { st: 'in', name: prof.name, av: prof.av, ph: prof.photo || '', code: prof.code, t: Date.now() });
    document.getElementById('fcode').value = ''; toast('أُرسل طلب الصداقة إلى ' + (td.name || code));
  } catch (e) { console.error(e); toast('تعذّر إرسال الطلب'); }
}
async function acceptFriend(id) {
  try {
    await FB.updateDoc(fbB.ref('users', fb.uid, 'friends', id), { st: 'ok', t: Date.now() });
    await FB.setDoc(fbB.ref('users', id, 'friends', fb.uid), { st: 'ok', name: prof.name, av: prof.av, ph: prof.photo || '', code: prof.code, t: Date.now() }, { merge: true });
    toast('أصبحتما صديقين');
  } catch (e) { toast('لم ينجح، حاول مرة أخرى'); }
}
async function dropFriend(id) {
  ui.pop = null;
  await FB.deleteDoc(fbB.ref('users', fb.uid, 'friends', id)).catch(() => {});
  await FB.deleteDoc(fbB.ref('users', id, 'friends', fb.uid)).catch(() => {});
  render();
}
async function openDM(fid) {
  const f = ui.friends.find(x => x.id === fid); if (!f) return;
  const cid = 'dm_' + [fb.uid, fid].sort().join('_');
  try { await FB.setDoc(fbB.ref('chats', cid), { members: [fb.uid, fid], group: false, names: { [fb.uid]: prof.name, [fid]: f.name }, avs: { [fb.uid]: prof.av, [fid]: f.av || '' } }, { merge: true }); }
  catch (e) { return toast('تعذّر فتح المحادثة'); }
  openChat(cid);
}
async function createGroup() {
  const title = (document.getElementById('gtitle')?.value || '').trim();
  const picked = [...document.querySelectorAll('[data-gm].on')].map(x => x.dataset.gm);
  if (!title) return toast('سمِّ المجموعة'); if (!picked.length) return toast('اختر صديقاً واحداً على الأقل');
  const members = [fb.uid, ...picked], names = { [fb.uid]: prof.name }, avs = { [fb.uid]: prof.av };
  picked.forEach(id => { const f = ui.friends.find(x => x.id === id); names[id] = f ? f.name : ''; avs[id] = f ? f.av || '' : ''; });
  try {
    const r = await FB.addDoc(fbB.col('chats'), { members, group: true, title: title.slice(0, 30), names, avs, owner: fb.uid, last: { text: 'أُنشئت المجموعة', t: Date.now(), by: fb.uid, name: prof.name } });
    ui.pop = null; openChat(r.id);
  } catch (e) { toast('تعذّر إنشاء المجموعة'); }
}
let dmUnsub = null;
function openChat(cid) {
  if (dmUnsub) dmUnsub();
  ui.dm = { id: cid }; ui.dmMsgs = []; ui.view = 'dm'; render();
  dmUnsub = FB.onSnapshot(FB.query(fbB.col('chats', cid, 'msgs'), FB.orderBy('t', 'desc'), FB.limit(60)), s => {
    ui.dmMsgs = s.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
    readMap[cid] = Date.now(); ls.set('mor-read', readMap); render();
  }, () => toast('تعذّر جلب الرسائل'));
}
function closeChat() { if (dmUnsub) dmUnsub(); dmUnsub = null; if (ui.dm) { readMap[ui.dm.id] = Date.now(); ls.set('mor-read', readMap); } ui.dm = null; ui.view = 'home'; render(); }
async function sendDM(kind = 'text', extra = {}, cid) {
  cid = cid || (ui.dm && ui.dm.id); if (!cid) return;
  let text = '';
  if (kind === 'text') { const el = document.getElementById('dmin'); text = (el && el.value || '').trim(); if (!text) return; el.value = ''; }
  else text = 'دعوة لغرفة ' + (extra.game ? GG(extra.game).name : '');
  const m = { by: fb.uid, name: prof.name, text: text.slice(0, 300), t: Date.now(), kind, ...extra };
  try { await FB.addDoc(fbB.col('chats', cid, 'msgs'), m); await FB.updateDoc(fbB.ref('chats', cid), { last: { text: m.text, t: m.t, by: fb.uid, name: prof.name, kind } }); }
  catch (e) { toast('لم تُرسل'); }
}
async function inviteTo(target) {
  if (ui.mode !== 'fb') return;
  let cid = target;
  if (target.startsWith('f:')) {
    const fid = target.slice(2), f = ui.friends.find(x => x.id === fid);
    cid = 'dm_' + [fb.uid, fid].sort().join('_');
    await FB.setDoc(fbB.ref('chats', cid), { members: [fb.uid, fid], group: false, names: { [fb.uid]: prof.name, [fid]: f ? f.name : '' }, avs: { [fb.uid]: prof.av, [fid]: f ? f.av || '' : '' } }, { merge: true }).catch(() => {});
  }
  await sendDM('invite', { room: ui.code, game: ui.room && ui.room.game || 'mor' }, cid);
  toast('أُرسلت الدعوة');
}
function chatTitle(c) {
  if (c.group) return c.title || 'مجموعة';
  const o = (c.members || []).find(x => x !== fb.uid); return (c.names || {})[o] || 'صديق';
}
function chatAv(c) {
  if (c.group) return `<span class="avt sm" style="background:linear-gradient(135deg,var(--gold),var(--gold2));color:var(--btnink)">${ICON.group.replace('<svg', '<svg style="width:60%"')}</span>`;
  const o = (c.members || []).find(x => x !== fb.uid); return avatarHTML((c.avs || {})[o], chatTitle(c), 'sm');
}
