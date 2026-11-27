const $app = document.getElementById('app');
const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RK = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const TEAM = ['فريق أ', 'فريق ب'];
const TC = ['var(--a)', 'var(--b)'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sv = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
const ICON = {
  x: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
  back: sv('<path d="M9 5l7 7-7 7"/>'),
  chat: sv('<path d="M4 5h16v11H9l-5 4z"/>'),
  rot: sv('<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M3 12a9 9 0 0 0 4 7M21 12a9 9 0 0 0-4-7"/>'),
  mic: sv('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  micoff: sv('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16"/>'),
  phone: sv('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
  spk: sv('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'),
  spkoff: sv('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  send: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 20l18-8L3 4v6l12 2-12 2z" transform="scale(-1,1) translate(-24,0)"/></svg>',
  home: sv('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  users: sv('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>'),
  msgs: sv('<path d="M4 5h12v9H8l-4 3z"/><path d="M8 17h8l4 3v-9h-2"/>'),
  user: sv('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  plus: sv('<path d="M12 5v14M5 12h14"/>'),
  door: sv('<path d="M4 21h16M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><circle cx="14.5" cy="12" r="1" fill="currentColor"/>'),
  key: sv('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/>'),
  bot: sv('<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M8.5 13v1.5M15.5 13v1.5M9 17.5h6"/><circle cx="12" cy="3.5" r="1"/>'),
  share: sv('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>'),
  copy: sv('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  trophy: sv('<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8"/>'),
  gear: sv('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6A7 7 0 0 0 19 12z"/>'),
  info: sv('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  check: sv('<path d="M5 12l5 5 9-10"/>'),
  invite: sv('<path d="M15 19a6 6 0 0 0-12 0"/><circle cx="9" cy="8" r="4"/><path d="M19 8v6M16 11h6"/>'),
  group: sv('<circle cx="12" cy="7" r="3"/><circle cx="5" cy="10" r="2.3"/><circle cx="19" cy="10" r="2.3"/><path d="M6.5 20a5.5 5.5 0 0 1 11 0M1.5 18a4 4 0 0 1 4-3.5M22.5 18a4 4 0 0 0-4-3.5"/>')
};

let uid = null, ready = false;
const ui = { view: 'home', tab: 'home', mode: null, code: null, room: null, players: [], st: null, sel: new Set(), sheet: null, hidden: false, viewer: 0, busy: false, toast: null,
  order: {}, doneAt: {}, seenCard: new Set(), armed: null, dealtKey: null, chat: [], chatOpen: false, unread: 0, bubbles: {}, confirmExit: false, orient: ls.get('mor-orient') || 'portrait', localCfg: null,
  pop: null, friends: [], chats: [], dm: null, dmMsgs: [] };
let unsub = [];

// ---------- profile ----------
const AVC = ['#c8a24a', '#d8434e', '#2f7fd1', '#2e9d63', '#8a4fd1', '#e07a2e', '#16a3a3', '#c2407f', '#5b6b8c', '#7a5a33'];
const AVG = ['♠', '♥', '♦', '♣', '★', '♛', '☾', '✦', '⚜', '♞'];
const SKINS = [['royal', 'ملكي', '#16224a', '#18704b', '#e2bf68'], ['classic', 'خشب كلاسيك', '#4a2e1a', '#1f7a45', '#e8c07a'], ['night', 'ليلي', '#16181d', '#13454a', '#4fd1c5'], ['vivid', 'زاهي', '#0f4c75', '#22a06b', '#ffc857']];
const CSTY = [['clear', 'واضح'], ['luxe', 'فاخر'], ['classic', 'كلاسيك بالصور'], ['modern', 'عصري'], ['four', 'أربعة ألوان'], ['jumbo', 'أرقام كبيرة']];
const BACKS = [['luxe', 'فاخر أحمر'], ['royal', 'ملكي أزرق'], ['navy', 'كحلي'], ['red', 'أحمر'], ['green', 'أخضر'], ['gold', 'أسود وذهبي']];
const prof = Object.assign({ name: '', av: '0|♠', skin: 'royal', cards: 'clear', back: 'luxe', vol: 0.8, mute: ls.get('mor-sound') === false, lastGame: 'mor' }, ls.get('mor-prof') || {});
if (!prof.name && ls.get('mor-name')) prof.name = ls.get('mor-name');
if (prof.lastGame === 'mafia' || prof.lastGame === 'coup') prof.lastGame = 'mor';
function saveProf() { ls.set('mor-prof', prof); applySkin(); }
function applySkin() { const d = document.documentElement.dataset; d.skin = prof.skin; d.cards = prof.cards; d.back = prof.back; }
applySkin();
const myName = () => (prof.name || '').trim();
function avParts(av, name) {
  if (av === 'bot') return { c: '#5b6378', g: '⚙' };
  const [c, g] = String(av || '').split('|');
  const col = AVC[+c] || AVC[[...(name || 'x')].reduce((x, y) => x + y.charCodeAt(0), 0) % AVC.length];
  return { c: col, g: g === 'A' || !g ? ((name || '?').trim().charAt(0) || '?') : g };
}
const PHOTOS = {};
const pav = p => (p && p.ph ? ((PHOTOS[p.id] = p.ph), 'PH:' + p.id) : p ? p.av : '');
const myAv = () => (prof.photo ? ((PHOTOS.me = prof.photo), 'PH:me') : prof.av);
function seatAv(st, s) {
  const id = st.seats && st.seats[s];
  if (id && PHOTOS[id]) return 'PH:' + id;
  if (ui.mode === 'local' && st.avs && st.avs[s] === prof.av && prof.photo) return myAv();
  return st.avs ? st.avs[s] : (st.bots && st.bots[s] ? 'bot' : '');
}
function avatarHTML(av, name, cls = '', extra = '') {
  if (typeof av === 'string' && av.startsWith('PH:') && PHOTOS[av.slice(3)]) return `<span class="avt ${cls}" style="background:#222"><img src="${PHOTOS[av.slice(3)]}" alt="">${extra}</span>`;
  const p = avParts(av, name);
  return `<span class="avt ${cls}" style="background:radial-gradient(circle at 35% 30%,color-mix(in srgb,${p.c} 70%,#fff),${p.c} 60%,color-mix(in srgb,${p.c} 70%,#000))">${esc(p.g)}${extra}</span>`;
}

const MorG = { id: 'mor', name: 'مور', sub: 'فريقين · 14 ورقة ومورين', teams: true, rules: `<p>14 ورقة لكل لاعب، وموران في كل منهما 11. في دورك: اسحب من السحبة أو خذ من الأرض (ورقة، أو من الأسفل مع كل ما فوقها)، ونزّل إن شئت، ثم ارمِ ورقة. الورقة التي تأخذها وحدها من الأرض لا ترميها إلا إذا كان معك مثلها.<br>
  سيري: 7–9 = 40 (مكسور 20)، 10–11 = 60 (40)، 12 = 80 (60)، 13 = 100 (80). الـ2 من شكل آخر أو الجوكر يكسر.<br>
  متشابهة: 7 = 40 (20)، 8 = 80 (60)، بالجوكر فقط.<br>
  قبل التنزيل يجب أن تعلن «أريد المور» أو «أريد الضمان». إذا أعلنت ولم تستطع: −20.<br>
  المور: تنهي أوراقك ولفريقك 40 على الأرض. مستمر: تكمل به في الدور نفسه. منقطع: ترمي آخر ورقة، فتظهر أوراقه معك وتلعب به في دورك التالي.<br>
  الضمان: 100 على الأرض وتنهي أوراقك. الموران +40 و−40 للخصم، ومور واحد +20. مور منقطع لم يُلعب: −20. انتهت السحبة ومعك الموران: +20. لم يأخذ أحد موراً: تُعاد الجولة. إذا انتهت السحبة، يلعب اللاعب التالي دوراً أخيراً من الأرض فقط.</p>`,
  newGame: (n, b) => Mor.newGame(n, b), actor: st => (st.phase === 'play' ? st.turn : -1), bot: (st, s, stronger) => Mor.botTurn(st, s, stronger), next: st => Mor.nextRound(st) };
const ALL = [MorG, ...Games.LIST];
const MafiaG = { id: 'mafia', name: 'المافيا', sub: '4 لاعبين أو أكثر · أدوار سرّية', icon: '🎭', social: true, actor: () => -1,
  rules: `<p>يأخذ كل لاعب دوراً سرياً: مافيا أو شعب، وإن كانا مفعّلين: طبيب ومحقق.<br>
  <b>ليلاً:</b> تختار المافيا من تقتل، ويختار الطبيب من يحمي (لا يحمي الشخص نفسه ليلتين متتاليتين)، ويسأل المحقق عن لاعب ليعرف إن كان من المافيا أم لا.<br>
  <b>نهاراً:</b> يُعلَن من قُتل، ثم تتناقشون بالصوت أو الدردشة، وبعدها تصوّتون على من يخرج. التعادل لا يُخرج أحداً.<br>
  يفوز الشعب إذا أخرج كل المافيا، وتفوز المافيا إذا أصبح عددها مساوياً لعدد الباقين.<br>
  قد يكون الراوي التطبيقَ أو صاحبَ الغرفة (يرى كل الأدوار ويدير اللعبة دون أن يلعب). ويختار صاحب الغرفة هل يُكشف دور من يخرج أم لا.</p>` };
const CoupG = { id: 'coup', name: 'كو (Coup)', sub: '2–6 لاعبين · كذب وانقلابات', icon: '🃏', social: true, actor: () => -1,
  rules: `<p>مع كل لاعب ورقتا شخصيات مخفيتان (نفوذ) وقطعتان نقديتان. من يخسر ورقتيه يخرج، وآخر من يبقى يفوز.<br>
  <b>في دورك تقوم بحركة واحدة:</b> دخل +1 · مساعدة خارجية +2 (يمنعها الدوق) · انقلاب بـ 7: يخسر لاعب ورقة ولا يستطيع أحد منعه، وإذا كان معك 10 وجب عليك تنفيذه.<br>
  <b>حركات الشخصيات (يمكنك الكذب فيها):</b> 👑 الدوق: ضريبة +3 · 🗡️ القاتل: اغتيال بـ 3 (تمنعه الكونتيسة) · ⚓ القبطان: يسرق 2 من لاعب (يمنعه القبطان أو السفير) · 🕊️ السفير: يأخذ ورقتين من السحبة ويعيد اثنتين.<br>
  <b>الشك:</b> يمكن لأي لاعب التشكيك في ادعاء أو منع. إذا كانت الشخصية معه، يخسر المشكّك ورقة، ويبدّل صاحب الشخصية ورقته بأخرى جديدة. وإذا كان كاذباً يخسر هو ورقة وتفشل الحركة.</p>` };
const ROOMG = [...ALL, MafiaG, CoupG];
const GG = id => ROOMG.find(g => g.id === id) || MorG;
const gameIcon = (g, w = 30) => (g.icon ? `<span class="gemo" style="font-size:${w * 1.3}px">${g.icon}</span>` : fan(GICON[g.id] || GICON.mor, w));
const gameOf = st => GG(st && st.game || 'mor');
const saveKey = id => (id === 'mor' ? 'mor-local' : 'mor-local-' + id);
const savedGame = id => {
  const st = ls.get(saveKey(id));
  return st && st.phase !== 'over' && Array.isArray(st.hands) && st.hands.length === 4 ? st : null;
};
const GICON = { mor: ['H1a', 'S13a', 'J0a'], tarneeb41: ['D14', 'H13', 'S12'], tarneeb61: ['C14', 'S14', 'H11'], trixKingdoms: ['H13', 'S12', 'D11'], trixKingdomsP: ['H13', 'C12', 'H12'], trixComplex: ['H13', 'D12', 'D14'], trixComplexP: ['S12', 'H13', 'C11'], complexCC: ['H12', 'D12', 'H13'] };
window.__mor = { ui, mySeat: () => mySeat(), vc: () => vc, prof, commit: s => commit(s) };

// ---------- cards ----------
const PIPS = {
  2: [[50, 20], [50, 80, 1]], 3: [[50, 20], [50, 50], [50, 80, 1]], 4: [[30, 20], [70, 20], [30, 80, 1], [70, 80, 1]],
  6: [[30, 20], [70, 20], [30, 50], [70, 50], [30, 80, 1], [70, 80, 1]],
  9: [[30, 18], [70, 18], [30, 39], [70, 39], [50, 50], [30, 61, 1], [70, 61, 1], [30, 82, 1], [70, 82, 1]],
  10: [[30, 18], [70, 18], [50, 29], [30, 39], [70, 39], [30, 61, 1], [70, 61, 1], [50, 71, 1], [30, 82, 1], [70, 82, 1]]
};
PIPS[5] = [...PIPS[4], [50, 50]]; PIPS[7] = [...PIPS[6], [50, 35]]; PIPS[8] = [...PIPS[6], [50, 35], [50, 65, 1]];
const COURT = {
  13: '<svg viewBox="0 0 40 30"><path d="M5 25L7 8l8 8 5-12 5 12 8-8 2 17z" fill="#e2bf68" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="20" cy="4" r="2.4" fill="currentColor"/><circle cx="7" cy="7" r="2" fill="currentColor"/><circle cx="33" cy="7" r="2" fill="currentColor"/><rect x="5" y="24" width="30" height="4" rx="1.5" fill="currentColor"/></svg>',
  12: '<svg viewBox="0 0 40 30"><path d="M6 25c2-9 6-14 14-14s12 5 14 14z" fill="#e2bf68" stroke="currentColor" stroke-width="2"/><circle cx="20" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="11" cy="13" r="2" fill="currentColor"/><circle cx="29" cy="13" r="2" fill="currentColor"/><circle cx="20" cy="19" r="2.4" fill="currentColor"/><rect x="5" y="24" width="30" height="4" rx="1.5" fill="currentColor"/></svg>',
  11: '<svg viewBox="0 0 40 30"><path d="M8 25c0-8 5-13 12-13s12 5 12 13z" fill="#e2bf68" stroke="currentColor" stroke-width="2"/><path d="M24 12c2-6 7-9 12-9-2 4-5 7-10 9" fill="currentColor"/><path d="M8 18h24" stroke="currentColor" stroke-width="2"/><rect x="5" y="24" width="30" height="4" rx="1.5" fill="currentColor"/></svg>'
};
function cardHTML(id, extra = '', attrs = '') {
  if (id === 'back') return `<div class="c back ${extra}" ${attrs}></div>`;
  if (Mor.isJ(id)) return `<div class="c jk ${extra}" data-id="${id}" ${attrs} aria-label="جوكر"><span class="ix"><b>JK</b><i>★</i></span><span class="jkc">★</span></div>`;
  const c = Mor.card(id), red = c.s === 'H' || c.s === 'D', r = RK[c.r] || c.r, su = SUIT[c.s];
  let body = `<span class="big">${su}</span>`;
  if (c.r === 1 || c.r === 14) body += `<span class="ace">${su}</span>`;
  else if (c.r >= 11) body += `<span class="court">${COURT[c.r]}<b>${su}</b></span>`;
  else body += `<span class="pips">${(PIPS[c.r] || []).map(([x, y, f]) => `<i class="${f ? 'f' : ''}" style="left:${50 + (x - 50) * 0.74}%;top:${50 + (y - 50) * 0.84}%">${su}</i>`).join('')}</span>`;
  return `<div class="c ${red ? 'r' : ''} s-${c.s} ${extra}" data-id="${id}" ${attrs} aria-label="${r}${su}"><span class="ix"><b>${r}</b><i>${su}</i></span><span class="ix2"><b>${r}</b><i>${su}</i></span>${body}</div>`;
}
const SO = { H: 0, S: 1, D: 2, C: 3 };
// ace high, descending: A K Q J 10 … 3; 2s and jokers (wild in Mor) go to the right end
const hiRank = c => (Mor.isJ(c) ? -2 : Mor.card(c).r === 2 ? -1 : Mor.card(c).r === 1 ? 14 : Mor.card(c).r);
// shown right-to-left from big to small: the largest card sits at the right end of each group
function sortIds(h, byRank) { return sortDesc(h, byRank).reverse(); }
function sortDesc(h, byRank) {
  return h.slice().sort((a, b) => {
    const A = hiRank(a), B = hiRank(b);
    if ((A < 0) !== (B < 0)) return A < 0 ? 1 : -1;
    if (A < 0 && B < 0) return B - A || SO[Mor.card(a).s] - SO[Mor.card(b).s];
    return byRank ? (B - A || SO[Mor.card(a).s] - SO[Mor.card(b).s]) : (SO[Mor.card(a).s] - SO[Mor.card(b).s] || B - A);
  });
}
// by melds: cards that will not be melded (extras and duplicates) on the left, then each planned meld
function sortByMelds(h, team) {
  let plan; try { plan = Mor.planMelds(h, [], team); } catch (e) { return sortIds(h); }
  const groups = plan.acts.filter(a => a.t === 'new').map(a => sortIds(a.ids));
  const used = new Set(groups.flat());
  return [...sortIds(h.filter(c => !used.has(c))), ...groups.flat()];
}
function handOrder(seat, hand) {
  let o = (ui.order[seat] || []).filter(id => hand.includes(id));
  const fresh = hand.filter(id => !o.includes(id));
  if (!o.length) o = sortIds(hand); else o = o.concat(fresh);
  ui.order[seat] = o; return o;
}
function toast(m) { ui.toast = m; render(); clearTimeout(toast.t); toast.t = setTimeout(() => { ui.toast = null; render(); }, 2800); }

// ---------- sounds: synthesized card foley ----------
const snd = { ctx: null, bus: null, nb: null };
function actx() {
  if (!snd.ctx) {
    try { snd.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    const c = snd.ctx, comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    snd.bus = c.createGain(); snd.bus.connect(comp); comp.connect(c.destination);
    const n = c.sampleRate * 1.5; snd.nb = c.createBuffer(1, n, c.sampleRate); const d = snd.nb.getChannelData(0);
    let b0 = 0, b1 = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b0 = 0.97 * b0 + w * 0.15; b1 = 0.6 * b1 + w * 0.4; d[i] = (b0 + b1) * 0.8; }
  }
  if (snd.ctx.state === 'suspended') snd.ctx.resume();
  snd.bus.gain.value = prof.mute ? 0 : prof.vol;
  return snd.ctx;
}
const jit = (v, p) => v * (1 + (Math.random() * 2 - 1) * p);
function burst(t, { dur = 0.06, f = 2500, q = 0.8, type = 'bandpass', gain = 0.6, att = 0.002, f2 = null }) {
  const c = snd.ctx, src = c.createBufferSource(); src.buffer = snd.nb;
  const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(fl); fl.connect(g); g.connect(snd.bus); src.start(t, Math.random()); src.stop(t + dur + 0.02);
}
function thump(t, f = 120, gain = 0.35, dur = 0.08) {
  const c = snd.ctx, o = c.createOscillator(), g = c.createGain();
  o.frequency.setValueAtTime(f * 1.8, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(snd.bus); o.start(t); o.stop(t + dur + 0.02);
}
function bell(t, f, gain = 0.12, dur = 0.9) {
  const c = snd.ctx;
  [[1, 1], [2.76, 0.35], [5.4, 0.12]].forEach(([m, a]) => {
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f * m;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain * a, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur / m);
    o.connect(g); g.connect(snd.bus); o.start(t); o.stop(t + dur);
  });
}
function play(fn) { const c = actx(); if (!c || prof.mute) return; try { fn(c.currentTime + 0.01); } catch (e) {} }
const SFX = {
  // a card laid on felt: soft slap of paper plus a dull table knock
  card: () => play(t => { burst(t, { dur: jit(0.05, 0.2), f: jit(3200, 0.15), q: 0.7, gain: 0.5 }); burst(t + 0.004, { dur: 0.09, f: 900, type: 'lowpass', q: 0.5, gain: 0.45 }); thump(t + 0.002, jit(110, 0.1), 0.25); }),
  // drawing / picking: short paper slide
  draw: () => play(t => { burst(t, { dur: 0.16, f: 1500, f2: 4200, q: 1.2, gain: 0.28, att: 0.03 }); }),
  // dealing: quick riffle of flicks
  deal: () => play(t => { for (let i = 0; i < 10; i++) { const x = t + i * jit(0.055, 0.25); burst(x, { dur: 0.035, f: jit(3600, 0.2), q: 1, gain: 0.32 }); if (i % 3 === 0) thump(x, 140, 0.08, 0.05); } }),
  // gathering a trick: cards sweeping across the cloth
  collect: () => play(t => { burst(t, { dur: 0.34, f: 700, f2: 2400, q: 0.9, gain: 0.22, att: 0.06 }); burst(t + 0.25, { dur: 0.06, f: 2600, gain: 0.25 }); thump(t + 0.27, 100, 0.12); }),
  turn: () => play(t => { bell(t, 880, 0.07, 0.6); bell(t + 0.11, 1318, 0.05, 0.6); }),
  win: () => play(t => { [523, 659, 784, 1047, 1318].forEach((f, i) => bell(t + i * 0.12, f, 0.09, 1.2)); }),
  bad: () => play(t => { bell(t, 392, 0.08, 0.5); bell(t + 0.15, 330, 0.08, 0.7); }),
  tap: () => play(t => { burst(t, { dur: 0.02, f: 4200, q: 2, gain: 0.18 }); })
};
function soundsFor(prev, st, me) {
  if (!prev || !st || prev === st) return;
  const G = gameOf(st);
  if (st.game === 'coup') {
    if (st.phase === 'over' && prev.phase !== 'over') return SFX.win();
    const dead = q => q.players.reduce((n, p) => n + p.cards.filter(c => c.dead).length, 0);
    if (dead(st) > dead(prev)) return SFX.bad();
    const coins = q => q.players.reduce((n, p) => n + p.coins, 0);
    if (coins(st) !== coins(prev)) return play(t => { [0, 0.07, 0.13].forEach(d => bell(t + d, 1900 + Math.random() * 400, 0.05, 0.25)); });
    if (st.phase !== prev.phase && st.phase === 'turn' && Coup.cur(st).id === uid) return SFX.turn();
    if (st.phase !== prev.phase) SFX.tap();
    return;
  }
  if (st.game === 'mafia') {
    try { mafiaNarrate(prev, st); } catch (e) {}
    if (st.phase !== prev.phase) {
      if (st.phase === 'over') return SFX.win();
      const ev = st.events[st.events.length - 1], pe = prev.events.length;
      if (st.events.length > pe && ev && (ev.victim || ev.out)) return SFX.bad();
      if (st.phase === 'night') return play(t => { bell(t, 220, 0.1, 1.4); bell(t + 0.3, 165, 0.08, 1.6); });
      if (st.phase === 'day' || st.phase === 'vote') return SFX.turn();
    } else if (JSON.stringify(st.votes) !== JSON.stringify(prev.votes)) SFX.tap();
    return;
  }
  if ((st.handNo || st.round) !== (prev.handNo || prev.round) || st.deal !== prev.deal) return SFX.deal();
  if (st.phase === 'over' && prev.phase !== 'over') return SFX.win();
  if (G.id === 'mor') {
    if (st.discard.length !== prev.discard.length || st.melds.length !== prev.melds.length || JSON.stringify(st.melds) !== JSON.stringify(prev.melds)) SFX.card();
    else if (st.stock.length < prev.stock.length) SFX.draw();
  } else {
    const n = t => (t.trick || []).length + (t.trickDone ? 10 : 0);
    if (n(st) !== n(prev) || (st.ladder && JSON.stringify(st.ladder) !== JSON.stringify(prev.ladder))) SFX.card();
    if (st.trickDone && !prev.trickDone) setTimeout(SFX.collect, 760);
  }
  if (me >= 0 && G.actor(st) === me && G.actor(prev) !== me) setTimeout(SFX.turn, 160);
}
document.addEventListener('pointerdown', () => actx(), { once: true });
