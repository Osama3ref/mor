const Games = (() => {
  const SUITS = ['S', 'H', 'C', 'D'];
  const cr = id => ({ s: id[0], r: +id.slice(1) });
  const teamOf = s => s % 2;
  const clone = x => JSON.parse(JSON.stringify(x));
  function err(m) { const e = new Error(m); e.game = true; throw e; }
  function rnd(n) { if (typeof crypto !== 'undefined' && crypto.getRandomValues) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; } return Math.floor(Math.random() * n); }
  function deck() { const d = []; for (const s of SUITS) for (let r = 2; r <= 14; r++) d.push(s + r); for (let i = d.length - 1; i > 0; i--) { const j = rnd(i + 1); [d[i], d[j]] = [d[j], d[i]]; } return d; }
  const sortIds = h => h.slice().sort((a, b) => SUITS.indexOf(a[0]) - SUITS.indexOf(b[0]) || cr(a).r - cr(b).r);
  const SN = { S: 'بستوني', H: 'كبة', C: 'سباتي', D: 'ديناري' };
  function log(st, m) { st.log.push(m); if (st.log.length > 30) st.log.shift(); }
  function deal(st) {
    const d = deck(); st.hands = [0, 1, 2, 3].map(i => sortIds(d.slice(i * 13, i * 13 + 13)));
    st.trick = []; st.trickDone = false; st.tricks = [0, 0, 0, 0]; st.taken = [[], [], [], []]; st.summary = null; st.hs = [0, 0, 0, 0];
  }
  function base(game, names, bots) {
    return { game, v: 0, names, bots: bots || [false, false, false, false], scores: [0, 0, 0, 0], log: [], handNo: 0, history: [] };
  }

  // ---------- trick taking core ----------
  function legal(st, seat) {
    const h = st.hands[seat];
    if (!st.trick.length || st.trickDone) return h.slice();
    const led = st.trick[0].card[0], f = h.filter(c => c[0] === led);
    return f.length ? f : h.slice();
  }
  function winnerOf(trick, trump) {
    let best = trick[0];
    for (const t of trick.slice(1)) {
      const a = cr(best.card), b = cr(t.card);
      if (b.s === a.s) { if (b.r > a.r) best = t; }
      else if (trump && b.s === trump) best = t;
    }
    return best.seat;
  }
  function playCard(s, seat, id, G) {
    const st = clone(s);
    if (st.phase !== 'play') err('مش وقت اللعب');
    if (st.turn !== seat) err('مش دورك');
    if (!legal(st, seat).includes(id)) err(st.hands[seat].includes(id) ? 'لازم تلعب من نفس الشكل' : 'الورقة مش معك');
    if (st.trickDone) { st.trick = []; st.trickDone = false; }
    st.hands[seat].splice(st.hands[seat].indexOf(id), 1);
    st.trick.push({ seat, card: id });
    st.turn = (seat + 1) % 4;
    if (st.trick.length === 4) {
      const w = winnerOf(st.trick, st.trump);
      st.tricks[w]++; st.taken[w].push(...st.trick.map(t => t.card));
      st.trickDone = true; st.turn = w; st.lastWinner = w;
      const end = G.onTrick ? G.onTrick(st, w) : false;
      if (end || st.hands.every(h => !h.length)) G.endHand(st);
    }
    return st;
  }

  // ---------- simple card sense for bots ----------
  function estTricks(hand, trump) {
    let t = 0;
    for (const s of SUITS) {
      const cs = hand.filter(c => c[0] === s).map(c => cr(c).r).sort((a, b) => b - a), n = cs.length;
      if (s === trump) { t += cs.filter(r => r >= 12).length * 0.9 + Math.max(0, n - 3) * 0.85 + (n >= 3 ? 0.4 : 0); continue; }
      if (cs.includes(14)) t += 1;
      if (cs.includes(13) && n >= 2) t += cs.includes(14) ? 0.85 : 0.55;
      if (cs.includes(12) && n >= 3) t += 0.3;
      if (trump && n <= 1 && hand.filter(c => c[0] === trump).length >= 3) t += n === 0 ? 0.8 : 0.4;
    }
    return t;
  }
  function trickPlayBot(st, seat, wantTricks) {
    const L = legal(st, seat), trump = st.trump;
    const R = c => cr(c).r;
    const lowest = arr => arr.slice().sort((a, b) => R(a) - R(b))[0];
    const highest = arr => arr.slice().sort((a, b) => R(b) - R(a))[0];
    const fresh = !st.trick.length || st.trickDone;
    if (fresh) {
      if (!wantTricks) return lowest(L);
      const nonT = L.filter(c => c[0] !== trump);
      const aces = nonT.filter(c => R(c) === 14);
      if (aces.length) return aces[0];
      const myT = L.filter(c => c[0] === trump);
      if (myT.length >= 4 && myT.some(c => R(c) >= 13)) return highest(myT);
      const pool = nonT.length ? nonT : L;
      const bySuit = {}; for (const c of pool) (bySuit[c[0]] = bySuit[c[0]] || []).push(c);
      const longest = Object.values(bySuit).sort((a, b) => b.length - a.length)[0];
      return lowest(longest);
    }
    const trick = st.trick, curW = winnerOf(trick, trump), led = trick[0].card[0];
    const curCard = trick.find(t => t.seat === curW).card;
    const beats = c => winnerOf([...trick, { seat, card: c }], trump) === seat;
    const partnerWinning = teamOf(curW) === teamOf(seat);
    const last = trick.length === 3;
    if (wantTricks) {
      if (partnerWinning && (last || R(curCard) >= 13 || (curCard[0] === trump && led !== trump))) return lowestDiscard(L, trump);
      const win = L.filter(beats);
      if (win.length) return lowest(win);
      return lowestDiscard(L, trump);
    }
    return lowest(L);
  }
  function lowestDiscard(L, trump) {
    const nonT = L.filter(c => c[0] !== trump), pool = nonT.length ? nonT : L;
    return pool.slice().sort((a, b) => cr(a).r - cr(b).r)[0];
  }

  // ---------- Tarneeb 61 (team bidding) ----------
  const T61 = {
    id: 'tarneeb61', name: 'طرنيب 61', sub: 'فريقين · مزايدة من 7 لـ 13', target: 61, teams: true,
    newGame(names, bots) { const st = base('tarneeb61', names, bots); st.tscores = [0, 0]; st.dealer = rnd(4); T61.startHand(st); return st; },
    startHand(st) {
      deal(st); st.phase = 'bid'; st.bid = null; st.passed = [false, false, false, false]; st.trump = null;
      st.turn = (st.dealer + 1) % 4; st.handNo++;
    },
    actor: st => (['bid', 'trump', 'play'].includes(st.phase) ? st.turn : -1),
    bid(s, seat, val) {
      const st = clone(s);
      if (st.phase !== 'bid' || st.turn !== seat) err('مش دورك بالمزايدة');
      if (val) {
        const min = st.bid ? st.bid.val + 1 : 7;
        if (val < min || val > 13) err('لازم تطلب ' + min + ' أو أكتر');
        st.bid = { seat, val }; log(st, st.names[seat] + ' طلب ' + val);
      } else { st.passed[seat] = true; log(st, st.names[seat] + ' باس'); }
      const active = [0, 1, 2, 3].filter(i => !st.passed[i]);
      if (!st.bid && active.length === 0) { log(st, 'كلهم باس، توزيع جديد'); st.dealer = (st.dealer + 1) % 4; T61.startHand(st); return st; }
      if (st.bid && (active.length === 1 && active[0] === st.bid.seat || st.bid.val === 13)) {
        st.phase = 'trump'; st.turn = st.bid.seat; return st;
      }
      let n = (seat + 1) % 4; while (st.passed[n]) n = (n + 1) % 4; st.turn = n;
      return st;
    },
    chooseTrump(s, seat, suit) {
      const st = clone(s);
      if (st.phase !== 'trump' || st.turn !== seat) err('مش دورك');
      if (!SUITS.includes(suit)) err('شكل غلط');
      st.trump = suit; st.phase = 'play'; st.turn = seat; log(st, 'الطرنيب ' + SN[suit]);
      return st;
    },
    play(s, seat, id) { return playCard(s, seat, id, T61); },
    endHand(st) {
      const B = teamOf(st.bid.seat), O = 1 - B;
      const tt = [st.tricks[0] + st.tricks[2], st.tricks[1] + st.tricks[3]];
      const d = [0, 0]; const notes = [];
      if (tt[B] >= st.bid.val) { d[B] = st.bid.val === 13 ? 26 : tt[B]; notes.push('الفريق الطالب جاب طلبه'); }
      else { d[B] = st.bid.val === 13 ? -16 : -st.bid.val; d[O] = tt[O] === 13 ? 16 : tt[O]; notes.push('الفريق الطالب انكسر'); }
      st.tscores = [st.tscores[0] + d[0], st.tscores[1] + d[1]];
      st.summary = { kind: 'team', rows: [['اللمّات', tt[0], tt[1]], ['نقاط الجولة', d[0], d[1]], ['المجموع', st.tscores[0], st.tscores[1]]], notes: [`الطلب: ${st.bid.val} (${st.names[st.bid.seat]})`, ...notes] };
      st.phase = 'handEnd';
      const [a, b] = st.tscores;
      if ((a >= T61.target || b >= T61.target) && a !== b) { st.phase = 'over'; st.winner = a > b ? 0 : 1; }
    },
    next(s) { const st = clone(s); if (st.phase !== 'handEnd') err('الجولة ما خلصت'); st.dealer = (st.dealer + 1) % 4; T61.startHand(st); return st; },
    bot(st, seat) {
      if (st.phase === 'bid') {
        let best = 0, bs = null;
        for (const s of SUITS) { const e = estTricks(st.hands[seat], s); if (e > best) { best = e; bs = s; } }
        const team = best + 2.6, min = st.bid ? st.bid.val + 1 : 7;
        const partnerBid = st.bid && teamOf(st.bid.seat) === teamOf(seat);
        const cap = Math.min(13, Math.floor(team + (partnerBid ? 0.3 : 0)));
        return T61.bid(st, seat, !partnerBid && cap >= min ? min : (partnerBid && cap >= min + 1 ? min : 0));
      }
      if (st.phase === 'trump') {
        let best = -1, bs = 'S';
        for (const s of SUITS) { const e = estTricks(st.hands[seat], s) + st.hands[seat].filter(c => c[0] === s).length * 0.2; if (e > best) { best = e; bs = s; } }
        return T61.chooseTrump(st, seat, bs);
      }
      if (st.phase === 'play') return T61.play(st, seat, trickPlayBot(st, seat, true));
      return st;
    },
    rules: `<p><b>اللاعبين:</b> أربعة بفريقين، كل اتنين متقابلين شركاء. اللعب عكس عقارب الساعة، وكل لاعب معه 13 ورقة.</p>
<p><b>المزايدة:</b> بتبلّش من يمين الموزّع. كل طلب لازم يكون أعلى من اللي قبله، من 7 لـ 13، واللي بيقول «باس» بيطلع من المزايدة. إذا قالوا كلهم باس بينعاد التوزيع.</p>
<p><b>الطرنيب:</b> اللي ربح المزايدة بيختار الطرنيب وبيلعب أول ورقة.</p>
<p><b>اللعب:</b> لازم تلعب من نفس الشكل إذا معك، وإذا ما معك بتلعب أي ورقة. الأكلة لأعلى ورقة من الشكل اللي انلعب، إلا إذا انلعب طرنيب فبتكون لأعلى طرنيب.</p>
<p><b>الحساب:</b> إذا جاب الفريق طلبه بياخد عدد اللمّات اللي جابها والخصم ما بياخد شي. إذا انكسر بينخصم منه قيمة طلبه، والخصم بياخد لمّاته. طلب 13 وجابها: +26، وانكسر: −16. إذا الفريق الخصم أكل كل الـ13: +16.</p>
<p><b>الفوز:</b> أول فريق بيوصل 61.</p>`
  };

  // ---------- Tarneeb Syrian 41 (individual bids) ----------
  const PAIR = { S: 'C', C: 'S', H: 'D', D: 'H' };
  const T41 = {
    id: 'tarneeb41', name: 'طرنيب 41', sub: 'سوري · كل لاعب بيطلب لحاله', target: 41, teams: true,
    newGame(names, bots) { const st = base('tarneeb41', names, bots); st.dealer = rnd(4); T41.startHand(st); return st; },
    startHand(st) {
      deal(st); st.handNo++;
      const dh = st.hands[st.dealer]; st.reveal = dh[rnd(dh.length)];
      st.trump = PAIR[st.reveal[0]]; st.bids = [null, null, null, null];
      st.phase = 'bid'; st.turn = (st.dealer + 1) % 4;
    },
    actor: st => (['bid', 'play'].includes(st.phase) ? st.turn : -1),
    bid(s, seat, val) {
      const st = clone(s);
      if (st.phase !== 'bid' || st.turn !== seat) err('مش دورك بالطلب');
      if (!(val >= 2 && val <= 13)) err('الطلب من 2 لـ 13');
      st.bids[seat] = val; log(st, st.names[seat] + ' طلب ' + val);
      const next = (seat + 1) % 4;
      if (st.bids.every(b => b != null)) {
        const tot = st.bids.reduce((a, b) => a + b, 0);
        if (tot < 11) { log(st, 'مجموع الطلبات ' + tot + '، توزيع جديد'); T41.startHand(st); return st; }
        st.phase = 'play'; st.turn = (st.dealer + 1) % 4;
      } else st.turn = next;
      return st;
    },
    play(s, seat, id) { return playCard(s, seat, id, T41); },
    endHand(st) {
      const d = [0, 1, 2, 3].map(i => (st.tricks[i] >= st.bids[i] ? st.bids[i] : -st.bids[i]));
      st.scores = st.scores.map((x, i) => x + d[i]);
      st.summary = { kind: 'players', rows: [['الطلب', ...st.bids], ['اللمّات', ...st.tricks], ['نقاط الجولة', ...d], ['المجموع', ...st.scores]], notes: [] };
      st.phase = 'handEnd';
      const qual = [0, 1].filter(t => { const a = st.scores[t], b = st.scores[t + 2]; return (a >= 41 && b > 0) || (b >= 41 && a > 0); });
      if (qual.length) {
        const lead = t => Math.max(st.scores[t], st.scores[t + 2]);
        let w = qual[0];
        if (qual.length === 2) w = lead(0) !== lead(1) ? (lead(0) > lead(1) ? 0 : 1) : (st.scores[0] + st.scores[2] >= st.scores[1] + st.scores[3] ? 0 : 1);
        st.phase = 'over'; st.winner = w;
      }
    },
    next(s) { const st = clone(s); if (st.phase !== 'handEnd') err('الجولة ما خلصت'); st.dealer = (st.dealer + 1) % 4; T41.startHand(st); return st; },
    bot(st, seat) {
      if (st.phase === 'bid') {
        let e = Math.round(estTricks(st.hands[seat], st.trump));
        e = Math.max(2, Math.min(13, e));
        const others = st.bids.filter(b => b != null), sum = others.reduce((a, b) => a + b, 0);
        if (others.length === 3 && sum + e < 11 && e < 4) e = Math.min(13, Math.max(e, 11 - sum));
        return T41.bid(st, seat, e);
      }
      if (st.phase === 'play') return T41.play(st, seat, trickPlayBot(st, seat, st.tricks[seat] < st.bids[seat] || st.tricks[(seat + 2) % 4] < st.bids[(seat + 2) % 4]));
      return st;
    },
    rules: `<p><b>اللاعبين:</b> أربعة بفريقين متقابلين، بس الطلب والحساب لكل لاعب لحاله. اللعب عكس عقارب الساعة، و13 ورقة لكل لاعب.</p>
<p><b>الطرنيب:</b> بتنقلب ورقة من ورق الموزّع، والطرنيب بيكون الشكل التاني من نفس اللون: الكبة بتعطي ديناري والعكس، والبستوني بيعطي سباتي والعكس.</p>
<p><b>الطلب:</b> كل لاعب بيطلب مرة وحدة بس، من 2 لـ 13 لمّة. إذا مجموع الطلبات أقل من 11 بينعاد التوزيع.</p>
<p><b>اللعب:</b> بيبلّش اللي على يمين الموزّع. لازم تلعب من نفس الشكل إذا معك، والطرنيب بيغلب كل الأشكال.</p>
<p><b>الحساب:</b> إذا جبت طلبك أو أكتر بينضاف قيمة طلبك بس. إذا ما جبته بينخصم قيمة طلبك.</p>
<p><b>الفوز:</b> بيربح الفريق لما يوصل واحد منه لـ 41 وشريكه نقاطه فوق الصفر.</p>`
  };

  // ---------- Trix family ----------
  const PEN = ['king', 'queens', 'diamonds', 'ltoosh', 'complex'];
  const CN = { king: 'الشايب', queens: 'البنات', diamonds: 'الديناري', ltoosh: 'اللطوش', complex: 'كومبلكس', trix: 'تركس' };
  const KH = 'H13';
  const isQ = c => cr(c).r === 12;
  function makeTrix(id, name, sub, contracts, partner) {
    const G = {
      id, name, sub, teams: partner, trixFamily: true, contracts,
      newGame(names, bots) {
        const st = base(id, names, bots); st.kingdom = 0; st.used = []; st.owner = null; st.partner = partner;
        G.startHand(st); return st;
      },
      startHand(st) {
        deal(st); st.handNo++; st.trump = null; st.doubled = { K: null, Q: {} }; st.dblPending = {}; st.ladder = { S: null, H: null, C: null, D: null }; st.finished = [];
        if (st.owner == null) st.owner = st.hands.findIndex(h => h.includes('H7'));
        const left = contracts.filter((c, i) => !st.used.includes(i));
        if (new Set(left).size === 1) { G._begin(st, contracts.findIndex((c, i) => !st.used.includes(i))); }
        else { st.phase = 'choose'; st.turn = st.owner; }
      },
      _begin(st, idx) {
        st.cidx = idx; st.contract = contracts[idx];
        if (st.contract === 'trix') { st.phase = 'trix'; st.turn = st.owner; return; }
        const elig = s => G.dblCards(st, s);
        st.dblQueue = [0, 1, 2, 3].map(k => (st.owner + k) % 4).filter(s => elig(s).length);
        if (st.dblQueue.length) { st.phase = 'double'; st.turn = st.dblQueue[0]; }
        else { st.phase = 'play'; st.turn = st.owner; }
      },
      dblCards(st, seat) {
        const c = st.contract, h = st.hands[seat], out = [];
        if ((c === 'king' || c === 'complex') && h.includes(KH)) out.push(KH);
        if (c === 'queens' || c === 'complex') out.push(...h.filter(isQ));
        return out;
      },
      actor: st => (['choose', 'double', 'play', 'trix'].includes(st.phase) ? st.turn : -1),
      choose(s, seat, idx) {
        const st = clone(s);
        if (st.phase !== 'choose' || st.turn !== seat) err('صاحب المملكة هو اللي بيختار');
        if (!(idx >= 0 && idx < contracts.length) || st.used.includes(idx)) err('هالطلب انلعب');
        log(st, st.names[seat] + ' اختار ' + CN[contracts[idx]]);
        G._begin(st, idx); return st;
      },
      double(s, seat, ids) {
        const st = clone(s);
        if (st.phase !== 'double' || st.turn !== seat) err('مش دورك');
        const el = G.dblCards(st, seat); ids = (ids || []).filter(x => el.includes(x));
        st.dblPending[seat] = ids;
        st.dblQueue.shift();
        if (st.dblQueue.length) { st.turn = st.dblQueue[0]; return st; }
        for (const [k, v] of Object.entries(st.dblPending)) for (const c of v) { if (c === KH) st.doubled.K = +k; else st.doubled.Q[c] = +k; }
        const n = (st.doubled.K != null ? 1 : 0) + Object.keys(st.doubled.Q).length;
        if (n) log(st, 'في ' + n + ' ورقة مدبّلة');
        st.dblPending = {}; st.phase = 'play'; st.turn = st.owner;
        return st;
      },
      play(s, seat, id) { return playCard(s, seat, id, G); },
      onTrick(st, w) {
        const c = st.contract, cards = st.trick.map(t => t.card), leader = st.trick[0].seat;
        const has = k => c === k || c === 'complex';
        if (has('ltoosh')) st.hs[w] -= 15;
        if (has('diamonds')) st.hs[w] -= 10 * cards.filter(x => x[0] === 'D').length;
        if (has('queens')) for (const q of cards.filter(isQ)) {
          const d = st.doubled.Q[q];
          if (d == null) st.hs[w] -= 25;
          else { st.hs[w] -= 50; if (d !== w) st.hs[d] += 25; else if (leader !== w) st.hs[leader] += 25; }
        }
        if (has('king') && cards.includes(KH)) {
          const d = st.doubled.K;
          if (d == null) st.hs[w] -= 75;
          else { st.hs[w] -= 150; if (d !== w) st.hs[d] += 75; else if (leader !== w) st.hs[leader] += 75; }
        }
        const all = st.taken.flat();
        if (c === 'king' && all.includes(KH)) return true;
        if (c === 'queens' && all.filter(isQ).length === 4) return true;
        if (c === 'diamonds' && all.filter(x => x[0] === 'D').length === 13) return true;
        return false;
      },
      trixLegal(st, seat) {
        return st.hands[seat].filter(c => {
          const { s, r } = cr(c), L = st.ladder[s];
          if (!L) return r === 11;
          return r === L[0] - 1 || r === L[1] + 1;
        });
      },
      trixPlay(s, seat, id) {
        const st = clone(s);
        if (st.phase !== 'trix' || st.turn !== seat) err('مش دورك');
        const L = G.trixLegal(st, seat);
        if (id == null) { if (L.length) err('معك ورقة بتنلعب، لازم تلعبها'); log(st, st.names[seat] + ' باس'); }
        else {
          if (!L.includes(id)) err('هالورقة ما بتركب هلّق');
          const { s: su, r } = cr(id); st.hands[seat].splice(st.hands[seat].indexOf(id), 1);
          const Ld = st.ladder[su]; st.ladder[su] = !Ld ? [11, 11] : [Math.min(Ld[0], r), Math.max(Ld[1], r)];
          if (!st.hands[seat].length) { st.finished.push(seat); st.hs[seat] += [200, 150, 100, 50][st.finished.length - 1]; log(st, st.names[seat] + ' خلّص ورقه'); }
        }
        if (st.finished.length >= 3) {
          const lastP = [0, 1, 2, 3].find(x => !st.finished.includes(x));
          if (lastP != null) { st.finished.push(lastP); st.hs[lastP] += 50; }
          G.endHand(st); return st;
        }
        let n = (seat + 1) % 4; while (st.finished.includes(n)) n = (n + 1) % 4; st.turn = n;
        return st;
      },
      endHand(st) {
        st.scores = st.scores.map((x, i) => x + st.hs[i]);
        st.used.push(st.cidx);
        const rows = [['نقاط الطلب', ...st.hs], ['المجموع', ...st.scores]];
        st.summary = { kind: 'players', rows, notes: [CN[st.contract] + ' · مملكة ' + st.names[st.owner]], partner };
        st.history.push({ k: st.kingdom, c: st.contract, hs: st.hs.slice() });
        st.phase = 'handEnd';
        if (st.used.length === contracts.length && st.kingdom === 3) {
          st.phase = 'over';
          if (partner) { const t = [st.scores[0] + st.scores[2], st.scores[1] + st.scores[3]]; st.winner = t[0] >= t[1] ? 0 : 1; }
          else { const m = Math.max(...st.scores); st.winnerSeat = st.scores.indexOf(m); }
        }
      },
      next(s) {
        const st = clone(s); if (st.phase !== 'handEnd') err('الجولة ما خلصت');
        if (st.used.length === contracts.length) { st.kingdom++; st.used = []; st.owner = (st.owner + 1) % 4; }
        G.startHand(st); return st;
      },
      bot(st, seat) {
        const h = st.hands[seat];
        if (st.phase === 'choose') {
          const left = contracts.map((c, i) => [c, i]).filter(([c, i]) => !st.used.includes(i));
          const risk = c => {
            const hi = h.filter(x => cr(x).r >= 11).length, hearts = h.filter(x => x[0] === 'H').length;
            if (c === 'trix') return 260 - h.filter(x => [10, 11, 12].includes(cr(x).r)).length * 25 - (contracts.length - st.used.length <= 1 ? 999 : 0);
            if (c === 'king') return h.includes(KH) ? (hearts <= 3 ? 90 : 40) : 25;
            if (c === 'queens') return h.filter(isQ).reduce((a, q) => a + (h.filter(x => x[0] === q[0]).length <= 3 ? 30 : 12), 10);
            if (c === 'diamonds') return 10 + h.filter(x => x[0] === 'D' && cr(x).r >= 10).length * 18;
            if (c === 'ltoosh') return 20 + hi * 12;
            return 60 + hi * 15 + (h.includes(KH) && hearts <= 3 ? 60 : 0);
          };
          left.sort((a, b) => risk(a[0]) - risk(b[0]));
          return G.choose(st, seat, left[0][1]);
        }
        if (st.phase === 'double') {
          const el = G.dblCards(st, seat);
          const pick = el.filter(c => { const n = h.filter(x => x[0] === c[0]).length; return c === KH ? n >= 5 : n >= 5 && !h.includes(c[0] + '14'); });
          return G.double(st, seat, pick);
        }
        if (st.phase === 'trix') {
          const L = G.trixLegal(st, seat);
          if (!L.length) return G.trixPlay(st, seat, null);
          const score = c => {
            const { s, r } = cr(c); const mine = h.filter(x => x[0] === s).map(x => cr(x).r);
            const up = r >= 11 ? mine.filter(x => x > r).length : 0, down = r <= 11 ? mine.filter(x => x < r).length : 0;
            return up + down + (r === 11 ? 0.5 : 0) - (r === 11 && mine.length <= 1 ? 1 : 0);
          };
          return G.trixPlay(st, seat, L.slice().sort((a, b) => score(b) - score(a))[0]);
        }
        if (st.phase === 'play') return G.play(st, seat, penaltyPlay(st, seat));
        return st;
      },
      rules: trixRules(contracts, partner)
    };
    return G;
  }
  function danger(c, contract) {
    const has = k => contract === k || contract === 'complex';
    let d = cr(c).r;
    if (has('king') && c === KH) d += 100;
    if (has('queens') && isQ(c)) d += 40;
    if (has('diamonds') && c[0] === 'D') d += 8;
    return d;
  }
  function penaltyPlay(st, seat) {
    const L = legal(st, seat), c = st.contract, R = x => cr(x).r;
    const fresh = !st.trick.length || st.trickDone;
    if (fresh) {
      const h = st.hands[seat];
      const safe = L.filter(x => !(x === KH) && !(isQ(x) && (c === 'queens' || c === 'complex')));
      const pool = safe.length ? safe : L;
      const avoidH = h.includes(KH) && (c === 'king' || c === 'complex');
      const p2 = avoidH ? pool.filter(x => x[0] !== 'H') : pool;
      const p3 = (c === 'diamonds' || c === 'complex') ? (p2.filter(x => x[0] !== 'D').length ? p2.filter(x => x[0] !== 'D') : p2) : p2;
      return (p3.length ? p3 : pool).slice().sort((a, b) => R(a) - R(b))[0];
    }
    const led = st.trick[0].card[0], follow = L[0][0] === led;
    const curW = winnerOf(st.trick, null), curR = R(st.trick.find(t => t.seat === curW).card);
    if (follow) {
      const under = L.filter(x => R(x) < curR);
      if (under.length) return under.slice().sort((a, b) => danger(b, c) - danger(a, c))[0];
      if (st.trick.length === 3) return L.slice().sort((a, b) => R(b) - R(a))[0];
      return L.slice().sort((a, b) => R(a) - R(b))[0];
    }
    return L.slice().sort((a, b) => danger(b, c) - danger(a, c))[0];
  }
  function trixRules(contracts, partner) {
    const isCC = contracts.every(c => c === 'complex');
    const kinds = contracts.includes('king')
      ? '<p><b>الطلبات بكل مملكة (5):</b> الشايب، البنات، الديناري، اللطوش، والتركس. صاحب المملكة بيختار الترتيب، وكل طلب بينلعب مرة وحدة بالمملكة.</p>'
      : isCC ? '<p><b>الطلبات بكل مملكة:</b> كومبلكس مرتين. ما في تركس بهالنوع.</p>'
        : '<p><b>الطلبات بكل مملكة (2):</b> كومبلكس وتركس، وصاحب المملكة بيختار أيّهم أول.</p>';
    return `<p><b>اللاعبين:</b> أربعة${partner ? '، كل اتنين متقابلين شركاء ونقاطهم بتنجمع' : '، كل واحد لحاله'}. 13 ورقة لكل لاعب، واللعب عكس عقارب الساعة. في 4 ممالك، وأول مملكة لصاحب سبعة الكبة، وبعدها بتنتقل للي عاليمين.</p>
${kinds}
<p><b>اللعب بالأكلات:</b> صاحب المملكة بيلعب أول ورقة، ولازم تلعب من نفس الشكل إذا معك. الأكلة لأعلى ورقة من الشكل اللي انلعب، وما في طرنيب.</p>
<p><b>الحساب:</b> الشايب (شايب الكبة) −75. كل بنت −25. كل ديناري −10. كل لطشة (أكلة) −15. بالكومبلكس كلهم بينحسبوا بنفس اليد.${contracts.includes('king') ? ' بالشايب بتخلص اليد لما ينأكل الشايب، وبالبنات لما ينأكلوا الأربعة، وبالديناري لما ينأكلوا كلهم.' : ''}</p>
<p><b>الدبل:</b> قبل اللعب، اللي معه شايب الكبة أو بنت فيه يدبّلها. المدبّل بيخسّر آكله الضعف (الشايب −150، البنت −50)، وصاحب الدبل بياخد +75 للشايب و+25 للبنت. إذا أكلها صاحبها بنفسه، بياخد المكافأة اللي بلّش الأكلة.</p>
${isCC ? '' : '<p><b>التركس:</b> بتبلّش المجموعات من الشبّ (الولد)، وبتطلع لفوق للآص وبتنزل لتحت للـ2. لازم تلعب إذا معك ورقة بتركب، وإذا ما معك بتقول باس. الأول بيخلّص ورقه +200، التاني +150، التالت +100، الرابع +50.</p>'}
<p><b>الفوز:</b> بعد الأربع ممالك، الأعلى نقاط بيربح${partner ? ' (مجموع الشريكين)' : ''}.</p>`;
  }

  const LIST = [
    T41, T61,
    makeTrix('trixKingdoms', 'تركس ممالك', 'كل واحد لحاله · 5 طلبات', ['king', 'queens', 'diamonds', 'ltoosh', 'trix'], false),
    makeTrix('trixKingdomsP', 'تركس ممالك شراكة', 'فريقين · 5 طلبات', ['king', 'queens', 'diamonds', 'ltoosh', 'trix'], true),
    makeTrix('trixComplex', 'تركس كومبلكس', 'كل واحد لحاله · كومبلكس وتركس', ['complex', 'trix'], false),
    makeTrix('trixComplexP', 'تركس كومبلكس شراكة', 'فريقين · كومبلكس وتركس', ['complex', 'trix'], true),
    makeTrix('complexCC', 'كومبلكس CC شراكة', 'فريقين · كومبلكس بس', ['complex', 'complex'], true)
  ];
  const BY = Object.fromEntries(LIST.map(g => [g.id, g]));
  return { LIST, BY, legal, winnerOf, CN, SN, cr, teamOf, sortIds };
})();
if (typeof module !== 'undefined') module.exports = Games;
