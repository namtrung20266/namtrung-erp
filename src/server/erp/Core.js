/*****************************************************************
 * NAM TRUNG ERP v2 — TẦNG LÕI
 *  L2 Router  : api(route, token, payload) → { ok, data } | { ok:false, error }
 *  Auth/Policy: đăng nhập, vai trò, phạm vi dòng (self / team / department / all)
 *  L4 Repo    : đọc ghi bảng theo SCHEMA. Hôm nay: SheetsAdapter. Lên server: thay adapter.
 * Quy ước dữ liệu trong code: ngày 'yyyy-MM-dd', thời điểm ISO '…T…+07:00', tiền là số nguyên.
 *****************************************************************/

const TZ = 'Asia/Ho_Chi_Minh';
const PROPS = PropertiesService.getScriptProperties();

/* ============================== TIỆN ÍCH ============================== */
const U = {
  pad: n => ('0' + n).slice(-2),
  dIso(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); },
  tsIso(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd') + 'T' + Utilities.formatDate(d, TZ, 'HH:mm:ss') + '+07:00'; },
  today() { return U.dIso(new Date()); },
  now() { return U.tsIso(new Date()); },
  toDate(iso) { if (!iso) return null; if (iso instanceof Date) return iso; const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; },
  toTs(iso) { if (!iso) return null; if (iso instanceof Date) return iso; const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : U.toDate(iso); },
  addDays(iso, n) { const d = U.toDate(iso); d.setDate(d.getDate() + n); return U.dIso(d); },
  dow(iso) { return U.toDate(iso).getDay(); },
  month(iso) { return String(iso).slice(0, 7); },
  hhmm(ts) { return ts ? String(ts).slice(11, 16) : ''; },
  min(hhmm) { const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; },
  vn(iso) { const p = String(iso).split('-'); return p.length >= 3 ? p[2].slice(0, 2) + '/' + p[1] : String(iso); },
  thu(iso) { return ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][U.dow(iso)]; },
  up: s => String(s || '').trim().toUpperCase(),
  esc: s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  uuid() { return Utilities.getUuid(); },
  /** UUID v5 giống hệt Python uuid.uuid5: chạy lại công cụ chuyển dữ liệu ra đúng id cũ */
  uuid5(kind, key) {
    const ns = [0x7d, 0x3b, 0x6f, 0x2e, 0x1c, 0x4a, 0x4b, 0x8e, 0x9f, 0x00, 0x4e, 0x5a, 0x6d, 0x7c, 0x8b, 0x90].map(b => b > 127 ? b - 256 : b);
    const h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, ns.concat(Utilities.newBlob(kind + ':' + key).getBytes())).map(b => (b + 256) % 256).slice(0, 16);
    h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80;
    const x = h.map(b => ('0' + b.toString(16)).slice(-2)).join('');
    return x.slice(0, 8) + '-' + x.slice(8, 12) + '-' + x.slice(12, 16) + '-' + x.slice(16, 20) + '-' + x.slice(20);
  }
};

class AppError extends Error { constructor(code, message) { super(message); this.code = code; } }
const fail = (code, msg) => { throw new AppError(code, msg); };

/* ============================== KHO DỮ LIỆU ============================== */
/* Lớp duy nhất biết dữ liệu nằm trong Google Sheets. Mọi Service chỉ gọi Repo.* */
const DB_FILES = { CORE: 'DB_CORE', HR: 'DB_HR', CRM: 'DB_CRM' };
const TEXT_TYPES = ['text', 'uuid', 'char(7)', 'text[]', 'jsonb', 'time'];
let REQ_ = {};              // bộ nhớ trong 1 lần gọi
const SheetsAdapter = {
  file(db) {
    REQ_.files = REQ_.files || {};
    if (REQ_.files[db]) return REQ_.files[db];
    const id = PROPS.getProperty(DB_FILES[db]);
    if (!id) fail('CONFIG', 'Chưa kết nối file dữ liệu ' + db + '. Mở file điều khiển → menu Nam Trung ERP → ① Kết nối 3 file dữ liệu.');
    return (REQ_.files[db] = SpreadsheetApp.openById(id));
  },
  sheet(t) {
    const def = SCHEMA[t]; if (!def) fail('INTERNAL', 'Không có bảng ' + t);
    const s = SheetsAdapter.file(def.db).getSheetByName(t);
    if (!s) fail('CONFIG', 'File ' + def.db + ' thiếu tab ' + t);
    return s;
  },
  fromCell(v, type) {
    if (v === '' || v === null || v === undefined) return null;
    switch (type) {
      case 'date': return v instanceof Date ? U.dIso(v) : String(v).slice(0, 10);
      case 'timestamptz': return v instanceof Date ? U.tsIso(v) : String(v);
      case 'time': return v instanceof Date ? Utilities.formatDate(v, TZ, 'HH:mm') : String(v);
      case 'boolean': return v === true || String(v).toUpperCase() === 'TRUE';
      case 'int': case 'bigint': return Math.round(Number(v)) || 0;
      case 'text[]': return String(v).split(',').map(s => s.trim()).filter(Boolean);
      case 'jsonb': try { return JSON.parse(v); } catch (e) { return v; }
      default:
        if (type.indexOf('numeric') === 0) return Number(v) || 0;
        return typeof v === 'number' && Number.isInteger(v) ? String(v) : String(v);
    }
  },
  toCell(v, type) {
    if (v === null || v === undefined || v === '') return '';
    switch (type) {
      case 'date': return U.toDate(v) || '';
      case 'timestamptz': return U.toTs(v) || '';
      case 'boolean': return !!v;
      case 'int': case 'bigint': return Math.round(Number(v)) || 0;
      case 'text[]': return Array.isArray(v) ? v.join(',') : String(v);
      case 'jsonb': return typeof v === 'string' ? v : JSON.stringify(v);
      default: return type.indexOf('numeric') === 0 ? Number(v) || 0 : String(v);
    }
  },
  fmt(type) { return TEXT_TYPES.indexOf(type) >= 0 ? '@' : type === 'date' ? 'yyyy-mm-dd' : type === 'timestamptz' ? 'yyyy-mm-dd hh:mm:ss' : 'General'; },
  load(t) {
    REQ_.tables = REQ_.tables || {};
    if (REQ_.tables[t]) return REQ_.tables[t];
    const s = SheetsAdapter.sheet(t);
    const v = s.getDataRange().getValues();
    const head = v[0].map(String);
    const types = {}; SCHEMA[t].cols.forEach(c => types[c[0]] = c[1]);
    const rows = [], rowOf = {};
    for (let i = 1; i < v.length; i++) {
      const o = {};
      head.forEach((h, j) => { if (types[h]) o[h] = SheetsAdapter.fromCell(v[i][j], types[h]); });
      if (!o.id && types.id) continue;
      rows.push(o); if (o.id) rowOf[o.id] = i + 1;
    }
    return (REQ_.tables[t] = { sheet: s, head, types, rows, rowOf });
  },
  rowArray(tb, o) { return tb.head.map(h => tb.types[h] ? SheetsAdapter.toCell(o[h], tb.types[h]) : ''); },
  writeRows(tb, startRow, objs) {
    if (!objs.length) return;
    const fm = tb.head.map(h => SheetsAdapter.fmt(tb.types[h] || 'text'));
    const rg = tb.sheet.getRange(startRow, 1, objs.length, tb.head.length);
    rg.setNumberFormats(objs.map(() => fm));
    rg.setValues(objs.map(o => SheetsAdapter.rowArray(tb, o)));
  }
};

const CACHE_TABLES = ['users', 'user_roles', 'roles', 'permissions', 'role_permissions', 'employees', 'teams', 'departments', 'settings', 'holidays', 'leave_types'];
const Repo = {
  all(t, opt) { const rows = SheetsAdapter.load(t).rows; return (opt && opt.withDeleted) ? rows : rows.filter(r => !r.deleted_at); },
  where(t, fn) { return Repo.all(t).filter(fn); },
  one(t, fn) { return Repo.all(t).find(fn) || null; },
  get(t, id) { return id ? Repo.one(t, r => r.id === id) : null; },
  insert(t, o, actor) { return Repo.insertMany(t, [o], actor)[0]; },
  insertMany(t, arr, actor) {
    if (!arr.length) return [];
    const tb = SheetsAdapter.load(t);
    const stamp = U.now();
    const out = arr.map(o => {
      const r = Object.assign({}, o);
      if (tb.types.id && !r.id) r.id = U.uuid();
      if (tb.types.created_at && !r.created_at) r.created_at = stamp;
      if (tb.types.created_by && !r.created_by && actor) r.created_by = actor;
      return r;
    });
    const start = tb.sheet.getLastRow() + 1;
    SheetsAdapter.writeRows(tb, start, out);
    out.forEach((r, i) => { tb.rows.push(r); if (r.id) tb.rowOf[r.id] = start + i; });
    Repo.touched_(t); return out;
  },
  update(t, id, patch, actor) {
    const tb = SheetsAdapter.load(t);
    const r = tb.rows.find(x => x.id === id); if (!r) fail('NOT_FOUND', 'Không tìm thấy bản ghi ' + t);
    Object.assign(r, patch);
    if (tb.types.updated_at) r.updated_at = U.now();
    if (tb.types.updated_by && actor) r.updated_by = actor;
    SheetsAdapter.writeRows(tb, tb.rowOf[id], [r]);
    Repo.touched_(t); return r;
  },
  /** Xóa thật (chỉ dùng cho dữ liệu sinh ra từ dữ liệu khác, VD ngày nghỉ bung từ đơn) */
  deleteWhere(t, fn) {
    const tb = SheetsAdapter.load(t);
    const rows = tb.rows.filter(fn).map(r => tb.rowOf[r.id]).sort((a, b) => b - a);
    rows.forEach(n => tb.sheet.deleteRow(n));
    if (REQ_.tables) delete REQ_.tables[t];
    Repo.touched_(t); return rows.length;
  },
  softDelete(t, id, actor) { return Repo.update(t, id, { deleted_at: U.now() }, actor); },
  touched_(t) { if (CACHE_TABLES.indexOf(t) >= 0) Cache.clear(); }
};

/* Bộ nhớ đệm các bảng ít đổi (tài khoản, quyền, nhân sự, cấu hình) giữa các lần gọi */
const Cache = {
  get(k) { try { const v = CacheService.getScriptCache().get('V2_' + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  put(k, o, sec) { try { const s = JSON.stringify(o); if (s.length < 95000) CacheService.getScriptCache().put('V2_' + k, s, sec || 600); } catch (e) { } },
  clear() { try { CacheService.getScriptCache().removeAll(['V2_AUTHZ', 'V2_EMPS', 'V2_SETTINGS', 'V2_REF']); } catch (e) { } REQ_.authz = null; REQ_.emps = null; REQ_.settings = null; REQ_.ref = null; }
};
function cached_(key, build) {
  if (REQ_[key]) return REQ_[key];
  let v = Cache.get(key.toUpperCase());
  if (!v) { v = build(); Cache.put(key.toUpperCase(), v); }
  return (REQ_[key] = v);
}
const Ref = {
  employees() { return cached_('emps', () => Repo.all('employees')); },
  emp(id) { return Ref.employees().find(e => e.id === id) || null; },
  empByCode(code) { return Ref.employees().find(e => e.employee_code === U.up(code)) || null; },
  settings() { return cached_('settings', () => { const o = {}; Repo.all('settings').forEach(s => o[s.key] = s.value); return o; }); },
  ref() { return cached_('ref', () => ({ teams: Repo.all('teams'), departments: Repo.all('departments'), holidays: Repo.all('holidays').map(h => h.date), leaveTypes: Repo.all('leave_types') })); }
};
const Settings = {
  get(k, def) { const v = Ref.settings()[k]; return (v === undefined || v === null || v === '') ? def : v; },
  num(k, def) { const v = Number(Settings.get(k, def)); return isFinite(v) ? v : def; },
  set(k, v, actor) {
    const r = Repo.one('settings', x => x.key === k);
    if (r) Repo.update('settings', r.id, { value: String(v) }, actor);
    else Repo.insert('settings', { key: k, value: String(v), value_type: 'text', module: k.split('.')[0] }, actor);
  }
};

/* ============================== XÁC THỰC ============================== */
const Auth = {
  salt() { let s = PROPS.getProperty('SALT'); if (!s) { s = Utilities.getUuid(); PROPS.setProperty('SALT', s); } return s; },
  hash(username, pw) { return 'v2:' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Auth.salt() + '|' + U.up(username) + '|' + String(pw), Utilities.Charset.UTF_8)); },
  verify(user, pw) {
    const h = String(user.password_hash || '');
    if (!h) return false;
    if (h.indexOf('v2:') === 0 || h.indexOf('hr1:') === 0) return h.slice(h.indexOf(':') + 1) === Auth.hash(user.username, pw).slice(3);
    if (h.indexOf('crm1:') === 0) {
      const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pw) + '|NamTrung#CRM');
      return h.slice(5) === b.map(x => ((x + 256) % 256).toString(16).padStart(2, '0')).join('');
    }
    return false;
  },
  login(username, pw) {
    username = U.up(username);
    const c = CacheService.getScriptCache(), fk = 'V2F_' + username, f = Number(c.get(fk) || 0);
    if (f >= 5) fail('LOCKED', 'Sai quá 5 lần. Thử lại sau 15 phút.');
    let u = Repo.one('users', x => U.up(x.username) === username);
    if (!u) {   // cho phép đăng nhập bằng mã CRM cũ đã ghép (VD: HUYENTTT)
      const e = Repo.one('employees', x => String(x.legacy_codes || '').toUpperCase().split(/[,\s]+/).indexOf('CRM:' + username) >= 0);
      if (e) u = Repo.one('users', x => x.employee_id === e.id);
    }
    if (u && u.status === 'active' && !u.password_hash) fail('VALIDATION', 'Bạn chưa được cấp mật khẩu. Nhắn quản trị để nhận mật khẩu tạm.');
    if (!u || u.status !== 'active' || !Auth.verify(u, pw)) {
      c.put(fk, String(f + 1), 900); Audit.log(null, 'auth.login_fail', 'users', u && u.id, { username });
      fail('UNAUTHENTICATED_LOGIN', 'Sai mã nhân viên hoặc mật khẩu.');
    }
    c.remove(fk);
    const patch = { last_login_at: U.now() };
    if (String(u.password_hash).indexOf('v2:') !== 0) patch.password_hash = Auth.hash(u.username, pw);   // nâng cấp mật khẩu cũ lên chuẩn mới
    Repo.update('users', u.id, patch, u.id);
    const t = Utilities.getUuid();
    c.put('V2S_' + t, u.id, 21600);
    Audit.log(u.id, 'auth.login', 'users', u.id);
    return { token: t };
  },
  logout(token) { if (token) CacheService.getScriptCache().remove('V2S_' + token); },
  /** Dựng ngữ cảnh người dùng: vai trò, nhóm, phòng, quyền + phạm vi */
  ctx(token) {
    if (!token) fail('UNAUTHENTICATED', 'AUTH');
    const c = CacheService.getScriptCache(), uid = c.get('V2S_' + token);
    if (!uid) fail('UNAUTHENTICATED', 'AUTH');
    c.put('V2S_' + token, uid, 21600);
    const z = Authz.snapshot();
    const user = z.users.find(u => u.id === uid);
    if (!user || user.status !== 'active') fail('UNAUTHENTICATED', 'AUTH');
    const emp = Ref.emp(user.employee_id);
    if (!emp || emp.employment_status === 'terminated') fail('UNAUTHENTICATED', 'AUTH');
    const today = U.today();
    const urs = z.userRoles.filter(r => r.user_id === uid && r.valid_from <= today && (!r.valid_to || r.valid_to >= today));
    const roles = urs.map(r => (z.roles.find(x => x.id === r.role_id) || {}).code).filter(Boolean);
    const perms = {};
    const rank = { self: 1, team: 2, department: 3, all: 4 };
    urs.forEach(ur => z.rolePerms.filter(rp => rp.role_id === ur.role_id).forEach(rp => {
      const p = z.perms.find(x => x.id === rp.permission_id); if (!p) return;
      if (!perms[p.code] || rank[rp.scope] > rank[perms[p.code]]) perms[p.code] = rp.scope;
    }));
    return {
      userId: uid, user, emp, roles,
      isAdmin: roles.indexOf('admin') >= 0,
      teamIds: urs.filter(r => r.team_id).map(r => r.team_id),
      deptIds: urs.filter(r => r.department_id).map(r => r.department_id),
      perms
    };
  }
};
const Authz = {
  snapshot() {
    return cached_('authz', () => ({
      users: Repo.all('users').map(u => ({ id: u.id, employee_id: u.employee_id, username: u.username, status: u.status, must_change_password: u.must_change_password })),
      userRoles: Repo.all('user_roles'), roles: Repo.all('roles'), perms: Repo.all('permissions'), rolePerms: Repo.all('role_permissions')
    }));
  }
};

/* ============================== PHÂN QUYỀN ============================== */
const Policy = {
  scope(ctx, perm) { return ctx.isAdmin ? 'all' : (ctx.perms[perm] || null); },
  need(ctx, perm) { const s = Policy.scope(ctx, perm); if (!s) fail('FORBIDDEN', 'Bạn không có quyền dùng chức năng này.'); return s; },
  /** Nhân sự trong phạm vi: null = tất cả */
  employeeIds(ctx, perm) {
    const s = Policy.need(ctx, perm);
    if (s === 'all') return null;
    const ids = new Set([ctx.emp.id]);
    const es = Ref.employees();
    if (s === 'team' || s === 'department') {
      es.forEach(e => {
        if (e.team_id && ctx.teamIds.indexOf(e.team_id) >= 0) ids.add(e.id);
        if (e.manager_employee_id === ctx.emp.id) ids.add(e.id);
      });
    }
    if (s === 'department') es.forEach(e => { if (ctx.deptIds.indexOf(e.department_id) >= 0) ids.add(e.id); });
    return ids;
  },
  canSee(ctx, perm, employeeId) { const ids = Policy.employeeIds(ctx, perm); return ids === null || ids.has(employeeId); },
  /** Chỉ trả về cột người gọi được xem */
  strip(obj, keys) { const o = Object.assign({}, obj); keys.forEach(k => delete o[k]); return o; }
};

/* ============================== NHẬT KÝ ============================== */
const Audit = {
  log(userId, action, entity, entityId, after) {
    try { Repo.insert('audit_logs', { at: U.now(), user_id: userId || null, action, entity: entity || '', entity_id: entityId || null, after_json: after ? JSON.stringify(after).slice(0, 2000) : null }); } catch (e) { }
  }
};

/* ============================== ROUTER ============================== */
var __route = __route || function (name, fn, opt) { (globalThis.__ROUTES = globalThis.__ROUTES || {})[name] = Object.assign({ fn: fn }, opt || {}); };  // đăng ký route, không phụ thuộc thứ tự file

/** Điểm vào DUY NHẤT của giao diện. Lên server: đổi thành POST /api/<route> */
function api(routeName, token, payload) {
  REQ_ = {};
  const r = (globalThis.__ROUTES || {})[routeName];
  let lock = null;
  try {
    if (!r) fail('NOT_FOUND', 'Không có chức năng ' + routeName);
    if (r.write) { lock = LockService.getScriptLock(); lock.waitLock(25000); }
    const ctx = r.open ? null : Auth.ctx(token);
    const data = r.fn(ctx, payload || {}, token);
    return { ok: true, data: data === undefined ? null : JSON.parse(JSON.stringify(data)) };
  } catch (e) {
    const code = e.code || 'ERROR';
    if (!e.code) { try { console.error(routeName, e && e.stack); } catch (x) { } }
    return { ok: false, error: { code: code === 'UNAUTHENTICATED_LOGIN' ? 'VALIDATION' : code, message: String(e.message || e).replace(/^Error:\s*/, '') } };
  } finally { if (lock) lock.releaseLock(); }
}

/* ---------- auth ---------- */
__route('auth.login', (c, p) => Auth.login(p.username, p.password), { open: true, write: true });
__route('auth.logout', (c, p, token) => Auth.logout(token), { open: true });
__route('auth.changePassword', (ctx, p) => {
  if (!Auth.verify(Repo.get('users', ctx.userId), p.oldPassword || '')) fail('VALIDATION', 'Mật khẩu hiện tại chưa đúng.');
  if (String(p.newPassword || '').length < 6) fail('VALIDATION', 'Mật khẩu mới cần ít nhất 6 ký tự.');
  if (p.newPassword === p.oldPassword) fail('VALIDATION', 'Mật khẩu mới phải khác mật khẩu cũ.');
  Repo.update('users', ctx.userId, { password_hash: Auth.hash(ctx.user.username, p.newPassword), must_change_password: false }, ctx.userId);
  Audit.log(ctx.userId, 'auth.change_password', 'users', ctx.userId);
  return true;
}, { write: true });

/* ---------- mã giao diện (không cần đăng nhập) ---------- */
function apiClientJs() {
  const s = APP_CLIENT_.toString();
  return s.slice(s.indexOf('{') + 1, s.lastIndexOf('}'));
}

/* ---------- web app ---------- */
function doGet(e) {
  if (e && e.parameter && e.parameter.app === 'crm') {
    return HtmlService.createHtmlOutputFromFile('CrmIndex').setTitle('Nam Trung · CRM bán hàng')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Nam Trung · Nhân sự')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}
