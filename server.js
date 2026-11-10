'use strict';
/*
 * ILNA Kafe QR — sunucu
 * Tek şube / tek işletme için hafif kurulum: Express + JSON dosya veritabanı + Server-Sent Events.
 * Fiyat, indirim, çark sonucu ve sadakat damgaları her zaman sunucuda hesaplanır; tarayıcıya güvenilmez.
 */
process.env.TZ = process.env.TZ || 'Europe/Istanbul';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* ---------------- Ayarlar ---------------- */
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (IS_PROD ? '' : 'demo1234');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SEED_DEMO = process.env.SEED_DEMO === 'true';

if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
  console.error('HATA: ADMIN_PASSWORD ortam değişkeni en az 8 karakter olmalı. Örnek: ADMIN_PASSWORD="guclu-bir-sifre"');
  process.exit(1);
}
if (!process.env.SESSION_SECRET) console.warn('UYARI: SESSION_SECRET tanımlı değil; sunucu her yeniden başladığında panel oturumları kapanır.');
if (!IS_PROD && !process.env.ADMIN_PASSWORD) console.warn('UYARI: Geliştirme modu, panel şifresi: demo1234');

/* ---------------- Sabitler / varsayılan menü ---------------- */
const PRESETS = {
  matcha:  {name: 'Matcha',  note: 'Ferah, gündüz',  bg: '#EEF3EE', card: '#FFFFFF', ink: '#15241D', muted: '#5C6E64', accent: '#2F7D5B', accentInk: '#FFFFFF', fontD: 'Bricolage Grotesque', fontB: 'Figtree'},
  gece:    {name: 'Gece',    note: 'Koyu, akşam',    bg: '#15161A', card: '#22242B', ink: '#F3F1EC', muted: '#A3A6AE', accent: '#FF7A59', accentInk: '#1A0F0B', fontD: 'DM Serif Display', fontB: 'Figtree'},
  atari:   {name: 'Atari',   note: 'Retro, oyunlu',  bg: '#FDE6C4', card: '#FFF6E8', ink: '#2B1B17', muted: '#7A5E52', accent: '#D7263D', accentInk: '#FFFFFF', fontD: 'Baloo 2', fontB: 'Space Mono'},
  lavanta: {name: 'Lavanta', note: 'Yumuşak, butik', bg: '#F1EEFB', card: '#FFFFFF', ink: '#221B3A', muted: '#6D6589', accent: '#6C4CE0', accentInk: '#FFFFFF', fontD: 'Fraunces', fontB: 'Figtree'}
};
const FONTS = ['Bricolage Grotesque', 'Fraunces', 'DM Serif Display', 'Baloo 2', 'Figtree', 'Space Mono'];
const COLOR_KEYS = ['bg', 'card', 'ink', 'muted', 'accent', 'accentInk'];

const PRODUCTS = [
  {id: 'k1', cat: 'kahve', name: 'Espresso', price: 110, desc: 'Çift shot, yoğun gövde', tags: ['sicak', 'yogun'], coffee: true, pop: 1, recipe: {bean: 18}},
  {id: 'k2', cat: 'kahve', name: 'Latte', price: 150, desc: 'Çift shot espresso, buharda süt', tags: ['sicak', 'sutlu', 'hafif'], coffee: true, pop: 3, recipe: {bean: 18, milk: 220}},
  {id: 'k3', cat: 'kahve', name: 'Flat White', price: 155, desc: 'Az köpük, belirgin kahve tadı', tags: ['sicak', 'sutlu', 'yogun'], coffee: true, pop: 2, recipe: {bean: 18, milk: 150}},
  {id: 'k4', cat: 'kahve', name: 'Türk Kahvesi', price: 95, desc: 'Lokum eşliğinde', tags: ['sicak', 'yogun'], coffee: true, pop: 2, recipe: {bean: 7}},
  {id: 'k5', cat: 'kahve', name: 'Filtre Kahve', price: 120, desc: 'Günün çekirdeği, V60 demleme', tags: ['sicak', 'hafif'], coffee: true, pop: 1, recipe: {bean: 15}},
  {id: 'k6', cat: 'kahve', name: 'Mocha', price: 165, desc: 'Espresso, süt ve bitter çikolata', tags: ['sicak', 'sutlu', 'cikolata'], coffee: true, pop: 1, recipe: {bean: 18, milk: 180, choc: 20}},
  {id: 's1', cat: 'soguk', name: 'Iced Latte', price: 165, desc: 'Buz, espresso, soğuk süt', tags: ['soguk', 'sutlu', 'hafif'], coffee: true, pop: 3, recipe: {bean: 18, milk: 200}},
  {id: 's2', cat: 'soguk', name: 'Cold Brew', price: 160, desc: '16 saat soğuk demleme', tags: ['soguk', 'yogun'], coffee: true, pop: 1, recipe: {bean: 25}},
  {id: 's3', cat: 'soguk', name: 'Ev Yapımı Limonata', price: 130, desc: 'Taze sıkım, naneli', tags: ['soguk', 'meyveli', 'kafeinsiz', 'hafif'], pop: 2, recipe: {}},
  {id: 's4', cat: 'soguk', name: 'Çilekli Milkshake', price: 175, desc: 'Dondurma ve taze çilek', tags: ['soguk', 'meyveli', 'kafeinsiz', 'sutlu'], pop: 1, recipe: {milk: 250}},
  {id: 't1', cat: 'tatli', name: 'San Sebastian', price: 220, desc: 'Akışkan iç, karamelize üst', tags: ['yogun', 'sutlu'], pop: 3, recipe: {}},
  {id: 't2', cat: 'tatli', name: 'Brownie', price: 160, desc: 'Sıcak servis, bitter çikolata', tags: ['cikolata', 'yogun'], pop: 2, recipe: {choc: 40}},
  {id: 't3', cat: 'tatli', name: 'Tiramisu', price: 210, desc: 'Mascarpone, espressoya batırılmış kedidili', tags: ['sutlu'], pop: 1, recipe: {bean: 5}},
  {id: 't4', cat: 'tatli', name: 'Limonlu Cheesecake', price: 200, desc: 'Hafif, ekşimsi limon kreması', tags: ['hafif', 'meyveli'], pop: 2, recipe: {}},
  {id: 't5', cat: 'tatli', name: 'Meyveli Tart', price: 180, desc: 'Mevsim meyveleri, vanilyalı krema', tags: ['hafif', 'meyveli'], pop: 1, recipe: {}},
  {id: 'y1', cat: 'yiyecek', name: 'Tereyağlı Kruvasan', price: 140, desc: 'Her sabah taze', tags: ['hafif'], pop: 2, recipe: {}},
  {id: 'y2', cat: 'yiyecek', name: 'Kaşarlı Tost', price: 190, desc: 'Ekşi maya ekmek, eski kaşar', tags: ['tok'], pop: 2, recipe: {}},
  {id: 'y3', cat: 'yiyecek', name: 'Avokadolu Bowl', price: 260, desc: 'Kinoa, avokado, haşlanmış yumurta', tags: ['tok', 'hafif'], pop: 1, recipe: {}},
  {id: 'y4', cat: 'yiyecek', name: 'Füme Etli Sandviç', price: 240, desc: 'Füme et, cheddar, turşu', tags: ['tok'], pop: 1, recipe: {}}
];
const TAGS = ['hafif', 'sicak', 'soguk', 'cikolata', 'meyveli', 'kafeinsiz', 'yogun', 'sutlu', 'tok'];

function defaultData() {
  return {
    version: 1,
    cafe: {name: process.env.CAFE_NAME || 'ILNA Kafe', tagline: 'Kahve · Tatlı · Oyun', branch: process.env.BRANCH || 'sube1', logo: null},
    theme: {preset: 'matcha', ...pick(PRESETS.matcha, [...COLOR_KEYS, 'fontD', 'fontB']), allowGuest: true},
    cats: [{id: 'kahve', name: 'Kahveler'}, {id: 'soguk', name: 'Soğuk İçecekler'}, {id: 'tatli', name: 'Tatlılar'}, {id: 'yiyecek', name: 'Yiyecekler'}],
    products: PRODUCTS.map(p => ({...p, stock: true, img: null})),
    tables: 12,
    orderSeq: 0,
    orders: [],
    calls: [],
    wheel: {enabled: true, minAmount: 300, slices: [
      {label: '%10 indirim', type: 'pct', value: 10}, {label: '25 ₺ indirim', type: 'tl', value: 25},
      {label: '%5 indirim', type: 'pct', value: 5}, {label: 'Pas', type: 'none', value: 0},
      {label: '%15 indirim', type: 'pct', value: 15}, {label: '50 ₺ indirim', type: 'tl', value: 50}]},
    loyalty: {enabled: true, target: 5, members: {}},
    devices: {}
  };
}

/* ---------------- Yardımcılar ---------------- */
function pick(o, keys) { const r = {}; keys.forEach(k => { if (k in o) r[k] = o[k]; }); return r; }
const uid = () => crypto.randomBytes(6).toString('hex');
const clampInt = (v, min, max, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
const str = (v, max = 120) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const isColor = v => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const isImg = v => v === null || (typeof v === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 700000);
const maskPhone = p => p ? `0${p.slice(0, 3)} *** ** ${p.slice(8)}` : '';
const httpError = (status, msg) => Object.assign(new Error(msg), {status});
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/* ---------------- Veri saklama ---------------- */
let db;
function load() {
  fs.mkdirSync(DATA_DIR, {recursive: true});
  if (fs.existsSync(DB_FILE)) {
    try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch (e) {
      const bad = DB_FILE + '.bozuk-' + Date.now();
      fs.copyFileSync(DB_FILE, bad);
      console.error(`Veritabanı okunamadı, yedeği ${bad} olarak saklandı. Boş veritabanıyla başlanıyor.`);
      db = defaultData();
    }
  } else {
    db = defaultData();
    if (SEED_DEMO) seedDemo();
  }
  // eksik alanları tamamla (sürüm geçişleri için)
  const def = defaultData();
  for (const k of Object.keys(def)) if (db[k] === undefined) db[k] = def[k];
  prune();
  saveNow();
}
let saveTimer = null;
function saveNow() {
  clearTimeout(saveTimer); saveTimer = null;
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}
function save() { if (!saveTimer) saveTimer = setTimeout(() => { try { saveNow(); } catch (e) { console.error('Kayıt hatası:', e); } }, 250); }
function prune() {
  const now = Date.now();
  db.orders = db.orders.filter(o => now - o.t < 400 * 864e5);          // 400 günden eski siparişler silinir
  db.calls = db.calls.filter(c => !c.done || now - c.t < 864e5);        // kapanmış çağrılar 1 gün tutulur
  for (const [id, d] of Object.entries(db.devices)) if (now - (d.seen || d.t || 0) > 120 * 864e5) delete db.devices[id];
}
function seedDemo() {
  // Raporlar ilk günden dolu görünsün diye son 28 günlük örnek siparişler üretir.
  const r = rng(42);
  const base = [14500, 8200, 8600, 9000, 9800, 12500, 16000];
  const mix = {k1: 6, k2: 14, k3: 8, k4: 7, k5: 5, k6: 6, s1: 11, s2: 6, s3: 5, s4: 3, t1: 8, t2: 4, t3: 4, t4: 3, t5: 2, y1: 4, y2: 3, y3: 2, y4: 2};
  const hourW = {8: 3, 9: 6, 10: 7, 11: 6, 12: 7, 13: 10, 14: 9, 15: 7, 16: 6, 17: 7, 18: 8, 19: 9, 20: 10, 21: 9, 22: 7, 23: 4};
  const ids = Object.keys(mix), msum = ids.reduce((a, k) => a + mix[k], 0);
  const hours = Object.keys(hourW).map(Number), hsum = hours.reduce((a, h) => a + hourW[h], 0);
  const pickW = (keys, w, sum) => { let x = r() * sum; for (const k of keys) { x -= w[k]; if (x <= 0) return k; } return keys[keys.length - 1]; };
  const today = startOfToday();
  for (let i = 28; i >= 1; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const target = base[d.getDay()] * (0.88 + r() * 0.24) * (1 + (28 - i) * 0.004);
    let rev = 0;
    while (rev < target) {
      const n = 1 + Math.floor(r() * 3), items = [];
      for (let j = 0; j < n; j++) {
        const pid = pickW(ids, mix, msum); const p = db.products.find(x => x.id === pid);
        const ex = items.find(x => x.pid === p.id); if (ex) ex.qty++; else items.push({pid: p.id, name: p.name, price: p.price, qty: 1});
      }
      const total = items.reduce((a, it) => a + it.price * it.qty, 0); rev += total;
      const h = Number(pickW(hours, hourW, hsum)); const t = new Date(d); t.setHours(h, Math.floor(r() * 60), 0, 0);
      db.orders.push({id: uid(), no: ++db.orderSeq, table: 1 + Math.floor(r() * db.tables), items, note: '', subtotal: total, discount: 0, discountLabel: '', total, phone: '', status: 'teslim', paid: true, t: t.getTime(), demo: true});
    }
  }
  console.log(`Örnek veri: ${db.orders.length} geçmiş sipariş oluşturuldu.`);
}

/* ---------------- Canlı bildirim (SSE) ---------------- */
const clients = new Set();
function notify(kind, table = null) {
  const msg = `event: change\ndata: ${JSON.stringify({kind, table})}\n\n`;
  for (const c of clients) {
    if (c.admin || kind === 'menu' || c.table === table || c.table === null) c.res.write(msg);
  }
}
setInterval(() => { for (const c of clients) c.res.write(': nabız\n\n'); }, 25000).unref();

/* ---------------- Çerez, oturum, hız sınırı ---------------- */
function cookies(req) {
  const o = {};
  (req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) try { o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch (e) {} });
  return o;
}
function setCookie(req, res, name, val, maxAge) {
  res.append('Set-Cookie', `${name}=${encodeURIComponent(val)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; HttpOnly${req.secure ? '; Secure' : ''}`);
}
const sign = exp => crypto.createHmac('sha256', SESSION_SECRET).update('admin.' + exp).digest('hex');
function isAdmin(req) {
  const t = cookies(req).ilna_admin; if (!t) return false;
  const [exp, sig] = t.split('.'); if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now(); const a = (hits.get(key) || []).filter(t => now - t < windowMs);
  a.push(now); hits.set(key, a); return a.length > max;
}
setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.some(t => now - t < 15 * 60000)) hits.delete(k); }, 60000).unref();

function device(req, res) {
  let id = cookies(req).ilna_dev;
  if (!id || !/^[a-f0-9]{24}$/.test(id)) { id = crypto.randomBytes(12).toString('hex'); setCookie(req, res, 'ilna_dev', id, 31536000); }
  if (!db.devices[id]) { db.devices[id] = {spins: db.wheel.enabled ? 1 : 0, coupon: null, phone: '', t: Date.now()}; save(); }
  db.devices[id].seen = Date.now();
  return db.devices[id];
}
const validTable = v => { const n = Math.round(Number(v)); return Number.isInteger(n) && n >= 1 && n <= db.tables ? n : null; };

/* ---------------- Görünümler ---------------- */
function meView(dev) {
  return {spins: dev.spins, coupon: dev.coupon, hasPhone: !!dev.phone, phone: maskPhone(dev.phone), stamps: dev.phone ? (db.loyalty.members[dev.phone] || 0) : 0};
}
function publicView(table, dev) {
  return {
    presets: PRESETS,
    cafe: db.cafe, theme: db.theme, cats: db.cats, tables: db.tables,
    products: db.products.map(({recipe, ...p}) => p),
    wheel: {enabled: db.wheel.enabled, minAmount: db.wheel.minAmount, slices: db.wheel.slices.map(s => ({label: s.label, type: s.type}))},
    loyalty: {enabled: db.loyalty.enabled, target: db.loyalty.target},
    me: meView(dev),
    table,
    tableOrders: table ? db.orders.filter(o => o.table === table && !o.paid).map(o => pick(o, ['id', 'no', 'items', 'subtotal', 'discount', 'discountLabel', 'total', 'status', 't'])) : [],
    pending: table ? db.calls.filter(c => !c.done && c.table === table).map(c => c.type) : []
  };
}
function adminView() {
  const t0 = startOfToday();
  const today = db.orders.filter(o => o.t >= t0);
  const live = db.orders.filter(o => o.t >= t0 || !o.paid || o.status !== 'teslim');
  return {
    presets: PRESETS, fonts: FONTS, tags: TAGS,
    cafe: db.cafe, theme: db.theme, cats: db.cats, products: db.products, tables: db.tables,
    wheel: db.wheel,
    loyalty: {enabled: db.loyalty.enabled, target: db.loyalty.target, members: Object.entries(db.loyalty.members).map(([p, s]) => ({phone: maskPhone(p), stamps: s})).sort((a, b) => b.stamps - a.stamps).slice(0, 200), memberCount: Object.keys(db.loyalty.members).length},
    orders: live,
    calls: db.calls.filter(c => !c.done),
    today: {revenue: today.reduce((a, o) => a + o.total, 0), count: today.length},
    openTables: [...new Set(db.orders.filter(o => !o.paid).map(o => o.table))].length
  };
}

/* ---------------- Fiyatlama ---------------- */
function priceCart(dev, rawItems, useReward) {
  if (!Array.isArray(rawItems) || !rawItems.length || rawItems.length > 40) throw httpError(400, 'Sepetin boş.');
  const lines = [];
  for (const it of rawItems) {
    const p = db.products.find(x => x.id === String(it && it.pid));
    if (!p) throw httpError(400, 'Sepette menüden kaldırılmış bir ürün var. Sayfayı yenileyip tekrar dene.');
    if (!p.stock) throw httpError(400, `${p.name} şu an tükendi. Sepetten çıkarıp tekrar dene.`);
    const qty = clampInt(it.qty, 0, 20, 0); if (!qty) continue;
    const ex = lines.find(l => l.pid === p.id);
    if (ex) ex.qty = Math.min(20, ex.qty + qty); else lines.push({pid: p.id, name: p.name, price: p.price, qty, coffee: !!p.coffee});
  }
  if (!lines.length) throw httpError(400, 'Sepetin boş.');
  const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);
  let discount = 0; const labels = []; let couponUsed = false, rewardUsed = false;
  const c = dev.coupon;
  if (c && db.wheel.enabled) {
    const d = c.type === 'pct' ? Math.round(subtotal * c.value / 100) : c.type === 'tl' ? Math.min(c.value, subtotal) : 0;
    if (d > 0) { discount += d; labels.push('Çark: ' + c.label); couponUsed = true; }
  }
  const coffees = lines.filter(l => l.coffee);
  const coffeeQty = coffees.reduce((a, l) => a + l.qty, 0);
  const stamps = dev.phone ? (db.loyalty.members[dev.phone] || 0) : 0;
  if (useReward && db.loyalty.enabled && dev.phone && stamps >= db.loyalty.target && coffees.length) {
    discount += Math.min(...coffees.map(l => l.price)); labels.push('Sadakat: 1 kahve bedava'); rewardUsed = true;
  }
  discount = Math.min(discount, subtotal);
  return {lines, subtotal, discount, labels, total: subtotal - discount, couponUsed, rewardUsed, coffeeQty};
}

/* ---------------- Raporlar ---------------- */
function reports() {
  const t0 = startOfToday();
  const days = [];
  for (let i = 28; i >= 1; i--) { const d = new Date(t0); d.setDate(d.getDate() - i); days.push({start: d.getTime(), dow: d.getDay(), label: d.toLocaleDateString('tr-TR', {day: 'numeric', month: 'short'}), rev: 0, orders: 0}); }
  const from = days[0].start, last7From = days[21].start;
  const hourly = new Array(24).fill(0);
  const units = {}, used = {bean: 0, milk: 0, choc: 0};
  let last7Rev = 0;
  for (const o of db.orders) {
    if (o.t < from || o.t >= t0) continue;
    const di = Math.min(27, Math.floor((o.t - from) / 864e5));
    // yaz saati kaymalarına karşı doğru güne yerleştir
    let k = di; while (k < 27 && o.t >= days[k + 1].start) k++; while (k > 0 && o.t < days[k].start) k--;
    days[k].rev += o.total; days[k].orders++;
    hourly[new Date(o.t).getHours()]++;
    for (const it of o.items) {
      units[it.pid] = units[it.pid] || {name: it.name, qty: 0}; units[it.pid].qty += it.qty;
      if (o.t >= last7From) { const p = db.products.find(x => x.id === it.pid); const r = (p && p.recipe) || {}; for (const key in used) used[key] += (r[key] || 0) * it.qty; }
    }
    if (o.t >= last7From) last7Rev += o.total;
  }
  const avg = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const daysWithData = days.filter(d => d.orders > 0).length;
  let forecast = null, trend = 0;
  if (daysWithData >= 14) {
    const l7 = avg(days.slice(-7).map(d => d.rev)), p7 = avg(days.slice(-14, -7).map(d => d.rev));
    trend = p7 > 0 ? Math.max(-0.1, Math.min(0.1, l7 / p7 - 1)) : 0;
    forecast = [];
    for (let k = 0; k < 7; k++) {
      const d = new Date(t0); d.setDate(d.getDate() + k + 1);
      const same = days.filter(x => x.dow === d.getDay()).map(x => x.rev);
      forecast.push({label: d.toLocaleDateString('tr-TR', {day: 'numeric', month: 'short'}), weekday: d.toLocaleDateString('tr-TR', {weekday: 'long'}), rev: Math.round(avg(same) * (1 + trend) / 10) * 10});
    }
  }
  const fcSum = forecast ? forecast.reduce((a, f) => a + f.rev, 0) : null;
  const ratio = fcSum && last7Rev ? fcSum / last7Rev : null;
  const hours = []; for (let h = 7; h <= 23; h++) hours.push({h, avg: daysWithData ? hourly[h] / daysWithData : 0});
  const stock = [['Kahve çekirdeği', 'bean', 'kg'], ['Süt', 'milk', 'L'], ['Bitter çikolata', 'choc', 'kg']].map(([name, k, unit]) => {
    const past = used[k] / 1000; return {name, unit, past, next: ratio ? past * ratio : null};
  });
  const t0Orders = db.orders.filter(o => o.t >= t0);
  return {
    days: days.map(d => ({label: d.label, rev: d.rev, orders: d.orders})),
    daysWithData, forecast, trend, last7Rev, fcSum,
    hours,
    top: Object.entries(units).map(([pid, u]) => ({pid, ...u})).sort((a, b) => b.qty - a.qty).slice(0, 8),
    stock,
    today: {revenue: t0Orders.reduce((a, o) => a + o.total, 0), count: t0Orders.length},
    hasDemo: db.orders.some(o => o.demo)
  };
}

/* ---------------- Uygulama ---------------- */
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN'});
  next();
});
app.use(express.json({limit: '2mb'}));
// Basit CSRF önlemi: veri değiştiren isteklerde Origin başka bir siteden geliyorsa reddet.
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') return next();
  const origin = req.headers.origin;
  if (origin) { try { if (new URL(origin).host !== req.headers.host) return res.status(403).json({error: 'Bu istek başka bir siteden geldiği için reddedildi.'}); } catch (e) { return res.status(403).json({error: 'Geçersiz istek.'}); } }
  next();
});

const PUB = path.join(__dirname, 'public');
app.use('/static', express.static(PUB, {index: false, maxAge: '1h'}));
const sendPage = name => (req, res) => { res.set('Cache-Control', 'no-cache'); res.sendFile(path.join(PUB, name)); };

app.get('/', sendPage('menu.html'));
app.get(/^\/cafe\/([\w-]+)\/masa(\d+)\/?$/, (req, res, next) => {
  if (req.params[0] !== db.cafe.branch) return res.status(404).send('Bu şube bulunamadı.');
  sendPage('menu.html')(req, res, next);
});
app.get('/panel', sendPage('panel.html'));
app.get('/healthz', (req, res) => res.json({ok: true}));

/* ----- müşteri API ----- */
app.get('/api/public', (req, res) => {
  const dev = device(req, res);
  res.json(publicView(req.query.table ? validTable(req.query.table) : null, dev));
});

app.get('/api/events', (req, res) => {
  const admin = req.query.role === 'admin';
  if (admin && !isAdmin(req)) return res.status(401).end();
  if (clients.size > 500) return res.status(503).end();
  res.set({'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no'});
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  const c = {res, admin, table: req.query.table ? validTable(req.query.table) : null};
  clients.add(c);
  req.on('close', () => clients.delete(c));
});

app.post('/api/orders', (req, res) => {
  if (limited('o:' + req.ip, 8, 60000)) throw httpError(429, 'Çok sık sipariş gönderildi. Bir dakika sonra tekrar dene.');
  const table = validTable(req.body.table);
  if (!table) throw httpError(400, 'Masa bulunamadı. Masadaki QR kodu tekrar okut.');
  const dev = device(req, res);
  const q = priceCart(dev, req.body.items, !!req.body.useReward);
  const order = {id: uid(), no: ++db.orderSeq, table, items: q.lines.map(({coffee, ...l}) => l), note: str(req.body.note, 200), subtotal: q.subtotal, discount: q.discount, discountLabel: q.labels.join(' + '), total: q.total, phone: dev.phone || '', status: 'yeni', paid: false, t: Date.now()};
  db.orders.push(order);
  if (q.couponUsed) dev.coupon = null;
  let earned = 0, gotSpin = false;
  if (db.loyalty.enabled && dev.phone) {
    let st = db.loyalty.members[dev.phone] || 0;
    if (q.rewardUsed) st -= db.loyalty.target;
    earned = Math.max(0, q.coffeeQty - (q.rewardUsed ? 1 : 0));
    db.loyalty.members[dev.phone] = st + earned;
  }
  if (db.wheel.enabled && q.total >= db.wheel.minAmount) { dev.spins = Math.min(dev.spins + 1, 10); gotSpin = true; }
  save(); notify('order', table);
  res.json({order: {id: order.id, no: order.no, total: order.total}, earned, gotSpin, me: meView(dev)});
});

app.post('/api/calls', (req, res) => {
  if (limited('c:' + req.ip, 10, 60000)) throw httpError(429, 'Çok sık istek gönderildi. Biraz bekleyip tekrar dene.');
  const table = validTable(req.body.table);
  if (!table) throw httpError(400, 'Masa bulunamadı. Masadaki QR kodu tekrar okut.');
  const type = req.body.type === 'hesap' ? 'hesap' : 'garson';
  if (db.calls.some(c => !c.done && c.table === table && c.type === type)) return res.json({ok: true, duplicate: true});
  const call = {id: uid(), table, type, t: Date.now(), done: false};
  if (type === 'hesap') {
    call.pay = req.body.pay === 'Nakit' ? 'Nakit' : 'Kart';
    call.total = db.orders.filter(o => o.table === table && !o.paid).reduce((a, o) => a + o.total, 0);
  }
  db.calls.push(call); save(); notify('call', table);
  res.json({ok: true});
});

app.post('/api/spin', (req, res) => {
  const dev = device(req, res);
  if (!db.wheel.enabled) throw httpError(400, 'Çark şu an kapalı.');
  if (dev.spins <= 0) throw httpError(400, 'Çevirme hakkın kalmadı.');
  const i = crypto.randomInt(db.wheel.slices.length);
  const s = db.wheel.slices[i];
  dev.spins--;
  if (s.type !== 'none') dev.coupon = {label: s.label, type: s.type, value: s.value};
  save();
  res.json({index: i, slice: {label: s.label, type: s.type}, me: meView(dev)});
});

app.post('/api/loyalty', (req, res) => {
  if (limited('l:' + req.ip, 10, 60000)) throw httpError(429, 'Çok sık deneme yapıldı. Bir dakika sonra tekrar dene.');
  const dev = device(req, res);
  const d = String(req.body.phone || '').replace(/\D/g, '').replace(/^90(?=5\d{9}$)/, '').replace(/^0/, '');
  if (!/^5\d{9}$/.test(d)) throw httpError(400, 'Telefonu 05XX XXX XX XX biçiminde yaz.');
  if (!db.loyalty.enabled) throw httpError(400, 'Sadakat programı şu an kapalı.');
  if (!(d in db.loyalty.members)) db.loyalty.members[d] = 0;
  dev.phone = d; save();
  res.json({me: meView(dev)});
});
app.delete('/api/loyalty', (req, res) => { const dev = device(req, res); dev.phone = ''; save(); res.json({me: meView(dev)}); });

/* ----- giriş ----- */
app.post('/api/login', (req, res) => {
  if (limited('login:' + req.ip, 8, 15 * 60000)) throw httpError(429, 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.');
  const a = crypto.createHash('sha256').update(String(req.body.password || '')).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  if (!crypto.timingSafeEqual(a, b)) throw httpError(401, 'Şifre yanlış.');
  const exp = Date.now() + 12 * 3600e3;
  setCookie(req, res, 'ilna_admin', exp + '.' + sign(exp), 12 * 3600);
  res.json({ok: true});
});
app.post('/api/logout', (req, res) => { setCookie(req, res, 'ilna_admin', '', 0); res.json({ok: true}); });

/* ----- işletme API ----- */
const admin = express.Router();
admin.use((req, res, next) => isAdmin(req) ? next() : res.status(401).json({error: 'Oturumunuz kapandı. Tekrar giriş yapın.'}));
const done = (res, kind = 'admin', table = null) => { save(); notify(kind, table); res.json(adminView()); };

admin.get('/state', (req, res) => res.json(adminView()));
admin.get('/reports', (req, res) => res.json(reports()));
admin.get('/export', (req, res) => {
  res.set('Content-Disposition', `attachment; filename="ilna-yedek-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(db);
});

admin.put('/settings', (req, res) => {
  const b = req.body || {};
  if (b.cafe) {
    if ('name' in b.cafe) db.cafe.name = str(b.cafe.name, 40) || db.cafe.name;
    if ('tagline' in b.cafe) db.cafe.tagline = str(b.cafe.tagline, 60);
    if ('logo' in b.cafe) { if (!isImg(b.cafe.logo)) throw httpError(400, 'Logo PNG, JPG veya WEBP olmalı ve 500 KB\'tan küçük olmalı.'); db.cafe.logo = b.cafe.logo; }
  }
  if (b.theme) {
    if (b.theme.preset && PRESETS[b.theme.preset]) Object.assign(db.theme, pick(PRESETS[b.theme.preset], [...COLOR_KEYS, 'fontD', 'fontB']), {preset: b.theme.preset});
    for (const k of COLOR_KEYS) if (isColor(b.theme[k])) { db.theme[k] = b.theme[k]; if (!b.theme.preset) db.theme.preset = 'ozel'; }
    for (const k of ['fontD', 'fontB']) if (FONTS.includes(b.theme[k])) { db.theme[k] = b.theme[k]; if (!b.theme.preset) db.theme.preset = 'ozel'; }
    if ('allowGuest' in b.theme) db.theme.allowGuest = !!b.theme.allowGuest;
  }
  if (b.wheel) {
    if ('enabled' in b.wheel) db.wheel.enabled = !!b.wheel.enabled;
    if ('minAmount' in b.wheel) db.wheel.minAmount = clampInt(b.wheel.minAmount, 0, 100000, db.wheel.minAmount);
    if (Array.isArray(b.wheel.slices)) {
      if (b.wheel.slices.length < 2 || b.wheel.slices.length > 8) throw httpError(400, 'Çarkta 2 ile 8 arasında dilim olmalı.');
      db.wheel.slices = b.wheel.slices.map(s => {
        const type = ['pct', 'tl', 'none'].includes(s.type) ? s.type : 'none';
        const value = type === 'pct' ? clampInt(s.value, 1, 100, 10) : type === 'tl' ? clampInt(s.value, 1, 10000, 25) : 0;
        return {label: str(s.label, 18) || (type === 'none' ? 'Pas' : type === 'pct' ? `%${value} indirim` : `${value} ₺ indirim`), type, value};
      });
    }
  }
  if (b.loyalty) {
    if ('enabled' in b.loyalty) db.loyalty.enabled = !!b.loyalty.enabled;
    if ('target' in b.loyalty) db.loyalty.target = clampInt(b.loyalty.target, 2, 15, db.loyalty.target);
  }
  if ('tables' in b) db.tables = clampInt(b.tables, 1, 200, db.tables);
  done(res, 'menu');
});

function applyProduct(p, b) {
  if ('name' in b) { const v = str(b.name, 60); if (!v) throw httpError(400, 'Ürün adı boş olamaz.'); p.name = v; }
  if ('desc' in b) p.desc = str(b.desc, 140);
  if ('price' in b) p.price = clampInt(b.price, 0, 100000, p.price || 0);
  if ('stock' in b) p.stock = !!b.stock;
  if ('coffee' in b) p.coffee = !!b.coffee;
  if ('cat' in b) { if (!db.cats.some(c => c.id === b.cat)) throw httpError(400, 'Kategori bulunamadı.'); p.cat = b.cat; }
  if ('img' in b) { if (!isImg(b.img)) throw httpError(400, 'Görsel PNG, JPG veya WEBP olmalı ve 500 KB\'tan küçük olmalı.'); p.img = b.img; }
  if ('tags' in b && Array.isArray(b.tags)) p.tags = b.tags.filter(t => TAGS.includes(t));
  if (b.recipe && typeof b.recipe === 'object') { p.recipe = p.recipe || {}; for (const k of ['bean', 'milk', 'choc']) if (k in b.recipe) p.recipe[k] = clampInt(b.recipe[k], 0, 2000, 0); }
}
admin.post('/products', (req, res) => {
  const p = {id: 'p' + uid(), cat: db.cats[0] && db.cats[0].id, name: '', desc: '', price: 0, tags: [], coffee: false, pop: 0, recipe: {}, stock: true, img: null};
  applyProduct(p, req.body || {}); if (!p.name) throw httpError(400, 'Ürün adı boş olamaz.');
  db.products.push(p); done(res, 'menu');
});
admin.patch('/products/:id', (req, res) => {
  const p = db.products.find(x => x.id === req.params.id); if (!p) throw httpError(404, 'Ürün bulunamadı.');
  applyProduct(p, req.body || {}); done(res, 'menu');
});
admin.delete('/products/:id', (req, res) => { db.products = db.products.filter(x => x.id !== req.params.id); done(res, 'menu'); });

admin.post('/cats', (req, res) => {
  const name = str(req.body && req.body.name, 40); if (!name) throw httpError(400, 'Kategori adı boş olamaz.');
  db.cats.push({id: 'c' + uid(), name}); done(res, 'menu');
});
admin.patch('/cats/:id', (req, res) => {
  const c = db.cats.find(x => x.id === req.params.id); if (!c) throw httpError(404, 'Kategori bulunamadı.');
  const name = str(req.body && req.body.name, 40); if (name) c.name = name; done(res, 'menu');
});
admin.post('/cats/:id/move', (req, res) => {
  const i = db.cats.findIndex(x => x.id === req.params.id); const j = i + (req.body.dir === 'up' ? -1 : 1);
  if (i >= 0 && j >= 0 && j < db.cats.length) [db.cats[i], db.cats[j]] = [db.cats[j], db.cats[i]];
  done(res, 'menu');
});
admin.delete('/cats/:id', (req, res) => {
  if (db.products.some(p => p.cat === req.params.id)) throw httpError(400, 'Önce bu kategorideki ürünleri silin veya taşıyın.');
  db.cats = db.cats.filter(x => x.id !== req.params.id); done(res, 'menu');
});

admin.post('/orders/:id/advance', (req, res) => {
  const o = db.orders.find(x => x.id === req.params.id); if (!o) throw httpError(404, 'Sipariş bulunamadı.');
  o.status = o.status === 'yeni' ? 'hazirlaniyor' : 'teslim'; o['t_' + o.status] = Date.now();
  done(res, 'order', o.table);
});
admin.post('/orders/:id/cancel', (req, res) => {
  const o = db.orders.find(x => x.id === req.params.id); if (!o) throw httpError(404, 'Sipariş bulunamadı.');
  db.orders = db.orders.filter(x => x !== o); done(res, 'order', o.table);
});
admin.post('/calls/:id/done', (req, res) => {
  const c = db.calls.find(x => x.id === req.params.id); if (c) c.done = true; done(res, 'call', c && c.table);
});
admin.post('/tables/:n/close', (req, res) => {
  const n = validTable(req.params.n); if (!n) throw httpError(404, 'Masa bulunamadı.');
  db.orders.filter(o => o.table === n && !o.paid).forEach(o => { o.paid = true; o.t_paid = Date.now(); if (o.status !== 'teslim') o.status = 'teslim'; });
  db.calls.filter(c => c.table === n && !c.done).forEach(c => { c.done = true; });
  done(res, 'order', n);
});
admin.post('/test-order', (req, res) => {
  const avail = db.products.filter(p => p.stock); if (!avail.length) throw httpError(400, 'Stokta ürün yok.');
  const items = [];
  for (let i = 0; i < 1 + crypto.randomInt(3); i++) { const p = avail[crypto.randomInt(avail.length)]; const ex = items.find(x => x.pid === p.id); if (ex) ex.qty++; else items.push({pid: p.id, name: p.name, price: p.price, qty: 1}); }
  const total = items.reduce((a, it) => a + it.price * it.qty, 0); const table = 1 + crypto.randomInt(db.tables);
  db.orders.push({id: uid(), no: ++db.orderSeq, table, items, note: 'Deneme siparişi', subtotal: total, discount: 0, discountLabel: '', total, phone: '', status: 'yeni', paid: false, t: Date.now()});
  done(res, 'order', table);
});
app.use('/api/admin', admin);

/* ----- hata yakalama ----- */
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({error: 'Gönderilen dosya çok büyük.'});
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({error: err.status ? err.message : 'Sunucuda bir hata oluştu. Tekrar deneyin.'});
});

load();
setInterval(() => { prune(); save(); }, 6 * 3600e3).unref();
const server = app.listen(PORT, () => console.log(`ILNA Kafe QR çalışıyor: http://localhost:${PORT}  ·  panel: /panel  ·  örnek masa: /cafe/${db.cafe.branch}/masa1`));
const shutdown = () => { try { saveNow(); } catch (e) {} server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); for (const c of clients) c.res.end(); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
