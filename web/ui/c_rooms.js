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
  if (prof.name) await FB.setDoc(ref, { name: prof.name, nameKey: nameKey(prof.name), av: prof.av, code, t: Date.now() }, { merge: true }).catch(() => {});
}
function pushProfile() {
  if (!fb.ready || !prof.name) return;
  FB.setDoc(fbB.ref('users', fb.uid), { name: prof.name, nameKey: nameKey(prof.name), av: prof.av, ph: prof.photo || '', code: prof.code, t: Date.now() }, { merge: true }).catch(() => {});
  if (ui.mode === 'fb' && ui.code) FB.updateDoc(fbB.ref('rooms', ui.code, 'players', uid), { name: prof.name, av: prof.av, ph: prof.photo || '' }).catch(() => {});
  if (ui.mode === 'lan') lanB.setSeat((ui.players.find(p => p.id === uid) || { seat: -1 }).seat).catch(() => {});
}
const AUTHERR = { 'auth/email-already-in-use': 'هذا البريد مربوط بحساب آخر', 'auth/invalid-email': 'البريد الإلكتروني غير صحيح', 'auth/weak-password': 'كلمة المرور يجب أن تكون 6 خانات على الأقل', 'auth/wrong-password': 'البريد أو كلمة المرور غير صحيحة', 'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة', 'auth/user-not-found': 'لا يوجد حساب بهذا البريد', 'auth/credential-already-in-use': 'هذا البريد مربوط بحساب آخر', 'auth/operation-not-allowed': 'ربط البريد غير مفعّل بعد', 'auth/network-request-failed': 'تأكد من الإنترنت', 'auth/too-many-requests': 'محاولات كثيرة، حاول بعد قليل' };
function pwError(pw) {
  if (pw.length < 8) return 'كلمة المرور يجب أن تتكوّن من 8 خانات على الأقل';
  if (!/[A-Za-z\u0600-\u06FF]/.test(pw) || !/\d/.test(pw)) return 'كلمة المرور يجب أن تحتوي على حروف وأرقام معاً';
  return '';
}
// ---------- first launch: guest bound to this device, or a named account with email + password ----------
const GUEST_DOM = '@guest.sahra-waraq.app';
async function sha(t) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch (e) { let h = 2166136261, o = ''; for (let k = 0; k < 8; k++) { for (const ch of t + k) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; o += h.toString(16).padStart(8, '0'); } return o; }
}
async function guestCreds() {
  let id = ''; try { id = native && native.deviceId ? native.deviceId() : ''; } catch (e) {}
  if (!id) return null; const h = await sha('sahra-waraq:' + id);
  return { em: 'g' + h.slice(0, 24) + GUEST_DOM, pw: 'Gx' + h.slice(24, 48) };
}
const isGuestEmail = e => !!e && e.endsWith(GUEST_DOM);
async function afterSignIn(defaults) {
  fb.uid = fb.auth.currentUser.uid; if (!ui.mode) uid = fb.uid;
  const d = (await FB.getDoc(fbB.ref('users', fb.uid)).catch(() => null))?.data?.() || {};
  const back = !!d.name;
  if (d.name) { prof.name = d.name; if (d.av) prof.av = d.av; prof.photo = d.ph || ''; }
  else if (defaults) Object.assign(prof, defaults);
  const em = fb.auth.currentUser.email || '';
  prof.email = isGuestEmail(em) ? (d.email || '') : em; prof.emailOk = !!(em && !isGuestEmail(em) && fb.auth.currentUser.emailVerified) || !!d.emailOk;
  saveProf(); ls.set('mor-name', prof.name); await ensureUser(); pushProfile(); socialStart();
  return back;
}
async function welGuest() {
  if (!fb.ready) return toast('جارٍ الاتصال… حاول بعد لحظة');
  ui.busy = true; render();
  try {
    socialStop(); const c = await guestCreds(); let back = false;
    if (c) {
      try { await FB.signInWithEmailAndPassword(fb.auth, c.em, c.pw); back = true; }
      catch (e) {
        if (!fb.auth.currentUser) await FB.signInAnonymously(fb.auth);
        await FB.linkWithCredential(fb.auth.currentUser, FB.EmailAuthProvider.credential(c.em, c.pw));
      }
    }
    let nm = ''; for (let i = 0; i < 6 && !nm; i++) { const t = 'ضيف' + (1000 + Math.floor(Math.random() * 9000)); if (!(await nameTaken(t))) nm = t; }
    const restored = await afterSignIn({ name: nm || 'ضيف' + Date.now() % 100000, av: Math.floor(Math.random() * AVC.length) + '|' + AVG[Math.floor(Math.random() * AVG.length)] });
    prof.guest = true; prof.acct = false; saveProf();
    toast(back && restored ? 'أهلاً من جديد ' + prof.name + '، عرفنا جهازك 👋' : 'دخلت ضيفاً باسم ' + prof.name + '، ويمكنك تغييره من «حسابي»');
  } catch (e) { console.error(e); toast(AUTHERR[e.code] || 'تعذّر الدخول ضيفاً، تأكد من الإنترنت'); }
  ui.busy = false; render();
}
async function welCreate() {
  if (!fb.ready) return toast('جارٍ الاتصال… حاول بعد لحظة');
  const n = (document.getElementById('obn')?.value || '').trim(), em = (document.getElementById('em')?.value || '').trim(), pw = document.getElementById('pw')?.value || '';
  const bad = nameError(n) || await nameTaken(n); if (bad) return toast(bad);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return toast('اكتب بريداً إلكترونياً صحيحاً');
  const pb = pwError(pw); if (pb) return toast(pb);
  ui.busy = true; render();
  try {
    if (!fb.auth.currentUser) await FB.signInAnonymously(fb.auth);
    await FB.linkWithCredential(fb.auth.currentUser, FB.EmailAuthProvider.credential(em, pw));
    await FB.sendEmailVerification(fb.auth.currentUser).catch(() => {});
    prof.name = n; if (ui.obAv) prof.av = ui.obAv; ui.obAv = null; prof.acct = true; prof.guest = false;
    await afterSignIn(); prof.email = em; prof.emailOk = false; saveProf();
    FB.setDoc(fbB.ref('users', fb.uid), { email: em, emailOk: false }, { merge: true }).catch(() => {});
    ui.wel = null; SFX.deal(); toast('أُنشئ حسابك! أرسلنا رابط تأكيد إلى بريدك');
  } catch (e) { toast(AUTHERR[e.code] || 'تعذّر إنشاء الحساب'); }
  ui.busy = false; render();
}
// sign in with a username or an email
async function loginWith(idv, pw) {
  let ems = [idv];
  if (!idv.includes('@')) {
    const q = await FB.getDocs(FB.query(fbB.col('users'), FB.where('nameKey', '==', nameKey(idv)), FB.limit(1)));
    if (q.empty) { const e = new Error('nouser'); e.code = 'auth/user-not-found'; throw e; }
    const d = q.docs[0].data(); ems = [d.email, d.alt].filter(Boolean);
    if (!ems.length) { const e = new Error('noemail'); e.code = 'sahra/no-account'; throw e; }
  }
  let err; for (const em of ems) { try { await FB.signInWithEmailAndPassword(fb.auth, em, pw); return; } catch (e) { err = e; } }
  throw err;
}
async function welSignIn() {
  if (!fb.ready) return toast('جارٍ الاتصال… حاول بعد لحظة');
  const idv = (document.getElementById('em')?.value || '').trim(), pw = document.getElementById('pw')?.value || '';
  if (!idv || !pw) return toast('اكتب اسم المستخدم أو البريد، وكلمة المرور');
  ui.busy = true; render();
  try {
    socialStop(); await loginWith(idv, pw);
    await afterSignIn(); prof.acct = true; prof.guest = false; saveProf(); ui.wel = null; ui.pop = null;
    toast('أهلاً بعودتك ' + prof.name);
  } catch (e) {
    if (!fb.auth.currentUser) await FB.signInAnonymously(fb.auth).catch(() => {});
    if (fb.auth.currentUser) { fb.uid = fb.auth.currentUser.uid; if (prof.name) socialStart(); }
    toast(e.code === 'sahra/no-account' ? 'هذا الاسم ليس له حساب بكلمة مرور (ربما دخل ضيفاً)' : e.code === 'auth/user-not-found' ? 'لا يوجد حساب بهذا الاسم أو البريد' : AUTHERR[e.code] || 'تعذّر تسجيل الدخول');
  }
  ui.busy = false; render();
}
async function logout() {
  ui.pop = null; socialStop();
  try { await FB.signOut(fb.auth); await FB.signInAnonymously(fb.auth); fb.uid = fb.auth.currentUser.uid; uid = fb.uid; } catch (e) {}
  ['name', 'email', 'emailOk', 'acct', 'guest', 'code', 'photo'].forEach(k => delete prof[k]); prof.name = ''; saveProf(); ui.wel = null; ui.tab = 'home'; render();
}
async function linkEmail() {
  const em = (document.getElementById('em')?.value || '').trim(), pw = document.getElementById('pw')?.value || '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return toast('اكتب بريداً إلكترونياً صحيحاً');
  const bad = pwError(pw); if (bad) return toast(bad);
  try {
    const cu = fb.auth.currentUser;
    if (isGuestEmail(cu.email)) {
      // a device guest already has an email login: give it the user's password, then move it to the real email once confirmed
      await FB.updatePassword(cu, pw); await FB.verifyBeforeUpdateEmail(cu, em);
      FB.setDoc(fbB.ref('users', fb.uid), { email: em, alt: cu.email, emailOk: false }, { merge: true }).catch(() => {});
    } else {
      await FB.linkWithCredential(cu, FB.EmailAuthProvider.credential(em, pw));
      await FB.sendEmailVerification(cu).catch(() => {});
      FB.setDoc(fbB.ref('users', fb.uid), { email: em, emailOk: false }, { merge: true }).catch(() => {});
    }
    prof.email = em; prof.emailOk = false; prof.acct = true; prof.guest = false; saveProf();
    ui.pop = null; toast('أرسلنا رابط تأكيد إلى بريدك. افتحه، ثم اضغط «أكّدت بريدي». بعدها تدخل باسمك وكلمة المرور'); render();
  } catch (e) { toast(AUTHERR[e.code] || 'تعذّر ربط البريد'); }
}
async function checkVerified() {
  try {
    await FB.reload(fb.auth.currentUser);
    if (fb.auth.currentUser.emailVerified && !isGuestEmail(fb.auth.currentUser.email)) {
      prof.emailOk = true; saveProf(); FB.setDoc(fbB.ref('users', fb.uid), { emailOk: true }, { merge: true }).catch(() => {});
      toast('تم تأكيد بريدك، وأصبح حسابك محمياً ✓');
    } else toast('لم يتأكد البريد بعد. افتح الرابط الذي وصلك (تفقّد مجلد الرسائل غير المرغوبة)');
  } catch (e) {
    if (/token|requires-recent-login|user-disabled|user-not-found/.test(e.code || '')) { ui.pop = { k: 'email', m: 'rec' }; toast('تأكّد بريدك! سجّل الدخول الآن باسمك وكلمة المرور'); }
    else toast('تعذّر التحقق، تأكد من الاتصال');
  }
  render();
}
async function resendVerify() {
  try { await FB.sendEmailVerification(fb.auth.currentUser); toast('أعدنا إرسال رابط التأكيد'); } catch (e) { toast(AUTHERR[e.code] || 'تعذّر الإرسال، حاول لاحقاً'); }
}
async function resetPw() {
  let em = (document.getElementById('em')?.value || '').trim();
  if (!em) return toast('اكتب اسم المستخدم أو البريد أولاً');
  try {
    if (!em.includes('@')) {
      const q = await FB.getDocs(FB.query(fbB.col('users'), FB.where('nameKey', '==', nameKey(em)), FB.limit(1)));
      em = q.empty ? '' : q.docs[0].data().email || ''; if (!em) return toast('لا يوجد بريد مربوط بهذا الاسم');
    }
    await FB.sendPasswordResetEmail(fb.auth, em); toast('أرسلنا رابط تغيير كلمة المرور إلى البريد المربوط');
  } catch (e) { toast(AUTHERR[e.code] || 'تعذّر الإرسال'); }
}
async function recoverEmail() { return welSignIn(); }

// ---------- friends, messages, groups ----------
let socialUnsub = [];
const readMap = ls.get('mor-read') || {};
function socialStop() { socialUnsub.forEach(u => u()); socialUnsub = []; ui.friends = []; ui.chats = []; Object.values(presSub).forEach(u => u()); presSub = {}; ui.pres = {}; clearInterval(presTick.iv); }
// ---------- friends presence: online / in a room, refreshed every minute while the app is open ----------
let presSub = {};
function presTick() {
  if (!fb.ready || !fb.uid || document.hidden) return;
  const inRoom = ui.mode === 'fb' && ui.code;
  FB.setDoc(fbB.ref('users', fb.uid), { seen: Date.now(), room: inRoom ? ui.code : '', rgame: inRoom ? (ui.room && ui.room.game || 'mor') : '', playing: !!(inRoom && ui.st) }, { merge: true }).catch(() => {});
}
function presWatch() {
  const ids = ui.friends.filter(f => f.st === 'ok').map(f => f.id);
  for (const id of Object.keys(presSub)) if (!ids.includes(id)) { presSub[id](); delete presSub[id]; }
  for (const id of ids) if (!presSub[id]) presSub[id] = FB.onSnapshot(fbB.ref('users', id), d => { const x = d.data() || {}; ui.pres[id] = { seen: x.seen || 0, room: x.room || '', game: x.rgame || '', playing: !!x.playing }; render(); }, () => {});
}
function presOf(fid) {
  const p = (ui.pres || {})[fid]; if (!p || Date.now() - p.seen > 150000) return { on: false, label: p && p.seen ? 'آخر ظهور ' + agoText(p.seen) : 'غير متصل' };
  if (p.room) return { on: true, room: p.room, label: (p.playing ? 'يلعب ' : 'في غرفة ') + GG(p.game || 'mor').name };
  return { on: true, label: 'متصل الآن' };
}
function agoText(t) { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? 'منذ ' + Math.max(1, m) + ' د' : m < 1440 ? 'منذ ' + Math.round(m / 60) + ' س' : 'منذ ' + Math.round(m / 1440) + ' يوم'; }
function socialStart() {
  socialStop(); if (!fb.ready) return; ui.notes = ls.get('mor-notes') || []; ui.pres = {};
  presTick(); presTick.iv = setInterval(presTick, 60000);
  if (!presTick.vis) { presTick.vis = 1; document.addEventListener('visibilitychange', () => { if (!document.hidden) presTick(); }); }
  try { native && native.askNotify && native.askNotify(); } catch (e) {}
  socialUnsub.push(FB.onSnapshot(fbB.col('users', fb.uid, 'friends'), s => {
    const before = ui.friends; ui.friends = s.docs.map(d => ({ id: d.id, ...d.data() }));
    const seen = ls.get('mor-seenfr') || {};
    for (const f of ui.friends) {
      const o = before.find(x => x.id === f.id), key = f.id + ':' + f.st;
      if (seen[key]) continue;
      if (f.st === 'in') pushNote({ ic: '👋', title: 'طلب صداقة جديد', body: (f.name || 'لاعب') + ' يريد أن يضيفك صديقاً', a: 'tab', d: { t: 'friends' } });
      else if (f.st === 'ok' && o && o.st === 'out') pushNote({ ic: '🤝', title: 'قُبل طلبك', body: (f.name || '') + ' أصبح صديقك', a: 'dm', d: { f: f.id } });
      seen[key] = 1;
    }
    ls.set('mor-seenfr', seen); presWatch(); render();
  }, () => {}));
  socialUnsub.push(FB.onSnapshot(FB.query(fbB.col('chats'), FB.where('members', 'array-contains', fb.uid)), s => {
    const before = ui.chats;
    ui.chats = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ((b.last || {}).t || 0) - ((a.last || {}).t || 0));
    for (const c of ui.chats) {
      const o = before.find(x => x.id === c.id), l = c.last;
      if (l && l.by !== fb.uid && (!o || !o.last || o.last.t !== l.t) && before.length && (!ui.dm || ui.dm.id !== c.id)) {
        const where = c.group ? ' في «' + (c.title || 'مجموعة') + '»' : '';
        if (l.kind === 'invite') pushNote({ ic: '🎴', title: 'دعوة إلى غرفة لعب', body: (l.name || '') + ' يدعوك إلى ' + (l.text || '').replace('دعوة لغرفة ', '') + where, a: 'acceptInv', d: { r: l.room || '' }, c: c.id });
        else pushNote({ ic: l.kind === 'sticker' ? '🃏' : '💬', title: 'رسالة من ' + (l.name || '') + where, body: l.text, a: 'openChat', d: { c: c.id } });
      }
    }
    render();
  }, () => {}));
}
// in-app notification centre: banner + bell list + system notification while the app is in the background
function pushNote(n) {
  n.t = Date.now(); n.new = 1;
  ui.notes = [n, ...(ui.notes || [])].slice(0, 40); ls.set('mor-notes', ui.notes);
  if (prof.notify !== false) {
    ui.banner = n; clearTimeout(pushNote.t); pushNote.t = setTimeout(() => { ui.banner = null; render(); }, 4500);
    SFX.turn(); try { navigator.vibrate && navigator.vibrate(60); } catch (e) {}
    try { if (document.hidden && native && native.notify) native.notify(n.ic + ' ' + n.title, n.body || ''); } catch (e) {}
  }
  render();
}
const newNotes = () => (ui.notes || []).filter(n => n.new).length;
function noteGo(n) {
  ui.banner = null; ui.pop = null;
  if (!n) return render();
  if (n.a === 'tab') { if (ui.view === 'dm') closeChat(); ui.view = ui.mode ? ui.view : 'home'; ui.tab = n.d.t; return render(); }
  if (n.a === 'dm') return openDM(n.d.f);
  if (n.a === 'openChat') return openChat(n.d.c);
  if (n.a === 'acceptInv') { const r = n.d.r; if (!r) return n.c ? openChat(n.c) : render(); if (ui.dm) closeChat(); if (ui.mode) { if (ui.code === r) { ui.view = ui.st ? 'game' : 'room'; return render(); } leave(); } return joinRoom('fb', r); }
  render();
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
  else if (kind === 'voice') text = '🎤 رسالة صوتية';
  else if (kind === 'sticker') text = 'ملصق: ' + ((STK.find(x => x.id === extra.stk) || {}).t || '');
  else text = 'دعوة لغرفة ' + (extra.game ? GG(extra.game).name : '');
  const m = { by: fb.uid, name: prof.name, text: text.slice(0, 300), t: Date.now(), kind, ...extra };
  try { await FB.addDoc(fbB.col('chats', cid, 'msgs'), m); await FB.updateDoc(fbB.ref('chats', cid), { last: { text: m.text, t: m.t, by: fb.uid, name: prof.name, kind, ...(extra.room ? { room: extra.room } : {}) } }); }
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
