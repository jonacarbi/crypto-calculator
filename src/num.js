// Pure number helpers — no DOM, so they run under `node --test`.

/** Parses user-typed amounts: "1,234.5", "1.234,5", "0,5", "1 000". Returns null if not a number. */
export function parseAmount(raw) {
  let s = String(raw ?? '').trim().replace(/[\s_'’]/g, '');
  if (!s) return null;
  const dot = s.lastIndexOf('.');
  const comma = s.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) {
    s = dot > comma ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  } else if (comma >= 0) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  }
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Editable output: no grouping, trailing zeros trimmed. */
export function toPlain(n, maxDecimals, minDecimals = 0) {
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('en-US', {
    useGrouping: false, minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals,
  });
}

/** Enough decimals to show a meaningful price, from $60k to $0.00001. */
export function priceDecimals(price) {
  if (price >= 1) return 2;
  if (price >= 0.01) return 4;
  return 8;
}

/** Minor units for a fiat code (JPY → 0, USD → 2). */
export function fiatDecimals(vs) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: vs.toUpperCase() })
      .resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}

/** SVG paths for a sparkline in a w×h box. Nulls are skipped. */
export function sparkPaths(prices, w, h, pad = 4) {
  const pts = (prices ?? []).filter(Number.isFinite);
  if (pts.length < 2) return { line: '', fill: '' };
  const min = Math.min(...pts);
  const span = Math.max(...pts) - min || 1;
  const step = w / (pts.length - 1);
  const xy = pts.map((p, i) => [i * step, pad + (1 - (p - min) / span) * (h - pad * 2)]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  return { line, fill: `${line}L${w} ${h}L0 ${h}Z` };
}
