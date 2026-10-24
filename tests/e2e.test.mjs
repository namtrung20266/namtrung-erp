import { boot } from './harness.mjs';
const H = await boot();
let ok = 0, bad = 0;
const T = async (n, fn) => { try { const r = await fn(); ok++; console.log('✔', n, r === undefined ? '' : JSON.stringify(r).slice(0, 150)); return r; } catch (e) { bad++; console.log('✘', n, '→', e.message); } };
const api = async (route, token, p) => { const r = await H.run('api', [route, token, p || {}]); if (r.error) throw new Error(r.error); if (!r.result.ok) throw new Error(r.result.error.code + ': ' + r.result.error.message); return r.result.data; };
const crm = async (fn, ...args) => { const r = await H.run('crm', [fn, args]); if (r.error) throw new Error(r.error); return r.result; };
const X = async (n, fn, msg) => { try { await fn(); bad++; console.log('✘ (lẽ ra bị chặn)', n); } catch (e) { if (e.message.includes(msg)) { ok++; console.log('✔ chặn đúng:', n, '→', e.message.slice(0, 80)); } else { bad++; console.log('✘', n, 'lỗi khác:', e.message); } } };
import fs from 'fs';
const FIX = process.env.FIX || '/tmp/fix';
// ---------- khởi tạo như thật: admin đăng nhập bằng mật khẩu ban đầu, đổi mật khẩu, nhập dữ liệu từ Excel ----------
let A;
await T('Admin đăng nhập bằng mật khẩu ban đầu (sinh ngẫu nhiên)', async () => {
  const pw = (await H.q("select value from app_props where key='ADMIN_INIT_PW'"))[0].value;
  A = (await api('auth.login', null, { username: 'NT001', password: pw })).token;
  const b = await api('app.bootstrap', A); await api('auth.changePassword', A, { oldPassword: pw, newPassword: 'Admin@2026' });
  return [b.me.role, b.me.mustChange, (await H.q("select count(*)::int n from app_props where key='ADMIN_INIT_PW'"))[0].n];
});
for (const [file, book] of [['NT_CORE', 'CORE'], ['NT_HR', 'HR']]) {
  const wb = JSON.parse(fs.readFileSync(FIX + '/' + file + '.json'));
  await T('Nhập ' + file + '.xlsx', async () => { const done = []; for (const [n, rows] of Object.entries(wb)) { if (n === 'audit_logs' || rows.length < 1) continue; await api('admin.import.sheet', A, { book, sheet: n, rows }); done.push(n); } return done.length + ' sheet'; });
}
await T('Admin đăng nhập lại sau khi thay danh sách tài khoản (giữ mật khẩu mới)', async () => { A = (await api('auth.login', null, { username: 'NT001', password: 'Admin@2026' })).token; return (await api('app.bootstrap', A)).me.role; });
const PW = {};
await T('Cấp mật khẩu tạm hàng loạt', async () => { const l = await api('admin.users.bulkTemp', A, { onlyMissing: true }); l.forEach(x => PW[x.username] = x.password); return l.length + ' người'; });
const crmWb = JSON.parse(fs.readFileSync(FIX + '/CRM_mau.json'));
await T('Nhập mẫu CRM (CAU_HINH, KPI, HUONG_DAN, NHAN_SU)', async () => { for (const n of ['CAU_HINH', 'KPI_CHI_TIEU', 'HUONG_DAN', 'NHAN_SU']) await api('admin.import.sheet', A, { book: 'CRM', sheet: n, rows: crmWb[n] }); return 'ok'; });
for (const u of ['NT006', 'NT014', 'NT004', 'NT002', 'NT015']) await H.setPassword(u, '123456');

const Sale = await T('Sale đăng nhập bằng mã CRM cũ', async () => (await api('auth.login', null, { username: 'HUYENTTT', password: '123456' })).token);
const QL = await T('Khơi đăng nhập', async () => (await api('auth.login', null, { username: 'NT014', password: '123456' })).token);
const KT = await T('Kế toán đăng nhập', async () => (await api('auth.login', null, { username: 'NT004', password: '123456' })).token);
const Viet = await T('Việt đăng nhập', async () => (await api('auth.login', null, { username: 'NT002', password: '123456' })).token);
await T('Phiên đăng nhập lưu qua các lần gọi', async () => { const b = await api('app.bootstrap', Sale); return [b.me.ten, b.me.role, b.crm]; });
await T('Admin bootstrap', async () => { const b = await api('app.bootstrap', A); return [b.me.role, b.crm, b.people.length]; });
// ---------- nhân sự ----------
const d = n => { const x = new Date(Date.now() + 7 * 3600e3); x.setUTCDate(x.getUTCDate() + n); while ([0, 6].includes(x.getUTCDay())) x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
const don = await T('Sale gửi đơn nghỉ', async () => api('hr.leave.submit', Sale, { loai: 'PN', tuNgay: d(9), denNgay: d(9), tuBuoi: 'Sáng', denBuoi: 'Chiều', lyDo: 'Khám răng', hoTro: 'NT007' }));
await T('Khơi thấy đơn nhóm', async () => (await api('hr.leave.pending', QL)).map(x => x.no));
await T('Khơi duyệt', async () => { const p = await api('hr.leave.pending', QL); return api('hr.leave.decide', QL, { id: p[0].id, action: 'approve', note: 'ok' }); });
await T('Lịch vắng có đơn đã duyệt', async () => (await api('hr.absence.board', Viet)).entries.length);
await T('Admin đặt IP văn phòng', async () => api('att.setOfficeIp', A, { ip: '113.190.10.20', replace: true }));
await T('Sale chấm công kèm ảnh (lưu kho ảnh)', async () => api('att.punch', Sale, { ip: '113.190.10.20', photo: 'data:image/jpeg;base64,' + Buffer.from('x'.repeat(6000)).toString('base64'), device: 'D1' }));
await T('Ảnh chấm công trả link kho', async () => { const r = await api('att.day', A, { day: '' }); const x = r.list.find(y => y.anhVao); return api('att.photo', A, { id: x.anhVao }); });
const m = (() => { const x = new Date(Date.now() + 7 * 3600e3); x.setUTCMonth(x.getUTCMonth() + 1); return x.toISOString().slice(0, 7); })();
await T('Kế toán tính lương', async () => (await api('pay.list', KT, { month: m, recalc: true })).rows.length);
await T('Kế toán nhập hoa hồng', async () => (await api('pay.items.set', KT, { month: m, code: 'NT006', commission: 5000000, bonus: 0, pit: 0, advance: 0, deduction: 0 })).ThucLinh);
await T('Báo cáo tháng', async () => (await api('rpt.hr.monthly', KT, { month: m })).rows.length);
await T('Danh sách tài khoản', async () => (await api('admin.users.list', A)).users.length);
await T('Admin cấp mật khẩu tạm cho Linh', async () => (await api('admin.users.resetPassword', A, { userId: (await api('admin.users.list', A)).users.find(u => u.username === 'NT007').id })).password.length);
// ---------- nhập cấu hình CRM từ Excel ----------
await T('Admin nhập lại CAU_HINH (thêm THONG_TIN_CTY)', async () => api('admin.import.sheet', A, { book: 'CRM', sheet: 'CAU_HINH', rows: [['THONG_TIN_CTY', 'TK_CONG_TY'], ['ten=CÔNG TY TNHH DỊCH VỤ VÀ THƯƠNG MẠI QUỐC TẾ NAM TRUNG', 'VCB - 0000000000'], ['qrMaNH=970415', 'Tiền mặt'], ['qrSoTK=123456789', ''], ['qrMau=compact2', '']] }));
X('Sale nhập cấu hình', () => api('admin.import.sheet', Sale, { book: 'CRM', sheet: 'CAU_HINH', rows: [['A']] }), 'FORBIDDEN');
// ---------- CRM trong cùng phiên ----------
await T('CRM: khởi động bằng phiên ERP', async () => { const s = await crm('apiStart', Sale); return [s.boot.user.maNV, s.boot.user.vaiTro, s.kh.length]; });
const kh = await T('CRM: thêm khách', async () => (await crm('apiSaveKH', Sale, { tenLienHe: 'Chị Mai', sdt: '0912345678', loaiKH: 'Shop TMĐT', nguonKH: 'Tự tìm - Facebook', nganhHang: 'Gia dụng', hinhThucNK: 'Chưa xác định' })).maKH);
await T('CRM: khách thứ 2 mã nối tiếp', async () => (await crm('apiSaveKH', Sale, { tenLienHe: 'Anh Long', sdt: '0987654321', loaiKH: 'Shop TMĐT', nguonKH: 'Tự tìm - Facebook' })).maKH);
await T('CRM: ghi chăm sóc', async () => (await crm('apiAddCare', Sale, { maKH: kh, kenh: 'Gọi điện', mucDich: 'Tiếp cận lần đầu', ketQua: 'Trao đổi được - có quan tâm', noiDung: 'Khách quan tâm nhập quạt về bán online', ngayHenTiep: d(2) })).maCS);
const bg = await T('CRM: lập báo giá', async () => (await crm('apiSaveBG', Sale, { maKH: kh, tyGia: 4015, hinhThucNK: 'Trọn gói chính ngạch - Nam Trung xuất HĐ VAT', soKg: 500, donGiaKg: 7000, soKhoi: 3, donGiaKhoi: 1100000, phiDVPct: 2, phiUTPct: 1, coSoUT: 'giaXuat' }, [{ tenHang: 'Quạt thông gió', soLuong: 200, donGiaTe: 100, dvt: 'Chiếc', vatPct: 8 }], 'save')).maBG);
await T('CRM: xem báo giá (có QR công ty)', async () => { const r = await crm('apiBGHtml', Sale, bg, 'KH coc', null); return [typeof r, JSON.stringify(r).includes('qr') || JSON.stringify(r).includes('vietqr')]; });
await T('CRM: nạp tiền kèm bill (lưu kho ảnh)', async () => (await crm('apiNRSave', Sale, { loai: 'Nạp tiền', soTien: 50000000, maKH: kh, tkCongTy: 'VCB - 0000000000', ngayCK: d(0) + ' 10:00', noiDungCK: kh + ' coc', billData: 'data:image/jpeg;base64,' + Buffer.from('y'.repeat(8000)).toString('base64') })).maGD);
await T('CRM: kế toán xác nhận', async () => { const l = await crm('apiNRList', KT, {}); const g = (l.rows || l)[0]; return (await crm('apiNRConfirm', KT, g.maGD, true, 'FT1', 'ok')).trangThai; });
await T('CRM: claim gửi admin, admin trả lời', async () => { await crm('apiCLCreate', Sale, { loai: 'Hỏi đáp', tieuDe: 'Hỏi phí ủy thác', noiDung: 'Khách muốn hóa đơn 70% tính thế nào?' }); const l = await crm('apiCLList', A, {}); return (await crm('apiCLReply', A, (l.rows || l)[0].maCL, 'Tính 1% trên tiền hàng', true, 'Có')).trangThai; });
await T('CRM: nhờ quản lý hỗ trợ', async () => (await crm('apiHTCreate', Sale, { maKH: kh, chuDe: 'Giá / khung giá', mucUuTien: 'Bình thường', noiDung: 'Anh xem giúp khung giá' })).maHT);
await T('CRM: báo cáo ngày', async () => Object.keys(await crm('apiDailySubmit', Sale, { s_dataTim: 10, s_tongGoi: 30, s_tongNhan: 20, s_keHoach: 'Gọi lại 10 khách' })));
for (const tp of ['tongquan', 'kpi', 'chamsoc', 'baogia', 'cancham', 'phieu', 'nguon', 'fb', 'nopbaocao', 'giukhach', 'naprut', 'hotro', 'trungkhht', 'chuyenkh'])
  await T('CRM báo cáo ' + tp, async () => Object.keys(await crm('apiReport', A, tp, { tuNgay: d(-30), denNgay: d(30), maQL: '', maNV: '' })).length);
await T('CRM: quản lý thấy khách nhóm', async () => (await crm('apiKHAll', QL)).rows.map(k => k.maKH));
await T('CRM: Việt (sale chưa có trong CRM) bị chặn', async () => { try { await crm('apiStart', Viet); return 'vào được'; } catch (e) { return e.message.slice(0, 60); } });
await T('CRM: admin thêm Việt vào CRM', async () => (await crm('apiSaveUser', A, { isNew: true, maNV: 'NT002', hoTen: 'Ngũ Đức Việt', vaiTro: 'SALE', maQuanLy: 'ADMIN', capBac: 'Nhân viên KD', trangThai: 'Đang làm', heSoKPI: 1 })).maNV);
await T('CRM: Việt vào được ngay', async () => (await crm('apiStart', Viet)).boot.user.vaiTro);
await T('Việc chạy hằng ngày', async () => (await H.run('job', [])).error || 'ok');
await T('Ảnh đã chuyển sang kho lưu trữ', async () => H.uploads.map(u => u.path.split('/').slice(0, -1).join('/') + ' ' + u.bytes.length + 'B'));
await T('Nhật ký thao tác ghi vào bảng', async () => (await H.q('select count(*)::int n from app_audit'))[0].n);
await T('Dữ liệu CRM nằm trong Postgres', async () => (await H.q("select sheet, count(*)::int n from app_rows where book='CRM' group by sheet order by sheet")).map(r => r.sheet + ':' + r.n).join(' '));
console.log(`\nKẾT QUẢ: ${ok} đạt, ${bad} lỗi`);
