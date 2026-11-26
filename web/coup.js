// Coup: pure state engine. Players are identified by uid.
const Coup = (() => {
  const CH = { duke: 'الدوق', assassin: 'القاتل', captain: 'القبطان', ambassador: 'السفير', contessa: 'الكونتيسة' };
  const ACT = {
    income: { name: 'دخل', gain: 1 },
    aid: { name: 'مساعدة خارجية', gain: 2, blockBy: ['duke'], anyBlock: true },
    coup: { name: 'انقلاب', cost: 7, target: true },
    tax: { name: 'ضريبة', gain: 3, claim: 'duke' },
    assassinate: { name: 'اغتيال', cost: 3, target: true, claim: 'assassin', blockBy: ['contessa'] },
    steal: { name: 'سرقة', target: true, claim: 'captain', blockBy: ['captain', 'ambassador'] },
    exchange: { name: 'تبديل', claim: 'ambassador' }
  };
  const clone = s => JSON.parse(JSON.stringify(s));
  function err(m) { const e = new Error(m); e.game = true; throw e; }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const P = (st, id) => st.players.find(p => p.id === id);
  const alive = st => st.players.filter(p => p.cards.some(c => !c.dead));
  const live = p => p.cards.filter(c => !c.dead);
  const nm = (st, id) => (P(st, id) || {}).name || '';
  function newGame(players) {
    if (players.length < 2) err('لازم لاعبين اتنين على الأقل');
    if (players.length > 6) err('الحد الأقصى 6 لاعبين');
    const deck = shuffle(Object.keys(CH).flatMap(c => [c, c, c]));
    const ps = shuffle(players.slice()).map(p => ({ id: p.id, name: p.name, av: p.av || '', coins: 2, cards: [{ c: deck.pop() }, { c: deck.pop() }] }));
    const st = { game: 'coup', phase: 'turn', players: ps, deck, turn: 0, act: null, resp: {}, block: null, queue: [], lose: null, exch: null, winner: null, log: ['بلّشت اللعبة'], round: 1 };
    if (ps.length === 2) ps[0].coins = 1; // the first player starts with one coin in a two player game
    return st;
  }
  const cur = st => st.players[st.turn];
  function nextTurn(st) {
    if (alive(st).length <= 1) { st.phase = 'over'; st.winner = alive(st)[0].id; st.log.push('ربح ' + alive(st)[0].name); return; }
    let i = st.turn;
    do { i = (i + 1) % st.players.length; } while (!live(st.players[i]).length);
    if (i <= st.turn) st.round++;
    st.turn = i; st.phase = 'turn'; st.act = null; st.resp = {}; st.block = null; st.exch = null;
  }
  function swapCard(st, p, ch) {
    const k = p.cards.findIndex(c => !c.dead && c.c === ch);
    st.deck.push(ch); shuffle(st.deck); p.cards[k] = { c: st.deck.pop() };
  }
  // run queued steps until one needs a player's input
  function run(st) {
    while (st.queue.length && st.phase !== 'over') {
      const s = st.queue.shift();
      if (s.k === 'lose') {
        const p = P(st, s.p), l = live(p);
        if (!l.length) continue;
        if (l.length === 1) { killCard(st, p, p.cards.indexOf(l[0]), s.why); continue; }
        st.phase = 'lose'; st.lose = { p: s.p, why: s.why }; return st;
      }
      if (s.k === 'exec') { if (exec(st)) return st; continue; }
      if (s.k === 'respond') { st.phase = 'respond'; st.resp = {}; if (!eligible(st).length) { st.queue.unshift({ k: 'exec' }, { k: 'next' }); continue; } return st; }
      if (s.k === 'next') { nextTurn(st); return st; }
    }
    return st;
  }
  function killCard(st, p, i, why) {
    p.cards[i].dead = true;
    st.log.push(p.name + ' خسر ' + CH[p.cards[i].c] + (why ? ' (' + why + ')' : ''));
    if (!live(p).length) st.log.push(p.name + ' طلع من اللعبة');
    if (alive(st).length <= 1) { st.phase = 'over'; st.winner = alive(st)[0].id; st.log.push('ربح ' + alive(st)[0].name); st.queue = []; }
  }
  function exec(st) {
    const a = st.act, me = P(st, a.by), t = a.target && P(st, a.target), A = ACT[a.k];
    if (!live(me).length) return false;
    if (a.k === 'steal') { const n = Math.min(2, t.coins); t.coins -= n; me.coins += n; st.log.push(me.name + ' سرق ' + n + ' من ' + t.name); }
    else if (a.k === 'assassinate' || a.k === 'coup') { if (live(t).length) st.queue.unshift({ k: 'lose', p: t.id, why: A.name }); }
    else if (a.k === 'exchange') {
      const draw = [st.deck.pop(), st.deck.pop()];
      st.exch = { opts: [...live(me).map(c => c.c), ...draw], keep: live(me).length };
      st.phase = 'exchange'; return true;
    } else if (A.gain) { me.coins += A.gain; st.log.push(me.name + ' أخد ' + A.gain + ' (' + A.name + ')'); }
    return false;
  }
  function eligible(st) {
    // who still has to answer in the current response window
    const a = st.act, A = ACT[a.k];
    if (st.phase === 'respond') return alive(st).filter(p => p.id !== a.by && (A.claim && !a.challenged || (A.blockBy && (A.anyBlock || p.id === a.target)))).map(p => p.id);
    if (st.phase === 'block') return alive(st).filter(p => p.id !== st.block.by).map(p => p.id);
    return [];
  }
  function act(s, id, k, target) {
    const st = clone(s); if (st.phase !== 'turn') err('مش وقتها');
    const me = cur(st); if (me.id !== id) err('مش دورك');
    const A = ACT[k]; if (!A) err('حركة مش معروفة');
    if (me.coins >= 10 && k !== 'coup') err('معك 10 أو أكتر: لازم تعمل انقلاب');
    if (A.cost && me.coins < A.cost) err('ما معك مصاري كفاية');
    if (A.target) { const t = P(st, target); if (!t || t.id === id || !live(t).length) err('اختار لاعب'); }
    if (A.cost) me.coins -= A.cost;
    st.act = { k, by: id, target: A.target ? target : null, challenged: false };
    st.log.push(me.name + ': ' + A.name + (A.target ? ' على ' + nm(st, target) : '') + (A.claim ? ' (بيدّعي ' + CH[A.claim] + ')' : ''));
    if (k === 'income' || k === 'coup') { st.queue = [{ k: 'exec' }, { k: 'next' }]; return run(st); }
    st.phase = 'respond'; st.resp = {};
    if (!eligible(st).length) { st.queue = [{ k: 'exec' }, { k: 'next' }]; return run(st); }
    return st;
  }
  function pass(s, id) {
    const st = clone(s); if (st.phase !== 'respond' && st.phase !== 'block') err('مش وقتها');
    if (!eligible(st).includes(id)) err('مش مطلوب منك شي');
    st.resp[id] = 'pass';
    if (eligible(st).every(x => st.resp[x])) {
      if (st.phase === 'respond') st.queue = [{ k: 'exec' }, { k: 'next' }];
      else { st.log.push('انمنعت الحركة'); st.queue = [{ k: 'next' }]; }
      return run(st);
    }
    return st;
  }
  function challenge(s, id) {
    const st = clone(s);
    if (!eligible(st).includes(id)) err('ما فيك تشكّك هلّق');
    const ch = P(st, id);
    if (st.phase === 'respond') {
      const a = st.act, A = ACT[a.k]; if (!A.claim || a.challenged) err('ما في ادعاء لتشكّك فيه');
      const me = P(st, a.by);
      st.log.push(ch.name + ' شكّك بـ ' + me.name);
      if (live(me).some(c => c.c === A.claim)) {
        st.log.push(me.name + ' كاشف ' + CH[A.claim] + '، الحق معه');
        swapCard(st, me, A.claim); a.challenged = true;
        st.queue = [{ k: 'lose', p: id, why: 'شكّ غلط' }];
        const stillBlock = A.blockBy && alive(st).some(p => p.id !== a.by && (A.anyBlock || p.id === a.target));
        st.queue.push(stillBlock ? { k: 'respond' } : { k: 'exec' }, ...(stillBlock ? [] : [{ k: 'next' }]));
      } else {
        st.log.push(me.name + ' كان عم يكذب');
        if (A.cost) me.coins += A.cost;
        st.queue = [{ k: 'lose', p: a.by, why: 'كذب' }, { k: 'next' }];
      }
      return run(st);
    }
    if (st.phase === 'block') {
      const b = st.block, bp = P(st, b.by);
      st.log.push(ch.name + ' شكّك بمنع ' + bp.name);
      if (live(bp).some(c => c.c === b.as)) {
        st.log.push(bp.name + ' كاشف ' + CH[b.as] + '، الحركة انمنعت');
        swapCard(st, bp, b.as);
        st.queue = [{ k: 'lose', p: id, why: 'شكّ غلط' }, { k: 'next' }];
      } else {
        st.log.push(bp.name + ' كان عم يكذب بالمنع');
        st.queue = [{ k: 'lose', p: b.by, why: 'كذب' }, { k: 'exec' }, { k: 'next' }];
      }
      return run(st);
    }
    err('مش وقتها');
  }
  function block(s, id, as) {
    const st = clone(s); if (st.phase !== 'respond') err('مش وقتها');
    const a = st.act, A = ACT[a.k];
    if (!A.blockBy || !A.blockBy.includes(as)) err('ما فيك تمنع هيك');
    if (!A.anyBlock && a.target !== id) err('بس المستهدف بيمنع');
    if (!eligible(st).includes(id)) err('ما فيك تمنع');
    st.block = { by: id, as }; st.phase = 'block'; st.resp = {};
    st.log.push(nm(st, id) + ' بيمنع بـ ' + CH[as]);
    return st;
  }
  function loseCard(s, id, i) {
    const st = clone(s); if (st.phase !== 'lose' || st.lose.p !== id) err('مش مطلوب منك');
    const p = P(st, id); if (!p.cards[i] || p.cards[i].dead) err('اختار ورقة عايشة');
    killCard(st, p, i, st.lose.why); st.lose = null;
    if (st.phase === 'over') return st;
    st.phase = 'run';
    run(st);
    if (st.phase === 'run') nextTurn(st);
    return st;
  }
  function exchange(s, id, keepIdx) {
    const st = clone(s); if (st.phase !== 'exchange' || st.act.by !== id) err('مش وقتها');
    const e = st.exch; if (!Array.isArray(keepIdx) || keepIdx.length !== e.keep || new Set(keepIdx).size !== e.keep) err('اختار ' + e.keep + ' ورقات');
    const p = P(st, id), keep = keepIdx.map(i => e.opts[i]);
    e.opts.forEach((c, i) => { if (!keepIdx.includes(i)) st.deck.push(c); }); shuffle(st.deck);
    let k = 0; p.cards.forEach(c => { if (!c.dead) c.c = keep[k++]; });
    st.log.push(p.name + ' بدّل ورقاته'); st.exch = null;
    st.phase = 'run'; st.queue = st.queue.length ? st.queue : [{ k: 'next' }]; run(st);
    if (st.phase === 'run') nextTurn(st);
    return st;
  }
  return { CH, ACT, newGame, act, pass, challenge, block, loseCard, exchange, eligible, alive, live, P, cur, actor: () => -1 };
})();
if (typeof module !== 'undefined') module.exports = Coup;
