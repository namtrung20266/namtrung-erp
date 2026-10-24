/* =====================================================================
 * PHẦN RIÊNG CHO SUPABASE (chạy sau toàn bộ code ERP + CRM)
 * ===================================================================== */
// Kết nối 3 "sổ dữ liệu" trên Postgres
['CORE', 'HR', 'CRM'].forEach(b => { if (!PROPS.getProperty('DB_' + b)) PROPS.setProperty('DB_' + b, b); });
// Mật khẩu ban đầu cho NT001 (migration sinh ngẫu nhiên, dùng 1 lần rồi xóa)
(function () {
  const pw = PROPS.getProperty('ADMIN_INIT_PW'); if (!pw) return;
  try {
    REQ_ = {};
    const u = Repo.one('users', x => U.up(x.username) === 'NT001');
    if (u && !u.password_hash) Repo.update('users', u.id, { password_hash: Auth.hash('NT001', pw), must_change_password: true });
    PROPS.deleteProperty('ADMIN_INIT_PW');
  } catch (e) { } finally { REQ_ = {}; }
})();
// Nhật ký thao tác ghi thẳng bảng app_audit (không nạp lại mỗi lần)
Audit.log = function (userId, action, entity, entityId, after) {
  ENV.audit.push({ at: U.now(), user_id: userId || null, action: action, entity: entity || '', entity_id: entityId || null, after: after ? JSON.stringify(after).slice(0, 2000) : null });
};
// Ảnh chấm công: trả link ảnh trong kho lưu trữ
__route('att.photo', (ctx, p) => { Policy.need(ctx, 'att.photo.view'); return p.id ? ENV.publicUrl(p.id) : ''; });
// Quản trị: nhập một sheet từ file Excel (cấu hình CRM, danh mục, dữ liệu cũ...)
__route('admin.import.sheet', (ctx, p) => {
  Policy.need(ctx, 'core.user.manage');
  const book = String(p.book || ''), name = String(p.sheet || '').trim(), rows = p.rows || [];
  if (['CORE', 'HR', 'CRM'].indexOf(book) < 0) fail('VALIDATION', 'Sổ dữ liệu không hợp lệ');
  if (!/^[A-Za-z0-9_]{2,40}$/.test(name)) fail('VALIDATION', 'Tên sheet không hợp lệ: ' + name);
  if (!Array.isArray(rows) || !rows.length) fail('VALIDATION', 'Sheet trống');
  if (book !== 'CRM' && !SCHEMA[name]) fail('VALIDATION', 'Sheet ' + name + ' không thuộc cấu trúc ERP');
  if (book === 'CORE' && name === 'users') {
    // Giữ mật khẩu đã đặt trên hệ thống mới (mật khẩu trong file cũ được mã hóa bằng khóa khác, không dùng được)
    const iu = rows[0].indexOf('username'), ip = rows[0].indexOf('password_hash'), im = rows[0].indexOf('must_change_password');
    const cur = {}; Repo.all('users').forEach(x => { if (x.password_hash) cur[U.up(x.username)] = x.password_hash; });
    rows.slice(1).forEach(r => { const k = U.up(r[iu]); if (cur[k]) { r[ip] = cur[k]; if (im >= 0) r[im] = false; } else if (String(r[ip] || '').indexOf('crm1:') !== 0) { r[ip] = ''; if (im >= 0) r[im] = true; } });
  }
  const ss = SpreadsheetApp.openById(book);
  const s = ss.getSheetByName(name) || ss.insertSheet(name);
  s.clear();
  const w = Math.max.apply(null, rows.map(r => r.length));
  s.getRange(1, 1, rows.length, w).setValues(rows.map(r => { const a = r.slice(); while (a.length < w) a.push(''); return a; }));
  if (book === 'CRM') Object.keys(PROPS.getProperties()).forEach(k => { if (/^SEQ_/.test(k)) PROPS.deleteProperty(k); });   // mã KH, BG... tự tiếp nối số lớn nhất sau khi nhập
  Cache.clear(); try { CRM_().clearCache(); } catch (e) { }
  Audit.log(ctx.userId, 'admin.import', book, null, { sheet: name, rows: rows.length });
  return { sheet: name, rows: rows.length };
}, { write: true });

// Quản trị: cấp mật khẩu tạm hàng loạt (sau khi nhập danh sách nhân sự)
__route('admin.users.bulkTemp', (ctx, p) => {
  Policy.need(ctx, 'core.user.manage');
  const only = p.onlyMissing !== false;
  const out = [];
  Repo.all('users').forEach(u => {
    if (u.id === ctx.userId || u.status !== 'active') return;
    if (only && u.password_hash) return;
    const e = Ref.emp(u.employee_id); if (!e || e.employment_status === 'terminated') return;
    const pw = Admin.tempPass();
    Repo.update('users', u.id, { password_hash: Auth.hash(u.username, pw), must_change_password: true }, ctx.userId);
    out.push({ username: u.username, name: e.full_name, password: pw });
  });
  Audit.log(ctx.userId, 'admin.bulk_temp', 'users', null, { n: out.length });
  return out;
}, { write: true });
