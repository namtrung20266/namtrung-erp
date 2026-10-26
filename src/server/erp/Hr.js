/*****************************************************************
 * NAM TRUNG ERP v2 — TẦNG NGHIỆP VỤ NHÂN SỰ (L3 Services)
 * Chỉ dùng Repo / Ref / Settings / Policy. Không gọi SpreadsheetApp trực tiếp.
 * Các khối *Calc là hàm thuần: nhận số liệu, trả số liệu (bê nguyên lên server được).
 *****************************************************************/
var __route = __route || function (name, fn, opt) { (globalThis.__ROUTES = globalThis.__ROUTES || {})[name] = Object.assign({ fn: fn }, opt || {}); };  // đăng ký route, không phụ thuộc thứ tự file


const LEAVE_ST = { pending: 'Chờ duyệt', pending_director: 'Chờ CEO duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', cancelled: 'Đã hủy', cancel_requested: 'Xin hủy' };
const HALF_VN = { am: 'Sáng', pm: 'Chiều' };
const vnHalf = h => HALF_VN[h] || '';
const halfOf = (s, def) => s === 'Chiều' || s === 'pm' ? 'pm' : s === 'Sáng' || s === 'am' ? 'am' : def;

/* ============================== HÀM TÍNH THUẦN ============================== */
const LeaveCalc = {
  /** Bung một đơn thành từng ngày công theo lịch (office: T7 chỉ buổi sáng; warehouse: T7 cả ngày), bỏ CN và lễ */
  days(schedule, start, startHalf, end, endHalf, holidays) {
    const out = []; if (!start || !end || end < start) return out;
    const hol = new Set(holidays || []);
    for (let d = start; d <= end; d = U.addDays(d, 1)) {
      const wd = U.dow(d); if (wd === 0 || hol.has(d)) continue;
      const avail = (wd === 6 && schedule !== 'warehouse') ? ['am'] : ['am', 'pm'];
      const s = d === start ? startHalf : 'am', e = d === end ? endHalf : 'pm';
      const h = []; if (s === 'am') h.push('am'); if (e === 'pm') h.push('pm');
      const use = h.filter(x => avail.indexOf(x) >= 0); if (!use.length) continue;
      out.push({ date: d, halves: use, value: use.length * 0.5, half: use.length === 2 ? 'full' : use[0] });
    }
    return out;
  },
  /** Quỹ phép năm (thay công thức tab QUY_PHEP của v1) */
  balance(p) {
    // p: { year, today, hireDate, standard, seniorityStep, expireMonth, carried, adjustment, used, usedBeforeExpiry, pending }
    const y = p.year, jan1 = y + '-01-01', dec31 = y + '-12-31';
    const tn = p.hireDate ? Math.max(0, y - +p.hireDate.slice(0, 4) - (p.hireDate.slice(5) > '12-31' ? 1 : 0)) : 0;
    const std = p.standard + Math.floor(tn / p.seniorityStep);
    const s = (p.hireDate && p.hireDate > jan1) ? p.hireDate : jan1;
    const sm = +s.slice(5, 7), sd = +s.slice(8, 10), add = sd <= 15 ? 1 : 0;
    const months = s > dec31 ? 0 : 12 - sm + add;
    const floorHalf = x => Math.floor(x * 2) / 2;
    const entitled = floorHalf(std * months / 12);
    const e = p.today < dec31 ? p.today : dec31;
    const m2 = s > e ? 0 : (+e.slice(0, 4) - +s.slice(0, 4)) * 12 + (+e.slice(5, 7)) - sm + add;
    const accrued = Math.min(entitled, floorHalf(std * m2 / 12));
    const exp = U.dIso(new Date(y, p.expireMonth, 0));
    const carriedValid = p.today <= exp ? p.carried : Math.min(p.carried, p.usedBeforeExpiry);
    const base = carriedValid + p.adjustment - p.used - p.pending;
    return { duocHuong: entitled, tichLuy: accrued, ton: carriedValid, dieuChinh: p.adjustment, daDung: p.used, dangCho: p.pending, conLai: entitled + base, conLaiTL: accrued + base, chuanNam: std };
  }
};

const PayrollCalc = {
  salary(p) {
    if (!(p.standardDays > 0)) return { salary: 0, allowance: 0 };
    return { salary: Math.round(p.baseSalary * p.payableDays / p.standardDays), allowance: Math.round(p.allowance * p.payableDays / p.standardDays) };
  },
  net(salary, allowance, items) {
    const plus = items.filter(i => i.sign > 0).reduce((s, i) => s + i.amount, 0);
    const minus = items.filter(i => i.sign < 0).reduce((s, i) => s + i.amount, 0);
    return { earningsExtra: plus, deductions: minus, net: Math.max(0, Math.round(salary + allowance + plus - minus)) };
  },
  vietQr(bin, acc, amount, info, name) {
    if (!bin || !acc || !(amount > 0)) return '';
    return 'https://img.vietqr.io/image/' + String(bin).trim() + '-' + String(acc).trim() + '-compact2.png?amount=' + Math.round(amount) +
      '&addInfo=' + encodeURIComponent(String(info || '')) + '&accountName=' + encodeURIComponent(String(name || ''));
  },
  /** Công của 1 người trong tháng (thay logic tính tay + công thức BANG_CONG) */
  workDays(p) {
    // p: { start, end, today, hire, termination, schedule, needAttendance, attendanceStart, holidays, leaveDays: {date:[{value,paid,work}]}, punched: Set(date) }
    const hol = new Set(p.holidays); let std = 0, worked = 0, outside = 0, paid = 0, unpaid = 0, absent = 0;
    for (let d = p.start; d <= p.end; d = U.addDays(d, 1)) {
      if (p.hire && d < p.hire) continue; if (p.termination && d >= p.termination) continue;
      const wd = U.dow(d); if (wd === 0 || hol.has(d)) continue;
      const v = (wd === 6 && p.schedule !== 'warehouse') ? 0.5 : 1; std += v;
      let w = 0, pd = 0, up = 0;
      (p.leaveDays[d] || []).forEach(x => { if (x.work) w += x.value; else if (x.paid) pd += x.value; else up += x.value; });
      w = Math.min(w, v); pd = Math.min(pd, v - w); up = Math.min(up, v - w - pd);
      outside += w; paid += pd; unpaid += up;
      const rem = v - w - pd - up; if (rem <= 0) continue;
      if (!p.needAttendance || p.punched.has(d) || (p.attendanceStart && d < p.attendanceStart)) worked += rem;
      else if (d < p.today) absent += rem;
    }
    return { standard: std, worked, outside, paidLeave: paid, unpaid, absent, payable: worked + outside + paid };
  }
};

/* ============================== DỮ LIỆU DÙNG CHUNG ============================== */
const Hr = {
  types() { return Ref.ref().leaveTypes; },
  type(id) { return Hr.types().find(t => t.id === id) || null; },
  holidays() { return Ref.ref().holidays; },
  active() { return Ref.employees().filter(e => e.employment_status !== 'terminated'); },
  name(id) { const e = Ref.emp(id); return e ? e.display_name : ''; },
  dept(id) { const d = Ref.ref().departments.find(x => x.id === id); return d ? d.name : ''; },
  admins() { const z = Authz.snapshot(); const role = z.roles.find(r => r.code === 'admin'); return z.userRoles.filter(r => role && r.role_id === role.id && !r.valid_to).map(r => z.users.find(u => u.id === r.user_id)).filter(Boolean).map(u => Ref.emp(u.employee_id)).filter(Boolean); },
  isAdminEmp(empId) { return Hr.admins().some(a => a.id === empId); },
  userOf(empId) { return Authz.snapshot().users.find(u => u.employee_id === empId) || null; },
  balanceOf(emp) {
    const year = Settings.num('hr.nam', new Date().getFullYear());
    const deduct = new Set(Hr.types().filter(t => t.deduct_annual).map(t => t.id));
    const reqs = Repo.where('leave_requests', r => r.employee_id === emp.id);
    const reqType = {}; reqs.forEach(r => reqType[r.id] = r.leave_type_id);
    const exp = U.dIso(new Date(year, Settings.num('hr.thang_het_han_ton', 3), 0));
    let used = 0, usedBefore = 0;
    Repo.where('leave_request_days', d => d.employee_id === emp.id && d.date.slice(0, 4) === String(year) && deduct.has(reqType[d.leave_request_id]))
      .forEach(d => { used += d.work_value; if (d.date <= exp) usedBefore += d.work_value; });
    const pending = reqs.filter(r => (r.status === 'pending' || r.status === 'pending_director') && deduct.has(r.leave_type_id) && r.start_date.slice(0, 4) === String(year)).reduce((s, r) => s + r.days, 0);
    const lb = Repo.one('leave_balances', b => b.employee_id === emp.id && b.year === year) || {};
    return LeaveCalc.balance({ year, today: U.today(), hireDate: emp.hire_date, standard: Settings.num('hr.phep_chuan', 12), seniorityStep: Settings.num('hr.tham_nien_nam', 5), expireMonth: Settings.num('hr.thang_het_han_ton', 3), carried: lb.carried_over || 0, adjustment: lb.adjustment || 0, used, usedBeforeExpiry: usedBefore, pending });
  },
  mail(to, subject, html) {
    if (U.up(Settings.get('hr.email_thong_bao_bat', 'CO')) !== 'CO' || !to) return;
    try { MailApp.sendEmail({ to: String(to), subject: '[Nam Trung] ' + subject, name: 'Nam Trung · Nhân sự', htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px;color:#17153B;max-width:520px">' + html + '</div>' }); } catch (e) { }
  },
  btn(label, q) { let u = ''; try { u = ScriptApp.getService().getUrl() || ''; } catch (e) { } return u ? '<p><a href="' + u + q + '" style="display:inline-block;background:#5B4BFF;color:#fff;padding:10px 18px;border-radius:12px;text-decoration:none;font-weight:700">' + label + '</a></p>' : ''; }
};

/* ============================== KHỞI ĐỘNG ỨNG DỤNG ============================== */
function legacyRole_(ctx) {
  if (ctx.isAdmin) return 'ADMIN';
  if (ctx.roles.indexOf('hr') >= 0) return 'HCNS';
  if (ctx.roles.indexOf('accountant') >= 0) return 'KETOAN';
  if (ctx.roles.indexOf('sales_leader') >= 0 || ctx.roles.indexOf('sales_manager') >= 0) return 'QL';
  return 'NV';
}
__route('app.bootstrap', ctx => {
  const e = ctx.emp;
  const selfOnly = !Policy.scope(ctx, 'hr.leave.view') || Policy.scope(ctx, 'hr.leave.view') === 'self';
  const canOther = Policy.scope(ctx, 'att.manual') === 'all';
  return {
    me: { ma: e.employee_code, ten: e.display_name, hoTen: e.full_name, boPhan: Hr.dept(e.department_id), chucDanh: e.position || '', role: legacyRole_(ctx), roles: ctx.roles, perms: Object.keys(ctx.perms).concat(ctx.isAdmin ? ['*'] : []),
          mustChange: !!ctx.user.must_change_password, thuViec: e.employment_status === 'probation', chamCong: !!e.attendance_required, punch: e.attendance_required ? Att.today(e.id) : null },
    types: Hr.types().filter(t => t.self_service || canOther).map(t => ({ ma: t.code, ten: t.name, donVi: t.unit === 'hour' ? 'GIO' : 'NGAY', truPhep: t.deduct_annual, baoTruoc: t.notice_days, ghiChu: '', tinhCong: t.counts_as_work })),
    people: Hr.active().map(x => ({ ma: x.employee_code, ten: x.display_name, boPhan: Hr.dept(x.department_id) })),
    bal: Hr.balanceOf(e),
    pending: Policy.scope(ctx, 'hr.leave.approve') ? Leave.pendingFor(ctx).length : 0,
    cfg: { ten: Settings.get('hr.ten_cong_ty', 'Nam Trung Group'), nam: Settings.num('hr.nam', 2026), khoa: Settings.get('hr.ky_da_khoa', ''), soNgay: Settings.num('hr.so_ngay_lich', 14) },
    selfOnly,
    crm: ctx.isAdmin || ['accountant', 'sales', 'sales_leader', 'sales_manager'].some(r => ctx.roles.indexOf(r) >= 0),
    webUrl: (function () { try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } })()
  };
});

/* ============================== NGHỈ PHÉP ============================== */
const Leave = {
  view(r, withReason) {
    const t = Hr.type(r.leave_type_id) || {}, e = Ref.emp(r.employee_id) || {};
    return { id: r.id, no: r.request_no, tao: String(r.created_at || '').replace('T', ' ').slice(0, 16), ma: e.employee_code, ten: e.display_name, boPhan: Hr.dept(e.department_id),
      loai: t.code, tenLoai: t.name, tu: r.start_date, tuBuoi: vnHalf(r.start_half), den: r.end_date, denBuoi: vnHalf(r.end_half), tuGio: r.start_time || '', denGio: r.end_time || '',
      soNgay: r.days || 0, soGio: r.hours || 0, lyDo: withReason ? (r.reason || '') : '', banGiao: withReason ? (r.handover_note || '') : '', hoTro: Hr.name(r.backup_employee_id),
      baoGap: !!r.is_late_notice, tt: LEAVE_ST[r.status] || r.status, status: r.status, ghiChu: r.decision_note || '' };
  },
  canApprove(ctx, r, owner) {
    if (!owner) return ctx.isAdmin;
    if (owner.id === ctx.emp.id && !ctx.isAdmin) return false;
    if (ctx.isAdmin) return true;
    if (r.status === 'pending_director') return false;
    const s = Policy.scope(ctx, 'hr.leave.approve'); if (!s) return false;
    if (s === 'all') return true;
    if (owner.manager_employee_id === ctx.emp.id) return true;
    if (owner.team_id && ctx.teamIds.indexOf(owner.team_id) >= 0) return true;
    return s === 'department' && ctx.deptIds.indexOf(owner.department_id) >= 0;
  },
  pendingFor(ctx) { return Repo.where('leave_requests', r => ['pending', 'pending_director', 'cancel_requested'].indexOf(r.status) >= 0 && Leave.canApprove(ctx, r, Ref.emp(r.employee_id))); },
  approverEmails(owner, directorOnly) {
    const admins = Hr.admins().map(a => a.email_work).filter(Boolean);
    if (directorOnly || !owner || !owner.manager_employee_id) return admins;
    const m = Ref.emp(owner.manager_employee_id); return m && m.email_work ? [m.email_work] : admins;
  },
  ownKeys(emp, exceptId) {
    const keys = {};
    Repo.where('leave_request_days', d => d.employee_id === emp.id && d.work_value > 0 && d.leave_request_id !== exceptId)
      .forEach(d => (d.half === 'full' ? ['am', 'pm'] : [d.half]).forEach(h => keys[d.date + h] = d.leave_request_id));
    Repo.where('leave_requests', r => r.employee_id === emp.id && (r.status === 'pending' || r.status === 'pending_director') && r.id !== exceptId).forEach(r => {
      const t = Hr.type(r.leave_type_id); if (!t || t.unit === 'hour') return;
      LeaveCalc.days(emp.work_schedule, r.start_date, r.start_half, r.end_date, r.end_half, Hr.holidays()).forEach(x => x.halves.forEach(h => keys[x.date + h] = r.id));
    });
    return keys;
  },
  teamCount(emp, days) {
    const set = new Set(days.map(x => x.date)), cnt = {}, seen = {};
    const workTypes = new Set(Hr.types().filter(t => t.counts_as_work).map(t => t.id));
    const reqType = {}; Repo.all('leave_requests').forEach(r => reqType[r.id] = r.leave_type_id);
    Repo.where('leave_request_days', d => set.has(d.date) && d.employee_id !== emp.id && d.work_value > 0 && !workTypes.has(reqType[d.leave_request_id])).forEach(d => {
      const o = Ref.emp(d.employee_id); if (!o || o.department_id !== emp.department_id) return;
      const k = d.date + '|' + d.employee_id; if (seen[k]) return; seen[k] = 1; cnt[d.date] = (cnt[d.date] || 0) + 1;
    });
    return cnt;
  },
  validate(ctx, target, f) {
    const errs = [], warns = [];
    const t = Hr.types().find(x => x.code === f.loai);
    if (!t) return { errs: ['Chọn loại nghỉ.'], warns };
    const hrAll = Policy.scope(ctx, 'att.manual') === 'all';
    if (!t.self_service && !hrAll) errs.push('Loại này chỉ HCNS ghi nhận.');
    const start = f.tuNgay, end = t.unit === 'hour' ? f.tuNgay : f.denNgay;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(end || '')) return { errs: ['Chọn ngày.'], warns, t };
    const sh = halfOf(f.tuBuoi, 'am'), eh = halfOf(f.denBuoi, 'pm');
    if (end < start) errs.push('Ngày kết thúc phải từ ngày bắt đầu trở đi.');
    if (t.unit !== 'hour' && start === end && sh === 'pm' && eh === 'am') errs.push('Buổi bắt đầu phải trước buổi kết thúc.');
    if ((U.toDate(end) - U.toDate(start)) / 864e5 > (t.code === 'TS' ? 200 : 62)) errs.push('Khoảng nghỉ quá dài, hãy tách thành nhiều đơn.');
    const lock = String(Settings.get('hr.ky_da_khoa', '') || '');
    if (lock && U.month(start) <= lock && !ctx.isAdmin) errs.push('Tháng ' + U.month(start) + ' đã chốt công. Báo HCNS nếu cần điều chỉnh.');
    if (String(f.lyDo || '').trim().length < 3) errs.push('Ghi lý do (chỉ người duyệt nhìn thấy).');
    let days = [], soNgay = 0, soGio = 0;
    if (t.unit === 'hour') {
      const a = U.min(f.tuGio), b = U.min(f.denGio);
      if (a === null || b === null || b <= a) errs.push('Giờ bắt đầu/kết thúc chưa hợp lệ.'); else soGio = Math.round((b - a) / 30) * 0.5;
    } else if (!errs.length) {
      days = LeaveCalc.days(target.work_schedule, start, sh, end, eh, Hr.holidays());
      soNgay = days.reduce((s, x) => s + x.value, 0);
      if (!soNgay) errs.push('Khoảng thời gian này không rơi vào ngày làm việc nào (CN/lễ/chiều T7).');
    }
    if (errs.length) return { errs, warns, t };
    if (days.length) {
      const keys = Leave.ownKeys(target);
      const dup = days.find(x => x.halves.some(h => keys[x.date + h]));
      if (dup) errs.push('Đã có đơn khác trùng ngày ' + U.vn(dup.date) + '.');
    }
    if (t.deduct_annual && target.employment_status === 'probation' && U.up(Settings.get('hr.thu_viec_dung_phep', 'KHONG')) !== 'CO') errs.push('Đang thử việc chưa dùng phép năm. Chọn "Nghỉ không lương".');
    let bal = null;
    if (t.deduct_annual && !errs.length) {
      bal = Hr.balanceOf(target);
      if (+start.slice(0, 4) !== Settings.num('hr.nam', 2026)) warns.push('Đơn thuộc năm ' + start.slice(0, 4) + ', quỹ phép năm đó chưa mở. HCNS sẽ đối chiếu.');
      else if (soNgay > bal.conLai + Settings.num('hr.cho_am_phep', 0)) errs.push('Bạn còn ' + bal.conLai + ' ngày phép, đơn này cần ' + soNgay + '. Tách phần vượt sang "Nghỉ không lương".');
    }
    let baoGap = false;
    if (t.notice_days > 0 && target.id === ctx.emp.id) {
      const st = U.toDate(start);
      if (t.unit === 'hour') { const mm = U.min(f.tuGio) || 480; st.setHours(Math.floor(mm / 60), mm % 60); } else st.setHours(sh === 'pm' ? 13 : 8, sh === 'pm' ? 30 : 0);
      if ((st - new Date()) / 36e5 < t.notice_days * 24) { baoGap = true; warns.push('Đơn báo gấp: loại này cần báo trước ' + t.notice_days + ' ngày. Vẫn gửi được nhưng bị tính vào điểm chuyên cần.'); }
    }
    if (!t.counts_as_work && days.length) {
      const ng = Settings.num('hr.nguong_trung_bo_phan', 2), cnt = Leave.teamCount(target, days);
      const hot = Object.keys(cnt).filter(k => cnt[k] >= ng);
      if (hot.length) warns.push('Bộ phận ' + Hr.dept(target.department_id) + ' đã có ' + ng + '+ người nghỉ ngày ' + hot.map(U.vn).join(', ') + '.');
    }
    const needDirector = t.need_director || soNgay > Settings.num('hr.nguong_ceo_duyet', 3);
    if (needDirector && !Hr.isAdminEmp(target.id)) warns.push('Đơn này cần CEO duyệt thêm sau quản lý trực tiếp.');
    return { errs, warns, t, start, end, sh, eh, days, soNgay, soGio, baoGap, bal, needDirector };
  },
  target(ctx, f) {
    if (f.maNV && U.up(f.maNV) !== ctx.emp.employee_code) {
      if (Policy.scope(ctx, 'att.manual') !== 'all') fail('FORBIDDEN', 'Bạn không có quyền tạo đơn cho người khác.');
      const t = Ref.empByCode(f.maNV); if (!t) fail('NOT_FOUND', 'Không tìm thấy nhân sự ' + f.maNV); return t;
    }
    return ctx.emp;
  },
  writeDays(r, emp, t) {
    let rows;
    if (t.unit === 'hour') rows = [{ date: r.start_date, half: 'hours', value: 0, hours: r.hours, pen: t.penalty_points * r.hours }];
    else rows = LeaveCalc.days(emp.work_schedule, r.start_date, r.start_half, r.end_date, r.end_half, Hr.holidays()).map(x => ({ date: x.date, half: x.half, value: x.value, hours: 0, pen: t.penalty_points * x.value }));
    if (!rows.length) return;
    if (r.is_late_notice) rows[0].pen += Settings.num('hr.diem_tru_bao_gap', 2);
    Repo.insertMany('leave_request_days', rows.map(x => ({ leave_request_id: r.id, employee_id: emp.id, date: x.date, period: U.month(x.date), half: x.half, work_value: x.value, hours: x.hours, penalty_points: x.pen })));
  },
  nextNo() {
    const pre = 'NP' + Utilities.formatDate(new Date(), TZ, 'yyMM') + '-';
    let max = 0; Repo.all('leave_requests', { withDeleted: true }).forEach(r => { if (String(r.request_no).indexOf(pre) === 0) max = Math.max(max, Number(r.request_no.slice(pre.length)) || 0); });
    return pre + ('000' + (max + 1)).slice(-3);
  },
  notify(r, owner, title, directorOnly) {
    const to = Leave.approverEmails(owner, directorOnly); if (!to.length) return;
    const t = Hr.type(r.leave_type_id) || {};
    const when = r.start_time ? U.vn(r.start_date) + ' ' + r.start_time + '–' + r.end_time : U.vn(r.start_date) + ' (' + vnHalf(r.start_half) + ') → ' + U.vn(r.end_date) + ' (' + vnHalf(r.end_half) + ')';
    Hr.mail(to.join(','), title + ': ' + owner.display_name, '<p><b>' + U.esc(owner.full_name) + '</b> – ' + U.esc(Hr.dept(owner.department_id)) + '</p><p>' + U.esc(t.name) + ': ' + when + (r.days ? ' = <b>' + r.days + ' ngày</b>' : '') + '</p><p>Lý do: ' + U.esc(r.reason) + '</p>' + (r.is_late_notice ? '<p style="color:#d33">⚠ Đơn báo gấp</p>' : '') + Hr.btn('Mở trang duyệt', '?p=approve'));
  }
};
__route('hr.absence.board', ctx => {
  const n = Settings.num('hr.so_ngay_lich', 14), k0 = U.today(), k1 = U.addDays(k0, n);
  const reqs = {}; Repo.all('leave_requests').forEach(r => reqs[r.id] = r);
  const kind = t => !t ? 'off' : t.unit === 'hour' ? 'late' : t.counts_as_work ? 'out' : 'off';
  const label = (t, half, r) => !t ? 'Vắng' : t.unit === 'hour' ? t.public_label + ' ' + r.start_time + '–' + r.end_time : half === 'full' ? t.public_label : t.public_label + ' (' + vnHalf(half).toLowerCase() + ')';
  const out = [];
  Repo.where('leave_request_days', d => d.date >= k0 && d.date <= k1).forEach(d => {
    const r = reqs[d.leave_request_id]; if (!r || r.status === 'cancelled') return;
    const e = Ref.emp(d.employee_id), t = Hr.type(r.leave_type_id); if (!e) return;
    out.push({ d: d.date, ma: e.employee_code, ten: e.display_name, boPhan: Hr.dept(e.department_id), buoi: d.half === 'hours' ? r.start_time + '–' + r.end_time : d.half === 'full' ? 'Cả ngày' : vnHalf(d.half), nhan: label(t, d.half, r), hoTro: Hr.name(r.backup_employee_id), kind: kind(t), cho: false });
  });
  Object.values(reqs).filter(r => (r.status === 'pending' || r.status === 'pending_director') && r.end_date >= k0 && r.start_date <= k1).forEach(r => {
    const e = Ref.emp(r.employee_id), t = Hr.type(r.leave_type_id); if (!e || !t) return;
    if (t.unit === 'hour') { out.push({ d: r.start_date, ma: e.employee_code, ten: e.display_name, boPhan: Hr.dept(e.department_id), buoi: r.start_time + '–' + r.end_time, nhan: label(t, 'hours', r), hoTro: Hr.name(r.backup_employee_id), kind: 'late', cho: true }); return; }
    LeaveCalc.days(e.work_schedule, r.start_date, r.start_half, r.end_date, r.end_half, Hr.holidays()).forEach(x => {
      if (x.date >= k0 && x.date <= k1) out.push({ d: x.date, ma: e.employee_code, ten: e.display_name, boPhan: Hr.dept(e.department_id), buoi: x.half === 'full' ? 'Cả ngày' : vnHalf(x.half), nhan: label(t, x.half, r), hoTro: Hr.name(r.backup_employee_id), kind: kind(t), cho: true });
    });
  });
  out.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : (a.boPhan + a.ten).localeCompare(b.boPhan + b.ten));
  return { today: k0, entries: out, boPhan: Array.from(new Set(Hr.active().map(e => Hr.dept(e.department_id)))) };
});
__route('hr.leave.preview', (ctx, f) => {
  const v = Leave.validate(ctx, Leave.target(ctx, f), f);
  return { errs: v.errs, warns: v.warns, soNgay: v.soNgay || 0, soGio: v.soGio || 0, days: (v.days || []).map(x => ({ k: x.date, buoi: x.half === 'full' ? 'Cả ngày' : vnHalf(x.half) })), bal: v.bal || null };
});
__route('hr.leave.submit', (ctx, f) => {
  const target = Leave.target(ctx, f);
  const v = Leave.validate(ctx, target, f);
  if (v.errs.length) fail('VALIDATION', v.errs.join('\n'));
  const direct = ctx.isAdmin || target.id !== ctx.emp.id;
  const backup = f.hoTro ? Ref.empByCode(f.hoTro) : null;
  const r = Repo.insert('leave_requests', {
    request_no: Leave.nextNo(), employee_id: target.id, leave_type_id: v.t.id, start_date: v.start, start_half: v.t.unit === 'hour' ? null : v.sh, end_date: v.end, end_half: v.t.unit === 'hour' ? null : v.eh,
    start_time: f.tuGio && v.t.unit === 'hour' ? f.tuGio : null, end_time: f.denGio && v.t.unit === 'hour' ? f.denGio : null, days: v.soNgay, hours: v.soGio, reason: String(f.lyDo).trim(),
    backup_employee_id: backup ? backup.id : null, handover_note: String(f.banGiao || '').trim(), is_late_notice: v.baoGap, status: direct ? 'approved' : 'pending',
    approver1_id: direct ? ctx.userId : null, approved1_at: direct ? U.now() : null, decision_note: direct ? (target.id === ctx.emp.id ? 'Tự duyệt (Admin)' : 'Ghi nhận bởi ' + ctx.emp.display_name) : null
  }, ctx.userId);
if (direct) Leave.writeDays(r, target, v.t); else Leave.notify(r, target, 'Đơn mới cần duyệt');
  Audit.log(ctx.userId, direct ? 'leave.create_approved' : 'leave.create', 'leave_requests', r.id, { no: r.request_no, emp: target.employee_code });
  
  // --- BẮT ĐẦU CODE TELEGRAM ---
  if (!direct) { // Nếu đơn không phải do admin tự duyệt mà là nhân viên xin
    var msg = "🚨 <b>CÓ ĐƠN XIN NGHỈ MỚI CẦN DUYỆT</b>\n";
    msg += "Nhân sự: <b>" + target.display_name + "</b>\n";
    msg += "Phân loại: " + v.t.name + "\n";
    msg += "Thời gian: " + (v.soNgay ? v.soNgay + " ngày" : v.soGio + " giờ") + " (từ " + v.start + ")\n";
    msg += "Lý do: " + String(f.lyDo).trim() + "\n";
    msg += "👉 Vào web để duyệt đơn.";
    sendTelegramAlert(msg);
  }
  // --- KẾT THÚC CODE TELEGRAM ---
  return { ok: true, id: r.request_no, status: LEAVE_ST[r.status] };
}, { write: true });
__route('hr.leave.mine', ctx => Repo.where('leave_requests', r => r.employee_id === ctx.emp.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 60).map(r => Leave.view(r, true)));
__route('hr.leave.cancel', (ctx, p) => {
  const r = Repo.get('leave_requests', p.id); if (!r) fail('NOT_FOUND', 'Không tìm thấy đơn.');
  if (r.employee_id !== ctx.emp.id && !ctx.isAdmin) fail('FORBIDDEN', 'Đây không phải đơn của bạn.');
  let st;
  if (r.status === 'pending' || r.status === 'pending_director') st = 'cancelled';
  else if (r.status === 'approved') {
    if (ctx.isAdmin) { Repo.deleteWhere('leave_request_days', d => d.leave_request_id === r.id); st = 'cancelled'; }
    else { if (r.start_date <= U.today()) fail('VALIDATION', 'Đơn đã bắt đầu nên không tự hủy được. Báo quản lý hoặc HCNS.'); st = 'cancel_requested'; Leave.notify(r, ctx.emp, 'Xin hủy đơn đã duyệt'); }
  } else fail('VALIDATION', 'Đơn đang ở trạng thái "' + (LEAVE_ST[r.status] || r.status) + '", không hủy được.');
  Repo.update('leave_requests', r.id, { status: st }, ctx.userId);
  Audit.log(ctx.userId, 'leave.cancel', 'leave_requests', r.id, { to: st });
  return { ok: true, tt: LEAVE_ST[st] };
}, { write: true });
__route('hr.leave.pending', ctx => {
  Policy.need(ctx, 'hr.leave.approve');
  return Leave.pendingFor(ctx).map(r => {
    const owner = Ref.emp(r.employee_id), t = Hr.type(r.leave_type_id), v = Leave.view(r, true); v.warn = [];
    if (owner && t && !t.counts_as_work && t.unit !== 'hour') {
      const cnt = Leave.teamCount(owner, LeaveCalc.days(owner.work_schedule, r.start_date, r.start_half, r.end_date, r.end_half, Hr.holidays()));
      const ks = Object.keys(cnt); if (ks.length) v.warn.push('Cùng bộ phận đã có người nghỉ: ' + ks.map(k => U.vn(k) + ' (' + cnt[k] + ' người)').join(', '));
    }
    if (t && t.deduct_annual && owner) v.bal = Hr.balanceOf(owner);
    v.needCEO = !!(t && (t.need_director || r.days > Settings.num('hr.nguong_ceo_duyet', 3)));
    if (r.is_late_notice) v.warn.push('Báo gấp, không đủ thời gian báo trước theo quy định.');
    return v;
  });
});
__route('hr.leave.decide', (ctx, p) => {
  const r = Repo.get('leave_requests', p.id); if (!r) fail('NOT_FOUND', 'Không tìm thấy đơn.');
  const owner = Ref.emp(r.employee_id);
  if (['pending', 'pending_director', 'cancel_requested'].indexOf(r.status) < 0) fail('CONFLICT', 'Đơn đã được xử lý: ' + (LEAVE_ST[r.status] || r.status));
  if (!Leave.canApprove(ctx, r, owner)) fail('FORBIDDEN', 'Bạn không có quyền duyệt đơn này.');
  const note = String(p.note || '').trim();
  if (p.action === 'reject' && !note) fail('VALIDATION', 'Ghi lý do từ chối để nhân viên biết cần làm gì.');
  const t = Hr.type(r.leave_type_id), now = U.now(), ch = {}; let kq;
  const lvl2 = r.status === 'pending_director';
  if (r.status === 'cancel_requested') {
    if (p.action === 'approve') { Repo.deleteWhere('leave_request_days', d => d.leave_request_id === r.id); ch.status = 'cancelled'; kq = 'Đồng ý hủy đơn'; }
    else { ch.status = 'approved'; kq = 'Không đồng ý hủy, đơn giữ nguyên'; }
  } else if (p.action === 'approve') {
    const needDirector = t.need_director || r.days > Settings.num('hr.nguong_ceo_duyet', 3);
    if (r.status === 'pending' && needDirector && !ctx.isAdmin) { Object.assign(ch, { status: 'pending_director', approver1_id: ctx.userId, approved1_at: now }); kq = 'Quản lý đã duyệt, chờ CEO'; }
    else { Object.assign(ch, lvl2 ? { approver2_id: ctx.userId, approved2_at: now } : { approver1_id: ctx.userId, approved1_at: now }); ch.status = 'approved'; kq = 'Đã duyệt'; }
  } else { Object.assign(ch, lvl2 ? { approver2_id: ctx.userId, approved2_at: now } : { approver1_id: ctx.userId, approved1_at: now }); ch.status = 'rejected'; kq = 'Từ chối'; }
  if (note) ch.decision_note = (r.decision_note ? r.decision_note + ' | ' : '') + ctx.emp.display_name + ': ' + note;
  const wasPending = r.status !== 'cancel_requested';
  const upd = Repo.update('leave_requests', r.id, ch, ctx.userId);
  if (wasPending && ch.status === 'approved') Leave.writeDays(upd, owner, t);
  if (ch.status === 'pending_director') Leave.notify(upd, owner, 'Đơn cần CEO duyệt', true);
  Audit.log(ctx.userId, 'leave.' + p.action, 'leave_requests', r.id, { result: kq, note });
  if (owner && owner.email_work) Hr.mail(owner.email_work, kq + ' – ' + t.name + ' ' + U.vn(r.start_date), '<p>Đơn <b>' + r.request_no + '</b>: <b>' + kq + '</b>.</p>' + (note ? '<p>Ghi chú: ' + U.esc(note) + '</p>' : '') + Hr.btn('Xem đơn của tôi', '?p=mine'));
  return { ok: true, tt: LEAVE_ST[ch.status] };
}, { write: true });
//Bắn TELEGRAM//
function sendTelegramAlert(message) {
  var token = "8945177192:AAFSEYodQ3SB6Dykcf2UNtiSpWRw5XjQiKQ";
  var chatId = "-5431641121"; // VD: -100123456789
  var url = "https://api.telegram.org/bot8945177192:AAFSEYodQ3SB6Dykcf2UNtiSpWRw5XjQiKQ/sendMessage";
  
  var payload = {
    "chat_id": chatId,
    "text": message,
    "parse_mode": "HTML"
  };
  
  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  
  try {
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    // Bỏ qua lỗi nếu bot không gửi được để không làm chết app
  }
}
