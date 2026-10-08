import { parseAmount, toPlain, priceDecimals, fiatDecimals, sparkPaths } from './num.js';

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const appWindow = window.__TAURI__.window.getCurrentWindow();

const FIATS = ['usd', 'eur', 'gbp', 'jpy', 'cad', 'aud', 'chf', 'brl', 'inr'];
const QUICK = [10, 100, 1000, 10000];
const STALE_AFTER_MS = 3 * 60 * 1000;
const CRYPTO_DECIMALS = 8;

const $ = (id) => document.getElementById(id);
const store = {
  get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage unavailable: not persisted */ } },
};

const state = {
  snap: null,
  coinId: store.get('coin', 'bitcoin'),
  vs: FIATS.includes(store.get('vs', 'usd')) ? store.get('vs', 'usd') : 'usd',
  edited: 'crypto',
  error: null,
  active: 0,
};

const coin = () => state.snap?.coins.find((c) => c.id === state.coinId) ?? state.snap?.coins[0] ?? null;
const money = (value, digits) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency', currency: state.vs.toUpperCase(),
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(value);
const pct = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
const trend = (v) => (v == null ? '' : v >= 0 ? 'up' : 'down');

function avatar(el, c) {
  el.textContent = c.symbol.slice(0, 3).toUpperCase();
  if (!c.image) return;
  const img = new Image();
  img.alt = '';
  img.decoding = 'async';
  img.onload = () => el.replaceChildren(img);
  img.src = c.image;
}

/* ---------- render ---------- */
function renderHero() {
  const c = coin();
  if (!c) return;
  $('coinName').textContent = c.name;
  $('coinSym').textContent = c.symbol.toUpperCase();
  $('cryptoLabel').textContent = c.symbol.toUpperCase();
  $('coinRank').textContent = c.market_cap_rank ? `#${c.market_cap_rank}` : '';
  avatar($('coinAvatar'), c);

  const price = $('price');
  const text = c.current_price == null ? '—' : money(c.current_price, priceDecimals(c.current_price));
  if (price.textContent !== text) {
    price.textContent = text;
    price.classList.remove('flash');
    void price.offsetWidth;
    price.classList.add('flash');
  }

  const change = c.price_change_percentage_24h;
  const changeEl = $('change');
  changeEl.className = `change ${trend(change)}`;
  changeEl.innerHTML = '';
  if (change != null) {
    changeEl.append(pct(change), ' ');
    const label = document.createElement('span');
    label.textContent = '24h';
    changeEl.append(label);
  }

  const { line, fill } = sparkPaths(c.sparkline_in_7d?.price, 380, 72);
  $('sparkLine').setAttribute('d', line);
  $('sparkFill').setAttribute('d', fill);
  $('spark').setAttribute('class', `spark ${trend(change)}`);
}

function recompute() {
  const price = coin()?.current_price;
  const crypto = $('cryptoAmt');
  const fiat = $('fiatAmt');
  const [src, dst] = state.edited === 'crypto' ? [crypto, fiat] : [fiat, crypto];
  const amount = parseAmount(src.value);
  src.setAttribute('aria-invalid', String(src.value.trim() !== '' && amount === null));
  if (amount === null || !price) {
    dst.value = '';
    return;
  }
  dst.value = state.edited === 'crypto'
    ? toPlain(amount * price, fiatDecimals(state.vs), fiatDecimals(state.vs))
    : toPlain(amount / price, CRYPTO_DECIMALS);
}

function ago(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

function renderStatus() {
  const dot = $('dot');
  const status = $('status');
  const fetched = state.snap?.fetched_at;
  if (state.error) {
    dot.className = 'dot error';
    status.textContent = fetched ? `${state.error} · last ${ago(fetched)}` : state.error;
  } else if (fetched) {
    const stale = Date.now() - fetched > STALE_AFTER_MS;
    dot.className = `dot ${stale ? 'stale' : 'live'}`;
    status.textContent = `Updated ${ago(fetched)} · CoinGecko`;
  }
}

function apply(snap) {
  if (snap.vs !== state.vs) return; // a refresh for a currency we've since left
  state.snap = snap;
  state.error = null;
  if (!snap.coins.some((c) => c.id === state.coinId)) state.coinId = snap.coins[0]?.id ?? 'bitcoin';
  renderHero();
  recompute();
  renderStatus();
  if ($('picker').open) renderList();
}

/* ---------- actions ---------- */
async function run(promise) {
  $('refreshBtn').classList.add('spinning');
  try {
    apply(await promise);
  } catch (err) {
    if (!String(err).includes('Currency changed')) {
      state.error = String(err);
      renderStatus();
    }
  } finally {
    $('refreshBtn').classList.remove('spinning');
  }
}

function setCurrency(vs) {
  state.vs = vs;
  store.set('vs', vs);
  $('fiat').value = vs;
  renderQuick();
  run(invoke('set_currency', { vs }));
}

function selectCoin(id) {
  state.coinId = id;
  store.set('coin', id);
  $('picker').close();
  renderHero();
  recompute();
  $('cryptoAmt').focus();
}

async function copy(btn) {
  const value = $(btn.dataset.copy).value;
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    btn.classList.add('done');
    btn.setAttribute('aria-label', 'Copied');
    setTimeout(() => btn.classList.remove('done'), 1200);
  } catch {
    state.error = 'Clipboard unavailable';
    renderStatus();
  }
}

/* ---------- picker ---------- */
function matches() {
  const q = $('search').value.trim().toLowerCase();
  const coins = state.snap?.coins ?? [];
  if (!q) return coins;
  const score = (c) => (c.symbol === q ? 0 : c.symbol.startsWith(q) ? 1 : c.name.toLowerCase().startsWith(q) ? 2 : 3);
  return coins
    .filter((c) => c.symbol.includes(q) || c.name.toLowerCase().includes(q))
    .sort((a, b) => score(a) - score(b));
}

function renderList() {
  const list = $('coinList');
  const items = matches();
  state.active = Math.min(state.active, Math.max(items.length - 1, 0));
  list.replaceChildren(...items.map((c, i) => {
    const li = document.createElement('li');
    li.id = `opt-${c.id}`;
    li.role = 'option';
    li.dataset.id = c.id;
    li.setAttribute('aria-selected', String(i === state.active));
    if (c.id === state.coinId) li.classList.add('current');

    const av = document.createElement('span');
    av.className = 'avatar sm';
    avatar(av, c);
    const names = document.createElement('span');
    names.className = 'names';
    names.innerHTML = '<span class="sym"></span><span class="name"></span>';
    names.firstChild.textContent = c.symbol.toUpperCase();
    names.lastChild.textContent = c.name;
    const px = document.createElement('span');
    px.className = 'px';
    px.textContent = c.current_price == null ? '—' : money(c.current_price, priceDecimals(c.current_price));
    if (c.price_change_percentage_24h != null) {
      const ch = document.createElement('small');
      ch.className = trend(c.price_change_percentage_24h);
      ch.textContent = pct(c.price_change_percentage_24h);
      px.append(ch);
    }
    li.append(av, names, px);
    return li;
  }));
  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = state.snap ? 'No coin matches' : 'Loading coins…';
    list.append(empty);
  }
  const active = items[state.active];
  $('search').setAttribute('aria-activedescendant', active ? `opt-${active.id}` : '');
  list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
}

function openPicker() {
  const picker = $('picker');
  if (picker.open) return;
  $('search').value = '';
  state.active = Math.max(0, matches().findIndex((c) => c.id === state.coinId));
  picker.showModal();
  renderList();
  $('search').focus();
}

function onSearchKey(e) {
  const items = matches();
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const delta = e.key === 'ArrowDown' ? 1 : -1;
    state.active = (state.active + delta + items.length) % Math.max(items.length, 1);
    renderList();
  } else if (e.key === 'Enter' && items[state.active]) {
    e.preventDefault();
    selectCoin(items[state.active].id);
  }
}

/* ---------- wiring ---------- */
function renderQuick() {
  $('quick').replaceChildren(...QUICK.map((n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = new Intl.NumberFormat(undefined, {
      style: 'currency', currency: state.vs.toUpperCase(), notation: 'compact', maximumFractionDigits: 0,
    }).format(n);
    b.addEventListener('click', () => {
      $('fiatAmt').value = String(n);
      state.edited = 'fiat';
      recompute();
    });
    return b;
  }));
}

function wire() {
  $('fiat').replaceChildren(...FIATS.map((f) => new Option(f.toUpperCase(), f)));
  $('fiat').value = state.vs;
  $('fiat').addEventListener('change', (e) => setCurrency(e.target.value));
  renderQuick();

  for (const [id, side] of [['cryptoAmt', 'crypto'], ['fiatAmt', 'fiat']]) {
    $(id).addEventListener('input', () => { state.edited = side; recompute(); });
  }
  document.querySelectorAll('.copy').forEach((b) => b.addEventListener('click', () => copy(b)));
  $('coinBtn').addEventListener('click', openPicker);
  $('refreshBtn').addEventListener('click', () => run(invoke('refresh')));
  $('quitBtn').addEventListener('click', () => invoke('quit'));
  $('search').addEventListener('input', () => { state.active = 0; renderList(); });
  $('search').addEventListener('keydown', onSearchKey);
  $('coinList').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (li) selectCoin(li.dataset.id);
  });

  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === 'Escape' && !$('picker').open) appWindow.hide();
    else if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openPicker(); }
    else if (e.key === '/' && !$('picker').open && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); openPicker(); }
    else if (mod && e.key.toLowerCase() === 'r') { e.preventDefault(); run(invoke('refresh')); }
    else if (mod && e.key.toLowerCase() === 'q') { e.preventDefault(); invoke('quit'); }
  });
  window.addEventListener('focus', () => { if (!$('picker').open) $('cryptoAmt').focus(); });
  setInterval(renderStatus, 10_000);
}

async function init() {
  wire();
  listen('markets', (e) => apply(e.payload));
  listen('markets-error', (e) => { state.error = e.payload; renderStatus(); });
  const snap = await invoke('get_snapshot');
  if (snap?.vs === state.vs) apply(snap);
  else run(invoke('set_currency', { vs: state.vs }));
}

init();
