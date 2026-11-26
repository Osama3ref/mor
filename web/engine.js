const Mor = (() => {
  const SUITS = ['S', 'H', 'D', 'C'];
  const TARGET = 620;
  const MOR_MIN = 40, CLOSE_MIN = 100;

  const card = id => ({ id, s: id[0], r: id[0] === 'J' ? 0 : parseInt(id.slice(1), 10) });
  const isJ = id => id[0] === 'J';
  const rankOf = id => card(id).r;
  const teamOf = seat => seat % 2;

  function rnd(n) {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n;
    }
    return Math.floor(Math.random() * n);
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function buildDeck() {
    const d = [];
    for (const k of ['a', 'b']) {
      for (const s of SUITS) for (let r = 1; r <= 13; r++) d.push(s + r + k);
      d.push('J0' + k);
    }
    return d;
  }

  // ---------- meld validation ----------
  function analyzeSeq(ids) {
    const N = ids.length;
    if (N < 3 || N > 13) return null;
    const jok = ids.filter(isJ);
    const twos = ids.filter(i => !isJ(i) && rankOf(i) === 2);
    const others = ids.filter(i => !isJ(i) && rankOf(i) !== 2);
    if (jok.length > 1) return null;
    let suits = [...new Set(others.map(i => i[0]))];
    if (suits.length > 1) return null;
    if (!suits.length) suits = [...new Set(twos.map(i => i[0]))];
    let best = null;
    for (const S of suits) {
      const natTwoOptions = [null, ...twos.filter(t => t[0] === S)];
      for (const nt of natTwoOptions) {
        const wildTwos = twos.filter(t => t !== nt);
        if (wildTwos.length > 1) continue;
        const nat = nt ? [...others, nt] : others.slice();
        const nonAce = nat.filter(i => rankOf(i) !== 1).map(rankOf);
        if (new Set(nonAce).size !== nonAce.length) continue;
        const aces = nat.filter(i => rankOf(i) === 1);
        if (aces.length > 1) continue;
        for (let s = 1; s + N - 1 <= 14; s++) {
          const e = s + N - 1;
          if (!nonAce.every(r => r >= s && r <= e)) continue;
          let acePos = null;
          if (aces.length) {
            if (s === 1) acePos = 1; else if (e === 14) acePos = 14; else continue;
          }
          const slots = new Array(N).fill(null);
          for (const i of nat) { const r = rankOf(i); const p = r === 1 ? acePos : r; slots[p - s] = i; }
          const wild = [...jok, ...wildTwos];
          let w = 0;
          for (let k = 0; k < N; k++) if (!slots[k]) slots[k] = wild[w++];
          const clean = wild.length === 0;
          const res = { type: 'seq', ok: true, clean, suit: S, start: s, order: slots, wild };
          if (!best || (clean && !best.clean)) best = res;
          if (best.clean) return best;
        }
      }
    }
    return best;
  }

  function analyzeSet(ids) {
    const N = ids.length;
    if (N < 3) return null;
    const jok = ids.filter(isJ);
    const nat = ids.filter(i => !isJ(i));
    if (jok.length > 1 || !nat.length) return null;
    const r = rankOf(nat[0]);
    if (r === 2) return null;
    if (!nat.every(i => rankOf(i) === r)) return null;
    const order = [...nat.sort((a, b) => SUITS.indexOf(a[0]) - SUITS.indexOf(b[0])), ...jok];
    return { type: 'set', ok: true, clean: jok.length === 0, rank: r, order, wild: jok };
  }

  function analyze(ids) { return analyzeSeq(ids) || analyzeSet(ids); }

  function meldValue(m) {
    const a = analyze(m.cards); if (!a) return 0;
    const L = m.cards.length;
    let t = null;
    if (a.type === 'seq') {
      if (L >= 13) t = [100, 80]; else if (L >= 12) t = [80, 60]; else if (L >= 10) t = [60, 40]; else if (L >= 7) t = [40, 20];
    } else {
      if (L >= 8) t = [80, 60]; else if (L >= 7) t = [40, 20];
    }
    return t ? (a.clean ? t[0] : t[1]) : 0;
  }
  const ground = (st, team) => st.melds.filter(m => m.team === team).reduce((s, m) => s + meldValue(m), 0);

  // ---------- state ----------
  function newGame(names, bots) {
    return { v: 0, bots: bots || [false, false, false, false], phase: 'play', names, scores: [0, 0], round: 0, starter: 0, history: [], log: [], ...dealRound(0) };
  }
  function dealRound(starter) {
    const d = shuffle(buildDeck());
    const mor = [d.splice(0, 11), d.splice(0, 11)];
    const hands = [0, 1, 2, 3].map(() => d.splice(0, 14));
    const discard = d.splice(0, 1);
    return { stock: d, discard, mor, morBy: [null, null], hands, melds: [], pending: {}, turn: starter, step: 'draw', mid: 1, summary: null, finalTurn: false,
      declared: null, melded: false, noDiscard: null, got: null, pen: [0, 0], penNotes: [], taken: [] };
  }
  const clone = st => JSON.parse(JSON.stringify(st));
  function err(msg) { const e = new Error(msg); e.game = true; throw e; }
  function need(st, seat, step) {
    if (st.phase !== 'play') err('الجولة خلصت');
    if (st.turn !== seat) err('مش دورك');
    if (step && st.step !== step) err(step === 'draw' ? 'لازم تسحب أول' : 'سحبت خلص، نزّل أو ارمي');
  }
  function takeFromHand(st, seat, ids) {
    const h = st.hands[seat];
    for (const id of ids) { const i = h.indexOf(id); if (i < 0) err('الورقة مش معك'); h.splice(i, 1); }
  }
  const morLeft = st => st.mor.findIndex(p => p);
  const canMor = (st, seat) => morLeft(st) >= 0 && ground(st, teamOf(seat)) >= MOR_MIN;
  const canClose = (st, seat) => ground(st, teamOf(seat)) >= CLOSE_MIN;
  function log(st, s) { st.log.push(s); if (st.log.length > 30) st.log.shift(); }
  const nm = (st, seat) => st.names[seat];

  const decl = (st, seat, kind) => st.declared && st.declared.seat === seat && st.declared.kind === kind;
  const okMor = (st, seat) => decl(st, seat, 'mor') && canMor(st, seat);
  const okClose = (st, seat) => decl(st, seat, 'close') && canClose(st, seat);
  function emptyErr(st, seat) {
    if (!st.declared || st.declared.seat !== seat) return 'لازم تعلن قبل ما تنزّل: «بدي المور» أو «بدي ضمّن»';
    return st.declared.kind === 'mor' ? 'لازم 40 على الأرض لتاخد المور' : 'لازم 100 على الأرض لتضمّن';
  }
  function afterEmpty(st, seat) {
    const h = st.hands[seat];
    if (h.length > 1) return;
    if (!okMor(st, seat) && !okClose(st, seat)) err((h.length ? 'لازم يضل معك ورقتين لترمي وحدة: ' : 'ما فيك تخلّص ورقك: ') + emptyErr(st, seat));
    if (h.length === 1 && st.noDiscard && st.noDiscard.seat === seat && st.noDiscard.id === h[0]) err('آخر ورقة رح تضل هي اللي أخدتها من الأرض، وما فيك ترجّعها');
  }
  function declare(s, seat, kind) {
    const st = clone(s); need(st, seat, 'play');
    if (kind !== 'mor' && kind !== 'close') err('إعلان غلط');
    if (st.melded) err('الإعلان لازم يكون قبل ما تنزّل ورق بهالدور');
    if (kind === 'mor' && morLeft(st) < 0) err('ما ضل مور');
    st.declared = { seat, kind };
    log(st, nm(st, seat) + (kind === 'mor' ? ' أعلن إنه بدّه ياخد المور' : ' أعلن إنه بدّه يضمّن'));
    return st;
  }
  function undeclare(s, seat) {
    const st = clone(s); need(st, seat, 'play');
    if (st.melded) err('ما فيك تلغي الإعلان بعد ما نزّلت');
    st.declared = null; return st;
  }

  function draw(s, seat) {
    const st = clone(s); need(st, seat, 'draw');
    if (!st.stock.length) err('السحبة خلصت، خذ من الأرض');
    const c = st.stock.pop(); st.hands[seat].push(c); st.step = 'play'; st.got = { seat, ids: [c] }; st.noDiscard = null; st.sinceDraw = 0;
    log(st, nm(st, seat) + ' سحب من السحبة');
    return st;
  }
  function takeDiscard(s, seat, index) {
    const st = clone(s); need(st, seat, 'draw');
    if (index < 0 || index >= st.discard.length) err('ورقة غلط');
    const got = st.discard.splice(index); st.sinceDraw = (st.sinceDraw || 0) + 1;
    st.hands[seat].push(...got); st.step = 'play'; st.got = { seat, ids: got };
    st.noDiscard = got.length === 1 ? { seat, id: got[0] } : null;
    (st.taken = st.taken || []).push({ seat, ids: got.slice(0, 6) }); if (st.taken.length > 24) st.taken.shift();
    log(st, nm(st, seat) + ' أخد ' + got.length + ' من الأرض');
    return st;
  }
  function meldNew(s, seat, ids) {
    const st = clone(s); need(st, seat, 'play');
    if (ids.length < 3) err('التنزيلة لازم 3 ورقات أو أكتر');
    const a = analyze(ids); if (!a) err('هالورق ما بيركب سيري ولا متل بعض');
    takeFromHand(st, seat, ids);
    st.melds.push({ id: 'm' + (st.mid++), team: teamOf(seat), cards: a.order }); st.melded = true;
    afterEmpty(st, seat);
    log(st, nm(st, seat) + ' نزّل ' + ids.length + ' ورقات');
    return st;
  }
  function addToMeld(s, seat, meldId, ids) {
    const st = clone(s); need(st, seat, 'play');
    const m = st.melds.find(x => x.id === meldId); if (!m) err('التنزيلة مش موجودة');
    if (m.team !== teamOf(seat)) err('ما فيك تزيد على تنزيلات الخصم');
    const a = analyze([...m.cards, ...ids]); if (!a) err('ما بتركب على هالتنزيلة');
    takeFromHand(st, seat, ids); m.cards = a.order; st.melded = true;
    afterEmpty(st, seat);
    log(st, nm(st, seat) + ' زاد ' + ids.length + ' على تنزيلة');
    return st;
  }
  function swapOptions(m, id) {
    const out = [];
    for (const w of m.cards) {
      if (out.some(o => o.w === w)) continue;
      const wIsJ = isJ(w), wIsTwo = !wIsJ && rankOf(w) === 2;
      if (!wIsJ && !wIsTwo) continue;
      const cur = analyze(m.cards); if (!cur || !cur.wild.includes(w)) continue;
      if (wIsTwo && (cur.type !== 'seq' || m.cards.length !== 13)) continue;
      if (isJ(id)) continue;
      const rest = m.cards.slice(); rest.splice(rest.indexOf(w), 1);
      const a = analyze([...rest, id]);
      if (a && !a.wild.includes(id) && a.type === cur.type) out.push({ w, order: a.order });
    }
    return out;
  }
  function swapWild(s, seat, meldId, id) {
    const st = clone(s); need(st, seat, 'play');
    const m = st.melds.find(x => x.id === meldId); if (!m) err('التنزيلة مش موجودة');
    if (m.team !== teamOf(seat)) err('ما فيك تبدّل بتنزيلات الخصم');
    const opts = swapOptions(m, id);
    if (!opts.length) err('هالورقة ما بتنفع مكان الجوكر أو الـ2 هون');
    const o = opts.find(x => isJ(x.w)) || opts[0];
    takeFromHand(st, seat, [id]); st.hands[seat].push(o.w); m.cards = o.order; st.melded = true;
    log(st, nm(st, seat) + (isJ(o.w) ? ' فكّ جوكر' : ' بدّل 2'));
    return st;
  }
  function takeMorNow(s, seat) {
    const st = clone(s); need(st, seat, 'play');
    if (st.hands[seat].length) err('لازم تخلّص ورقك أول');
    if (!okMor(st, seat)) err('ما فيك تاخد المور: ' + emptyErr(st, seat));
    const k = morLeft(st); st.hands[seat] = st.mor[k]; st.mor[k] = null; st.morBy[k] = teamOf(seat);
    st.got = { seat, ids: st.hands[seat].slice() }; st.declared = null; st.melded = false;
    log(st, nm(st, seat) + ' أخد المور (مستمر)');
    return st;
  }
  function discard(s, seat, id) {
    const st = clone(s); need(st, seat, 'play');
    if (st.noDiscard && st.noDiscard.seat === seat && st.noDiscard.id === id) {
      const twin = st.hands[seat].find(x => x !== id && x.slice(0, -1) === id.slice(0, -1));
      if (!twin) err('ما فيك ترجّع الورقة اللي أخدتها من الأرض لحالها');
      id = twin;
    }
    takeFromHand(st, seat, [id]); st.discard.push(id);
    if (!st.hands[seat].length) {
      if (!okMor(st, seat) && !okClose(st, seat)) err('ما فيك ترمي آخر ورقة: ' + emptyErr(st, seat));
      st.step = 'choice'; log(st, nm(st, seat) + ' رمى آخر ورقة');
      return st;
    }
    log(st, nm(st, seat) + ' رمى ورقة');
    if (st.declared && st.declared.seat === seat) {
      st.pen[teamOf(seat)] += 20; st.mistakes = st.mistakes || [0, 0, 0, 0]; st.mistakes[seat]++; st.penNotes.push(nm(st, seat) + ' أعلن ' + (st.declared.kind === 'mor' ? 'المور' : 'الضمان') + ' وما قدر: −20');
      log(st, nm(st, seat) + ' انكسر: −20');
    }
    return nextTurn(st);
  }
  function chooseMor(s, seat) {
    const st = clone(s); need(st, seat, 'choice');
    if (!okMor(st, seat)) err('ما فيك تاخد المور');
    const k = morLeft(st); st.hands[seat] = st.mor[k]; st.pending[seat] = true; st.mor[k] = null; st.morBy[k] = teamOf(seat);
    log(st, nm(st, seat) + ' أخد المور (منقطع)');
    return nextTurn(st);
  }
  function close(s, seat) {
    const st = clone(s);
    if (st.phase !== 'play' || st.turn !== seat) err('مش دورك');
    if (st.hands[seat].length) err('لازم تخلّص ورقك لتضمّن');
    if (!okClose(st, seat)) err('ما فيك تضمّن: ' + emptyErr(st, seat));
    log(st, nm(st, seat) + ' ضمّن');
    return endRound(st, 'close', seat);
  }
  function nextTurn(st) {
    if (!st.stock.length) {
      if (st.finalTurn) return endRound(st, 'stock', null);
      st.finalTurn = true;
    }
    st.turn = (st.turn + 1) % 4; st.step = 'draw';
    st.declared = null; st.melded = false; st.noDiscard = null;
    delete st.pending[st.turn];
    return st;
  }
  function endRound(st, how, closer) {
    const g = [ground(st, 0), ground(st, 1)];
    const taken = [0, 1].map(t => st.morBy.filter(x => x === t).length);
    const sum = { how, closer, ground: g, taken, bonus: [0, 0], notes: [], void: false };
    if (taken[0] + taken[1] === 0) {
      sum.void = true; sum.notes.push('ما حدا أخد المور، الجولة بتنعاد');
    } else {
      if (how === 'close') {
        const C = teamOf(closer), O = 1 - C;
        if (taken[C] === 2) { sum.bonus[C] += 40; sum.bonus[O] -= 40; sum.notes.push('ضمان مع المورين: +40 و −40 للخصم'); }
        else if (taken[C] === 1) { sum.bonus[C] += 20; sum.notes.push('ضمان مع مور واحد: +20'); }
        for (const seat of Object.keys(st.pending)) if (st.pending[seat]) { sum.bonus[teamOf(+seat)] -= 20; sum.notes.push(nm(st, +seat) + ' أخد مور منقطع وما لعب فيه: −20'); }
      } else {
        sum.notes.push('خلصت السحبة بدون ضمان');
        for (const t of [0, 1]) if (taken[t] === 2) { sum.bonus[t] += 20; sum.notes.push('أخدوا المورين بدون ضمان: +20'); }
      }
      for (const t of [0, 1]) sum.bonus[t] -= st.pen[t];
      sum.notes.push(...st.penNotes);
      sum.delta = [g[0] + sum.bonus[0], g[1] + sum.bonus[1]];
      st.scores = [st.scores[0] + sum.delta[0], st.scores[1] + sum.delta[1]];
    }
    st.history.push({ round: st.round + 1, delta: sum.delta || [0, 0], void: sum.void });
    if (!sum.void) st.round++;
    st.summary = sum; st.phase = 'roundEnd';
    const [a, b] = st.scores;
    if ((a >= TARGET || b >= TARGET) && a !== b) { st.phase = 'over'; st.winner = a > b ? 0 : 1; }
    return st;
  }
  function nextRound(s) {
    const st = clone(s);
    if (st.phase !== 'roundEnd') err('الجولة لسا ما خلصت');
    const starter = st.summary && st.summary.void ? st.starter : (st.starter + 1) % 4;
    Object.assign(st, dealRound(starter)); st.starter = starter; st.phase = 'play'; st.log = [];
    return st;
  }


  // ---------- bot ----------
  const twinKey = id => id.slice(0, -1);
  function findRuns(cards, wilds) {
    const out = []; let used = new Set(); let w = wilds.slice();
    for (const S of SUITS) {
      const byRank = {};
      for (const c of cards) if (c[0] === S && !used.has(c)) { const r = rankOf(c); if (!byRank[r]) byRank[r] = c; }
      if (byRank[1]) byRank[14] = byRank[1];
      let r = 1;
      while (r <= 14) {
        if (!byRank[r]) { r++; continue; }
        const run = []; let k = r, gapUsed = null;
        while (k <= 14 && run.length < 13) {
          if (byRank[k] && !run.includes(byRank[k])) { run.push(byRank[k]); k++; continue; }
          if (!gapUsed && w.length && byRank[k + 1] && run.length) { gapUsed = w[0]; run.push(gapUsed); k++; continue; }
          break;
        }
        if (run.length === 2 && !gapUsed && w.length) { gapUsed = w[0]; run.push(gapUsed); }
        const nat = run.filter(x => x !== gapUsed);
        if (run.length >= 3 && nat.length >= 2 && analyze(run)) {
          out.push(run); run.forEach(x => used.add(x)); if (gapUsed) w = w.filter(x => x !== gapUsed);
          for (const x of nat) { const rr = rankOf(x); delete byRank[rr]; if (rr === 1) { delete byRank[14]; } }
        }
        r = k > r ? k : r + 1;
      }
    }
    return { runs: out, used, wildsLeft: w };
  }
  function planMelds(hand, melds, team) {
    let rest = hand.slice(); const acts = [];
    const wilds = rest.filter(c => isJ(c) || rankOf(c) === 2);
    const nat = rest.filter(c => !isJ(c));
    const byRank = {};
    for (const c of nat) { const r = rankOf(c); if (r === 2) continue; (byRank[r] = byRank[r] || []).push(c); }
    for (const r in byRank) if (byRank[r].length >= 3) { acts.push({ t: 'new', ids: byRank[r] }); rest = rest.filter(c => !byRank[r].includes(c)); }
    const jk = rest.filter(isJ);
    const { runs } = findRuns(rest.filter(c => !isJ(c)), wilds.filter(c => rest.includes(c)));
    for (const run of runs) { if (run.every(c => rest.includes(c))) { acts.push({ t: 'new', ids: run }); rest = rest.filter(c => !run.includes(c)); } }
    if (jk.length) for (const r in byRank) {
      const pair = byRank[r].filter(c => rest.includes(c));
      if (pair.length === 2 && rest.includes(jk[0])) { acts.push({ t: 'new', ids: [...pair, jk[0]] }); rest = rest.filter(c => !pair.includes(c) && c !== jk[0]); break; }
    }
    const sim = melds.filter(m => m.team === team).map(m => ({ id: m.id, cards: m.cards.slice() }));
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of rest.slice()) {
        if (isJ(c) || rankOf(c) === 2) continue;
        for (const m of sim) if (analyze([...m.cards, c])) { acts.push({ t: 'add', id: m.id, ids: [c] }); m.cards.push(c); rest = rest.filter(x => x !== c); changed = true; break; }
      }
    }
    const g = sim.reduce((a, m) => a + meldValue(m), 0) + acts.filter(a => a.t === 'new').reduce((a, x) => a + meldValue({ cards: x.ids }), 0);
    const lens = [...sim.map(m => m.cards.length), ...acts.filter(a => a.t === 'new').map(a => a.ids.length)];
    return { acts, rest, ground: g, lens };
  }
  function cardKeep(c, hand) {
    if (isJ(c) || rankOf(c) === 2) return 100;
    const r = rankOf(c); let sc = 0;
    for (const o of hand) {
      if (o === c || isJ(o)) continue;
      if (twinKey(o) === twinKey(c)) { sc += 1; continue; }
      if (rankOf(o) === r) sc += 3;
      else if (o[0] === c[0]) { const d = Math.abs(rankOf(o) - r); if (d === 1) sc += 4; else if (d === 2) sc += 2; }
    }
    return sc;
  }
  function botTurn(s, seat) {
    let st = s; const T = teamOf(seat);
    const tryDo = (fn, ...a) => { try { st = fn(st, seat, ...a); return true; } catch (e) { if (!e.game) throw e; return false; } };
    if (st.phase !== 'play' || st.turn !== seat) return st;
    if (st.step === 'choice') { if (!tryDo(chooseMor)) tryDo(close); return st; }
    if (st.step === 'draw') {
      const top = st.discard[st.discard.length - 1];
      let take = !st.stock.length;
      if (!take && top) {
        const before = planMelds(st.hands[seat], st.melds, T), after = planMelds([...st.hands[seat], top], st.melds, T);
        take = after.rest.length <= before.rest.length && !after.rest.includes(top);
      }
      if (!(take && tryDo(takeDiscard, st.discard.length - 1))) if (!tryDo(draw)) return st;
    }
    for (let loop = 0; loop < 3 && st.phase === 'play' && st.turn === seat && st.step === 'play'; loop++) {
      const plan = planMelds(st.hands[seat], st.melds, T);
      const left = plan.rest.length;
      const ourMor = st.morBy.filter(x => x === T).length;
      if (left <= 1 && plan.acts.length) {
        const wantClose = plan.ground >= CLOSE_MIN && (ourMor > 0 || morLeft(st) < 0);
        const wantMor = !wantClose && morLeft(st) >= 0 && plan.ground >= MOR_MIN;
        if (wantClose) tryDo(declare, 'close'); else if (wantMor) tryDo(declare, 'mor');
      }
      const declared = st.declared && st.declared.seat === seat;
      for (const a of plan.acts) {
        if (!declared && st.hands[seat].length - a.ids.length < 2) continue;
        if (a.t === 'new') tryDo(meldNew, a.ids); else tryDo(addToMeld, a.id, a.ids);
      }
      if (!st.hands[seat].length) {
        if (decl(st, seat, 'mor')) { if (tryDo(takeMorNow)) continue; }
        if (decl(st, seat, 'close')) { tryDo(close); return st; }
      }
      break;
    }
    if (st.phase !== 'play' || st.turn !== seat || st.step !== 'play') return st;
    const h = st.hands[seat];
    const order = h.slice().sort((a, b) => cardKeep(a, h) - cardKeep(b, h) || rankOf(b) - rankOf(a));
    for (const c of order) if (tryDo(discard, c)) break;
    if (st.turn === seat && st.step === 'choice') { if (!tryDo(chooseMor)) tryDo(close); }
    return st;
  }

  // ---------- strong bot ----------
  function potential(hand, melds, team) {
    const plan = planMelds(hand, melds, team);
    const left = plan.rest;
    let conn = 0;
    for (const c of left) conn += Math.min(cardKeep(c, left), 7);
    const wilds = left.filter(c => isJ(c) || rankOf(c) === 2).length;
    const P = Mor.P || {};
    let prog = 0; for (const L of plan.lens) if (L < 7) prog += (L - 2) * (L - 2);
    return plan.ground * 3 + (hand.length - left.length) * 2.2 + conn * 0.55 + wilds * 3 + prog * (P.prog ?? 0.8) - left.length * 1.6;
  }
  function danger(st, seat, c) {
    if (isJ(c) || rankOf(c) === 2) return 50;
    const T = teamOf(seat); let d = 0;
    for (const m of st.melds) if (m.team !== T && analyze([...m.cards, c])) d += 9;
    const nextOpp = (seat + 1) % 4;
    for (const t of (st.taken || []).slice(-10)) {
      if (teamOf(t.seat) === T) continue;
      for (const x of t.ids) {
        if (isJ(x)) continue;
        if (rankOf(x) === rankOf(c)) d += t.seat === nextOpp ? 3 : 1.5;
        else if (x[0] === c[0] && Math.abs(rankOf(x) - rankOf(c)) <= 2) d += t.seat === nextOpp ? 3 : 1.5;
      }
    }
    return d;
  }
  function chooseDiscard(st, seat) {
    const h = st.hands[seat], T = teamOf(seat);
    let best = null, bv = -Infinity;
    for (const c of new Set(h)) {
      if (st.noDiscard && st.noDiscard.seat === seat && st.noDiscard.id === c && !h.some(x => x !== c && twinKey(x) === twinKey(c))) continue;
      const rest = h.slice(); rest.splice(rest.indexOf(c), 1);
      const v = potential(rest, st.melds, T) - danger(st, seat, c) * 0.9;
      if (v > bv) { bv = v; best = c; }
    }
    return best;
  }
  function chooseDraw(st, seat) {
    const h = st.hands[seat], T = teamOf(seat), base = potential(h, st.melds, T);
    const late = st.stock.length < 10;
    const P = Mor.P || {};
    const hungry = h.length <= (P.hungryN ?? 5) && ground(st, T) < MOR_MIN;
    let best = -1, bv = st.stock.length ? (hungry ? (P.hbase ?? 1) : (P.base ?? -6)) + (st.sinceDraw || 0) * (P.sd ?? 2) : -Infinity;
    for (let i = st.discard.length - 1; i >= 0 && i >= st.discard.length - 30; i--) {
      const got = st.discard.slice(i);
      if (hungry && got.length < (P.hmin ?? 4) && st.stock.length) continue;
      const v = potential([...h, ...got], st.melds, T) - base - got.length * (hungry ? (P.hcost ?? -0.6) : late ? (P.late ?? 1) : (P.early ?? 0.3));
      if (v > bv) { bv = v; best = i; }
    }
    return best;
  }
  function botTurnStrong(s, seat) {
    let st = s; const T = teamOf(seat), O = 1 - T;
    const tryDo = (fn, ...a) => { try { st = fn(st, seat, ...a); return true; } catch (e) { if (!e.game) throw e; return false; } };
    if (st.phase !== 'play' || st.turn !== seat) return st;
    const wantClose = g => {
      const ourMor = st.morBy.filter(x => x === T).length;
      if (g < CLOSE_MIN) return false;
      if (ourMor > 0 || morLeft(st) < 0) return true;
      return g > ground(st, O) + 40;
    };
    if (st.step === 'choice') { if (!(decl(st, seat, 'close') && tryDo(close))) if (!tryDo(chooseMor)) tryDo(close); return st; }
    if (st.step === 'draw') {
      const i = chooseDraw(st, seat);
      if (!(i >= 0 && tryDo(takeDiscard, i))) if (!tryDo(draw)) if (!tryDo(takeDiscard, st.discard.length - 1)) return st;
    }
    for (let loop = 0; loop < 4 && st.phase === 'play' && st.turn === seat && st.step === 'play'; loop++) {
      const plan = planMelds(st.hands[seat], st.melds, T);
      const left = plan.rest.length;
      if (!st.melded && !(st.declared && st.declared.seat === seat) && left <= 1 && plan.acts.length) {
        if (wantClose(plan.ground)) tryDo(declare, 'close');
        else if (morLeft(st) >= 0 && plan.ground >= MOR_MIN) tryDo(declare, 'mor');
        else if (plan.ground >= CLOSE_MIN) tryDo(declare, 'close');
      }
      const declared = st.declared && st.declared.seat === seat;
      const hold = (Mor.P || {}).hold ?? true;
      const opened = ground(st, T) >= MOR_MIN || plan.ground >= MOR_MIN;
      for (const a of plan.acts) {
        if (!declared && st.hands[seat].length - a.ids.length < 2) continue;
        if (hold && !opened && !declared && a.t === 'new' && a.ids.length < 7 && st.stock.length > 4) continue;
        if (a.t === 'new') tryDo(meldNew, a.ids); else tryDo(addToMeld, a.id, a.ids);
      }
      // free a joker from our melds when we hold its natural card
      for (const m of st.melds.filter(x => x.team === T)) for (const c of st.hands[seat].slice()) if (swapOptions(m, c).length) { tryDo(swapWild, m.id, c); break; }
      if (!st.hands[seat].length) {
        if (decl(st, seat, 'mor') && tryDo(takeMorNow)) continue;
        if (decl(st, seat, 'close')) { tryDo(close); return st; }
      }
      break;
    }
    if (st.phase !== 'play' || st.turn !== seat || st.step !== 'play') return st;
    const c = chooseDiscard(st, seat);
    if (!(c && tryDo(discard, c))) for (const x of st.hands[seat].slice()) if (tryDo(discard, x)) break;
    if (st.turn === seat && st.step === 'choice') { if (!(decl(st, seat, 'close') && tryDo(close))) if (!tryDo(chooseMor)) tryDo(close); }
    return st;
  }

  // Explore runs before sets as well as extending the team's table first.
  // Every candidate goes through the same meld validator as a human move.
  function morPlans(st, seat) {
    const team = teamOf(seat), hand = st.hands[seat], melds = st.melds.filter(m => m.team === team);
    const skip = st.noDiscard?.seat === seat ? st.noDiscard.id : null;
    function extension(table, rest, fast) {
      let best = null, value = -Infinity;
      for (const m of table) {
        const shape = analyze(m.cards); if (!shape) continue;
        const before = meldValue(m);
        const pool = rest.filter(c => isJ(c) || rankOf(c) === 2 ||
          (shape.type === 'set' ? rankOf(c) === shape.rank : c[0] === shape.suit));
        const consider = ids => {
          const cards = [...m.cards,...ids], a = analyze(cards);
          if (!a || a.type !== shape.type) return;
          const delta = meldValue({cards:a.order}) - before;
          const v = delta*1.8 + ids.length*2.6 + Math.min(7,cards.length)*0.7
            - ids.filter(c=>a.wild.includes(c)).length*(delta>0 ? 3 : 7.5);
          if (v > value && v>0) { value=v; best={t:'add',id:m.id,ids,cards:a.order}; }
        };
        for (let i=0;i<pool.length;i++) {
          consider([pool[i]]);
          if (!fast) for (let j=i+1;j<pool.length;j++) consider([pool[i],pool[j]]);
        }
      }
      return best;
    }
    function runOptions(rest, addWild, priority) {
      const options = [];
      const wild = rest.filter(c => isJ(c) || rankOf(c) === 2);
      for (const suit of SUITS) {
        const ranks = new Map();
        // At most one copy of each natural rank can enter a given run.
        for (const c of rest) if (c[0] === suit && !ranks.has(rankOf(c))) ranks.set(rankOf(c),c);
        for (let start=1;start<=12;start++) {
          const natural=[], seen = new Set(); let gaps=0;
          for (let end=start;end<=14 && end-start<13;end++) {
            const card = ranks.get(end===14?1:end);
            if (card && !seen.has(card)) { seen.add(card); natural.push(card); }
            else gaps++;
            if (gaps > (addWild ? 1 : 0)) break;
            if (end-start+1 < 3 || natural.length < 2) continue;
            const used = gaps ? wild.find(w => !seen.has(w) && analyzeSeq([...natural,w])) : null;
            if (gaps && !used) continue;
            const ids = used ? [...natural,used] : natural.slice(), shape=analyzeSeq(ids);
            if (!shape) continue;
            const score = meldValue({cards:ids})*2 + ids.length*(priority?3.8:4.4)
              - (used ? (ids.length<7 ? 8.0 : 2) : 0) + (ids.includes(skip)?0.4:0);
            options.push({ids,score});
          }
        }
      }
      return options;
    }
    function alternate(tableFirst, addWild) {
      let rest=hand.slice(), table=melds.map(m=>({id:m.id,cards:m.cards.slice()})), fresh=[], acts=[];
      function apply(a) {
        acts.push(a);
        rest=rest.filter(c=>!a.ids.includes(c));
        if (a.t==='add') table.find(m=>m.id===a.id).cards=a.cards;
        else fresh.push(a.ids);
      }
      function extend(fast) {
        for (let n=0;n<12 && rest.length;n++) {
          const a=extension(table,rest,fast);
          if (!a) break;
          apply(a);
        }
      }
      if (tableFirst) extend(false);
      for (let n=0;n<8 && rest.length>=3;n++) {
        const options=runOptions(rest,addWild,tableFirst);
        for (const r of [1,3,4,5,6,7,8,9,10,11,12,13]) {
          const ids=rest.filter(c=>rankOf(c)===r);
          if (ids.length>=3) {
            options.push({ids,score:meldValue({cards:ids})*2+ids.length*3.5+(ids.includes(skip)?0.4:0)});
            const j=rest.find(isJ);
            if (addWild && j && (ids.length===6 || ids.length===7)) {
              const mix=[...ids,j]; options.push({ids:mix,score:meldValue({cards:mix})*2+mix.length*3.5-3});
            }
          }
          if (ids.length===2 && addWild) {
            const j=rest.find(isJ); if(j) options.push({ids:[...ids,j],score:3});
          }
        }
        options.sort((a,b)=>b.score-a.score);
        if (!options.length) break;
        apply({t:'new',ids:options[0].ids});
      }
      if (!tableFirst) extend(false);
      const g=[...table.map(m=>m.cards),...fresh];
      return {rest,acts,ground:g.reduce((v,c)=>v+meldValue({cards:c}),0),lens:g.map(c=>c.length)};
    }
    const out=[planMelds(hand,st.melds,team),alternate(false,false),alternate(true,true)];
    const canFinish=p=>p.rest.length===0 || (p.rest.length===1 && p.rest[0]!==skip);
    const score=p=>{
      const close = p.ground>=CLOSE_MIN && st.morBy.some(x=>x!=null);
      const mor = p.ground>=MOR_MIN && morLeft(st)>=0;
      const finish = canFinish(p) ? close ? 230 : mor ? 155 : -28 : 0;
      const wilds = p.rest.filter(c=>isJ(c)||rankOf(c)===2).length;
      return finish + p.ground*2.3 + (hand.length-p.rest.length)*2 + wilds*7 +
        p.lens.reduce((a,n)=>a+(n>=5 && n<7 ? (n-4)*4 : 0),0);
    };
    return out.sort((a,b)=>score(b)-score(a));
  }
  // This evaluates likely future pickups from the public card pool. It never
  // inspects the deck order, the other hands or the reserved Mor cards.
  function morBelief(st,seat) {
    const seen=new Set([...st.hands[seat], ...st.discard, ...st.melds.flatMap(m=>m.cards)]);
    for (const x of (st.taken||[]).slice(-4)) for (const c of x.ids) seen.add(c);
    return buildDeck().filter(c=>!seen.has(c));
  }
  function morPickSpread(pool,n,salt) {
    const p=pool.slice(), out=[];
    let z=(0x9E3779B9^salt)>>>0;
    for(let i=0;i<n && p.length;i++){
      z=(Math.imul(z,1664525)+1013904223)>>>0;
      out.push(p.splice(z%p.length,1)[0]);
    }
    return out;
  }
  function morFutureValue(st,seat,hand) {
    const team=teamOf(seat), plan=planMelds(hand,st.melds,team);
    const h=plan.rest, needed=morLeft(st)>=0 ? MOR_MIN : CLOSE_MIN;
    const turns=st.stock.length, end=turns<=6;
    let value=plan.ground*2.4 + Math.min(plan.ground,needed)*0.60;
    value+=(hand.length-h.length)*2.25-h.length*(end?3.2:1.4);
    for(const c of h) value+=isJ(c)||rankOf(c)===2 ? 7 : Math.min(7,cardKeep(c,h))*0.62;
    for(const len of plan.lens) if(len<7) value+=Math.max(0,len-3)**2*1.3;
    if(plan.ground>=needed){
      if(h.length<=1) value+=34;
      else if(h.length<=3) value+=12;
    }
    return value;
  }
  function morForecastDraw(st,seat) {
    const normal=chooseDraw(st,seat), pile=st.discard, own=st.hands[seat];
    if(!pile.length || !st.stock.length) return normal;
    const hidden=morBelief(st,seat), base=morFutureValue(st,seat,own), end=st.stock.length<=6;
    const samples=morPickSpread(hidden,8,313*own.length+73*st.stock.length+st.round);
    if(!samples.length)return normal;
    const pickup=xs=>morFutureValue(st,seat,[...own,...xs])-base;
    let threshold=samples.reduce((v,c)=>v+pickup([c]),0)/samples.length;
    threshold+=(st.sinceDraw||0)*(end?2.4:1.1);
    let best=-1, score=threshold+(normal<0?0.4:1.6);
    const choices=new Set([normal]);
    for(let len=1;len<=Math.min(10,pile.length);len++) choices.add(pile.length-len);
    if(pile.length>10) for(const extra of [14,18,23]) if(pile.length>=extra) choices.add(pile.length-extra);
    for(const i of choices) if(i>=0){
      const got=pile.slice(i);
      const gain=pickup(got)-Math.max(0,got.length-1)*(end?1.3:0.48);
      if(gain>score){score=gain;best=i;}
    }
    return best;
  }
  function morForecastDiscard(st,seat) {
    const normal=chooseDiscard(st,seat), h=st.hands[seat];
    if(h.length<2 || !normal) return normal;
    const skip=st.noDiscard?.seat===seat?st.noDiscard.id:null;
    const limit=st.stock.length>22?4:6, risk=st.stock.length<8?1.35:1.12;
    const candidates=h.filter(c=>c!==skip||h.some(x=>x!==c&&twinKey(x)===twinKey(c)))
      .map(c=>{
        const rest=h.filter(x=>x!==c), control=danger(st,seat,c)*risk,
          current=morFutureValue(st,seat,rest)-control;
        return {c,rest,current};
      }).sort((a,b)=>b.current-a.current);
    const pool=morBelief(st,seat), samples=morPickSpread(pool,limit,197*st.stock.length+71*h.length+st.round);
    if(!samples.length)return normal;
    const short=candidates.slice(0,4), baseline=candidates.find(o=>o.c===normal);
    if(baseline&&!short.includes(baseline))short.push(baseline);
    const score=o=>o.current*0.65 +
      0.35*samples.reduce((v,x)=>v+morFutureValue(st,seat,[...o.rest,x])-danger(st,seat,o.c)*risk,0)/samples.length;
    let top=normal, best=baseline?score(baseline)+0.35:-Infinity;
    for(const o of short){
      const v=score(o);
      if(v>best){top=o.c;best=v;}
    }
    return top;
  }

  function morExpert(s, seat, expert = false) {
    if (s.phase !== 'play' || s.turn !== seat || s.step==='choice') return botTurnStrong(s,seat);
    const team=teamOf(seat), other=1-team;
    let st=s;
    const go=(q,fn,...args)=>{try{return fn(q,seat,...args);}catch(e){if(!e.game)throw e;return null;}};
    if (st.step==='draw') {
      const i=expert ? morForecastDraw(st,seat) : chooseDraw(st,seat);
      st=(i>=0&&go(st,takeDiscard,i)) || go(st,draw) || go(st,takeDiscard,st.discard.length-1) || s;
      if (st===s) return s;
    }
    for(let repeat=0;repeat<3;repeat++){
      const plans=morPlans(st,seat), skip=st.noDiscard?.seat===seat?st.noDiscard.id:null;
      const apply=(start,p,finish)=>{
        let q=start;
        for(const a of p.acts){
          if(!finish && q.hands[seat].length-a.ids.length<2) continue;
          const next=a.t==='new'?go(q,meldNew,a.ids):go(q,addToMeld,a.id,a.ids);
          if(next) q=next;
          else if(finish) return null;
        }
        return q;
      };
      let continuous=null;
      if (!st.melded) for(const p of plans){
        if(p.rest.length>1 || (p.rest.length===1 && p.rest[0]===skip)) continue;
        const took=st.morBy.filter(x=>x!=null).length;
        const wantClose=p.ground>=CLOSE_MIN && took>0 &&
          (morLeft(st)<0 || st.morBy.includes(team) || p.ground>ground(st,other)+50);
        const mode=wantClose?'close':morLeft(st)>=0&&p.ground>=MOR_MIN?'mor':took&&p.ground>=CLOSE_MIN?'close':null;
        if(!mode) continue;
        const dec=go(st,declare,mode);
        if(!dec) continue;
        let q=apply(dec,p,true);
        if(!q) continue;
        if(q.hands[seat].length===1) q=go(q,discard,q.hands[seat][0]);
        if(!q || q.hands[seat].length!==0) continue;
        if(mode==='close'){
          const closed=go(q,close);
          if(closed && (!expert || closed.phase!=='over' || closed.winner===team)) return closed;
        }
        else if(q.step==='choice'){const taken=go(q,chooseMor); if(taken)return taken;}
        else { continuous=go(q,takeMorNow); if(continuous) break; }
      }
      if (continuous){st=continuous;continue;}
      st=apply(st,plans[0],false);
      for (const m of st.melds.filter(x=>x.team===team)) {
        for(const c of st.hands[seat].slice()){
          if (swapOptions(m,c).length){st=go(st,swapWild,m.id,c)||st;break;}
        }
      }
      break;
    }
    const c=expert ? morForecastDiscard(st,seat) : chooseDiscard(st,seat);
    const next=(c&&go(st,discard,c)) || st.hands[seat].map(x=>go(st,discard,x)).find(Boolean);
    return next && next.turn===seat && next.step==='choice' ? botTurnStrong(next,seat) : next || botTurnStrong(st,seat);
  }

  return { botTurnStrong, botTurnEasy: botTurn, botTurn: (st, seat, stronger = true) => stronger ? morExpert(st, seat, stronger === 'expert') : botTurnStrong(st, seat), declare, undeclare, okMor, okClose, card, isJ, rankOf, teamOf, analyze, meldValue, ground, newGame, draw, takeDiscard, meldNew, addToMeld, swapWild, swapOptions, takeMorNow, discard, chooseMor, close, nextRound, canMor, canClose, MOR_MIN, CLOSE_MIN, TARGET, buildDeck };
})();
if (typeof module !== 'undefined') module.exports = Mor;
