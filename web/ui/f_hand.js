// ---------- hand layout & drag ----------
function layoutHand() {
  const el = document.getElementById('hand'); if (!el) return;
  const cards = [...el.children]; const n = cards.length; if (!n) { el.style.height = '0'; return; }
  const land = matchMedia('(orientation:landscape) and (max-height:560px)').matches;
  const W = el.parentElement.clientWidth - 16;
  let w = land ? 46 : Math.min(64, Math.max(48, W / 7.2));
  const rows = prof.handRows === 2 && !land && n > 7 ? 2 : prof.handRows === 1 ? 1 : (!land && n > 16) ? 2 : 1;
  const perRow = Math.ceil(n / rows);
  let step = Math.min(w * 0.62, (W - w) / Math.max(1, perRow - 1));
  const h = w * 1.42, rowGap = h * 0.55;
  el.style.width = W + 'px'; el.style.height = (h + (rows - 1) * rowGap + 18) + 'px';
  const pos = [];
  cards.forEach((c, i) => {
    const r = Math.floor(i / perRow), k = i % perRow, cnt = Math.min(perRow, n - r * perRow);
    const total = w + step * (cnt - 1), x0 = (W - total) / 2;
    const x = x0 + k * step, y = 16 + r * rowGap;
    c.style.setProperty('--w', w + 'px'); c.style.left = x + 'px'; c.style.top = y + 'px'; c.style.zIndex = i + 1;
    pos.push({ x, y, id: c.dataset.id });
  });
  el._pos = pos; el._w = w; el._step = step;
}
let drag = null;
document.addEventListener('pointerdown', e => {
  const c = e.target.closest('#hand .c'); if (!c || drag || ui.hidden || e.button !== 0) return;
  const el = document.getElementById('hand');
  drag = { pointerId: e.pointerId, id: c.dataset.id, el: c, sx: e.clientX, sy: e.clientY, moved: false, ox: parseFloat(c.style.left), oy: parseFloat(c.style.top), hand: el };
  c.setPointerCapture && c.setPointerCapture(e.pointerId);
});
document.addEventListener('pointermove', e => {
  if (!drag || drag.pointerId !== e.pointerId || !drag.el.isConnected) return;
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  if (!drag.moved && Math.hypot(dx, dy) < 8) return;
  drag.moved = true; drag.el.classList.add('drag');
  drag.el.style.left = drag.ox + dx + 'px';
  drag.el.style.top = drag.oy + dy + 'px';
});
document.addEventListener('pointerup', e => {
  if (!drag || drag.pointerId !== e.pointerId) return;
  const d = drag; drag = null;
  if (!d.el.isConnected || !ui.st || ui.hidden) return;
  const tg = ui.st && gameOf(ui.st).id !== 'mor';
  if (tg) {
    if (d.moved) { if (d.sy - e.clientY > 70) return tryPlay(d.id); return render(); }
    return tapCard(d.id);
  }
  if (!d.moved) { const id = d.id; ui.sel.has(id) ? ui.sel.delete(id) : ui.sel.add(id); return render(); }
  // drop a dragged card (with any other selected cards) onto a meld, the board or the discard pile
  const st = ui.st, me = mySeat(), target = document.elementFromPoint(e.clientX, e.clientY);
  if (target && st.turn === me && st.step === 'play' && st.phase === 'play') {
    const ids = ui.sel.has(d.id) ? [...ui.sel] : [d.id];
    const mEl = target.closest('[data-meld]');
    if (mEl) {
      const m = st.melds.find(x => x.id === mEl.dataset.meld);
      if (m && m.team === Mor.teamOf(me)) {
        ui.sel.clear();
        if (Mor.analyze([...m.cards, ...ids])) return act(Mor.addToMeld, m.id, ids);
        if (ids.length === 1 && Mor.swapOptions(m, ids[0]).length) return act(Mor.swapWild, m.id, ids[0]);
        toast('هذه الورقة لا تصلح لهذه التنزيلة'); return render();
      }
    }
    if (target.closest('#disc') && ids.length === 1) { ui.sel.clear(); return act(Mor.discard, ids[0]); }
    if (target.closest('.board') && ids.length >= 3) { ui.sel.clear(); return act(Mor.meldNew, ids); }
  }
  const order = ui.order[me]; if (!order) return render();
  const x = parseFloat(d.el.style.left) + d.hand._w / 2, y = parseFloat(d.el.style.top);
  let best = 0, bd = Infinity;
  d.hand._pos.forEach((p, i) => { const dd = Math.abs(p.x + d.hand._w / 2 - x) + Math.abs(p.y - y) * 2; if (dd < bd) { bd = dd; best = i; } });
  const from = order.indexOf(d.id); order.splice(from, 1); order.splice(best, 0, d.id);
  render();
});
document.addEventListener('pointercancel', e => { if (drag?.pointerId === e.pointerId) { drag = null; render(); } });

function tryPlay(id) {
  const st = ui.st, G = gameOf(st), me = mySeat();
  if (G.actor(st) !== me || ui.hidden) { ui.armed = null; return render(); }
  if (st.phase === 'play') return act(G.play, id);
  if (st.phase === 'trix') return act(G.trixPlay, id);
  render();
}
function tapCard(id) {
  const st = ui.st, G = gameOf(st), me = mySeat();
  // play in advance: pick a card while others are playing; it is played as soon as your turn comes (if allowed)
  if (prof.prePlay !== false && me >= 0 && G.actor(st) !== me && (st.phase === 'play' || st.phase === 'trix')) { ui.prePlay = ui.prePlay === id ? null : id; SFX.tap(); return render(); }
  if (st.phase === 'double' && G.actor(st) === me && G.dblCards(st, me).includes(id)) { ui.dblSel = ui.dblSel || []; ui.dblSel.includes(id) ? ui.dblSel.splice(ui.dblSel.indexOf(id), 1) : ui.dblSel.push(id); return render(); }
  if (ui.armed === id) return tryPlay(id);
  ui.armed = id; render();
}
function prePlayCheck(st) {
  const id = ui.prePlay; if (!id || !st || st.game === 'mor' || !st.hands) return;
  const G = gameOf(st), me = mySeat();
  if (!st.hands[me] || !st.hands[me].includes(id) || st.phase === 'handEnd' || st.phase === 'over') { ui.prePlay = null; return; }
  if (G.actor(st) !== me) return;
  const legal = st.phase === 'play' ? Games.legal(st, me) : st.phase === 'trix' ? G.trixLegal(st, me) : [];
  ui.prePlay = null;
  if (legal.includes(id)) setTimeout(() => { if (ui.st && gameOf(ui.st).actor(ui.st) === me && !ui.busy) tryPlay(id); }, 450);
  else toast('الورقة التي جهّزتها لا تصلح الآن، اختر ورقة أخرى');
}

// trix: when you have no card that fits the ladder, pass for you automatically
let autoPassKey = null;
function autoPass(st) {
  if (!st || st.phase !== 'trix' || ui.hidden) return;
  const G = gameOf(st), me = mySeat();
  if (me < 0 || G.actor(st) !== me || G.trixLegal(st, me).length) return;
  const key = st.deal + ':' + st.v; if (autoPassKey === key) return; autoPassKey = key;
  setTimeout(() => { if (ui.st && ui.st.v === st.v && gameOf(ui.st).actor(ui.st) === me) { toast('لا تملك ورقة مناسبة: باس تلقائي'); act(G.trixPass ? G.trixPass : G.trixPlay, null); } }, 900);
}
