const Games = (() => {
  const SUITS = ['S', 'H', 'C', 'D'];
  const cr = id => ({ s: id[0], r: +id.slice(1) });
  const teamOf = s => s % 2;
  const clone = x => JSON.parse(JSON.stringify(x));
  function err(m) { const e = new Error(m); e.game = true; throw e; }
  function rnd(n) { if (typeof crypto !== 'undefined' && crypto.getRandomValues) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; } return Math.floor(Math.random() * n); }
  function deck() { const d = []; for (const s of SUITS) for (let r = 2; r <= 14; r++) d.push(s + r); for (let i = d.length - 1; i > 0; i--) { const j = rnd(i + 1); [d[i], d[j]] = [d[j], d[i]]; } return d; }
  const HORD = ['H', 'S', 'D', 'C'];
  const sortIds = h => h.slice().sort((a, b) => HORD.indexOf(a[0]) - HORD.indexOf(b[0]) || cr(b).r - cr(a).r);
  const SN = { S: 'بستوني', H: 'كبة', C: 'سباتي', D: 'ديناري' };
  function log(st, m) { st.log.push(m); if (st.log.length > 30) st.log.shift(); }
  function deal(st) {
    const d = deck(); st.hands = [0, 1, 2, 3].map(i => sortIds(d.slice(i * 13, i * 13 + 13)));
    st.trick = []; st.trickDone = false; st.prevTrick = null; st.leads = []; st.voids = [{}, {}, {}, {}]; st.tricks = [0, 0, 0, 0]; st.taken = [[], [], [], []]; st.summary = null; st.hs = [0, 0, 0, 0];
  }
  function base(game, names, bots) {
    return { game, v: 0, names, bots: bots || [false, false, false, false], scores: [0, 0, 0, 0], mistakes: [0, 0, 0, 0], log: [], handNo: 0, history: [] };
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
    if (st.phase !== 'play') err('ليس وقت اللعب');
    if (st.turn !== seat) err('ليس دورك');
    if (!legal(st, seat).includes(id)) err(st.hands[seat].includes(id) ? 'يجب أن تلعب من الشكل نفسه' : 'الورقة ليست معك');
    if (st.trickDone) { st.trick = []; st.trickDone = false; }
    if (!st.trick.length) (st.leads = st.leads || []).push({ seat, s: id[0] });
    if (st.trick.length && id[0] !== st.trick[0].card[0]) { st.voids = st.voids || [{}, {}, {}, {}]; st.voids[seat][st.trick[0].card[0]] = true; }
    st.hands[seat].splice(st.hands[seat].indexOf(id), 1);
    st.trick.push({ seat, card: id });
    st.turn = (seat + 1) % 4;
    if (st.trick.length === 4) {
      const w = winnerOf(st.trick, st.trump);
      st.tricks[w]++; st.taken[w].push(...st.trick.map(t => t.card));
      st.trickDone = true; st.turn = w; st.lastWinner = w; st.prevTrick = { cards: st.trick.slice(), winner: w };
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


  // ---------- stronger trick play (card memory) ----------
  function memory(st, seat) {
    const gone = new Set(st.taken.flat());
    if (!st.trickDone) for (const t of st.trick) gone.add(t.card);
    const mine = new Set(st.hands[seat]);
    const out = s => { const r = []; for (let k = 2; k <= 14; k++) { const c = s + k; if (!gone.has(c) && !mine.has(c) && !(st.trick || []).some(t => t.card === c)) r.push(k); } return r; };
    return { gone, out, voids: st.voids || [{}, {}, {}, {}] };
  }
  const isMaster = (M, c) => { const { s, r } = cr(c); return !M.out(s).some(k => k > r); };
  function tarneebPlay(st, seat) {
    const L = legal(st, seat), trump = st.trump, R = c => cr(c).r, M = memory(st, seat), me = teamOf(seat);
    const low = a => a.slice().sort((x, y) => R(x) - R(y))[0], high = a => a.slice().sort((x, y) => R(y) - R(x))[0];
    const opps = [0, 1, 2, 3].filter(x => teamOf(x) !== me), partner = (seat + 2) % 4;
    const trumpsOut = M.out(trump).length;
    const oppVoid = su => opps.some(o => M.voids[o][su] && !M.voids[o][trump]);
    const fresh = !st.trick.length || st.trickDone;
    const junk = arr => {
      const nonT = arr.filter(c => c[0] !== trump), pool = nonT.length ? nonT : arr;
      const keep = c => (isMaster(M, c) ? 20 : 0) + R(c) + (pool.filter(x => x[0] === c[0]).length <= 1 ? -6 : 0);
      return pool.slice().sort((a, b) => keep(a) - keep(b))[0];
    };
    if (fresh) {
      const myT = L.filter(c => c[0] === trump);
      if (myT.length && trumpsOut > 0 && myT.length >= trumpsOut && isMaster(M, high(myT))) return high(myT);
      const masters = L.filter(c => c[0] !== trump && isMaster(M, c) && !(trumpsOut && oppVoid(c[0])));
      if (masters.length) return high(masters);
      const toPartner = L.filter(c => c[0] !== trump && M.voids[partner][c[0]] && !M.voids[partner][trump] && !oppVoid(c[0]));
      if (toPartner.length) return low(toPartner);
      const side = L.filter(c => c[0] !== trump && !oppVoid(c[0]));
      const bySuit = {}; for (const c of (side.length ? side : L)) (bySuit[c[0]] = bySuit[c[0]] || []).push(c);
      const suits = Object.values(bySuit).sort((a, b) => b.length - a.length);
      const sg = suits.find(a => !(a.some(c => R(c) === 13) && !a.some(c => R(c) === 14) && a.length <= 2)) || suits[0];
      return low(sg);
    }
    const trick = st.trick, curW = winnerOf(trick, trump), curC = trick.find(t => t.seat === curW).card, led = trick[0].card[0];
    const beats = c => winnerOf([...trick, { seat, card: c }], trump) === seat;
    const last = trick.length === 3, second = trick.length === 1;
    const partnerSafe = teamOf(curW) === me && (last || (isMaster(M, curC) && !(curC[0] !== trump && trumpsOut && opps.some(o => trick.every(t => t.seat !== o) && M.voids[o][led]))) || (curC[0] === trump && led !== trump && isMaster(M, curC)));
    if (partnerSafe) return junk(L);
    const win = L.filter(beats);
    if (!win.length) return junk(L);
    if (L[0][0] === led) {
      if (second && !win.some(c => isMaster(M, c))) return low(L);
      const m = win.filter(c => isMaster(M, c));
      if (!last && m.length) return low(m);
      return low(win);
    }
    return low(win);
  }

  // Osama's partnership rules for leading in Complex / King
  function partnerWantsSuit(st, seat) {
    const p = (seat + 2) % 4, leads = (st.leads || []).filter(l => l.seat === p);
    const out = [];
    for (let i = 0; i < leads.length; i++) {
      const s = leads[i].s, later = leads.slice(i + 1);
      if (later.length && !later.some(l => l.s === s)) out.push(s);
      if (leads.filter(l => l.s === s).length >= 2) out.push(s);
    }
    for (const s of Object.keys((st.voids || [])[p] || {})) out.push(s);
    return [...new Set(out)];
  }
  function osamaLead(st, seat, x, M) {
    const c = st.contract, has = k => c === k || c === 'complex', { s, r } = cr(x), h = st.hands[seat];
    const p = (seat + 2) % 4, left = (seat + 3) % 4;
    let v = 0;
    if (has('king') && s === 'H' && !st.taken.flat().includes(KH)) {
      const d = st.doubled ? st.doubled.K : null, holdK = h.includes(KH), holdA = h.includes('H14');
      const pLeads = (st.leads || []).filter(l => l.seat === p);
      if (st.partner && d === p) v -= 80;
      else if (st.partner && d === left && !pLeads.some(l => l.s === 'H')) v -= 60;
      else if (st.partner && pLeads.length && !pLeads.some(l => l.s === 'H')) v -= 40;
      else if (d == null && !holdK && !holdA) v += 18 - Math.abs(r - 7.5) * 3;
    }
    if (st.partner) {
      const want = partnerWantsSuit(st, seat);
      if (want.includes(s) && !M.voids.some((vv, o) => o !== seat && o !== p && vv[s])) v += 22 - r;
      const iDoubled = st.doubled && (st.doubled.K === seat || Object.values(st.doubled.Q || {}).includes(seat));
      if (iDoubled && s !== 'H') { const n = h.filter(y => y[0] === s).length; if (n <= 2) v += 12 - n * 3; }
    }
    return v;
  }

  function penaltyPlayStrong(st, seat) {
    const L = legal(st, seat), c = st.contract, R = x => cr(x).r, M = memory(st, seat), h = st.hands[seat];
    const has = k => c === k || c === 'complex';
    const fresh = !st.trick.length || st.trickDone;
    const othersVoid = su => [0, 1, 2, 3].some(o => o !== seat && M.voids[o][su]);
    if (fresh) {
      const score = x => {
        const { s, r } = cr(x), out = M.out(s), higher = out.filter(k => k > r).length, lower = out.filter(k => k < r).length;
        if (!out.length) return -50;
        let v = higher * 2 - lower * 1.2;
        if (higher === 0) v -= 40;
        if (othersVoid(s)) v -= 15;
        if (has('king') && x === KH) v -= 200;
        if (has('king') && s === 'H' && !h.includes(KH) && out.includes(13) && higher > 0) v += 6;
        if (has('king') && s === 'H' && h.includes(KH)) v -= 25;
        if (has('queens') && r === 12) v -= 60;
        if (has('queens') && out.includes(12) && r < 12) v += 3;
        if (has('queens') && h.includes(s + '12') && r !== 12) v -= 10;
        if (has('diamonds') && s === 'D') v -= 4 + (higher === 0 ? 20 : 0);
        v += osamaLead(st, seat, x, M);
        return v;
      };
      return L.slice().sort((a, b) => score(b) - score(a))[0];
    }
    const led = st.trick[0].card[0], follow = L[0][0] === led;
    const curW = winnerOf(st.trick, null), curR = R(st.trick.find(t => t.seat === curW).card);
    const last = st.trick.length === 3;
    if (follow && Games.sig !== false && c === 'complex' && st.partner && st.trick[0].seat === (seat + 2) % 4 && !(has('king') && L.includes(KH))) {
      const k = (st.leads || []).filter(l => l.seat === st.trick[0].seat && l.s === led).length;
      const safeL = L.filter(x => !(has('queens') && isQ(x)));
      if (k <= 1) { const lowc = (safeL.length ? safeL : L).slice().sort((a, b) => R(a) - R(b))[0]; if (lowc) return lowc; }
      else { const over = (safeL.length ? safeL : L).filter(x => R(x) > curR); if (over.length) return over.slice().sort((a, b) => R(b) - R(a))[0]; }
    }
    if (follow) {
      const under = L.filter(x => R(x) < curR);
      if (under.length) {
        if (st.partner && teamOf(curW) === teamOf(seat)) { const safe = under.filter(x => danger(x, c) < 30); if (safe.length) return safe.slice().sort((a, b) => R(b) - R(a))[0]; }
        return under.slice().sort((a, b) => danger(b, c) - danger(a, c))[0];
      }
      const pen = st.trick.some(t => (has('king') && t.card === KH) || (has('queens') && isQ(t.card)) || (has('diamonds') && t.card[0] === 'D'));
      const outBelow = M.out(led).filter(k => k < Math.min(...L.map(R))).length;
      if (last || pen) return L.slice().sort((a, b) => R(b) - R(a)).find(x => !(has('king') && x === KH) && !(has('queens') && isQ(x))) || L.slice().sort((a, b) => R(b) - R(a))[0];
      return outBelow ? L.slice().sort((a, b) => R(a) - R(b))[0] : L.slice().sort((a, b) => R(b) - R(a))[0];
    }
    const partnerWins = st.partner && teamOf(curW) === teamOf(seat);
    const dumpScore = x => {
      let d = danger(x, c);
      if (partnerWins && d > 30) d = -d;
      const n = h.filter(y => y[0] === x[0]).length;
      if (n === 1) d += 6;
      if (M.out(x[0]).filter(k => k < R(x)).length >= 2) d += 4;
      return d;
    };
    return L.slice().sort((a, b) => dumpScore(b) - dumpScore(a))[0];
  }

  // Sample unknown cards, not the actual opponents' hands. Void suits and exposed
  // card owners are hard constraints. The public hand sizes are the only counts used.
  const BOT_DECK = SUITS.flatMap(s => Array.from({length: 13}, (_, i) => s + (i + 2)));
  const B_RANK = Object.fromEntries(BOT_DECK.map(c => [c, +c.slice(1)]));
  const B_SEATS = [0, 1, 2, 3];
  function scenarioDealer(st, seat, ladderGame, expert = false) {
    const mine = st.hands[seat];
    const visible = new Set(mine), forced = {};
    let played = 0;
    if (ladderGame) {
      for (const s of SUITS) {
        const pair = st.ladder[s]; if (!pair) continue;
        for (let r = pair[0]; r <= pair[1]; r++) { visible.add(s + r); played++; }
      }
    } else {
      for (const pile of st.taken) for (const c of pile) { visible.add(c); played++; }
      if (!st.trickDone) for (const {card} of st.trick) { visible.add(card); played++; }
    }
    if (st.reveal) forced[st.reveal] = st.dealer;
    if (st.partner != null && st.handNo === 1) forced.H7 = st.owner;
    if (st.doubled) {
      if (st.doubled.K != null) forced.H13 = st.doubled.K;
      Object.assign(forced, st.doubled.Q);
    }
    const counts = st.hands.map((h, i) => i === seat ? 0 : h.length);
    const unknown = BOT_DECK.filter(c => !visible.has(c)).map(c => {
      let permitted = B_SEATS.filter(i => counts[i] &&
        (forced[c] == null || forced[c] === i) &&
        (ladderGame ? !(expert && st.ladderNo?.[i]?.includes(c)) : !st.voids?.[i]?.[c[0]]));
      return {c, permitted};
    });
    if (unknown.some(x => x.permitted.length === 0) ||
        unknown.length !== counts.reduce((a,b) => a+b,0) || visible.size !== played + mine.length) return null;
    return () => {
      for (let attempt = 0; attempt < 12; attempt++) {
        const slots = counts.slice(), hands = [[], [], [], []]; hands[seat] = mine.slice();
        const order = unknown.map(x => ({...x, tie: Math.random()}));
        order.sort((a,b) => a.permitted.length - b.permitted.length || a.tie - b.tie);
        let ok = true;
        for (const {c, permitted} of order) {
          const n = permitted.reduce((a,i) => a + slots[i], 0);
          if (!n) { ok = false; break; }
          let r = Math.floor(Math.random() * n);
          for (const i of permitted) if ((r -= slots[i]) < 0) { hands[i].push(c); slots[i]--; break; }
        }
        if (ok) return hands;
      }
      return null;
    };
  }

  function botBetter(a,b,led,trump) {
    return a[0] === b[0] ? B_RANK[a] > B_RANK[b] :
      a[0] === trump || (b[0] !== trump && a[0] === led);
  }
  const botMinBy = (cards, cost) => {
    let best = cards[0], bv = Infinity;
    for (const c of cards) { const v = cost(c); if (v < bv) { bv = v; best = c; } }
    return best;
  };
  function botCandidates(L, fallback, limit, rankScore) {
    if (L.length <= limit) return L;
    const out = new Set([fallback]);
    for (const s of SUITS) {
      const group = L.filter(c => c[0] === s);
      if (group.length) out.add(botMinBy(group, rankScore));
    }
    for (const c of L.slice().sort((a,b) => rankScore(a)-rankScore(b))) {
      if (out.size >= limit) break;
      out.add(c);
    }
    return [...out];
  }
  function botPenalty(st, c) {
    let points = 0;
    const type = st.contract;
    if ((type === 'king' || type === 'complex') && c === 'H13') points += st.doubled?.K != null ? 150 : 75;
    if ((type === 'queens' || type === 'complex') && B_RANK[c] === 12) points += st.doubled?.Q?.[c] != null ? 50 : 25;
    if ((type === 'diamonds' || type === 'complex') && c[0] === 'D') points += 10;
    return points;
  }
  function rolloutTrick(st, actor, move, drawn, penalties, trickCountOnly = false, expert = false) {
    const H = drawn.map(h => h.slice()), T = st.tricks.slice(), P = (st.hs || [0,0,0,0]).slice();
    const bar = {S:0,H:0,C:0,D:0};
    const used = new Set(st.taken.flat());
    function mark(c) {
      used.add(c);
      let k = 14;
      while (k >= 2 && used.has(c[0] + k)) k--;
      bar[c[0]] = k;
    }
    for (const c of used) mark(c);
    for (const s of SUITS) if (!bar[s]) bar[s] = 14;
    const inTrick = st.trickDone ? [] : st.trick.slice();
    const voids = expert ? (st.voids || [{},{},{},{}]).map(v=>({...v})) : null;
    const trump = penalties ? null : st.trump;
    let highest = null, winner = null, led = null, turn = actor, first = true;
    let left = H.reduce((a,h) => a+h.length,0);
    for (const {card, seat} of inTrick) {
      if (!led) led = card[0];
      if (!highest || botBetter(card, highest, led, trump)) { highest = card; winner = seat; }
      mark(card);
    }
    const basePen = st.contract === 'ltoosh' || st.contract === 'complex' ? 15 : 0;
    while (left > 0 && H[turn].length) {
      const h = H[turn], n = inTrick.length, follows = led ? h.filter(c => c[0] === led) : h;
      const L = follows.length ? follows : h;
      const cheap = c => B_RANK[c] + (c[0] === trump ? 18 : 0) + (B_RANK[c] >= bar[c[0]] ? 9 : 0);
      let c;
      if (first && move) { c = move; first = false; }
      else if (L.length === 1) c = L[0];
      else if (!penalties) {
        if (!n) {
          const p = (turn + 2) % 4, need = st.game === 'tarneeb41' && T[turn] >= st.bids[turn] && T[p] < st.bids[p];
          c = botMinBy(L, x => {
            const s = x[0], r = B_RANK[x], highs = r >= bar[s], len = h.filter(y => y[0] === s).length;
            if (need) return r + (s === trump ? 12 : 0) + (highs ? 20 : 0);
            let value=(highs ? -27 : r*0.8) + (s === trump ? 4 : 0) - len*1.8;
            if(expert){
              if(highs && s!==trump) for(const i of [((turn+1)%4),((turn+3)%4)]) if(voids[i][s]&&!voids[i][trump])value+=24;
              if(s===trump&&len>=3&&highs)value-=14;
              if(s!==trump&&len===1&&r<10&&h.some(x=>x[0]===trump))value-=6;
              if(s!==trump&&voids[p][s]&&!voids[p][trump])value-=8-r*0.28;
            }
            return value;
          });
        } else {
          const safePartner = teamOf(winner) === teamOf(turn) && (n === 3 || (B_RANK[highest] >= bar[highest[0]] &&
            !(expert && highest[0]!==trump && !inTrick.some(x=>x.seat===(turn+1)%4) && voids[(turn+1)%4][led] && !voids[(turn+1)%4][trump])));
          const alreadyMade = st.game === 'tarneeb41' && T[turn] >= st.bids[turn] &&
            winner === (turn + 2) % 4 && T[winner] < st.bids[winner];
          const win = L.filter(x => botBetter(x, highest, led, trump));
          c = safePartner || alreadyMade || !win.length ? botMinBy(L, cheap) :
            botMinBy(win, x => B_RANK[x] + (x[0] === trump && led !== trump ? 7 : 0)
              - (n < 3 && B_RANK[x] >= bar[x[0]] ? 7 : 0));
        }
      } else if (!n) {
        c = botMinBy(L, x => B_RANK[x] + (B_RANK[x] >= bar[x[0]] ? 14 : 0) + botPenalty(st,x)*0.38);
      } else {
        const losses = L.filter(x => !botBetter(x, highest, led, null));
        const partnerWinning = st.partner && teamOf(turn) === teamOf(winner);
        const danger = x => botPenalty(st,x)*0.65 + B_RANK[x] + (B_RANK[x] >= bar[x[0]] ? 6 : 0);
        if (losses.length) c = botMinBy(losses, x => -danger(x) + (partnerWinning ? botPenalty(st,x) : 0));
        else c = botMinBy(L, x => n === 3 ? -danger(x) : B_RANK[x] + botPenalty(st,x)*0.4);
      }
      if (!led) led = c[0];
      if (!highest || botBetter(c, highest, led, trump)) { highest = c; winner = turn; }
      if(expert && c[0]!==led)voids[turn][led]=true;
      h.splice(h.indexOf(c), 1); left--; mark(c); inTrick.push({card:c,seat:turn});
      if (inTrick.length < 4) { turn = (turn + 1) % 4; continue; }
      const leader = inTrick[0].seat;
      T[winner]++;
      if (penalties) {
        P[winner] -= basePen;
        for (const {card} of inTrick) {
          const pts = botPenalty(st,card);
          P[winner] -= pts;
          let d = null, reward = 0;
          if (pts && card === 'H13' && (st.contract === 'king' || st.contract === 'complex')) { d = st.doubled?.K; reward=75; }
          if (pts && B_RANK[card] === 12 && (st.contract === 'queens' || st.contract === 'complex')) { d = st.doubled?.Q?.[card]; reward=25; }
          if (d != null && d !== winner) P[d] += reward;
          else if (d != null && leader !== winner) P[leader] += reward;
        }
        if (st.contract === 'king' && used.has('H13')) break;
        if (st.contract === 'queens' && SUITS.every(s => used.has(s+'12'))) break;
        if (st.contract === 'diamonds' && BOT_DECK.every(c => c[0] !== 'D' || used.has(c))) break;
      }
      turn = winner; inTrick.length = 0; led = highest = winner = null;
    }
    if(expert&&!trickCountOnly)return expertTrickValue(st,actor,T,P);
    const team = teamOf(actor), partner = (actor+2)%4;
    if (penalties) {
      return st.partner ? P[actor] + P[partner] - P[(actor+1)%4] - P[(actor+3)%4] :
        P[actor] - 0.30 * Math.max(...P.filter((_,i) => i !== actor));
    }
    const ours = T[actor]+T[partner];
    if (trickCountOnly) return ours;
    if (st.game === 'tarneeb61') return tarneeb61Utility(st,team,ours);
    const d = T.map((t,i) => (t >= st.bids[i] ? 1:-1)*t41val(st,i,st.bids[i]));
    for (const i of B_SEATS) {
      const p=(i+2)%4;
      if (d[i]<0 && st.scores[p]>=30 && st.bids[i]>t41min(st,i) && d[p]>0) d[p]*=-1;
    }
    return d[actor]+d[partner]-d[(actor+1)%4]-d[(actor+3)%4] + (Math.min(T[actor],st.bids[actor])+Math.min(T[partner],st.bids[partner]))*0.65+ours*0.12;
  }
  function rolloutLadder(st, seat, move, drawn) {
    const h = drawn.map(cards => cards.slice()), board = Object.fromEntries(SUITS.map(s => [s, st.ladder[s]?.slice() || null]));
    const done = st.finished.slice(), value = st.hs.slice();
    let turn = seat, idle = 0;
    const legalHere = c => {
      const s = c[0], r=B_RANK[c], b=board[s];
      return b ? r === b[0]-1 || r === b[1]+1 : r===11;
    };
    for (let i = 0; i < 110 && idle < 4 && done.length < 3; i++) {
      const a = h[turn];
      const L = i === 0 ? [move] : a.filter(legalHere);
      if (L.length) {
        const c = botMinBy(L, x => {
          const s=x[0], r=B_RANK[x], d=r>11 ? 1:-1;
          return -a.filter(y => y[0]===s && (r === 11 || (B_RANK[y]-r)*d>0)).length
            - (a.includes(s+(r+d)) ? 2 : 0);
        });
        a.splice(a.indexOf(c),1);
        const s=c[0], r=B_RANK[c], b=board[s];
        board[s]=b?[Math.min(r,b[0]),Math.max(r,b[1])]:[11,11];
        if (!a.length) { value[turn] += [200,150,100,50][done.length]; done.push(turn); }
        idle = 0;
      } else idle++;
      do { turn=(turn+1)%4; } while(done.includes(turn));
    }
    for (const i of B_SEATS) if (!done.includes(i)) value[i]+=50;
    const p = (seat+2)%4;
    return st.partner ? value[seat]+value[p]-value[(seat+1)%4]-value[(seat+3)%4] : value[seat]-0.25*Math.max(...value.filter((_,i)=>i!==seat));
  }
  function solveTarneeb61(st, seat, move, sampled) {
    const H=sampled.map(h=>h.slice()), mine=teamOf(seat), trump=st.trump;
    const current=st.trickDone ? [] : st.trick;
    const prior=st.tricks[seat]+st.tricks[(seat+2)%4];
    const left=H.reduce((a,h)=>a+h.length,0);
    const led=current[0]?.card[0] || move[0];
    let winner=seat, high=move;
    for(const t of current) if(botBetter(t.card,high,led,trump)){high=t.card;winner=t.seat;}
    H[seat].splice(H[seat].indexOf(move),1);
    const search=(turn,n,led,hi,win,left,total,alpha,beta)=>{
      if(!left) return total;
      const h=H[turn], must=!!led&&h.some(c=>c[0]===led), max=teamOf(turn)===mine;
      let best=max?-1:14;
      for(let i=0;i<h.length;i++){
        const c=h[i]; if(must&&c[0]!==led) continue;
        h.splice(i,1);
        const suit=led||c[0], takes=!hi||botBetter(c,hi,suit,trump), w=takes?turn:win, top=takes?c:hi;
        const v=n===3 ? search(w,0,null,null,null,left-1,total+(teamOf(w)===mine?1:0),alpha,beta) :
          search((turn+1)%4,n+1,suit,top,w,left-1,total,alpha,beta);
        h.splice(i,0,c);
        if(max){best=Math.max(best,v);alpha=Math.max(alpha,best);}
        else {best=Math.min(best,v);beta=Math.min(beta,best);}
        if(alpha>=beta) break;
      }
      return best;
    };
    const ours=current.length===3 ?
      search(winner,0,null,null,null,left-1,prior+(teamOf(winner)===mine?1:0),-1,14) :
      search((seat+1)%4,current.length+1,led,high,winner,left-1,prior,-1,14);
    return tarneeb61Utility(st,mine,ours);
  }
  function tarneeb61Utility(st, team, ours) {
    const mine=teamOf(st.bid.seat)===team, total=mine?ours:13-ours, made=total>=st.bid.val;
    const v=made?(st.bid.val===13?26:total):-(st.bid.val===13?16:st.bid.val)-(total===0?16:13-total);
    return (mine?v:-v)+ours*0.42;
  }
  function informedMove(st, seat, fallback, mode, L) {
    if (L.length < 2 || !fallback) return fallback;
    const gen = scenarioDealer(st, seat, mode === 'ladder');
    if (!gen) return fallback;
    const fresh = st.trickDone || !st.trick.length;
    const order = c => {
      if (mode === 'ladder') return 0;
      const n = B_RANK[c];
      if (mode === 'penalty') return fresh ? n + botPenalty(st,c)*0.7 : -n - botPenalty(st,c);
      return fresh ? -n : n;
    };
    if (mode === 'ladder' && (!st.partner || st.hands[seat].length > 5)) return fallback;
    if (mode === 'penalty' && ['king','queens'].includes(st.contract)) return fallback;
    const pool = botCandidates(L,fallback,6,order), totals = pool.map(() => 0);
    let worlds = 0;
    const exact = st.game === 'tarneeb61' && st.hands[seat].length <= 3;
    for (let i = 0; i < (exact ? 24 : mode === 'tarneeb' ? 14 : 12); i++) {
      const hands = gen(); if (!hands) continue;
      for (let j = 0; j < pool.length; j++) {
        totals[j] += mode === 'ladder' ? rolloutLadder(st,seat,pool[j],hands) :
          exact ? solveTarneeb61(st,seat,pool[j],hands) : rolloutTrick(st,seat,pool[j],hands,mode === 'penalty');
      }
      worlds++;
    }
    if (worlds < 3) return fallback;
    const fi = pool.indexOf(fallback);
    let best = fi, bv = totals[fi]/worlds;
    const threshold = mode === 'tarneeb' ? 0.26 : mode === 'ladder' ? 17 : 3;
    for (let i = 0; i < pool.length; i++) {
      const score=totals[i]/worlds - (i === fi ? 0 : threshold);
      if (score>bv) { best=i; bv=score; }
    }
    return pool[best];
  }

  function informedTrump(st, seat, fallback) {
    const gen = scenarioDealer(st,seat,false), hand = st.hands[seat];
    if (!gen) return fallback;
    const options = SUITS.filter(s => s === fallback || hand.filter(c => c[0] === s).length >= 3);
    if (options.length < 2) return fallback;
    const sim = options.map(s => ({...st,trump:s})), scores = options.map(() => 0);
    let count=0;
    for (let n=0;n<24;n++) {
      const hands=gen(); if(!hands) continue;
      count++;
      for(let i=0;i<options.length;i++){
        const tricks=rolloutTrick(sim[i],seat,null,hands,false,true);
        scores[i] += tricks + (tricks>=st.bid.val ? 2 : 0);
      }
    }
    if (count<4) return fallback;
    const i=options.indexOf(fallback);
    const best=botMinBy(options,s=>-scores[options.indexOf(s)]);
    return scores[options.indexOf(best)]-scores[i] > count*0.45 ? best : fallback;
  }


  // A noisy bid is evidence, not proof. Bias worlds gently towards plausible
  // bidders and trump choices without ruling out bluffs or forced bids.
  function expertWorldWeight(st,seat,hands) {
    if (st.tricks.reduce((a,b)=>a+b,0)>6) return 1;
    const t=st.trump;
    if (st.game==='tarneeb61' && st.bid?.seat!==seat && st.bid) {
      const h=hands[st.bid.seat], n=h.filter(c=>c[0]===t).length;
      return Math.max(0.45,Math.min(1.6,0.65+n*0.16+(h.includes(t+'14')?0.14:0)));
    }
    if (st.game==='tarneeb41') {
      let v=1;
      for(const i of B_SEATS) if(i!==seat && st.bids[i]>=4) {
        const winners=estTricks(hands[i],t)+st.tricks[i];
        v*=Math.max(0.35,Math.min(1.2,1.14-0.11*Math.max(0,st.bids[i]-winners)));
      }
      return v;
    }
    return 1;
  }
  function expertTrickValue(st,seat,T,P) {
    const p=(seat+2)%4, l=(seat+1)%4, r=(seat+3)%4, team=teamOf(seat);
    if (st.game==='tarneeb61') return tarneeb61Utility(st,team,T[seat]+T[p]);
    if (st.game==='tarneeb41'){
      const made=T.map((n,i)=>n>=st.bids[i]);
      const d=made.map((ok,i)=>(ok?1:-1)*t41val(st,i,st.bids[i]));
      for(const i of B_SEATS) {
        const mate=(i+2)%4;
        if(!made[i]&&st.scores[mate]>=30&&st.bids[i]>t41min(st,i)&&d[mate]>0)d[mate]*=-1;
      }
      const s=st.scores.map((n,i)=>n+d[i]);
      const reached=(a,b)=>(s[a]>=41&&s[b]>0)||(s[b]>=41&&s[a]>0);
      return d[seat]+d[p]-d[l]-d[r] +
        (reached(seat,p)?55:0)-(reached(l,r)?55:0)+
        (Math.min(T[seat],st.bids[seat])+Math.min(T[p],st.bids[p]))*0.50;
    }
    if(st.partner) return P[seat]+P[p]-P[l]-P[r];
    // Head-to-head score gap, not just absolute points in a four-player hand.
    const scores=P.map((n,i)=>n+st.scores[i]);
    return P[seat]-0.27*Math.max(...scores.filter((_,i)=>i!==seat));
  }
  function expertTrickSolve(st,seat,move,hands,penalty) {
    if(st.game==='tarneeb61') return solveTarneeb61(st,seat,move,hands);
    const h=hands.map(x=>x.slice()), trump=penalty?null:st.trump,
      T=st.tricks.slice(), P=st.hs.slice(), team=teamOf(seat);
    const types=st.contract, perTrick=types==='complex'||types==='ltoosh'?15:0;
    const starts=st.trickDone?[]:st.trick.slice();
    const effects=trick=>{
      const top=trick.reduce((x,t)=>botBetter(t.card,x.card,trick[0].card[0],trump)?t:x);
      const seat=top.seat, diff=[0,0,0,0], lead=trick[0].seat;
      if(penalty){
        diff[seat]-=perTrick;
        for(const {card} of trick){
          diff[seat]-=botPenalty(st,card);
          const king=(types==='king'||types==='complex')&&card==='H13', q=(types==='queens'||types==='complex')&&B_RANK[card]===12;
          const d=king?st.doubled?.K:q?st.doubled?.Q?.[card]:null;
          if(d!=null) diff[d!==seat?d:lead!==seat?lead:seat]+=(d!==seat||lead!==seat)?(king?75:25):0;
        }
      }
      return {seat,diff};
    };
    const individual=penalty&&!st.partner;
    const value=(state,i)=>expertTrickValue(st,i,state.t,state.p);
    const opposite=types==='king'?x=>x==='H13':types==='queens'?x=>B_RANK[x]===12:types==='diamonds'?x=>x[0]==='D':null;
    const played=opposite ? st.taken.flat().filter(opposite).length : 0;
    const goal=types==='king'?1:types==='queens'?4:13;
    const solve=(a,trick,total,terminal,alpha,beta)=>{
      if(total===0 || (opposite && terminal>=goal)) {
        const state={t:T,p:P};
        return individual ? B_SEATS.map(i=>value(state,i)) : value(state,seat);
      }
      const mine=h[a], led=trick[0]?.card[0], must=led&&mine.some(c=>c[0]===led);
      const max=teamOf(a)===team;
      let best=null, bv=max||individual?-Infinity:Infinity;
      for(let i=0;i<mine.length;i++){
        const c=mine[i];if(must&&c[0]!==led)continue;
        mine.splice(i,1);
        const nx=trick.concat({seat:a,card:c});
        let v;
        if(nx.length===4){
          const e=effects(nx);
          T[e.seat]++;for(const j of B_SEATS)P[j]+=e.diff[j];
          v=solve(e.seat,[],total-1,terminal+(opposite?nx.filter(x=>opposite(x.card)).length:0),alpha,beta);
          T[e.seat]--;for(const j of B_SEATS)P[j]-=e.diff[j];
        } else v=solve((a+1)%4,nx,total-1,terminal,alpha,beta);
        mine.splice(i,0,c);
        const x=individual?v[a]:v;
        if((max||individual)?x>bv:x<bv){best=v;bv=x;}
        if(!individual){
          if(max)alpha=Math.max(alpha,bv);
          else beta=Math.min(beta,bv);
          if(alpha>=beta)break;
        }
      }
      return best;
    };
    const remaining=h.reduce((a,b)=>a+b.length,0);
    h[seat].splice(h[seat].indexOf(move),1);
    const chosen=starts.concat({seat,card:move});
    let v;
    if(chosen.length===4){
      const e=effects(chosen);
      T[e.seat]++;for(const j of B_SEATS)P[j]+=e.diff[j];
      v=solve(e.seat,[],remaining-1,played+(opposite?chosen.filter(x=>opposite(x.card)).length:0),-Infinity,Infinity);
    } else v=solve((seat+1)%4,chosen,remaining-1,played,-Infinity,Infinity);
    return individual ? v[seat] : v;
  }
  function expertLadder(st, seat, move, hands, style) {
    const h=hands.map(x=>x.slice()), board=Object.fromEntries(SUITS.map(s=>[s,st.ladder[s]?.slice()||null]));
    const done=st.finished.slice(), value=st.hs.slice();
    let a=seat,idle=0;
    const gates=s=>board[s] ? [board[s][0]-1,board[s][1]+1].filter(n=>n>=2&&n<=14) : [11];
    const legalFor=cards=>cards.filter(c=>gates(c[0]).includes(B_RANK[c]));
    for(let i=0;i<104&&idle<4&&done.length<3;i++){
      const my=h[a], rows=i===0?[move]:legalFor(my);
      if(rows.length){
        const c=botMinBy(rows,x=>{
          const s=x[0],r=B_RANK[x], ld=board[s], dirs=ld ? (r<ld[0]?[-1]:[1]) : [-1,1];
          let cost=0;
          for(const d of dirs){
            const n=r+d;
            if(n<2||n>14) continue;
            const owned=my.includes(s+n), beyond=my.filter(c=>c[0]===s&&(B_RANK[c]-r)*d>0).length;
            if(owned) cost-=3.5+beyond*0.9;
            else {
              const later=st.partner?[(a+1)%4,(a+3)%4]:B_SEATS.filter(x=>x!==a);
              const pressure=later.reduce((v,j)=>v+(h[j].length===1?2.5:h[j].length<=3&&h[j].length?0.9:0),0);
              cost-=beyond*(style===0?1.15:1.65);
              cost+=beyond===0 ? 2.5+pressure : pressure*0.35;
            }
          }
          if(r===11 && !ld)cost+=my.length<5?0.5:1.3;
          return cost;
        });
        my.splice(my.indexOf(c),1);
        const s=c[0],r=B_RANK[c],b=board[s];
        board[s]=b?[Math.min(b[0],r),Math.max(b[1],r)]:[11,11];
        if(!my.length){value[a]+=[200,150,100,50][done.length];done.push(a);}
        idle=0;
      }else idle++;
      do{a=(a+1)%4;}while(done.includes(a));
    }
    for(const i of B_SEATS)if(!done.includes(i))value[i]+=50;
    return st.partner ? value[seat]+value[(seat+2)%4]-value[(seat+1)%4]-value[(seat+3)%4] :
      value[seat]-0.26*Math.max(...value.filter((_,i)=>i!==seat));
  }
  function expertMove(st,seat,normal,mode,L) {
    if(!normal||L.length<2)return normal;
    const ladder=mode==='ladder', pen=mode==='penalty', late=st.hands[seat].length;
    // Single-penalty contracts play differently from Complex. Keep Strong's
    // opening on the contracts where the broader rollouts weren't reliable.
    if(pen && (st.contract==='ltoosh' || (late>3 && (st.contract==='king' || (st.partner&&st.contract==='diamonds'))))) {
      return informedMove(st,seat,normal,mode,L);
    }
    const dealer=scenarioDealer(st,seat,ladder,true);
    if(!dealer)return informedMove(st,seat,normal,mode,L);
    const fresh=st.trickDone||!st.trick.length;
    const order=c=>{
      const n=B_RANK[c];
      if(ladder)return 0;
      if(pen)return fresh?n+botPenalty(st,c)*0.65:-n-botPenalty(st,c);
      return fresh?-n:n;
    };
    const pool=botCandidates(L,normal,8,order), sums=pool.map(()=>0), squares=pool.map(()=>0);
    const exact=!ladder && late<=3;
    const worlds=ladder?30:exact?28:24;
    let total=0, count=0;
    for(let i=0;i<worlds;i++){
      const h=dealer();if(!h)continue;
      const w=expertWorldWeight(st,seat,h);
      const calc=c=>ladder ? expertLadder(st,seat,c,h,i%2) :
        exact ? expertTrickSolve(st,seat,c,h,pen) :
        rolloutTrick(st,seat,c,h,pen,false,true);
      const normalScore=calc(normal);
      for(let j=0;j<pool.length;j++)if(pool[j]!==normal){
        const d=calc(pool[j])-normalScore;
        sums[j]+=d*w;
        squares[j]+=d*d*w;
      }
      total+=w;count++;
    }
    if(count<5) return informedMove(st,seat,normal,mode,L);
    const margin=ladder?(late>6?11:7):pen?2.5:0.24;
    let best=normal,bv=0;
    for(let i=0;i<pool.length;i++){
      if(pool[i]===normal)continue;
      const effect=sums[i]/total, noise=Math.sqrt(Math.max(0,squares[i]/total-effect*effect)/count);
      const v=effect-margin-noise*(ladder?0.6:0.36);
      if(v>bv){best=pool[i];bv=v;}
    }
    return best;
  }

  // ---------- Tarneeb 61 (team bidding) ----------
  const T61 = {
    id: 'tarneeb61', name: 'طرنيب 61', sub: 'فريقين · مزايدة من 7 إلى 13', target: 61, teams: true,
    newGame(names, bots) { const st = base('tarneeb61', names, bots); st.tscores = [0, 0]; st.dealer = rnd(4); T61.startHand(st); return st; },
    startHand(st) {
      deal(st); st.phase = 'bid'; st.bid = null; st.passed = [false, false, false, false]; st.trump = null;
      st.turn = (st.dealer + 1) % 4; st.handNo++;
    },
    actor: st => (['bid', 'trump', 'play'].includes(st.phase) ? st.turn : -1),
    bid(s, seat, val) {
      const st = clone(s);
      if (st.phase !== 'bid' || st.turn !== seat) err('ليس دورك في المزايدة');
      if (val) {
        const min = st.bid ? st.bid.val + 1 : 7;
        if (val < min || val > 13) err('يجب أن تطلب ' + min + ' أو أكثر');
        st.bid = { seat, val }; log(st, st.names[seat] + ' طلب ' + val);
      } else {
        if (!st.bid && st.passed.filter(Boolean).length === 3) err('قال الثلاثة باس: يجب أن تطلب 7 على الأقل');
        st.passed[seat] = true; log(st, st.names[seat] + ' باس');
      }
      const active = [0, 1, 2, 3].filter(i => !st.passed[i]);
      if (!st.bid && active.length === 0) { log(st, 'الجميع قال باس، توزيع جديد'); st.dealer = (st.dealer + 1) % 4; T61.startHand(st); return st; }
      if (st.bid && (active.length === 1 && active[0] === st.bid.seat || st.bid.val === 13)) {
        st.phase = 'trump'; st.turn = st.bid.seat; return st;
      }
      let n = (seat + 1) % 4; while (st.passed[n]) n = (n + 1) % 4; st.turn = n;
      return st;
    },
    chooseTrump(s, seat, suit) {
      const st = clone(s);
      if (st.phase !== 'trump' || st.turn !== seat) err('ليس دورك');
      if (!SUITS.includes(suit)) err('شكل خاطئ');
      st.trump = suit; st.phase = 'play'; st.turn = seat; log(st, 'الطرنيب ' + SN[suit]);
      return st;
    },
    play(s, seat, id) { return playCard(s, seat, id, T61); },
    endHand(st) {
      const B = teamOf(st.bid.seat), O = 1 - B;
      const tt = [st.tricks[0] + st.tricks[2], st.tricks[1] + st.tricks[3]];
      const d = [0, 0]; const notes = [];
      if (tt[B] >= st.bid.val) { d[B] = st.bid.val === 13 ? 26 : tt[B]; notes.push('حقّق الفريق الطالب طلبه'); }
      else { d[B] = st.bid.val === 13 ? -16 : -st.bid.val; d[O] = tt[O] === 13 ? 16 : tt[O]; notes.push('الفريق الطالب انكسر'); st.mistakes[st.bid.seat]++; }
      st.tscores = [st.tscores[0] + d[0], st.tscores[1] + d[1]];
      st.summary = { kind: 'team', rows: [['اللمّات', tt[0], tt[1]], ['نقاط الجولة', d[0], d[1]], ['المجموع', st.tscores[0], st.tscores[1]]], notes: [`الطلب: ${st.bid.val} (${st.names[st.bid.seat]})`, ...notes] };
      st.phase = 'handEnd';
      const [a, b] = st.tscores;
      if ((a >= T61.target || b >= T61.target) && a !== b) { st.phase = 'over'; st.winner = a > b ? 0 : 1; }
    },
    next(s) { const st = clone(s); if (st.phase !== 'handEnd') err('الجولة لم تنتهِ'); st.dealer = (st.dealer + 1) % 4; T61.startHand(st); return st; },
    bot(st, seat, stronger = true) {
      if (st.phase === 'bid') {
        let best = 0, bs = null;
        for (const s of SUITS) { const e = estTricks(st.hands[seat], s); if (e > best) { best = e; bs = s; } }
        const team = best + 2.6, min = st.bid ? st.bid.val + 1 : 7;
        const partnerBid = st.bid && teamOf(st.bid.seat) === teamOf(seat);
        const cap = Math.min(13, Math.floor(team + (partnerBid ? 0.3 : 0)));
        const forced = !st.bid && st.passed.filter(Boolean).length === 3;
        if (forced) return T61.bid(st, seat, 7);
        return T61.bid(st, seat, !partnerBid && cap >= min ? min : (partnerBid && cap >= min + 1 ? min : 0));
      }
      if (st.phase === 'trump') {
        let best = -1, bs = 'S';
        for (const s of SUITS) { const e = estTricks(st.hands[seat], s) + st.hands[seat].filter(c => c[0] === s).length * 0.2; if (e > best) { best = e; bs = s; } }
        return T61.chooseTrump(st, seat, stronger && !Games.easy ? informedTrump(st,seat,bs) : bs);
      }
      if (st.phase === 'play') {
        const normal = Games.easy ? trickPlayBot(st, seat, true) : tarneebPlay(st, seat);
        return T61.play(st, seat, stronger === 'expert' && !Games.easy ? expertMove(st,seat,normal,'tarneeb',legal(st,seat)) : stronger && !Games.easy ? informedMove(st,seat,normal,'tarneeb',legal(st,seat)) : normal);
      }
      return st;
    },
    rules: `<p><b>اللاعبين:</b> أربعة لاعبين في فريقين، وكل متقابلَين شريكان. يسير اللعب عكس عقارب الساعة، ومع كل لاعب 13 ورقة.</p>
<p><b>المزايدة:</b> تبدأ من يمين الموزّع. يجب أن يكون كل طلب أعلى من سابقه، من 7 إلى 13، ومن يقول «باس» يخرج من المزايدة. إذا قال الثلاثة الأوائل باس، لا يستطيع الأخير قول باس ويجب أن يطلب 7 على الأقل.</p>
<p><b>الطرنيب:</b> يختار الفائز بالمزايدة الطرنيب ويلعب أول ورقة.</p>
<p><b>اللعب:</b> يجب أن تلعب من الشكل نفسه إن كان معك، وإلا فالعب أي ورقة. الأكلة لأعلى ورقة من الشكل الملعوب، إلا إذا لُعب طرنيب فتكون لأعلى طرنيب.</p>
<p><b>الحساب:</b> إذا حقّق الفريق طلبه يأخذ عدد اللمّات التي جمعها ولا يأخذ الخصم شيئاً. وإذا انكسر تُخصم منه قيمة طلبه، ويأخذ الخصم لمّاته. طلب 13 وحقّقها: +26، وإذا انكسر: −16. إذا أخذ الفريق الخصم كل الـ13: +16.</p>
<p><b>الفوز:</b> أول فريق يصل إلى 61.</p>`
  };

  // ---------- Tarneeb Syrian 41 (individual bids) ----------
  const PAIR = { S: 'C', C: 'S', H: 'D', D: 'H' };
  const t41min = (st, s) => (st.scores[s] >= 30 ? 3 : 2);
  const t41total = st => (st.scores.some(x => x >= 30) ? 12 : 11);
  const t41val = (st, s, b) => (b >= (st.scores[s] >= 30 ? 7 : 5) ? b * 2 : b);
  const T41 = {
    id: 'tarneeb41', name: 'طرنيب 41', sub: 'سوري · كل لاعب يطلب بمفرده', target: 41, teams: true,
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
      if (st.phase !== 'bid' || st.turn !== seat) err('ليس دورك في الطلب');
      const mn = t41min(st, seat);
      if (!(val >= mn && val <= 13)) err('طلبك من ' + mn + ' لـ 13');
      st.bids[seat] = val; log(st, st.names[seat] + ' طلب ' + val);
      const next = (seat + 1) % 4;
      if (st.bids.every(b => b != null)) {
        const tot = st.bids.reduce((a, b) => a + b, 0);
        if (tot < t41total(st)) { log(st, 'مجموع الطلبات ' + tot + ' أقل من ' + t41total(st) + '، توزيع جديد'); T41.startHand(st); return st; }
        st.phase = 'play'; st.turn = (st.dealer + 1) % 4;
      } else st.turn = next;
      return st;
    },
    play(s, seat, id) { return playCard(s, seat, id, T41); },
    endHand(st) {
      const val = [0, 1, 2, 3].map(i => t41val(st, i, st.bids[i]));
      const made = [0, 1, 2, 3].map(i => st.tricks[i] >= st.bids[i]);
      const d = [0, 1, 2, 3].map(i => (made[i] ? val[i] : -val[i]));
      const notes = [];
      for (let x = 0; x < 4; x++) {
        const p = (x + 2) % 4;
        if (!made[x] && st.scores[p] >= 30 && st.bids[x] > t41min(st, x) && d[p] > 0) { d[p] = -val[p]; notes.push(st.names[p] + ' انكسر مع شريكه ' + st.names[x]); }
      }
      for (let i = 0; i < 4; i++) if (!made[i]) st.mistakes[i]++;
      st.scores = st.scores.map((x, i) => x + d[i]);
      st.summary = { kind: 'players', rows: [['الطلب', ...st.bids], ['اللمّات', ...st.tricks], ['نقاط الجولة', ...d], ['المجموع', ...st.scores]], notes };
      st.phase = 'handEnd';
      const qual = [0, 1].filter(t => { const a = st.scores[t], b = st.scores[t + 2]; return (a >= 41 && b > 0) || (b >= 41 && a > 0); });
      if (qual.length) {
        const lead = t => Math.max(st.scores[t], st.scores[t + 2]);
        let w = qual[0];
        if (qual.length === 2) w = lead(0) !== lead(1) ? (lead(0) > lead(1) ? 0 : 1) : (st.scores[0] + st.scores[2] >= st.scores[1] + st.scores[3] ? 0 : 1);
        st.phase = 'over'; st.winner = w;
      }
    },
    next(s) { const st = clone(s); if (st.phase !== 'handEnd') err('الجولة لم تنتهِ'); st.dealer = (st.dealer + 1) % 4; T41.startHand(st); return st; },
    bot(st, seat, stronger = true) {
      if (st.phase === 'bid') {
        const mn = t41min(st, seat), p = (seat + 2) % 4;
        let e = Math.round(estTricks(st.hands[seat], st.trump) - 0.15);
        if (st.scores[p] >= 30) e = Math.min(e, mn);
        e = Math.max(mn, Math.min(13, e));
        const others = st.bids.filter(b => b != null), sum = others.reduce((a, b) => a + b, 0), need = t41total(st);
        if (others.length === 3 && sum + e < need && need - sum - e <= 2 && st.scores[p] < 30) e = Math.min(13, need - sum);
        return T41.bid(st, seat, e);
      }
      if (st.phase === 'play') {
        const normal = Games.easy ? trickPlayBot(st, seat, true) : tarneebPlay(st, seat);
        return T41.play(st, seat, stronger === 'expert' && !Games.easy ? expertMove(st,seat,normal,'tarneeb',legal(st,seat)) : stronger && !Games.easy ? informedMove(st,seat,normal,'tarneeb',legal(st,seat)) : normal);
      }
      return st;
    },
    rules: `<p><b>اللاعبين:</b> أربعة لاعبين في فريقين متقابلين، لكن الطلب والحساب لكل لاعب بمفرده. يسير اللعب عكس عقارب الساعة، ولكل لاعب 13 ورقة.</p>
<p><b>الطرنيب:</b> تُقلب ورقة من أوراق الموزّع، ويكون الطرنيب الشكلَ الآخر من اللون نفسه: الكبة تعطي الديناري والعكس، والبستوني يعطي السباتي والعكس.</p>
<p><b>الطلب:</b> يطلب كل لاعب مرة واحدة فقط، من 2 إلى 13 لمّة. إذا كان مجموع الطلبات أقل من 11 يُعاد التوزيع. وإذا كان رصيد أحد اللاعبين 30 أو أكثر، يصبح أقل مجموع 12، وأقل طلب له 3.</p>
<p><b>اللعب:</b> يبدأ من على يمين الموزّع. يجب أن تلعب من الشكل نفسه إن كان معك، والطرنيب يغلب كل الأشكال.</p>
<p><b>الحساب:</b> إذا حقّقت طلبك أو أكثر تُضاف قيمة طلبك فقط، وإذا لم تحقّقه تُخصم قيمة طلبك. الطلب من 5 فما فوق يُحسب مضاعفاً (5 = 10، 6 = 12…)، لكن إذا كان رصيدك 30 أو أكثر يبدأ الدبل من 7.</p>
<p><b>انكسار الشريك:</b> إذا كان رصيد شريكك 30 أو أكثر، وطلبتَ أكثر من الحد الأدنى لطلبك وانكسرت، ينكسر شريكك معك بقيمة طلبه حتى لو حقّقه.</p>
<p><b>الفوز:</b> يفوز الفريق عندما يصل أحد لاعبيه إلى 41 وتكون نقاط شريكه فوق الصفر.</p>`
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
        deal(st); st.handNo++; st.trump = null; st.doubled = { K: null, Q: {} }; st.dblPending = {}; st.ladder = { S: null, H: null, C: null, D: null }; st.finished = []; st.ladderNo = [[],[],[],[]];
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
        if (st.phase !== 'choose' || st.turn !== seat) err('صاحب المملكة هو من يختار');
        if (!(idx >= 0 && idx < contracts.length) || st.used.includes(idx)) err('هذا الطلب لُعب');
        log(st, st.names[seat] + ' اختر ' + CN[contracts[idx]]);
        G._begin(st, idx); return st;
      },
      double(s, seat, ids) {
        const st = clone(s);
        if (st.phase !== 'double' || st.turn !== seat) err('ليس دورك');
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
        if (st.phase !== 'trix' || st.turn !== seat) err('ليس دورك');
        const L = G.trixLegal(st, seat);
        if (id == null) {
          if (L.length) err('معك ورقة صالحة، يجب أن تلعبها');
          const gates=SUITS.flatMap(s => st.ladder[s] ? [st.ladder[s][0]-1,st.ladder[s][1]+1].filter(r=>r>=2&&r<=14).map(r=>s+r) : [s+'11']);
          const seen=(st.ladderNo || (st.ladderNo=[[],[],[],[]]))[seat];
          for(const c of gates)if(!seen.includes(c))seen.push(c);
          log(st, st.names[seat] + ' باس');
        }
        else {
          if (!L.includes(id)) err('هذه الورقة لا تصلح الآن');
          const { s: su, r } = cr(id); st.hands[seat].splice(st.hands[seat].indexOf(id), 1);
          const Ld = st.ladder[su]; st.ladder[su] = !Ld ? [11, 11] : [Math.min(Ld[0], r), Math.max(Ld[1], r)];
          if (!st.hands[seat].length) { st.finished.push(seat); st.hs[seat] += [200, 150, 100, 50][st.finished.length - 1]; log(st, st.names[seat] + ' أنهى أوراقه'); }
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
        const st = clone(s); if (st.phase !== 'handEnd') err('الجولة لم تنتهِ');
        if (st.used.length === contracts.length) { st.kingdom++; st.used = []; st.owner = (st.owner + 1) % 4; }
        G.startHand(st); return st;
      },
      bot(st, seat, stronger = true) {
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
          let need = 5;
          if (st.kingdom === 3) {
            const my = st.partner ? st.scores[seat % 2] + st.scores[seat % 2 + 2] : st.scores[seat];
            const opp = st.partner ? st.scores[(seat + 1) % 2] + st.scores[(seat + 1) % 2 + 2] : Math.max(...st.scores.filter((x, i) => i !== seat));
            if (my < opp - 60) need = 3;
          }
          const pick = el.filter(c => h.filter(x => x[0] === c[0]).length >= need);
          return G.double(st, seat, pick);
        }
        if (st.phase === 'trix') {
          const L = G.trixLegal(st, seat);
          if (!L.length) return G.trixPlay(st, seat, null);
          const mineIn = (su, from, dir) => { let n = 0; for (let k = from + dir; k >= 2 && k <= 14; k += dir) if (h.includes(su + k)) n++; return n; };
          const score = c => {
            const { s, r } = cr(c), Ld = st.ladder[s];
            if (r === 11 && !Ld) {
              const up = mineIn(s, 11, 1), dn = mineIn(s, 11, -1);
              return up + dn + (h.includes(s + '12') ? 2 : 0) + (h.includes(s + '10') ? 2 : 0) - (up + dn === 0 ? 3 : 0);
            }
            const dir = r > 11 ? 1 : -1, next = r + dir;
            const own = mineIn(s, r, dir), nextMine = h.includes(s + next) ? 3 : 0;
            const opensOthers = next >= 2 && next <= 14 && !h.includes(s + next) ? 1.5 : 0;
            return own * 1.6 + nextMine - opensOthers + (h.length <= 3 ? 2 : 0);
          };
          const scoreEasy = c => {
            const { s, r } = cr(c); const mine = h.filter(x => x[0] === s).map(x => cr(x).r);
            const up = r >= 11 ? mine.filter(x => x > r).length : 0, down = r <= 11 ? mine.filter(x => x < r).length : 0;
            return up + down + (r === 11 ? 0.5 : 0) - (r === 11 && mine.length <= 1 ? 1 : 0);
          };
          const f = Games.easy ? scoreEasy : score;
          const normal = L.slice().sort((a, b) => f(b) - f(a))[0];
          return G.trixPlay(st, seat, stronger === 'expert' && !Games.easy ? expertMove(st,seat,normal,'ladder',L) : stronger && !Games.easy ? informedMove(st,seat,normal,'ladder',L) : normal);
        }
        if (st.phase === 'play') {
          const normal = Games.easy ? penaltyPlay(st, seat) : penaltyPlayStrong(st, seat);
          return G.play(st,seat,stronger === 'expert' && !Games.easy ? expertMove(st,seat,normal,'penalty',legal(st,seat)) : stronger && !Games.easy ? informedMove(st,seat,normal,'penalty',legal(st,seat)) : normal);
        }
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
      if (under.length) {
        if (st.partner && teamOf(curW) === teamOf(seat)) { const safe = under.filter(x => danger(x, c) < 30); if (safe.length) return safe.slice().sort((a, b) => R(b) - R(a))[0]; }
        return under.slice().sort((a, b) => danger(b, c) - danger(a, c))[0];
      }
      if (st.trick.length === 3) return L.slice().sort((a, b) => R(b) - R(a))[0];
      return L.slice().sort((a, b) => R(a) - R(b))[0];
    }
    return L.slice().sort((a, b) => danger(b, c) - danger(a, c))[0];
  }
  function trixRules(contracts, partner) {
    const isCC = contracts.every(c => c === 'complex');
    const kinds = contracts.includes('king')
      ? '<p><b>الطلبات بكل مملكة (5):</b> الشايب، والبنات، والديناري، واللطوش، والتركس. يختار صاحب المملكة الترتيب، ويُلعب كل طلب مرة واحدة في المملكة.</p>'
      : isCC ? '<p><b>الطلبات بكل مملكة:</b> كومبلكس مرتين. لا يوجد تركس في هذا النوع.</p>'
        : '<p><b>الطلبات بكل مملكة (2):</b> كومبلكس وتركس، ويختار صاحب المملكة أيّهما أولاً.</p>';
    return `<p><b>اللاعبين:</b> أربعة${partner ? '، وكل متقابلَين شريكان وتُجمع نقاطهما' : '، كلٌّ بمفرده'}. 13 ورقة لكل لاعب، ويسير اللعب عكس عقارب الساعة. هناك 4 ممالك، أولها لصاحب سبعة الكبة، ثم تنتقل إلى من على اليمين.</p>
${kinds}
<p><b>اللعب بالأكلات:</b> يلعب صاحب المملكة أول ورقة، ويجب أن تلعب من الشكل نفسه إن كان معك. الأكلة لأعلى ورقة من الشكل الملعوب، ولا يوجد طرنيب.</p>
<p><b>الحساب:</b> الشايب (شايب الكبة) −75. كل بنت −25. كل ديناري −10. كل لطشة (أكلة) −15. في الكومبلكس تُحسب كلها في اليد نفسها.${contracts.includes('king') ? ' في الشايب تنتهي اليد عند أكل الشايب، وفي البنات عند أكل الأربع، وفي الديناري عند أكلها كلها.' : ''}</p>
<p><b>الدبل:</b> قبل اللعب، يمكن لمن معه شايب الكبة أو بنت أن يدبّلها، والمدبّلة تكلّف آكلها الضعف (الشايب −150، البنت −50)، ويأخذ صاحب الدبل +75 للشايب و+25 للبنت. وإذا أكلها صاحبها بنفسه، يأخذ المكافأة من بدأ الأكلة.</p>
${isCC ? '' : '<p><b>التركس:</b> تبدأ المجموعات من الشبّ (الولد)، وتصعد إلى الآص وتنزل إلى الـ2. يجب أن تلعب إن كانت معك ورقة مناسبة، وإلا تقول باس. أول من ينهي أوراقه +200، والثاني +150، والثالث +100، والرابع +50.</p>'}
<p><b>الفوز:</b> بعد الممالك الأربع، يفوز صاحب أعلى النقاط${partner ? ' (مجموع الشريكين)' : ''}.</p>`;
  }

  const LIST = [
    T41, T61,
    makeTrix('trixKingdoms', 'تركس ممالك', 'كلٌّ بمفرده · 5 طلبات', ['king', 'queens', 'diamonds', 'ltoosh', 'trix'], false),
    makeTrix('trixKingdomsP', 'تركس ممالك شراكة', 'فريقين · 5 طلبات', ['king', 'queens', 'diamonds', 'ltoosh', 'trix'], true),
    makeTrix('trixComplex', 'تركس كومبلكس', 'كلٌّ بمفرده · كومبلكس وتركس', ['complex', 'trix'], false),
    makeTrix('trixComplexP', 'تركس كومبلكس شراكة', 'فريقين · كومبلكس وتركس', ['complex', 'trix'], true),
    makeTrix('complexCC', 'كومبلكس CC شراكة', 'فريقين · كومبلكس فقط', ['complex', 'complex'], true)
  ];
  const BY = Object.fromEntries(LIST.map(g => [g.id, g]));
  return { LIST, BY, legal, winnerOf, CN, SN, cr, teamOf, sortIds };
})();
if (typeof module !== 'undefined') module.exports = Games;
