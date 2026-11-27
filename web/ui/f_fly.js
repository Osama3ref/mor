// ---------- card flights: show who drew, took, discarded or melded ----------
function seatEl(s) { return document.querySelector(`[data-seat="${s}"]`) || (s === mySeat() ? document.getElementById('hand') : null); }
function centerOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
function fly(fromEl, toEl, ids, opts = {}) {
  if (!fromEl || !toEl || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const a = centerOf(fromEl), b = centerOf(toEl), dur = opts.dur || 750, n = Math.min(ids.length, 5);
  for (let i = 0; i < n; i++) {
    const w = document.createElement('div');
    w.className = 'flyer';
    w.innerHTML = cardHTML(ids[i]);
    document.body.appendChild(w);
    const off = (i - (n - 1) / 2) * 14;
    const anim = w.animate([
      { transform: `translate(${a.x + off - 23}px,${a.y - 32}px) scale(${opts.s0 || 1}) rotate(${-6 + i * 3}deg)`, opacity: 0.2 },
      { offset: 0.2, opacity: 1 },
      { transform: `translate(${(a.x + b.x) / 2 + off - 23}px,${Math.min(a.y, b.y) - 50}px) scale(1.15) rotate(${4 - i * 2}deg)`, opacity: 1 },
      { transform: `translate(${b.x + off - 23}px,${b.y - 32}px) scale(${opts.s1 || 0.8}) rotate(0deg)`, opacity: opts.keep ? 1 : 0.15 }
    ], { duration: dur, delay: i * 90, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' });
    anim.onfinish = () => w.remove(); setTimeout(() => w.remove(), dur + i * 90 + 200);
  }
  if (opts.label) floatLabel(toEl, opts.label);
}
function floatLabel(el, text) {
  const c = centerOf(el), d = document.createElement('div');
  d.className = 'flabel'; d.textContent = text;
  d.style.left = c.x + 'px'; d.style.top = Math.max(60, c.y - 54) + 'px';
  document.body.appendChild(d); setTimeout(() => d.remove(), 2300);
}
function flyFor(prev, st) {
  if (!prev || !st || prev === st || st.game !== prev.game || st.deal !== prev.deal) return;
  if ((st.game || 'mor') !== 'mor' || st.phase !== 'play' && st.phase !== 'roundEnd') return;
  const me = mySeat(), nm = s => st.names[s];
  // drew from the stock
  if (st.stock.length < prev.stock.length && st.got && st.got.ids.length === 1) {
    const s = st.got.seat;
    fly(document.querySelector('.piles .pile'), seatEl(s), [s === me ? st.got.ids[0] : 'back'], { label: s === me ? '' : nm(s) + ' سحب من السحبة' });
    return;
  }
  // took from the discard pile
  if (st.discard.length < prev.discard.length && st.got) {
    const s = st.got.seat, ids = st.got.ids;
    fly(document.getElementById('disc'), seatEl(s), ids, { dur: 950, label: (s === me ? 'أخذت ' : nm(s) + ' أخذ ') + (ids.length === 1 ? 'ورقة من الأرض' : ids.length + ' أوراق من الأرض') });
    return;
  }
  // new melds or additions
  const cnt = q => q.melds.reduce((n, m) => n + m.cards.length, 0);
  if (cnt(st) > cnt(prev)) {
    const before = new Set(prev.melds.flatMap(m => m.cards)), added = st.melds.flatMap(m => m.cards).filter(c => !before.has(c));
    const s = prev.turn;
    fly(seatEl(s), document.querySelector('.board'), added, { dur: 900, label: s === me ? '' : nm(s) + ' نزّل ' + added.length });
  }
  // discarded a card
  if (st.discard.length === prev.discard.length + 1) {
    const s = prev.turn, last = st.discard[st.discard.length - 1];
    if (s !== me) fly(seatEl(s), document.getElementById('disc'), [last], { dur: 800, s1: 0.75 });
  }
}
