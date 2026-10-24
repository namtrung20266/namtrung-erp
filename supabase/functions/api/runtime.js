// =====================================================================
// NAM TRUNG ERP — Lớp chạy code nghiệp vụ (viết theo kiểu Apps Script) trên Supabase (Deno)
// Giả lập dịch vụ Google (Sheet, Cache, Properties, Drive, Utilities...) trên dữ liệu
// nạp từ Postgres; ghi lại thay đổi để lưu về Postgres sau mỗi lần gọi.
// =====================================================================
const H7 = 7 * 3600 * 1000;
const RealDate = Date;
/** Giờ Việt Nam: "bây giờ" trong code nghiệp vụ = giờ VN (lưu dạng giờ tường) */
export class VNDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(RealDate.now() + H7); else super(...a); }
  static now() { return RealDate.now() + H7; }
}

/* ---------------- băm & base64 (đồng bộ) ---------------- */
function utf8(str) { return Array.from(new TextEncoder().encode(String(str))); }
function toU8(x) { return Array.isArray(x) ? x.map(b => (b + 256) % 256) : utf8(x); }
function signed(arr) { return arr.map(b => (b > 127 ? b - 256 : b)); }
function sha256(bytes) {
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  let h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const m = bytes.slice(); const l = m.length * 8; m.push(0x80); while (m.length % 64 !== 56) m.push(0);
  for (let i = 7; i >= 0; i--) m.push(Math.floor(l / Math.pow(2, i * 8)) & 255);
  const w = new Array(64), r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < m.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = (m[o + 4 * i] << 24) | (m[o + 4 * i + 1] << 16) | (m[o + 4 * i + 2] << 8) | m[o + 4 * i + 3];
    for (let i = 16; i < 64; i++) { const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0, t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h = [h[0] + a, h[1] + b, h[2] + c, h[3] + d, h[4] + e, h[5] + f, h[6] + g, h[7] + hh].map(x => x | 0);
  }
  const out = []; h.forEach(x => out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255)); return out;
}
function sha1(bytes) {
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const m = bytes.slice(); const l = m.length * 8; m.push(0x80); while (m.length % 64 !== 56) m.push(0);
  for (let i = 7; i >= 0; i--) m.push(Math.floor(l / Math.pow(2, i * 8)) & 255);
  const w = new Array(80), rl = (x, n) => (x << n) | (x >>> (32 - n));
  for (let o = 0; o < m.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = (m[o + 4 * i] << 24) | (m[o + 4 * i + 1] << 16) | (m[o + 4 * i + 2] << 8) | m[o + 4 * i + 3];
    for (let i = 16; i < 80; i++) w[i] = rl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      const f = i < 20 ? (b & c) | (~b & d) : i < 40 ? b ^ c ^ d : i < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
      const k = i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const t = (rl(a, 5) + f + e + k + w[i]) | 0; e = d; d = c; c = rl(b, 30); b = a; a = t;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
  }
  const out = []; [h0, h1, h2, h3, h4].forEach(x => out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255)); return out;
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64enc(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 3) { const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2]; const n = (a << 16) | ((b || 0) << 8) | (c || 0); s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (b === undefined ? '=' : B64[(n >> 6) & 63]) + (c === undefined ? '=' : B64[n & 63]); } return s; }
function b64dec(str) { str = String(str).replace(/[^A-Za-z0-9+/]/g, ''); const out = []; for (let i = 0; i < str.length; i += 4) { const n = (B64.indexOf(str[i]) << 18) | (B64.indexOf(str[i + 1]) << 12) | ((Math.max(0, B64.indexOf(str[i + 2])) & 63) << 6) | (Math.max(0, B64.indexOf(str[i + 3])) & 63); out.push((n >> 16) & 255); if (i + 2 < str.length) out.push((n >> 8) & 255); if (i + 3 < str.length) out.push(n & 255); } return out; }
export const hashTools = { sha256: s => sha256(utf8(s)), sha1: s => sha1(utf8(s)) };

/* ---------------- định dạng ngày (giờ tường VN) ---------------- */
function pad(n, k) { return String(n).padStart(k || 2, '0'); }
export function formatDate(d, tz, f) {
  if (!(d instanceof RealDate)) d = new VNDate(d);
  const map = { yyyy: d.getUTCFullYear(), yy: pad(d.getUTCFullYear() % 100), MM: pad(d.getUTCMonth() + 1), dd: pad(d.getUTCDate()), HH: pad(d.getUTCHours()), H: d.getUTCHours(), mm: pad(d.getUTCMinutes()), ss: pad(d.getUTCSeconds()), EEE: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()] };
  let out = '', i = 0;
  while (i < f.length) {
    if (f[i] === "'") { const j = f.indexOf("'", i + 1); out += f.slice(i + 1, j < 0 ? f.length : j); i = j < 0 ? f.length : j + 1; continue; }
    const tok = ['yyyy', 'yy', 'MM', 'dd', 'HH', 'mm', 'ss', 'EEE', 'H'].find(t => f.startsWith(t, i));
    if (tok) { out += map[tok]; i += tok.length; } else { out += f[i]; i++; }
  }
  return out;
}

/* ---------------- mã hóa ô khi lưu Postgres ---------------- */
export function encCell(v) { return v instanceof RealDate ? { $d: v.getTime() } : (v === undefined ? '' : v); }
export function decCell(v) { return v && typeof v === 'object' && '$d' in v ? new VNDate(v.$d) : (v === null || v === undefined ? '' : v); }

/* ---------------- bảng tính ảo ---------------- */
function colNum(L) { let n = 0; for (const ch of L) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
class Range {
  constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr: nr || 1, nc: nc || 1 }); }
  getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh.get(this.r + i, this.c + j)); o.push(row); } return o; }
  getDisplayValues() { return this.getValues().map(r => r.map(v => v instanceof RealDate ? formatDate(v, '', 'dd/MM/yyyy') : String(v))); }
  getValue() { return this.sh.get(this.r, this.c); }
  setValues(v) { v.forEach((row, i) => row.forEach((x, j) => this.sh.set(this.r + i, this.c + j, x))); return this; }
  setValue(x) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh.set(this.r + i, this.c + j, x); return this; }
  setFormula(f) { this.sh.set(this.r, this.c, f); return this; }
  setFormulas(a) { a.forEach((row, i) => row.forEach((f, j) => this.sh.set(this.r + i, this.c + j, f))); return this; }
  clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh.set(this.r + i, this.c + j, ''); return this; }
  clear() { return this.clearContent(); }
  getNumberFormats() { return this.getValues().map(r => r.map(() => 'General')); }
  getRow() { return this.r; } getColumn() { return this.c; } getNumRows() { return this.nr; } getNumColumns() { return this.nc; }
  getSheet() { return this.sh; } getA1Notation() { return 'R' + this.r + 'C' + this.c; }
  createTextFinder(text) {
    const self = this;
    const f = { matchEntireCell() { return f; }, matchCase() { return f; },
      findAll() { const out = []; for (let i = 0; i < self.nr; i++) for (let j = 0; j < self.nc; j++) if (String(self.sh.get(self.r + i, self.c + j)) === String(text)) out.push(new Range(self.sh, self.r + i, self.c + j)); return out; },
      findNext() { return f.findAll()[0] || null; } };
    return f;
  }
}
['setNumberFormat', 'setNumberFormats', 'setFontWeight', 'setFontWeights', 'setBackground', 'setBackgrounds', 'setFontColor', 'setWrap', 'setVerticalAlignment', 'setHorizontalAlignment', 'setNote', 'setDataValidation', 'setFontSize', 'insertCheckboxes', 'setBorder', 'merge', 'activate', 'setFontStyle', 'setFontFamily']
  .forEach(k => Range.prototype[k] = function () { return this; });
class Sheet {
  constructor(name, rows, isNew) { this.name = name; this.d = rows || []; this.dirty = new Set(); this.structural = !!isNew; }
  get(r, c) { const row = this.d[r - 1]; const v = row ? row[c - 1] : undefined; return v === undefined || v === null ? '' : v; }
  set(r, c, v) {
    if (typeof v === 'string' && v[0] === "'") v = v.slice(1);
    while (this.d.length < r) { this.d.push([]); this.dirty.add(this.d.length); }
    const row = this.d[r - 1] || (this.d[r - 1] = []);
    while (row.length < c - 1) row.push('');
    row[c - 1] = v; this.dirty.add(r);
  }
  getName() { return this.name; } setName(n) { this.name = n; this.structural = true; return this; }
  getLastRow() { for (let i = this.d.length; i > 0; i--) if ((this.d[i - 1] || []).some(v => v !== '' && v !== undefined && v !== null)) return i; return 0; }
  getLastColumn() { let m = 0; this.d.forEach(r => (r || []).forEach((v, j) => { if (v !== '' && v !== undefined && v !== null) m = Math.max(m, j + 1); })); return m; }
  getMaxColumns() { return Math.max(26, this.getLastColumn()); } getMaxRows() { return Math.max(1000, this.getLastRow()); }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getRange(a, b, c, d) {
    if (typeof a === 'string') {
      const m = a.replace(/\$/g, '').match(/^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/); if (!m) throw new Error('Ô không hợp lệ ' + a);
      const c1 = colNum(m[1]), r1 = m[2] ? +m[2] : 1, c2 = m[3] ? colNum(m[3]) : c1;
      const r2 = m[3] ? (m[4] ? +m[4] : Math.max(this.getLastRow(), r1)) : (m[2] ? r1 : Math.max(this.getLastRow(), r1));
      return new Range(this, r1, c1, r2 - r1 + 1, c2 - c1 + 1);
    }
    return new Range(this, a, b, c, d);
  }
  appendRow(row) { const n = this.getLastRow() + 1; if (this.d.length > n - 1) this.d.length = n - 1; if (!row.length) this.set(n, 1, ''); row.forEach((v, j) => this.set(n, j + 1, v)); return this; }
  deleteRow(r) { this.d.splice(r - 1, 1); this.structural = true; }
  deleteRows(r, n) { this.d.splice(r - 1, n); this.structural = true; }
  insertRowsAfter(r, n) { this.d.splice(r, 0, ...Array.from({ length: n }, () => [])); this.structural = true; return this; }
  insertRowBefore(r) { this.d.splice(r - 1, 0, []); this.structural = true; return this; }
  clear() { this.d = []; this.structural = true; return this; } clearContents() { return this.clear(); }
  getProtections() { return []; } protect() { const o = { setWarningOnly: () => o, setDescription: () => o }; return o; }
  getSheetId() { return this.name; }
}
['setFrozenRows', 'setFrozenColumns', 'setTabColor', 'setColumnWidth', 'setColumnWidths', 'setRowHeight', 'setRowHeights', 'hideColumns', 'showColumns', 'setConditionalFormatRules', 'insertColumnsAfter', 'autoResizeColumns', 'activate', 'hideSheet', 'showSheet']
  .forEach(k => Sheet.prototype[k] = function () { return this; });
class Book {
  constructor(id, sheets, temp) { this.id = id; this.sheets = sheets || []; this.temp = !!temp; this.removed = []; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(n || ('Sheet' + (this.sheets.length + 1)), [], true); this.sheets.push(s); return s; }
  getSheets() { return this.sheets.slice(); }
  deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); this.removed.push(s.name); }
  getId() { return this.id; } getName() { return this.id; } getUrl() { return ''; }
  setActiveSheet() { } moveActiveSheet() { } setSpreadsheetTimeZone() { } setSpreadsheetLocale() { } getSpreadsheetLocale() { return 'vi_VN'; } setNamedRange() { } addViewer() { } toast() { }
}

/* ---------------- môi trường cho 1 lần gọi ---------------- */
export function makeEnv(snap, opt) {
  opt = opt || {};
  const books = {};
  Object.entries(snap.books || {}).forEach(([bid, sheets]) => {
    books[bid] = new Book(bid, Object.entries(sheets).map(([name, rows]) => new Sheet(name, rows.map(r => (r || []).map(decCell)), false)));
  });
  const props = Object.assign({}, snap.props || {}), propsChanged = {};
  const cache = {}, cacheSet = {}, cacheDel = new Set();
  const nowMs = () => RealDate.now();
  Object.entries(snap.cache || {}).forEach(([k, o]) => { if (!o.exp || o.exp > nowMs()) cache[k] = o; });
  const uploads = [], fetches = [], logs = [];
  const publicUrl = p => (opt.storageBase || '') + p;

  const blob = (bytes, type, name) => ({ bytes: Array.isArray(bytes) ? bytes : utf8(bytes || ''), type: type || 'application/octet-stream', name: name || 'file',
    getBytes() { return signed(this.bytes); }, getDataAsString() { return new TextDecoder().decode(new Uint8Array(this.bytes)); },
    setName(n) { this.name = n; return this; }, getName() { return this.name; }, getContentType() { return this.type; },
    getAs(t) { if (t === 'application/pdf') throw new Error('Bản mới dùng nút "In / Lưu PDF" để lưu báo giá thành PDF.'); return this; } });
  const fileObj = (path, name) => ({ getId: () => path, getUrl: () => publicUrl(path), getName: () => name || String(path).split('/').pop(), setSharing() { return this; }, setTrashed() { }, makeCopy() { return this; }, moveTo() { }, getDateCreated: () => new VNDate(), getBlob() { throw new Error('Không đọc được file trên máy chủ'); } });
  const folder = (path) => ({
    getName: () => path.split('/').pop(), getId: () => path,
    createFolder: n => folder((path ? path + '/' : '') + n),
    getFoldersByName: n => { let used = false; return { hasNext: () => !used, next: () => { used = true; return folder((path ? path + '/' : '') + n); } }; },
    getFiles: () => ({ hasNext: () => false, next: () => null }),
    createFile(b) {
      const safe = String(b.name || 'file').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\-]+/g, '_');
      const p = (path ? path + '/' : '') + crypto.randomUUID().slice(0, 8) + '_' + safe;
      uploads.push({ path: p, bytes: b.bytes, type: b.type }); return fileObj(p, b.name);
    }
  });
  const root = folder('');
  const proxyBuilder = () => new Proxy({}, { get: (t, k) => k === 'build' || k === 'create' ? () => ({}) : () => t });
  const G = {
    Date: VNDate,
    SpreadsheetApp: {
      openById: id => { if (!books[id]) throw new Error('Không mở được dữ liệu ' + id); return books[id]; },
      getActive: () => books.CTRL || new Book('CTRL', [], true), getActiveSpreadsheet: () => books.CTRL || new Book('CTRL', [], true),
      create: n => new Book(n, [new Sheet('Sheet1', [], true)], true), flush() { },
      getUi() { throw new Error('Chỉ chạy từ menu trong file Google Sheet.'); },
      newDataValidation: proxyBuilder, newConditionalFormatRule: proxyBuilder,
      InterpolationType: { NUMBER: 'NUMBER' }, ProtectionType: { SHEET: 'SHEET' }, XFrameOptionsMode: {}
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] === undefined ? null : props[k], setProperty: (k, v) => { props[k] = String(v); propsChanged[k] = String(v); return this; }, deleteProperty: k => { delete props[k]; propsChanged[k] = null; }, getProperties: () => Object.assign({}, props) }) },
    CacheService: { getScriptCache: () => ({
      get: k => cache[k] ? cache[k].v : null,
      put: (k, v, sec) => { const o = { v: String(v), exp: nowMs() + (sec || 600) * 1000 }; cache[k] = o; cacheSet[k] = o; cacheDel.delete(k); },
      remove: k => { delete cache[k]; delete cacheSet[k]; cacheDel.add(k); },
      removeAll: ks => (ks || []).forEach(k => { delete cache[k]; delete cacheSet[k]; cacheDel.add(k); }),
      getAll: ks => { const o = {}; ks.forEach(k => { if (cache[k]) o[k] = cache[k].v; }); return o; },
      putAll: (o, sec) => Object.keys(o).forEach(k => G.CacheService.getScriptCache().put(k, o[k], sec)) }) },
    LockService: { getScriptLock: () => ({ waitLock() { }, tryLock() { return true; }, releaseLock() { }, hasLock() { return true; } }) },
    Utilities: {
      formatDate, getUuid: () => crypto.randomUUID(), sleep() { },
      computeDigest: (alg, v) => signed(alg === 'SHA_1' ? sha1(toU8(v)) : sha256(toU8(v))),
      base64Encode: v => b64enc(toU8(v)), base64Decode: s => signed(b64dec(s)), base64EncodeWebSafe: v => b64enc(toU8(v)).replace(/\+/g, '-').replace(/\//g, '_'),
      newBlob: (b, t, n) => blob(Array.isArray(b) ? b.map(x => (x + 256) % 256) : b, t, n),
      DigestAlgorithm: { SHA_256: 'SHA_256', SHA_1: 'SHA_1', MD5: 'MD5' }, Charset: { UTF_8: 'UTF_8' }
    },
    DriveApp: { Access: { ANYONE_WITH_LINK: 1 }, Permission: { VIEW: 1 }, getFoldersByName: n => root.getFoldersByName(n), createFolder: n => root.createFolder(n), getFileById: id => fileObj(id), getRootFolder: () => root },
    HtmlService: { createHtmlOutput: h => ({ getContent: () => String(h || ''), getBlob: () => blob(String(h || ''), 'text/html', 'x.html'), setTitle() { return this; }, setWidth() { return this; }, setHeight() { return this; } }), createHtmlOutputFromFile: () => { throw new Error('Không dùng'); }, XFrameOptionsMode: { ALLOWALL: 1, DEFAULT: 0 } },
    Session: { getActiveUser: () => ({ getEmail: () => '' }), getEffectiveUser: () => ({ getEmail: () => '' }) },
    ScriptApp: { getService: () => ({ getUrl: () => opt.appUrl || '' }), getOAuthToken: () => '', getProjectTriggers: () => [], newTrigger: proxyBuilder, deleteTrigger() { }, WeekDay: { SUNDAY: 1, MONDAY: 2 } },
    MailApp: { sendEmail: o => { logs.push('MAIL ' + (o && o.subject)); } },
    UrlFetchApp: { fetch: (url, o) => { fetches.push({ url, o: o || {} }); return { getResponseCode: () => 202, getContentText: () => 'Đã xếp hàng gửi', getBlob: () => blob('', 'text/plain', 'x') }; } },
    Logger: { log: (...a) => logs.push(a.join(' ')) },
    publicUrl, books
  };
  G.collect = () => {
    const sheets = [];
    Object.values(books).forEach(b => {
      if (b.temp) return;
      b.removed.forEach(n => sheets.push({ book: b.id, sheet: n, mode: 'drop' }));
      b.sheets.forEach(s => {
        if (s.structural) sheets.push({ book: b.id, sheet: s.name, mode: 'replace', rows: s.d.map((r, i) => ({ idx: i + 1, cells: (r || []).map(encCell) })) });
        else if (s.dirty.size) sheets.push({ book: b.id, sheet: s.name, mode: 'upsert', rows: Array.from(s.dirty).sort((a, b) => a - b).map(i => ({ idx: i, cells: (s.d[i - 1] || []).map(encCell) })) });
      });
    });
    return { sheets, props: propsChanged, cacheSet, cacheDel: Array.from(cacheDel), uploads, fetches, logs };
  };
  return G;
}
