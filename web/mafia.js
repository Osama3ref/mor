// Mafia: pure state engine. Players are identified by uid, not seats.
const Mafia = (() => {
  const ROLE = { mafia: 'مافيا', town: 'شعب', doctor: 'طبيب', detective: 'محقق' };
  const clone = s => JSON.parse(JSON.stringify(s));
  function err(m) { const e = new Error(m); e.game = true; throw e; }
  const defMafia = n => (n <= 6 ? 1 : n <= 9 ? 2 : n <= 12 ? 3 : 4);
  const maxMafia = n => Math.max(1, Math.floor((n - 1) / 2));
  function shuffle(a, rnd = Math.random) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // players: [{id,name,av}], cfg: {mafia, doctor, detective, reveal, narrator (uid or null)}
  function newGame(players, cfg) {
    const n = players.length;
    if (n < 4) err('يلزم 4 لاعبين على الأقل');
    const m = Math.min(Math.max(1, cfg.mafia || defMafia(n)), maxMafia(n));
    const roles = Array(m).fill('mafia');
    if (cfg.doctor) roles.push('doctor');
    if (cfg.detective) roles.push('detective');
    while (roles.length < n) roles.push('town');
    if (roles.length > n) err('الأدوار أكثر من اللاعبين');
    shuffle(roles);
    return {
      game: 'mafia', phase: 'roles', day: 0,
      cfg: { mafia: m, doctor: !!cfg.doctor, detective: !!cfg.detective, reveal: cfg.reveal !== false, narrator: cfg.narrator || null, voice: cfg.voice || 'all' },
      players: players.map((p, i) => ({ id: p.id, name: p.name, av: p.av || '', role: roles[i], alive: true })),
      ready: {}, night: { kill: {}, save: null, check: null }, lastSave: null, checks: {}, votes: {}, events: [], winner: null, log: []
    };
  }
  const P = (st, id) => st.players.find(p => p.id === id);
  const alive = st => st.players.filter(p => p.alive);
  const aliveRole = (st, r) => alive(st).filter(p => p.role === r);
  const isNarr = (st, id) => st.cfg.narrator && st.cfg.narrator === id;
  function winner(st) {
    const m = aliveRole(st, 'mafia').length, t = alive(st).length - m;
    if (!m) return 'town';
    if (m >= t) return 'mafia';
    return null;
  }
  function finish(st) { const w = winner(st); if (w) { st.phase = 'over'; st.winner = w; } return !!w; }
  function setReady(s, id) {
    const st = clone(s); if (st.phase !== 'roles') err('ليس الآن');
    if (!P(st, id)) err('أنت لست لاعباً'); st.ready[id] = true;
    if (!st.cfg.narrator && st.players.every(p => st.ready[p.id])) startNight(st);
    return st;
  }
  // the night is called role by role, like a narrator would: mafia, then doctor, then detective
  const steps = st => ['mafia', ...(st.cfg.doctor ? ['doctor'] : []), ...(st.cfg.detective ? ['detective'] : [])];
  function startNight(st) {
    st.phase = 'night'; st.day++; st.night = { kill: {}, save: null, check: null, step: 'mafia' }; st.votes = {};
    st.log.push('الليلة ' + st.day);
  }
  function stepDone(st) {
    const n = st.night, r = n.step;
    if (r === 'mafia') return aliveRole(st, 'mafia').every(p => n.kill[p.id]);
    if (r === 'doctor') return !aliveRole(st, 'doctor').length ? false : !!n.save;
    if (r === 'detective') return !aliveRole(st, 'detective').length ? false : !!n.check;
    return true;
  }
  // a role whose players are all dead still gets called (so nobody learns who died), then skipped after a pause
  const stepEmpty = st => st.night.step !== 'mafia' && !aliveRole(st, st.night.step).length;
  function advanceStep(st) {
    const s = steps(st), i = s.indexOf(st.night.step);
    if (i < s.length - 1) { st.night.step = s[i + 1]; return; }
    st.night.step = 'done';
    if (!st.cfg.narrator) resolveNight(st);
  }
  function nightDone(st) { return st.night.step === 'done'; }
  function skipStep(s, id, isHost) {
    const st = clone(s); if (st.phase !== 'night') err('ليس وقت الليل');
    if (st.cfg.narrator ? !isNarr(st, id) : !(isHost && stepEmpty(st))) err('لا يمكنك');
    advanceStep(st); return st;
  }
  function mafiaTarget(st) {
    const picks = aliveRole(st, 'mafia').map(p => st.night.kill[p.id]).filter(Boolean);
    if (!picks.length) return null;
    const c = {}; picks.forEach(x => (c[x] = (c[x] || 0) + 1));
    const best = Math.max(...Object.values(c));
    const top = Object.keys(c).filter(k => c[k] === best);
    // tie between mafia picks: the pick of the first mafia in table order wins
    return top.length === 1 ? top[0] : picks.find(x => top.includes(x));
  }
  function nightAct(s, id, target) {
    const st = clone(s); if (st.phase !== 'night') err('ليس وقت الليل');
    const me = P(st, id); if (!me || !me.alive) err('لا يمكنك اللعب الآن');
    if (me.role !== st.night.step) err('ليس دورك الآن');
    const t = P(st, target); if (!t || !t.alive) err('اختر لاعباً حيّاً');
    if (me.role === 'mafia') { if (t.role === 'mafia') err('لا يمكنك اختيار أحد من المافيا'); st.night.kill[id] = target; }
    else if (me.role === 'doctor') { if (st.lastSave === target) err('لا يمكنك حماية الشخص نفسه ليلتين متتاليتين'); st.night.save = target; }
    else if (me.role === 'detective') {
      if (st.night.check) err('سألتَ هذه الليلة بالفعل'); if (target === id) err('اختر شخصاً غيرك');
      st.night.check = target; (st.checks[id] = st.checks[id] || []).push({ id: target, mafia: t.role === 'mafia', day: st.day });
    } else err('ليس لك دور في الليل');
    if (stepDone(st) && !st.cfg.narrator) advanceStep(st);
    return st;
  }
  function resolveNight(st) {
    const v = mafiaTarget(st), saved = v && st.night.save === v;
    st.lastSave = st.night.save;
    const ev = { kind: 'night', day: st.day, victim: saved ? null : v, saved: !!saved };
    if (v && !saved) { const p = P(st, v); p.alive = false; ev.role = p.role; st.log.push(p.name + ' قُتل ليلاً'); }
    else st.log.push(saved ? 'أنقذ الطبيب أحدهم هذه الليلة' : 'لم يُقتل أحد');
    st.events.push(ev); st.phase = 'day';
    finish(st);
  }
  function narrNext(s, id) {
    const st = clone(s); if (!isNarr(st, id)) err('للراوي فقط');
    if (st.phase === 'roles') startNight(st);
    else if (st.phase === 'night') { if (st.night.step === 'done') resolveNight(st); else advanceStep(st); }
    else if (st.phase === 'day') { st.phase = 'vote'; st.votes = {}; }
    else if (st.phase === 'vote') resolveVote(st);
    else if (st.phase === 'result') { if (!finish(st)) startNight(st); }
    return st;
  }
  function startVote(s, id, isHost) {
    const st = clone(s); if (st.phase !== 'day') err('ليس الآن');
    if (st.cfg.narrator ? !isNarr(st, id) : !isHost) err('صاحب الغرفة يبدأ التصويت');
    st.phase = 'vote'; st.votes = {}; return st;
  }
  function vote(s, id, target) {
    const st = clone(s); if (st.phase !== 'vote') err('ليس وقت التصويت');
    const me = P(st, id); if (!me || !me.alive) err('لا يمكنك التصويت');
    if (target !== 'skip') { const t = P(st, target); if (!t || !t.alive) err('اختر لاعباً حيّاً'); if (target === id) err('لا يمكنك التصويت على نفسك'); }
    st.votes[id] = target;
    if (!st.cfg.narrator && alive(st).every(p => st.votes[p.id])) resolveVote(st);
    return st;
  }
  function tally(st) { const c = {}; for (const p of alive(st)) { const v = st.votes[p.id]; if (v) c[v] = (c[v] || 0) + 1; } return c; }
  function resolveVote(st) {
    const c = tally(st), ks = Object.keys(c);
    const best = ks.length ? Math.max(...ks.map(k => c[k])) : 0;
    const top = ks.filter(k => c[k] === best);
    const ev = { kind: 'vote', day: st.day, out: null, counts: c, tie: top.length > 1 };
    if (top.length === 1 && top[0] !== 'skip') { const p = P(st, top[0]); p.alive = false; ev.out = p.id; ev.role = p.role; st.log.push(p.name + ' خرج بالتصويت'); }
    else st.log.push('لم يخرج أحد بالتصويت');
    st.events.push(ev); st.phase = 'result';
    finish(st);
  }
  function nextFromResult(s, id, isHost) {
    const st = clone(s); if (st.phase !== 'result') err('ليس الآن');
    if (st.cfg.narrator ? !isNarr(st, id) : !isHost) err('صاحب الغرفة يُكمل');
    startNight(st); return st;
  }
  // what one viewer may know about another player's role
  function seenRole(st, viewer, p) {
    const me = P(st, viewer);
    if (st.phase === 'over' || isNarr(st, viewer)) return p.role;
    if (me && me.id === p.id) return p.role;
    if (me && !me.alive) return p.role;
    if (!me) return null;
    if (me.role === 'mafia' && p.role === 'mafia') return 'mafia';
    if (!p.alive && st.cfg.reveal) return p.role;
    if (me.role === 'detective') { const c = (st.checks[me.id] || []).find(x => x.id === p.id); if (c) return c.mafia ? 'mafia' : 'notmafia'; }
    return null;
  }
  return { ROLE, newGame, skipStep, stepEmpty, steps, setReady, nightAct, narrNext, startVote, vote, tally, nextFromResult, seenRole, mafiaTarget, nightDone, alive, defMafia, maxMafia, winner, P,
    actor: () => -1 };
})();
if (typeof module !== 'undefined') module.exports = Mafia;
