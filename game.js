const $ = s => document.querySelector(s);
const CFG = window.GAME_CONFIG || {};
const BOOK_ID = CFG.bookId || window.BOOK_ID || 'g3a';
const BOOK = window.BOOKS.find(b => b.id === BOOK_ID);
const UNIT_ID = CFG.unitId !== undefined ? CFG.unitId : (window.UNIT_ID || null);
const UNIT = UNIT_ID ? BOOK.units.find(u => 'u' + u.no === UNIT_ID) : null;
const NEXT_URL = CFG.nextUrl || null;
const HOME_HASH = CFG.homeHash || null;
if (UNIT) document.title = '单词保卫战 · ' + BOOK.name + ' Unit ' + UNIT.no + ' ' + UNIT.en;
else if (BOOK) document.title = '单词保卫战 · ' + BOOK.name;
BOOK.units.forEach(u => u.words.forEach(w => { w.id = w.id || w.w; w.group = w.same || w.id; }));

/* ---------- 认读页家谱图例（uncle / aunt / cousin） ---------- */
const KIN = new Set(['uncle', 'aunt', 'cousin']);
const LEGEND = {
  gold: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#ffe082" stroke="#ffa000" stroke-width="2.6"/></svg>',
  me: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#fff" stroke="#e53935" stroke-width="2.2" stroke-dasharray="3.5 2.5"/></svg>'
};

/* ---------- 可调参数 ---------- */
const LANES = 4, COLS = 8, COL0 = 7, CW = 8.8;      // 4 行 × 8 格土，格子从 7% 开始，每格 8.8% 宽
const END_X = 4;                                    // 僵尸走到这里算冲到底
const HP = 10, DMG_OK = 6;                          // 对上 2 枪倒；对不上打不动（0 伤害）
const RAGE_TIME = 2, RAGE_SPEED = 1.8;              // 被错的豆子打中：僵尸加速 1.8 倍冲 2 秒
const WILT_AFTER = 2;                               // 种错的射手打错 2 次就枯萎，格子空出来
                                                    // 立过功（打中过自己的词）的射手：只打自己的词，不累计打错、不枯萎，别的词僵尸绕过它
const CART_X = 4;                                   // 小车停放位置（%宽），车身完整显示
const HINT_MAX = 3, HINT_IDLE = 6, HINT_WRONG = 2;  // 提示：每局最多 3 次；6 秒没种对 或 连错 2 次 就提示
const RANGE = CW * 4;                               // 射程：4 格
const CARD_EXTRA = [6, 4, 3, 2];                    // 卡片走到左端后还能留几秒（按波数，越来越快）
const FIRE_CD = 1.5, PEA_SPEED = 55;                // 射速（秒/发）、豆子速度（%宽/秒）
const EAT_TIME = 3;                                 // 僵尸啃掉对的射手要几秒
const WRONG_EAT = .5;                               // 错的射手挡不住僵尸，半秒就踩扁
const SPEEDS = [
  { name: '🐢 慢慢来', cross: 70, gap: 11, card: 3.4, belt: 16 },
  { name: '🐇 正常', cross: 52, gap: 8.5, card: 3.0, belt: 13 },
  { name: '🚀 挑战', cross: 38, gap: 6.5, card: 2.6, belt: 10 }
];
const WAVES = [3, 5, 7, 9];
const SKINS = ['#9ccc65', '#aed581', '#8bc34a', '#a5c78a', '#b2c99a'];
const CLOTHES = ['#5d7fa3', '#7b6a58', '#6d5f8d', '#4f7a6a', '#8a5a4a'];
const SAVE_KEY = 'word-defense-v3';
let save = { speed: 0, best: {} };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) {}
if (!save.best || typeof save.best !== 'object') save.best = {};
const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
const bestKey = id => BOOK_ID + '_' + id;
const getBest = id => save.best[bestKey(id)] || (BOOK_ID === 'g3a' ? (save.best[id] || 0) : 0);

function picHTML(pic) {
  if (pic.startsWith('color:')) return `<span class="paint" style="--c:${pic.slice(6)}"></span>`;
  if (pic.startsWith('num:')) { const n = +pic.slice(4); return `<span class="num"><b>${n}</b><i>${'<s></s>'.repeat(n)}</i></span>`; }
  return `<span class="emo">${pic}</span>`;
}

/* ---------- 声音 ---------- */
const audioCache = {};
const keyOf = word => 'w-' + word.toLowerCase().replace(/[^a-z0-9]+/g, '_');
let playing = null, lastSay = 0;
function playFile(key, text) {
  if (playing) { try { playing.pause(); } catch (e) {} }
  lastSay = performance.now();
  if (window.WT_AUDIO && window.WT_AUDIO[key]) {
    let a = audioCache[key]; if (!a) a = audioCache[key] = new Audio('audio/' + key + '.mp3');
    try { a.currentTime = 0; } catch (e) {}
    playing = a; a.play().catch(() => speak(text));
  } else speak(text);
}
/* 没有 mp3 的词用浏览器朗读兜底，优先选英语音色 */
let enVoice = null;
function pickVoice() { try { const vs = speechSynthesis.getVoices(); enVoice = vs.find(v => /^en[-_]US/i.test(v.lang) && v.localService) || vs.find(v => /^en[-_]US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null; } catch (e) {} }
try { pickVoice(); speechSynthesis.addEventListener('voiceschanged', pickVoice); } catch (e) {}
function speak(text) { try { const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = .85; if (enVoice) u.voice = enVoice; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {} }
const sayWord = w => playFile(keyOf(w.w), w.w);
const sayPhrase = k => playFile('p-' + k, window.PHRASES[k]);
function preload(words) { words.forEach(w => { const k = keyOf(w.w); if (!audioCache[k] && window.WT_AUDIO && window.WT_AUDIO[k]) { const a = new Audio('audio/' + k + '.mp3'); a.preload = 'auto'; audioCache[k] = a; } }); }

let ac = null;
function tone(f1, f2, dur, type = 'sine', vol = .18, delay = 0) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur);
  } catch (e) {}
}
const sfx = {
  shoot: () => tone(380, 900, .08, 'triangle', .06),
  okhit: () => { tone(880, 1320, .1, 'sine', .16); tone(1320, 1760, .12, 'sine', .12, .07); },
  badhit: () => tone(180, 140, .09, 'square', .06),
  kill: () => { tone(700, 200, .25, 'square', .07); },
  plant: () => { tone(200, 420, .12, 'triangle', .14); },
  pick: () => tone(660, 880, .06, 'sine', .08),
  eat: () => tone(150, 90, .1, 'square', .08),
  cart: () => { tone(120, 240, .8, 'sawtooth', .07); },
  wave: () => [523, 659, 784].forEach((f, i) => tone(f, f, .18, 'triangle', .15, i * .12)),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f * 1.01, .25, 'triangle', .16, i * .14)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, f * .98, .3, 'triangle', .14, i * .2))
};

/* ---------- 选关页 ---------- */
function renderHome() {
  $('#speed').innerHTML = SPEEDS.map((s, i) => `<button data-s="${i}" class="${save.speed === i ? 'on' : ''}">${s.name}</button>`).join('');
  let lv = BOOK.units.map(u => ({ id: 'u' + u.no, no: u.no, en: u.en, zh: u.zh, words: u.words }));
  if (UNIT) lv = lv.filter(l => l.id === UNIT_ID);
  else lv.push({ id: 'all', no: '★', en: 'All units', zh: '全册大混战', words: BOOK.units.flatMap(u => u.words) });
  document.body.classList.toggle('single', !!UNIT);
  $('#levels').innerHTML = lv.map(l => {
    const b = getBest(l.id);
    const battle = l.words.filter(w => !w.learnOnly), extra = l.words.length - battle.length;
    const uniq = [...new Map(battle.map(w => [w.group, w])).values()];
    const pics = UNIT ? uniq.map(w => `<span>${wordPic(w, 2)}</span>`).join('')
      : uniq.slice(0, 9).map(w => wordZh(w, 2)).join('');
    return `<div class="lv"><div class="top"><div class="no ${l.id === 'all' ? 'all' : ''}">${l.no}</div>
      <div class="nm">${l.id === 'all' ? '' : 'Unit ' + l.no + ' '}${l.en}<small>${l.zh} · ${battle.length} 个词${extra ? ' + ' + extra + ' 个认读词' : ''}</small></div>
      <div class="stars emo">${'⭐'.repeat(b)}${'<span style="opacity:.25">⭐</span>'.repeat(3 - b)}</div></div>
      <div class="pics emo">${pics}</div>
      <div class="btns"><button class="b-learn" data-learn="${l.id}">👂 先认一认</button><button class="b-play" data-play="${l.id}">▶ 开始守卫</button></div></div>`;
  }).join('');
  window._levels = lv;
  const sw = $('#switch');
  if (sw) {
    sw.style.display = UNIT ? '' : 'none';
    const a = sw.querySelector('a');
    if (a && HOME_HASH) a.href = 'index.html#' + HOME_HASH;
  }
}
$('#speed').onclick = e => { const b = e.target.closest('button'); if (!b) return; save.speed = +b.dataset.s; store(); renderHome(); };
$('#levels').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  const l = window._levels.find(x => x.id === (b.dataset.learn || b.dataset.play));
  if (b.dataset.learn) showLearn(l); else startGame(l);
};
function showLearn(l, advancing = false) {
  preload(l.words);
  const tile = (w, i) => `<button class="tile" data-i="${i}"><span class="p">${wordPic(w)}</span><b>${w.w}</b><small>${w.zh}</small>${w.learnOnly ? '<span class="tag">认读</span>' : ''}</button>`;
  const idx = l.words.map((w, i) => i), kin = idx.filter(i => KIN.has(l.words[i].w)), rest = idx.filter(i => !KIN.has(l.words[i].w));
  modal(`<h2>${advancing ? '下一关 · 先认一认' : '先认一认'}</h2><p class="sub">看单词、看中文、点一下听读音${l.words.some(w => w.learnOnly) ? '（灰标的词只认读，不上战场）' : ''}</p>
    <div class="tiles">${rest.map(i => tile(l.words[i], i)).join('')}</div>
    ${kin.length ? `<div class="kin"><h3>看家谱认亲戚</h3>
      <div class="legend"><span>${LEGEND.gold}金圈 = 这个词</span><span>${LEGEND.me}红虚线圈 = 我</span></div>
      <div class="tiles">${kin.map(i => tile(l.words[i], i)).join('')}</div></div>` : ''}
    <div class="row"><button class="b-sub" data-x>返回</button><button class="b-main" data-go>${advancing ? '跳过，直接开始' : '▶ 开始守卫'}</button></div>`);
  $('#mbox').onclick = e => {
    const t = e.target.closest('[data-i]'); if (t) {
      if (advancing) $('#mbox').querySelector('[data-go]').textContent = '▶ 开始守卫';
      return sayWord(l.words[+t.dataset.i]);
    }
    if (e.target.closest('[data-x]')) closeModal();
    if (e.target.closest('[data-go]')) { closeModal(); startGame(l); }
  };
}
function modal(html) { $('#mbox').innerHTML = html; $('#modal').classList.remove('hide'); }
function closeModal() { $('#modal').classList.add('hide'); $('#mbox').onclick = null; }

/* ---------- 游戏 ---------- */
var G = null;
const field = $('#field'), belt = $('#belt');
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const colX = c => COL0 + CW * (c + .5);

function startGame(level) {
  closeModal(); cancelPick();
  const sp = SPEEDS[save.speed];
  G = {
    level, sp, words: level.words.filter(w => !w.learnOnly),
    wave: 0, spawned: 0, killed: 0, total: WAVES.reduce((a, b) => a + b, 0),
    mons: [], plants: [], peas: [], cards: [], carts: [],
    grid: [...Array(LANES)].map(() => Array(COLS).fill(null)),
    t: 0, last: 0, paused: false, over: false, bag: [], lastLane: -1,
    spawnAt: 5, cardAt: .2, sinceNeed: 0, shovel: false,
    hints: 0, idle: 0, wrongStreak: 0, hintWant: null, forceWord: null
  };
  preload(G.words);
  $('#home').classList.add('hide'); $('#game').classList.remove('hide'); $('#game').classList.remove('paused');
  field.querySelectorAll('.lane,.mon,.pea,.fx,.cart,.tur').forEach(n => n.remove());
  belt.innerHTML = '';
  for (let i = 0; i < LANES; i++) {
    const d = document.createElement('div'); d.className = 'lane'; d.dataset.l = i;
    d.innerHTML = `<div class="house"></div><div class="soil" style="left:${COL0}%;width:${CW * COLS}%"></div>` + [...Array(COLS)].map((_, c) => `<div class="cell" data-c="${c}"></div>`).join('');
    field.insertBefore(d, $('#banner'));
    const cart = document.createElement('div'); cart.className = 'cart ready';
    cart.innerHTML = '<div class="bx"></div><div class="wh a"></div><div class="wh b"></div>';
    field.appendChild(cart);
    G.carts.push({ lane: i, x: CART_X, state: 'ready', delay: 0, el: cart });
  }
  setShovel(false);
  requestAnimationFrame(() => { layout(); updateBar(); });
  banner('僵尸要来了！', 1600); sfx.wave();
  setTimeout(() => sayPhrase('go'), 300);
  G.last = performance.now(); requestAnimationFrame(loop);
}

function layout() {
  if (!G) return;
  const H = field.clientHeight, W = field.clientWidth, lh = H / LANES;
  Object.assign(G, { W, H, lh, size: Math.min(lh * 1.15, W * .13), bw: belt.clientWidth, bh: belt.clientHeight });
  G.cw = G.bh * .82;
  field.querySelectorAll('.lane').forEach((d, i) => {
    d.style.top = (i * lh) + 'px'; d.style.height = lh + 'px';
    d.querySelectorAll('.cell').forEach((c, k) => { c.style.left = (COL0 + CW * k + .18) + '%'; c.style.width = (CW - .36) + '%'; });
  });
  G.ts = Math.min(lh * .49, W * .075);
  G.bs = Math.min(Math.max(18, G.ts * .45), lh * .24, W * CW / 100 * .65);
  G.plants.forEach(p => { sizeTur(p.el); p.el.style.top = ((p.lane + .59) * lh) + 'px'; });
  G.carts.forEach(placeCart);
  G.mons.forEach(placeMon);
  G.cards.forEach(c => { c.el.style.width = G.cw + 'px'; c.el.style.height = G.cw + 'px'; c.el.querySelector('.p').style.fontSize = (G.cw * .62) + 'px'; });
}
window.addEventListener('resize', layout);
function placeCart(c) { c.el.style.fontSize = Math.min(G.lh * .5, G.W * .05) + 'px'; c.el.style.left = (c.x / 100 * G.W) + 'px'; c.el.style.top = ((c.lane + .5) * G.lh) + 'px'; }
const turHTML = w => `<div class="badge">${wordPic(w, 2)}</div><div class="hd"></div><div class="st"></div><div class="lf a"></div><div class="lf b"></div>`;
function sizeTur(el) { el.style.fontSize = G.ts + 'px'; el.style.setProperty('--bs', G.bs + 'px'); }

/* ---------- 传送带 ---------- */
function neededWords() {
  return alive().sort((a, b) => a.x - b.x).filter(m =>
    !G.plants.some(p => p.lane === m.lane && p.word.group === m.word.group && p.x < m.x) &&
    !G.cards.some(c => c.word.group === m.word.group)).map(m => m.word);
}
function makeCard() {
  const need = neededWords();
  let w;
  const fw = G.forceWord; G.forceWord = null;
  if (fw && !G.cards.some(c => c.word.group === fw.group)) { w = fw; G.sinceNeed = 0; }
  else if (need.length && (G.sinceNeed >= 2 || Math.random() < .35)) { w = need[0]; G.sinceNeed = 0; }
  else {
    const onBelt = new Set(G.cards.map(c => c.word.group));
    const pool = G.words.filter(x => !onBelt.has(x.group));
    w = (pool.length ? pool : G.words)[rnd((pool.length ? pool : G.words).length)];
    G.sinceNeed++;
  }
  const el = document.createElement('div'); el.className = 'card';
  el.innerHTML = `<span class="p">${wordPic(w, 2)}</span><span class="sp"></span>`;
  el.style.width = G.cw + 'px'; el.style.height = G.cw + 'px'; el.querySelector('.p').style.fontSize = (G.cw * .62) + 'px';
  const c = { word: w, x: G.bw + 4, el, born: G.t };
  el.style.left = c.x + 'px';
  el.addEventListener('pointerdown', e => startPick(e, c));
  belt.appendChild(el); G.cards.push(c);
}
function stepBelt(dt) {
  const pace = 1 + .2 * Math.min(G.wave, WAVES.length - 1);
  G.bw = belt.clientWidth; const v = G.bw * pace / G.sp.belt, gap = 12;
  G.cards.sort((a, b) => a.x - b.x);
  let minX = 10;
  for (const c of G.cards) {
    c.x = Math.max(minX, c.x - v * dt);
    minX = c.x + (c.el.offsetWidth || G.cw) + gap;
    c.el.style.left = c.x + 'px';
    const life = G.sp.belt + CARD_EXTRA[Math.min(G.wave, CARD_EXTRA.length - 1)], age = G.t - c.born;
    if (pick && pick.card === c) continue;
    if (age > life) c.gone = true;
    else c.el.classList.toggle('dying', age > life - 2);
  }
  G.cards.filter(c => c.gone).forEach(c => { c.el.classList.add('vanish'); setTimeout(() => c.el.remove(), 300); });
  G.cards = G.cards.filter(c => !c.gone);
  const lastX = G.cards.length ? G.cards[G.cards.length - 1].x : -1e9;
  if (G.t >= G.cardAt && lastX < G.bw - G.cw - gap && G.cards.length * (G.cw + gap) < G.bw - G.cw) {
    makeCard(); G.cardAt = G.t + G.sp.card / pace;
  }
}

/* ---------- 选卡、拖动、种植 ---------- */
let pick = null;
function startPick(e, c) {
  if (!G || G.paused || G.over) return;
  e.preventDefault();
  if (G.shovel) setShovel(false);
  if (pick && pick.card !== c) pick.card.el.classList.remove('sel');
  pick = { card: c, sx: e.clientX, sy: e.clientY, dragging: false };
  c.el.classList.add('sel'); document.body.classList.add('planting');
  sayWord(c.word); sfx.pick();
}
document.addEventListener('pointermove', e => {
  if (!pick) return;
  if (!pick.dragging && Math.hypot(e.clientX - pick.sx, e.clientY - pick.sy) > 10 && pick.sx !== null) {
    pick.dragging = true; pick.card.el.classList.add('drag');
    const g = $('#ghost'); g.className = '';
    g.innerHTML = `<div class="tur" style="position:relative;transform:none">${turHTML(pick.card.word)}</div>`;
    sizeTur(g.firstChild);
  }
  if (pick.dragging) {
    const g = $('#ghost'); g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px';
    hlCell(cellAt(e.clientX, e.clientY));
  }
});
document.addEventListener('pointerup', e => {
  if (!pick) return;
  if (pick.dragging) {
    const cell = cellAt(e.clientX, e.clientY);
    $('#ghost').className = 'hide'; pick.card.el.classList.remove('drag'); hlCell(null);
    if (cell && plantAt(cell)) return;
    pick.sx = null;
  } else pick.sx = null;
});
field.addEventListener('pointerdown', e => {
  if (!G || G.paused || G.over) return;
  const cell = cellAt(e.clientX, e.clientY);
  if (G.shovel) { if (cell && G.grid[cell.lane][cell.col]) removePlant(G.grid[cell.lane][cell.col], true); setShovel(false); return; }
  if (pick && pick.sx === null && cell) plantAt(cell);
});
function cellAt(cx, cy) {
  const r = field.getBoundingClientRect();
  if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
  const xp = (cx - r.left) / r.width * 100, lane = Math.floor((cy - r.top) / (r.height / LANES)), col = Math.floor((xp - COL0) / CW);
  if (col < 0 || col >= COLS || lane < 0 || lane >= LANES) return null;
  return { lane, col };
}
let hlEl = null;
function hlCell(cell) {
  if (hlEl) hlEl.classList.remove('hl'); hlEl = null;
  if (!cell || G.grid[cell.lane][cell.col]) return;
  hlEl = field.querySelector(`.lane[data-l="${cell.lane}"] .cell[data-c="${cell.col}"]`); hlEl && hlEl.classList.add('hl');
}
function cancelPick() { if (pick) { pick.card.el.classList.remove('sel', 'drag'); pick = null; } document.body.classList.remove('planting'); $('#ghost').className = 'hide'; hlCell && hlEl && hlEl.classList.remove('hl'); }
function plantAt(cell) {
  if (!pick || G.grid[cell.lane][cell.col]) return false;
  const c = pick.card; cancelPick();
  G.cards = G.cards.filter(x => x !== c); c.el.remove();
  const el = document.createElement('div'); el.className = 'tur new';
  el.innerHTML = turHTML(c.word);
  const p = { lane: cell.lane, col: cell.col, x: colX(cell.col), word: c.word, cd: .5, hp: EAT_TIME, miss: 0, proven: false, el };
  el.style.left = p.x + '%'; el.style.top = ((p.lane + .59) * G.lh) + 'px'; sizeTur(el);
  field.appendChild(el); G.plants.push(p); G.grid[p.lane][p.col] = p;
  sfx.plant();
  if (alive().some(m => m.lane === p.lane && m.word.group === p.word.group && m.x > p.x)) { G.idle = 0; G.wrongStreak = 0; }
  else if (++G.wrongStreak >= HINT_WRONG) { const u = urgentMons(); if (u.length) giveHint(u[0]); }
  return true;
}
function setProven(p) {
  if (p.proven) return;
  p.proven = true; p.miss = 0; p.el.classList.add('proven');
}

/* ---------- 提示：高亮正确的卡片 + 读一遍单词，每局最多 HINT_MAX 次 ---------- */
function urgentMons() {
  return alive().filter(m => m.x < 100 && !G.plants.some(p => p.lane === m.lane && p.word.group === m.word.group && p.x < m.x)).sort((a, b) => a.x - b.x);
}
function giveHint(m) {
  G.idle = 0; G.wrongStreak = 0;
  if (G.hints >= HINT_MAX || G.hintWant) return;
  const mid = c => Math.abs(c.x + G.cw / 2 - G.bw / 2);
  let c = G.cards.filter(c => c.word.group === m.word.group).sort((a, b) => mid(a) - mid(b))[0];
  if (!c) {
    const free = G.cards.filter(x => !(pick && pick.card === x) && x.x < G.bw - G.cw * .5).sort((a, b) => mid(a) - mid(b));
    if (free.length) { c = free[0]; c.word = m.word; c.born = G.t; c.el.classList.remove('dying'); c.el.querySelector('.p').innerHTML = wordPic(m.word, 2); }
    else { G.hintWant = m; G.forceWord = m.word; G.cardAt = Math.min(G.cardAt, G.t); return; }
  }
  showHint(c, m);
}
function showHint(c, m) {
  G.hints++; G.hintWant = null; G.idle = 0;
  const edge = c.x < 16 || c.x + G.cw > G.bw - 16;
  c.el.classList.add('hint');
  if (edge) c.el.classList.add('edge');
  setTimeout(() => c.el.classList.remove('hint', 'edge'), 4500);
  m.el.classList.add('hintme'); setTimeout(() => m.el.classList.remove('hintme'), 4500);
  sayWord(m.word);
}
function stepHint(dt) {
  if (G.hintWant) {
    const m = G.hintWant;
    if (m.dead || G.hints >= HINT_MAX) G.hintWant = null;
    else { const c = G.cards.find(c => c.word.group === m.word.group); if (c) showHint(c, m); }
    return;
  }
  if (G.hints >= HINT_MAX) return;
  const u = urgentMons();
  if (!u.length) { G.idle = 0; return; }
  if ((G.idle += dt) >= HINT_IDLE) giveHint(u[0]);
}
function wilt(p) {
  G.plants = G.plants.filter(x => x !== p); G.grid[p.lane][p.col] = null;
  G.mons.forEach(m => { if (m.eating === p) { m.eating = null; m.el.classList.remove('eating'); } });
  p.el.classList.add('wilt'); setTimeout(() => p.el.remove(), 900);
}
function removePlant(p, byShovel) {
  G.plants = G.plants.filter(x => x !== p); G.grid[p.lane][p.col] = null;
  G.mons.forEach(m => { if (m.eating === p) { m.eating = null; m.el.classList.remove('eating'); } });
  p.el.style.transition = 'transform .25s, opacity .25s'; p.el.style.opacity = 0; p.el.style.transform = 'translate(-50%,-40%) scale(.3)';
  setTimeout(() => p.el.remove(), 260);
  if (byShovel) sfx.pick();
}
function setShovel(on) { if (!G) return; G.shovel = on; $('#shovel').classList.toggle('on', on); document.body.classList.toggle('shoveling', on); if (on) cancelPick(); }

/* ---------- 僵尸 ---------- */
function pickWord() {
  const onScreen = new Set(G.mons.filter(m => !m.dead).map(m => m.word.group));
  for (let tries = 0; tries < 2; tries++) {
    if (!G.bag.length) G.bag = shuffle(G.words.slice());
    const i = G.bag.findIndex(w => !onScreen.has(w.group));
    if (i >= 0) return G.bag.splice(i, 1)[0];
    G.bag = [];
  }
  return G.words[rnd(G.words.length)];
}
function spawn() {
  const word = pickWord();
  let lane = rnd(LANES); if (lane === G.lastLane) lane = (lane + 1 + rnd(LANES - 1)) % LANES; G.lastLane = lane;
  const spelling = word.w.toLowerCase();
  const demanding = spelling.replace(/[^a-z]/g, '').length >= 8 || /[a-z] [a-z]|ough|eigh|tch/.test(spelling);
  const armored = demanding && G.wave > 0 && !alive().some(enemy => enemy.maxHp > HP) && Math.random() < .35;
  const maxHp = armored ? DMG_OK * 3 : HP;
  const m = { word, lane, x: 104, maxHp, hp: maxHp, dead: false, eating: null, stun: 0, chew: 0, rage: 0,
    speed: (100 - END_X) / G.sp.cross * (0.9 + Math.random() * .2) };
  const el = document.createElement('div'); el.className = armored ? 'mon armored' : 'mon';
  el.style.setProperty('--sk', SKINS[rnd(SKINS.length)]);
  el.style.setProperty('--cl', CLOTHES[rnd(CLOTHES.length)]);
  el.innerHTML = `<div class="sign"></div><div class="zb"><div class="arm b"></div><div class="leg l"></div><div class="leg r"></div><div class="body"></div><div class="head"><div class="hair"></div><div class="e l"></div><div class="e r"></div><div class="m"></div></div><div class="arm"></div></div><div class="hp"><i></i></div>`;
  el.querySelector('.sign').textContent = word.w;
  m.el = el; field.appendChild(el); G.mons.push(m); placeMon(m);
}
function placeMon(m) {
  const s = Math.min(G.size, G.lh * .88);
  m.el.style.width = s + 'px'; m.el.style.height = s + 'px'; m.el.style.fontSize = s + 'px';
  m.el.querySelector('.sign').style.fontSize = Math.min(G.lh * .26, s * 1.9 / Math.max(4, m.word.w.length)) + 'px';
  m.el.style.left = (m.x / 100 * G.W) + 'px'; m.el.style.top = ((m.lane + .5) * G.lh) + 'px';
}
const alive = () => G.mons.filter(m => !m.dead);

/* ---------- 射击 ---------- */
function firePea(p) {
  p.el.classList.remove('fire'); void p.el.offsetWidth; p.el.classList.add('fire');
  const el = document.createElement('div'); el.className = 'pea';
  el.style.fontSize = (G.lh * .42) + 'px';
  field.appendChild(el);
  G.peas.push({ lane: p.lane, x: p.x + 3.2, from: p.x, word: p.word, plant: p, only: p.proven, el });
  sfx.shoot();
}
function stepPeas(dt) {
  for (const pe of G.peas) {
    pe.x += PEA_SPEED * dt;
    const ahead = G.mons.filter(m => !m.dead && m.lane === pe.lane && m.x > pe.from && m.x - 1.5 > pe.x - 2.2 && (!pe.only || m.word.group === pe.word.group));
    const hasMatch = ahead.some(m => m.word.group === pe.word.group);
    const m = ahead.find(m => Math.abs(m.x - 1.5 - pe.x) < 2.2 && (!hasMatch || m.word.group === pe.word.group));
    if (m) { pe.done = true; hitMon(m, pe); }
    else if (pe.x > 104) pe.done = true;
    if (pe.done) pe.el.remove();
    else { pe.el.style.left = (pe.x / 100 * G.W) + 'px'; pe.el.style.top = ((pe.lane + .38) * G.lh) + 'px'; }
  }
  G.peas = G.peas.filter(p => !p.done);
}
function hitMon(m, pe) {
  const ok = pe.word.group === m.word.group;
  const px = m.x / 100 * G.W, py = (m.lane + .3) * G.lh;
  if (ok) {
    if (pe.plant && G.plants.includes(pe.plant)) setProven(pe.plant);
    m.hp -= DMG_OK;
    m.el.classList.add('hurt');
    m.el.querySelector('.hp i').style.width = Math.max(0, m.hp / m.maxHp * 100) + '%';
  }
  const cls = ok ? 'okhit' : 'badhit';
  m.el.classList.remove('okhit', 'badhit'); void m.el.offsetWidth; m.el.classList.add(cls);
  if (ok) {
    sfx.okhit();
    fx(px, py, '✓', 'ok', G.lh * .42);
    fx(px, (m.lane + .45) * G.lh, '', 'ring', G.lh * .7);
    m.x = Math.min(104, m.x + 1.8); m.stun = .7; m.el.classList.add('stun');
  } else {
    sfx.badhit();
    fx(px - G.size * .25, (m.lane + .4) * G.lh, '当！', 'bad', G.lh * .22);
    fx(px + G.size * .15, (m.lane + .05) * G.lh, '💢', 'bad emo', G.lh * .3);
    m.rage = RAGE_TIME; m.el.classList.add('rage');
    const p = pe.plant;
    if (p && G.plants.includes(p) && !p.proven && ++p.miss >= WILT_AFTER) wilt(p);
  }
  if (m.hp <= 0) {
    killMon(m, ok);
    if (ok && G.plants.includes(pe.plant)) removePlant(pe.plant, false);
  }
}
function killMon(m, ok) {
  m.dead = true; m.el.classList.add('die'); setTimeout(() => m.el.remove(), 550);
  if (m.eating) m.eating = null;
  G.killed++; updateBar(); sfx.kill();
  fx(m.x / 100 * G.W, (m.lane + .1) * G.lh, m.word.w, 'word', G.lh * .3);
  if (performance.now() - lastSay > 1300) setTimeout(() => { if (!pick) sayWord(m.word); }, 250);
}
function fx(x, y, text, cls, size) {
  const d = document.createElement('div'); d.className = 'fx ' + cls; d.textContent = text;
  d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.fontSize = size + 'px';
  field.appendChild(d); setTimeout(() => d.remove(), 1200);
}

/* ---------- 小车 ---------- */
function breach(m) {
  m.waiting = true;
  if (G.carts.some(c => c.lane === m.lane && (c.state === 'coming' || (c.state === 'go' && c.x < m.x + 4)))) return;
  const ready = G.carts.filter(c => c.state === 'ready');
  if (!ready.length) return lose(m);
  ready.sort((a, b) => Math.abs(a.lane - m.lane) - Math.abs(b.lane - m.lane));
  const c = ready[0];
  if (c.lane === m.lane) launch(c);
  else { c.state = 'coming'; c.delay = .45; c.lane = m.lane; c.el.classList.remove('ready'); placeCart(c); }
}
function launch(c) { c.state = 'go'; c.el.classList.remove('ready'); c.el.classList.add('go'); sfx.cart(); updateBar(); }
function stepCarts(dt) {
  for (const c of G.carts) {
    if (c.state === 'coming') {
      c.delay -= dt;
      if (c.delay <= 0) launch(c);
      continue;
    }
    if (c.state !== 'go') continue;
    c.x += 60 * dt; placeCart(c);
    for (const m of G.mons) if (!m.dead && m.lane === c.lane && m.x <= c.x + 4) {
      m.dead = true; m.el.classList.add('squash'); setTimeout(() => m.el.remove(), 450); G.killed++; updateBar();
    }
    if (c.x > 106) { c.state = 'gone'; c.el.remove(); G.mons.forEach(m => { if (m.lane === c.lane) m.waiting = false; }); }
  }
}
const cartsLeft = () => G.carts.filter(c => c.state === 'ready').length;

/* ---------- 主循环 ---------- */
function loop(now) {
  if (!G || G.over) return;
  const dt = Math.min(.1, (now - G.last) / 1000); G.last = now;
  if (!G.paused) step(dt);
  requestAnimationFrame(loop);
}
function step(dt) {
  G.t += dt;
  stepBelt(dt);
  if (G.wave < WAVES.length) {
    if (G.spawned < WAVES[G.wave] && G.t >= G.spawnAt && alive().length < 6) {
      const pair = G.wave >= 1 && G.spawned === Math.floor(WAVES[G.wave] / 2) && alive().length <= 4;
      spawn(); G.spawned++;
      if (pair && G.spawned < WAVES[G.wave]) { spawn(); G.spawned++; }
      G.spawnAt = G.t + G.sp.gap * (.95 + Math.random() * .1) * (1 - .13 * G.wave);
    }
    if (G.spawned >= WAVES[G.wave] && !alive().length) {
      G.wave++; G.spawned = 0; updateBar();
      if (G.wave < WAVES.length) {
        banner(G.wave === WAVES.length - 1 ? '最后一波！' : `第 ${G.wave + 1} 波`, 1600); sfx.wave();
        G.spawnAt = G.t + 4;
      } else return win();
    }
  }
  for (const p of G.plants) {
    p.cd -= dt;
    if (p.cd <= 0 && G.mons.some(m => !m.dead && m.lane === p.lane && m.x > p.x && m.x - p.x <= RANGE && m.x < 101 && (!p.proven || m.word.group === p.word.group))) { firePea(p); p.cd = FIRE_CD; }
  }
  stepPeas(dt);
  stepHint(dt);
  for (const m of G.mons) {
    if (m.dead) continue;
    if (m.rage > 0) { m.rage -= dt; if (m.rage <= 0) m.el.classList.remove('rage'); }
    if (m.stun > 0) { m.stun -= dt; if (m.stun <= 0) m.el.classList.remove('stun'); }
    else if (m.eating && m.eating.proven && m.eating.word.group !== m.word.group) { m.eating = null; m.el.classList.remove('eating'); }
    else if (m.eating) {
      const p = m.eating; p.hp -= dt * (m.rage > 0 ? RAGE_SPEED : 1) * (p.word.group === m.word.group ? 1 : EAT_TIME / WRONG_EAT); p.el.classList.add('chewed');
      m.chew -= dt; if (m.chew <= 0) { sfx.eat(); m.chew = .45; }
      if (p.hp <= 0) { removePlant(p); m.eating = null; m.el.classList.remove('eating'); }
    } else if (!m.waiting) {
      const p = G.plants.find(p => p.lane === m.lane && p.x < m.x && m.x - p.x < 4 && !(p.proven && p.word.group !== m.word.group));
      if (p) { m.eating = p; m.el.classList.add('eating'); }
      else m.x -= m.speed * (m.rage > 0 ? RAGE_SPEED : 1) * dt;
      if (m.x <= END_X) { m.x = END_X; breach(m); }
    }
    m.el.style.left = (m.x / 100 * G.W) + 'px';
  }
  G.plants.forEach(p => { if (!G.mons.some(m => m.eating === p)) p.el.classList.remove('chewed'); });
  stepCarts(dt);
  G.mons = G.mons.filter(m => !m.dead || m.el.isConnected);
}

/* ---------- 界面 ---------- */
function updateBar() {
  const pct = Math.min(100, G.killed / G.total * 100);
  const w = Math.min(G.wave, WAVES.length - 1);
  const dots = WAVES.map((_, i) => `<b class="${i < G.wave ? 'done' : i === w ? 'cur' : ''}"></b>`).join('');
  $('#wave').innerHTML = `<span class="dots" title="第 ${w + 1} 波，共 ${WAVES.length} 波">${dots}</span><span class="wt">${w === WAVES.length - 1 ? '最后一波' : '第 ' + (w + 1) + ' 波'}</span><span class="prog"><i style="width:${pct}%"></i></span><span class="cars"><span class="emo">🚗</span>×${cartsLeft()}</span>`;
}
let bannerTimer = 0;
function banner(text, ms) { const b = $('#banner'); b.textContent = text; b.classList.add('on'); clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('on'), ms); }

function togglePause(force) {
  if (!G || G.over) return;
  G.paused = force !== undefined ? force : !G.paused;
  $('#pause').textContent = G.paused ? '▶' : '⏸';
  $('#game').classList.toggle('paused', G.paused);
  if (!G.paused) { closeModal(); G.last = performance.now(); return; }
  cancelPick();
  modal(`<h2>暂停中</h2><p class="sub">休息一下</p><div class="row"><button class="b-sub" data-q>退出</button><button class="b-main" data-r>继续</button></div>`);
  $('#mbox').onclick = e => {
    if (e.target.closest('[data-r]')) togglePause(false);
    if (e.target.closest('[data-q]')) { closeModal(); quit(); }
  };
}
function win() {
  G.over = true; cancelPick();
  const left = cartsLeft(), stars = left >= 4 ? 3 : left >= 2 ? 2 : 1;
  if (stars > getBest(G.level.id)) { save.best[bestKey(G.level.id)] = stars; store(); }
  setTimeout(() => {
    sfx.win(); sayPhrase('win');
    showEnd(`<div class="big emo">${'⭐'.repeat(stars)}${'<span style="opacity:.2">⭐</span>'.repeat(3 - stars)}</div><h2>守住啦！</h2><p class="sub">打败了 ${G.total} 只僵尸 · 还剩 ${left} 辆小车</p>`, true);
  }, 800);
}
function lose(m) {
  G.over = true; cancelPick();
  m.el.style.transition = 'left 1.2s linear'; m.el.style.left = '-10%';
  setTimeout(() => {
    sfx.lose(); sayPhrase('lose');
    showEnd(`<div class="big emo">🧟🧠</div><h2>脑子被吃掉了！</h2><p class="sub">4 辆小车都用完了。先认一认单词，再来一次！</p>`);
  }, 1300);
}
function showEnd(html, won = false) {
  const nextLv = !UNIT && won ? window._levels[window._levels.indexOf(G.level) + 1] : null;
  const next = UNIT ? (won && NEXT_URL) : nextLv;
  const actions = won
    ? '<button class="b-sub" data-a>重玩</button>' + (next ? '<button class="b-main" data-n>下一关 ▶</button>' : '')
    : '<button class="b-sub" data-l>👂 先认一认</button><button class="b-main" data-a>再玩一次</button>';
  modal(html + '<div class="row"><button class="' + (won && !next ? 'b-main' : 'b-sub') + '" data-h>选关</button>' + actions + '</div>');
  $('#mbox').onclick = e => {
    const lv = G.level;
    if (e.target.closest('[data-h]')) {
      if (HOME_HASH) location.href = 'index.html#' + HOME_HASH;
      else { closeModal(); quit(); }
    }
    if (e.target.closest('[data-l]')) { quit(); showLearn(lv); }
    if (e.target.closest('[data-a]')) startGame(lv);
    if (next && e.target.closest('[data-n]')) {
      if (typeof next === 'string') location.href = next;
      else { quit(); showLearn(next, true); }
    }
  };
}
function quit() {
  if (G) G.over = true;
  cancelPick();
  if (playing) try { playing.pause(); } catch (e) {}
  $('#game').classList.add('hide'); $('#home').classList.remove('hide'); renderHome();
}

$('#pause').onclick = () => togglePause();
$('#quit').onclick = () => togglePause(true);
$('#shovel').onclick = () => setShovel(!G.shovel);
document.addEventListener('keydown', e => {
  if (!G || G.over || $('#game').classList.contains('hide')) return;
  if (e.key === 'p' || e.key === 'P' || e.key === ' ') { e.preventDefault(); togglePause(); }
  if (e.key === 'Escape') { cancelPick(); setShovel(false); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && G && !G.over && !G.paused) togglePause(true); });
renderHome();
if (location.hash === '#learn') {
  history.replaceState(null, '', location.pathname + location.search);
  showLearn(window._levels[0], true);
} else if (location.hash === '#play') {
  history.replaceState(null, '', location.pathname + location.search);
  startGame(window._levels[0]);
}
