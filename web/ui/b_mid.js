// ---------- viewer ----------
function humans(st) { return [0, 1, 2, 3].filter(s => !(st.bots && st.bots[s])); }
function mySeat() {
  const st = ui.st; if (!st) return -1;
  if (ui.mode === 'local') return ui.viewer;
  return st.seats ? st.seats.indexOf(uid) : -1;
}
function isHost() { return ui.mode === 'local' || (ui.room && ui.room.host === uid); }

// ---------- actions ----------
async function act(fn, ...args) {
  if (ui.busy) return;
  let next;
  try { next = fn(ui.st, mySeat(), ...args); } catch (e) { if (e.game) return toast(e.message); throw e; }
  await commit(next);
}
async function commit(next, quiet) {
  next.v = (ui.st && ui.st.v || 0) + 1;
  ui.sel.clear(); ui.sheet = null; ui.armed = null;
  if (ui.mode === 'local') { ui.st = next; ls.set(saveKey(next.game || 'mor'), next); afterState(); return render(); }
  ui.busy = true; const prev = ui.st; ui.st = next; render();
  let res = 'ok';
  try { await B().writeState(next, prev && prev.v || 0); }
  catch (e) { if (e.live) { ui.st = e.live; res = 'conflict'; if (!quiet) toast('حدث تغيير، حاول مرة أخرى'); } else { ui.st = prev; res = 'fail'; toast('لم تُحفظ الحركة، تأكد من الاتصال'); } }
  ui.busy = false; afterState(); render(); return res;
}
// several players act at once (votes, night picks): re-apply the action to the latest state on conflict
async function actR(fn, ...args) {
  for (let i = 0; i < 6; i++) {
    while (ui.busy) await sleep(60);
    let next;
    try { next = fn(ui.st, ...args); } catch (e) { if (e.game) return toast(e.message); throw e; }
    const r = await commit(next, true);
    if (r !== 'conflict') return;
    await sleep(60 + Math.random() * 240);
  }
  toast('هناك ضغط، حاول مرة أخرى');
}
let prevSt = null;
function afterState() {
  const st = ui.st; if (!st) return;
  const pv = prevSt;
  try { soundsFor(prevSt, st, mySeat()); } catch (e) {}
  prevSt = st;
  requestAnimationFrame(() => { try { flyFor(pv, st); } catch (e) {} });
  try { mafiaAuto(st); } catch (e) {}
  try { turnClock(st); } catch (e) {}
  if (ui.mode === 'fb' && !['mafia', 'coup'].includes(st.game) && st.phase === 'over' && isHost() && ui.room && ui.room.recorded !== st.deal) recordMatch(st);
  const a = gameOf(st).actor(st);
  if (ui.mode === 'local' && a >= 0) {
    const hs = humans(st);
    if (hs.length > 1 && !st.bots[a] && a !== ui.viewer) { ui.viewer = a; ui.hidden = true; }
    if (hs.length === 1) ui.viewer = hs[0];
  }
  runBots();
}
// ---------- turn timer (set by the room host) ----------
const clock = { key: null, seat: -1, at: 0, forced: null, timer: null };
function clockKey(st) {
  const a = gameOf(st).actor(st);
  return a < 0 ? null : st.deal + ':' + a + ':' + (st.game === 'mor' || !st.game ? 'r' + (st.round || 0) + ':' + st.turn : st.v);
}
function turnClock(st) {
  const lim = +st.timer || 0, a = gameOf(st).actor(st), key = clockKey(st);
  if (!lim || a < 0 || (st.bots && st.bots[a]) || ui.mode === 'local') { clock.key = null; clock.seat = -1; clearTimeout(clock.timer); return; }
  if (key !== clock.key) { clock.key = key; clock.seat = a; clock.at = Date.now(); clearTimeout(clock.timer); if (clock.forced && clock.forced !== key) clock.forced = null; }
  if (!isHost()) return;
  const left = clock.forced === key ? 700 : clock.at + lim * 1000 - Date.now();
  clearTimeout(clock.timer);
  clock.timer = setTimeout(async () => {
    const live = ui.st; if (!live || clockKey(live) !== key || ui.busy) return;
    clock.forced = key;
    const G = gameOf(live); let n; try { n = G.bot(live, a, true); } catch (e) { console.error(e); return; }
    if (n && n !== live) { if (live.game === 'mor' || !live.game) (n.log = n.log || []).push(live.names[a] + ': انتهى الوقت، لعب الكمبيوتر عنه'); await commit(n); }
  }, Math.max(0, left));
}
function tmrBadge(s) {
  const st = ui.st; if (!st || !+st.timer || clock.seat !== s || s < 0) return '';
  const left = Math.max(0, Math.ceil((clock.at + st.timer * 1000 - Date.now()) / 1000));
  return `<span class="tmr ${left <= 5 ? 'low' : ''}" data-tmr="${s}">${left}</span>`;
}
setInterval(() => {
  const st = ui.st; if (!st || !+st.timer || clock.seat < 0) return;
  const left = Math.max(0, Math.ceil((clock.at + st.timer * 1000 - Date.now()) / 1000));
  document.querySelectorAll('[data-tmr]').forEach(el => { el.textContent = left; el.classList.toggle('low', left <= 5); });
}, 500);
let botJob = null;
function cancelBot() {
  if (botJob) clearTimeout(botJob.timer);
  botJob = null;
}
function runBots() {
  const st = ui.st;
  if (!st || !st.bots || !isHost()) return cancelBot();
  const G = gameOf(st), a = G.actor(st);
  if (a < 0 || !st.bots[a]) return cancelBot();
  const keyFor = state => JSON.stringify([ui.mode, ui.code, G.id, state.deal, state.v, a]);
  const key = keyFor(st);
  if (botJob && botJob.key === key) return;
  cancelBot();
  const job = { key, timer: setTimeout(async () => {
    if (botJob !== job) return;
    botJob = null;
    const live = ui.st;
    if (ui.busy || !live || !isHost() || gameOf(live) !== G ||
        !live.bots?.[a] || G.actor(live) !== a || keyFor(live) !== key) return;
    let n; try { n = G.bot(live, a, ui.mode === 'local' && prof.botLevel === 'expert' ? 'expert' : ui.mode !== 'local' || prof.botLevel !== 'normal'); } catch (e) { console.error(e); return; }
    if (n !== live) await commit(n);
  }, G.id === 'mor' ? 1600 : (st.trickDone ? 2900 : 1000)) };
  botJob = job;
}

// ---------- backends ----------
function applyRoom(room) {
  ui.room = room;
  if (room.phase === 'lobby') {
    cancelBot();
    if (ui.st) { ui.st = null; prevSt = null; ui.order = {}; }
    if (ui.view === 'game') { ui.view = 'room'; ui.confirmExit = false; }
    return render();
  }
  const st = room && room.s ? JSON.parse(room.s) : null;
  if (st && (!ui.st || st.v >= (ui.st.v || 0) || ui.st.deal !== st.deal)) ui.st = st;
  if (ui.view === 'room' && ui.st && room.phase === 'game') ui.view = 'game';
  afterState(); render();
}
const PORT = 8765;
const lanB = {
  base: '', rev: -1, alive: false, seen: new Set(),
  async req(path, body) {
    const r = await fetch(lanB.base + path, body ? { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) } : {});
    const j = await r.json().catch(() => ({}));
    if (r.status === 409) { const e = new Error(j.error || 'conflict'); e.code = 409; if (j.room && j.room.s) e.live = JSON.parse(j.room.s); throw e; }
    if (!r.ok) throw new Error('http ' + r.status);
    return j;
  },
  async create() { lanB.base = location.origin; await lanB.req('/api/create', { host: uid, game: prof.lastGame || 'mor' }); return location.hostname; },
  async open(host, name) {
    lanB.base = host === location.hostname ? location.origin : 'http://' + host + ':' + PORT;
    const j = await lanB.req('/api/poll?rev=-1').catch(() => null);
    if (!j || !j.room || !j.room.host) throw new Error('لم أجد غرفة على هذا العنوان. تأكد أنكم على شبكة الواي فاي نفسها');
    (j.chat || []).forEach(m => seenChat.add(m.mid));
    await lanB.req('/api/player', { id: uid, name, av: prof.av, ph: prof.photo || '', seat: (j.players.find(p => p.id === uid) || { seat: -1 }).seat });
    lanB.alive = true; lanB.rev = -1; lanB.loop();
    unsub.push(() => { lanB.alive = false; });
  },
  async loop() {
    let fails = 0;
    while (lanB.alive) {
      try {
        const j = await lanB.req('/api/poll?rev=' + lanB.rev);
        if (!lanB.alive) return;
        fails = 0; lanB.rev = j.rev; ui.players = j.players; gotChat(j.chat || []); voiceSync(j); applyRoom(j.room);
      } catch (e) { if (++fails === 3) toast('انقطع الاتصال بالمضيف، جارٍ إعادة المحاولة'); await sleep(1500); }
    }
  },
  setSeat(seat) { return lanB.req('/api/player', { id: uid, name: myName(), av: prof.av, ph: prof.photo || '', seat }); },
  meta(m) { return lanB.req('/api/meta', m); },
  leave() { return lanB.req('/api/leave', { id: uid }).catch(() => {}); },
  async writeState(next, prevV) { await lanB.req('/api/room', { s: JSON.stringify(next), phase: 'game', sv: next.v, expect: prevV }); },
  chat: {
    send(text) { return lanB.req('/api/chat', { id: uid, name: myName(), text }); },
    voice(data, mime) { return lanB.req('/api/voice', { id: uid, name: myName(), data, mime }); },
    get(mid) { return lanB.req('/api/voice?mid=' + mid); }
  }
};
const B = () => (ui.mode === 'lan' ? lanB : fbB);
const isServed = location.protocol === 'http:' && +location.port === PORT;
const native = window.MorNative || null;
function myIp() { try { return native ? native.getIp() : ''; } catch (e) { return ''; } }

// ---------- online through Firebase ----------
const FB_CONFIG = { apiKey: 'AIzaSyBfIwS3blYf_KgyXAmVHnXw9a3upGGz8Qw', authDomain: 'mor-games-9dfdf.firebaseapp.com', projectId: 'mor-games-9dfdf', storageBucket: 'mor-games-9dfdf.firebasestorage.app', messagingSenderId: '815493283593', appId: '1:815493283593:web:b471729858f3e2b44e1dd8' };
const fb = { ready: false, db: null, tried: false, app: null, auth: null, uid: null };
async function fbInit() {
  if (fb.tried || !window.FB) return; fb.tried = true;
  try {
    if (!fb.app) { fb.app = FB.initializeApp(FB_CONFIG); fb.auth = FB.getAuth(fb.app); }
    const user = await Promise.race([new Promise(r => { const off = FB.onAuthStateChanged(fb.auth, u => { off(); r(u); }); }), sleep(6000).then(() => null)]);
    if (!user) await Promise.race([FB.signInAnonymously(fb.auth), sleep(9000).then(() => { throw new Error('timeout'); })]);
    fb.db = FB.getFirestore(fb.app); fb.uid = fb.auth.currentUser.uid; fb.ready = true;
    if (!ui.mode) uid = fb.uid;
    await ensureUser(); socialStart(); render();
  } catch (e) { console.error('firebase', e); fb.tried = false; render(); }
}
const fbB = {
  ref: (...p) => FB.doc(fb.db, ...p),
  col: (...p) => FB.collection(fb.db, ...p),
  async create() {
    const code = genCode();
    await FB.setDoc(fbB.ref('rooms', code), { host: uid, game: prof.lastGame || 'mor', phase: 'lobby', s: '', sv: 0, t: Date.now() });
    return code;
  },
  async open(code, name) {
    const snap = await FB.getDoc(fbB.ref('rooms', code));
    if (!snap.exists()) throw new Error('لم أجد هذه الغرفة');
    const pr = fbB.ref('rooms', code, 'players', uid), me = await FB.getDoc(pr);
    await FB.setDoc(pr, { name, av: prof.av, ph: prof.photo || '', seat: me.exists() ? me.data().seat : -1, voice: false, t: Date.now() });
    const errH = () => toast('انقطع الاتصال بالغرفة');
    unsub.push(FB.onSnapshot(fbB.ref('rooms', code), s => { if (s.exists()) applyRoom(s.data()); }, errH));
    unsub.push(FB.onSnapshot(fbB.col('rooms', code, 'players'), s => {
      ui.players = s.docs.map(d => ({ id: d.id, ...d.data() }));
      vc.members = ui.players.filter(p => p.voice).map(p => p.id); voicePeers(); render();
    }, errH));
    unsub.push(FB.onSnapshot(FB.query(fbB.col('rooms', code, 'chat'), FB.orderBy('t', 'desc'), FB.limit(40)), s => {
      gotChat(s.docs.map(d => { const x = d.data(); return { mid: d.id, id: x.id, name: x.name, text: x.text, audio: !!x.audio, t: x.t }; }).reverse());
    }, errH));
    unsub.push(FB.onSnapshot(FB.query(fbB.col('rooms', code, 'signals'), FB.where('to', '==', uid)), s => {
      for (const ch of s.docChanges()) if (ch.type === 'added') { onSignal(ch.doc.data()).catch(e => console.error(e)); FB.deleteDoc(ch.doc.ref).catch(() => {}); }
    }, errH));
  },
  setSeat(seat) { return FB.updateDoc(fbB.ref('rooms', ui.code, 'players', uid), { seat }); },
  meta(m) { return FB.updateDoc(fbB.ref('rooms', ui.code), m); },
  leave() { return FB.deleteDoc(fbB.ref('rooms', ui.code, 'players', uid)).catch(() => {}); },
  async writeState(next, prevV) {
    await FB.runTransaction(fb.db, async tx => {
      const r = fbB.ref('rooms', ui.code), cur = await tx.get(r);
      const d = cur.data() || {};
      if ((d.sv || 0) !== prevV) { const e = new Error('conflict'); e.live = d.s ? JSON.parse(d.s) : null; throw e; }
      tx.update(r, { s: JSON.stringify(next), sv: next.v, phase: 'game' });
    });
  },
  voiceState(on) { return FB.updateDoc(fbB.ref('rooms', ui.code, 'players', uid), { voice: on }); },
  signal(to, kind, sdp) { return FB.addDoc(fbB.col('rooms', ui.code, 'signals'), { from: uid, to, kind, sdp, t: Date.now() }); },
  chat: {
    send(text) { return FB.addDoc(fbB.col('rooms', ui.code, 'chat'), { id: uid, name: myName(), text, audio: false, t: Date.now() }); },
    voice(data, mime) { return FB.addDoc(fbB.col('rooms', ui.code, 'chat'), { id: uid, name: myName(), text: '', audio: true, data, mime, t: Date.now() }); },
    async get(mid) { const d = await FB.getDoc(fbB.ref('rooms', ui.code, 'chat', mid)); return d.data(); }
  }
};
lanB.voiceState = on => lanB.req('/api/voicestate', { id: uid, on });
lanB.signal = (to, kind, sdp) => lanB.req('/api/signal', { from: uid, to, kind, sdp });
const social = () => ui.mode === 'lan' || ui.mode === 'fb';
const online = () => fb.ready && window.FB;


// ---------- ratings, leaderboards and match history (online only) ----------
const START = 1000;
const TITLES = [[0, 'مبتدئ'], [1050, 'هاوي'], [1150, 'لاعب'], [1300, 'محترف'], [1500, 'خبير'], [1800, 'أسطورة']];
const titleOf = r => TITLES.filter(t => r >= t[0]).pop()[1];
const levelOf = r => Math.max(1, Math.floor((r - START) / 50) + 1);
function seatWon(st, s) {
  const G = gameOf(st);
  if (st.winner != null && (G.teams || st.partner || G.id === 'mor')) return s % 2 === st.winner;
  return st.winnerSeat === s;
}
let recording = null;
async function recordMatch(st) {
  if (recording === st.deal) return; recording = st.deal;
  const G = gameOf(st), seats = st.seats || [];
  const humans = [0, 1, 2, 3].filter(s => seats[s]);
  if (humans.length < 2) return;
  try {
    const roomRef = fbB.ref('rooms', ui.code);
    const ok = await FB.runTransaction(fb.db, async tx => { const r = await tx.get(roomRef); if ((r.data() || {}).recorded === st.deal) return false; tx.update(roomRef, { recorded: st.deal }); return true; });
    if (!ok) return;
    const mist = st.mistakes || [0, 0, 0, 0];
    await FB.addDoc(fbB.col('matches'), {
      game: G.id, t: Date.now(), uids: humans.map(s => seats[s]),
      players: [0, 1, 2, 3].map(s => ({ uid: seats[s] || null, name: st.names[s], seat: s, won: seatWon(st, s), bot: !seats[s], mistakes: mist[s] || 0 })),
      scores: st.tscores || st.scores
    });
    for (const s of humans) {
      const ref = fbB.ref('users', seats[s]);
      await FB.runTransaction(fb.db, async tx => {
        const d = (await tx.get(ref)).data() || {};
        const all = d.stats || {}, me = all[G.id] || { rating: START, played: 0, wins: 0, losses: 0, mistakes: 0 };
        const won = seatWon(st, s), m = mist[s] || 0;
        me.rating = Math.max(0, me.rating + (won ? 25 : -20) - 3 * m);
        me.played++; won ? me.wins++ : me.losses++; me.mistakes += m;
        all[G.id] = me;
        tx.set(ref, { t: Date.now(), stats: all }, { merge: true });
      });
    }
    toast('حُفظت النتيجة في الترتيب');
  } catch (e) { console.error(e); recording = null; }
}
async function loadMyStats(gid) {
  try { const d = await FB.getDoc(fbB.ref('users', uid)); ui.myStats = ((d.data() || {}).stats || {})[gid] || null; ui.myStatsFor = gid; render(); } catch (e) {}
}
async function openBoard(gid) {
  ui.board = { gid, loading: true, rows: [] }; render();
  try {
    const q = FB.query(fbB.col('users'), FB.orderBy('stats.' + gid + '.rating', 'desc'), FB.limit(30));
    const r = await FB.getDocs(q);
    ui.board.rows = r.docs.map(d => ({ id: d.id, name: d.data().name, ...(d.data().stats || {})[gid] }));
  } catch (e) { ui.board.err = 'تعذّر جلب الترتيب'; }
  ui.board.loading = false; render();
}
async function openHistory(gid) {
  ui.hist = { gid, loading: true, list: [], h2h: [] }; render();
  try {
    const r = await FB.getDocs(FB.query(fbB.col('matches'), FB.where('uids', 'array-contains', uid), FB.limit(200)));
    const list = r.docs.map(d => d.data()).filter(m => m.game === gid).sort((a, b) => b.t - a.t);
    const h = {};
    for (const m of list) {
      const me = m.players.find(p => p.uid === uid); if (!me) continue;
      for (const p of m.players) {
        if (!p.uid || p.uid === uid) continue;
        const partner = GG(gid).teams && (p.seat % 2) === (me.seat % 2);
        const k = p.uid; h[k] = h[k] || { name: p.name, vsW: 0, vsL: 0, withW: 0, withL: 0 };
        h[k].name = p.name;
        if (partner) me.won ? h[k].withW++ : h[k].withL++; else me.won ? h[k].vsW++ : h[k].vsL++;
      }
    }
    ui.hist.list = list.slice(0, 30); ui.hist.h2h = Object.values(h).sort((a, b) => (b.vsW + b.vsL + b.withW + b.withL) - (a.vsW + a.vsL + a.withW + a.withL));
  } catch (e) { ui.hist.err = 'تعذّر جلب السجل'; }
  ui.hist.loading = false; render();
}
function rankPanel(G) {
  if (!fb.ready) return '';
  if (ui.myStatsFor !== G.id) { ui.myStatsFor = G.id; ui.myStats = null; loadMyStats(G.id); }
  const m = ui.myStats, r = m ? m.rating : START;
  return `<div class="card"><h2>ترتيبك · ${esc(G.name)}</h2>
    <div class="rank"><div class="lvl"><b>${levelOf(r)}</b><span>مستوى</span></div><div><b style="font-size:18px">${titleOf(r)}</b><div class="muted">${r} نقطة · فاز ${m ? m.wins : 0} · خسارة ${m ? m.losses : 0} · أخطاء ${m ? m.mistakes : 0}</div></div></div>
    <div class="acts"><button class="btn alt sm" data-a="board" data-g="${G.id}">${ICON.trophy} لوحة الترتيب</button><button class="btn alt sm" data-a="hist" data-g="${G.id}">سجلّي والمواجهات</button></div>
    <div class="muted" style="margin-top:6px">يُحتسب الترتيب في الألعاب عبر الإنترنت التي فيها لاعبان حقيقيان أو أكثر: الفوز +25، الخسارة −20، وكل خطأ −3 (انكسار بالطلب أو بالإعلان).</div></div>`;
}
function rankOverlays() {
  let h = '';
  if (ui.board) {
    const b = ui.board;
    h += `<div class="ov" data-a="closeBoard"><div class="box" data-stop="1"><div class="grab"></div><div class="row" style="justify-content:space-between"><h2>لوحة الترتيب · ${esc(GG(b.gid).name)}</h2><button class="ic" data-a="closeBoard">${ICON.x}</button></div>
      ${b.loading ? '<p class="muted">جارٍ التحميل…</p>' : b.err ? `<p class="muted">${b.err}</p>` : b.rows.length ? `<table><tr><th>#</th><th>اللاعب</th><th>المستوى</th><th>نقاط</th><th>فوز/خسارة</th></tr>${b.rows.map((x, i) => `<tr ${x.id === uid ? 'style="background:color-mix(in srgb,var(--gold) 16%,transparent)"' : ''}><td>${i + 1}</td><td>${esc(x.name)}</td><td>${levelOf(x.rating)} · ${titleOf(x.rating)}</td><td>${x.rating}</td><td>${x.wins}/${x.losses}</td></tr>`).join('')}</table>` : '<p class="muted">لم يلعب أحد هذه اللعبة عبر الإنترنت بعد.</p>'}
    </div></div>`;
  }
  if (ui.hist) {
    const H = ui.hist, G = GG(H.gid);
    h += `<div class="ov" data-a="closeHist"><div class="box" data-stop="1"><div class="grab"></div><div class="row" style="justify-content:space-between"><h2>سجلّي · ${esc(G.name)}</h2><button class="ic" data-a="closeHist">${ICON.x}</button></div>
      ${H.loading ? '<p class="muted">جارٍ التحميل…</p>' : H.err ? `<p class="muted">${H.err}</p>` : `
      <h3 style="margin:8px 0 4px">المواجهات المباشرة</h3>
      ${H.h2h.length ? `<table><tr><th>اللاعب</th><th>ضده</th><th>معه</th></tr>${H.h2h.map(x => `<tr><td>${esc(x.name)}</td><td>${x.vsW} فاز · ${x.vsL} خسارة</td><td>${x.withW + x.withL ? x.withW + ' فاز · ' + x.withL + ' خسارة' : '–'}</td></tr>`).join('')}</table>` : '<p class="muted">لا توجد مواجهات بعد.</p>'}
      <h3 style="margin:12px 0 4px">آخر الألعاب</h3>
      ${H.list.length ? H.list.map(m => { const me = m.players.find(p => p.uid === uid); return `<div class="mrow"><b style="color:${me && me.won ? 'var(--a)' : '#ff6b74'}">${me && me.won ? 'فاز' : 'خسارة'}</b> <span class="muted">${new Date(m.t).toLocaleDateString('ar')}</span><div class="muted">${m.players.map(p => esc(p.name) + (p.won ? ' ✓' : '')).join(' · ')}</div></div>`; }).join('') : '<p class="muted">لم تلعب هذه اللعبة عبر الإنترنت بعد.</p>'}`}
    </div></div>`;
  }
  return h;
}

// ---------- chat ----------
const seenChat = new Set();
function gotChat(list) {
  for (const m of list) {
    if (seenChat.has(m.mid)) continue;
    seenChat.add(m.mid); ui.chat.push(m); if (ui.chat.length > 80) ui.chat.shift();
    if (m.id !== uid && Date.now() - (m.t || 0) < 60000) {
      if (!ui.chatOpen) ui.unread++;
      const seat = ui.st && ui.st.seats ? ui.st.seats.indexOf(m.id) : -1;
      if (seat >= 0) { ui.bubbles[seat] = { text: m.audio ? 'رسالة صوتية' : m.text, t: Date.now() }; setTimeout(render, 4200); }
      if (m.audio) playVoice(m.mid);
    }
  }
}
async function playVoice(mid) {
  try { const j = await B().chat.get(mid); const a = new Audio('data:' + j.mime + ';base64,' + j.data); await a.play(); } catch (e) {}
}
async function sendChat() {
  const el = document.getElementById('chatin'); const t = (el && el.value || '').trim(); if (!t) return;
  el.value = ''; try { await B().chat.send(t.slice(0, 200)); } catch (e) { toast('لم تُرسل الرسالة'); }
}
const rec = { mr: null, chunks: [], t0: 0, timer: null };
async function recStart() {
  if (rec.mr) return;
  if (!navigator.mediaDevices || !window.MediaRecorder) return toast('التسجيل الصوتي يعمل في التطبيق فقط');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    rec.mr = new MediaRecorder(stream); rec.chunks = []; rec.t0 = Date.now();
    rec.mr.ondataavailable = e => rec.chunks.push(e.data);
    rec.mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const dur = Date.now() - rec.t0; const blob = new Blob(rec.chunks, { type: rec.mr.mimeType || 'audio/webm' }); const mime = blob.type; rec.mr = null; render();
      if (dur < 500) return toast('اضغط مطوّل لتسجّل');
      const b64 = await new Promise(r => { const f = new FileReader(); f.onload = () => r(String(f.result).split(',')[1]); f.readAsDataURL(blob); });
      try { await B().chat.voice(b64, mime); } catch (e) { toast('لم تُرسل الرسالة الصوتية'); }
    };
    rec.mr.start(); rec.timer = setTimeout(recStop, 15000); render();
  } catch (e) { toast('اسمح للتطبيق باستخدام الميكروفون'); }
}
function recStop() { clearTimeout(rec.timer); if (rec.mr && rec.mr.state === 'recording') rec.mr.stop(); }

// ---------- live voice (WebRTC; signalled through the host on LAN, through Firebase online) ----------
const vc = { on: false, muted: false, stream: null, pcs: {}, els: {}, seq: 0, members: [], fetching: false, silenced: new Set() };
async function voiceJoin() {
  if (!window.RTCPeerConnection) return toast('الصوت المباشر غير مدعوم على هذا الجهاز');
  try {
    vc.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) { vc.stream = null; toast('الميكروفون غير متاح: ستستمع فقط'); }
  vc.on = true; vc.muted = false; vc.seq = 0;
  try { await B().voiceState(true); } catch (e) { toast('تعذّر الانضمام إلى المكالمة'); }
  render(); voicePeers();
}
function voiceLeave(silent) {
  for (const k of Object.keys(vc.pcs)) dropPeer(k);
  if (vc.stream) vc.stream.getTracks().forEach(t => t.stop());
  vc.stream = null; vc.on = false;
  if (!silent) B().voiceState(false).catch(() => {});
  render();
}
function voiceBtns() {
  if (!vc.on) return `<button class="ic" data-a="voice" aria-label="انضم إلى المكالمة">${ICON.phone}${vc.members.length ? `<span class="badge" style="background:var(--b);color:#03212d">${vc.members.length}</span>` : ''}</button>`;
  return `<button class="ic ${vc.muted || !vc.stream ? 'vmute' : 'von'}" data-a="voice" aria-label="${vc.muted ? 'شغّل الميكروفون' : 'اكتم الميكروفون'}">${vc.muted || !vc.stream ? ICON.micoff : ICON.mic}</button><button class="ic" data-a="callPop" aria-label="المكالمة والمشاركين">${ICON.users}${vc.silenced.size ? `<span class="badge">${vc.silenced.size}</span>` : ''}</button>`;
}
function silence(id) { vc.silenced.has(id) ? vc.silenced.delete(id) : vc.silenced.add(id); if (vc.els[id]) vc.els[id].muted = vc.silenced.has(id); render(); }
function callSheet() {
  const others = vc.members.filter(id => id !== uid), P = id => ui.players.find(p => p.id === id) || { name: '…' };
  return sheet(`${sheetHead('🎙️ المكالمة')}
    <div class="li"><div class="t"><b>ميكروفوني</b><span>${!vc.stream ? 'الميكروفون غير متاح، تسمع فقط' : vc.muted ? 'مكتوم' : 'يعمل'}</span></div><button class="ic ${vc.muted || !vc.stream ? 'vmute' : 'von'}" data-a="voice" aria-label="الميكروفون">${vc.muted || !vc.stream ? ICON.micoff : ICON.mic}</button></div>
    ${others.map(id => { const p = P(id), off = vc.silenced.has(id); return `<div class="li">${avatarHTML(pav(p), p.name, 'sm')}<div class="t"><b>${esc(p.name)}</b><span>${off ? 'كتمتَ صوته عندك' : vc.pcs[id] ? 'متصل' : 'جارٍ الاتصال…'}</span></div><button class="ic ${off ? 'vmute' : ''}" data-a="silence" data-p="${id}" aria-label="${off ? 'إلغاء الكتم' : 'كتم'}">${off ? ICON.spkoff : ICON.spk}</button></div>`; }).join('') || '<div class="empty">لا أحد غيرك في المكالمة حالياً.</div>'}
    <div class="acts"><button class="btn red wide" data-a="voiceEnd">📞 إنهاء المكالمة</button></div>`);
}
function voiceMute() {
  vc.muted = !vc.muted;
  if (vc.stream) vc.stream.getAudioTracks().forEach(t => { t.enabled = !vc.muted; });
  render();
}
function dropPeer(k) {
  try { vc.pcs[k] && vc.pcs[k].close(); } catch (e) {}
  delete vc.pcs[k];
  if (vc.els[k]) { vc.els[k].srcObject = null; vc.els[k].remove(); delete vc.els[k]; }
}
function newPeer(peer) {
  const ice = ui.mode === 'lan' ? [] : [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const pc = new RTCPeerConnection({ iceServers: ice });
  pc.ontrack = e => {
    let a = vc.els[peer];
    if (!a) { a = document.createElement('audio'); a.autoplay = true; a.playsInline = true; document.body.appendChild(a); vc.els[peer] = a; }
    a.srcObject = e.streams[0] || new MediaStream([e.track]); a.muted = vc.silenced.has(peer); a.play().catch(() => {});
  };
  pc.onconnectionstatechange = () => {
    if (['failed', 'closed'].includes(pc.connectionState) && vc.pcs[peer] === pc) { dropPeer(peer); setTimeout(voicePeers, 2500); }
  };
  vc.pcs[peer] = pc; return pc;
}
const iceDone = pc => new Promise(r => {
  if (pc.iceGatheringState === 'complete') return r();
  const t = setTimeout(r, 3000);
  pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); r(); } });
});
const signal = (to, kind, sdp) => B().signal(to, kind, sdp);
async function callPeer(peer) {
  const pc = newPeer(peer);
  if (vc.stream) vc.stream.getTracks().forEach(t => pc.addTrack(t, vc.stream));
  else pc.addTransceiver('audio', { direction: 'recvonly' });
  await pc.setLocalDescription(await pc.createOffer()); await iceDone(pc);
  await signal(peer, 'offer', pc.localDescription.sdp);
}
async function onSignal(m) {
  if (!vc.on) return;
  if (m.kind === 'offer') {
    dropPeer(m.from); const pc = newPeer(m.from);
    await pc.setRemoteDescription({ type: 'offer', sdp: m.sdp });
    if (vc.stream) vc.stream.getTracks().forEach(t => pc.addTrack(t, vc.stream));
    await pc.setLocalDescription(await pc.createAnswer()); await iceDone(pc);
    await signal(m.from, 'answer', pc.localDescription.sdp);
  } else if (m.kind === 'answer' && vc.pcs[m.from] && vc.pcs[m.from].signalingState === 'have-local-offer') {
    await vc.pcs[m.from].setRemoteDescription({ type: 'answer', sdp: m.sdp });
  }
}
function voicePeers() {
  if (!vc.on) return;
  const others = vc.members.filter(id => id !== uid);
  for (const k of Object.keys(vc.pcs)) if (!others.includes(k)) dropPeer(k);
  for (const p of others) if (!vc.pcs[p] && uid < p) callPeer(p).catch(e => { console.error(e); dropPeer(p); });
}
async function voiceSync(j) {
  vc.members = j.voice || [];
  if (vc.on && j.sig && j.sig[uid] > vc.seq && !vc.fetching) {
    vc.fetching = true;
    try {
      const list = await lanB.req('/api/signals?to=' + encodeURIComponent(uid) + '&after=' + vc.seq);
      for (const x of list) { vc.seq = Math.max(vc.seq, x.seq); try { await onSignal(x.msg); } catch (e) { console.error(e); } }
    } catch (e) {}
    vc.fetching = false;
  }
  voicePeers();
}

