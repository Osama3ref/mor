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
    if (n < 4) err('لازم 4 لاعبين على الأقل');
    const m = Math.min(Math.max(1, cfg.mafia || defMafia(n)), maxMafia(n));
    const roles = Array(m).fill('mafia');
    if (cfg.doctor) roles.push('doctor');
    if (cfg.detective) roles.push('detective');
    while (roles.length < n) roles.push('town');
    if (roles.length > n) err('الأدوار أكتر من اللاعبين');
    shuffle(roles);
    return {
      game: 'mafia', phase: 'roles', day: 0,
      cfg: { mafia: m, doctor: !!cfg.doctor, detective: !!cfg.detective, reveal: cfg.reveal !== false, narrator: cfg.narrator || null },
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
    const st = clone(s); if (st.phase !== 'roles') err('مش وقتها');
    if (!P(st, id)) err('إنت مش لاعب'); st.ready[id] = true;
    if (!st.cfg.narrator && st.players.every(p => st.ready[p.id])) startNight(st);
    return st;
  }
  function startNight(st) {
    st.phase = 'night'; st.day++; st.night = { kill: {}, save: null, check: null }; st.votes = {};
    st.log.push('الليلة ' + st.day);
  }
  function nightDone(st) {
    const n = st.night;
    if (aliveRole(st, 'mafia').some(p => !n.kill[p.id])) return false;
    if (st.cfg.doctor && aliveRole(st, 'doctor').length && !n.save) return false;
    if (st.cfg.detective && aliveRole(st, 'detective').length && !n.check) return false;
    return true;
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
    const st = clone(s); if (st.phase !== 'night') err('مش وقت الليل');
    const me = P(st, id); if (!me || !me.alive) err('ما فيك تلعب هلّق');
    const t = P(st, target); if (!t || !t.alive) err('اختار لاعب عايش');
    if (me.role === 'mafia') { if (t.role === 'mafia') err('ما فيك تختار حدا من المافيا'); st.night.kill[id] = target; }
    else if (me.role === 'doctor') { if (st.lastSave === target) err('ما فيك تحمي نفس الشخص ليلتين ورا بعض'); st.night.save = target; }
    else if (me.role === 'detective') {
      if (st.night.check) err('سألت هالليلة خلص'); if (target === id) err('اختار حدا غيرك');
      st.night.check = target; (st.checks[id] = st.checks[id] || []).push({ id: target, mafia: t.role === 'mafia', day: st.day });
    } else err('ما عندك دور بالليل');
    if (!st.cfg.narrator && nightDone(st)) resolveNight(st);
    return st;
  }
  function resolveNight(st) {
    const v = mafiaTarget(st), saved = v && st.night.save === v;
    st.lastSave = st.night.save;
    const ev = { kind: 'night', day: st.day, victim: saved ? null : v, saved: !!saved };
    if (v && !saved) { const p = P(st, v); p.alive = false; ev.role = p.role; st.log.push(p.name + ' انقتل بالليل'); }
    else st.log.push(saved ? 'الطبيب أنقذ حدا هالليلة' : 'ما حدا انقتل');
    st.events.push(ev); st.phase = 'day';
    finish(st);
  }
  function narrNext(s, id) {
    const st = clone(s); if (!isNarr(st, id)) err('بس الراوي');
    if (st.phase === 'roles') startNight(st);
    else if (st.phase === 'night') resolveNight(st);
    else if (st.phase === 'day') { st.phase = 'vote'; st.votes = {}; }
    else if (st.phase === 'vote') resolveVote(st);
    else if (st.phase === 'result') { if (!finish(st)) startNight(st); }
    return st;
  }
  function startVote(s, id, isHost) {
    const st = clone(s); if (st.phase !== 'day') err('مش وقتها');
    if (st.cfg.narrator ? !isNarr(st, id) : !isHost) err('صاحب الغرفة بيبلّش التصويت');
    st.phase = 'vote'; st.votes = {}; return st;
  }
  function vote(s, id, target) {
    const st = clone(s); if (st.phase !== 'vote') err('مش وقت التصويت');
    const me = P(st, id); if (!me || !me.alive) err('ما فيك تصوّت');
    if (target !== 'skip') { const t = P(st, target); if (!t || !t.alive) err('اختار لاعب عايش'); if (target === id) err('ما فيك تصوّت على حالك'); }
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
    if (top.length === 1 && top[0] !== 'skip') { const p = P(st, top[0]); p.alive = false; ev.out = p.id; ev.role = p.role; st.log.push(p.name + ' طلع بالتصويت'); }
    else st.log.push('ما حدا طلع بالتصويت');
    st.events.push(ev); st.phase = 'result';
    finish(st);
  }
  function nextFromResult(s, id, isHost) {
    const st = clone(s); if (st.phase !== 'result') err('مش وقتها');
    if (st.cfg.narrator ? !isNarr(st, id) : !isHost) err('صاحب الغرفة بيكمّل');
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
  return { ROLE, newGame, setReady, nightAct, narrNext, startVote, vote, tally, nextFromResult, seenRole, mafiaTarget, nightDone, alive, defMafia, maxMafia, winner, P,
    actor: () => -1 };
})();
if (typeof module !== 'undefined') module.exports = Mafia;
