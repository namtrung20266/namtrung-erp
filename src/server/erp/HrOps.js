/*****************************************************************
 * NAM TRUNG ERP v2 — CHẤM CÔNG, LƯƠNG, BÁO CÁO NHÂN SỰ (L3 Services)
 *****************************************************************/
var __route = __route || function (name, fn, opt) { (globalThis.__ROUTES = globalThis.__ROUTES || {})[name] = Object.assign({ fn: fn }, opt || {}); };  // đăng ký route, không phụ thuộc thứ tự file


/* ============================== CHẤM CÔNG ============================== */
const Att = {
  rec(empId, date) { return Repo.one('attendance_records', r => r.employee_id === empId && r.date === date); },
  today(empId) { const r = Att.rec(empId, U.today()); return r ? { vao: U.hhmm(r.check_in_at), ra: U.hhmm(r.check_out_at), muon: r.late_minutes || 0, som: r.early_minutes || 0 } : null; },
  ips() { return String(Settings.get('hr.ip_van_phong', '') || '').split(/[,;\s]+/).map(s => s.trim()).filter(Boolean); },
  ipOk(ip, list) { return list.some(x => ip === x || (x.slice(-1) === '*' && ip.indexOf(x.slice(0, -1)) === 0)); },
  profile(empId) { return Repo.one('attendance_profiles', p => p.employee_id === empId); },
  /** Giờ chuẩn trong ngày, có tính đơn nghỉ nửa buổi đã duyệt */
  expected(emp, date) {
    const tm = (k, def) => { const x = U.min(Settings.get(k, def)); return x === null ? U.min(def) : x; };
    const satHalf = U.dow(date) === 6 && emp.work_schedule !== 'warehouse';
    let vao = tm('hr.gio_vao', '08:00'), ra = satHalf ? tm('hr.gio_ra_sang', '12:00') : tm('hr.gio_ra', '17:30'), nghi = '';
    const work = new Set(Hr.types().filter(t => t.counts_as_work).map(t => t.id));
    const reqType = {}; Repo.where('leave_requests', r => r.employee_id === emp.id).forEach(r => reqType[r.id] = r.leave_type_id);
    Repo.where('leave_request_days', d => d.employee_id === emp.id && d.date === date && d.work_value > 0 && !work.has(reqType[d.leave_request_id])).forEach(d => {
      if (d.half === 'full') nghi = 'Cả ngày';
      else if (d.half === 'am') { vao = tm('hr.gio_vao_chieu', '13:30'); nghi = nghi || 'Sáng'; }
      else if (d.half === 'pm') { ra = tm('hr.gio_ra_sang', '12:00'); nghi = nghi || 'Chiều'; }
    });
    return { vao, ra, nghi };
  },
  folder() { const it = DriveApp.getFoldersByName('NT_ChamCong_Anh'); return it.hasNext() ? it.next() : DriveApp.createFolder('NT_ChamCong_Anh'); }
};
__route('att.punch', (ctx, p) => {
  const me = ctx.emp;
  if (!me.attendance_required) fail('VALIDATION', 'Bạn thuộc nhóm không cần chấm công.');
  const ips = Att.ips();
  if (!ips.length) fail('CONFIG', 'Admin chưa cài IP wifi văn phòng. Báo admin vào mục Chấm công → Đặt IP văn phòng.');
  const ip = String(p.ip || '').trim();
  if (!Att.ipOk(ip, ips)) fail('VALIDATION', 'Chưa nhận wifi công ty (IP hiện tại: ' + (ip || 'không xác định') + ').\nTắt 4G, kết nối wifi văn phòng rồi thử lại.');
  const photo = String(p.photo || ''); if (photo.length < 4000) fail('VALIDATION', 'Cần chụp ảnh khuôn mặt để chấm công.');
  const now = new Date(), date = U.today(), nowMin = now.getHours() * 60 + now.getMinutes();
  const file = Att.folder().createFile(Utilities.newBlob(Utilities.base64Decode(photo.split(',').pop()), 'image/jpeg', me.employee_code + '_' + Utilities.formatDate(now, TZ, 'yyyyMMdd_HHmmss') + '.jpg'));
  const flags = [];
  const prof = Att.profile(me.id);
  if (!prof) Repo.insert('attendance_profiles', { employee_id: me.id, device_id: p.device || null, face_ref_file_id: file.getId() }, ctx.userId);
  else {
    const ch = {};
    if (p.device) { if (!prof.device_id) ch.device_id = p.device; else if (prof.device_id !== p.device) flags.push('Thiết bị lạ'); }
    if (!prof.face_ref_file_id) ch.face_ref_file_id = file.getId();
    if (Object.keys(ch).length) Repo.update('attendance_profiles', prof.id, ch, ctx.userId);
  }
  if (U.dow(date) === 0 || Hr.holidays().indexOf(date) >= 0) flags.push('Ngày nghỉ');
  const ex = Att.expected(me, date); if (ex.nghi === 'Cả ngày') flags.push('Có đơn nghỉ cả ngày');
  const g = Settings.num('hr.phut_cho_phep', 5), r = Att.rec(me.id, date), hm = Utilities.formatDate(now, TZ, 'HH:mm');
  let res;
  if (!r) {
    const muon = nowMin - ex.vao > g ? nowMin - ex.vao : 0;
    Repo.insert('attendance_records', { employee_id: me.id, date, period: U.month(date), check_in_at: U.tsIso(now), late_minutes: muon, early_minutes: 0, check_in_ip: ip, check_in_photo_id: file.getId(), source: 'app', flags: flags.join(', ') || null }, ctx.userId);
    res = { loai: 'VAO', gio: hm, muon, nghi: ex.nghi };
  } else {
    const vm = U.min(U.hhmm(r.check_in_at));
    if (vm !== null && nowMin - vm < 2) fail('CONFLICT', 'Bạn vừa chấm vào lúc ' + U.hhmm(r.check_in_at) + '. Cuối giờ chấm lại để ra ca.');
    const som = ex.ra - nowMin > 0 ? ex.ra - nowMin : 0;
    Repo.update('attendance_records', r.id, { check_out_at: U.tsIso(now), early_minutes: som, check_out_ip: ip, check_out_photo_id: file.getId(), flags: [r.flags, flags.join(', ')].filter(Boolean).join(', ') || null }, ctx.userId);
    res = { loai: 'RA', gio: hm, som, vao: U.hhmm(r.check_in_at) };
  }
  Audit.log(ctx.userId, 'att.' + res.loai.toLowerCase(), 'attendance_records', null, { ip, flags });
  res.flags = flags; return res;
}, { write: true });
__route('att.mine', (ctx, p) => {
  const month = /^\d{4}-\d{2}$/.test(String(p.month || '')) ? p.month : U.month(U.today());
  const rows = Repo.where('attendance_records', r => r.employee_id === ctx.emp.id && r.period === month).sort((a, b) => a.date < b.date ? -1 : 1)
    .map(r => ({ d: r.date, vao: U.hhmm(r.check_in_at), ra: U.hhmm(r.check_out_at), muon: r.late_minutes || 0, som: r.early_minutes || 0, nguon: r.source === 'manual' ? 'Bổ sung' : 'App', ghiChu: [r.flags, r.note].filter(Boolean).join(' | ') }));
  return { month, rows, today: Att.today(ctx.emp.id) };
});
__route('att.day', (ctx, p) => {
  const ids = Policy.employeeIds(ctx, 'att.view');
  const photos = !!Policy.scope(ctx, 'att.photo.view');
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(p.day || '')) ? p.day : U.today();
  const recs = {}; Repo.where('attendance_records', r => r.date === day).forEach(r => recs[r.employee_id] = r);
  const reqs = {}; Repo.all('leave_requests').forEach(r => reqs[r.id] = r);
  const leave = {}; Repo.where('leave_request_days', d => d.date === day).forEach(d => { const r = reqs[d.leave_request_id], t = r && Hr.type(r.leave_type_id); if (t) (leave[d.employee_id] = leave[d.employee_id] || []).push(t.public_label); });
  const list = Hr.active().filter(e => e.attendance_required && (ids === null || ids.has(e.id))).map(e => {
    const r = recs[e.id], prof = photos ? Att.profile(e.id) : null;
    return { ma: e.employee_code, ten: e.display_name, boPhan: Hr.dept(e.department_id), mau: prof && prof.face_ref_file_id || '', vao: r ? U.hhmm(r.check_in_at) : '', ra: r ? U.hhmm(r.check_out_at) : '', muon: r ? r.late_minutes || 0 : 0, som: r ? r.early_minutes || 0 : 0,
      anhVao: photos && r ? r.check_in_photo_id || '' : '', anhRa: photos && r ? r.check_out_photo_id || '' : '', nguon: r && r.source === 'manual' ? 'Bổ sung' : '', ghiChu: r ? [r.flags, r.note].filter(Boolean).join(' | ') : '', nghi: (leave[e.id] || []).join(', ') };
  });
  return { day, list, ips: ctx.isAdmin ? Att.ips() : [], isWork: U.dow(day) !== 0 && Hr.holidays().indexOf(day) < 0 };
});
__route('att.photo', (ctx, p) => {
  Policy.need(ctx, 'att.photo.view');
  if (!p.id) return '';
  return 'data:image/jpeg;base64,' + Utilities.base64Encode(DriveApp.getFileById(p.id).getBlob().getBytes());
});
__route('att.manual', (ctx, f) => {
  Policy.need(ctx, 'att.manual');
  const e = Ref.empByCode(f.ma); if (!e) fail('NOT_FOUND', 'Không tìm thấy nhân sự.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(f.ngay || ''))) fail('VALIDATION', 'Chọn ngày.');
  if (String(f.lyDo || '').trim().length < 3) fail('VALIDATION', 'Ghi lý do bổ sung công.');
  const vao = U.min(f.vao), ra = f.ra ? U.min(f.ra) : null;
  if (vao === null) fail('VALIDATION', 'Nhập giờ vào dạng HH:mm.');
  if (f.ra && (ra === null || ra <= vao)) fail('VALIDATION', 'Giờ ra phải sau giờ vào.');
  if (Pay.locked(U.month(f.ngay)) && !ctx.isAdmin) fail('LOCKED', 'Tháng này đã chốt lương.');
  const ex = Att.expected(e, f.ngay), g = Settings.num('hr.phut_cho_phep', 5);
  const ts = m => f.ngay + 'T' + U.pad(Math.floor(m / 60)) + ':' + U.pad(m % 60) + ':00+07:00';
  const patch = { check_in_at: ts(vao), check_out_at: ra !== null ? ts(ra) : null, late_minutes: vao - ex.vao > g ? vao - ex.vao : 0, early_minutes: ra !== null && ex.ra - ra > 0 ? ex.ra - ra : 0, source: 'manual' };
  const note = 'Bổ sung bởi ' + ctx.emp.display_name + ': ' + String(f.lyDo).trim();
  const r = Att.rec(e.id, f.ngay);
  if (r) Repo.update('attendance_records', r.id, Object.assign(patch, { note: [r.note, note].filter(Boolean).join(' | ') }), ctx.userId);
  else Repo.insert('attendance_records', Object.assign(patch, { employee_id: e.id, date: f.ngay, period: U.month(f.ngay), note }), ctx.userId);
  Audit.log(ctx.userId, 'att.manual', 'attendance_records', null, { emp: e.employee_code, date: f.ngay, vao: f.vao, ra: f.ra });
  return true;
}, { write: true });
__route('att.setOfficeIp', (ctx, p) => {
  if (!ctx.isAdmin) fail('FORBIDDEN', 'Chỉ admin đặt IP văn phòng.');
  const ip = String(p.ip || '').trim();
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) fail('VALIDATION', 'Không đọc được IP của máy này.');
  const list = p.replace ? [ip] : [ip].concat(Att.ips().filter(x => x !== ip)).slice(0, 5);
  Settings.set('hr.ip_van_phong', list.join(','), ctx.userId);
  Audit.log(ctx.userId, 'att.set_ip', 'settings', null, { list });
  return list;
}, { write: true });

/* ============================== LƯƠNG ============================== */
const ITEM = { bonus: ['ThuongHoaHong', 1], commission: ['HoaHong', 1], insurance: ['BHXH', -1], pit: ['ThueTNCN', -1], advance: ['TamUng', -1], deduction: ['KhauTruKhac', -1] };
const Pay = {
  period(month, create) {
    let p = Repo.one('payroll_periods', x => x.period === month);
    if (!p && create) p = Repo.insert('payroll_periods', { period: month, status: 'draft', standard_rule: 'month_actual' });
    return p;
  },
  locked(month) { const p = Pay.period(month); return !!p && p.status !== 'draft'; },
  comp(empId, start, end) {
    return Repo.where('employee_compensations', c => c.employee_id === empId && c.effective_from <= end && (!c.effective_to || c.effective_to >= start))
      .sort((a, b) => a.effective_from < b.effective_from ? 1 : -1)[0] || null;
  },
  bank(empId) { const b = Repo.where('employee_bank_accounts', x => x.employee_id === empId); return b.find(x => x.is_primary) || b[0] || null; },
  content(month, emp) {
    return String(Settings.get('hr.noi_dung_ck_luong', 'NTG LUONG T{T} {Y} {MA}')).replace('{T}', month.slice(5)).replace('{Y}', month.slice(0, 4)).replace('{MA}', emp.employee_code);
  },
  calc(month, actor) {
    const per = Pay.period(month, true);
    if (per.status !== 'draft') fail('LOCKED', 'Lương tháng ' + month + ' đã chốt, không tính lại được.');
    const start = month + '-01', end = U.dIso(new Date(+month.slice(0, 4), +month.slice(5), 0)), today = U.today();
    const types = {}; Hr.types().forEach(t => types[t.id] = t);
    const reqType = {}; Repo.all('leave_requests').forEach(r => reqType[r.id] = r.leave_type_id);
    const leaveBy = {}; Repo.where('leave_request_days', d => d.period === month).forEach(d => {
      const t = types[reqType[d.leave_request_id]]; if (!t || !(d.work_value > 0)) return;
      ((leaveBy[d.employee_id] = leaveBy[d.employee_id] || {})[d.date] = leaveBy[d.employee_id][d.date] || []).push({ value: d.work_value, paid: t.paid, work: t.counts_as_work });
    });
    const att = {}; Repo.where('attendance_records', r => r.period === month).forEach(r => (att[r.employee_id] = att[r.employee_id] || []).push(r));
    const rate = Settings.num('hr.ty_le_bh_nld', 0.105), attStart = Settings.get('hr.ngay_bat_dau_cham_cong', '') || null;
    const slips = {}; Repo.where('payslips', s => s.payroll_period_id === per.id).forEach(s => slips[s.employee_id] = s);
    let n = 0;
    Ref.employees().forEach(e => {
      if (!e.hire_date || e.hire_date > end) return;
      if (e.termination_date && e.termination_date <= start) return;
      if (!e.termination_date && e.employment_status === 'terminated') return;
      if (e.employee_type === 'collaborator' && !Pay.comp(e.id, start, end)) return;
      const a = att[e.id] || [];
      const wd = PayrollCalc.workDays({ start, end, today, hire: e.hire_date, termination: e.termination_date, schedule: e.work_schedule, needAttendance: !!e.attendance_required, attendanceStart: attStart, holidays: Hr.holidays(), leaveDays: leaveBy[e.id] || {}, punched: new Set(a.map(r => r.date)) });
      const c = Pay.comp(e.id, start, end) || {};
      const sal = PayrollCalc.salary({ baseSalary: c.base_salary || 0, allowance: c.allowance || 0, standardDays: wd.standard, payableDays: wd.payable });
      const bank = Pay.bank(e.id) || {};
      const old = slips[e.id];
      const fields = { payroll_period_id: per.id, employee_id: e.id, standard_days: wd.standard, worked_days: wd.worked, outside_days: wd.outside, paid_leave_days: wd.paidLeave, payable_days: wd.payable, unpaid_leave_days: wd.unpaid, absent_days: wd.absent,
        late_count: a.filter(r => r.late_minutes > 0).length, base_salary: c.base_salary || 0, allowance: c.allowance || 0, salary_amount: sal.salary, allowance_amount: sal.allowance,
        bank_bin: bank.bank_bin || null, account_no: bank.account_no || null, account_name: bank.account_name || null, transfer_content: Pay.content(month, e), calculated_at: U.now() };
      const slip = old ? Repo.update('payslips', old.id, fields, actor) : Repo.insert('payslips', Object.assign(fields, { payment_status: 'unpaid', earnings_extra: 0, deductions: 0, net_amount: 0 }), actor);
      const ins = Math.round((c.insurance_salary || 0) * rate);
      Pay.setItem(slip, 'insurance', ins, null, actor);
      Pay.refresh(slip, actor); n++;
    });
    Audit.log(actor, 'payroll.calc', 'payroll_periods', per.id, { month, n });
    return n;
  },
  items(slipId) { return Repo.where('payslip_items', i => i.payslip_id === slipId); },
  setItem(slip, type, amount, note, actor) {
    const it = Pay.items(slip.id).find(i => i.item_type === type);
    amount = Math.round(Number(amount) || 0);
    if (it) { if (it.amount !== amount || (note !== null && note !== undefined && note !== it.note)) Repo.update('payslip_items', it.id, { amount, note: note === null || note === undefined ? it.note : note }, actor); }
    else if (amount) Repo.insert('payslip_items', { payslip_id: slip.id, item_type: type, sign: ITEM[type][1], amount, note: note || null }, actor);
  },
  refresh(slip, actor) {
    const s = Repo.get('payslips', slip.id);
    const r = PayrollCalc.net(s.salary_amount, s.allowance_amount, Pay.items(s.id));
    if (s.earnings_extra !== r.earningsExtra || s.deductions !== r.deductions || s.net_amount !== r.net) Repo.update('payslips', s.id, { earnings_extra: r.earningsExtra, deductions: r.deductions, net_amount: r.net }, actor);
  },
  /** Hàng dữ liệu cho màn Trả lương / Phiếu lương (giữ đúng tên trường giao diện đang dùng) */
  view(s, month, e) {
    const its = {}; Pay.items(s.id).forEach(i => its[i.item_type] = i);
    const amt = k => its[k] ? its[k].amount : 0;
    const net = PayrollCalc.net(s.salary_amount, s.allowance_amount, Object.values(its)).net;
    const bankName = (Pay.bank(e.id) || {}).bank_name || '';
    return { Thang: month, MaNV: e.employee_code, HoTen: e.full_name, BoPhan: Hr.dept(e.department_id), LuongCoBan: s.base_salary, PhuCap: s.allowance, CongChuan: s.standard_days, CongDiLam: s.worked_days, CongCT_WFH: s.outside_days,
      CongPhep: s.paid_leave_days, CongHuongLuong: s.payable_days, NghiKhongLuong: s.unpaid_leave_days, VangKhongPhep: s.absent_days, LanDiMuon: s.late_count, QuenChamRa: 0,
      LuongTheoCong: s.salary_amount, PhuCapTheoCong: s.allowance_amount, ThuongHoaHong: amt('bonus') + amt('commission'), Thuong: amt('bonus'), HoaHong: amt('commission'), BHXH: amt('insurance'), ThueTNCN: amt('pit'), TamUng: amt('advance'), KhauTruKhac: amt('deduction'),
      ThucLinh: net, NganHang: bankName, BIN: s.bank_bin || '', SoTaiKhoan: s.account_no || '', ChuTaiKhoan: s.account_name || '', NoiDungCK: s.transfer_content || '',
      LinkQR: PayrollCalc.vietQr(s.bank_bin, s.account_no, net, s.transfer_content, s.account_name), TrangThai: s.payment_status === 'paid' ? 'Đã chuyển' : 'Chưa chuyển',
      ChuyenLuc: s.paid_at ? String(s.paid_at).replace('T', ' ').slice(0, 16) : '', GhiChu: (its.bonus && its.bonus.note) || '' };
  },
  list(month, ids) {
    const per = Pay.period(month); if (!per) return [];
    return Repo.where('payslips', s => s.payroll_period_id === per.id && (ids === null || ids.has(s.employee_id)))
      .map(s => ({ s, e: Ref.emp(s.employee_id) })).filter(x => x.e).sort((a, b) => a.e.employee_code < b.e.employee_code ? -1 : 1).map(x => Pay.view(x.s, month, x.e));
  }
};
const needMonth = m => { if (!/^\d{4}-\d{2}$/.test(String(m || ''))) fail('VALIDATION', 'Tháng không hợp lệ.'); return m; };
__route('pay.list', (ctx, p) => {
  const month = needMonth(p.month);
  const canCalc = Policy.scope(ctx, 'pay.payroll.calc') === 'all';
  if (!canCalc && Policy.scope(ctx, 'pay.payroll.pay') !== 'all') fail('FORBIDDEN', 'Bạn không có quyền xem bảng lương công ty.');
  const locked = Pay.locked(month);
  if (canCalc && !locked && (p.recalc || !Pay.period(month))) { Pay.calc(month, ctx.userId); REQ_.tables = {}; }
  return { month, locked, rows: Pay.list(month, null) };
}, { write: true });
/** Trưởng nhóm / trưởng phòng xem phiếu lương người trong phạm vi */
__route('pay.slips', (ctx, p) => {
  const month = needMonth(p.month);
  return { month, locked: Pay.locked(month), rows: Pay.list(month, Policy.employeeIds(ctx, 'pay.payslip.view')).map(r => Policy.strip(r, ['BIN', 'SoTaiKhoan', 'ChuTaiKhoan', 'LinkQR'])) };
});
__route('pay.items.set', (ctx, p) => {
  if (Policy.scope(ctx, 'pay.payroll.calc') !== 'all') fail('FORBIDDEN', 'Bạn không có quyền nhập khoản lương.');
  const month = needMonth(p.month); if (Pay.locked(month)) fail('LOCKED', 'Lương tháng này đã chốt.');
  const e = Ref.empByCode(p.code); const per = Pay.period(month);
  const s = per && Repo.one('payslips', x => x.payroll_period_id === per.id && x.employee_id === (e || {}).id);
  if (!s) fail('NOT_FOUND', 'Chưa có phiếu lương. Bấm Tính lại lương trước.');
  ['bonus', 'commission', 'pit', 'advance', 'deduction'].forEach(k => { if (p[k] !== undefined) Pay.setItem(s, k, p[k], k === 'bonus' ? (p.note || null) : null, ctx.userId); });
  Pay.refresh(s, ctx.userId);
  Audit.log(ctx.userId, 'payroll.items', 'payslips', s.id, p);
  return Pay.view(Repo.get('payslips', s.id), month, e);
}, { write: true });
__route('pay.markPaid', (ctx, p) => {
  if (Policy.scope(ctx, 'pay.payroll.pay') !== 'all') fail('FORBIDDEN', 'Bạn không có quyền xác nhận chuyển lương.');
  const month = needMonth(p.month), e = Ref.empByCode(p.code), per = Pay.period(month);
  const s = per && e && Repo.one('payslips', x => x.payroll_period_id === per.id && x.employee_id === e.id);
  if (!s) fail('NOT_FOUND', 'Không thấy phiếu lương.');
  Repo.update('payslips', s.id, p.paid ? { payment_status: 'paid', paid_at: U.now(), paid_by: ctx.userId } : { payment_status: 'unpaid', paid_at: null, paid_by: null }, ctx.userId);
  Audit.log(ctx.userId, p.paid ? 'payroll.paid' : 'payroll.unpaid', 'payslips', s.id, { month, emp: e.employee_code });
  return true;
}, { write: true });
__route('pay.lock', (ctx, p) => {
  Policy.need(ctx, 'pay.payroll.lock');
  const month = needMonth(p.month), per = Pay.period(month);
  if (!per) fail('NOT_FOUND', 'Chưa tính lương tháng này.');
  Repo.update('payroll_periods', per.id, { status: 'locked', locked_at: U.now(), locked_by: ctx.userId }, ctx.userId);
  Audit.log(ctx.userId, 'payroll.lock', 'payroll_periods', per.id, { month });
  return true;
}, { write: true });
__route('pay.mySlips', ctx => {
  const per = {}; Repo.where('payroll_periods', p => p.status !== 'draft').forEach(p => per[p.id] = p.period);
  return Repo.where('payslips', s => s.employee_id === ctx.emp.id && per[s.payroll_period_id]).map(s => Policy.strip(Pay.view(s, per[s.payroll_period_id], ctx.emp), ['LinkQR', 'GhiChu']))
    .sort((a, b) => a.Thang < b.Thang ? 1 : -1).slice(0, 12);
});

/* ============================== BÁO CÁO NHÂN SỰ (thay công thức ô) ============================== */
const Rpt = {
  monthly(month) {
    const start = month + '-01', end = U.dIso(new Date(+month.slice(0, 4), +month.slice(5), 0)), today = U.today(), hol = Hr.holidays();
    const types = {}; Hr.types().forEach(t => types[t.id] = t);
    const req = {}; Repo.all('leave_requests').forEach(r => req[r.id] = r);
    const ld = Repo.where('leave_request_days', d => d.period === month);
    const att = {}; Repo.where('attendance_records', r => r.period === month).forEach(r => (att[r.employee_id] = att[r.employee_id] || {})[r.date] = r);
    const emps = Ref.employees().filter(e => e.hire_date && e.hire_date <= end && (e.termination_date ? e.termination_date > start : e.employment_status !== 'terminated')).sort((a, b) => a.employee_code < b.employee_code ? -1 : 1);
    const SYM = ['P', 'H', 'Ô', 'TS', 'KL', 'KP', 'CT', 'WFH'];
    const attStart = Settings.get('hr.ngay_bat_dau_cham_cong', '') || null;
    const head = ['MaNV', 'Họ tên', 'Bộ phận', 'Nhóm lịch', 'Công chuẩn', 'Phép năm (P)', 'Việc riêng có lương (H)', 'Ốm (Ô)', 'Thai sản (TS)', 'Không lương (KL)', 'Không phép (KP)', 'Công tác (CT)', 'Từ xa (WFH)', 'Giờ đi muộn/về sớm', 'Nghỉ có lương', 'Nghỉ không lương từ cty', 'CÔNG HƯỞNG LƯƠNG', 'Công có mặt', 'Đơn báo gấp', 'Điểm trừ CC', 'Vắng không chấm công'];
    const rows = [], grid = [];
    const days = [], wd = [];
    for (let i = 1; i <= 31; i++) { const d = month + '-' + U.pad(i); if (d <= end) { days.push(U.pad(i)); wd.push(['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][U.dow(d)]); } else { days.push(''); wd.push(''); } }
    emps.forEach(e => {
      const mine = ld.filter(d => d.employee_id === e.id);
      const sum = sym => mine.filter(d => (types[(req[d.leave_request_id] || {}).leave_type_id] || {}).symbol === sym).reduce((s, d) => s + d.work_value, 0);
      const by = {}; mine.forEach(d => { const t = types[(req[d.leave_request_id] || {}).leave_type_id]; if (t && d.work_value > 0) (by[d.date] = by[d.date] || []).push({ value: d.work_value, paid: t.paid, work: t.counts_as_work }); });
      const w = PayrollCalc.workDays({ start, end, today, hire: e.hire_date, termination: e.termination_date, schedule: e.work_schedule, needAttendance: !!e.attendance_required, attendanceStart: attStart, holidays: hol, leaveDays: by, punched: new Set(Object.keys(att[e.id] || {})) });
      const v = SYM.map(sum), hours = mine.filter(d => d.half === 'hours').reduce((s, d) => s + d.hours, 0);
      const paid = v[0] + v[1], unpaid = v[2] + v[3] + v[4] + v[5];
      const late = Object.values(req).filter(r => r.employee_id === e.id && r.is_late_notice && r.status === 'approved' && r.start_date >= start && r.start_date <= end).length;
      const pen = mine.reduce((s, d) => s + (d.penalty_points || 0), 0);
      rows.push([e.employee_code, e.full_name, Hr.dept(e.department_id), e.work_schedule === 'warehouse' ? 'KHO' : 'VP', w.standard].concat(v, [hours, paid, unpaid, w.payable, w.worked + w.outside, late, pen, w.absent]));
      const cells = days.map((dd, i) => {
        if (!dd) return '';
        const d = month + '-' + dd, dow = U.dow(d);
        const ks = mine.filter(x => x.date === d && x.work_value > 0).map(x => (types[(req[x.leave_request_id] || {}).leave_type_id] || {}).symbol + (x.work_value === 0.5 ? '/2' : ''));
        if (ks.length) return ks.join(' ');
        if (hol.indexOf(d) >= 0) return 'L';
        const punched = !!(att[e.id] || {})[d];
        if (dow === 0) return punched ? 'x+' : '';
        if (e.hire_date > d || (e.termination_date && d >= e.termination_date)) return '';
        const base = dow === 6 && e.work_schedule !== 'warehouse' ? 'x/2' : 'x';
        if (!e.attendance_required || punched || (attStart && d < attStart)) return d > today && e.attendance_required ? '' : base;
        return d >= today ? '' : 'V';
      });
      grid.push([e.employee_code, e.full_name, e.work_schedule === 'warehouse' ? 'KHO' : 'VP'].concat(cells));
    });
    return { month, head, rows, days, wd, grid };
  },
  score(year) {
    const types = {}; Hr.types().forEach(t => types[t.id] = t);
    const req = {}; Repo.all('leave_requests').forEach(r => req[r.id] = r);
    const ld = Repo.where('leave_request_days', d => d.date.slice(0, 4) === String(year));
    const ar = Repo.where('attendance_records', r => r.date.slice(0, 4) === String(year));
    const per = Settings.num('hr.diem_tru_muon', 1);
    const head = ['MaNV', 'Họ tên', 'Bộ phận', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'Tổng ngày vắng', 'Phép năm', 'Không lương', 'Không phép', 'Ốm', 'Lần muộn/về sớm (chấm công)', 'Đơn báo gấp', 'Điểm trừ', 'ĐIỂM CC', 'Xếp loại'];
    const rows = Ref.employees().filter(e => e.hire_date && e.hire_date <= year + '-12-31' && (e.termination_date ? e.termination_date > year + '-01-01' : e.employment_status !== 'terminated')).sort((a, b) => a.employee_code < b.employee_code ? -1 : 1).map(e => {
      const mine = ld.filter(d => d.employee_id === e.id), t = d => types[(req[d.leave_request_id] || {}).leave_type_id] || {};
      const absent = mine.filter(d => !t(d).counts_as_work);
      const months = []; for (let m = 1; m <= 12; m++) months.push(absent.filter(d => +d.date.slice(5, 7) === m).reduce((s, d) => s + d.work_value, 0));
      const sum = sym => mine.filter(d => t(d).symbol === sym).reduce((s, d) => s + d.work_value, 0);
      const lateN = ar.filter(r => r.employee_id === e.id).reduce((s, r) => s + (r.late_minutes > 0 ? 1 : 0) + (r.early_minutes > 0 ? 1 : 0), 0);
      const notices = Object.values(req).filter(r => r.employee_id === e.id && r.is_late_notice && r.status === 'approved' && r.start_date.slice(0, 4) === String(year)).length;
      const pen = mine.reduce((s, d) => s + (d.penalty_points || 0), 0) + lateN * per;
      const score = Math.max(0, 100 - pen);
      return [e.employee_code, e.full_name, Hr.dept(e.department_id)].concat(months, [months.reduce((a, b) => a + b, 0), sum('P'), sum('KL'), sum('KP'), sum('Ô'), lateN, notices, pen, score,
        score >= 95 ? 'A - Rất chuyên cần' : score >= 85 ? 'B - Tốt' : score >= 70 ? 'C - Cần nhắc nhở' : 'D - Báo động']);
    });
    return { year, head, rows };
  }
};
__route('rpt.hr.monthly', (ctx, p) => { Policy.need(ctx, 'rpt.hr'); return Rpt.monthly(needMonth(p.month)); });
__route('rpt.hr.attendanceScore', (ctx, p) => { Policy.need(ctx, 'rpt.hr'); return Rpt.score(Number(p.year) || new Date().getFullYear()); });
