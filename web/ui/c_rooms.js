// ---------- rooms ----------
function genCode() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
async function createRoom(mode) {
  if (!myName()) return toast('اكتب اسمك أول من حسابي');
  ui.pop = null; ui.mode = mode; let key;
  try { key = await B().create(); } catch (e) { ui.mode = null; return toast(mode === 'lan' ? 'ما قدرت أفتح الغرفة على الشبكة' : 'ما قدرت أعمل غرفة، تأكد من الإنترنت'); }
  joinRoom(mode, key);
}
function joinAny(raw) {
  const k = (raw || '').trim();
  if (/^[\d.]+$|^localhost$/i.test(k)) return joinRoom('lan', k);
  if (/^[a-z0-9]{4}$/i.test(k)) { if (!online()) return toast('الأونلاين مش متاح هلّق، تأكد من الإنترنت'); return joinRoom('fb', k); }
  toast('اكتب كود الغرفة (4 حروف) أو عنوان المضيف متل 192.168.1.5');
}
async function joinRoom(mode, key) {
  const n = myName(); if (!n) return toast('اكتب اسمك أول من حسابي');
  key = (key || '').trim(); if (mode === 'fb') key = key.toUpperCase();
  unsub.forEach(u => u()); unsub = [];
  if (mode === 'fb' && fb.uid) uid = fb.uid;
  Object.assign(ui, { mode, code: key, st: null, room: null, players: [], chat: [], unread: 0, pop: null });
  prevSt = null;
  try { await B().open(key, n); } catch (e) { ui.mode = null; ui.code = null; return toast(e.message || 'ما قدرت أدخل'); }
  if (ui.view !== 'game') ui.view = 'room';
  ls.set('mor-room', { mode, key }); render();
}
async function sit(seat) {
  const taken = ui.players.find(p => p.seat === seat && p.id !== uid);
  if (taken) return toast('المقعد محجوز');
  const mine = ui.players.find(p => p.id === uid);
  SFX.tap();
  await B().setSeat(mine && mine.seat === seat ? -1 : seat).catch(() => toast('ما قدرت أقعدك'));
}
async function setRoomGame(gid) {
  prof.lastGame = gid; saveProf(); ui.pop = null;
  try { await B().meta({ game: gid }); } catch (e) { toast('ما قدرت أغيّر اللعبة'); }
  render();
}
async function startOnline(withBots) {
  const bySeat = [0, 1, 2, 3].map(s => ui.players.find(p => p.seat === s));
  if (!withBots && bySeat.some(p => !p)) return toast('لازم 4 لاعبين قاعدين، أو كمّل بالبوت');
  if (bySeat.every(p => !p)) return toast('اقعد على كرسي أول');
  const bots = bySeat.map(p => !p);
  const G = GG(ui.room && ui.room.game || 'mor');
  const st = G.newGame(bySeat.map((p, i) => p ? p.name : 'بوت ' + (i + 1)), bots);
  st.seats = bySeat.map(p => p ? p.id : null); st.avs = bySeat.map(p => p ? p.av || '' : 'bot'); st.deal = Date.now();
  ui.st = { v: (ui.room && ui.room.sv) || 0 }; ui.order = {};
  await commit(st);
}
async function backToRoom() {
  if (!isHost()) return;
  try { await B().meta({ phase: 'lobby' }); } catch (e) { toast('ما قدرت أرجع للغرفة'); }
}
function leave() {
  if (vc.on) voiceLeave();
  if (ui.mode === 'lan' || ui.mode === 'fb') B().leave();
  unsub.forEach(u => u()); unsub = [];
  Object.assign(ui, { view: 'home', tab: 'home', mode: null, code: null, room: null, st: null, players: [], confirmExit: false, chatOpen: false, chat: [], dblSel: [], pop: null });
  if (fb.uid) uid = fb.uid;
  prevSt = null; ls.set('mor-room', null); render();
}
function startLocal(gid, kind, resume) {
  const G = GG(gid); prof.lastGame = G.id; saveProf();
  const saved = ls.get(saveKey(G.id));
  if (resume && saved) ui.st = saved;
  else {
    let names, bots, avs;
    if (kind === 'solo') { names = [myName() || 'أنا', 'بوت ١', 'بوت ٢', 'بوت ٣']; bots = [false, true, true, true]; avs = [prof.av, 'bot', 'bot', 'bot']; }
    else {
      names = [0, 1, 2, 3].map(i => (document.getElementById('ln' + i)?.value || '').trim() || 'لاعب ' + (i + 1));
      bots = [0, 1, 2, 3].map(i => !!(ui.localCfg && ui.localCfg[i]));
      if (bots.every(Boolean)) return toast('لازم لاعب واحد على الأقل مش بوت');
      avs = bots.map((b, i) => (b ? 'bot' : i + '|A'));
    }
    ui.st = G.newGame(names, bots); ui.st.deal = Date.now(); ui.st.avs = avs; ls.set(saveKey(G.id), ui.st);
  }
  ui.order = {}; ui.pop = null; prevSt = null;
  const hs = humans(ui.st), a = G.actor(ui.st);
  ui.mode = 'local'; ui.view = 'game'; ui.viewer = hs.includes(a) ? a : hs[0]; ui.hidden = hs.length > 1;
  afterState(); render();
}
async function nextRound() {
  let n; try { n = gameOf(ui.st).next(ui.st); } catch (e) { return toast(e.message); }
  n.deal = Date.now(); ui.order = {}; await commit(n);
}
async function newMatch() {
  const st = gameOf(ui.st).newGame(ui.st.names, ui.st.bots); st.seats = ui.st.seats; st.avs = ui.st.avs; st.deal = Date.now(); ui.order = {}; await commit(st);
}
async function toggleBot(seat) {
  const st = JSON.parse(JSON.stringify(ui.st)); st.bots[seat] = !st.bots[seat];
  st.log.push(st.names[seat] + (st.bots[seat] ? ': بوت عم يلعب مكانه' : ': رجع يلعب')); await commit(st);
}
function setOrient(o) { ui.orient = o; ls.set('mor-orient', o); try { native && native.setOrientation(o); } catch (e) {} render(); }

// ---------- account (Firebase) ----------
async function ensureUser() {
  const ref = fbB.ref('users', fb.uid);
  let d = {}; try { d = (await FB.getDoc(ref)).data() || {}; } catch (e) {}
  if (d.name && !prof.name) { prof.name = d.name; if (d.av) prof.av = d.av; saveProf(); }
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
  FB.setDoc(fbB.ref('users', fb.uid), { name: prof.name, av: prof.av, code: prof.code, t: Date.now() }, { merge: true }).catch(() => {});
  if (ui.mode === 'fb' && ui.code) FB.updateDoc(fbB.ref('rooms', ui.code, 'players', uid), { name: prof.name, av: prof.av }).catch(() => {});
  if (ui.mode === 'lan') lanB.setSeat((ui.players.find(p => p.id === uid) || { seat: -1 }).seat).catch(() => {});
}
const AUTHERR = { 'auth/email-already-in-use': 'هالإيميل مربوط بحساب تاني', 'auth/invalid-email': 'الإيميل مش صحيح', 'auth/weak-password': 'كلمة السر لازم تكون 6 خانات على الأقل', 'auth/wrong-password': 'الإيميل أو كلمة السر غلط', 'auth/invalid-credential': 'الإيميل أو كلمة السر غلط', 'auth/user-not-found': 'ما في حساب بهالإيميل', 'auth/credential-already-in-use': 'هالإيميل مربوط بحساب تاني', 'auth/operation-not-allowed': 'ربط الإيميل مش مفعّل لسا', 'auth/network-request-failed': 'تأكد من الإنترنت', 'auth/too-many-requests': 'محاولات كتير، جرّب بعد شوي' };
async function linkEmail() {
  const em = (document.getElementById('em')?.value || '').trim(), pw = document.getElementById('pw')?.value || '';
  if (!em || !pw) return toast('اكتب الإيميل وكلمة السر');
  try {
    await FB.linkWithCredential(fb.auth.currentUser, FB.EmailAuthProvider.credential(em, pw));
    prof.email = em; saveProf(); FB.setDoc(fbB.ref('users', fb.uid), { email: em }, { merge: true }).catch(() => {});
    ui.pop = null; toast('انربط حسابك بالإيميل');
  } catch (e) { toast(AUTHERR[e.code] || 'ما قدرت أربط الإيميل'); }
}
async function recoverEmail() {
  const em = (document.getElementById('em')?.value || '').trim(), pw = document.getElementById('pw')?.value || '';
  if (!em || !pw) return toast('اكتب الإيميل وكلمة السر');
  try {
    socialStop();
    await FB.signInWithEmailAndPassword(fb.auth, em, pw);
    fb.uid = fb.auth.currentUser.uid; if (!ui.mode) uid = fb.uid;
    const d = (await FB.getDoc(fbB.ref('users', fb.uid))).data() || {};
    if (d.name) prof.name = d.name; if (d.av) prof.av = d.av; saveProf();
    await ensureUser(); socialStart(); ui.pop = null; toast('رجع حسابك: أهلاً ' + myName()); render();
  } catch (e) { socialStart(); toast(AUTHERR[e.code] || 'ما قدرت أرجّع الحساب'); }
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
        toast((l.name || '') + ': ' + (l.kind === 'invite' ? 'دعاك لغرفة لعب' : l.text)); SFX.turn();
      }
    }
    render();
  }, () => {}));
}
const unreadChats = () => ui.chats.filter(c => c.last && c.last.by !== fb.uid && c.last.t > (readMap[c.id] || 0)).length;
const friendReqs = () => ui.friends.filter(f => f.st === 'in').length;
async function addFriend() {
  const code = (document.getElementById('fcode')?.value || '').trim();
  if (!/^\d{6}$/.test(code)) return toast('الـ ID من 6 أرقام');
  if (code === prof.code) return toast('هاد الـ ID تبعك 🙂');
  try {
    const q = await FB.getDocs(FB.query(fbB.col('users'), FB.where('code', '==', code), FB.limit(1)));
    if (q.empty) return toast('ما لقيت حدا بهالـ ID');
    const t = q.docs[0], td = t.data();
    const ex = ui.friends.find(f => f.id === t.id);
    if (ex && ex.st === 'ok') return toast('هو أصلاً صديقك');
    if (ex && ex.st === 'in') return acceptFriend(t.id);
    await FB.setDoc(fbB.ref('users', fb.uid, 'friends', t.id), { st: 'out', name: td.name || '', av: td.av || '', code, t: Date.now() });
    await FB.setDoc(fbB.ref('users', t.id, 'friends', fb.uid), { st: 'in', name: prof.name, av: prof.av, code: prof.code, t: Date.now() });
    document.getElementById('fcode').value = ''; toast('انبعت طلب الصداقة لـ ' + (td.name || code));
  } catch (e) { console.error(e); toast('ما قدرت أبعت الطلب'); }
}
async function acceptFriend(id) {
  try {
    await FB.updateDoc(fbB.ref('users', fb.uid, 'friends', id), { st: 'ok', t: Date.now() });
    await FB.setDoc(fbB.ref('users', id, 'friends', fb.uid), { st: 'ok', name: prof.name, av: prof.av, code: prof.code, t: Date.now() }, { merge: true });
    toast('صرتوا أصدقاء');
  } catch (e) { toast('ما زبط، جرّب كمان مرة'); }
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
  catch (e) { return toast('ما قدرت أفتح المحادثة'); }
  openChat(cid);
}
async function createGroup() {
  const title = (document.getElementById('gtitle')?.value || '').trim();
  const picked = [...document.querySelectorAll('[data-gm].on')].map(x => x.dataset.gm);
  if (!title) return toast('سمّي الجروب'); if (!picked.length) return toast('اختار صديق واحد على الأقل');
  const members = [fb.uid, ...picked], names = { [fb.uid]: prof.name }, avs = { [fb.uid]: prof.av };
  picked.forEach(id => { const f = ui.friends.find(x => x.id === id); names[id] = f ? f.name : ''; avs[id] = f ? f.av || '' : ''; });
  try {
    const r = await FB.addDoc(fbB.col('chats'), { members, group: true, title: title.slice(0, 30), names, avs, owner: fb.uid, last: { text: 'انعمل الجروب', t: Date.now(), by: fb.uid, name: prof.name } });
    ui.pop = null; openChat(r.id);
  } catch (e) { toast('ما قدرت أعمل الجروب'); }
}
let dmUnsub = null;
function openChat(cid) {
  if (dmUnsub) dmUnsub();
  ui.dm = { id: cid }; ui.dmMsgs = []; ui.view = 'dm'; render();
  dmUnsub = FB.onSnapshot(FB.query(fbB.col('chats', cid, 'msgs'), FB.orderBy('t', 'desc'), FB.limit(60)), s => {
    ui.dmMsgs = s.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
    readMap[cid] = Date.now(); ls.set('mor-read', readMap); render();
  }, () => toast('ما قدرت أجيب الرسائل'));
}
function closeChat() { if (dmUnsub) dmUnsub(); dmUnsub = null; if (ui.dm) { readMap[ui.dm.id] = Date.now(); ls.set('mor-read', readMap); } ui.dm = null; ui.view = 'home'; render(); }
async function sendDM(kind = 'text', extra = {}, cid) {
  cid = cid || (ui.dm && ui.dm.id); if (!cid) return;
  let text = '';
  if (kind === 'text') { const el = document.getElementById('dmin'); text = (el && el.value || '').trim(); if (!text) return; el.value = ''; }
  else text = 'دعوة لغرفة ' + (extra.game ? GG(extra.game).name : '');
  const m = { by: fb.uid, name: prof.name, text: text.slice(0, 300), t: Date.now(), kind, ...extra };
  try { await FB.addDoc(fbB.col('chats', cid, 'msgs'), m); await FB.updateDoc(fbB.ref('chats', cid), { last: { text: m.text, t: m.t, by: fb.uid, name: prof.name, kind } }); }
  catch (e) { toast('ما انبعتت'); }
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
  toast('انبعتت الدعوة');
}
function chatTitle(c) {
  if (c.group) return c.title || 'جروب';
  const o = (c.members || []).find(x => x !== fb.uid); return (c.names || {})[o] || 'صديق';
}
function chatAv(c) {
  if (c.group) return `<span class="avt sm" style="background:linear-gradient(135deg,var(--gold),var(--gold2));color:var(--btnink)">${ICON.group.replace('<svg', '<svg style="width:60%"')}</span>`;
  const o = (c.members || []).find(x => x !== fb.uid); return avatarHTML((c.avs || {})[o], chatTitle(c), 'sm');
}
