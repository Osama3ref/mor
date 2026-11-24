// ---------- hand layout & drag ----------
function layoutHand() {
  const el = document.getElementById('hand'); if (!el) return;
  const cards = [...el.children]; const n = cards.length; if (!n) { el.style.height = '0'; return; }
  const land = matchMedia('(orientation:landscape) and (max-height:560px)').matches;
  const W = el.parentElement.clientWidth - 16;
  let w = land ? 46 : Math.min(64, Math.max(48, W / 7.2));
  const rows = (!land && n > 16) ? 2 : 1;
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
  const c = e.target.closest('#hand .c'); if (!c) return;
  const el = document.getElementById('hand');
  drag = { id: c.dataset.id, el: c, sx: e.clientX, sy: e.clientY, moved: false, ox: parseFloat(c.style.left), oy: parseFloat(c.style.top), hand: el };
  c.setPointerCapture && c.setPointerCapture(e.pointerId);
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  if (!drag.moved && Math.hypot(dx, dy) < 8) return;
  drag.moved = true; drag.el.classList.add('drag');
  drag.el.style.left = drag.ox + dx + 'px';
  drag.el.style.top = drag.oy + dy + 'px';
});
document.addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag; drag = null;
  const tg = ui.st && gameOf(ui.st).id !== 'mor';
  if (tg) {
    if (d.moved) { if (d.sy - e.clientY > 70) return tryPlay(d.id); return render(); }
    return tapCard(d.id);
  }
  if (!d.moved) { const id = d.id; ui.sel.has(id) ? ui.sel.delete(id) : ui.sel.add(id); return render(); }
  const me = mySeat(); const order = ui.order[me]; if (!order) return render();
  const x = parseFloat(d.el.style.left) + d.hand._w / 2, y = parseFloat(d.el.style.top);
  let best = 0, bd = Infinity;
  d.hand._pos.forEach((p, i) => { const dd = Math.abs(p.x + d.hand._w / 2 - x) + Math.abs(p.y - y) * 2; if (dd < bd) { bd = dd; best = i; } });
  const from = order.indexOf(d.id); order.splice(from, 1); order.splice(best, 0, d.id);
  render();
});
document.addEventListener('pointercancel', () => { if (drag) { drag = null; render(); } });

function tryPlay(id) {
  const st = ui.st, G = gameOf(st), me = mySeat();
  if (G.actor(st) !== me || ui.hidden) { ui.armed = null; return render(); }
  if (st.phase === 'play') return act(G.play, id);
  if (st.phase === 'trix') return act(G.trixPlay, id);
  render();
}
function tapCard(id) {
  const st = ui.st, G = gameOf(st), me = mySeat();
  if (st.phase === 'double' && G.actor(st) === me && G.dblCards(st, me).includes(id)) { ui.dblSel = ui.dblSel || []; ui.dblSel.includes(id) ? ui.dblSel.splice(ui.dblSel.indexOf(id), 1) : ui.dblSel.push(id); return render(); }
  if (ui.armed === id) return tryPlay(id);
  ui.armed = id; render();
}