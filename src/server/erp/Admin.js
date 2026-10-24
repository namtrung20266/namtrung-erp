/*****************************************************************
 * NAM TRUNG ERP v2 — QUẢN TRỊ, CHUYỂN DỮ LIỆU v1 → v2, MENU, TÁC VỤ TỰ ĐỘNG
 *****************************************************************/
var __route = __route || function (name, fn, opt) { (globalThis.__ROUTES = globalThis.__ROUTES || {})[name] = Object.assign({ fn: fn }, opt || {}); };  // đăng ký route, không phụ thuộc thứ tự file


/* ============================== QUẢN TRỊ TÀI KHOẢN ============================== */
const Admin = {
  roleId(code) { const r = Repo.one('roles', x => x.code === code); if (!r) fail('NOT_FOUND', 'Không có vai trò ' + code); return r.id; },
  activeRoles(userId) { const t = U.today(); return Repo.where('user_roles', r => r.user_id === userId && r.valid_from <= t && (!r.valid_to || r.valid_to >= t)); },
  adminCount() { const rid = Admin.roleId('admin'); const ids = new Set(Repo.where('user_roles', r => r.role_id === rid && !r.valid_to).map(r => r.user_id)); return Repo.where('users', u => ids.has(u.id) && u.status === 'active').length; },
  tempPass() { return String(Math.floor(100000 + Math.random() * 900000)); }
};
__route('admin.users.list', ctx => {
  Policy.need(ctx, 'core.user.manage');
  const roles = Repo.all('roles'), teams = Repo.all('teams');
  return {
    roles: roles.map(r => ({ code: r.code, name: r.name })), teams: teams.map(t => ({ id: t.id, name: t.name })),
    departments: Ref.ref().departments.map(d => ({ id: d.id, name: d.name })),
    users: Repo.all('users').map(u => {
      const e = Ref.emp(u.employee_id) || {};
      const ur = Admin.activeRoles(u.id);
      return { id: u.id, username: u.username, name: e.full_name || '', display: e.display_name || '', dept: Hr.dept(e.department_id), status: u.status, hasPassword: !!u.password_hash,
        roles: ur.map(r => (roles.find(x => x.id === r.role_id) || {}).code).filter(Boolean), teamId: (ur.find(r => r.team_id) || {}).team_id || '', lastLogin: u.last_login_at ? String(u.last_login_at).replace('T', ' ').slice(0, 16) : '' };
    }).sort((a, b) => a.username < b.username ? -1 : 1)
  };
});
__route('admin.users.setRoles', (ctx, p) => {
  Policy.need(ctx, 'core.user.manage');
  const u = Repo.get('users', p.userId); if (!u) fail('NOT_FOUND', 'Không có tài khoản.');
  const want = new Set((p.roles || []).filter(Boolean));
  if (!want.size) fail('VALIDATION', 'Mỗi tài khoản cần ít nhất 1 vai trò.');
  if (want.has('sales_leader') && !p.teamId) fail('VALIDATION', 'Trưởng nhóm cần chọn nhóm phụ trách.');
  const cur = Admin.activeRoles(u.id), rolesById = {}; Repo.all('roles').forEach(r => rolesById[r.id] = r.code);
  const hadAdmin = cur.some(r => rolesById[r.role_id] === 'admin');
  if (hadAdmin && !want.has('admin') && Admin.adminCount() <= 1) fail('VALIDATION', 'Phải còn ít nhất 1 tài khoản Admin đang hoạt động.');
  const yesterday = U.addDays(U.today(), -1);
  cur.forEach(r => {
    const code = rolesById[r.role_id];
    const keep = want.has(code) && (code !== 'sales_leader' || r.team_id === p.teamId);
    if (!keep) Repo.update('user_roles', r.id, { valid_to: yesterday < r.valid_from ? r.valid_from : yesterday }, ctx.userId);
    else want.delete(code);
  });
  want.forEach(code => Repo.insert('user_roles', { user_id: u.id, role_id: Admin.roleId(code), team_id: code === 'sales_leader' ? p.teamId : null, valid_from: U.today(), granted_by: ctx.userId }, ctx.userId));
  if (p.teamId) { const t = Repo.get('teams', p.teamId); const e = Ref.emp(u.employee_id); if (t && e && (p.roles || []).indexOf('sales_leader') >= 0) { Repo.update('teams', t.id, { leader_employee_id: e.id }, ctx.userId); } }
  Audit.log(ctx.userId, 'admin.set_roles', 'users', u.id, { roles: p.roles, teamId: p.teamId });
  return true;
}, { write: true });
__route('admin.users.resetPassword', (ctx, p) => {
  Policy.need(ctx, 'core.user.manage');
  const u = Repo.get('users', p.userId); if (!u) fail('NOT_FOUND', 'Không có tài khoản.');
  const pw = Admin.tempPass();
  Repo.update('users', u.id, { password_hash: Auth.hash(u.username, pw), must_change_password: true, status: u.status === 'locked' ? 'active' : u.status }, ctx.userId);
  Audit.log(ctx.userId, 'admin.reset_password', 'users', u.id);
  return { username: u.username, password: pw };
}, { write: true });
__route('admin.users.setStatus', (ctx, p) => {
  Policy.need(ctx, 'core.user.manage');
  if (p.userId === ctx.userId) fail('VALIDATION', 'Không tự khóa tài khoản của mình.');
  if (['active', 'locked', 'disabled'].indexOf(p.status) < 0) fail('VALIDATION', 'Trạng thái không hợp lệ.');
  Repo.update('users', p.userId, { status: p.status }, ctx.userId);
  Audit.log(ctx.userId, 'admin.set_status', 'users', p.userId, { status: p.status });
  return true;
}, { write: true });
/** Thêm nhanh một người + tài khoản (VD thêm Admin không nằm trong danh sách nhân sự) */
__route('admin.employees.quickAdd', (ctx, p) => {
  Policy.need(ctx, 'core.user.manage');
  const name = String(p.fullName || '').trim(), disp = String(p.displayName || '').trim();
  if (name.length < 3 || disp.length < 2) fail('VALIDATION', 'Nhập họ tên và tên hiển thị.');
  if (!p.departmentId) fail('VALIDATION', 'Chọn phòng ban.');
  const codes = Repo.all('employees').map(e => Number(String(e.employee_code).replace(/\D/g, '')) || 0);
  const code = 'NT' + ('00' + (Math.max.apply(null, codes.concat([0])) + 1)).slice(-3);
  const e = Repo.insert('employees', { employee_code: code, full_name: name, display_name: disp, email_work: p.email || null, phone: p.phone || null, department_id: p.departmentId, position: p.position || null, employee_type: 'fulltime', work_schedule: 'office', attendance_required: !!p.attendance, hire_date: p.hireDate || U.today(), employment_status: 'official', kpi_coefficient: 1 }, ctx.userId);
  const pw = Admin.tempPass();
  const u = Repo.insert('users', { employee_id: e.id, username: code, password_hash: Auth.hash(code, pw), must_change_password: true, status: 'active' }, ctx.userId);
  (p.roles && p.roles.length ? p.roles : ['staff']).forEach(r => Repo.insert('user_roles', { user_id: u.id, role_id: Admin.roleId(r), team_id: null, valid_from: U.today(), granted_by: ctx.userId }, ctx.userId));
  Audit.log(ctx.userId, 'admin.quick_add', 'employees', e.id, { code, roles: p.roles });
  return { username: code, password: pw };
}, { write: true });

/* ============================== MENU (chạy trong file điều khiển) ============================== */
function guard_() { try { SpreadsheetApp.getUi(); } catch (e) { throw new Error('Chỉ chạy từ menu trong file Google Sheet.'); } }
function once_(key, sec) { const last = Number(PROPS.getProperty(key) || 0); if (Date.now() - last < sec * 1000) return false; PROPS.setProperty(key, String(Date.now())); return true; }
function ui_() { return SpreadsheetApp.getUi(); }
function onOpen() {
  ui_().createMenu('🧭 Nam Trung ERP')
    .addItem('① Kết nối 3 file dữ liệu v2', 'menuKetNoi')
    .addItem('② Chuyển dữ liệu từ bản v1 (file này)', 'menuChuyenV1')
    .addItem('③ Cấp mật khẩu tạm cho người chưa có', 'menuCapMatKhau')
    .addItem('④ Bật tự động hằng ngày + sao lưu', 'menuTrigger')
    .addSeparator()
    .addItem('Kiểm tra kết nối & cấu trúc', 'menuKiemTra')
    .addItem('Chốt công & gửi kế toán (chạy tay)', 'menuChotCong')
    .addItem('Kết chuyển phép sang năm mới', 'menuKetChuyen')
    .addItem('Xóa bộ nhớ đệm (sau khi sửa tay dữ liệu)', 'menuXoaCache')
    .addItem('Gửi thử tin Lark', 'menuLark')
    .addSeparator()
    .addItem('CRM ⑤ Ghép tài khoản CRM với nhân sự ERP', 'menuGhepCRM')
    .addItem('CRM: Kiểm tra, cập nhật cấu trúc sheet', 'menuCrmCauTruc')
    .addItem('CRM: Làm mới cờ khách đang chạy', 'menuCrmKHHT')
    .addItem('CRM: Kiểm tra mã QR thanh toán', 'menuCrmQR')
    .addItem('CRM: Sao lưu ngay', 'menuCrmSaoLuu')
    .addToUi();
}
function idFromUrl_(s) { const m = String(s || '').match(/\/d\/([a-zA-Z0-9_-]{20,})/); return m ? m[1] : String(s || '').trim(); }
function menuKetNoi() {
  guard_(); const ui = ui_();
  const out = [];
  ['CORE', 'HR', 'CRM'].forEach(db => {
    const cur = PROPS.getProperty(DB_FILES[db]);
    const r = ui.prompt('Kết nối file NT_' + db, 'Dán link Google Sheet của file NT_' + db + (cur ? '\n(Đang kết nối: ' + cur + '. Bỏ trống = giữ nguyên)' : ''), ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return;
    const id = idFromUrl_(r.getResponseText());
    if (!id) { out.push(db + ': giữ nguyên'); return; }
    try { const ss = SpreadsheetApp.openById(id); PROPS.setProperty(DB_FILES[db], id); out.push(db + ': ' + ss.getName()); } catch (e) { out.push(db + ': KHÔNG MỞ ĐƯỢC (' + e.message + ')'); }
  });
  Cache.clear();
  ui.alert('Kết nối\n\n' + out.join('\n') + '\n\nBước tiếp: menu "Kiểm tra kết nối & cấu trúc".');
}
function menuKiemTra() {
  guard_(); REQ_ = {};
  const lines = [];
  Object.keys(SCHEMA).forEach(t => {
    try {
      const s = SheetsAdapter.sheet(t), head = s.getRange(1, 1, 1, Math.max(1, s.getLastColumn())).getValues()[0].map(String);
      const miss = SCHEMA[t].cols.map(c => c[0]).filter(c => head.indexOf(c) < 0);
      if (miss.length) lines.push('✘ ' + t + ' thiếu cột: ' + miss.join(', '));
    } catch (e) { lines.push('✘ ' + t + ': ' + e.message); }
  });
  try { const m = CRM_(); Object.keys(m.schema).forEach(n => m.sheet(n)); } catch (e) { lines.push('✘ CRM: ' + e.message); }
  ui_().alert(lines.length ? 'Có ' + lines.length + ' lỗi:\n\n' + lines.slice(0, 30).join('\n') : '✔ Đủ ' + Object.keys(SCHEMA).length + ' bảng, đúng cột.\nSố nhân sự: ' + Repo.all('employees').length + ', tài khoản: ' + Repo.all('users').length);
}
function menuXoaCache() { guard_(); Cache.clear(); ui_().alert('Đã xóa bộ nhớ đệm.'); }

/** Cấp mật khẩu tạm: tạo tài khoản cho nhân sự chưa có, đặt mật khẩu cho tài khoản chưa có mật khẩu */
function menuCapMatKhau() {
  guard_(); REQ_ = {};
  const list = [], staffRole = Admin.roleId('staff');
  Repo.all('employees').forEach(e => {
    if (e.employment_status === 'terminated') return;
    let u = Repo.one('users', x => x.employee_id === e.id);
    if (!u) { u = Repo.insert('users', { employee_id: e.id, username: e.employee_code, must_change_password: true, status: 'active' }); Repo.insert('user_roles', { user_id: u.id, role_id: staffRole, valid_from: U.today() }); }
    if (u.password_hash || u.status !== 'active') return;
    const pw = Admin.tempPass();
    Repo.update('users', u.id, { password_hash: Auth.hash(u.username, pw), must_change_password: true });
    list.push([u.username, e.full_name, pw]);
  });
  Cache.clear();
  if (!list.length) { ui_().alert('Ai cũng đã có mật khẩu. Người đang dùng CRM đăng nhập bằng mật khẩu CRM cũ.'); return; }
  const html = '<style>body{font-family:Arial;font-size:13px}td,th{border:1px solid #ddd;padding:6px 10px}table{border-collapse:collapse}</style><p>Gửi riêng từng người. Lần đầu đăng nhập phải đổi mật khẩu. Đóng cửa sổ là không xem lại được.</p><table><tr><th>Mã</th><th>Họ tên</th><th>Mật khẩu tạm</th></tr>' + list.map(r => '<tr><td>' + r[0] + '</td><td>' + U.esc(r[1]) + '</td><td><b>' + r[2] + '</b></td></tr>').join('') + '</table>';
  ui_().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(460).setHeight(520), 'Mật khẩu tạm');
}
function menuTrigger() {
  guard_();
  ScriptApp.getProjectTriggers().forEach(t => { if (['jobHangNgay', 'jobSaoLuu'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('jobHangNgay').timeBased().everyDays(1).atHour(7).nearMinute(30).create();
  ScriptApp.newTrigger('jobSaoLuu').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(22).create();
  ui_().alert('Đã bật: 7:30 mỗi sáng (tin Lark, nhắc đơn chờ, tự chốt công) và 22:00 Chủ nhật (sao lưu 3 file dữ liệu).');
}
function menuChotCong() {
  guard_(); const ui = ui_(); const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  const def = Utilities.formatDate(d, TZ, 'yyyy-MM');
  const r = ui.prompt('Chốt công', 'Tháng (yyyy-mm). Bỏ trống = ' + def, ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  ui.alert('Đã chốt. File: ' + Jobs.closeMonth(r.getResponseText().trim() || def));
}
function menuKetChuyen() {
  guard_(); REQ_ = {}; const ui = ui_(); const y = Settings.num('hr.nam', new Date().getFullYear()), max = Settings.num('hr.ton_toi_da', 5);
  if (ui.alert('Kết chuyển phép ' + y + ' → ' + (y + 1), 'Chạy đầu tháng 1, sau khi đã duyệt hết đơn tháng 12. Phép còn lại (tối đa ' + max + ' ngày) chuyển sang năm mới. Tiếp tục?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  Hr.active().forEach(e => {
    const b = Hr.balanceOf(e), ton = Math.max(0, Math.min(b.conLai, max));
    const ex = Repo.one('leave_balances', x => x.employee_id === e.id && x.year === y + 1);
    if (ex) Repo.update('leave_balances', ex.id, { carried_over: ton }); else Repo.insert('leave_balances', { employee_id: e.id, year: y + 1, carried_over: ton, adjustment: 0, adjustment_note: 'Kết chuyển từ ' + y + ': còn ' + b.conLai });
  });
  Settings.set('hr.nam', y + 1); ui.alert('Xong. Năm hiện hành: ' + (y + 1));
}
function menuLark() { guard_(); REQ_ = {}; ui_().alert(Jobs.lark(true)); }

/* ============================== TÁC VỤ TỰ ĐỘNG ============================== */
const Jobs = {
  lark(test) {
    const url = String(Settings.get('hr.lark_webhook', '') || '').trim(); if (!url) return 'Chưa điền hr.lark_webhook trong bảng settings.';
    const t = U.today(); let nx = U.addDays(t, 1); if (U.dow(nx) === 0) nx = U.addDays(nx, 1);
    const reqs = {}; Repo.all('leave_requests').forEach(r => reqs[r.id] = r);
    const pick = d => Repo.where('leave_request_days', x => x.date === d).map(x => { const r = reqs[x.leave_request_id], ty = r && Hr.type(r.leave_type_id), e = Ref.emp(x.employee_id); return r && e && r.status !== 'cancelled' ? '• ' + e.display_name + ' (' + Hr.dept(e.department_id) + ') – ' + (ty ? ty.public_label : '') + (r.backup_employee_id ? ' | cần gấp tìm: ' + Hr.name(r.backup_employee_id) : '') : null; }).filter(Boolean);
    const a = pick(t), b = pick(nx);
    const pend = Repo.where('leave_requests', r => r.status === 'pending' || r.status === 'pending_director').length;
    let text = '🗓 ' + U.thu(t) + ' ' + U.vn(t) + '\n' + (a.length ? 'Hôm nay vắng ' + a.length + ':\n' + a.join('\n') : 'Hôm nay đủ quân ✅');
    text += '\n\n' + U.thu(nx) + ' ' + U.vn(nx) + ': ' + (b.length ? b.length + ' người\n' + b.join('\n') : 'chưa ai báo nghỉ');
    if (pend) text += '\n\n⏳ ' + pend + ' đơn đang chờ duyệt';
    const res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify({ msg_type: 'text', content: { text } }) });
    return 'Lark trả về: ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200);
  },
  remind() {
    const lim = U.tsIso(new Date(Date.now() - 864e5)), group = {};
    Repo.where('leave_requests', r => ['pending', 'pending_director', 'cancel_requested'].indexOf(r.status) >= 0 && String(r.created_at) < lim).forEach(r => {
      Leave.approverEmails(Ref.emp(r.employee_id), r.status === 'pending_director').forEach(e => (group[e] = group[e] || []).push(r));
    });
    Object.keys(group).forEach(e => Hr.mail(e, group[e].length + ' đơn chờ duyệt quá 24 giờ', '<ul>' + group[e].map(r => '<li>' + U.esc(Hr.name(r.employee_id)) + ' – ' + U.vn(r.start_date) + '</li>').join('') + '</ul>' + Hr.btn('Duyệt ngay', '?p=approve')));
  },
  closeMonth(month) {
    const lock = String(Settings.get('hr.ky_da_khoa', '') || '');
    if (!lock || lock < month) Settings.set('hr.ky_da_khoa', month);
    const r = Rpt.monthly(month);
    const out = SpreadsheetApp.create('ChamCong_' + month + '_NamTrung');
    const s1 = out.getSheets()[0]; s1.setName('TongHop_' + month);
    s1.getRange(1, 1, r.rows.length + 1, r.head.length).setValues([r.head].concat(r.rows));
    const s2 = out.insertSheet('BangCong_' + month), gh = ['MaNV', 'Họ tên', 'Nhóm'].concat(r.days.map((d, i) => d ? d + ' ' + r.wd[i] : ''));
    s2.getRange(1, 1, r.grid.length + 1, gh.length).setValues([gh].concat(r.grid));
    [s1, s2].forEach(s => { s.getRange(1, 1, 1, s.getLastColumn()).setFontWeight('bold'); s.setFrozenRows(1); });
    const emails = String(Settings.get('hr.email_ke_toan', '') || '').split(/[,;\s]+/).filter(Boolean);
    emails.forEach(e => { try { out.addViewer(e); } catch (x) { } });
    if (emails.length) {
      SpreadsheetApp.flush();
      const blob = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + out.getId() + '/export?format=xlsx', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true }).getBlob().setName('ChamCong_' + month + '.xlsx');
      MailApp.sendEmail({ to: emails.join(','), subject: '[Chấm công] Số liệu tháng ' + month, name: 'Nam Trung · Nhân sự', htmlBody: '<p>Số liệu nghỉ, vắng, chấm công tháng <b>' + month + '</b> đã chốt.</p><p><a href="' + out.getUrl() + '">' + out.getUrl() + '</a></p>', attachments: [blob] });
    }
    Audit.log(null, 'hr.close_month', 'settings', null, { month, url: out.getUrl() });
    return out.getUrl();
  }
};
function jobHangNgay() {
  if (!once_('V2_JOB_DAY', 6 * 3600)) return;
  REQ_ = {};
  const t = U.today();
  if (U.dow(t) !== 0) { try { Jobs.lark(false); } catch (e) { console.error(e); } }
  try { Jobs.remind(); } catch (e) { console.error(e); }
  try { CRM_().jobHangNgay(); } catch (e) { console.error('CRM job', e); }
  if (+t.slice(8, 10) === Settings.num('hr.ngay_chot_cong', 3)) {
    const d = U.toDate(t); d.setDate(1); d.setMonth(d.getMonth() - 1);
    try { Jobs.closeMonth(Utilities.formatDate(d, TZ, 'yyyy-MM')); } catch (e) { console.error(e); }
  }
}
function jobSaoLuu() {
  if (!once_('V2_JOB_BACKUP', 6 * 86400)) return;
  const it = DriveApp.getFoldersByName('NT_ERP_SaoLuu'), folder = it.hasNext() ? it.next() : DriveApp.createFolder('NT_ERP_SaoLuu');
  const day = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  ['CORE', 'HR', 'CRM'].forEach(db => { const id = PROPS.getProperty(DB_FILES[db]); if (id) DriveApp.getFileById(id).makeCopy('SaoLuu_NT_' + db + '_' + day, folder); });
  const files = []; const fi = folder.getFiles(); while (fi.hasNext()) files.push(fi.next());
  files.sort((a, b) => b.getDateCreated() - a.getDateCreated()).slice(24).forEach(f => f.setTrashed(true));
  // Dọn ảnh chấm công cũ, giữ ảnh mẫu
  REQ_ = {};
  const keep = new Set(Repo.all('attendance_profiles').map(p => p.face_ref_file_id).filter(Boolean));
  const cut = new Date(Date.now() - Settings.num('hr.luu_anh_ngay', 90) * 864e5);
  const ph = Att.folder().getFiles(); let n = 0;
  while (ph.hasNext() && n < 2000) { const f = ph.next(); if (f.getDateCreated() < cut && !keep.has(f.getId())) { f.setTrashed(true); n++; } }
}

/* ============================== CRM: MENU & GHÉP TÀI KHOẢN ============================== */
function menuCrmCauTruc() { guard_(); REQ_ = {}; CRM_().menuKhoiTao(); }
function menuCrmKHHT() { guard_(); REQ_ = {}; CRM_().menuKHHT(); }
function menuCrmQR() { guard_(); REQ_ = {}; CRM_().menuKiemTraQR(); }
function menuCrmSaoLuu() { guard_(); REQ_ = {}; CRM_().menuSaoLuu(); }

/** Ghép từng tài khoản trong tab NHAN_SU của CRM với một hồ sơ nhân sự ERP (theo mã cũ, email, SĐT).
 *  Người chưa có hồ sơ ERP: tạo hồ sơ cộng tác viên để vẫn đăng nhập được. Chạy lại nhiều lần an toàn. */
function menuGhepCRM() {
  guard_(); REQ_ = {};
  const rep = ghepCRM_();
  Cache.clear(); CRM_().clearCache();
  const html = '<style>body{font-family:Arial;font-size:13px}td,th{border:1px solid #ddd;padding:5px 8px;text-align:left}table{border-collapse:collapse}</style>' +
    '<p>Đăng nhập ERP và CRM bằng <b>mã ERP</b> (NTxxx) hoặc <b>mã CRM cũ</b>. Người chưa từng đổi mật khẩu ERP dùng <b>mật khẩu CRM</b>.</p>' +
    '<table><tr><th>Mã CRM</th><th>Họ tên</th><th>Vai trò CRM</th><th>Hồ sơ ERP</th><th>Kết quả</th></tr>' + rep.map(r => '<tr><td>' + r[0] + '</td><td>' + U.esc(r[1]) + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td><td>' + U.esc(r[4]) + '</td></tr>').join('') + '</table>';
  ui_().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(720).setHeight(560), 'Ghép tài khoản CRM ↔ ERP');
}
function ghepCRM_() {
  const m = CRM_(), rep = [];
  const salesRole = Admin.roleId('sales'), kd = Repo.one('departments', d => d.code === 'KD');
  const norm = s => String(s || '').replace(/\D/g, '').replace(/^84/, '0');
  m.users().filter(u => u.maNV).forEach(cu => {
    const code = U.up(cu.maNV);
    const active = cu.trangThai === 'Đang làm';
    let e = Repo.one('employees', x => String(x.legacy_codes || '').toUpperCase().split(/[,\s]+/).indexOf('CRM:' + code) >= 0)
      || Repo.one('employees', x => x.employee_code === code)
      || (cu.email && Repo.one('employees', x => String(x.email_work || '').toLowerCase() === String(cu.email).toLowerCase()))
      || (cu.sdt && Repo.one('employees', x => x.phone && norm(x.phone) === norm(cu.sdt)));
    let note = '';
    if (!e) {
      if (!active) { rep.push([code, cu.hoTen, cu.vaiTro, '—', 'Đã nghỉ trong CRM, bỏ qua']); return; }
      const codes = Repo.all('employees').map(x => Number(String(x.employee_code).replace(/\D/g, '')) || 0);
      const nc = 'NT' + ('00' + (Math.max.apply(null, codes.concat([0])) + 1)).slice(-3);
      e = Repo.insert('employees', { employee_code: nc, full_name: cu.hoTen, display_name: cu.hoTen, email_work: cu.email || null, phone: cu.sdt ? String(cu.sdt) : null, department_id: kd ? kd.id : Repo.all('departments')[0].id,
        position: cu.capBac || null, employee_type: 'collaborator', work_schedule: 'office', attendance_required: false, hire_date: cu.ngayVao || U.today(), employment_status: 'official', kpi_coefficient: Number(cu.heSoKPI) || 1, legacy_codes: 'crm:' + code });
      note = 'Tạo hồ sơ cộng tác viên ' + nc + '. ';
    } else if (String(e.legacy_codes || '').toUpperCase().indexOf('CRM:' + code) < 0 && e.employee_code !== code) {
      e = Repo.update('employees', e.id, { legacy_codes: [e.legacy_codes, 'crm:' + code].filter(Boolean).join(',') });
      note = 'Ghép mã. ';
    }
    let u = Repo.one('users', x => x.employee_id === e.id);
    if (!u) u = Repo.insert('users', { employee_id: e.id, username: e.employee_code, must_change_password: false, status: 'active' });
    // Giữ mật khẩu CRM cho người chưa tự đặt mật khẩu ERP
    const h = String(u.password_hash || '');
    if (cu.matKhauHash && (!h || u.must_change_password || h.indexOf('crm1:') === 0)) { Repo.update('users', u.id, { password_hash: 'crm1:' + cu.matKhauHash, must_change_password: false }); note += 'Dùng mật khẩu CRM. '; }
    if (['SALE', 'QUANLY'].indexOf(cu.vaiTro) >= 0 && !Repo.one('user_roles', r => r.user_id === u.id && r.role_id === salesRole && !r.valid_to)) {
      Repo.insert('user_roles', { user_id: u.id, role_id: salesRole, valid_from: U.today() }); note += 'Thêm vai trò Sale. ';
    }
    rep.push([code, cu.hoTen, cu.vaiTro, e.employee_code, note || 'Đã ghép từ trước']);
  });
  Audit.log(null, 'crm.link_accounts', 'users', null, { n: rep.length });
  return rep;
}
