/*****************************************************************
 * NAM TRUNG ERP — PHÂN HỆ CRM BÁN HÀNG
 * Toàn bộ code CRM gốc của anh được giữ NGUYÊN VĂN bên trong hàm CrmModule_(),
 * chỉ thêm phần nối ERP ở cuối (xem khối [ERP]). Muốn sửa nghiệp vụ CRM: sửa trong hàm này như trước.
 * Thêm trường thông tin: thêm vào SCHEMA của CRM (bên dưới) — lần chạy sau tự thêm cột vào sheet.
 *****************************************************************/
let CRM_MOD_ = null;
function CRM_() { return CRM_MOD_ || (CRM_MOD_ = CrmModule_()); }

/** Cổng gọi duy nhất của giao diện CRM: google.script.run.crm(tênHàm, [đối số]) */
function crm(fn, args) {
  REQ_ = {};
  const m = CRM_();
  if (!/^api[A-Z]\w*$/.test(String(fn)) || typeof m.API[fn] !== 'function') throw new Error('Không có chức năng ' + fn);
  return m.API[fn].apply(null, args || []);
}

function CrmModule_() {
/* ===================== CODE CRM GỐC (giữ nguyên) ===================== */
/**************************************************************************
 * NAM TRUNG SALE CRM v1.0 — Google Sheets + Apps Script
 * ------------------------------------------------------------------------
 * QUY TẮC VÀNG KHI LÀM VIỆC VỚI FILE SHEET:
 *  1. KHÔNG chèn / xóa / đổi thứ tự cột ở các sheet dữ liệu (code đọc theo vị trí cột).
 *  2. Được thêm giá trị vào sheet CAU_HINH (gõ thêm xuống dưới cột tương ứng),
 *     được sửa chỉ tiêu ở sheet KPI_CHI_TIEU. KHÔNG đổi tên các giai đoạn gốc.
 *  3. KHÔNG chia sẻ file Sheet cho Sale. Sale chỉ dùng link Web App.
 *  Hàm có dấu _ ở cuối tên là hàm nội bộ, trình duyệt không gọi được (bảo mật).
 **************************************************************************/

const APP = {
  TEN: 'Nam Trung Sale CRM',
  CONG_TY: 'CÔNG TY TNHH DỊCH VỤ VÀ THƯƠNG MẠI QUỐC TẾ NAM TRUNG',
  WEBSITE: 'namtrunglog.com',
  TZ: 'Asia/Ho_Chi_Minh',
  GIO_HAN_BAO_CAO: 18,        // nộp báo cáo ngày sau 18:00 = trễ
  PHIEN_GIAY: 21600,          // phiên đăng nhập 6 giờ (tối đa của CacheService)
  NGAY_KHO_NGU: 90,           // Sổ tay 8.4: không giao dịch 3 tháng -> Kho khách ngủ
  NGAY_BO_QUEN: 30,           // không liên hệ 30 ngày -> cảnh báo bỏ quên
  HIEU_LUC_BG: 5,
  THU_MUC_PDF: 'NamTrung_BaoGia_PDF',
  DIEU_KHOAN_BG: [
    'Báo giá có hiệu lực đến ngày ghi trên báo giá. Tỷ giá áp dụng theo ngày thanh toán tiền hàng.',
    'Phí vận chuyển tính theo số lớn hơn giữa cân nặng và số khối thực tế khi hàng về kho Hà Nội.',
    'Giá xuất đã gồm thuế nhập khẩu theo thuế suất dự kiến. Nếu Hải quan áp mã HS hoặc thuế suất khác, hai bên điều chỉnh theo thực tế.',
  ],
};

/** Tham số Admin chỉnh ở CAU_HINH, cột THAM_SO (dạng ten=giá trị). Đây là giá trị mặc định. */
const THAM_SO_MD = { tyLeCoc: 80, hieuLucBG: 5, ngayKhoNgu: 90, ngayKHHTHoatDong: 60, gioHanBaoCao: 18, ngayBoQuen: 30, giuBanSaoLuu: 8 };
let TS_CACHE_ = null;
function thamSo_() {
  if (TS_CACHE_) return TS_CACHE_;
  const o = Object.assign({}, THAM_SO_MD);
  (lists_().THAM_SO || []).forEach(x => { const i = x.indexOf('='); if (i > 0) { const v = Number(x.slice(i + 1)); if (isFinite(v)) o[x.slice(0, i).trim()] = v; } });
  return (TS_CACHE_ = o);
}
const HT_TT = { CHO_QL: 'Chờ quản lý', CHO_SALE: 'Chờ sale', XONG: 'Đã xong' };
const NR_TT = { CHO: 'Chờ kế toán', OK: 'Đã xác nhận', TC: 'Từ chối', HUY: 'Đã hủy' };
const CL_TT = { CHO_QT: 'Chờ quản trị', CHO_NG: 'Chờ người gửi', XONG: 'Đã xong' };
const VAI_TRO = ['ADMIN', 'QUANLY', 'SALE', 'KETOAN'];
const KHHT = { DANG: 'Đang chạy', NGU: 'Khách cũ đã ngủ' };

const GD = {
  MOI: 'Mới - Chưa liên hệ', TIEP_CAN: 'Đã tiếp cận', KHAI_THAC: 'Khai thác nhu cầu',
  DA_BG: 'Đã gửi báo giá', DAM_PHAN: 'Đàm phán - Chờ quyết định', DON_DAU: 'Khách mới (đơn đầu)',
  HOAT_DONG: 'Khách đang hoạt động', VIP: 'Khách VIP', KHO_NGU: 'Kho khách ngủ',
  MAT: 'Mất khách', LOAI: 'Không tiềm năng',
};
const GD_THU_TU = [GD.MOI, GD.TIEP_CAN, GD.KHAI_THAC, GD.DA_BG, GD.DAM_PHAN, GD.DON_DAU, GD.HOAT_DONG, GD.VIP, GD.KHO_NGU, GD.MAT, GD.LOAI];
const NHIP_CHAM = {
  mucDo: { 'Nóng': 2, 'Ấm': 5, 'Lạnh': 14 },
  giaiDoan: {
    [GD.MOI]: 1, [GD.TIEP_CAN]: 3, [GD.KHAI_THAC]: 3, [GD.DA_BG]: 2, [GD.DAM_PHAN]: 2,
    [GD.DON_DAU]: 3, [GD.HOAT_DONG]: 7, [GD.VIP]: 5, [GD.KHO_NGU]: 14, [GD.MAT]: 30,
  },
};
const KQ_THAT_BAI = ['Không nghe máy', 'Thuê bao/Sai số', 'Đã nhắn - chưa phản hồi'];
const KENH_HT = 'Hệ thống';
const MD_TIEP_CAN = 'Tiếp cận lần đầu';
const BG_TT = {
  NHAP: 'Nháp', CHO_DUYET: 'Chờ duyệt giá', GUI: 'Đã gửi', CAN_NHAC: 'Khách đang cân nhắc',
  CHOT: 'Đã chốt đơn', TU_CHOI: 'Khách từ chối', HET_HAN: 'Hết hạn', THAY_THE: 'Đã thay thế',
};

const SH = {
  NS: 'NHAN_SU', KH: 'KHACH_HANG', CS: 'NHAT_KY_CHAM_SOC', BG: 'BAO_GIA', BGCT: 'BAO_GIA_CHI_TIET',
  BCN: 'BAO_CAO_NGAY', CHUYEN: 'LICH_SU_CHUYEN_KH', KPI: 'KPI_CHI_TIEU', CH: 'CAU_HINH', HT: 'HO_TRO', KHHT: 'KH_DANG_CHAY', NR: 'NAP_RUT', CL: 'CLAIM',
};

const SCHEMA = {
  NHAN_SU: [['maNV','Mã NV'],['hoTen','Họ tên'],['email','Email Google'],['sdt','SĐT'],['vaiTro','Vai trò (ADMIN/QUANLY/SALE)'],['maQuanLy','Mã quản lý trực tiếp'],['capBac','Cấp bậc'],['trangThai','Trạng thái (Đang làm/Đã nghỉ)'],['ngayVao','Ngày vào'],['heSoKPI','Hệ số KPI (1 = 100%)'],['matKhauHash','Mật khẩu (đã mã hóa)'],['ngayTao','Ngày tạo']],
  KHACH_HANG: [['maKH','Mã KH'],['ngayTao','Ngày tạo'],['maNV','Sale phụ trách'],['tenLienHe','Người liên hệ'],['chucVu','Chức vụ'],['tenCongTy','Công ty/Shop'],['mst','MST'],['sdt','SĐT'],['zalo','Zalo'],['email','Email'],['facebook','Facebook'],['tinhThanh','Tỉnh/TP'],['diaChi','Địa chỉ'],['loaiKH','Loại KH'],['nguonKH','Nguồn KH'],['nganhHang','Ngành hàng'],['matHang','Mặt hàng cụ thể'],['dichVu','Dịch vụ quan tâm'],['hinhThucNK','Hình thức NK'],['phapNhan','Pháp nhân'],['canHoaDon','Nhu cầu hóa đơn'],['dacThuHang','Đặc thù hàng'],['tanSuat','Tần suất nhập'],['giaTriDuKien','Giá trị NK/tháng'],['doiThu','Đang dùng đơn vị'],['nhomKH','Thuộc nhóm KH'],['giaiDoan','Giai đoạn'],['mucDo','Mức độ'],['ketQuaGanNhat','Kết quả gần nhất'],['ngayLHGanNhat','Ngày LH gần nhất'],['ngayHenCham','Ngày hẹn chăm'],['soLanCham','Số lần chăm'],['soBaoGia','Số BG đã gửi'],['soDon','Số đơn'],['ngayDonDau','Ngày đơn đầu'],['ngayDonGanNhat','Ngày đơn gần nhất'],['sinhNhat','Sinh nhật/Kỷ niệm'],['ghiChu','Ghi chú'],['nguoiCapNhat','Người cập nhật'],['ngayCapNhat','Lúc cập nhật'],['trungKHHT','Trùng KH đang chạy']],
  NHAT_KY_CHAM_SOC: [['maCS','Mã CS'],['thoiGian','Thời gian'],['ngay','Ngày'],['maNV','Người chăm'],['maKH','Mã KH'],['tenKH','Tên KH'],['kenh','Kênh'],['mucDich','Mục đích'],['noiDung','Nội dung'],['ketQua','Kết quả'],['thanhCong','Kết nối được'],['giaiDoanSau','Giai đoạn sau'],['mucDo','Mức độ'],['ngayHenTiep','Hẹn chăm tiếp'],['maBG','Mã BG liên quan']],
  BAO_GIA: [['maBG','Mã BG'],['ngayTao','Ngày tạo'],['ngayGui','Ngày gửi'],['maNV','Sale'],['maKH','Mã KH'],['tenKH','Tên KH'],['maDon','Mã đơn'],['phienBan','Phiên bản'],['bgGoc','BG gốc'],['tyGia','Tỷ giá'],['hinhThucNK','Hình thức NK'],['tomTatHang','Tóm tắt hàng'],['tienHangTe','Tiền hàng (¥)'],['tienHang','Tiền hàng (đ)'],['shipNoiDiaTe','Ship nội địa (¥)'],['shipNoiDia','Ship nội địa (đ)'],['soKg','Số kg'],['donGiaKg','Đơn giá kg'],['soKhoi','Số khối (m³)'],['donGiaKhoi','Đơn giá khối'],['phiVC','Phí VC TQ-HN'],['phiDVPct','% Phí DV'],['phiDV','Phí DV'],['phiUTPct','% Ủy thác'],['coSoUT','Cơ sở ủy thác'],['phiUT','Phí ủy thác'],['phiKeKhai','Phí kê khai <100kg'],['phiHopQuy','Phí hợp quy'],['thueNK','Thuế NK'],['lamTron','Làm tròn đến'],['lamTronChenh','Chênh làm tròn'],['tongTruocVAT','Tổng trước VAT'],['vat','VAT'],['tongSauVAT','Tổng sau VAT'],['lnUocTinh','LN ước tính (nội bộ)'],['canhBaoGia','Cảnh báo khung giá'],['duyetBoi','Người duyệt giá'],['ngayDuyet','Ngày duyệt'],['trangThai','Trạng thái'],['lyDo','Lý do từ chối'],['hieuLucDen','Hiệu lực đến'],['ngayChot','Ngày chốt'],['donDau','Là đơn đầu'],['linkPDF','Link PDF'],['ghiChu','Ghi chú'],['ngayCapNhat','Lúc cập nhật'],['cheDoXuat','Chế độ xuất (du/thap/cao)'],['tyLeXuat','% so với giá đủ'],['tongGiaDu','Giá đủ A (trước VAT)'],['chenhLech','Chênh so với A'],['thuThemTNDN','Thu thêm TNDN'],['thueNKTang','Thuế NK tăng thêm'],['tongToKhai','Tổng trị giá tờ khai APT'],['heSoToKhai','Hệ số tờ khai'],['tongChiPhiThuc','Chi phí thực của đơn'],['coSoThueNK','Thuế NK tính trên (toKhai/giaXuat)'],['noiDungCK','Nội dung CK in trên báo giá'],['soTienCK','Số tiền CK in trên báo giá'],['kieuCK','Kiểu thu (coc/tong/nhap)'],['tyLeCoc','% cọc'],['tndnPct','% TNDN thu thêm'],['phiKTCL','Phí kiểm tra chất lượng'],['phiKhac','Phí khác'],['tenPhiKhac','Tên phí khác']],
  BAO_GIA_CHI_TIET: [['maBG','Mã BG'],['stt','STT'],['tenHang','Tên hàng'],['moTa','Mô tả/Quy cách'],['hsCode','HS code'],['dvt','ĐVT'],['soLuong','SL'],['donGiaTe','Đơn giá (¥)'],['thanhTienTe','Thành tiền (¥)'],['thanhTienVND','Tiền hàng (đ)'],['thueNKPct','% Thuế NK'],['vatPct','% VAT'],['giaXuat','Giá xuất/ĐV trước VAT'],['tongTruocVAT','Tổng trước VAT'],['vat','VAT'],['pctCuoc','% cước tự nhập'],['cuocPhanBo','Cước phân bổ'],['giaXuatDu','Giá xuất đủ/ĐV'],['giaKhai','Đơn giá khai APT'],['triGiaKhai','Trị giá khai APT'],['thueNK','Thuế NK dòng'],['giaXuatNhap','Giá xuất chọn tay']],
  BAO_CAO_NGAY: [['maBC','Mã BC'],['ngay','Ngày'],['maNV','Mã NV'],['hoTen','Họ tên'],['maQuanLy','Quản lý'],['a_khMoi','HT: KH mới'],['a_tiepCan','HT: Tiếp cận mới'],['a_ketNoi','HT: Kết nối TC'],['a_chamLai','HT: Chăm KH cũ'],['a_goi','HT: Cuộc gọi'],['a_nhanTin','HT: Tin nhắn'],['a_baoGia','HT: Báo giá gửi'],['a_donChot','HT: Đơn chốt'],['a_khQuanTam','HT: KH Nóng/Ấm'],['s_dataTim','Tự khai: Data tìm được'],['s_tongGoi','Tự khai: Tổng cuộc gọi'],['s_tongNhan','Tự khai: Tổng tin nhắn'],['s_ketBanZalo','Tự khai: Kết bạn Zalo'],['s_group','Tự khai: Group tham gia/đăng'],['s_fb1','Link bài FB 1'],['s_fb2','Link bài FB 2'],['s_fb3','Link bài FB 3'],['s_tuongTacFB','Tương tác thu từ bài'],['s_khoKhan','Khó khăn'],['s_keHoach','Kế hoạch ngày mai'],['s_baiHoc','Bài học'],['diemKPI','Điểm KPI ngày'],['thoiGianNop','Nộp lúc'],['dungHan','Đúng hạn'],['capNhatLuc','Cập nhật lúc'],['ql_xacNhanFB','QL xác nhận FB'],['ql_nhanXet','QL nhận xét'],['ql_nguoiDuyet','Người duyệt'],['ql_ngayDuyet','Duyệt lúc']],
  LICH_SU_CHUYEN_KH: [['thoiGian','Thời gian'],['maKH','Mã KH'],['tenKH','Tên KH'],['tuNV','Từ sale'],['denNV','Sang sale'],['lyDo','Lý do'],['nguoiThucHien','Người thực hiện']],
  NAP_RUT: [['maGD','Mã GD'],['thoiGian','Tạo lúc'],['ngay','Ngày'],['loai','Loại'],['maNV','Người tạo'],['maKH','Mã KH'],['tenKH','Khách hàng'],['maDon','Mã đơn'],['soTien','Số tiền'],['tkCongTy','TK công ty nhận / chi'],['ngayCK','Thời gian CK'],['noiDungCK','Nội dung CK'],['tkKhach','TK nhận của khách (rút)'],['lyDo','Lý do / ghi chú sale'],['linkBill','Ảnh bill'],['trangThai','Trạng thái'],['nguoiXacNhan','Kế toán xử lý'],['xacNhanLuc','Xử lý lúc'],['maThamChieu','Mã tham chiếu NH'],['ghiChuKT','Ghi chú kế toán'],['capNhatLuc','Cập nhật lúc']],
  CLAIM: [['maCL','Mã'],['thoiGian','Tạo lúc'],['ngay','Ngày'],['nguoiGui','Người gửi'],['loai','Loại'],['tieuDe','Tiêu đề'],['noiDung','Nội dung'],['mucDo','Mức độ'],['maKH','Mã KH liên quan'],['maDon','Mã đơn liên quan'],['linkAnh','Ảnh đính kèm'],['trangThai','Trạng thái'],['traoDoi','Trao đổi (JSON)'],['nguoiXuLy','Người xử lý'],['capNhatLuc','Cập nhật lúc'],['ketQua','Kết quả'],['dongLuc','Đóng lúc'],['congKhai','Hỏi đáp chung']],
  HO_TRO: [['maHT','Mã HT'],['thoiGian','Tạo lúc'],['ngay','Ngày'],['loai','Loại'],['maKH','Mã KH'],['tenKH','Tên KH'],['maNVSale','Sale phụ trách KH'],['nguoiTao','Người tạo'],['chuDe','Chủ đề'],['mucUuTien','Ưu tiên'],['noiDung','Nội dung'],['trangThai','Trạng thái'],['traoDoi','Trao đổi (JSON)'],['nguoiXuLy','Người xử lý'],['capNhatLuc','Cập nhật lúc'],['ketQua','Kết quả'],['dongLuc','Đóng lúc']],
  KH_DANG_CHAY: [['maKHHT','Mã KH hệ thống'],['tenKH','Tên khách'],['sdt','SĐT'],['sdt2','SĐT 2 / Zalo'],['mst','MST'],['ngayDonGanNhat','Ngày đơn gần nhất'],['phuTrach','Người phụ trách'],['ghiChu','Ghi chú'],['capNhatLuc','Cập nhật lúc']],
  KPI_CHI_TIEU: [['maChiSo','Mã chỉ số (không sửa)'],['tenChiSo','Tên chỉ số'],['ngay','Chỉ tiêu / ngày'],['trongSo','Trọng số điểm (%)'],['ghiChu','Cách đo']],
};
const COLS = {};
Object.keys(SCHEMA).forEach(k => COLS[k] = SCHEMA[k].map(x => x[0]));

const TEXT_KEYS = new Set(['maNV','maQuanLy','sdt','zalo','mst','maDon','maKH','maBG','maCS','maBC','bgGoc','hsCode','matKhauHash','tuNV','denNV','nhomKH',
  'ngay','ngayTao','ngayVao','ngayLHGanNhat','ngayHenCham','ngayDonDau','ngayDonGanNhat','sinhNhat','ngayCapNhat','thoiGian','ngayHenTiep',
  'ngayGui','hieuLucDen','ngayChot','ngayDuyet','thoiGianNop','capNhatLuc','ql_ngayDuyet','maHT','maNVSale','nguoiTao','nguoiXuLy','dongLuc','maKHHT','sdt2','maGD','maCL','ngayCK','xacNhanLuc','maThamChieu','tkKhach','nguoiXacNhan','nguoiGui']);

const LISTS = {
  GIAI_DOAN: GD_THU_TU,
  MUC_DO: ['Nóng', 'Ấm', 'Lạnh'],
  KENH: ['Gọi điện', 'Zalo', 'SMS', 'Facebook/Messenger', 'Email', 'Gặp trực tiếp', 'Khác'],
  MUC_DICH: [MD_TIEP_CAN, 'Khai thác nhu cầu', 'Tư vấn chính ngạch', 'Gửi tài liệu/Case thực tế', 'Follow báo giá', 'Chốt đơn', 'Cập nhật tiến độ đơn', 'Hỏi thăm sau giao hàng', 'Xin giới thiệu', 'Đánh thức khách ngủ', 'Chúc mừng/Dịp lễ', 'Xử lý phản ánh'],
  KET_QUA: ['Không nghe máy', 'Thuê bao/Sai số', 'Đã nhắn - chưa phản hồi', 'Đã kết bạn Zalo', 'Trao đổi được - có quan tâm', 'Trao đổi được - chưa có nhu cầu', 'Đang dùng đơn vị khác', 'Hẹn gọi lại', 'Xin báo giá', 'Chê giá cao', 'Đồng ý chốt đơn', 'Phản ánh/Khiếu nại', 'Hài lòng sau giao hàng', 'Từ chối hẳn'],
  LOAI_KH: ['Shop TMĐT', 'Shop offline', 'Nhà bán buôn', 'Nhà máy/Xưởng sản xuất', 'Công ty nhập khẩu/Thương mại', 'Doanh nghiệp SME', 'Cơ sở sản xuất nhỏ', 'Cá nhân', 'Đối tác/Đại lý'],
  NGUON_KH: ['Tự tìm - Facebook', 'Tự tìm - Zalo/Group', 'Tự tìm - Sàn TMĐT', 'Tự tìm - Google Maps/Web', 'Bài đăng FB cá nhân', 'Fanpage công ty', 'Website', 'TikTok', 'Khách cũ giới thiệu', 'Đối tác giới thiệu', 'Hội chợ/Sự kiện', 'Công ty phân bổ', 'Kho khách ngủ', 'Khác'],
  NGANH_HANG: ['Gia dụng', 'Thời trang - Phụ kiện', 'Điện tử - Phụ kiện', 'Mỹ phẩm', 'Mẹ & bé - Đồ chơi', 'Máy móc - Thiết bị', 'Nguyên phụ liệu sản xuất', 'Nội thất', 'Vật liệu xây dựng', 'Phụ tùng ô tô - xe máy', 'Văn phòng phẩm', 'Thực phẩm', 'Khác'],
  DICH_VU: ['Mua hộ', 'Thanh toán hộ', 'Nhập khẩu chính ngạch', 'Nhập khẩu tiểu ngạch', 'Vận chuyển TQ-VN', 'Khai báo hải quan', 'Logistics trọn gói', 'Tìm nguồn hàng'],
  HINH_THUC_NK: ['Trọn gói chính ngạch - Nam Trung xuất HĐ VAT', 'Ủy thác nhập khẩu (bên nhận ủy thác đứng tên)', 'KH tự đứng tên NK - thuê VC + khai HQ', 'Chỉ mua hộ / thanh toán hộ', 'Vận chuyển không hóa đơn', 'Tiểu ngạch (đang chuyển dịch)', 'Chưa xác định'],
  PHAP_NHAN: ['Công ty (có MST)', 'Hộ kinh doanh', 'Cá nhân'],
  CAN_HOA_DON: ['Cần HĐ VAT', 'Không cần', 'Chưa rõ'],
  DAC_THU_HANG: ['Hàng thông thường', 'Cần hợp quy/công bố', 'Kiểm dịch/ATTP', 'Cần giấy phép NK', 'Hàng có thương hiệu', 'Hàng mẫu < 100kg', 'Hàng cồng kềnh', 'Hàng dễ vỡ'],
  TAN_SUAT: ['Hàng tuần', '2-3 tuần/lần', 'Hàng tháng', 'Theo mùa vụ', 'Lô lẻ/Thử nghiệm', 'Chưa rõ'],
  GIA_TRI: ['Dưới 50 triệu', '50-200 triệu', '200-500 triệu', '500 triệu - 1 tỷ', 'Trên 1 tỷ'],
  TRANG_THAI_BG: Object.values(BG_TT),
  LY_DO_TU_CHOI: ['Giá cao hơn đối thủ', 'Thời gian vận chuyển', 'Chưa tin tưởng', 'Hủy/đổi kế hoạch nhập', 'Chọn đơn vị khác', 'Vướng giấy phép/chính sách', 'Không phản hồi', 'Khác'],
  CAP_BAC: ['Nhân viên KD', 'Chuyên viên KD', 'Trưởng nhóm KD', 'Trưởng phòng KD', 'Giám đốc KD khối', 'Giám đốc KD'],
  CAP_DUYET_GIA: ['Trưởng phòng KD', 'Giám đốc KD khối', 'Giám đốc KD'],
  DVT: ['Chiếc', 'Bộ', 'Cái', 'Đôi', 'Kg', 'Mét', 'Cuộn', 'Hộp', 'Thùng', 'Tấm'],
  LUU_Y_BG: ['Báo giá có hiệu lực {N} ngày kể từ ngày báo giá. Tỷ giá áp dụng theo ngày thanh toán tiền hàng.',
    'Giá trên là dự kiến, tính theo thông tin hàng hóa, cân nặng, số khối do nhà cung cấp gửi. Chi phí thực tế có thể thay đổi khi hàng về kho.',
    'Cước vận chuyển tính theo cân nặng hoặc thể tích thực tế khi hàng về kho Hà Nội.',
    'Thuế nhập khẩu, VAT áp dụng theo mã HS dự kiến; nếu Hải quan áp mã khác, chi phí điều chỉnh theo thực tế.'],
  THONG_TIN_CTY: ['ten=CÔNG TY TNHH DỊCH VỤ VÀ THƯƠNG MẠI QUỐC TẾ NAM TRUNG', 'tenNgan=Nam Trung Group', 'website=namtrunglog.com', 'diaChi=', 'hotline=', 'email=', 'mst=', 'tenNganHang=', 'qrMaNH=', 'qrSoTK=', 'qrTenTK=', 'qrMau=compact2', 'qrAnh='],
  LOAI_CLAIM: ['Claim hàng hóa (thiếu / hỏng / sai)', 'Claim thời gian giao hàng', 'Claim hoa hồng / thu nhập', 'Hỏi đáp quy trình / chính sách', 'Đề xuất cải tiến', 'Báo lỗi hệ thống CRM', 'Khác'],
  TK_CONG_TY: ['VCB - 0000000000 - CTY NAM TRUNG (Admin sửa lại)', 'Tiền mặt'],
  CHU_DE_HO_TRO: ['Giá / khung giá', 'Mã HS - thuế - giấy phép', 'Phương án nhập chính ngạch', 'Chốt khách / đàm phán', 'Xử lý phản ánh', 'Gọi hoặc gặp khách cùng', 'Tìm nguồn hàng', 'Khác'],
  THAM_SO: ['tyLeCoc=80', 'hieuLucBG=5', 'ngayKhoNgu=90', 'ngayKHHTHoatDong=60', 'gioHanBaoCao=18', 'ngayBoQuen=30', 'giuBanSaoLuu=8'],
  MAC_DINH_BG: ['tyGia=4015', 'tyGiaSan=4015', 'tyGiaVon=3955', 'phiDVPct=2', 'phiDVSan=1.2', 'phiUTPct=1', 'phiUTSan=0.8',
    'vatPct=8', 'donGiaKg=7000', 'donGiaKhoi=1100000', 'giaVonKhoi=800000', 'lamTron=0.01', 'coSoUyThac=giaXuat', 'heSoToKhai=0.9425', 'tyLeXuatMin=70', 'tndnPct=20', 'coSoThueNK=toKhai', 'lamTronKieu=gan'],
};

const KPI_SEED = [
  ['khMoi', 'KH mới nhập hệ thống', 15, 15, 'Tự đếm: hồ sơ KH tạo mới trong ngày'],
  ['tiepCan', 'Tiếp cận lần đầu', 15, 20, 'Tự đếm: nhật ký mục đích "Tiếp cận lần đầu" (mỗi KH 1 lần/ngày)'],
  ['ketNoi', 'Kết nối thành công', 6, 20, 'Tự đếm: KH trao đổi được (không tính không nghe máy/chưa phản hồi)'],
  ['chamLai', 'Chăm sóc KH cũ', 10, 15, 'Tự đếm: số KH cũ được chăm trong ngày'],
  ['baoGia', 'Báo giá gửi khách', 1, 10, 'Tự đếm: báo giá chuyển "Đã gửi"'],
  ['fb', 'Bài FB chính ngạch', 2, 10, 'Tự khai link, quản lý xác nhận'],
  ['dungHan', 'Báo cáo ngày đúng hạn', 1, 10, 'Nộp trước ' + APP.GIO_HAN_BAO_CAO + ':00'],
  ['goi', 'Cuộc gọi có ghi nhật ký', 30, 0, 'Theo dõi, chưa tính điểm'],
  ['nhanTin', 'Tin nhắn có ghi nhật ký', 30, 0, 'Theo dõi, chưa tính điểm'],
  ['khQuanTam', 'KH Nóng/Ấm được chăm', 3, 0, 'Theo dõi, chưa tính điểm'],
  ['donChot', 'Đơn chốt', 0, 0, 'Giai đoạn tích lũy: theo dõi, không tính điểm'],
];
const KPI_KHONG_HE_SO = ['fb', 'dungHan'];

/* ============================ GIAO DIỆN WEB ============================ */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(APP.TEN)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ============================ MENU TRONG SHEET ============================ */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('⚙️ Nam Trung CRM')
    .addItem('1. Khởi tạo / cập nhật cấu trúc', 'menuKhoiTao')
    .addItem('2. Đặt lại mật khẩu nhân viên', 'menuDatMatKhau')
    .addItem('3. Cài lịch chạy tự động hằng ngày', 'menuCaiLich')
    .addItem('4. Làm mới cờ khách đang chạy', 'menuKHHT')
    .addItem('5. Sao lưu ngay', 'menuSaoLuu')
    .addItem('6. Kiểm tra mã QR thanh toán', 'menuKiemTraQR')
    .addToUi();
}

function menuKhoiTao() {
  const ui = SpreadsheetApp.getUi();
  const ss = ss_();   // [ERP] dùng file CRM đã kết nối, không dùng file đang mở
  ss.setSpreadsheetTimeZone(APP.TZ);
  Object.keys(SCHEMA).forEach(name => {
    let s = ss.getSheetByName(name) || ss.insertSheet(name);
    const labels = SCHEMA[name].map(x => x[1]);
    if (s.getMaxColumns() < labels.length) s.insertColumnsAfter(s.getMaxColumns(), labels.length - s.getMaxColumns());
    s.getRange(1, 1, 1, labels.length).setValues([labels]).setFontWeight('bold').setBackground('#0E3B43').setFontColor('#ffffff').setWrap(true).setVerticalAlignment('middle');
    s.setFrozenRows(1);
  });
  const kpi = ss.getSheetByName(SH.KPI);
  if (kpi.getLastRow() < 2) kpi.getRange(2, 1, KPI_SEED.length, 5).setValues(KPI_SEED);
  let ch = ss.getSheetByName(SH.CH) || ss.insertSheet(SH.CH);
  const keys = Object.keys(LISTS);
  const have = ch.getLastColumn() > 0 ? ch.getRange(1, 1, 1, ch.getLastColumn()).getValues()[0].map(String) : [];
  keys.forEach(k => {
    if (have.includes(k)) return;
    const col = (ch.getLastColumn() || 0) + 1;
    if (ch.getMaxColumns() < col) ch.insertColumnsAfter(ch.getMaxColumns(), 1);
    const vals = [[k]].concat(LISTS[k].map(v => [v]));
    if (ch.getMaxRows() < vals.length) ch.insertRowsAfter(ch.getMaxRows(), vals.length - ch.getMaxRows());
    ch.getRange(1, col, vals.length, 1).setValues(vals);
    ch.getRange(1, col).setFontWeight('bold').setBackground('#E8A317');
  });
  ch.setFrozenRows(1);
  const ns = readAll_(SH.NS);
  if (!ns.some(u => u.vaiTro === 'ADMIN')) {
    const r = ui.prompt('Tạo tài khoản ADMIN', 'Đặt mật khẩu cho mã NV "ADMIN" (tối thiểu 6 ký tự):', ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK || r.getResponseText().length < 6) { ui.alert('Chưa tạo ADMIN. Chạy lại menu và nhập mật khẩu ≥ 6 ký tự.'); return; }
    append_(SH.NS, { maNV: 'ADMIN', hoTen: 'Quản trị hệ thống', email: Session.getEffectiveUser().getEmail(), vaiTro: 'ADMIN', capBac: 'Giám đốc KD', trangThai: 'Đang làm', heSoKPI: 1, matKhauHash: hash_(r.getResponseText()), ngayTao: today_(), ngayVao: today_() });
  }
  cClear_();
  ui.alert('Khởi tạo xong. Bước tiếp: Deploy (Triển khai) → New deployment → Web app.');
}

function menuDatMatKhau() {
  const ui = SpreadsheetApp.getUi();
  const a = ui.prompt('Đặt lại mật khẩu', 'Nhập mã NV:', ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return;
  const u = findOne_(SH.NS, 'maNV', a.getResponseText().trim().toUpperCase());
  if (!u) { ui.alert('Không tìm thấy mã NV'); return; }
  const b = ui.prompt('Mật khẩu mới cho ' + u.hoTen, 'Tối thiểu 6 ký tự:', ui.ButtonSet.OK_CANCEL);
  if (b.getSelectedButton() !== ui.Button.OK || b.getResponseText().length < 6) return;
  u.matKhauHash = hash_(b.getResponseText()); update_(SH.NS, u); cClear_();
  ui.alert('Đã đặt lại mật khẩu cho ' + u.hoTen);
}

function menuCaiLich() {
  const ui = SpreadsheetApp.getUi();
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'jobHangNgay').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('jobHangNgay').timeBased().atHour(5).everyDays(1).inTimezone(APP.TZ).create();
  ui.alert('Đã cài: mỗi sáng 5h hệ thống tự chuyển khách quá hạn không có đơn vào Kho khách ngủ, đánh dấu báo giá hết hạn, đối chiếu khách đang chạy; thứ Hai tự sao lưu file.');
}

function menuKHHT() {
  const ui = SpreadsheetApp.getUi();
  const r = withLock_(() => { khhtClear_(); return refreshFlagsKHHT_(); });
  ui.alert('Đã đối chiếu. Có ' + r.dangChay.length + ' hồ sơ trong CRM trùng khách đang chạy của công ty (xem báo cáo "Trùng khách đang chạy").');
}
function menuKiemTraQR() {
  const ui = SpreadsheetApp.getUi(), url = qrUrl_(100000, 'TEST'), img = qrDataUrl_(100000, 'TEST');
  if (!url) { ui.alert('Thiếu thông tin: CAU_HINH → THONG_TIN_CTY cần qrMaNH (Vietinbank), qrSoTK, qrMau (compact2).'); return; }
  ui.alert('Link VietQR dùng trên báo giá (dán vào trình duyệt để xem thử):\n' + url + '\n\nẢnh QR dự phòng tự vẽ: ' + (img ? 'OK' : 'LỖI'));
}
function menuSaoLuu() { const ui = SpreadsheetApp.getUi(); backup_(); ui.alert('Đã sao lưu vào thư mục Drive "NamTrung_CRM_SaoLuu".'); }
/** Mỗi thứ Hai: chép nguyên file vào Drive, giữ N bản gần nhất. */
function backup_() {
  const ss = ss_(), it = DriveApp.getFoldersByName('NamTrung_CRM_SaoLuu');
  const f = it.hasNext() ? it.next() : DriveApp.createFolder('NamTrung_CRM_SaoLuu');
  DriveApp.getFileById(ss.getId()).makeCopy('SaoLuu_' + today_() + '_' + ss.getName(), f);
  const files = [], fi = f.getFiles();
  while (fi.hasNext()) files.push(fi.next());
  files.sort((a, b) => b.getDateCreated() - a.getDateCreated()).slice(thamSo_().giuBanSaoLuu).forEach(x => x.setTrashed(true));
}

/** Chạy tự động mỗi sáng. */
function jobHangNgay() {
  const t = today_();
  withLock_(() => {
    const s = sh_(SH.KH), cols = COLS[SH.KH], kh = readAll_(SH.KH);
    const cGD = cols.indexOf('giaiDoan') + 1, cHen = cols.indexOf('ngayHenCham') + 1;
    kh.forEach(k => {
      if (Number(k.soDon) > 0 && k.ngayDonGanNhat && [GD.DON_DAU, GD.HOAT_DONG, GD.VIP].includes(k.giaiDoan) && diffDays_(k.ngayDonGanNhat, t) > thamSo_().ngayKhoNgu) {
        s.getRange(k._row, cGD).setValue(GD.KHO_NGU);
        s.getRange(k._row, cHen).setValue("'" + t);
      }
    });
    const bs = sh_(SH.BG), bc = COLS[SH.BG], cTT = bc.indexOf('trangThai') + 1;
    readTail_(SH.BG, 'ngayTao', addDays_(t, -120)).forEach(b => {
      if ([BG_TT.GUI, BG_TT.CAN_NHAC].includes(b.trangThai) && b.hieuLucDen && b.hieuLucDen < addDays_(t, -14)) bs.getRange(b._row, cTT).setValue(BG_TT.HET_HAN);
    });
    try { khhtClear_(); refreshFlagsKHHT_(); } catch (e) { console.error(e); }
  });
  if (dow_(t) === 1) try { backup_(); } catch (e) { console.error(e); }
}

/* ============================ TIỆN ÍCH NỘI BỘ ============================ */
let SS_CACHE_ = null, USERS_CACHE_ = null, LISTS_CACHE_ = null, KPI_CACHE_ = null;
/* Bộ nhớ đệm: danh sách nhân viên, cấu hình, KPI ít thay đổi -> giữ 10–30 phút, xóa ngay khi có sửa. */
function cGet_(k) { try { const v = CacheService.getScriptCache().get(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function cPut_(k, o, sec) { try { const t = JSON.stringify(o); if (t.length < 95000) CacheService.getScriptCache().put(k, t, sec || 1800); } catch (e) {} }
function cClear_() { CacheService.getScriptCache().removeAll(['C_USERS', 'C_LISTS', 'C_KPI']); USERS_CACHE_ = null; LISTS_CACHE_ = null; KPI_CACHE_ = null; TS_CACHE_ = null; }
/* Giá trị lớn hơn 100KB: chia nhiều mảnh. */
function cBigPut_(k, o, sec) {
  try { const t = JSON.stringify(o), n = Math.max(1, Math.ceil(t.length / 90000)), m = {};
    for (let i = 0; i < n; i++) m[k + '_' + i] = t.slice(i * 90000, (i + 1) * 90000);
    m[k + '_N'] = String(n); CacheService.getScriptCache().putAll(m, sec || 21600); } catch (e) {}
}
function cBigGet_(k) {
  try { const c = CacheService.getScriptCache(), n = Number(c.get(k + '_N')); if (!n) return null;
    const keys = []; for (let i = 0; i < n; i++) keys.push(k + '_' + i);
    const g = c.getAll(keys); let t = ''; for (const kk of keys) { if (g[kk] == null) return null; t += g[kk]; }
    return JSON.parse(t); } catch (e) { return null; }
}
/** Admin sửa tay NHAN_SU / CAU_HINH / KPI_CHI_TIEU trên Sheet -> xóa bộ nhớ đệm để app thấy ngay. */
function onEdit(e) { try { const n = e.range.getSheet().getName(); if ([SH.NS, SH.CH, SH.KPI].includes(n)) cClear_(); if (n === SH.KHHT) khhtClear_(); } catch (x) {} }
function ss_() {
  if (SS_CACHE_) return SS_CACHE_;
  const id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  SS_CACHE_ = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  ensureSchema_(SS_CACHE_);
  return SS_CACHE_;
}
/** Tự cập nhật cấu trúc: sau khi dán code mới, lần chạy đầu tiên tự thêm sheet / cột còn thiếu (không cần chạy menu Khởi tạo). */
function ensureSchema_(ss) {
  const ver = Object.keys(SCHEMA).map(k => k + ':' + SCHEMA[k].length).join('|'), p = PropertiesService.getScriptProperties();
  if (p.getProperty('SCHEMA_VER') === ver) return;
  Object.keys(SCHEMA).forEach(name => {
    const s = ss.getSheetByName(name) || ss.insertSheet(name), labels = SCHEMA[name].map(x => x[1]), n = labels.length;
    if (s.getMaxColumns() < n) s.insertColumnsAfter(s.getMaxColumns(), n - s.getMaxColumns());
    if (String(s.getRange(1, n).getValue()) !== labels[n - 1]) {
      s.getRange(1, 1, 1, n).setValues([labels]).setFontWeight('bold').setBackground('#0E3B43').setFontColor('#ffffff').setWrap(true);
      s.setFrozenRows(1);
    }
  });
  p.setProperty('SCHEMA_VER', ver);
}
function sh_(name) {
  const s = ss_().getSheetByName(name);
  if (!s) throw new Error('Thiếu sheet "' + name + '". Admin hãy chạy menu Nam Trung CRM → Khởi tạo.');
  return s;
}
function norm_(v) { return (v instanceof Date) ? Utilities.formatDate(v, APP.TZ, 'yyyy-MM-dd') : v; }
function rowObj_(cols, r, rowNum) { const o = { _row: rowNum }; for (let j = 0; j < cols.length; j++) o[cols[j]] = norm_(r[j]); return o; }
function readAll_(name) {
  const s = sh_(name), cols = COLS[name], n = s.getLastRow() - 1;
  if (n < 1) return [];
  return s.getRange(2, 1, n, cols.length).getValues().map((r, i) => rowObj_(cols, r, i + 2));
}
/** Đọc từ cuối sheet lên: dò cột khóa trước (rẻ), rồi chỉ đọc đủ cột cho phần dòng cần. Dữ liệu ghi theo thời gian. */
function readTail_(name, key, fromIso) {
  const s = sh_(name), cols = COLS[name], ci = cols.indexOf(key) + 1, last = s.getLastRow();
  if (last < 2) return [];
  let start = last + 1, end = last;
  while (end >= 2) {
    const st = Math.max(2, end - 4999), kv = s.getRange(st, ci, end - st + 1, 1).getValues();
    let i = kv.length - 1;
    for (; i >= 0; i--) if (String(norm_(kv[i][0])) < fromIso) break;
    if (i >= 0) { start = st + i + 1; break; }
    start = st; end = st - 1;
  }
  if (start > last) return [];
  return s.getRange(start, 1, last - start + 1, cols.length).getValues().map((r, j) => rowObj_(cols, r, start + j));
}
function findRows_(name, key, value) {
  if (value === '' || value == null) return [];
  const s = sh_(name), cols = COLS[name], ci = cols.indexOf(key) + 1, last = s.getLastRow();
  if (last < 2) return [];
  const hits = s.getRange(2, ci, last - 1, 1).createTextFinder(String(value)).matchEntireCell(true).matchCase(true).findAll().map(r => r.getRow());
  if (!hits.length) return [];
  const mn = Math.min.apply(null, hits), mx = Math.max.apply(null, hits);
  if (mx - mn < 3000) {
    const vals = s.getRange(mn, 1, mx - mn + 1, cols.length).getValues(), set = new Set(hits), out = [];
    vals.forEach((r, i) => { if (set.has(mn + i)) out.push(rowObj_(cols, r, mn + i)); });
    return out;
  }
  return hits.map(rn => rowObj_(cols, s.getRange(rn, 1, 1, cols.length).getValues()[0], rn));
}
function findOne_(name, key, value) { return findRows_(name, key, value)[0] || null; }
function out_(k, v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  v = String(v);
  if (v === '') return '';
  if (TEXT_KEYS.has(k) || /^[=+@-]/.test(v)) return "'" + v;
  return v;
}
function append_(name, obj) { sh_(name).appendRow(COLS[name].map(c => out_(c, obj[c]))); }
function appendMany_(name, arr) {
  if (!arr.length) return;
  const s = sh_(name), cols = COLS[name];
  s.getRange(s.getLastRow() + 1, 1, arr.length, cols.length).setValues(arr.map(o => cols.map(c => out_(c, o[c]))));
}
function update_(name, obj) {
  if (!obj._row) throw new Error('Thiếu vị trí dòng khi cập nhật ' + name);
  const cols = COLS[name];
  sh_(name).getRange(obj._row, 1, 1, cols.length).setValues([cols.map(c => out_(c, obj[c]))]);
}
function withLock_(fn) {
  const l = LockService.getScriptLock();
  if (!l.tryLock(25000)) throw new Error('Hệ thống đang bận do nhiều người lưu cùng lúc. Vui lòng bấm lại sau vài giây.');
  try { return fn(); } finally { l.releaseLock(); }
}
function seq_(key, pad) {
  const p = PropertiesService.getScriptProperties();
  const n = Number(p.getProperty(key) || 0) + 1;
  p.setProperty(key, String(n));
  return String(n).padStart(pad, '0');
}
function today_() { return Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd'); }
function now_() { return Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd HH:mm'); }
function d_(iso) { const p = String(iso).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
function iso_(dt) { return dt.toISOString().slice(0, 10); }
function addDays_(iso, n) { const d = d_(iso); d.setUTCDate(d.getUTCDate() + n); return iso_(d); }
function diffDays_(a, b) { return Math.round((d_(b) - d_(a)) / 86400000); }
function dow_(iso) { return d_(iso).getUTCDay(); }
function workDays_(from, to) { let n = 0, d = from; while (d <= to) { if (dow_(d) !== 0) n++; d = addDays_(d, 1); } return n; }
function fold_(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase(); }
function normPhone_(s) {
  s = String(s || '').trim();
  if (!s || !/^[\d\s.+()\-]+$/.test(s)) return s;
  let d = s.replace(/\D/g, '');
  if (d.indexOf('84') === 0 && d.length >= 11) d = '0' + d.slice(2);
  return d;
}
function parseDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, APP.TZ, 'yyyy-MM-dd');
  v = String(v == null ? '' : v).trim(); if (!v) return '';
  const p2 = x => String(x).padStart(2, '0');
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return m[1] + '-' + p2(m[2]) + '-' + p2(m[3]);
  m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/); if (m) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + p2(m[2]) + '-' + p2(m[1]);
  return '';
}
function hours_(a, b) { const f = x => { const m = String(x).match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]) : NaN; }; return (f(b) - f(a)) / 3600000; }
function money_(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function money2_(n) { const v = Math.round((Number(n) || 0) * 100) / 100; const p = v.toFixed(2).split('.'); return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (p[1] === '00' ? '' : ',' + p[1]); }
function escH_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function lists_() {
  if (LISTS_CACHE_) return LISTS_CACHE_;
  const cached = cGet_('C_LISTS');
  if (cached) { LISTS_CACHE_ = cached; return cached; }
  const s = sh_(SH.CH), lc = s.getLastColumn(), lr = s.getLastRow(), out = {};
  if (lc && lr) {
    const v = s.getRange(1, 1, lr, lc).getValues();
    for (let c = 0; c < lc; c++) {
      const k = String(v[0][c]).trim(); if (!k) continue;
      out[k] = []; for (let r = 1; r < lr; r++) { const x = String(v[r][c]).trim(); if (x) out[k].push(x); }
    }
  }
  Object.keys(LISTS).forEach(k => { if (!out[k] || !out[k].length) out[k] = LISTS[k].slice(); });
  LISTS_CACHE_ = out; cPut_('C_LISTS', out, 1800);
  return out;
}
function macDinh_() {
  const o = {};
  lists_().MAC_DINH_BG.forEach(x => { const i = x.indexOf('='); if (i > 0) { const k = x.slice(0, i).trim(), v = x.slice(i + 1).trim(); o[k] = isNaN(Number(v)) ? v : Number(v); } });
  return o;
}
function kpiTargets_() {
  if (KPI_CACHE_) return KPI_CACHE_;
  const c = cGet_('C_KPI'); if (c) return (KPI_CACHE_ = c);
  KPI_CACHE_ = readAll_(SH.KPI).filter(r => r.maChiSo).map(r => ({ maChiSo: r.maChiSo, tenChiSo: r.tenChiSo, ngay: Number(r.ngay) || 0, trongSo: Number(r.trongSo) || 0, ghiChu: r.ghiChu }));
  cPut_('C_KPI', KPI_CACHE_, 1800);
  return KPI_CACHE_;
}

/* ============================ ĐĂNG NHẬP & PHÂN QUYỀN ============================ */
function hash_(s) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s) + '|NamTrung#CRM');
  return b.map(x => ((x + 256) % 256).toString(16).padStart(2, '0')).join('');
}
function users_() {
  if (USERS_CACHE_) return USERS_CACHE_;
  let u = cGet_('C_USERS');
  if (!u) { u = readAll_(SH.NS).filter(x => x.maNV); cPut_('C_USERS', u, 600); }
  return (USERS_CACHE_ = u);
}
function userBy_(ma) { return users_().find(u => u.maNV === ma) || null; }
function pubUser_(u) { return { maNV: u.maNV, hoTen: u.hoTen, email: u.email, sdt: u.sdt, vaiTro: u.vaiTro, maQuanLy: u.maQuanLy, capBac: u.capBac, heSoKPI: Number(u.heSoKPI) || 1, trangThai: u.trangThai }; }
function session_(u) {
  const t = Utilities.getUuid();
  CacheService.getScriptCache().put('S_' + t, u.maNV, APP.PHIEN_GIAY);
  return { token: t, user: pubUser_(u) };
}
function auth_(token) {
  if (!token) throw new Error('PHIEN_HET_HAN');
  const c = CacheService.getScriptCache(), ma = c.get('S_' + token);
  if (!ma) throw new Error('PHIEN_HET_HAN');
  const u = userBy_(ma);
  if (!u || u.trangThai !== 'Đang làm') throw new Error('PHIEN_HET_HAN');
  c.put('S_' + token, ma, APP.PHIEN_GIAY);
  return u;
}
/** null = toàn quyền (ADMIN); Set = các mã NV được xem. */
function scope_(u) {
  if (u.vaiTro === 'ADMIN') return null;
  const s = new Set([u.maNV]);
  if (u.vaiTro === 'QUANLY') users_().forEach(x => { if (x.maQuanLy === u.maNV) s.add(x.maNV); });
  return s;
}
function inScope_(sc, ma) { return sc === null || sc.has(ma); }
function needRole_(u, roles) { if (!roles.includes(u.vaiTro)) throw new Error('Bạn không có quyền thực hiện thao tác này'); }
function canApprovePrice_(u) { return u.vaiTro === 'ADMIN' || lists_().CAP_DUYET_GIA.includes(u.capBac); }

function apiLogin(maNV, mk) {
  const u = userBy_(String(maNV || '').trim().toUpperCase());
  if (!u || u.trangThai !== 'Đang làm' || u.matKhauHash !== hash_(mk)) throw new Error('Sai mã nhân viên hoặc mật khẩu');
  return session_(u);
}
function apiAutoLogin() {
  try {
    const email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
    if (!email) return null;
    const u = users_().find(x => String(x.email || '').toLowerCase() === email && x.trangThai === 'Đang làm');
    return u ? session_(u) : null;
  } catch (e) { return null; }
}
function apiLogout(token) { if (token) CacheService.getScriptCache().remove('S_' + token); return true; }
function apiDoiMatKhau(token, cu, moi) {
  const u = auth_(token);
  if (u.matKhauHash !== hash_(cu)) throw new Error('Mật khẩu hiện tại không đúng');
  if (String(moi || '').length < 6) throw new Error('Mật khẩu mới tối thiểu 6 ký tự');
  return withLock_(() => { const r = findOne_(SH.NS, 'maNV', u.maNV); r.matKhauHash = hash_(moi); update_(SH.NS, r); cClear_(); return true; });
}

function apiBootstrap(token) {
  const u = auth_(token), sc = scope_(u);
  const team = users_().filter(x => x.trangThai === 'Đang làm' && (u.vaiTro === 'KETOAN' ? x.vaiTro !== 'ADMIN' && x.vaiTro !== 'KETOAN' : inScope_(sc, x.maNV))).map(x => ({ maNV: x.maNV, hoTen: x.hoTen, vaiTro: x.vaiTro, maQuanLy: x.maQuanLy, capBac: x.capBac }));
  return {
    user: pubUser_(u), team, lists: lists_(), md: macDinh_(), kpi: kpiTargets_(), nhip: NHIP_CHAM, gd: GD, gdThuTu: GD_THU_TU,
    kqThatBai: KQ_THAT_BAI, bgTT: BG_TT, today: today_(), gioHan: thamSo_().gioHanBaoCao, ts: thamSo_(), htTT: HT_TT, duyetGia: canApprovePrice_(u),
    quanLy: users_().filter(x => x.vaiTro === 'QUANLY' && x.trangThai === 'Đang làm').map(x => ({ maNV: x.maNV, hoTen: x.hoTen })),
  };
}

/* ============================ KHÁCH HÀNG ============================ */
function decorate_(k, t) {
  k.canhBao = ''; k.soNgayQH = 0;
  if (k.trungKHHT === KHHT.DANG) k.canhBao = 'KH công ty';
  else if (k.giaiDoan !== GD.LOAI) {
    if (k.ngayHenCham && k.ngayHenCham < t) { k.canhBao = 'Quá hạn'; k.soNgayQH = diffDays_(k.ngayHenCham, t); }
    else if (k.ngayHenCham === t) k.canhBao = 'Hôm nay';
    else if (k.giaiDoan === GD.KHO_NGU) k.canhBao = 'Kho khách ngủ';
    else if (k.ngayLHGanNhat && diffDays_(k.ngayLHGanNhat, t) > thamSo_().ngayBoQuen && k.giaiDoan !== GD.MAT) k.canhBao = 'Bỏ quên';
  }
  const nv = userBy_(k.maNV); k.tenNV = nv ? nv.hoTen : k.maNV;
  k.soHuu = Number(k.soDon) > 0 ? 'Chủ khách' : 'Đang theo';
  return k;
}
const KH_SLIM = ['maKH','ngayTao','tenLienHe','tenCongTy','sdt','zalo','mst','loaiKH','nganhHang','nguonKH','hinhThucNK','tinhThanh','giaiDoan','mucDo','ketQuaGanNhat','ngayLHGanNhat','ngayHenCham','soLanCham','soBaoGia','soDon','ngayDonGanNhat','maNV','tenNV','canhBao','soNgayQH','soHuu','trungKHHT'];
function slim_(o, keys) { const r = {}; keys.forEach(k => r[k] = o[k]); return r; }
function khScope_(u) { const sc = scope_(u), t = today_(); return readAll_(SH.KH).filter(k => k.maKH && inScope_(sc, k.maNV)).map(k => decorate_(k, t)); }

function apiListKH(token, f) {
  const u = auth_(token); f = f || {};
  let rows = khScope_(u);
  const counts = { tong: rows.length, quaHan: 0, homNay: 0, nong: 0, khoNgu: 0, boQuen: 0 };
  rows.forEach(k => { if (k.canhBao === 'Quá hạn') counts.quaHan++; if (k.canhBao === 'Hôm nay') counts.homNay++; if (k.mucDo === 'Nóng') counts.nong++; if (k.giaiDoan === GD.KHO_NGU) counts.khoNgu++; if (k.canhBao === 'Bỏ quên') counts.boQuen++; });
  if (f.maNV) rows = rows.filter(k => k.maNV === f.maNV);
  if (f.giaiDoan) rows = rows.filter(k => k.giaiDoan === f.giaiDoan);
  if (f.mucDo) rows = rows.filter(k => k.mucDo === f.mucDo);
  if (f.canhBao === 'CanCham') rows = rows.filter(k => k.canhBao === 'Quá hạn' || k.canhBao === 'Hôm nay');
  else if (f.canhBao) rows = rows.filter(k => k.canhBao === f.canhBao);
  if (f.loaiKH) rows = rows.filter(k => k.loaiKH === f.loaiKH);
  if (f.q) { const q = fold_(f.q); rows = rows.filter(k => fold_([k.maKH, k.tenLienHe, k.tenCongTy, k.sdt, k.zalo, k.mst, k.nganhHang, k.tinhThanh].join(' ')).indexOf(q) >= 0); }
  const pr = { 'Quá hạn': 0, 'Hôm nay': 1 };
  rows.sort((a, b) => ((pr[a.canhBao] ?? 2) - (pr[b.canhBao] ?? 2)) || String(a.ngayHenCham || '9').localeCompare(String(b.ngayHenCham || '9')));
  return { total: rows.length, counts, rows: rows.slice(0, Number(f.limit) || 400).map(k => slim_(k, KH_SLIM)) };
}
function apiKHGon(token) { const u = auth_(token); return khScope_(u).filter(k => k.giaiDoan !== GD.LOAI).map(k => ({ maKH: k.maKH, ten: k.tenCongTy || k.tenLienHe, lienHe: k.tenLienHe, sdt: k.sdt, hinhThucNK: k.hinhThucNK, soLanCham: Number(k.soLanCham) || 0, giaiDoan: k.giaiDoan, mucDo: k.mucDo })); }

function apiGetKH(token, maKH) {
  const u = auth_(token), sc = scope_(u);
  const k = findOne_(SH.KH, 'maKH', maKH);
  if (!k || !inScope_(sc, k.maNV)) throw new Error('Không tìm thấy khách hàng hoặc bạn không có quyền xem');
  decorate_(k, today_());
  const logs = findRows_(SH.CS, 'maKH', maKH).reverse().slice(0, 200).map(c => { const nv = userBy_(c.maNV); c.tenNV = nv ? nv.hoTen : c.maNV; return c; });
  const bgs = findRows_(SH.BG, 'maKH', maKH).reverse().map(b => slim_(b, ['maBG','ngayTao','ngayGui','maDon','tomTatHang','tongSauVAT','trangThai','phienBan','ngayChot','lyDo']));
  const chuyen = findRows_(SH.CHUYEN, 'maKH', maKH).reverse();
  const ht = findRows_(SH.HT, 'maKH', maKH).reverse().map(htOut_);
  const nr = findRows_(SH.NR, 'maKH', maKH).reverse().map(nrOut_);
  return { kh: k, logs, bgs, chuyen, ht, nr };
}

function findDup_(o, exclude) {
  const s = sh_(SH.KH), n = s.getLastRow() - 1;
  if (n < 1) return null;
  const cols = COLS[SH.KH], col = k => s.getRange(2, cols.indexOf(k) + 1, n, 1).getValues().map(r => String(r[0]).trim());
  const ma = col('maKH'), nv = col('maNV'), sdt = col('sdt'), zalo = col('zalo'), mst = col('mst'), don = col('soDon');
  const phones = [o.sdt, o.zalo].filter(v => v && /^0\d{8,10}$/.test(v));
  for (let i = 0; i < n; i++) {
    if (!ma[i] || ma[i] === exclude) continue;
    let truong = '';
    if (o.mst && mst[i] && o.mst === mst[i]) truong = 'MST';
    else if (phones.some(p => p === sdt[i] || p === zalo[i])) truong = 'SĐT/Zalo';
    if (truong) { const x = userBy_(nv[i]); return { maKH: ma[i], maNV: nv[i], tenNV: x ? x.hoTen : nv[i], truong, coDon: Number(don[i]) > 0 }; }
  }
  return null;
}

const KH_EDIT = ['tenLienHe','chucVu','tenCongTy','mst','sdt','zalo','email','facebook','tinhThanh','diaChi','loaiKH','nguonKH','nganhHang','matHang','dichVu','hinhThucNK','phapNhan','canHoaDon','dacThuHang','tanSuat','giaTriDuKien','doiThu','nhomKH','giaiDoan','mucDo','ngayHenCham','sinhNhat','ghiChu'];
function apiSaveKH(token, o) {
  const u = auth_(token), sc = scope_(u), t = today_();
  o = o || {};
  if (!String(o.tenLienHe || '').trim()) throw new Error('Nhập tên người liên hệ');
  o.sdt = normPhone_(o.sdt); o.zalo = normPhone_(o.zalo); o.mst = String(o.mst || '').replace(/\s/g, '');
  if (!o.sdt && !o.zalo) throw new Error('Cần ít nhất SĐT hoặc Zalo');
  if (o.sdt && !/^0\d{9,10}$/.test(o.sdt)) throw new Error('SĐT không hợp lệ: ' + o.sdt);
  if (!o.loaiKH) throw new Error('Chọn loại khách hàng');
  if (!o.nguonKH) throw new Error('Chọn nguồn khách hàng');
  if (o.mst && !/^\d{10}(-\d{3})?$/.test(o.mst)) throw new Error('MST phải gồm 10 số (hoặc 10 số-3 số)');
  const hit = khhtHit_(khhtKeys_(o));
  if (hit && hit.dangChay && u.vaiTro !== 'ADMIN') throw new Error('Đây là KHÁCH ĐANG GIAO DỊCH với công ty' + (hit.ngayDon ? ' (đơn gần nhất ' + hit.ngayDon + ')' : '') + (hit.phuTrach ? ', phụ trách: ' + hit.phuTrach : '') + '. Không tạo hồ sơ và không tiếp cận khách này.');
  return withLock_(() => {
    const dup = findDup_(o, o.maKH || '');
    if (dup) {
      if (dup.coDon) throw new Error('Khách đã có chủ (' + dup.truong + '): ' + dup.maKH + ' thuộc ' + dup.tenNV + ' từ đơn đầu tiên. Theo Sổ tay mục 8.1, không được tiếp cận khách này.');
      throw new Error('Khách đang được theo (' + dup.truong + '): ' + dup.maKH + ' — ' + dup.tenNV + '. Chưa có đơn nên là sân chung: báo Trưởng nhóm để thống nhất MỘT đầu mối và MỘT báo giá.');
    }
    let rec, isNew = false;
    if (o.maKH) {
      rec = findOne_(SH.KH, 'maKH', o.maKH);
      if (!rec) throw new Error('Không tìm thấy khách hàng');
      if (!inScope_(sc, rec.maNV)) throw new Error('Bạn không có quyền sửa khách hàng này');
    } else {
      isNew = true;
      rec = { maKH: 'KH' + seq_('SEQ_KH', 6), ngayTao: t, maNV: u.maNV, giaiDoan: GD.MOI, mucDo: 'Lạnh', soLanCham: 0, soBaoGia: 0, soDon: 0, ngayHenCham: t };
    }
    KH_EDIT.forEach(f => { if (o[f] !== undefined) rec[f] = Array.isArray(o[f]) ? o[f].join(', ') : String(o[f]).trim(); });
    if (!rec.giaiDoan) rec.giaiDoan = GD.MOI;
    if (!rec.mucDo) rec.mucDo = 'Lạnh';
    if (isNew && (!rec.ngayHenCham || rec.ngayHenCham < t)) rec.ngayHenCham = t;
    if (!rec.ngayHenCham && rec.giaiDoan !== GD.LOAI) rec.ngayHenCham = suggestNext_(rec.giaiDoan, rec.mucDo, t);
    const oldNV = rec.maNV;
    if (o.maNV && o.maNV !== rec.maNV) {
      if (u.vaiTro === 'SALE') throw new Error('Sale không tự chuyển khách. Đề nghị quản lý thực hiện.');
      checkTransfer_(u, sc, o.maNV);
      rec.maNV = o.maNV;
    }
    rec.trungKHHT = hit ? (hit.dangChay ? KHHT.DANG : KHHT.NGU) : '';
    rec.nguoiCapNhat = u.maNV; rec.ngayCapNhat = now_();
    if (isNew) append_(SH.KH, rec); else update_(SH.KH, rec);
    if (!isNew && oldNV !== rec.maNV) logChuyen_([rec], oldNV, rec.maNV, o.lyDoChuyen || 'Điều chỉnh người phụ trách', u);
    decorate_(rec, t);
    return { maKH: rec.maKH, kh: slim_(rec, KH_SLIM), full: rec, warn: hit && !hit.dangChay ? 'Đây là khách cũ của công ty, đã ' + hit.soNgay + ' ngày không có đơn. Được phép đánh thức — nhớ chọn nguồn "Kho khách ngủ".' : '' };
  });
}
function checkTransfer_(u, sc, denNV) {
  const nv = userBy_(denNV);
  if (!nv || nv.trangThai !== 'Đang làm' || !inScope_(sc, denNV)) throw new Error('Sale nhận không hợp lệ hoặc ngoài phạm vi quản lý');
  if (u.vaiTro === 'QUANLY' && denNV === u.maNV) throw new Error('Quản lý không tự nhận khách của đội mình — cần cấp trên (ADMIN) duyệt (Sổ tay 8.6).');
}
function logChuyen_(khs, tu, den, lyDo, u) {
  const tg = now_();
  appendMany_(SH.CHUYEN, khs.map(k => ({ thoiGian: tg, maKH: k.maKH, tenKH: k.tenCongTy || k.tenLienHe, tuNV: tu, denNV: den, lyDo, nguoiThucHien: u.maNV })));
  appendMany_(SH.CS, khs.map(k => ({ maCS: 'CS' + seq_('SEQ_CS', 7), thoiGian: tg, ngay: today_(), maNV: u.maNV, maKH: k.maKH, tenKH: k.tenCongTy || k.tenLienHe, kenh: KENH_HT, mucDich: 'Chuyển người phụ trách', noiDung: 'Chuyển từ ' + tu + ' sang ' + den + '. Lý do: ' + lyDo, ketQua: '', thanhCong: '', giaiDoanSau: k.giaiDoan, mucDo: k.mucDo, ngayHenTiep: k.ngayHenCham, maBG: '' })));
}

function apiChuyenKH(token, tuNV, denNV, lyDo, dsMaKH) {
  const u = auth_(token), sc = scope_(u);
  needRole_(u, ['ADMIN', 'QUANLY']);
  if (!String(lyDo || '').trim()) throw new Error('Bắt buộc ghi lý do chuyển khách');
  if (!inScope_(sc, tuNV)) throw new Error('Sale chuyển đi ngoài phạm vi quản lý');
  checkTransfer_(u, sc, denNV);
  return withLock_(() => {
    const s = sh_(SH.KH), cNV = COLS[SH.KH].indexOf('maNV') + 1;
    const set = dsMaKH && dsMaKH.length ? new Set(dsMaKH) : null;
    const list = readAll_(SH.KH).filter(k => k.maNV === tuNV && (!set || set.has(k.maKH)));
    if (!list.length) throw new Error('Không có khách nào để chuyển');
    list.forEach(k => s.getRange(k._row, cNV).setValue("'" + denNV));
    logChuyen_(list, tuNV, denNV, lyDo, u);
    return { soKH: list.length };
  });
}

/* ============================ NHẬT KÝ CHĂM SÓC ============================ */
function suggestNext_(gd, md, t) {
  if (gd === GD.LOAI) return '';
  let d = Math.min(NHIP_CHAM.giaiDoan[gd] || 99, NHIP_CHAM.mucDo[md] || 99);
  if (d === 99) d = 7;
  let r = addDays_(t, d);
  if (dow_(r) === 0) r = addDays_(r, 1);
  return r;
}
function logSys_(kh, u, noiDung, maBG) {
  append_(SH.CS, { maCS: 'CS' + seq_('SEQ_CS', 7), thoiGian: now_(), ngay: today_(), maNV: u.maNV, maKH: kh.maKH, tenKH: kh.tenCongTy || kh.tenLienHe, kenh: KENH_HT, mucDich: 'Ghi nhận hệ thống', noiDung, ketQua: '', thanhCong: '', giaiDoanSau: kh.giaiDoan, mucDo: kh.mucDo, ngayHenTiep: kh.ngayHenCham, maBG: maBG || '' });
}
function apiAddCare(token, o) {
  const u = auth_(token), sc = scope_(u), t = today_();
  o = o || {};
  if (!o.maKH) throw new Error('Chọn khách hàng');
  if (!o.kenh) throw new Error('Chọn kênh liên hệ');
  if (!o.mucDich) throw new Error('Chọn mục đích');
  if (!o.ketQua) throw new Error('Chọn kết quả');
  const nd = String(o.noiDung || '').trim();
  if (nd.length < 15) throw new Error('Nội dung tối thiểu 15 ký tự: ghi rõ đã nói gì, khách phản hồi gì.');
  return withLock_(() => {
    const kh = findOne_(SH.KH, 'maKH', o.maKH);
    if (!kh || !inScope_(sc, kh.maNV)) throw new Error('Không có quyền với khách hàng này');
    if (kh.trungKHHT === KHHT.DANG && u.vaiTro !== 'ADMIN') throw new Error('Khách đang giao dịch với công ty — sale không chăm sóc khách này.');
    if (o.mucDich === MD_TIEP_CAN && Number(kh.soLanCham) > 0) throw new Error('Khách đã được chăm ' + kh.soLanCham + ' lần, không chọn "Tiếp cận lần đầu" được nữa.');
    const thanhCong = KQ_THAT_BAI.includes(o.ketQua) ? 'Không' : 'Có';
    let gd = o.giaiDoanSau || kh.giaiDoan || GD.MOI;
    if (gd === GD.MOI && thanhCong === 'Có') gd = GD.TIEP_CAN;
    const md = o.mucDo || kh.mucDo || 'Lạnh';
    let hen = String(o.ngayHenTiep || '').slice(0, 10);
    if (hen && hen < t) throw new Error('Ngày hẹn chăm tiếp không được ở quá khứ');
    if (!hen) hen = suggestNext_(gd, md, t);
    const log = { maCS: 'CS' + seq_('SEQ_CS', 7), thoiGian: now_(), ngay: t, maNV: u.maNV, maKH: kh.maKH, tenKH: kh.tenCongTy || kh.tenLienHe, kenh: o.kenh, mucDich: o.mucDich, noiDung: nd, ketQua: o.ketQua, thanhCong, giaiDoanSau: gd, mucDo: md, ngayHenTiep: hen, maBG: String(o.maBG || '').trim() };
    append_(SH.CS, log);
    Object.assign(kh, { giaiDoan: gd, mucDo: md, ketQuaGanNhat: o.ketQua, ngayLHGanNhat: t, ngayHenCham: hen, soLanCham: (Number(kh.soLanCham) || 0) + 1, nguoiCapNhat: u.maNV, ngayCapNhat: now_() });
    update_(SH.KH, kh);
    return { maCS: log.maCS, ngayHenTiep: hen, giaiDoan: gd, kh: khOut_(kh) };
  });
}

/* ============================ BÁO GIÁ ============================ */
/** LÕI TÍNH BÁO GIÁ — dùng chung cho máy chủ (Code.gs) và trình duyệt (Index.html). Sửa ở đâu phải chép sang bên kia.
 *  Chuỗi giá: Tờ khai APT = Giá xuất × hệ số (0,9425 ≈ 1 ÷ 1,03 ÷ 1,03). Thuế NK = thuế suất × trị giá tờ khai.
 *  Giá xuất đủ (A) của dòng = (Tiền hàng + Ship + Cước + Phí DV + Phụ phí) ÷ (1 − %ủy thác − %thuế NK × hệ số), làm tròn lên.
 *  Xuất thấp: giá xuất = A × %; ủy thác tính trên tiền hàng. Xuất cao: giá xuất = A × %; thu thêm TNDN % × phần chênh. */
function calcCore(h, lines, md, N) {
  const ty = N(h.tyGia), k = N(md.heSoToKhai) || 0.9425;
  // Làm tròn đơn giá xuất: bước (100, 10, 1, 0.01…); để trống = mặc định; 0 = 2 số lẻ (0,01 đ).
  // Kiểu: 'gan' = gần nhất (hóa đơn sát số thu nhất, mặc định) | 'len' = luôn làm tròn lên.
  const lamIn = (h.lamTron === '' || h.lamTron == null) ? N(md.lamTron) : N(h.lamTron);
  const lam = lamIn > 0 ? Math.max(0.01, lamIn) : 0.01, lamDec = lam < 1 ? Math.min(4, Math.round(-Math.log10(lam))) : 0;
  const lamLen = md.lamTronKieu === 'len';
  const roundU = x => { const q = x / lam; return Number(((lamLen ? Math.ceil(q - 1e-9) : Math.round(q)) * lam).toFixed(lamDec)); };
  // Thuế NK tính trên: 'toKhai' = trị giá khai APT (giá xuất × hệ số), 'giaXuat' = giá xuất (cách bảng báo giá cũ).
  const coSoThue = (h.coSoThueNK === 'giaXuat' || h.coSoThueNK === 'toKhai') ? h.coSoThueNK : (md.coSoThueNK === 'giaXuat' ? 'giaXuat' : 'toKhai');
  const thueTrenGX = coSoThue === 'giaXuat', kThue = thueTrenGX ? 1 : k;
  const cheDo = (h.cheDoXuat === 'thap' || h.cheDoXuat === 'cao') ? h.cheDoXuat : 'du';
  const r = cheDo === 'du' ? 1 : (N(h.tyLeXuat) || 100) / 100;
  // Phí ủy thác tính trên: chọn trên báo giá; không chọn thì xuất thấp = tiền hàng, còn lại = giá xuất.
  const coSo = (h.coSoUT === 'tienHang' || h.coSoUT === 'giaXuat') ? h.coSoUT : (cheDo === 'thap' ? 'tienHang' : 'giaXuat');
  const all = lines.map(l => {
    const o = { soLuong: N(l.soLuong), donGiaTe: N(l.donGiaTe), thueNKPct: N(l.thueNKPct), pctCuoc: N(l.pctCuoc), giaXuatNhap: N(l.giaXuatNhap),
      vatPct: (l.vatPct === '' || l.vatPct == null) ? N(md.vatPct || 8) : N(l.vatPct) };
    o.ok = !!String(l.tenHang || '').trim() && o.soLuong > 0;
    o.thanhTienTe = Math.round(o.soLuong * o.donGiaTe * 100) / 100; o.thanhTienVND = Math.round(o.thanhTienTe * ty);
    return o;
  });
  const L = all.filter(l => l.ok);
  let tienHangTe = 0, tienHang = 0;
  L.forEach(l => { tienHangTe += l.thanhTienTe; tienHang += l.thanhTienVND; });
  tienHangTe = Math.round(tienHangTe * 100) / 100;
  const shipNoiDiaTe = N(h.shipNoiDiaTe), shipNoiDia = Math.round(shipNoiDiaTe * ty);
  const soKg = N(h.soKg), donGiaKg = N(h.donGiaKg), soKhoi = N(h.soKhoi), donGiaKhoi = N(h.donGiaKhoi);
  const vcKg = Math.round(soKg * donGiaKg), vcKhoi = Math.round(soKhoi * donGiaKhoi), phiVC = Math.max(vcKg, vcKhoi);
  const phiDVPct = N(h.phiDVPct), phiUTPct = N(h.phiUTPct), phiKeKhai = N(h.phiKeKhai), phiHopQuy = N(h.phiHopQuy), phiKTCL = N(h.phiKTCL), phiKhac = N(h.phiKhac);
  // Cước: dòng có nhập "% cước" giữ đúng %, phần còn lại chia cho các dòng khác theo tiền hàng.
  const fixed = L.filter(l => l.pctCuoc > 0), free = L.filter(l => !(l.pctCuoc > 0));
  const sumFix = fixed.reduce((a, l) => a + l.pctCuoc, 0);
  const scale = (sumFix > 100 || (!free.length && sumFix > 0)) ? 100 / sumFix : 1;
  const rest = Math.max(0, 100 - sumFix * scale), thFree = free.reduce((a, l) => a + l.thanhTienVND, 0);
  L.forEach(l => { l.tyLeCuoc = l.pctCuoc > 0 ? l.pctCuoc * scale : (thFree > 0 ? rest * l.thanhTienVND / thFree : rest / free.length); });
  let tongDu = 0, tong = 0, vat = 0, thueNK = 0, thueNKDu = 0, toKhai = 0, chiPhi = 0, phiDV = 0, err = '';
  L.forEach(l => {
    const share = tienHang > 0 ? l.thanhTienVND / tienHang : 1 / L.length;
    l.shipPB = Math.round(shipNoiDia * share); l.cuocPB = Math.round(phiVC * l.tyLeCuoc / 100);
    l.phiDV = Math.round(l.thanhTienVND * phiDVPct / 100); l.phuPhi = Math.round((phiKeKhai + phiHopQuy + phiKTCL + phiKhac) * share);
    l.chiPhi = l.thanhTienVND + l.shipPB + l.cuocPB + l.phiDV + l.phuPhi;
    const utDong = coSo === 'tienHang' ? Math.round(l.thanhTienVND * phiUTPct / 100) : 0;
    // Giá khai APT = giá xuất × hệ số ÷ (1 + thuế NK): APT cộng thuế NK vào giá rồi mới xuất cho Nam Trung (+3%), Nam Trung xuất khách (+3%).
    const kDong = k / (1 + l.thueNKPct / 100), kThueDong = thueTrenGX ? 1 : kDong;
    const den = 1 - (coSo === 'tienHang' ? 0 : phiUTPct / 100) - l.thueNKPct / 100 * kThueDong;
    if (den <= 0) { err = 'Thuế NK + phí ủy thác không hợp lệ'; return; }
    l.giaXuatDu = roundU((l.chiPhi + utDong) / den / l.soLuong);
    // Xuất thấp / cao: dòng nào nhập "giá xuất chọn" thì lấy đúng giá đó, còn lại = giá đủ × %.
    l.giaXuat = cheDo === 'du' ? l.giaXuatDu : (l.giaXuatNhap > 0 ? Number(l.giaXuatNhap.toFixed(2)) : roundU(l.giaXuatDu * r));
    l.tongTruocVAT = Math.round(l.giaXuat * l.soLuong); l.vat = Math.round(l.tongTruocVAT * l.vatPct / 100);
    l.giaKhai = Math.round(l.giaXuat * kDong); l.triGiaKhai = l.giaKhai * l.soLuong;
    l.thueNK = Math.round((thueTrenGX ? l.tongTruocVAT : l.triGiaKhai) * l.thueNKPct / 100);
    l.thueNKDu = Math.round((thueTrenGX ? l.giaXuatDu : Math.round(l.giaXuatDu * kDong)) * l.soLuong * l.thueNKPct / 100);
    tongDu += Math.round(l.giaXuatDu * l.soLuong); tong += l.tongTruocVAT; vat += l.vat; thueNK += l.thueNK; thueNKDu += l.thueNKDu;
    toKhai += l.triGiaKhai; chiPhi += l.chiPhi; phiDV += l.phiDV;
  });
  const phiUT = Math.round((coSo === 'tienHang' ? tienHang : tong) * phiUTPct / 100);
  // % thuế TNDN thu thêm khi xuất cao: sửa được trên từng báo giá (sale hỗ trợ khách), để trống = mặc định.
  const tndnPct = (h.tndnPct === '' || h.tndnPct == null) ? (N(md.tndnPct) || 20) : Math.max(0, N(h.tndnPct));
  const chenh = tong - tongDu, rThuc = tongDu > 0 ? tong / tongDu : 1;
  const thuThemTNDN = cheDo === 'cao' && chenh > 0 ? Math.round(chenh * tndnPct / 100) : 0;
  const thueNKTang = cheDo === 'cao' ? Math.max(0, thueNK - thueNKDu) : 0;
  const tongChiPhiThuc = chiPhi + thueNK + phiUT;
  const lamTronChenh = cheDo === 'du' ? tong - tongChiPhiThuc : 0;
  const tyVon = N(md.tyGiaVon) || 3955, vonKhoi = N(md.giaVonKhoi) || 800000, utVon = N(md.phiUTSan) || 0.8;
  const ln = Math.round(tienHangTe * (ty - tyVon) + (soKhoi > 0 ? phiVC - vonKhoi * soKhoi : 0) + (phiUT - tienHang * utVon / 100) + phiDV + lamTronChenh);
  const cb = [], minX = N(md.tyLeXuatMin) || 70, pctX = Math.round(rThuc * 1000) / 10;
  if (ty < tyVon) cb.push('CẤM: tỷ giá dưới giá vốn ' + tyVon); else if (ty < N(md.tyGiaSan || 4015)) cb.push('DUYỆT: tỷ giá dưới ' + md.tyGiaSan);
  if (phiUTPct < utVon) cb.push('CẤM: phí ủy thác dưới ' + utVon + '%');
  if (phiDVPct < N(md.phiDVSan || 1.2)) cb.push('DUYỆT: phí dịch vụ dưới ' + md.phiDVSan + '%');
  if (soKhoi > 0 && phiVC < vonKhoi * soKhoi) cb.push('DUYỆT: cước VC thấp hơn giá vốn khối');
  if (cheDo === 'thap') { if (rThuc >= 1) cb.push('LƯU Ý: chế độ xuất thấp cần % nhỏ hơn 100'); else if (pctX < minX) cb.push('DUYỆT: xuất ' + pctX + '% giá đủ, dưới mức tối thiểu ' + minX + '%'); else cb.push('LƯU Ý: xuất ' + pctX + '% giá đủ, ủy thác tính trên ' + (coSo === 'tienHang' ? 'tiền hàng' : 'giá xuất')); }
  if (cheDo === 'cao') { if (rThuc <= 1) cb.push('LƯU Ý: chế độ xuất cao cần % lớn hơn 100'); else cb.push('LƯU Ý: xuất ' + pctX + '% giá đủ, thu thêm TNDN ' + tndnPct + '% phần chênh'); }
  if (sumFix > 100) cb.push('LƯU Ý: tổng % cước tự nhập vượt 100%, đã quy về 100%');
  return { all, ty, k, thueTrenGX, coSoThue, r: rThuc, cheDo, coSo, tienHangTe, tienHang, shipNoiDiaTe, shipNoiDia, soKg, donGiaKg, soKhoi, donGiaKhoi, vcKg, vcKhoi, phiVC,
    phiDVPct, phiDV, phiUTPct, phiUT, phiKeKhai, phiHopQuy, phiKTCL, phiKhac, thueNK, thueNKDu, toKhai, lam, lamTronChenh, tong, tongDu, chenh, tndnPct,
    thuThemTNDN, thueNKTang, tongChiPhiThuc, tongThu: tongChiPhiThuc + vat, vat, tongSau: tong + vat, ln, cb, err };
}
function calcBG_(h, lines, md) {
  const N = v => { const x = Number(v); return isFinite(x) ? x : 0; };
  if (N(h.tyGia) <= 0) throw new Error('Tỷ giá phải lớn hơn 0');
  const src = lines || [], c = calcCore(h, src, md, N);
  if (c.err) throw new Error(c.err);
  const L = [];
  c.all.forEach((l, i) => {
    if (!l.ok) return; const x = src[i];
    L.push({ stt: L.length + 1, tenHang: String(x.tenHang).trim(), moTa: String(x.moTa || '').trim(), hsCode: String(x.hsCode || '').trim(), dvt: String(x.dvt || 'Chiếc').trim(),
      soLuong: l.soLuong, donGiaTe: l.donGiaTe, thanhTienTe: l.thanhTienTe, thanhTienVND: l.thanhTienVND, thueNKPct: l.thueNKPct, vatPct: l.vatPct,
      giaXuat: l.giaXuat, tongTruocVAT: l.tongTruocVAT, vat: l.vat, pctCuoc: l.pctCuoc > 0 ? l.pctCuoc : '', cuocPhanBo: l.cuocPB,
      giaXuatDu: l.giaXuatDu, giaKhai: l.giaKhai, triGiaKhai: l.triGiaKhai, thueNK: l.thueNK, giaXuatNhap: (c.cheDo !== 'du' && l.giaXuatNhap > 0) ? l.giaXuatNhap : '' });
  });
  if (!L.length) throw new Error('Báo giá cần ít nhất 1 dòng hàng có tên và số lượng > 0');
  return {
    h: { tyGia: c.ty, tienHangTe: c.tienHangTe, tienHang: c.tienHang, shipNoiDiaTe: c.shipNoiDiaTe, shipNoiDia: c.shipNoiDia, soKg: c.soKg, donGiaKg: c.donGiaKg,
      soKhoi: c.soKhoi, donGiaKhoi: c.donGiaKhoi, phiVC: c.phiVC, phiDVPct: c.phiDVPct, phiDV: c.phiDV, phiUTPct: c.phiUTPct, coSoUT: c.coSo, phiUT: c.phiUT,
      phiKeKhai: c.phiKeKhai, phiHopQuy: c.phiHopQuy, phiKTCL: c.phiKTCL, phiKhac: c.phiKhac, tenPhiKhac: String(h.tenPhiKhac || '').trim().slice(0, 60), thueNK: c.thueNK, lamTron: c.lam, lamTronChenh: c.lamTronChenh, tongTruocVAT: c.tong, vat: c.vat,
      tongSauVAT: c.tongSau, lnUocTinh: c.ln, canhBaoGia: c.cb.join(' | '), tomTatHang: L.map(l => l.tenHang).join('; ').slice(0, 250),
      cheDoXuat: c.cheDo, tyLeXuat: Math.round(c.r * 1000) / 10, tongGiaDu: c.tongDu, chenhLech: c.chenh, thuThemTNDN: c.thuThemTNDN,
      thueNKTang: c.thueNKTang, tongToKhai: c.toKhai, heSoToKhai: c.k, tongChiPhiThuc: c.tongChiPhiThuc, coSoThueNK: c.coSoThue, tndnPct: c.tndnPct },
    lines: L,
  };
}
function newBGId_(t) { const ym = t.slice(2, 4) + t.slice(5, 7); return 'BG' + ym + '-' + seq_('SEQ_BG_' + ym, 4); }
function deleteLines_(maBG) {
  const rows = findRows_(SH.BGCT, 'maBG', maBG).map(r => r._row).sort((a, b) => b - a);
  const s = sh_(SH.BGCT);
  let i = 0;
  while (i < rows.length) { let j = i; while (j + 1 < rows.length && rows[j + 1] === rows[j] - 1) j++; s.deleteRows(rows[j], j - i + 1); i = j + 1; }
}
const BG_KHOA = [BG_TT.CHOT, BG_TT.TU_CHOI, BG_TT.THAY_THE, BG_TT.HET_HAN];

function apiSaveBG(token, h, lines, action) {
  const u = auth_(token), sc = scope_(u), t = today_();
  h = h || {};
  const kh = findOne_(SH.KH, 'maKH', h.maKH);
  if (!kh) throw new Error('Chọn khách hàng hợp lệ (gõ mã hoặc tên rồi chọn trong danh sách)');
  if (!inScope_(sc, kh.maNV)) throw new Error('Không có quyền với khách hàng này');
  if (kh.trungKHHT === KHHT.DANG && u.vaiTro !== 'ADMIN') throw new Error('Khách đang giao dịch với công ty — không lập báo giá.');
  const c = calcBG_(h, lines, macDinh_());
  if (c.h.canhBaoGia.indexOf('CẤM') >= 0) throw new Error('Không lưu được — ' + c.h.canhBaoGia);
  const canDuyet = c.h.canhBaoGia.indexOf('DUYỆT') >= 0;
  return withLock_(() => {
    const old = h.maBG ? findOne_(SH.BG, 'maBG', h.maBG) : null;
    if (old && !inScope_(sc, old.maNV)) throw new Error('Không có quyền với báo giá này');
    if (old && BG_KHOA.includes(old.trangThai)) throw new Error('Báo giá đã "' + old.trangThai + '" nên bị khóa. Dùng "Nhân bản" để tạo báo giá mới.');
    let rec, phienMoi = false;
    if (old && (old.trangThai === BG_TT.NHAP || old.trangThai === BG_TT.CHO_DUYET)) { rec = old; deleteLines_(old.maBG); }
    else { rec = { maBG: newBGId_(t), ngayTao: t, phienBan: old ? (Number(old.phienBan) || 1) + 1 : 1, bgGoc: old ? (old.bgGoc || old.maBG) : String(h.bgGoc || '') }; phienMoi = !!old; }
    const giaDoi = !old || old.tongSauVAT !== c.h.tongSauVAT || old.canhBaoGia !== c.h.canhBaoGia;
    Object.assign(rec, c.h, { maNV: kh.maNV, maKH: kh.maKH, tenKH: kh.tenCongTy || kh.tenLienHe, maDon: String(h.maDon || '').trim(), hinhThucNK: h.hinhThucNK || kh.hinhThucNK || '', ghiChu: String(h.ghiChu || '').trim(), ngayCapNhat: now_() });
    if (!canDuyet) { rec.duyetBoi = ''; rec.ngayDuyet = ''; }
    else if (giaDoi && rec.duyetBoi && !phienMoi) { rec.duyetBoi = ''; rec.ngayDuyet = ''; }
    if (phienMoi) { rec.duyetBoi = ''; rec.ngayDuyet = ''; }
    let guiNgay = false;
    if (action === 'gui') {
      if (canDuyet && !rec.duyetBoi) rec.trangThai = BG_TT.CHO_DUYET;
      else { rec.trangThai = BG_TT.GUI; rec.ngayGui = t; rec.hieuLucDen = addDays_(t, Number(thamSo_().hieuLucBG) || APP.HIEU_LUC_BG); guiNgay = true; }
    } else rec.trangThai = (canDuyet && !rec.duyetBoi) ? BG_TT.CHO_DUYET : BG_TT.NHAP;
    if (rec._row) update_(SH.BG, rec); else append_(SH.BG, rec);
    appendMany_(SH.BGCT, c.lines.map(l => Object.assign({ maBG: rec.maBG }, l)));
    if (phienMoi) { old.trangThai = BG_TT.THAY_THE; old.ngayCapNhat = now_(); update_(SH.BG, old); }
    if (guiNgay) markSent_(kh, rec, u, t);
    return { maBG: rec.maBG, trangThai: rec.trangThai, canhBaoGia: rec.canhBaoGia, kh: khOut_(kh) };
  });
}
function markSent_(kh, rec, u, t) {
  kh.soBaoGia = (Number(kh.soBaoGia) || 0) + 1;
  if (GD_THU_TU.indexOf(kh.giaiDoan) < GD_THU_TU.indexOf(GD.DA_BG)) kh.giaiDoan = GD.DA_BG;
  kh.ngayHenCham = suggestNext_(GD.DA_BG, kh.mucDo, t); kh.ngayLHGanNhat = t; kh.ngayCapNhat = now_();
  update_(SH.KH, kh);
  logSys_(kh, u, 'Gửi báo giá ' + rec.maBG + ' — tổng sau VAT ' + money_(rec.tongSauVAT) + ' đ', rec.maBG);
}
function apiGuiBG(token, maBG) {
  const u = auth_(token), sc = scope_(u), t = today_();
  return withLock_(() => {
    const b = findOne_(SH.BG, 'maBG', maBG);
    if (!b || !inScope_(sc, b.maNV)) throw new Error('Không tìm thấy báo giá');
    if (b.trangThai !== BG_TT.NHAP && b.trangThai !== BG_TT.CHO_DUYET) throw new Error('Chỉ gửi được báo giá ở trạng thái Nháp');
    if (String(b.canhBaoGia).indexOf('DUYỆT') >= 0 && !b.duyetBoi) { b.trangThai = BG_TT.CHO_DUYET; update_(SH.BG, b); return { trangThai: b.trangThai }; }
    Object.assign(b, { trangThai: BG_TT.GUI, ngayGui: t, hieuLucDen: addDays_(t, Number(thamSo_().hieuLucBG) || APP.HIEU_LUC_BG), ngayCapNhat: now_() });
    update_(SH.BG, b);
    const kh = findOne_(SH.KH, 'maKH', b.maKH);
    markSent_(kh, b, u, t);
    return { trangThai: b.trangThai, kh: khOut_(kh) };
  });
}
function apiDuyetBG(token, maBG, dongY, ghiChu) {
  const u = auth_(token), sc = scope_(u);
  if (!canApprovePrice_(u)) throw new Error('Chỉ Trưởng phòng KD trở lên được duyệt phá khung giá (Bảng giá vốn — Phần 2)');
  return withLock_(() => {
    const b = findOne_(SH.BG, 'maBG', maBG);
    if (!b || !inScope_(sc, b.maNV)) throw new Error('Không tìm thấy báo giá trong phạm vi quản lý');
    if (b.trangThai !== BG_TT.CHO_DUYET) throw new Error('Báo giá không ở trạng thái chờ duyệt');
    if (dongY) { b.duyetBoi = u.maNV; b.ngayDuyet = now_(); b.trangThai = BG_TT.NHAP; }
    else { b.trangThai = BG_TT.NHAP; b.duyetBoi = ''; }
    b.ghiChu = [b.ghiChu, (dongY ? 'Đã duyệt giá' : 'Không duyệt giá') + ' bởi ' + u.maNV + (ghiChu ? ': ' + ghiChu : '')].filter(String).join(' | ');
    b.ngayCapNhat = now_(); update_(SH.BG, b);
    return { trangThai: b.trangThai };
  });
}
function apiSetBGStatus(token, maBG, tt, lyDo, maDon) {
  const u = auth_(token), sc = scope_(u), t = today_();
  if (![BG_TT.CAN_NHAC, BG_TT.CHOT, BG_TT.TU_CHOI, BG_TT.HET_HAN].includes(tt)) throw new Error('Trạng thái không hợp lệ');
  return withLock_(() => {
    const b = findOne_(SH.BG, 'maBG', maBG);
    if (!b || !inScope_(sc, b.maNV)) throw new Error('Không tìm thấy báo giá');
    if (![BG_TT.GUI, BG_TT.CAN_NHAC].includes(b.trangThai)) throw new Error('Chỉ cập nhật kết quả cho báo giá đã gửi khách');
    const kh = findOne_(SH.KH, 'maKH', b.maKH);
    b.trangThai = tt; b.ngayCapNhat = now_();
    if (tt === BG_TT.CHOT) {
      if (String(maDon || '').trim()) b.maDon = String(maDon).trim();
      if (!b.maDon) throw new Error('Nhập mã đơn trên hệ thống đơn hàng khi chốt');
      b.ngayChot = t;
      const first = !(Number(kh.soDon) > 0);
      kh.soDon = (Number(kh.soDon) || 0) + 1; kh.ngayDonGanNhat = t;
      if (first) { kh.ngayDonDau = t; b.donDau = 'Có'; kh.giaiDoan = GD.DON_DAU; }
      else if (kh.giaiDoan !== GD.VIP) kh.giaiDoan = GD.HOAT_DONG;
      kh.mucDo = 'Nóng'; kh.ngayHenCham = suggestNext_(GD.DON_DAU, 'Nóng', t);
      logSys_(kh, u, 'Chốt đơn ' + b.maDon + ' từ báo giá ' + maBG + (first ? ' — ĐƠN ĐẦU TIÊN, xác lập chủ khách' : ''), maBG);
    }
    if (tt === BG_TT.TU_CHOI) {
      if (!lyDo) throw new Error('Chọn lý do khách từ chối');
      b.lyDo = lyDo; kh.ngayHenCham = suggestNext_(GD.KHAI_THAC, 'Lạnh', t);
      logSys_(kh, u, 'Khách từ chối báo giá ' + maBG + ': ' + lyDo, maBG);
    }
    update_(SH.BG, b); kh.ngayCapNhat = now_(); update_(SH.KH, kh);
    return { trangThai: tt, kh: khOut_(kh) };
  });
}
function apiGetBG(token, maBG) {
  const u = auth_(token), sc = scope_(u);
  const b = findOne_(SH.BG, 'maBG', maBG);
  if (!b || !inScope_(sc, b.maNV)) throw new Error('Không tìm thấy báo giá');
  const nv = userBy_(b.maNV); b.tenNV = nv ? nv.hoTen : b.maNV;
  return { bg: b, lines: findRows_(SH.BGCT, 'maBG', maBG).sort((a, b2) => a.stt - b2.stt) };
}
function apiListBG(token, f) {
  const u = auth_(token), sc = scope_(u), t = today_();
  f = f || {};
  const from = f.tuNgay || addDays_(t, -60), to = f.denNgay || t;
  let rows = readTail_(SH.BG, 'ngayTao', from).filter(b => b.ngayTao <= to && inScope_(sc, b.maNV));
  if (f.trangThai) rows = rows.filter(b => b.trangThai === f.trangThai);
  if (f.maNV) rows = rows.filter(b => b.maNV === f.maNV);
  if (f.q) { const q = fold_(f.q); rows = rows.filter(b => fold_([b.maBG, b.maKH, b.tenKH, b.maDon, b.tomTatHang].join(' ')).indexOf(q) >= 0); }
  rows.reverse();
  const cnt = {}; rows.forEach(b => cnt[b.trangThai] = (cnt[b.trangThai] || 0) + 1);
  return { total: rows.length, cnt, rows: rows.slice(0, 500).map(b => { const nv = userBy_(b.maNV); return Object.assign(slim_(b, ['maBG','ngayTao','ngayGui','maKH','tenKH','maDon','tomTatHang','tongSauVAT','lnUocTinh','trangThai','canhBaoGia','duyetBoi','phienBan','hieuLucDen','linkPDF','maNV']), { tenNV: nv ? nv.hoTen : b.maNV }); }) };
}
/* ============================ BẢN IN BÁO GIÁ GỬI KHÁCH ============================
 * Phong cách bảng kẻ trang trọng, màu thương hiệu Nam Trung (cam #F07B3C + đen).
 * Không hiện thông tin nội bộ (hệ số tờ khai, APT, LN). Bố cục bằng bảng để PDF Google không vỡ khung. */
function kvList_(key) {
  const o = {}; (lists_()[key] || []).forEach(x => { const i = x.indexOf('='); if (i > 0) o[x.slice(0, i).trim()] = x.slice(i + 1).trim(); });
  return o;
}
function dmy_(iso) { iso = String(iso || '').slice(0, 10); return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }
/* ---------- QR thanh toán VietQR (chuẩn NAPAS / EMVCo) ---------- */
const BANK_BIN = { vietcombank: '970436', vcb: '970436', vietinbank: '970415', ctg: '970415', icb: '970415', bidv: '970418', agribank: '970405', vba: '970405',
  techcombank: '970407', tcb: '970407', mbbank: '970422', mb: '970422', acb: '970416', vpbank: '970432', vpb: '970432', tpbank: '970423', tpb: '970423',
  sacombank: '970403', stb: '970403', vib: '970441', shb: '970443', hdbank: '970437', hdb: '970437', ocb: '970448', msb: '970426', seabank: '970440',
  eximbank: '970431', eib: '970431', lpbank: '970449', lienvietpostbank: '970449', namabank: '970428', abbank: '970425', bacabank: '970409',
  pvcombank: '970412', vietabank: '970427', kienlongbank: '970452', ncb: '970419', scb: '970429', vietbank: '970433', baovietbank: '970438', gpbank: '970408' };
/** Nhận mã BIN 6 số hoặc tên ngân hàng (VietinBank, "Vietcombank - CN Hà Nội"…). */
function bankBin_(s) {
  s = String(s || '').trim(); if (/^\d{6}$/.test(s)) return s;
  const k = fold_(s).replace(/[^a-z]/g, ''); if (BANK_BIN[k]) return BANK_BIN[k];
  const hit = Object.keys(BANK_BIN).sort((a, b) => b.length - a.length).find(x => x.length >= 3 && k.indexOf(x) === 0);
  return hit ? BANK_BIN[hit] : '';
}
function ascii_(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\x20-\x7E]/g, '').trim(); }
function crc16_(s) { let c = 0xFFFF; for (let i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) : (c << 1); c &= 0xFFFF; } return c.toString(16).toUpperCase().padStart(4, '0'); }
/** Chuỗi dữ liệu VietQR (chuẩn NAPAS/EMVCo): ngân hàng + số TK + số tiền + nội dung. App ngân hàng nào ở VN cũng đọc được. */
function vietqrPayload_(bin, soTK, amount, noiDung) {
  const f = (id, v) => id + String(v.length).padStart(2, '0') + v;
  const tk = f('00', bin) + f('01', String(soTK).replace(/\s/g, ''));
  const amt = Math.round(Number(amount) || 0), info = ascii_(noiDung).slice(0, 50);
  const p = f('00', '01') + f('01', amt > 0 ? '12' : '11') + f('38', f('00', 'A000000727') + f('01', tk) + f('02', 'QRIBFTTA')) + f('53', '704') +
    (amt > 0 ? f('54', String(amt)) : '') + f('58', 'VN') + (info ? f('62', f('08', info)) : '') + '6304';
  return p + crc16_(p);
}
/** Link ảnh VietQR — cùng dạng link công ty đang dùng trong Sheet (=IMAGE). Trình duyệt tự tải, máy chủ không gọi. */
function qrUrl_(amount, noiDung) {
  const c = kvList_('THONG_TIN_CTY'), soTK = String(c.qrSoTK || '').replace(/\s/g, '');
  const nh = String(c.qrMaNH || '').trim() || bankBin_(c.tenNganHang);
  if (!nh || !soTK) return '';
  const amt = Math.round(Number(amount) || 0);
  return 'https://img.vietqr.io/image/' + encodeURIComponent(nh) + '-' + soTK + '-' + encodeURIComponent(c.qrMau || 'compact2') + '.png?amount=' + (amt > 0 ? amt : '') +
    '&addInfo=' + encodeURIComponent(ascii_(noiDung).slice(0, 50)) + (c.qrTenTK ? '&accountName=' + encodeURIComponent(c.qrTenTK) : '');
}
/** Ảnh QR thanh toán: tự vẽ ngay trong Apps Script, không gọi dịch vụ ngoài → tức thì, không lỗi mạng. */
function qrDataUrl_(amount, noiDung) {
  const c = kvList_('THONG_TIN_CTY'), bin = bankBin_(c.qrMaNH) || bankBin_(c.tenNganHang), soTK = String(c.qrSoTK || '').replace(/\s/g, '');
  if (bin && soTK) {
    try { const qr = qrcode(0, 'M'); qr.addData(vietqrPayload_(bin, soTK, amount, noiDung)); qr.make(); return qr.createDataURL(4, 3); }
    catch (e) { console.error('Vẽ QR lỗi', e); }
  }
  if (c.qrAnh) { try { const id = (c.qrAnh.match(/[-\w]{25,}/) || [])[0]; if (id) { const bl = DriveApp.getFileById(id).getBlob(); return 'data:' + bl.getContentType() + ';base64,' + Utilities.base64Encode(bl.getBytes()); } } catch (e) { console.error(e); } }
  return '';
}
/** Admin chạy trong Apps Script để kiểm tra QR: xem nhật ký thực thi. */
function kiemTraQR() {
  const c = kvList_('THONG_TIN_CTY'), bin = bankBin_(c.qrMaNH) || bankBin_(c.tenNganHang);
  console.log('BIN:', bin, '| Số TK:', c.qrSoTK);
  if (bin && c.qrSoTK) console.log('Dữ liệu QR:', vietqrPayload_(bin, c.qrSoTK, 100000, 'TEST'));
  console.log(qrDataUrl_(100000, 'TEST') ? 'Vẽ QR thành công' : 'KHÔNG vẽ được QR');
}
function bgHtml_(b, lines, kh, nv, opt) {
  opt = opt || {};
  const E = escH_, M = money_, M2 = money2_;
  const cty = Object.assign({ ten: APP.CONG_TY, tenNgan: 'Nam Trung Group', website: APP.WEBSITE }, kvList_('THONG_TIN_CTY'));
  const ngayBG = b.ngayGui || b.ngayTao || today_(), hl = Number(thamSo_().hieuLucBG) || APP.HIEU_LUC_BG;
  const hieuLuc = b.hieuLucDen || addDays_(ngayBG, hl);
  const du = !b.cheDoXuat || b.cheDoXuat === 'du';
  const OR = '#F07B3C', ORM = '#F9D2B8', ORL = '#FDEEE4', BK = '#1A1A1A', LN = '#8A8A8A';
  const cell = (v, st, tag) => '<' + (tag || 'td') + ' style="border:1px solid ' + LN + ';padding:2px 6px;line-height:1.3;vertical-align:middle;' + (st || '') + '">' + v + '</' + (tag || 'td') + '>';
  const hd = (v, st) => cell(v, 'background:' + ORM + ';color:' + BK + ';font-weight:bold;text-align:center;font-size:12px;white-space:nowrap;line-height:1.25;' + (st || ''), 'th');
  const R = 'text-align:right;white-space:nowrap;', CT = 'text-align:center;';
  const tbl = '<table style="width:100%;border-collapse:collapse;font-size:11.5px;margin:2px 0 5px">';
  const secTitle = t => '<div style="font-weight:bold;font-size:14px;margin:6px 0 2px;color:' + BK + '"><span style="display:inline-block;width:4px;height:13px;background:' + OR + ';margin-right:6px;vertical-align:-1px"></span>' + t + '</div>';

  let h = '<div class="bgp" style="font-family:\'Times New Roman\',Times,serif;color:' + BK + ';font-size:13px;line-height:1.4;max-width:780px;margin:0 auto;background:#fff">';
  // Đầu trang
  const lh = [cty.diaChi ? 'Địa chỉ: ' + E(cty.diaChi) : '', [cty.hotline ? 'Hotline: ' + E(cty.hotline) : '', cty.email ? 'Email: ' + E(cty.email) : ''].filter(String).join(' &nbsp;|&nbsp; '),
    [cty.mst ? 'MST: ' + E(cty.mst) : '', cty.website ? 'Website: ' + E(cty.website) : ''].filter(String).join(' &nbsp;|&nbsp; ')].filter(String);
  h += '<table style="width:100%;border-collapse:collapse"><tr>' +
    '<td style="width:74px;vertical-align:middle"><img src="data:image/png;base64,' + LOGO_NT_B64 + '" style="height:58px;display:block"></td>' +
    '<td style="vertical-align:middle;padding-left:10px"><div style="font-weight:bold;font-size:15px;text-transform:uppercase">' + E(cty.ten) + '</div>' +
    lh.map(x => '<div style="font-size:11.5px;color:#444;line-height:1.3">' + x + '</div>').join('') + '</td>' +
    '<td style="vertical-align:middle;text-align:right;white-space:nowrap;font-size:12.5px">Số: <b>' + E(b.maBG) + (Number(b.phienBan) > 1 ? '/v' + b.phienBan : '') + '</b><br>Ngày: <b>' + dmy_(ngayBG) + '</b></td></tr></table>';
  h += '<table style="width:100%;border-collapse:collapse;margin:6px 0 6px"><tr><td style="height:3px;background:' + OR + ';padding:0"></td><td style="width:22%;height:3px;background:' + BK + ';padding:0"></td></tr></table>';
  h += '<div style="text-align:center;font-weight:bold;font-size:19px;letter-spacing:.5px;margin:0 0 6px">BẢNG BÁO GIÁ NHẬP KHẨU</div>';

  // Thông tin
  const ir = (k1, v1, k2, v2) => '<tr><td style="padding:0;width:16%;color:#444">' + k1 + '</td><td style="padding:2px 8px 2px 0;width:38%;font-weight:bold">' + (v1 || '') + '</td><td style="padding:2px 0;width:15%;color:#444">' + k2 + '</td><td style="padding:2px 0;font-weight:bold">' + (v2 || '') + '</td></tr>';
  h += '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:6px">' +
    ir('Kính gửi:', E(kh.tenCongTy || kh.tenLienHe || b.tenKH), 'Mã đơn:', E(b.maDon || '')) +
    ir('Người liên hệ:', E((kh.tenLienHe || '') + (kh.sdt || kh.zalo ? ' – ' + (kh.sdt || kh.zalo) : '')), 'Tỷ giá:', M(b.tyGia) + ' đ/¥') +
    ir('Nhân viên:', E((nv ? nv.hoTen : b.maNV) + (nv && nv.sdt ? ' – ' + nv.sdt : '')), 'Hiệu lực đến:', dmy_(hieuLuc)) + '</table>';

  // A. Hàng hóa
  h += secTitle('A. HÀNG HÓA VÀ GIÁ XUẤT HÓA ĐƠN');
  h += tbl + '<tr>' + hd('STT', 'width:30px') + hd('Sản phẩm') + hd('ĐVT') + hd('SL') + hd('Đơn giá<br>NCC') + hd('Giá xuất<br>trước VAT') + hd('Thành tiền<br>trước VAT') + hd('VAT') + hd('Tiền VAT') + '</tr>';
  lines.forEach((l, i) => {
    h += '<tr>' + cell(l.stt || i + 1, CT) + cell('<b>' + E(l.tenHang) + '</b>' + (l.moTa ? '<div style="font-size:12px;color:#444">' + E(l.moTa) + '</div>' : '')) + cell(E(l.dvt), CT) + cell(M2(l.soLuong), R) +
      cell('¥' + M2(l.donGiaTe), R) + cell(M2(l.giaXuat), R) + cell(M(l.tongTruocVAT), R) + cell(M2(l.vatPct) + '%', CT) + cell(M(l.vat), R) + '</tr>';
  });
  h += '<tr style="background:' + ORL + ';font-weight:bold">' + cell('TỔNG', CT, 'td').replace('<td', '<td colspan="6"') + cell(M(b.tongTruocVAT), R) + cell('') + cell(M(b.vat), R) + '</tr>';
  h += '<tr style="background:' + ORM + ';font-weight:bold">' + cell('TỔNG CỘNG SAU VAT', CT + 'font-size:14px').replace('<td', '<td colspan="6"') + cell(M(b.tongSauVAT) + ' đ', 'text-align:right;font-size:15px;white-space:nowrap').replace('<td', '<td colspan="3"') + '</tr></table>';

  // B. Chi tiết chi phí — hiện ở mọi chế độ xuất.
  // Đủ giá trị: các khoản cộng đúng bằng giá trị hóa đơn. Xuất thấp/cao: các khoản là chi phí thực tế, có thể khác giá trị hóa đơn ở mục A.
  {
    const vcKhoi = Number(b.soKhoi) * Number(b.donGiaKhoi) > Number(b.soKg) * Number(b.donGiaKg);
    const utTren = b.coSoUT === 'tienHang' ? Number(b.tienHang) : Number(b.tongTruocVAT);
    const nhom = (key, base) => { const o = {}; lines.forEach(l => { const k = Number(l[key]); if (!(k > 0)) return; o[k] = o[k] || { base: 0, tien: 0 }; o[k].base += base(l); o[k].tien += Number(key === 'thueNKPct' ? l.thueNK : l.vat) || 0; }); return o; };
    const thue = nhom('thueNKPct', l => b.coSoThueNK === 'giaXuat' ? Number(l.tongTruocVAT) : Number(l.triGiaKhai || Math.round(Number(l.giaXuat) * (Number(b.heSoToKhai) || 0.9425) / (1 + Number(l.thueNKPct) / 100)) * Number(l.soLuong)));
    const vatN = nhom('vatPct', l => Number(l.tongTruocVAT));
    const dau = [['Tiền hàng', '¥' + M2(b.tienHangTe), M(b.tyGia) + ' đ/¥', Number(b.tienHang)], ['Phí ship nội địa Trung Quốc', '¥' + M2(b.shipNoiDiaTe), M(b.tyGia) + ' đ/¥', Number(b.shipNoiDia)]];
    const chinh = [
      ['Phí vận chuyển TQ – Hà Nội', vcKhoi ? M2(b.soKhoi) + ' m³' : M2(b.soKg) + ' kg', vcKhoi ? M(b.donGiaKhoi) + ' đ/m³' : M(b.donGiaKg) + ' đ/kg', Number(b.phiVC)],
      ['Phí dịch vụ', M(b.tienHang), M2(b.phiDVPct) + '%', Number(b.phiDV)],
      ['Phí ủy thác', M(utTren), M2(b.phiUTPct) + '%', Number(b.phiUT)],
    ];
    const phatSinh = [['Phí kê khai hàng dưới 100kg', '', '', Number(b.phiKeKhai)], ['Phí hợp quy', '', '', Number(b.phiHopQuy)], ['Phí kiểm tra chất lượng', '', '', Number(b.phiKTCL)], [b.tenPhiKhac || 'Phí khác', '', '', Number(b.phiKhac)]]
      .concat(Object.keys(thue).map(k => ['Thuế nhập khẩu', M(thue[k].base), M2(k) + '%', thue[k].tien]));
    // Đủ giá trị: phí ủy thác (vốn ra số lẻ) nhận vài đồng chênh làm tròn để cộng đúng bằng tổng trước VAT
    if (du) { const khac = dau.concat(chinh, phatSinh).reduce((a, r, i) => a + (r[0] === 'Phí ủy thác' ? 0 : (r[3] || 0)), 0); chinh[2][3] = Number(b.tongTruocVAT) - khac; }
    const cao = b.cheDoXuat === 'cao' && Number(b.thuThemTNDN) > 0;
    const vatRows = Object.keys(vatN).map(k => ['VAT', M(vatN[k].base), M2(k) + '%', vatN[k].tien]);
    let stt = 0;
    const row = r => '<tr>' + cell(++stt, CT) + cell(E(r[0])) + cell(r[1], R) + cell(r[2], R) + cell(M(r[3]), R) + '</tr>';
    const grp = t => '<tr style="background:' + ORL + '">' + cell('<b>' + t + '</b>').replace('<td', '<td colspan="5"') + '</tr>';
    const shown = dau.filter((r, i) => i === 0 || r[3]).concat(chinh.filter(r => r[3] || r[0] !== 'Phí vận chuyển TQ – Hà Nội'), phatSinh.filter(r => r[3]));
    const tndnRow = cao ? ['Thuế TNDN trên phần chênh giá xuất', M(b.chenhLech), M2(b.tndnPct) + '%', Number(b.thuThemTNDN)] : null;
    const tongB = shown.concat(vatRows, tndnRow ? [tndnRow] : []).reduce((a, r) => a + (r[3] || 0), 0);
    h += secTitle('B. CHI TIẾT CẤU THÀNH CHI PHÍ');
    h += tbl + '<tr>' + hd('STT', 'width:30px') + hd('Mục chi phí') + hd('Số lượng / Giá trị') + hd('Đơn giá / Tỷ lệ') + hd('Thành tiền (đ)') + '</tr>' +
      dau.filter((r, i) => i === 0 || r[3]).map(row).join('') + grp('I. Mục phí chính') + chinh.filter(r => r[3] || r[0] !== 'Phí vận chuyển TQ – Hà Nội').map(row).join('') +
      grp('II. Mục phí phát sinh') + phatSinh.filter(r => r[3]).map(row).join('') + vatRows.map(row).join('') +
      (tndnRow ? grp('III. Phát sinh do xuất hóa đơn cao hơn giá trị thực') + row(tndnRow) : '') +
      '<tr style="background:' + ORM + ';font-weight:bold">' + cell(du ? 'TỔNG CHI PHÍ ĐƠN HÀNG (ĐÃ GỒM VAT)' : 'TỔNG CHI PHÍ THỰC TẾ ĐƠN HÀNG (ĐÃ GỒM VAT)', CT).replace('<td', '<td colspan="4"') + cell(M(tongB), R + 'font-size:14px') + '</tr></table>';
    if (!du) h += '<div style="font-size:10.5px;color:#444;margin:-2px 0 2px"><i>' + (cao ? 'Giá trị hóa đơn (mục A) cao hơn giá trị thực của lô hàng theo yêu cầu của quý khách; thuế TNDN phát sinh trên phần chênh được tính ở mục III.' : 'Giá trị hóa đơn (mục A) xuất theo yêu cầu của quý khách, khác với chi phí thực tế của lô hàng ở trên.') + '</i></div>';
  }

  // Lưu ý + thanh toán
  const noiDung = String(opt.noiDungCK != null ? opt.noiDungCK : (b.noiDungCK || '')).trim();
  const ck = bgCK_(b), soTienCK = ck.soTien;
  const qrLocal = opt.noQR ? '' : qrDataUrl_(soTienCK, noiDung), qrLink = (opt.noQR || opt.forPdf) ? '' : qrUrl_(soTienCK, noiDung);
  const qr = qrLink || qrLocal; opt.qrOk = !!qr;
  const luuY = (lists_().LUU_Y_BG || []).map(x => x.replace('{N}', hl));
  const box = 'border:1px solid ' + LN + ';vertical-align:top;';
  const kvp = (k, v) => '<tr><td style="padding:1px 8px 1px 0;color:#444;white-space:nowrap;vertical-align:top">' + k + '</td><td style="padding:1px 0;font-weight:bold">' + v + '</td></tr>';
  h += '<table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:11.5px;page-break-inside:avoid"><tr>' +
    '<th style="' + box + 'background:' + ORM + ';padding:5px 8px;text-align:left;font-size:12.5px">LƯU Ý</th>' +
    '<th style="' + box + 'background:' + ORM + ';padding:5px 8px;text-align:left;font-size:12.5px;width:46%">THÔNG TIN THANH TOÁN</th></tr><tr>';
  h += '<td style="' + box + 'padding:6px 8px"><table style="width:100%;border-collapse:collapse">' +
    luuY.map((x, i) => '<tr><td style="width:16px;padding:1px 0;vertical-align:top;font-weight:bold">' + (i + 1) + '.</td><td style="padding:1px 0;text-align:justify;line-height:1.3">' + E(x) + '</td></tr>').join('') +
    (b.ghiChu ? '<tr><td style="padding:4px 0 0;vertical-align:top;font-weight:bold">*</td><td style="padding:4px 0 0"><b>Ghi chú:</b> ' + E(b.ghiChu) + '</td></tr>' : '') + '</table></td>';
  h += '<td style="' + box + 'padding:6px 8px"><table style="width:100%;border-collapse:collapse"><tr>' +
    (qr ? '<td style="width:' + (qrLink ? 122 : 100) + 'px;vertical-align:top;padding-right:8px"><img src="' + E(qr) + '"' + (qrLink && qrLocal ? ' onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb=\'\';this.style.width=\'96px\'}" data-fb="' + qrLocal + '"' : '') + ' style="width:' + (qrLink ? 118 : 96) + 'px;height:auto;max-height:160px;display:block;margin:0 auto">' + (qrLink ? '' : '<div style="font-size:10.5px;color:#555;text-align:center;margin-top:2px">Quét để thanh toán</div>') + '</td>' : '') +
    '<td style="vertical-align:top"><table style="border-collapse:collapse">' +
    (cty.tenNganHang ? kvp('Ngân hàng:', E(cty.tenNganHang)) : '') + (cty.qrSoTK ? kvp('Số TK:', E(cty.qrSoTK)) : '') + (cty.qrTenTK ? kvp('Chủ TK:', E(cty.qrTenTK)) : '') +
    (cty.qrSoTK ? '' : (lists_().TK_CONG_TY || []).filter(x => !/tiền mặt|admin sửa/i.test(x)).map(x => kvp('TK:', E(x))).join('')) +
    (soTienCK <= 0 ? kvp('Số tiền:', '<span style="font-weight:normal">theo thỏa thuận</span>') :
      ck.kieu === 'coc' && soTienCK < ck.tong ? kvp('Số tiền cọc:', M(soTienCK) + ' đ<div style="font-weight:normal;font-size:11px;color:#555">(' + ck.tyLe + '% tiền hàng + phí dịch vụ)</div>') :
      soTienCK < ck.tong ? kvp('Số tiền CK:', M(soTienCK) + ' đ<div style="font-weight:normal;font-size:11px;color:#555">(' + Math.round(soTienCK / ck.tong * 100) + '% tổng đơn)</div>') : kvp('Số tiền:', M(soTienCK) + ' đ')) + kvp('Nội dung:', noiDung ? E(noiDung) : '…………………') + '</table></td></tr></table></td></tr></table>';
  // Ký
  h += '<table style="width:100%;border-collapse:collapse;margin-top:6px;text-align:center;font-size:12.5px;page-break-inside:avoid"><tr>' +
    '<td style="width:50%;vertical-align:top"><b>XÁC NHẬN CỦA KHÁCH HÀNG</b><div style="font-size:12px;color:#555;font-style:italic">(Ký, ghi rõ họ tên)</div><div style="height:30px"></div></td>' +
    '<td style="vertical-align:top"><b>' + E(cty.tenNgan).toUpperCase() + '</b><div style="font-size:12px;color:#555;font-style:italic">Nhân viên kinh doanh</div><div style="height:26px"></div><b>' + E(nv ? nv.hoTen : '') + '</b></td></tr></table>';
  return h + '</div>';
}
/** Số tiền khách chuyển. Kiểu: 'coc' = % × (tiền hàng + phí dịch vụ) (mặc định 80%), 'tong' = toàn bộ đơn, 'nhap' = số tự nhập. */
function bgCK_(b) {
  const tong = Number(b.tongSauVAT) || 0, ts = thamSo_();
  let kieu = b.kieuCK;
  if (!['coc', 'tong', 'nhap'].includes(kieu)) kieu = (b.soTienCK === '' || b.soTienCK == null) ? 'coc' : 'nhap';
  const tyLe = Number(b.tyLeCoc) || Number(ts.tyLeCoc) || 80, coSoCoc = (Number(b.tienHang) || 0) + (Number(b.phiDV) || 0);
  const soTien = kieu === 'tong' ? tong : kieu === 'coc' ? Math.min(tong, Math.ceil(coSoCoc * tyLe / 100 / 1000) * 1000) : Math.max(0, Number(b.soTienCK) || 0);
  return { kieu, tyLe, soTien, coSoCoc, tong };
}
function bgSaveCK_(maBG, noiDung, ck) {
  if (noiDung == null && ck == null) return;
  withLock_(() => {
    const b = findOne_(SH.BG, 'maBG', maBG); if (!b) return;
    if (noiDung != null) b.noiDungCK = String(noiDung).trim().slice(0, 120);
    if (ck != null) {
      if (typeof ck !== 'object') ck = { kieu: 'nhap', soTien: ck };
      b.kieuCK = ['coc', 'tong', 'nhap'].includes(ck.kieu) ? ck.kieu : 'coc';
      if (ck.tyLe != null && ck.tyLe !== '') b.tyLeCoc = Math.min(100, Math.max(1, Number(ck.tyLe) || 80));
      if (b.kieuCK === 'nhap') b.soTienCK = Math.max(0, Math.round(Number(ck.soTien) || 0));
    }
    update_(SH.BG, b);
  });
}
/** ck = { kieu: 'coc'|'tong'|'nhap', tyLe, soTien } — để null thì giữ như đã lưu. */
function apiBGHtml(token, maBG, noiDungCK, ck) {
  if (noiDungCK != null || ck != null) bgSaveCK_(maBG, noiDungCK, ck);
  const d = apiGetBG(token, maBG), opt = { noiDungCK: d.bg.noiDungCK || '' };
  const html = bgHtml_(d.bg, d.lines, findOne_(SH.KH, 'maKH', d.bg.maKH) || {}, userBy_(d.bg.maNV), opt);
  const t = bgCK_(d.bg);
  return { html, noiDungCK: d.bg.noiDungCK || '', kieuCK: t.kieu, tyLeCoc: t.tyLe, soTienCK: t.soTien, coSoCoc: t.coSoCoc, tongSauVAT: t.tong, qrOk: opt.qrOk };
}
function apiBGPdf(token, maBG, noiDungCK, ck) {
  const u = auth_(token); if (noiDungCK != null || ck != null) bgSaveCK_(maBG, noiDungCK, ck);
  const d = apiGetBG(token, maBG), html = bgHtml_(d.bg, d.lines, findOne_(SH.KH, 'maKH', d.bg.maKH) || {}, userBy_(d.bg.maNV), { forPdf: true });
  const folder = folder_(APP.THU_MUC_PDF);
  const bg = findOne_(SH.BG, 'maBG', maBG) || {};
  const blob = HtmlService.createHtmlOutput('<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:10mm 11mm}body{margin:0}table{font-size:inherit}</style></head><body>' + html + '</body></html>')
    .getBlob().getAs('application/pdf').setName('BaoGia_' + maBG + '_' + String(bg.tenKH || '').replace(/[\\/:*?"<>|]/g, '').slice(0, 40) + '.pdf');
  const file = folder.createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* tên miền chặn chia sẻ ngoài */ }
  withLock_(() => { const b = findOne_(SH.BG, 'maBG', maBG); b.linkPDF = file.getUrl(); b.ngayCapNhat = now_(); update_(SH.BG, b); });
  return { url: file.getUrl(), nguoiTao: u.maNV };
}

/* ============================ KHÁCH ĐANG CHẠY CỦA CÔNG TY ============================ */
let KHHT_CACHE_ = null;
/** Chỉ mục SĐT/MST -> [tên, ngày đơn gần nhất, phụ trách, mã]. Giữ trong bộ đệm 6 giờ. */
function khhtIndex_() {
  if (KHHT_CACHE_) return KHHT_CACHE_;
  let idx = cBigGet_('C_KHHT');
  if (!idx) {
    idx = {};
    readAll_(SH.KHHT).forEach(r => {
      const v = [String(r.tenKH || ''), parseDate_(r.ngayDonGanNhat), String(r.phuTrach || ''), String(r.maKHHT || '')];
      [normPhone_(r.sdt), normPhone_(r.sdt2), String(r.mst || '').replace(/\s/g, '')].forEach(k => { if (/^\d{9,14}(-\d{3})?$/.test(k)) idx[k] = v; });
    });
    cBigPut_('C_KHHT', idx, 21600);
  }
  return (KHHT_CACHE_ = idx);
}
function khhtClear_() { KHHT_CACHE_ = null; CacheService.getScriptCache().remove('C_KHHT_N'); }
const khhtKeys_ = o => [normPhone_(o.sdt), normPhone_(o.zalo), String(o.mst || '').replace(/\s/g, '')].map(String).filter(x => /^\d{9,14}(-\d{3})?$/.test(x));
function khhtHit_(keys) {
  const idx = khhtIndex_(), t = today_();
  for (const k of keys) {
    const v = idx[k]; if (!v) continue;
    const so = v[1] ? diffDays_(v[1], t) : null;
    return { ten: v[0], ngayDon: v[1], soNgay: so, phuTrach: v[2], maKHHT: v[3], dangChay: so === null || so <= thamSo_().ngayKHHTHoatDong };
  }
  return null;
}
/** Đối chiếu toàn bộ hồ sơ CRM với danh sách khách đang chạy, ghi cờ vào cột "Trùng KH đang chạy". */
function refreshFlagsKHHT_() {
  const s = sh_(SH.KH), n = s.getLastRow() - 1, dang = [];
  if (n < 1) return { dangChay: dang };
  const cols = COLS[SH.KH], col = k => s.getRange(2, cols.indexOf(k) + 1, n, 1).getValues();
  const sdt = col('sdt'), zalo = col('zalo'), mst = col('mst'), ma = col('maKH'), cF = cols.indexOf('trungKHHT') + 1, cur = col('trungKHHT');
  let changed = false; const out = [];
  for (let i = 0; i < n; i++) {
    const h = khhtHit_(khhtKeys_({ sdt: sdt[i][0], zalo: zalo[i][0], mst: mst[i][0] }));
    const f = h ? (h.dangChay ? KHHT.DANG : KHHT.NGU) : '';
    if (f !== String(cur[i][0])) changed = true;
    out.push([f]); if (f === KHHT.DANG) dang.push(ma[i][0]);
  }
  if (changed) s.getRange(2, cF, n, 1).setValues(out);
  return { dangChay: dang };
}
/** Sale kiểm tra nhanh 1 SĐT / MST trước khi tiếp cận. Không trả về thông tin chi tiết của khách người khác. */
function apiCheckTrung(token, q) {
  const u = auth_(token);
  const v = normPhone_(String(q || '').trim()).replace(/\s/g, '');
  if (!/^\d{9,14}(-\d{3})?$/.test(v)) throw new Error('Nhập SĐT (10 số) hoặc MST (10 số)');
  const hit = khhtHit_([v]);
  if (hit && hit.dangChay) return { tone: 'bad', msg: 'Khách đang giao dịch với công ty — KHÔNG tiếp cận.', sub: (hit.phuTrach ? 'Phụ trách: ' + hit.phuTrach + '. ' : '') + (hit.ngayDon ? 'Có đơn trong ' + hit.soNgay + ' ngày gần đây.' : '') };
  const dup = findDup_({ sdt: /^0/.test(v) ? v : '', zalo: '', mst: v }, '');
  if (dup && dup.maNV === u.maNV) return { tone: 'ok', msg: 'Khách của bạn: ' + dup.maKH, sub: 'Mở mục Khách hàng để chăm tiếp.', maKH: dup.maKH };
  if (dup && dup.coDon) return { tone: 'bad', msg: 'Khách đã có chủ: ' + dup.tenNV + ' (' + dup.maKH + ').', sub: 'Theo Sổ tay 8.1, không được tiếp cận.' };
  if (dup) return { tone: 'warn', msg: 'Đang được ' + dup.tenNV + ' theo, chưa có đơn (' + dup.maKH + ').', sub: 'Sân chung: báo Trưởng nhóm để thống nhất một đầu mối.' };
  if (hit) return { tone: 'warn', msg: 'Khách cũ của công ty, đã ' + hit.soNgay + ' ngày không có đơn.', sub: 'Được phép đánh thức. Khi tạo hồ sơ, chọn nguồn "Kho khách ngủ".' };
  return { tone: 'ok', msg: 'Chưa có trong hệ thống — được tiếp cận.', sub: 'Tạo hồ sơ khách ngay khi kết nối được.' };
}
function apiKHHTInfo(token) {
  const u = auth_(token); needRole_(u, ['ADMIN', 'QUANLY']);
  const s = sh_(SH.KHHT), n = Math.max(0, s.getLastRow() - 1);
  const cap = n ? String(norm_(s.getRange(2, COLS[SH.KHHT].indexOf('capNhatLuc') + 1).getValue())) : '';
  return { soDong: n, capNhatLuc: cap, nguong: thamSo_().ngayKHHTHoatDong };
}
/** Admin dán danh sách từ hệ thống đơn hàng: thay toàn bộ danh sách cũ. Cột: Mã | Tên | SĐT | SĐT2/Zalo | MST | Ngày đơn gần nhất | Phụ trách | Ghi chú */
function apiImportKHHT(token, rows) {
  const u = auth_(token); needRole_(u, ['ADMIN']);
  if (!Array.isArray(rows) || !rows.length) throw new Error('Không có dòng dữ liệu');
  if (rows.length > 60000) throw new Error('Tối đa 60.000 dòng mỗi lần');
  const t = now_();
  const data = rows.map(r => ({ maKHHT: String(r[0] || '').trim(), tenKH: String(r[1] || '').trim(), sdt: normPhone_(r[2]), sdt2: normPhone_(r[3]), mst: String(r[4] || '').replace(/\s/g, ''), ngayDonGanNhat: parseDate_(r[5]), phuTrach: String(r[6] || '').trim(), ghiChu: String(r[7] || '').trim(), capNhatLuc: t })).filter(o => o.sdt || o.sdt2 || o.mst);
  if (!data.length) throw new Error('Không dòng nào có SĐT hoặc MST. Kiểm tra lại thứ tự cột.');
  return withLock_(() => {
    const s = sh_(SH.KHHT), last = s.getLastRow();
    if (last > 1) s.getRange(2, 1, last - 1, COLS[SH.KHHT].length).clearContent();
    appendMany_(SH.KHHT, data);
    khhtClear_();
    const f = refreshFlagsKHHT_();
    const nguong = thamSo_().ngayKHHTHoatDong, tday = today_();
    return { soDong: data.length, boQua: rows.length - data.length, dangChay: data.filter(o => !o.ngayDonGanNhat || diffDays_(o.ngayDonGanNhat, tday) <= nguong).length, trungCRM: f.dangChay.length };
  });
}

/* ============================ HỖ TRỢ & CHỈ ĐẠO THEO KHÁCH ============================ */
/** "Bóng đang ở chân ai": Chờ quản lý = quản lý/Admin phải trả lời; Chờ sale = sale phải làm/trả lời. */
function htMine_(u, r) {
  if (r.trangThai === HT_TT.XONG) return false;
  if (r.trangThai === HT_TT.CHO_SALE) return r.maNVSale === u.maNV;
  return u.vaiTro !== 'SALE' && r.maNVSale !== u.maNV;
}
function htOut_(r) {
  let td = []; try { td = JSON.parse(r.traoDoi || '[]'); } catch (e) {}
  const o = {}; COLS[SH.HT].forEach(k => { if (k !== 'traoDoi') o[k] = r[k]; });
  o.tenSale = nvName_(r.maNVSale); o.tenTao = nvName_(r.nguoiTao);
  o.traoDoi = td.map(x => Object.assign({}, x, { ten: nvName_(x.by) }));
  return o;
}
function apiHTCreate(token, o) {
  const u = auth_(token), sc = scope_(u); o = o || {};
  const nd = String(o.noiDung || '').trim();
  if (!o.chuDe) throw new Error('Chọn chủ đề');
  if (nd.length < 10) throw new Error('Mô tả tối thiểu 10 ký tự: khách đang vướng gì, cần hỗ trợ gì.');
  return withLock_(() => {
    const kh = findOne_(SH.KH, 'maKH', o.maKH);
    if (!kh || !inScope_(sc, kh.maNV)) throw new Error('Không có quyền với khách hàng này');
    const laSale = kh.maNV === u.maNV;
    if (laSale && u.vaiTro === 'ADMIN') throw new Error('Admin tự xử lý khách của mình, không cần tạo yêu cầu');
    const r = { maHT: 'HT' + seq_('SEQ_HT', 6), thoiGian: now_(), ngay: today_(), loai: laSale ? 'Sale nhờ hỗ trợ' : 'Quản lý chỉ đạo', maKH: kh.maKH, tenKH: kh.tenCongTy || kh.tenLienHe, maNVSale: kh.maNV, nguoiTao: u.maNV, chuDe: o.chuDe, mucUuTien: o.mucUuTien || 'Bình thường', noiDung: nd, trangThai: laSale ? HT_TT.CHO_QL : HT_TT.CHO_SALE, traoDoi: '[]', capNhatLuc: now_() };
    append_(SH.HT, r);
    logSys_(kh, u, (laSale ? 'Nhờ quản lý hỗ trợ (' : 'Quản lý chỉ đạo (') + o.chuDe + '): ' + nd.slice(0, 300));
    return htOut_(r);
  });
}
function htGetScoped_(u, maHT) {
  const r = findOne_(SH.HT, 'maHT', maHT);
  if (!r || !(inScope_(scope_(u), r.maNVSale) || r.nguoiTao === u.maNV)) throw new Error('Không tìm thấy yêu cầu hoặc không có quyền');
  return r;
}
/** Mở 1 yêu cầu kèm tóm tắt khách và 5 lần chăm gần nhất, để quản lý hỗ trợ mà không phải mở hồ sơ. */
function apiHTGet(token, maHT) {
  const u = auth_(token), r = htGetScoped_(u, maHT);
  const kh = findOne_(SH.KH, 'maKH', r.maKH);
  const logs = findRows_(SH.CS, 'maKH', r.maKH).filter(c => c.kenh !== KENH_HT).reverse().slice(0, 5).map(c => Object.assign(slim_(c, ['thoiGian','kenh','mucDich','ketQua','noiDung','mucDo']), { tenNV: nvName_(c.maNV) }));
  const bgs = findRows_(SH.BG, 'maKH', r.maKH).reverse().slice(0, 3).map(b => slim_(b, ['maBG','ngayTao','tongSauVAT','trangThai','canhBaoGia','tomTatHang']));
  return { ht: htOut_(r), kh: kh ? slim_(decorate_(kh, today_()), KH_SLIM.concat(['matHang','dichVu','phapNhan','canHoaDon','dacThuHang','tanSuat','giaTriDuKien','doiThu','ghiChu'])) : null, logs, bgs };
}
function apiHTReply(token, maHT, nd, dong, ketQua) {
  const u = auth_(token); nd = String(nd || '').trim();
  if (!nd && !dong) throw new Error('Nhập nội dung trao đổi');
  return withLock_(() => {
    const r = htGetScoped_(u, maHT);
    if (r.trangThai === HT_TT.XONG) throw new Error('Yêu cầu đã đóng');
    let td = []; try { td = JSON.parse(r.traoDoi || '[]'); } catch (e) {}
    if (nd) td.push({ t: now_(), by: u.maNV, nd: nd.slice(0, 2000) });
    while (JSON.stringify(td).length > 45000) td.shift();
    r.traoDoi = JSON.stringify(td);
    if (dong) { r.trangThai = HT_TT.XONG; r.ketQua = String(ketQua || nd || '').trim(); r.dongLuc = now_(); }
    else r.trangThai = u.maNV === r.maNVSale ? HT_TT.CHO_QL : HT_TT.CHO_SALE;
    if (u.maNV !== r.maNVSale) r.nguoiXuLy = u.maNV;
    r.capNhatLuc = now_(); update_(SH.HT, r);
    return htOut_(r);
  });
}
function apiHTList(token, f) {
  const u = auth_(token), sc = scope_(u); f = f || {};
  let rows = readTail_(SH.HT, 'ngay', f.tuNgay || addDays_(today_(), -180)).filter(r => inScope_(sc, r.maNVSale) || r.nguoiTao === u.maNV);
  const cnt = { mine: rows.filter(r => htMine_(u, r)).length, mo: rows.filter(r => r.trangThai !== HT_TT.XONG).length, xong: rows.filter(r => r.trangThai === HT_TT.XONG).length, tong: rows.length };
  if (f.loc === 'mine') rows = rows.filter(r => htMine_(u, r));
  else if (f.loc === 'mo') rows = rows.filter(r => r.trangThai !== HT_TT.XONG);
  else if (f.loc === 'xong') rows = rows.filter(r => r.trangThai === HT_TT.XONG);
  return { cnt, rows: rows.reverse().slice(0, 500).map(htOut_) };
}

/* ============================ ẢNH ĐÍNH KÈM (bill, claim) ============================ */
function folder_(name, parent) { const it = parent ? parent.getFoldersByName(name) : DriveApp.getFoldersByName(name); return it.hasNext() ? it.next() : (parent ? parent.createFolder(name) : DriveApp.createFolder(name)); }
/** Lưu ảnh (đã nén ở trình duyệt) vào Drive: <thư mục>/<yyyy-MM>/. Ai có link mới xem được. */
function saveImg_(dataUrl, root, name) {
  const m = String(dataUrl || '').match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/);
  if (!m) throw new Error('Ảnh không hợp lệ, chỉ nhận PNG hoặc JPG');
  if (m[2].length > 4000000) throw new Error('Ảnh quá lớn, vui lòng chụp lại hoặc cắt bớt');
  const f = folder_(today_().slice(0, 7), folder_(root)).createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name));
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return f.getUrl();
}

/* ============================ NẠP / RÚT TIỀN (sale báo, kế toán xác nhận) ============================ */
function nrSee_(u, r) { return u.vaiTro === 'ADMIN' || u.vaiTro === 'KETOAN' || inScope_(scope_(u), r.maNV); }
function nrOut_(r) { const o = {}; COLS[SH.NR].forEach(k => o[k] = r[k]); o.tenNV = nvName_(r.maNV); o.tenXN = r.nguoiXacNhan ? nvName_(r.nguoiXacNhan) : ''; return o; }
function apiNRSave(token, o) {
  const u = auth_(token), sc = scope_(u); o = o || {};
  if (u.vaiTro === 'KETOAN') throw new Error('Kế toán chỉ xác nhận, không tạo giao dịch');
  const loai = o.loai === 'Rút tiền' || o.loai === 'Nạp tiền' ? o.loai : '';
  if (!loai) throw new Error('Chọn loại: Nạp tiền hoặc Rút tiền');
  const soTien = Math.round(Number(o.soTien) || 0);
  if (soTien <= 0) throw new Error('Nhập số tiền');
  const kh = findOne_(SH.KH, 'maKH', o.maKH);
  if (!kh || !inScope_(sc, kh.maNV)) throw new Error('Chọn khách hàng trong danh sách của bạn');
  if (loai === 'Rút tiền' && !String(o.tkKhach || '').trim()) throw new Error('Ghi tài khoản nhận tiền của khách: tên chủ TK, số TK, ngân hàng');
  if (loai === 'Rút tiền' && !String(o.lyDo || '').trim()) throw new Error('Ghi lý do rút tiền');
  let link = String(o.linkBill || '');
  if (o.billData) link = saveImg_(o.billData, 'NamTrung_Bill', (loai === 'Nạp tiền' ? 'NAP_' : 'RUT_') + kh.maKH + '_' + now_().replace(/\D/g, '') + '.jpg');
  if (loai === 'Nạp tiền' && !link) throw new Error('Đính kèm ảnh bill chuyển khoản của khách');
  return withLock_(() => {
    let r; const isNew = !o.maGD;
    if (!isNew) {
      r = findOne_(SH.NR, 'maGD', o.maGD);
      if (!r || (r.maNV !== u.maNV && u.vaiTro !== 'ADMIN')) throw new Error('Không có quyền sửa giao dịch này');
      if (![NR_TT.CHO, NR_TT.TC].includes(r.trangThai)) throw new Error('Giao dịch đã được kế toán xác nhận hoặc đã hủy, không sửa được');
    } else r = { maGD: (loai === 'Nạp tiền' ? 'NAP' : 'RUT') + seq_('SEQ_NR', 6), thoiGian: now_(), ngay: today_(), maNV: u.maNV };
    Object.assign(r, { loai, maKH: kh.maKH, tenKH: kh.tenCongTy || kh.tenLienHe, maDon: String(o.maDon || '').trim(), soTien, tkCongTy: String(o.tkCongTy || '').trim(),
      ngayCK: String(o.ngayCK || '').replace('T', ' ').slice(0, 16), noiDungCK: String(o.noiDungCK || '').trim(), tkKhach: String(o.tkKhach || '').trim(),
      lyDo: String(o.lyDo || '').trim(), linkBill: link, trangThai: NR_TT.CHO, nguoiXacNhan: '', xacNhanLuc: '', capNhatLuc: now_() });
    const t = today_();
    const dup = readTail_(SH.NR, 'ngay', addDays_(t, -3)).find(x => x.maGD !== r.maGD && x.loai === loai && x.maKH === r.maKH && Number(x.soTien) === soTien && x.trangThai !== NR_TT.HUY);
    if (isNew) append_(SH.NR, r); else update_(SH.NR, r);
    return { maGD: r.maGD, warn: dup ? 'Lưu ý: 3 ngày gần đây đã có ' + dup.maGD + ' cùng khách, cùng số tiền. Kiểm tra xem có báo trùng không.' : '' };
  });
}
function apiNRList(token, f) {
  const u = auth_(token), t = today_(); f = f || {};
  const from = f.trangThai === NR_TT.CHO ? addDays_(t, -180) : (f.tuNgay || addDays_(t, -30)), to = f.trangThai === NR_TT.CHO ? t : (f.denNgay || t);
  let rows = readTail_(SH.NR, 'ngay', from).filter(r => r.ngay <= to && nrSee_(u, r));
  if (f.loai) rows = rows.filter(r => r.loai === f.loai);
  if (f.maNV) rows = rows.filter(r => r.maNV === f.maNV);
  if (f.q) { const q = fold_(f.q); rows = rows.filter(r => fold_([r.maGD, r.maKH, r.tenKH, r.maDon, r.noiDungCK, r.maThamChieu, r.tkKhach].join(' ')).indexOf(q) >= 0); }
  const sum = a => a.reduce((x, r) => x + (Number(r.soTien) || 0), 0), by = (l, tt) => rows.filter(r => r.loai === l && r.trangThai === tt);
  const tot = { napOK: sum(by('Nạp tiền', NR_TT.OK)), rutOK: sum(by('Rút tiền', NR_TT.OK)), napCho: sum(by('Nạp tiền', NR_TT.CHO)), rutCho: sum(by('Rút tiền', NR_TT.CHO)),
    soCho: rows.filter(r => r.trangThai === NR_TT.CHO).length, soTC: rows.filter(r => r.trangThai === NR_TT.TC).length };
  if (f.trangThai) rows = rows.filter(r => r.trangThai === f.trangThai);
  return { tot, rows: rows.reverse().slice(0, 1500).map(nrOut_) };
}
function apiNRConfirm(token, maGD, ok, maThamChieu, ghiChu) {
  const u = auth_(token); needRole_(u, ['ADMIN', 'KETOAN']);
  ghiChu = String(ghiChu || '').trim();
  if (!ok && !ghiChu) throw new Error('Ghi lý do từ chối để sale biết cách xử lý');
  return withLock_(() => {
    const r = findOne_(SH.NR, 'maGD', maGD);
    if (!r) throw new Error('Không tìm thấy giao dịch');
    if (r.trangThai !== NR_TT.CHO) throw new Error('Giao dịch đã được xử lý trước đó (' + r.trangThai + ')');
    Object.assign(r, { trangThai: ok ? NR_TT.OK : NR_TT.TC, nguoiXacNhan: u.maNV, xacNhanLuc: now_(), maThamChieu: String(maThamChieu || '').trim(), ghiChuKT: ghiChu, capNhatLuc: now_() });
    update_(SH.NR, r);
    const kh = findOne_(SH.KH, 'maKH', r.maKH);
    if (kh) logSys_(kh, u, 'Kế toán ' + (ok ? 'xác nhận ' : 'từ chối ') + r.loai.toLowerCase() + ' ' + money_(r.soTien) + ' đ (' + r.maGD + ')' + (ghiChu ? ': ' + ghiChu : ''));
    return nrOut_(r);
  });
}
/** Admin mở lại giao dịch đã xử lý nhầm. */
function apiNRReopen(token, maGD) {
  const u = auth_(token); needRole_(u, ['ADMIN']);
  return withLock_(() => { const r = findOne_(SH.NR, 'maGD', maGD); if (!r) throw new Error('Không tìm thấy');
    r.ghiChuKT = [r.ghiChuKT, 'Admin mở lại lúc ' + now_() + ' (trước đó: ' + r.trangThai + ')'].filter(String).join(' | ');
    Object.assign(r, { trangThai: NR_TT.CHO, nguoiXacNhan: '', xacNhanLuc: '', capNhatLuc: now_() }); update_(SH.NR, r); return nrOut_(r); });
}
function apiNRCancel(token, maGD) {
  const u = auth_(token);
  return withLock_(() => {
    const r = findOne_(SH.NR, 'maGD', maGD);
    if (!r || (r.maNV !== u.maNV && u.vaiTro !== 'ADMIN')) throw new Error('Không có quyền hủy giao dịch này');
    if (![NR_TT.CHO, NR_TT.TC].includes(r.trangThai)) throw new Error('Giao dịch đã xác nhận, không hủy được. Báo Admin nếu cần.');
    r.trangThai = NR_TT.HUY; r.capNhatLuc = now_(); update_(SH.NR, r); return nrOut_(r);
  });
}

/* ============================ CLAIM / HỎI ĐÁP CHUNG (nhân viên -> quản trị) ============================ */
function clMine_(u, r) {
  if (r.trangThai === CL_TT.XONG) return false;
  return u.vaiTro === 'ADMIN' ? r.trangThai === CL_TT.CHO_QT : (r.nguoiGui === u.maNV && r.trangThai === CL_TT.CHO_NG);
}
function clSee_(u, r) { return u.vaiTro === 'ADMIN' || r.nguoiGui === u.maNV || (r.congKhai === 'Có' && r.trangThai === CL_TT.XONG); }
function clOut_(r) {
  let td = []; try { td = JSON.parse(r.traoDoi || '[]'); } catch (e) {}
  const o = {}; COLS[SH.CL].forEach(k => { if (k !== 'traoDoi') o[k] = r[k]; });
  o.tenGui = nvName_(r.nguoiGui); o.traoDoi = td.map(x => Object.assign({}, x, { ten: nvName_(x.by) }));
  return o;
}
function apiCLCreate(token, o) {
  const u = auth_(token); o = o || {};
  const tieuDe = String(o.tieuDe || '').trim(), nd = String(o.noiDung || '').trim();
  if (!o.loai) throw new Error('Chọn loại');
  if (tieuDe.length < 5) throw new Error('Tiêu đề tối thiểu 5 ký tự');
  if (nd.length < 10) throw new Error('Mô tả tối thiểu 10 ký tự');
  let maKH = String(o.maKH || '').trim();
  if (maKH) { const kh = findOne_(SH.KH, 'maKH', maKH); if (!kh || !inScope_(scope_(u), kh.maNV)) maKH = ''; }
  const link = o.anhData ? saveImg_(o.anhData, 'NamTrung_Claim', 'CLAIM_' + u.maNV + '_' + now_().replace(/\D/g, '') + '.jpg') : '';
  return withLock_(() => {
    const r = { maCL: 'CL' + seq_('SEQ_CL', 5), thoiGian: now_(), ngay: today_(), nguoiGui: u.maNV, loai: o.loai, tieuDe, noiDung: nd, mucDo: o.mucDo || 'Bình thường',
      maKH, maDon: String(o.maDon || '').trim(), linkAnh: link, trangThai: CL_TT.CHO_QT, traoDoi: '[]', capNhatLuc: now_(), congKhai: '' };
    append_(SH.CL, r); return clOut_(r);
  });
}
function apiCLList(token, f) {
  const u = auth_(token); f = f || {};
  let rows = readTail_(SH.CL, 'ngay', addDays_(today_(), -730)).filter(r => clSee_(u, r));
  const mine = rows.filter(r => u.vaiTro === 'ADMIN' || r.nguoiGui === u.maNV), faq = rows.filter(r => r.congKhai === 'Có' && r.trangThai === CL_TT.XONG);
  const cnt = { can: rows.filter(r => clMine_(u, r)).length, mo: mine.filter(r => r.trangThai !== CL_TT.XONG).length, xong: mine.filter(r => r.trangThai === CL_TT.XONG).length, faq: faq.length };
  if (f.loc === 'faq') rows = faq;
  else if (f.loc === 'can') rows = rows.filter(r => clMine_(u, r));
  else if (f.loc === 'mo') rows = mine.filter(r => r.trangThai !== CL_TT.XONG);
  else if (f.loc === 'xong') rows = mine.filter(r => r.trangThai === CL_TT.XONG);
  else rows = mine;
  if (f.q) { const q = fold_(f.q); rows = rows.filter(r => fold_([r.maCL, r.tieuDe, r.noiDung, r.ketQua, r.loai, r.maKH, r.maDon].join(' ')).indexOf(q) >= 0); }
  return { cnt, rows: rows.reverse().slice(0, 500).map(clOut_) };
}
function apiCLGet(token, maCL) {
  const u = auth_(token), r = findOne_(SH.CL, 'maCL', maCL);
  if (!r || !clSee_(u, r)) throw new Error('Không tìm thấy hoặc không có quyền xem');
  return clOut_(r);
}
function apiCLReply(token, maCL, nd, dong, congKhai) {
  const u = auth_(token); nd = String(nd || '').trim();
  if (!nd && !dong) throw new Error('Nhập nội dung trả lời');
  return withLock_(() => {
    const r = findOne_(SH.CL, 'maCL', maCL);
    if (!r || !(u.vaiTro === 'ADMIN' || r.nguoiGui === u.maNV)) throw new Error('Không có quyền trả lời');
    if (r.trangThai === CL_TT.XONG) throw new Error('Mục này đã đóng');
    let td = []; try { td = JSON.parse(r.traoDoi || '[]'); } catch (e) {}
    if (nd) td.push({ t: now_(), by: u.maNV, nd: nd.slice(0, 3000) });
    while (JSON.stringify(td).length > 45000) td.shift();
    r.traoDoi = JSON.stringify(td);
    if (dong) { r.trangThai = CL_TT.XONG; r.ketQua = nd || r.ketQua || 'Đã xử lý'; r.dongLuc = now_(); }
    else r.trangThai = u.vaiTro === 'ADMIN' && r.nguoiGui !== u.maNV ? CL_TT.CHO_NG : CL_TT.CHO_QT;
    if (u.vaiTro === 'ADMIN') { r.nguoiXuLy = u.maNV; if (congKhai !== undefined && congKhai !== null) r.congKhai = congKhai ? 'Có' : ''; }
    r.capNhatLuc = now_(); update_(SH.CL, r); return clOut_(r);
  });
}
function apiCLPublic(token, maCL, on) {
  const u = auth_(token); needRole_(u, ['ADMIN']);
  return withLock_(() => { const r = findOne_(SH.CL, 'maCL', maCL); if (!r) throw new Error('Không tìm thấy'); r.congKhai = on ? 'Có' : ''; r.capNhatLuc = now_(); update_(SH.CL, r); return clOut_(r); });
}

/* ============================ KPI & BÁO CÁO NGÀY ============================ */
function emptyM_() { return { khMoi: 0, tiepCan: 0, ketNoi: 0, chamLai: 0, goi: 0, nhanTin: 0, baoGia: 0, donChot: 0, donDau: 0, khQuanTam: 0, fb: 0, fbXN: 0, dungHan: 0, soBC: 0, s_goi: 0, s_nhan: 0, s_data: 0, luotCham: 0 }; }
function autoMetrics_(ids, from, to) {
  const set = new Set(ids), m = {}, tc = {}, kn = {}, cl = {}, qt = {};
  ids.forEach(x => { m[x] = emptyM_(); tc[x] = new Set(); kn[x] = new Set(); cl[x] = new Set(); qt[x] = new Set(); });
  readTail_(SH.KH, 'ngayTao', from).forEach(k => { if (k.ngayTao <= to && set.has(k.maNV)) m[k.maNV].khMoi++; });
  readTail_(SH.CS, 'ngay', from).forEach(c => {
    if (c.ngay > to || !set.has(c.maNV) || c.kenh === KENH_HT) return;
    const x = m[c.maNV], key = c.maKH + '|' + c.ngay;
    x.luotCham++;
    if (c.mucDich === MD_TIEP_CAN) tc[c.maNV].add(key); else cl[c.maNV].add(key);
    if (c.thanhCong === 'Có') kn[c.maNV].add(key);
    if (c.kenh === 'Gọi điện') x.goi++; else if (['Zalo', 'SMS', 'Facebook/Messenger'].includes(c.kenh)) x.nhanTin++;
    if (c.mucDo === 'Nóng' || c.mucDo === 'Ấm') qt[c.maNV].add(c.maKH);
  });
  readTail_(SH.BG, 'ngayTao', addDays_(from, -120)).forEach(b => {
    if (!set.has(b.maNV)) return;
    const x = m[b.maNV];
    if (b.ngayGui && b.ngayGui >= from && b.ngayGui <= to) x.baoGia++;
    if (b.ngayChot && b.ngayChot >= from && b.ngayChot <= to) { x.donChot++; if (b.donDau === 'Có') x.donDau++; }
  });
  readTail_(SH.BCN, 'ngay', from).forEach(r => {
    if (r.ngay > to || !set.has(r.maNV)) return;
    const x = m[r.maNV], n = [r.s_fb1, r.s_fb2, r.s_fb3].filter(v => String(v || '').trim()).length;
    x.soBC++;
    if (r.ql_xacNhanFB !== 'Không đạt') x.fb += n;
    if (r.ql_xacNhanFB === 'Đạt') x.fbXN += n;
    if (r.dungHan === 'Đúng hạn') x.dungHan++;
    x.s_goi += Number(r.s_tongGoi) || 0; x.s_nhan += Number(r.s_tongNhan) || 0; x.s_data += Number(r.s_dataTim) || 0;
  });
  ids.forEach(x => { m[x].tiepCan = tc[x].size; m[x].chamLai = cl[x].size; m[x].ketNoi = kn[x].size; m[x].khQuanTam = qt[x].size; });
  return m;
}
function sumM_(m) { const s = emptyM_(); Object.values(m).forEach(x => Object.keys(s).forEach(k => s[k] += x[k] || 0)); return s; }
/** days = số ngày làm việc (hoặc số người × ngày khi gộp nhóm). */
function score_(x, targets, days, heSo) {
  let tot = 0, w = 0; const det = {};
  targets.forEach(t => {
    const hs = KPI_KHONG_HE_SO.includes(t.maChiSo) ? 1 : (heSo || 1);
    const tg = Math.round(t.ngay * days * hs * 10) / 10, v = x[t.maChiSo] || 0;
    const r = tg > 0 ? v / tg : null;
    det[t.maChiSo] = { v, tg, r };
    if (t.trongSo > 0 && tg > 0) { tot += Math.min(r, 1.2) * t.trongSo; w += t.trongSo; }
  });
  return { diem: w ? Math.round(tot / w * 1000) / 10 : 0, det };
}

/** Số liệu nhẹ cho bảng điều khiển (KPI hôm nay + báo giá chờ). Danh sách khách được tải riêng 1 lần và lọc ở trình duyệt. */
function homeLite_(u) {
  const t = today_(), sc = scope_(u);
  const ids = u.vaiTro === 'SALE' ? [u.maNV] : users_().filter(x => x.trangThai === 'Đang làm' && x.vaiTro !== 'ADMIN' && x.vaiTro !== 'KETOAN' && inScope_(sc, x.maNV)).map(x => x.maNV);
  const m = sumM_(autoMetrics_(ids, t, t)), tg = kpiTargets_();
  const s = score_(m, tg, Math.max(ids.length, 1), u.vaiTro === 'SALE' ? Number(u.heSoKPI) || 1 : 1);
  const bgCho = readTail_(SH.BG, 'ngayTao', addDays_(t, -60)).filter(b => inScope_(sc, b.maNV) && [BG_TT.GUI, BG_TT.CAN_NHAC, BG_TT.CHO_DUYET].includes(b.trangThai)).reverse().slice(0, 40).map(b => slim_(b, ['maBG','ngayGui','ngayTao','tenKH','maKH','tongSauVAT','trangThai','hieuLucDen']));
  const bc = u.vaiTro === 'SALE' ? findOne_(SH.BCN, 'maBC', t + '_' + u.maNV) : null;
  const htCho = readTail_(SH.HT, 'ngay', addDays_(t, -180)).filter(r => (inScope_(sc, r.maNVSale) || r.nguoiTao === u.maNV) && htMine_(u, r)).reverse().slice(0, 30).map(htOut_);
  const nr = readTail_(SH.NR, 'ngay', addDays_(t, -90));
  const nrCho = ['ADMIN', 'KETOAN'].includes(u.vaiTro) ? nr.filter(r => r.trangThai === NR_TT.CHO).length : 0;
  const nrTC = nr.filter(r => r.maNV === u.maNV && r.trangThai === NR_TT.TC).length;
  const clCho = readTail_(SH.CL, 'ngay', addDays_(t, -730)).filter(r => clMine_(u, r)).length;
  return { m, tg, sc: s, bgCho, htCho, nrCho, nrTC, clCho, soNguoi: ids.length, daNopBC: !!bc, today: t };
}
function apiHome(token) { return homeLite_(auth_(token)); }
function khAll_(u) { return khScope_(u).slice(0, 8000).map(k => slim_(k, KH_SLIM)); }
function apiKHAll(token) { return { rows: khAll_(auth_(token)) }; }
/** Mở app = 1 lần gọi duy nhất: cấu hình + danh sách khách + bảng điều khiển. */
function apiStart(token) { const u = auth_(token); return { boot: apiBootstrap(token), kh: khAll_(u), home: homeLite_(u) }; }
function apiLoginStart(maNV, mk) { const s = apiLogin(maNV, mk); return Object.assign(s, apiStart(s.token)); }
const khOut_ = k => slim_(decorate_(k, today_()), KH_SLIM);

const BCN_SELF = ['s_dataTim','s_tongGoi','s_tongNhan','s_ketBanZalo','s_group','s_fb1','s_fb2','s_fb3','s_tuongTacFB','s_khoKhan','s_keHoach','s_baiHoc'];
function apiDailyGet(token) {
  const u = auth_(token), t = today_();
  const m = autoMetrics_([u.maNV], t, t)[u.maNV];
  const bc = findOne_(SH.BCN, 'maBC', t + '_' + u.maNV);
  const hist = readTail_(SH.BCN, 'ngay', addDays_(t, -20)).filter(r => r.maNV === u.maNV).reverse().slice(0, 14).map(r => slim_(r, ['ngay','diemKPI','dungHan','ql_xacNhanFB','ql_nhanXet','a_tiepCan','a_ketNoi','a_chamLai']));
  return { m, tg: kpiTargets_(), heSo: Number(u.heSoKPI) || 1, bc, hist, today: t };
}
function isUrl_(s) { return /^https?:\/\/\S+$/i.test(String(s || '').trim()); }
function apiDailySubmit(token, o) {
  const u = auth_(token), t = today_();
  o = o || {};
  ['s_fb1', 's_fb2', 's_fb3'].forEach(k => { if (String(o[k] || '').trim() && !isUrl_(o[k])) throw new Error('Link bài FB phải bắt đầu bằng http(s)://'); });
  if (!String(o.s_keHoach || '').trim()) throw new Error('Ghi kế hoạch ngày mai (KH nào cần chăm/chốt)');
  return withLock_(() => {
    const id = t + '_' + u.maNV, ex = findOne_(SH.BCN, 'maBC', id);
    const m = autoMetrics_([u.maNV], t, t)[u.maNV];
    const hour = Number(Utilities.formatDate(new Date(), APP.TZ, 'H'));
    const dungHan = ex ? ex.dungHan : (hour < thamSo_().gioHanBaoCao ? 'Đúng hạn' : 'Trễ');
    m.dungHan = dungHan === 'Đúng hạn' ? 1 : 0;
    m.fb = (ex && ex.ql_xacNhanFB === 'Không đạt') ? 0 : ['s_fb1', 's_fb2', 's_fb3'].filter(k => String(o[k] || '').trim()).length;
    const sc = score_(m, kpiTargets_(), 1, Number(u.heSoKPI) || 1);
    const rec = ex || { maBC: id, ngay: t, maNV: u.maNV, thoiGianNop: now_() };
    Object.assign(rec, { hoTen: u.hoTen, maQuanLy: u.maQuanLy, a_khMoi: m.khMoi, a_tiepCan: m.tiepCan, a_ketNoi: m.ketNoi, a_chamLai: m.chamLai, a_goi: m.goi, a_nhanTin: m.nhanTin, a_baoGia: m.baoGia, a_donChot: m.donChot, a_khQuanTam: m.khQuanTam, diemKPI: sc.diem, dungHan, capNhatLuc: now_() });
    BCN_SELF.forEach(k => { const v = o[k]; rec[k] = (k.indexOf('s_fb') === 0 || ['s_khoKhan', 's_keHoach', 's_baiHoc', 's_tuongTacFB'].includes(k)) ? String(v || '').trim() : (Number(v) || 0); });
    if (ex) update_(SH.BCN, rec); else append_(SH.BCN, rec);
    return { diem: sc.diem, dungHan };
  });
}
function apiDailyTeam(token, ngay) {
  const u = auth_(token), sc = scope_(u);
  needRole_(u, ['ADMIN', 'QUANLY']);
  ngay = ngay || today_();
  const mem = users_().filter(x => x.trangThai === 'Đang làm' && x.vaiTro !== 'ADMIN' && x.vaiTro !== 'KETOAN' && inScope_(sc, x.maNV));
  const m = autoMetrics_(mem.map(x => x.maNV), ngay, ngay), tg = kpiTargets_();
  const bc = {}; readTail_(SH.BCN, 'ngay', ngay).filter(r => r.ngay === ngay).forEach(r => bc[r.maNV] = r);
  return mem.map(x => { const r = bc[x.maNV]; const live = score_(m[x.maNV], tg, 1, Number(x.heSoKPI) || 1).diem; return { maNV: x.maNV, hoTen: x.hoTen, m: m[x.maNV], bc: r ? slim_(r, ['maBC'].concat(BCN_SELF, ['diemKPI','thoiGianNop','dungHan','ql_xacNhanFB','ql_nhanXet','ql_nguoiDuyet'])) : null, diemLive: live }; });
}
function apiDailyReview(token, maBC, xn, nx) {
  const u = auth_(token), sc = scope_(u);
  needRole_(u, ['ADMIN', 'QUANLY']);
  return withLock_(() => {
    const r = findOne_(SH.BCN, 'maBC', maBC);
    if (!r || !inScope_(sc, r.maNV)) throw new Error('Không tìm thấy báo cáo trong phạm vi quản lý');
    if (r.maNV === u.maNV && u.vaiTro !== 'ADMIN') throw new Error('Không tự duyệt báo cáo của mình');
    r.ql_xacNhanFB = xn || ''; r.ql_nhanXet = String(nx || '').trim(); r.ql_nguoiDuyet = u.maNV; r.ql_ngayDuyet = now_();
    const nv = userBy_(r.maNV);
    const m = { khMoi: Number(r.a_khMoi) || 0, tiepCan: Number(r.a_tiepCan) || 0, ketNoi: Number(r.a_ketNoi) || 0, chamLai: Number(r.a_chamLai) || 0, baoGia: Number(r.a_baoGia) || 0, goi: Number(r.a_goi) || 0, nhanTin: Number(r.a_nhanTin) || 0, khQuanTam: Number(r.a_khQuanTam) || 0, donChot: Number(r.a_donChot) || 0, dungHan: r.dungHan === 'Đúng hạn' ? 1 : 0, fb: xn === 'Không đạt' ? 0 : [r.s_fb1, r.s_fb2, r.s_fb3].filter(v => String(v || '').trim()).length };
    r.diemKPI = score_(m, kpiTargets_(), 1, nv ? Number(nv.heSoKPI) || 1 : 1).diem;
    update_(SH.BCN, r);
    return { diem: r.diemKPI };
  });
}

/* ============================ BÁO CÁO TỔNG HỢP ============================ */
const C_ = (k, label, type) => ({ k, label, type: type || 'text' });
function apiReport(token, type, p) {
  const u = auth_(token), sc = scope_(u), t = today_();
  p = p || {};
  const from = p.tuNgay || t, to = p.denNgay || t;
  if (from > to) throw new Error('Từ ngày phải trước hoặc bằng Đến ngày');
  if (diffDays_(from, to) > 400) throw new Error('Khoảng thời gian tối đa 400 ngày');
  let members = users_().filter(x => x.trangThai === 'Đang làm' && x.vaiTro !== 'ADMIN' && x.vaiTro !== 'KETOAN' && inScope_(sc, x.maNV));
  if (p.maQL) members = members.filter(x => x.maQuanLy === p.maQL || x.maNV === p.maQL);
  if (p.maNV) members = members.filter(x => x.maNV === p.maNV);
  const ids = members.map(x => x.maNV), c = { u, sc, t, from, to, members, ids, idSet: new Set(ids), toEff: to < t ? to : t };
  const R = REPORTS_[type];
  if (!R) throw new Error('Loại báo cáo không tồn tại');
  const out = R(c);
  out.ky = from === to ? from : from + ' → ' + to;
  return out;
}
function nvName_(ma) { const x = userBy_(ma); return x ? x.hoTen : ma; }
function pct_(a, b) { return b ? a / b : 0; }

const REPORTS_ = {
  tongquan(c) {
    const kh = readAll_(SH.KH).filter(k => k.maKH && c.idSet.has(k.maNV)).map(k => decorate_(k, c.t));
    const m = autoMetrics_(c.ids, c.from, c.to), S = sumM_(m), tg = kpiTargets_(), days = workDays_(c.from, c.toEff) || 1;
    const bg = readTail_(SH.BG, 'ngayTao', addDays_(c.from, -120)).filter(b => c.idSet.has(b.maNV));
    const gui = bg.filter(b => b.ngayGui >= c.from && b.ngayGui <= c.to);
    const tl = pct_(gui.filter(b => b.trangThai === BG_TT.CHOT).length, gui.length);
    return {
      title: 'Tổng quan kinh doanh',
      cards: [
        { label: 'KH đang quản lý', value: kh.length }, { label: 'KH mới trong kỳ', value: S.khMoi },
        { label: 'Tiếp cận mới', value: S.tiepCan }, { label: 'Kết nối thành công', value: S.ketNoi, note: 'tỷ lệ ' + Math.round(pct_(S.ketNoi, S.tiepCan + S.chamLai) * 100) + '%' },
        { label: 'Lượt chăm KH cũ', value: S.chamLai }, { label: 'Báo giá đã gửi', value: S.baoGia },
        { label: 'Đơn chốt', value: S.donChot, note: S.donDau + ' khách mới' }, { label: 'BG gửi trong kỳ → chốt', value: Math.round(tl * 100) + '%' },
        { label: 'KH quá hạn chăm', value: kh.filter(k => k.canhBao === 'Quá hạn').length, tone: 'bad' }, { label: 'Kho khách ngủ', value: kh.filter(k => k.giaiDoan === GD.KHO_NGU).length, tone: 'warn' },
      ],
      tables: [
        { title: 'Phễu khách hàng theo giai đoạn', cols: [C_('g', 'Giai đoạn', 'stage'), C_('n', 'Số KH', 'num'), C_('bar', 'Tỷ trọng', 'bar')], rows: GD_THU_TU.map(g => { const n = kh.filter(k => k.giaiDoan === g).length; return { g, n, bar: pct_(n, kh.length) }; }) },
        { title: 'Tổng hợp theo nhân viên (' + days + ' ngày làm việc)', cols: [C_('ten', 'Nhân viên'), C_('kh', 'KH quản lý', 'num'), C_('qh', 'Quá hạn', 'num'), C_('khMoi', 'KH mới', 'num'), C_('tiepCan', 'Tiếp cận', 'num'), C_('ketNoi', 'Kết nối', 'num'), C_('chamLai', 'Chăm cũ', 'num'), C_('baoGia', 'BG gửi', 'num'), C_('donChot', 'Đơn chốt', 'num'), C_('fb', 'Bài FB', 'num'), C_('diem', 'Điểm KPI', 'score')],
          rows: c.members.map(x => { const mm = m[x.maNV], mine = kh.filter(k => k.maNV === x.maNV); return { ten: x.hoTen, kh: mine.length, qh: mine.filter(k => k.canhBao === 'Quá hạn').length, khMoi: mm.khMoi, tiepCan: mm.tiepCan, ketNoi: mm.ketNoi, chamLai: mm.chamLai, baoGia: mm.baoGia, donChot: mm.donChot, fb: mm.fb, diem: score_(mm, tg, days, Number(x.heSoKPI) || 1).diem }; }).sort((a, b) => b.diem - a.diem) },
      ],
    };
  },
  kpi(c) {
    const m = autoMetrics_(c.ids, c.from, c.to), tg = kpiTargets_(), days = workDays_(c.from, c.toEff) || 1;
    const cols = [C_('ten', 'Nhân viên')].concat(tg.filter(t => t.ngay > 0).map(t => C_(t.maChiSo, t.tenChiSo + (t.trongSo ? ' (' + t.trongSo + '%)' : ''), 'kpi')), [C_('diem', 'Điểm', 'score'), C_('xl', 'Xếp loại', 'tag')]);
    const xl = d => d >= 100 ? 'Xuất sắc' : d >= 85 ? 'Đạt' : d >= 70 ? 'Cần cải thiện' : 'Không đạt';
    const rows = c.members.map(x => { const s = score_(m[x.maNV], tg, days, Number(x.heSoKPI) || 1), r = { ten: x.hoTen + (Number(x.heSoKPI) !== 1 && x.heSoKPI !== '' ? ' (hệ số ' + x.heSoKPI + ')' : ''), diem: s.diem, xl: xl(s.diem) }; tg.forEach(t => r[t.maChiSo] = s.det[t.maChiSo]); return r; }).sort((a, b) => b.diem - a.diem);
    return {
      title: 'KPI hoạt động', sub: 'Chỉ tiêu kỳ = chỉ tiêu ngày × ' + days + ' ngày làm việc (T2–T7, tính đến hôm nay) × hệ số KPI. Điểm = Σ min(thực tế/chỉ tiêu, 120%) × trọng số.',
      cards: [{ label: 'Ngày làm việc trong kỳ', value: days }, { label: 'Nhân viên', value: c.members.length }, { label: 'Điểm trung bình', value: rows.length ? Math.round(rows.reduce((a, r) => a + r.diem, 0) / rows.length * 10) / 10 : 0 }, { label: 'Không đạt (<70)', value: rows.filter(r => r.diem < 70).length, tone: 'bad' }],
      tables: [{ title: 'Bảng KPI theo nhân viên', cols, rows },
        { title: 'Đối chiếu tự khai và hệ thống ghi nhận (phát hiện ghi chép thiếu)', cols: [C_('ten', 'Nhân viên'), C_('goi', 'Gọi có nhật ký', 'num'), C_('s_goi', 'Gọi tự khai', 'num'), C_('nhanTin', 'Nhắn có nhật ký', 'num'), C_('s_nhan', 'Nhắn tự khai', 'num'), C_('tl', 'Tỷ lệ ghi nhật ký', 'pct'), C_('s_data', 'Data tự khai', 'num'), C_('khMoi', 'KH nhập hệ thống', 'num')],
          rows: c.members.map(x => { const mm = m[x.maNV]; return { ten: x.hoTen, goi: mm.goi, s_goi: mm.s_goi, nhanTin: mm.nhanTin, s_nhan: mm.s_nhan, tl: pct_(mm.goi + mm.nhanTin, mm.s_goi + mm.s_nhan), s_data: mm.s_data, khMoi: mm.khMoi }; }) }],
    };
  },
  chamsoc(c) {
    const logs = readTail_(SH.CS, 'ngay', c.from).filter(x => x.ngay <= c.to && c.idSet.has(x.maNV) && x.kenh !== KENH_HT);
    const by = (k) => { const o = {}; logs.forEach(x => { const v = x[k] || '(trống)'; o[v] = o[v] || { v, n: 0, ok: 0 }; o[v].n++; if (x.thanhCong === 'Có') o[v].ok++; }); return Object.values(o).sort((a, b) => b.n - a.n).map(r => ({ v: r.v, n: r.n, ok: r.ok, tl: pct_(r.ok, r.n) })); };
    const ok = logs.filter(x => x.thanhCong === 'Có').length;
    return {
      title: 'Nhật ký chăm sóc khách hàng',
      cards: [{ label: 'Tổng lượt chăm', value: logs.length }, { label: 'Kết nối được', value: ok, note: Math.round(pct_(ok, logs.length) * 100) + '%' }, { label: 'KH được chăm', value: new Set(logs.map(x => x.maKH)).size }, { label: 'Lượt KH Nóng', value: logs.filter(x => x.mucDo === 'Nóng').length }],
      tables: [
        { title: 'Theo kênh', cols: [C_('v', 'Kênh'), C_('n', 'Lượt', 'num'), C_('ok', 'Kết nối', 'num'), C_('tl', 'Tỷ lệ', 'pct')], rows: by('kenh') },
        { title: 'Theo kết quả', cols: [C_('v', 'Kết quả'), C_('n', 'Lượt', 'num'), C_('tl', 'Tỷ trọng', 'bar')], rows: by('ketQua').map(r => ({ v: r.v, n: r.n, tl: pct_(r.n, logs.length) })) },
        { title: 'Chi tiết (tối đa 2.000 dòng mới nhất)', cols: [C_('thoiGian', 'Thời gian'), C_('nv', 'Người chăm'), C_('tenKH', 'Khách hàng'), C_('kenh', 'Kênh'), C_('mucDich', 'Mục đích'), C_('ketQua', 'Kết quả'), C_('mucDo', 'Mức độ'), C_('noiDung', 'Nội dung', 'long'), C_('ngayHenTiep', 'Hẹn tiếp')], rows: logs.slice(-2000).reverse().map(x => Object.assign({}, x, { nv: nvName_(x.maNV) })) },
      ],
    };
  },
  baogia(c) {
    const bg = readTail_(SH.BG, 'ngayTao', c.from).filter(b => b.ngayTao <= c.to && c.idSet.has(b.maNV) && b.trangThai !== BG_TT.THAY_THE);
    const gui = bg.filter(b => b.ngayGui), chot = bg.filter(b => b.trangThai === BG_TT.CHOT), tc = bg.filter(b => b.trangThai === BG_TT.TU_CHOI);
    const ld = {}; tc.forEach(b => ld[b.lyDo || '(trống)'] = (ld[b.lyDo || '(trống)'] || 0) + 1);
    return {
      title: 'Báo giá',
      cards: [{ label: 'Báo giá tạo', value: bg.length }, { label: 'Đã gửi khách', value: gui.length }, { label: 'Đang chờ phản hồi', value: bg.filter(b => [BG_TT.GUI, BG_TT.CAN_NHAC].includes(b.trangThai)).length }, { label: 'Chốt đơn', value: chot.length }, { label: 'Từ chối', value: tc.length, tone: 'bad' }, { label: 'Tỷ lệ chốt / đã gửi', value: Math.round(pct_(chot.length, gui.length) * 100) + '%' }, { label: 'Giá trị BG đã gửi', value: money_(gui.reduce((a, b) => a + (Number(b.tongSauVAT) || 0), 0)) }, { label: 'Giá trị đã chốt', value: money_(chot.reduce((a, b) => a + (Number(b.tongSauVAT) || 0), 0)) }],
      tables: [
        { title: 'Theo nhân viên', cols: [C_('ten', 'Nhân viên'), C_('tao', 'Tạo', 'num'), C_('gui', 'Gửi', 'num'), C_('chot', 'Chốt', 'num'), C_('tl', 'Tỷ lệ chốt', 'pct'), C_('gt', 'Giá trị chốt', 'money')], rows: c.members.map(x => { const mine = bg.filter(b => b.maNV === x.maNV), g = mine.filter(b => b.ngayGui), ch = mine.filter(b => b.trangThai === BG_TT.CHOT); return { ten: x.hoTen, tao: mine.length, gui: g.length, chot: ch.length, tl: pct_(ch.length, g.length), gt: ch.reduce((a, b) => a + (Number(b.tongSauVAT) || 0), 0) }; }) },
        { title: 'Lý do khách từ chối', cols: [C_('v', 'Lý do'), C_('n', 'Số BG', 'num'), C_('tl', 'Tỷ trọng', 'bar')], rows: Object.keys(ld).map(k => ({ v: k, n: ld[k], tl: pct_(ld[k], tc.length) })).sort((a, b) => b.n - a.n) },
        { title: 'Danh sách báo giá', cols: [C_('maBG', 'Mã BG'), C_('ngayTao', 'Ngày tạo'), C_('tenKH', 'Khách hàng'), C_('maDon', 'Mã đơn'), C_('tomTatHang', 'Hàng', 'long'), C_('tongSauVAT', 'Tổng sau VAT', 'money'), C_('trangThai', 'Trạng thái', 'bgtt'), C_('nv', 'Sale')], rows: bg.slice().reverse().map(b => Object.assign({}, b, { nv: nvName_(b.maNV) })) },
      ],
    };
  },
  cancham(c) {
    const lim = addDays_(c.t, 3);
    const kh = readAll_(SH.KH).filter(k => k.maKH && c.idSet.has(k.maNV) && k.giaiDoan !== GD.LOAI && k.ngayHenCham && k.ngayHenCham <= lim).map(k => decorate_(k, c.t)).sort((a, b) => String(a.ngayHenCham).localeCompare(String(b.ngayHenCham)));
    return {
      title: 'Khách cần chăm (quá hạn, hôm nay, 3 ngày tới)',
      cards: [{ label: 'Quá hạn', value: kh.filter(k => k.canhBao === 'Quá hạn').length, tone: 'bad' }, { label: 'Hôm nay', value: kh.filter(k => k.canhBao === 'Hôm nay').length, tone: 'warn' }, { label: '3 ngày tới', value: kh.filter(k => k.ngayHenCham > c.t).length }],
      tables: [
        { title: 'Theo nhân viên', cols: [C_('ten', 'Nhân viên'), C_('qh', 'Quá hạn', 'num'), C_('hn', 'Hôm nay', 'num'), C_('st', '3 ngày tới', 'num'), C_('max', 'Quá hạn lâu nhất (ngày)', 'num')], rows: c.members.map(x => { const mine = kh.filter(k => k.maNV === x.maNV); return { ten: x.hoTen, qh: mine.filter(k => k.canhBao === 'Quá hạn').length, hn: mine.filter(k => k.canhBao === 'Hôm nay').length, st: mine.filter(k => k.ngayHenCham > c.t).length, max: Math.max(0, ...mine.map(k => k.soNgayQH || 0)) }; }).sort((a, b) => b.qh - a.qh) },
        { title: 'Danh sách', cols: [C_('ngayHenCham', 'Hẹn chăm'), C_('canhBao', 'Cảnh báo', 'warn'), C_('maKH', 'Mã KH'), C_('ten', 'Khách hàng'), C_('sdt', 'SĐT'), C_('giaiDoan', 'Giai đoạn', 'stage'), C_('mucDo', 'Mức độ'), C_('ketQuaGanNhat', 'Kết quả gần nhất'), C_('tenNV', 'Sale')], rows: kh.map(k => Object.assign({}, k, { ten: k.tenCongTy || k.tenLienHe })) },
      ],
    };
  },
  phieu(c) {
    const kh = readAll_(SH.KH).filter(k => k.maKH && c.idSet.has(k.maNV));
    const cols = [C_('ten', 'Nhân viên')].concat(GD_THU_TU.map((g, i) => C_('g' + i, g, 'num')), [C_('tong', 'Tổng', 'num'), C_('tl', 'Đã có đơn / tổng', 'pct')]);
    const row = (ten, list) => { const r = { ten, tong: list.length }; GD_THU_TU.forEach((g, i) => r['g' + i] = list.filter(k => k.giaiDoan === g).length); r.tl = pct_(list.filter(k => Number(k.soDon) > 0).length, list.length); return r; };
    const rows = c.members.map(x => row(x.hoTen, kh.filter(k => k.maNV === x.maNV)));
    rows.push(row('TỔNG', kh));
    return { title: 'Phễu khách hàng theo nhân viên', cards: [], tables: [{ title: 'Số khách theo giai đoạn (ảnh chụp hiện tại)', cols, rows }] };
  },
  nguon(c) {
    const kh = readAll_(SH.KH).filter(k => k.maKH && c.idSet.has(k.maNV) && k.ngayTao >= c.from && k.ngayTao <= c.to);
    const grp = (key) => { const o = {}; kh.forEach(k => { const v = k[key] || '(trống)'; o[v] = o[v] || { v, n: 0, tc: 0, bg: 0, don: 0 }; o[v].n++; if (GD_THU_TU.indexOf(k.giaiDoan) >= 1 && k.giaiDoan !== GD.LOAI) o[v].tc++; if (Number(k.soBaoGia) > 0) o[v].bg++; if (Number(k.soDon) > 0) o[v].don++; }); return Object.values(o).map(r => Object.assign(r, { tl: pct_(r.don, r.n) })).sort((a, b) => b.n - a.n); };
    const cols = (t) => [C_('v', t), C_('n', 'KH mới', 'num'), C_('tc', 'Đã tiếp cận', 'num'), C_('bg', 'Có báo giá', 'num'), C_('don', 'Có đơn', 'num'), C_('tl', 'Tỷ lệ ra đơn', 'pct')];
    return { title: 'Hiệu quả nguồn và chân dung khách', sub: 'Tính trên khách được tạo trong kỳ.', cards: [{ label: 'KH tạo trong kỳ', value: kh.length }, { label: 'Đã có đơn', value: kh.filter(k => Number(k.soDon) > 0).length }],
      tables: [{ title: 'Theo nguồn', cols: cols('Nguồn'), rows: grp('nguonKH') }, { title: 'Theo loại khách', cols: cols('Loại KH'), rows: grp('loaiKH') }, { title: 'Theo hình thức nhập khẩu', cols: cols('Hình thức'), rows: grp('hinhThucNK') }, { title: 'Theo ngành hàng', cols: cols('Ngành'), rows: grp('nganhHang') }] };
  },
  fb(c) {
    const rs = readTail_(SH.BCN, 'ngay', c.from).filter(r => r.ngay <= c.to && c.idSet.has(r.maNV));
    const days = workDays_(c.from, c.toEff) || 1;
    const tong = rs.reduce((a, r) => a + [r.s_fb1, r.s_fb2, r.s_fb3].filter(v => String(v || '').trim()).length, 0);
    return {
      title: 'Bài đăng Facebook chính ngạch',
      cards: [{ label: 'Tổng bài khai báo', value: tong }, { label: 'Chỉ tiêu kỳ', value: 2 * days * c.members.length }, { label: 'Đã xác nhận Đạt', value: rs.filter(r => r.ql_xacNhanFB === 'Đạt').length + ' ngày' }, { label: 'Bị đánh Không đạt', value: rs.filter(r => r.ql_xacNhanFB === 'Không đạt').length + ' ngày', tone: 'bad' }],
      tables: [
        { title: 'Theo nhân viên', cols: [C_('ten', 'Nhân viên'), C_('bai', 'Số bài', 'num'), C_('ct', 'Chỉ tiêu', 'num'), C_('tl', 'Đạt', 'pct'), C_('tt', 'Tương tác thu về')], rows: c.members.map(x => { const mine = rs.filter(r => r.maNV === x.maNV); const bai = mine.reduce((a, r) => a + (r.ql_xacNhanFB === 'Không đạt' ? 0 : [r.s_fb1, r.s_fb2, r.s_fb3].filter(v => String(v || '').trim()).length), 0); return { ten: x.hoTen, bai, ct: 2 * days, tl: pct_(bai, 2 * days), tt: mine.map(r => r.s_tuongTacFB).filter(String).join('; ').slice(0, 200) }; }) },
        { title: 'Chi tiết link', cols: [C_('ngay', 'Ngày'), C_('hoTen', 'Nhân viên'), C_('s_fb1', 'Bài 1', 'link'), C_('s_fb2', 'Bài 2', 'link'), C_('s_fb3', 'Bài 3', 'link'), C_('s_tuongTacFB', 'Tương tác'), C_('ql_xacNhanFB', 'QL xác nhận')], rows: rs.slice().reverse() },
      ],
    };
  },
  nopbaocao(c) {
    const days = []; let d = c.from; while (d <= c.toEff && days.length < 31) { if (dow_(d) !== 0) days.push(d); d = addDays_(d, 1); }
    const rs = {}; readTail_(SH.BCN, 'ngay', c.from).filter(r => r.ngay <= c.to).forEach(r => rs[r.maNV + '|' + r.ngay] = r);
    const cols = [C_('ten', 'Nhân viên')].concat(days.map(x => C_(x, x.slice(8) + '/' + x.slice(5, 7), 'mark')), [C_('du', 'Đã nộp', 'num'), C_('tre', 'Trễ', 'num'), C_('thieu', 'Thiếu', 'num'), C_('tb', 'Điểm TB', 'score')]);
    const rows = c.members.map(x => { const r = { ten: x.hoTen, du: 0, tre: 0, thieu: 0 }; let sum = 0; days.forEach(dd => { const b = rs[x.maNV + '|' + dd]; if (!b) { r[dd] = 'x'; r.thieu++; } else { r[dd] = b.dungHan === 'Đúng hạn' ? 'ok' : 'late'; r.du++; if (b.dungHan !== 'Đúng hạn') r.tre++; sum += Number(b.diemKPI) || 0; } }); r.tb = r.du ? Math.round(sum / r.du * 10) / 10 : 0; return r; });
    return { title: 'Tình trạng nộp báo cáo ngày', sub: '✓ đúng hạn · ⏱ trễ · ✗ thiếu (hiển thị tối đa 31 ngày làm việc)', cards: [{ label: 'Lượt thiếu báo cáo', value: rows.reduce((a, r) => a + r.thieu, 0), tone: 'bad' }, { label: 'Lượt nộp trễ', value: rows.reduce((a, r) => a + r.tre, 0), tone: 'warn' }], tables: [{ title: 'Ma trận nộp báo cáo', cols, rows }] };
  },
  giukhach(c) {
    const kh = readAll_(SH.KH).filter(k => k.maKH && c.idSet.has(k.maNV) && Number(k.soDon) > 0).map(k => decorate_(k, c.t));
    const act = kh.filter(k => k.ngayDonGanNhat && diffDays_(k.ngayDonGanNhat, c.t) <= thamSo_().ngayKhoNgu);
    const mua2 = kh.filter(k => Number(k.soDon) >= 2);
    return {
      title: 'Giữ khách và mua lại', sub: 'Khách đang hoạt động = có đơn trong ' + thamSo_().ngayKhoNgu + ' ngày gần nhất. Mục tiêu giữ khách > 80%.',
      cards: [{ label: 'Khách đã có đơn', value: kh.length }, { label: 'Đang hoạt động', value: act.length }, { label: 'Tỷ lệ giữ khách', value: Math.round(pct_(act.length, kh.length) * 100) + '%', tone: pct_(act.length, kh.length) >= 0.8 ? 'ok' : 'bad' }, { label: 'Tỷ lệ mua lại (≥2 đơn)', value: Math.round(pct_(mua2.length, kh.length) * 100) + '%' }, { label: 'Kho khách ngủ', value: kh.filter(k => k.giaiDoan === GD.KHO_NGU).length, tone: 'warn' }, { label: 'Mất khách', value: kh.filter(k => k.giaiDoan === GD.MAT).length, tone: 'bad' }],
      tables: [
        { title: 'Theo nhân viên', cols: [C_('ten', 'Nhân viên'), C_('co', 'KH có đơn', 'num'), C_('act', 'Hoạt động', 'num'), C_('tl', 'Tỷ lệ giữ', 'pct'), C_('m2', 'Mua lại', 'num'), C_('ngu', 'Kho ngủ', 'num')], rows: c.members.map(x => { const mine = kh.filter(k => k.maNV === x.maNV), a = mine.filter(k => act.includes(k)); return { ten: x.hoTen, co: mine.length, act: a.length, tl: pct_(a.length, mine.length), m2: mine.filter(k => Number(k.soDon) >= 2).length, ngu: mine.filter(k => k.giaiDoan === GD.KHO_NGU).length }; }) },
        { title: 'Khách có nguy cơ (lâu nhất chưa có đơn)', cols: [C_('maKH', 'Mã KH'), C_('ten', 'Khách hàng'), C_('ngayDonGanNhat', 'Đơn gần nhất'), C_('songay', 'Số ngày', 'num'), C_('soDon', 'Số đơn', 'num'), C_('giaiDoan', 'Giai đoạn', 'stage'), C_('tenNV', 'Sale')], rows: kh.map(k => Object.assign({}, k, { ten: k.tenCongTy || k.tenLienHe, songay: diffDays_(k.ngayDonGanNhat, c.t) })).sort((a, b) => b.songay - a.songay).slice(0, 300) },
      ],
    };
  },
  naprut(c) {
    const rs = readTail_(SH.NR, 'ngay', c.from).filter(r => r.ngay <= c.to && (c.idSet.has(r.maNV)));
    const sum = a => a.reduce((x, r) => x + (Number(r.soTien) || 0), 0);
    const f = (l, tt) => rs.filter(r => r.loai === l && r.trangThai === tt);
    const tk = {}; rs.filter(r => r.trangThai === NR_TT.OK).forEach(r => { const k = r.tkCongTy || '(trống)'; tk[k] = tk[k] || { v: k, nap: 0, rut: 0 }; if (r.loai === 'Nạp tiền') tk[k].nap += Number(r.soTien) || 0; else tk[k].rut += Number(r.soTien) || 0; });
    return { title: 'Nạp / rút tiền', sub: 'Số đã xác nhận do kế toán chốt. Chờ kế toán là sale đã báo nhưng chưa đối chiếu.',
      cards: [{ label: 'Nạp đã xác nhận', value: money_(sum(f('Nạp tiền', NR_TT.OK))), tone: 'ok' }, { label: 'Rút đã chi', value: money_(sum(f('Rút tiền', NR_TT.OK))) }, { label: 'Nạp chờ kế toán', value: money_(sum(f('Nạp tiền', NR_TT.CHO))), tone: 'warn' }, { label: 'Rút chờ kế toán', value: money_(sum(f('Rút tiền', NR_TT.CHO))), tone: 'warn' }, { label: 'Bị từ chối', value: rs.filter(r => r.trangThai === NR_TT.TC).length, tone: 'bad' }],
      tables: [
        { title: 'Theo nhân viên', cols: [C_('ten', 'Nhân viên'), C_('nap', 'Nạp xác nhận', 'money'), C_('rut', 'Rút đã chi', 'money'), C_('cho', 'Đang chờ (giao dịch)', 'num'), C_('tc', 'Từ chối', 'num')], rows: c.members.map(x => { const m = rs.filter(r => r.maNV === x.maNV); return { ten: x.hoTen, nap: sum(m.filter(r => r.loai === 'Nạp tiền' && r.trangThai === NR_TT.OK)), rut: sum(m.filter(r => r.loai === 'Rút tiền' && r.trangThai === NR_TT.OK)), cho: m.filter(r => r.trangThai === NR_TT.CHO).length, tc: m.filter(r => r.trangThai === NR_TT.TC).length }; }) },
        { title: 'Theo tài khoản công ty (đã xác nhận)', cols: [C_('v', 'Tài khoản'), C_('nap', 'Nạp', 'money'), C_('rut', 'Rút', 'money')], rows: Object.values(tk) },
        { title: 'Chi tiết', cols: [C_('thoiGian', 'Tạo lúc'), C_('maGD', 'Mã'), C_('loai', 'Loại'), C_('nv', 'Sale'), C_('tenKH', 'Khách'), C_('maDon', 'Mã đơn'), C_('soTien', 'Số tiền', 'money'), C_('noiDungCK', 'Nội dung CK', 'long'), C_('trangThai', 'Trạng thái'), C_('maThamChieu', 'Mã tham chiếu')], rows: rs.slice().reverse().map(r => Object.assign({}, r, { nv: nvName_(r.maNV) })) },
      ] };
  },
  hotro(c) {
    const rs = readTail_(SH.HT, 'ngay', c.from).filter(r => r.ngay <= c.to && c.idSet.has(r.maNVSale));
    const tds = r => { try { return JSON.parse(r.traoDoi || '[]'); } catch (e) { return []; } };
    const phanHoi = rs.filter(r => r.loai === 'Sale nhờ hỗ trợ').map(r => { const x = tds(r).find(d => d.by !== r.maNVSale); return x ? hours_(r.thoiGian, x.t) : null; }).filter(v => v !== null && isFinite(v));
    const grp = k => { const o = {}; rs.forEach(r => { const v = r[k] || '(trống)'; o[v] = o[v] || { v, n: 0, mo: 0 }; o[v].n++; if (r.trangThai !== HT_TT.XONG) o[v].mo++; }); return Object.values(o).sort((a, b) => b.n - a.n); };
    return {
      title: 'Hỗ trợ và chỉ đạo theo khách', sub: 'Sale nhờ hỗ trợ: bóng ở quản lý. Quản lý chỉ đạo: bóng ở sale. Thời gian phản hồi tính đến câu trả lời đầu tiên của quản lý.',
      cards: [{ label: 'Tổng yêu cầu', value: rs.length }, { label: 'Chờ quản lý', value: rs.filter(r => r.trangThai === HT_TT.CHO_QL).length, tone: 'warn' }, { label: 'Chờ sale', value: rs.filter(r => r.trangThai === HT_TT.CHO_SALE).length, tone: 'warn' }, { label: 'Đã xong', value: rs.filter(r => r.trangThai === HT_TT.XONG).length, tone: 'ok' }, { label: 'Phản hồi TB (giờ)', value: phanHoi.length ? Math.round(phanHoi.reduce((a, b) => a + b, 0) / phanHoi.length * 10) / 10 : '—' }],
      tables: [
        { title: 'Theo nhân viên', cols: [C_('ten', 'Nhân viên'), C_('nho', 'Nhờ hỗ trợ', 'num'), C_('cd', 'Nhận chỉ đạo', 'num'), C_('mo', 'Đang mở', 'num')], rows: c.members.map(x => { const m = rs.filter(r => r.maNVSale === x.maNV); return { ten: x.hoTen, nho: m.filter(r => r.loai === 'Sale nhờ hỗ trợ').length, cd: m.filter(r => r.loai === 'Quản lý chỉ đạo').length, mo: m.filter(r => r.trangThai !== HT_TT.XONG).length }; }) },
        { title: 'Theo chủ đề', cols: [C_('v', 'Chủ đề'), C_('n', 'Số yêu cầu', 'num'), C_('mo', 'Đang mở', 'num')], rows: grp('chuDe') },
        { title: 'Chi tiết', cols: [C_('thoiGian', 'Tạo lúc'), C_('loai', 'Loại'), C_('tenKH', 'Khách hàng'), C_('sale', 'Sale'), C_('chuDe', 'Chủ đề'), C_('noiDung', 'Nội dung', 'long'), C_('trangThai', 'Trạng thái'), C_('ketQua', 'Kết quả', 'long')], rows: rs.slice().reverse().map(r => Object.assign({}, r, { sale: nvName_(r.maNVSale) })) },
      ],
    };
  },
  trungkhht(c) {
    const kh = readAll_(SH.KH).filter(k => k.maKH && c.idSet.has(k.maNV) && k.trungKHHT).map(k => decorate_(k, c.t));
    return { title: 'Trùng khách đang chạy của công ty', sub: 'Đối chiếu với danh sách khách đang chạy Admin cập nhật hằng tháng. "Đang chạy" = có đơn trong ' + thamSo_().ngayKHHTHoatDong + ' ngày: sale bị khóa chăm sóc, Admin xử lý (chuyển cho người phụ trách hoặc chuyển "Không tiềm năng").',
      cards: [{ label: 'Đang chạy (bị khóa)', value: kh.filter(k => k.trungKHHT === KHHT.DANG).length, tone: 'bad' }, { label: 'Khách cũ đã ngủ', value: kh.filter(k => k.trungKHHT === KHHT.NGU).length, tone: 'warn' }],
      tables: [{ title: 'Danh sách', cols: [C_('trungKHHT', 'Tình trạng'), C_('maKH', 'Mã KH'), C_('ten', 'Khách hàng'), C_('sdt', 'SĐT'), C_('giaiDoan', 'Giai đoạn', 'stage'), C_('soDon', 'Đơn qua CRM', 'num'), C_('tenNV', 'Sale'), C_('ngayTao', 'Tạo ngày')], rows: kh.map(k => Object.assign({}, k, { ten: k.tenCongTy || k.tenLienHe })) }] };
  },
  chuyenkh(c) {
    const rs = readTail_(SH.CHUYEN, 'thoiGian', c.from).filter(r => String(r.thoiGian).slice(0, 10) <= c.to && (c.idSet.has(r.tuNV) || c.idSet.has(r.denNV)));
    return { title: 'Lịch sử chuyển khách', sub: 'Mọi lần chuyển đều được ghi: khách nào, từ ai, cho ai, ngày nào, lý do (Sổ tay 8.5).', cards: [{ label: 'Lượt chuyển', value: rs.length }],
      tables: [{ title: 'Chi tiết', cols: [C_('thoiGian', 'Thời gian'), C_('maKH', 'Mã KH'), C_('tenKH', 'Khách hàng'), C_('tu', 'Từ'), C_('den', 'Sang'), C_('lyDo', 'Lý do', 'long'), C_('nguoiThucHien', 'Người thực hiện')], rows: rs.reverse().map(r => Object.assign({}, r, { tu: nvName_(r.tuNV), den: nvName_(r.denNV) })) }] };
  },
};

/* ============================ QUẢN TRỊ NHÂN SỰ ============================ */
function apiUsers(token) {
  const u = auth_(token), sc = scope_(u);
  needRole_(u, ['ADMIN', 'QUANLY']);
  return readAll_(SH.NS).filter(x => x.maNV && inScope_(sc, x.maNV)).map(x => Object.assign(pubUser_(x), { ngayVao: x.ngayVao, heSoKPI: x.heSoKPI }));
}
function apiSaveUser(token, o) {
  const u = auth_(token);
  needRole_(u, ['ADMIN']);
  o = o || {};
  const ma = String(o.maNV || '').trim().toUpperCase();
  if (!/^[A-Z0-9_]{2,15}$/.test(ma)) throw new Error('Mã NV 2–15 ký tự, chỉ gồm chữ không dấu, số, gạch dưới');
  if (!String(o.hoTen || '').trim()) throw new Error('Nhập họ tên');
  if (!VAI_TRO.includes(o.vaiTro)) throw new Error('Chọn vai trò');
  if (o.maQuanLy && !userBy_(o.maQuanLy)) throw new Error('Mã quản lý không tồn tại');
  if (o.maQuanLy === ma) throw new Error('Không tự làm quản lý của chính mình');
  return withLock_(() => {
    let r = findOne_(SH.NS, 'maNV', ma);
    if (o.isNew && r) throw new Error('Mã NV đã tồn tại');
    if (!r) { if (String(o.matKhauMoi || '').length < 6) throw new Error('Nhân viên mới cần mật khẩu ≥ 6 ký tự'); r = { maNV: ma, ngayTao: today_() }; }
    Object.assign(r, { hoTen: String(o.hoTen).trim(), email: String(o.email || '').trim().toLowerCase(), sdt: normPhone_(o.sdt), vaiTro: o.vaiTro, maQuanLy: o.maQuanLy || '', capBac: o.capBac || '', trangThai: o.trangThai || 'Đang làm', ngayVao: o.ngayVao || '', heSoKPI: Number(o.heSoKPI) || 1 });
    if (String(o.matKhauMoi || '').length) { if (o.matKhauMoi.length < 6) throw new Error('Mật khẩu tối thiểu 6 ký tự'); r.matKhauHash = hash_(o.matKhauMoi); }
    if (r._row) update_(SH.NS, r); else append_(SH.NS, r);
    cClear_();
    return { maNV: ma };
  });
}

/** Logo Nam Trung (PNG, nhúng sẵn để bản in và PDF luôn hiện logo). */
const LOGO_NT_B64 = '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';

/* ===== Thư viện vẽ QR: QR Code Generator for JavaScript — Copyright (c) 2009 Kazuhiko Arase — MIT license (giữ nguyên bản quyền) ===== */
//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\u0020width="';
      img += size;
      img += '"';
      img += '\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(row * cellSize, col * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();

// multibyte support
!function() {

  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
    function toUTF8Array(str) {
      var utf8 = [];
      for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
              0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
            | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return utf8;
    }
    return toUTF8Array(s);
  };

}();


/* ======================================================================
 * [ERP] PHẦN NỐI CRM VÀO ERP — KHÔNG SỬA LOGIC CRM, CHỈ THAY 6 ĐIỂM:
 *  1. File dữ liệu: mở file CRM đã kết nối (DB_CRM) thay vì SS_ID
 *  2. Đăng nhập: dùng tài khoản ERP (cùng mật khẩu, cùng phiên với ERP)
 *  3. Vai trò: Admin ERP = ADMIN CRM, Kế toán ERP = KETOAN CRM; còn lại theo tab NHAN_SU của CRM
 *  4. Đổi mật khẩu: đổi mật khẩu ERP
 *  5. Số thứ tự mã (KH, CS, BG, HT, NAP/RUT, CL): lần đầu chạy tự tiếp nối số lớn nhất đang có
 *  6. Trả thêm erpUrl để giao diện CRM có nút quay về ERP
 * ====================================================================== */
ss_ = function () {
  if (SS_CACHE_) return SS_CACHE_;
  const id = PropertiesService.getScriptProperties().getProperty('DB_CRM');
  if (!id) throw new Error('Chưa kết nối file dữ liệu CRM. Admin mở file điều khiển → menu Nam Trung ERP → ① Kết nối.');
  SS_CACHE_ = SpreadsheetApp.openById(id);
  ensureSchema_(SS_CACHE_);
  return SS_CACHE_;
};
const SEQ_SRC_ = { SEQ_KH: ['KHACH_HANG', 'maKH', /^KH(\d+)$/], SEQ_CS: ['NHAT_KY_CHAM_SOC', 'maCS', /^CS(\d+)$/], SEQ_HT: ['HO_TRO', 'maHT', /^HT(\d+)$/],
  SEQ_NR: ['NAP_RUT', 'maGD', /^(?:NAP|RUT)(\d+)$/], SEQ_CL: ['CLAIM', 'maCL', /^CL(\d+)$/] };
function seqMaxFromData_(key) {
  let src = SEQ_SRC_[key];
  const bg = key.match(/^SEQ_BG_(\d{4})$/);
  if (bg) src = ['BAO_GIA', 'maBG', new RegExp('^BG' + bg[1] + '-(\\d+)$')];
  if (!src) return 0;
  const s = sh_(src[0]), ci = COLS[src[0]].indexOf(src[1]) + 1, n = s.getLastRow() - 1;
  if (n < 1 || ci < 1) return 0;
  let mx = 0;
  s.getRange(2, ci, n, 1).getValues().forEach(r => { const m = String(r[0]).match(src[2]); if (m) mx = Math.max(mx, Number(m[1])); });
  return mx;
}
seq_ = function (key, pad) {
  const p = PropertiesService.getScriptProperties();
  let cur = p.getProperty(key);
  if (cur === null) cur = String(seqMaxFromData_(key));        // lần đầu trong ERP: tiếp nối dữ liệu cũ, không trùng mã
  const n = Number(cur) + 1;
  p.setProperty(key, String(n));
  return String(n).padStart(pad, '0');
};
/** Mã CRM của một nhân sự ERP: mã cũ trong CRM nếu đã ghép, không thì mã NV ERP */
function crmCodeOf_(emp) {
  const m = String(emp.legacy_codes || '').match(/crm:([A-Za-z0-9_]+)/);
  if (m) return m[1].toUpperCase();
  const em = String(emp.email_work || '').toLowerCase(), ph = normPhone_(emp.phone);
  const hit = users_().find(x => (em && String(x.email || '').toLowerCase() === em) || (ph && normPhone_(x.sdt) === ph));
  return hit ? hit.maNV : emp.employee_code;
}
auth_ = function (token) {
  let ctx;
  try { REQ_ = REQ_ || {}; ctx = Auth.ctx(token); } catch (e) { throw new Error('PHIEN_HET_HAN'); }
  const code = crmCodeOf_(ctx.emp);
  const base = userBy_(code);
  if (base && base.trangThai === 'Đang làm') {
    const u = Object.assign({}, base);
    if (ctx.isAdmin) u.vaiTro = 'ADMIN';
    return u;
  }
  const v = { maNV: code, hoTen: ctx.emp.full_name, email: ctx.emp.email_work || '', sdt: ctx.emp.phone || '', maQuanLy: '', capBac: '', trangThai: 'Đang làm', ngayVao: ctx.emp.hire_date || '', heSoKPI: 1 };
  if (ctx.isAdmin) return Object.assign(v, { vaiTro: 'ADMIN' });
  if (ctx.roles.indexOf('accountant') >= 0) return Object.assign(v, { vaiTro: 'KETOAN' });
  throw new Error('Bạn chưa được cấp quyền dùng CRM. Nhờ Admin thêm bạn ở mục Nhân sự trong CRM với mã ' + code + '.');
};
apiLogin = function (maNV, mk) {
  REQ_ = {};
  const r = api('auth.login', null, { username: maNV, password: mk });
  if (!r.ok) throw new Error(r.error.message);
  return { token: r.data.token, user: pubUser_(auth_(r.data.token)) };
};
apiAutoLogin = function () { return null; };
apiLogout = function (token) { Auth.logout(token); return true; };
apiDoiMatKhau = function (token, cu, moi) {
  const r = api('auth.changePassword', token, { oldPassword: cu, newPassword: moi });
  if (!r.ok) throw new Error(r.error.message);
  return true;
};
const apiBootstrapCrm_ = apiBootstrap;
apiBootstrap = function (token) {
  const b = apiBootstrapCrm_(token);
  try { b.erpUrl = ScriptApp.getService().getUrl() || ''; } catch (e) { b.erpUrl = ''; }
  return b;
};
const apiSaveUserCrm_ = apiSaveUser;
apiSaveUser = function (token, o) {
  // Mật khẩu quản lý ở ERP: nhân viên mới trong CRM không cần mật khẩu riêng
  o = Object.assign({}, o || {});
  if (!String(o.matKhauMoi || '').length && o.isNew) o.matKhauMoi = Utilities.getUuid();
  return apiSaveUserCrm_(token, o);
};
return {
  API: { apiLogin: function () { return apiLogin.apply(null, arguments); }, apiAutoLogin: function () { return apiAutoLogin.apply(null, arguments); }, apiLogout: function () { return apiLogout.apply(null, arguments); }, apiDoiMatKhau: function () { return apiDoiMatKhau.apply(null, arguments); }, apiBootstrap: function () { return apiBootstrap.apply(null, arguments); }, apiListKH: function () { return apiListKH.apply(null, arguments); }, apiKHGon: function () { return apiKHGon.apply(null, arguments); }, apiGetKH: function () { return apiGetKH.apply(null, arguments); }, apiSaveKH: function () { return apiSaveKH.apply(null, arguments); }, apiChuyenKH: function () { return apiChuyenKH.apply(null, arguments); }, apiAddCare: function () { return apiAddCare.apply(null, arguments); }, apiSaveBG: function () { return apiSaveBG.apply(null, arguments); }, apiGuiBG: function () { return apiGuiBG.apply(null, arguments); }, apiDuyetBG: function () { return apiDuyetBG.apply(null, arguments); }, apiSetBGStatus: function () { return apiSetBGStatus.apply(null, arguments); }, apiGetBG: function () { return apiGetBG.apply(null, arguments); }, apiListBG: function () { return apiListBG.apply(null, arguments); }, apiBGHtml: function () { return apiBGHtml.apply(null, arguments); }, apiBGPdf: function () { return apiBGPdf.apply(null, arguments); }, apiCheckTrung: function () { return apiCheckTrung.apply(null, arguments); }, apiKHHTInfo: function () { return apiKHHTInfo.apply(null, arguments); }, apiImportKHHT: function () { return apiImportKHHT.apply(null, arguments); }, apiHTCreate: function () { return apiHTCreate.apply(null, arguments); }, apiHTGet: function () { return apiHTGet.apply(null, arguments); }, apiHTReply: function () { return apiHTReply.apply(null, arguments); }, apiHTList: function () { return apiHTList.apply(null, arguments); }, apiNRSave: function () { return apiNRSave.apply(null, arguments); }, apiNRList: function () { return apiNRList.apply(null, arguments); }, apiNRConfirm: function () { return apiNRConfirm.apply(null, arguments); }, apiNRReopen: function () { return apiNRReopen.apply(null, arguments); }, apiNRCancel: function () { return apiNRCancel.apply(null, arguments); }, apiCLCreate: function () { return apiCLCreate.apply(null, arguments); }, apiCLList: function () { return apiCLList.apply(null, arguments); }, apiCLGet: function () { return apiCLGet.apply(null, arguments); }, apiCLReply: function () { return apiCLReply.apply(null, arguments); }, apiCLPublic: function () { return apiCLPublic.apply(null, arguments); }, apiHome: function () { return apiHome.apply(null, arguments); }, apiKHAll: function () { return apiKHAll.apply(null, arguments); }, apiStart: function () { return apiStart.apply(null, arguments); }, apiLoginStart: function () { return apiLoginStart.apply(null, arguments); }, apiDailyGet: function () { return apiDailyGet.apply(null, arguments); }, apiDailySubmit: function () { return apiDailySubmit.apply(null, arguments); }, apiDailyTeam: function () { return apiDailyTeam.apply(null, arguments); }, apiDailyReview: function () { return apiDailyReview.apply(null, arguments); }, apiReport: function () { return apiReport.apply(null, arguments); }, apiUsers: function () { return apiUsers.apply(null, arguments); }, apiSaveUser: function () { return apiSaveUser.apply(null, arguments); } },
  menuKhoiTao: menuKhoiTao, menuKHHT: menuKHHT, menuSaoLuu: menuSaoLuu, menuKiemTraQR: menuKiemTraQR, jobHangNgay: jobHangNgay,
  users: () => users_(), userBy: ma => userBy_(ma), codeOf: crmCodeOf_, sheet: name => sh_(name), cols: name => COLS[name], schema: SCHEMA, clearCache: () => cClear_(), hashCrm: s => hash_(s)
};
}
