/* kinija-uzsakymai — shared.js
   The maths that both pages (board.html for the partner in China and the
   warehouse, owner.html for the owner) must agree on. It lives in ONE file so
   the two pages can never show different numbers for the same product — the
   exact thing that happened before 2026-09-03, when three copies of the
   matching rules drifted 181 units apart.

   Published next to the pages by publish_board.py. No framework, no build. */

/* ---------------- dates ---------------- */
// LOCAL date, not UTC: toISOString() would give the person in China, typing at
// 07:00 Beijing, yesterday's date — and the warehouse count "Counted on" too.
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
function today() { return iso(new Date()); }
function daysAgo(n) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return iso(d); }
function daysSince(d) {
  if (!d) return "";
  const ms = Date.now() - new Date(String(d).slice(0, 10) + "T00:00:00").getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

/* ---------------- product codes ---------------- */
/* A row may name a variant the catalogue keeps under its base code — a ring
   size ("KTR144 S-8") or a plating suffix. So we try the exact code first and
   fall back to the base one. Where the code ends and the variant begins is
   written right there: the space. "KTB005 20CM" is item KTB005 in size 20cm,
   so we split on the space FIRST — stripping it away would glue the size onto
   the digits (KTB00520CM) and leave nothing to go on. */
function photoNames(sku) {
  const raw = String(sku || "").toUpperCase().trim();
  const svarus = s => s.replace(/[^A-Z0-9-]/g, "");
  const kand = [];
  for (const v of [svarus(raw), svarus(raw.split(/\s+/)[0])]) {
    if (v && !kand.includes(v)) kand.push(v);
  }
  // Ir tas pats be dangos priesagos gale („KTC165-A" → „KTC165").
  const be_variantu = (kand[kand.length - 1] || "").replace(/-[A-Z]{1,3}\d?$/, "");
  if (be_variantu && !kand.includes(be_variantu)) kand.push(be_variantu);
  return kand;
}
// The SKU is the key to the photo and to the stock row, so it must be exact:
// a trailing space ("KTR144 ") used to break both. Codes go upper-case; word
// names ("neck basic") stay as typed, because that is how the stock row is called.
function cleanSku(s) {
  s = String(s || "").replace(/\s+/g, " ").trim();
  return /^[A-Za-z]{1,5}\d/.test(s) ? s.toUpperCase() : s;
}

/* ---------------- tracking numbers ----------------
   Every real tracking on this board is UPU S10: two letters, nine digits, two
   letters (GV668040035GB). The ninth digit is a check digit, so a typo can be
   caught the moment it is typed instead of a week later at the post office. */
const S10_WEIGHTS = [8, 6, 4, 2, 3, 5, 9, 7];
const CARRIERS = [
  [/^[A-Z]{2}\d{9}GB$/, "Royal Mail",  t => `https://www.royalmail.com/track-your-item#/tracking-results/${t}`],
  [/^[A-Z]{2}\d{9}YP$/, "Yun Express", t => `https://www.yuntrack.com/parcelTracking?id=${t}`],
  [/^[A-Z]{2}\d{9}CN$/, "China Post",  t => `https://t.17track.net/en#nums=${t}`],
  [/^YT\d{16}$/,        "Yanwen",      t => `https://track.yw56.com.cn/en/querydel?nums=${t}`],
  [/^L[A-Z]\d{9,}[A-Z]*$/, "Cainiao",  t => `https://global.cainiao.com/detail.htm?mailNoList=${t}`],
  [/^4PX/,              "4PX",         t => `https://track.4px.com/#/result/0/${t}`],
];
function cleanTracking(t) { return String(t || "").replace(/[\s\-]/g, "").toUpperCase(); }
function s10ok(t) {                     // null = not S10 (no opinion), true/false = check digit
  const m = /^[A-Z]{2}(\d{8})(\d)[A-Z]{2}$/.exec(t);
  if (!m) return null;
  let s = 0;
  for (let i = 0; i < 8; i++) s += Number(m[1][i]) * S10_WEIGHTS[i];
  const r = 11 - (s % 11);
  const check = r === 10 ? 0 : (r === 11 ? 5 : r);
  return check === Number(m[2]);
}
function carrierOf(t) {
  for (const [rx, name, url] of CARRIERS) if (rx.test(t)) return [name, url(t)];
  return [null, `https://t.17track.net/en#nums=${t}`];
}

/* ---------------- shipping date written in a note ----------------
   The partner rarely types a tracking number; she writes "shiped on 24 August"
   or "will be shiped on 22 Aug" into the note. Same rule as orders.py. */
const SHIP_MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
function noteShipDate(note) {
  if (!note) return null;
  const t = String(note);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  let m = /(\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})/.exec(t), day, mon;
  if (m && SHIP_MONTHS[m[2].slice(0, 3).toLowerCase()]) { day = +m[1]; mon = SHIP_MONTHS[m[2].slice(0, 3).toLowerCase()]; }
  else {
    m = /([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/.exec(t);
    if (m && SHIP_MONTHS[m[1].slice(0, 3).toLowerCase()]) { day = +m[2]; mon = SHIP_MONTHS[m[1].slice(0, 3).toLowerCase()]; }
    else {
      m = /(20\d{2})-(\d{1,2})-(\d{1,2})/.exec(t);
      if (!m) return null;
      return new Date(+m[1], +m[2] - 1, +m[3]);
    }
  }
  for (const y of [now.getFullYear(), now.getFullYear() - 1]) {
    const d = new Date(y, mon - 1, day);
    if (d.getMonth() !== mon - 1) return null;
    if (d.getTime() <= now.getTime() + 30 * 86400000) return d;
  }
  return null;
}
function daysSinceShipped(row) {         // -1 = unknown (no date in the note)
  const d = noteShipDate(row.note || "");
  if (!d) return -1;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.floor((now - d) / 86400000);
}

/* ---------------- stock ----------------
   The number is never stored — it is worked out every time:

       in stock = counted (raised by "+ Arrived") - sold since the count

   "Counted" is a number with a date on it, and selling is read out of the
   shipping labels that land in the mailbox every day. Keeping a running
   total instead would mean a second scan of the same day quietly removes
   the same pieces twice, and a day the computer was off is lost forever. */
const STK = { trip:14, red:14, amber:28, cover:60, window:30, dead:60, round:10 };
const STK_NONE = { counted:false, left:0, s7:0, s30:0, perDay:0, perWeek:0,
                   left_days:null, incoming:0, hot:false, dead:false, colour:"grey", suggest:0 };

// Codes are matched the same way the product photo is looked up, so the two
// can never disagree about which product a row is about.
function stockMap(list) {
  const m = new Map(), loose = new Map();
  for (const r of list) { const k = photoNames(r.sku)[0]; if (k) m.set(k, r.sku); }
  for (const r of list) for (const k of photoNames(r.sku).slice(1)) {
    if (m.has(k)) continue;
    if (!loose.has(k)) loose.set(k, new Set());
    loose.get(k).add(r.sku);
  }
  // A stripped code claimed by two products (KTC165-A and KTC165-B) is dropped:
  // better to leave a sale unmatched than to take it off the wrong variant.
  for (const [k, who] of loose) if (who.size === 1) m.set(k, [...who][0]);
  return m;
}
function stockMatch(sku, m) { for (const k of photoNames(sku)) if (m.has(k)) return m.get(k); return null; }

/* rows = stock table, sales = {sold_date, sku, qty}, orders = {sku, qty, status},
   days = Set of scanned dates. Returns Map(row.id -> figures) plus, on the map
   itself, `.sold` (stock sku -> [[date, qty]...]) for sparklines. */
function stkCompute(rows, stkSales, stkOrders, stkDays) {
  const memo = new Map();
  const m = stockMap(rows);
  const sold = new Map(), incoming = new Map();

  for (const s of stkSales) {
    const t = stockMatch(s.sku, m); if (!t) continue;
    if (!sold.has(t)) sold.set(t, []);
    sold.get(t).push([String(s.sold_date).slice(0, 10), +s.qty || 0]);
  }
  for (const o of stkOrders) {
    const t = stockMatch(o.sku, m); if (!t) continue;
    const q = +o.qty || 0;
    // A received box no longer moves the count — the warehouse enters what it
    // unpacks in "+ Arrived". Marking it received only takes it off "on order".
    if (o.status !== "received" && o.status !== "problem") {
      incoming.set(t, (incoming.get(t) || 0) + q);
    }
  }

  const sum = (list, from, to) =>
    (list || []).reduce((n, [d, q]) => (d && d >= from && d <= to ? n + q : n), 0);
  // Everything that happened AFTER the count day. What went out on the day
  // itself was already off the shelf when it was counted.
  const sumAfter = (list, from, to) =>
    (list || []).reduce((n, [d, q]) => (d && d > from && d <= to ? n + q : n), 0);
  const now = today();

  // The speed is divided by the days actually read, not by a flat 30 — in the
  // first week a 30-day divisor would show a tenth of the real rate.
  let covered = 0;
  for (let i = 0; i < STK.window; i++) if (stkDays.has(daysAgo(i))) covered++;
  covered = covered || 1;

  for (const r of rows) {
    const list = sold.get(r.sku);
    const counted = r.baseline_qty != null;
    const base = +r.baseline_qty || 0;
    const from = String(r.baseline_date || "").slice(0, 10);
    const left = (counted && from) ? base - sumAfter(list, from, now) : base;

    const s7 = sum(list, daysAgo(7), now);
    const s30 = sum(list, daysAgo(STK.window), now);
    const s60 = sum(list, daysAgo(STK.dead), now);
    const perDay = s30 / covered;
    const leftDays = (counted && perDay > 0) ? Math.floor(left / perDay) : null;

    let colour = "grey";
    if (counted) {
      if (left <= 0) colour = "red";
      else if (leftDays === null) colour = "green";
      else if (leftDays < STK.red) colour = "red";
      else if (leftDays < STK.amber) colour = "orange";
      else colour = "green";
    }
    const need = perDay > 0 ? perDay * (STK.trip + STK.cover) - left - (incoming.get(r.sku) || 0) : 0;

    memo.set(r.id, {
      counted, base, baseDate: from, left, s7, s30, perDay,
      perWeek: Math.round(perDay * 70) / 10,
      left_days: leftDays, incoming: incoming.get(r.sku) || 0,
      hot: s30 >= 10 && perDay > 0 && (s7 / 7) >= perDay * 1.3,
      dead: counted && left > 0 && s60 === 0,
      colour,
      suggest: (counted && leftDays !== null && leftDays < STK.amber && need > 0)
        ? Math.ceil(need / STK.round) * STK.round : 0,
    });
  }
  memo.sold = sold;
  memo.map = m;
  return memo;
}
