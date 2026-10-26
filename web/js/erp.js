/* GIAO DIỆN ERP (nhân sự, chấm công, lương, quản trị) + khung chung cho phần bán hàng */
(function () {

window.__NT_OK = true;
let START = '';
function readStart(){
  return new Promise(res => {
    try { google.script.url.getLocation(l => { START = (l && l.parameter && l.parameter.p) || ''; res(); }); }
    catch (e) { res(); }
  });
}
const S = { token: load('ntl_t'), view: 'board', bp: 'all', f: null, repTab: 'sum', scoreSort: 'vang' };
const NAV = [
  { id: 'board',   label: 'Hôm nay',      short: 'Hôm nay', ic: '☀️' },
  { id: 'cc',      label: 'Chấm công',    short: 'Chấm công', ic: '📸', test: () => S.me.chamCong || can(['HCNS']) },
  { id: 'new',     label: 'Xin nghỉ',     short: 'Xin nghỉ', ic: '✍️' },
  { id: 'approve', label: 'Duyệt đơn',    short: 'Duyệt', ic: '✅', roles: ['QL', 'ADMIN'] },
  { id: 'mine',    label: 'Đơn của tôi',  short: 'Của tôi', ic: '🗂️' },
  { id: 'pay',     label: 'Trả lương',    short: 'Trả lương', ic: '💸', roles: ['KETOAN', 'ADMIN'] },
  { id: 'report',  label: 'Bảng công',    short: 'Bảng công', ic: '🧾', roles: ['KETOAN', 'HCNS', 'ADMIN'] },
  { id: 'score',   label: 'Chuyên cần',   short: 'Chuyên cần', ic: '📈', roles: ['HCNS', 'ADMIN'] },
  { id: 'slip',    label: 'Phiếu lương',  short: 'Phiếu lương', ic: '🧧' },
  { id: 'admin',   label: 'Quản trị',     short: 'Quản trị', ic: '🛡️', roles: ['ADMIN'] }
];
const AVC = ['#FFD23F', '#2ED8A3', '#7CC8FF', '#FF9EAD', '#B9AEFF', '#FFB86B'];
const TH = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/* ---------- tiện ích ---------- */
function load(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
function save(k, v){ try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch(e){} }
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const pd = k => { const p = String(k).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
const kd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dShort = k => { if (!k) return ''; const d = pd(k); return TH[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); };
const dLong = k => { const d = pd(k); return ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][d.getDay()] + ', ' + d.getDate() + '/' + (d.getMonth() + 1); };
const tagTxt = x => x.nhan.replace(/\s*\(.*\)$/, '').replace(/\s*\d{1,2}:\d{2}.*$/, '');
const num = n => (Math.round(Number(n) * 10) / 10).toLocaleString('vi-VN');
const initials = t => String(t || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const avColor = t => { let h = 0; for (const ch of String(t)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AVC[h % AVC.length]; };
const av = (t, sm) => `<span class="av${sm ? ' sm' : ''}" style="--c:${avColor(t)}" aria-hidden="true">${esc(initials(t))}</span>`;
let busyN = 0;
function busy(d){ busyN += d; $('#bar').classList.toggle('on', busyN > 0); }
function toast(msg, err){ const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), err ? 6000 : 3200); }
/* ---------- CỔNG GỌI MÁY CHỦ DUY NHẤT ----------
 * Giai đoạn 1: google.script.run.api(route, token, payload)
 * Giai đoạn 2 (server riêng): chỉ đổi thân hàm Api.call thành fetch('/api/' + route, ...) */
const ROUTE = {
  apiLogin: ['auth.login', ['username', 'password'], true], apiLogout: ['auth.logout', []], apiChangePass: ['auth.changePassword', ['oldPassword', 'newPassword']],
  apiBootstrap: ['app.bootstrap', []], apiBoard: ['hr.absence.board', []],
  apiPreview: ['hr.leave.preview', '$'], apiSubmit: ['hr.leave.submit', '$'], apiMine: ['hr.leave.mine', []], apiCancel: ['hr.leave.cancel', ['id']],
  apiApprovals: ['hr.leave.pending', []], apiDecide: ['hr.leave.decide', ['id', 'action', 'note']],
  apiReport: ['rpt.hr.monthly', ['month']], apiAttendance: ['rpt.hr.attendanceScore', ['year']],
  apiPunch: ['att.punch', '$'], apiMyAttendance: ['att.mine', ['month']], apiAttendanceDay: ['att.day', ['day']], apiPhoto: ['att.photo', ['id']],
  apiManualPunch: ['att.manual', '$'], apiSetOfficeIP: ['att.setOfficeIp', ['ip', 'replace']],
  apiPayroll: ['pay.list', ['month', 'recalc']], apiMarkPaid: ['pay.markPaid', ['month', 'code', 'paid']], apiLockPayroll: ['pay.lock', ['month']], apiMyPayslips: ['pay.mySlips', []]
};
const Api = {
  call(route, payload, token) {
    return new Promise((res, rej) => {
      busy(1);
      google.script.run
        .withSuccessHandler(r => {
          busy(-1);
          if (r && r.ok) return res(r.data);
          const e = (r && r.error) || { code: 'ERROR', message: 'Lỗi không xác định' };
          if (e.code === 'UNAUTHENTICATED') { logout(true); return rej(new Error('Phiên đăng nhập đã hết, đăng nhập lại nhé.')); }
          const err = new Error(e.message); err.code = e.code; rej(err);
        })
        .withFailureHandler(e => { busy(-1); rej(new Error(String((e && e.message) || e).replace(/^(Exception|Error):\s*/, ''))); })
        .api(route, token === undefined ? S.token : token, payload || {});
    });
  }
};
function call(fn, ...args){
  const m = ROUTE[fn];
  if (!m) return Promise.reject(new Error('Thiếu route cho ' + fn));
  if (m[2]) { const p = {}; m[1].forEach((k, i) => p[k] = args[i]); return Api.call(m[0], p, null); }
  const rest = args.slice(1); let p = {};
  if (m[1] === '$') p = rest[0] || {}; else m[1].forEach((k, i) => p[k] = rest[i]);
  return Api.call(m[0], p, args[0]);
}
const can = roles => !roles || roles.indexOf(S.me.role) >= 0 || S.me.role === 'ADMIN';
const navOk = n => can(n.roles) && (!n.test || n.test());
const vnd = n => (Math.round(Number(n) || 0)).toLocaleString('vi-VN') + ' đ';
function fmtRange(v){
  if (v.tuGio) return dShort(v.tu) + ', ' + v.tuGio + '–' + v.denGio;
  if (v.tu === v.den) return dShort(v.tu) + (v.tuBuoi === 'Sáng' && v.denBuoi === 'Chiều' ? ' (cả ngày)' : ' (' + (v.tuBuoi || '').toLowerCase() + ')');
  return dShort(v.tu) + (v.tuBuoi === 'Chiều' ? ' (chiều)' : '') + ' → ' + dShort(v.den) + (v.denBuoi === 'Sáng' ? ' (sáng)' : '');
}
function stClass(t){ return t.indexOf('Chờ') === 0 ? 'cho' : t === 'Đã duyệt' ? 'ok' : t === 'Từ chối' ? 'no' : t === 'Xin hủy' ? 'xh' : 'huy'; }

/* ---------- đăng nhập ---------- */
function renderLogin(err){
  parkCrm();
  $('#root').innerHTML = `
  <div class="login">
    <section class="art">
      <div class="floaty" aria-hidden="true">
        <article class="stk k-off"><span class="av" style="--c:#FFD23F">LK</span><div class="who"><b>Linh KD</b><span>Kinh doanh</span></div><div class="tagrow"><span class="tag t1">Nghỉ phép</span><span class="tag t2">Cả ngày</span></div></article>
        <article class="stk k-out"><span class="av" style="--c:#2ED8A3">HK</span><div class="who"><b>Hùng Kho</b><span>Kho</span></div><div class="tagrow"><span class="tag t1">Công tác</span><span class="tag t2">Sáng</span></div></article>
      </div>
      <h1>Ai vắng hôm nay?</h1>
      <p>Xin nghỉ trong 30 giây. Cả công ty biết ai vắng để sắp việc, còn lý do nghỉ thì chỉ người duyệt thấy.</p>
    </section>
    <form id="fLogin" autocomplete="on">
      <h2>Đăng nhập</h2>
      <div class="field"><label for="lMa">Mã nhân viên</label><input id="lMa" type="text" autocomplete="username" placeholder="VD: NT012" required></div>
      <div class="field"><label for="lPw">Mật khẩu</label><input id="lPw" type="password" autocomplete="current-password" required></div>
      ${err ? `<p class="pv e" role="alert">${esc(err)}</p>` : ''}
      <button class="btn" style="width:100%" id="lBtn">Đăng nhập</button>
      <p class="hint">Quên mật khẩu? Nhắn HCNS để được cấp lại.</p>
    </form>
  </div>`;
  $('#fLogin').onsubmit = async e => {
    e.preventDefault();
    const b = $('#lBtn'); b.disabled = true; b.innerHTML = '<span class="spin"></span>';
    try { const r = await call('apiLogin', $('#lMa').value, $('#lPw').value); S.token = r.token; save('ntl_t', r.token); boot(); }
    catch (er) { renderLogin(er.message); }
  };
}
function logout(silent){
  parkCrm(); if (window.CRMX) window.CRMX.reset();
  if (S.token && !silent) call('apiLogout', S.token).catch(() => {});
  S.token = null; save('ntl_t', null); renderLogin();
}

/* ---------- khung ---------- */
async function boot(){
  if (!S.token) return renderLogin();
  $('#root').innerHTML = '<main><div class="skel"></div></main>';
  try {
    const b = await call('apiBootstrap', S.token);
    Object.assign(S, b);
    await readStart();
    S.crmNav = [];
    const ids = navItems().map(n => n.id);
    getIP();
    shell();
    go(ids.indexOf(START) >= 0 ? START : 'board');
    initCrm();
    if (S.me.mustChange) passModal(true);
  } catch (e) { if (S.token) renderLogin(e.message); }
}
function shell(){
  parkCrm();
  const items = navItems();
  const pri = ['board', 'cc', 'crm:kh', 'crm:home', 'new', 'crm:nr'].filter(id => items.some(n => n.id === id)).slice(0, 4);
  const bottomItems = items.length > 5 ? pri.map(id => items.find(n => n.id === id)).concat([{ id: 'more', short: 'Thêm', ic: '☰' }]) : items;
  const moreItems = items.filter(n => bottomItems.indexOf(n) < 0);
  const badge = id => id === 'approve' && S.pending ? S.pending : 0;
  $('#root').innerHTML = `
  <div class="app">
    <nav class="rail" aria-label="Menu">
      <div class="brand">nt.team<small>${esc(S.cfg.ten)}</small></div>
      ${items.map(n => `${n.grp ? `<div class="grp">${n.grp}</div>` : ''}<button class="nav" data-go="${n.id}"><span class="ic">${n.ic}</span>${n.label}${badge(n.id) ? `<span class="badge">${badge(n.id)}</span>` : ''}</button>`).join('')}
      <div class="grow"></div>
      <div class="me">${av(S.me.ten, true)}<div><b>${esc(S.me.ten)}</b><span>${esc(S.me.boPhan)}</span></div><button title="Tài khoản" data-act="acct">⚙️</button></div>
    </nav>
    <div>
      <header class="topbar"><div class="brand">nt.team</div><button data-act="acct">${esc(S.me.ten)}</button></header>
      <main id="erpView"></main><section id="crmSlot" hidden></section>
    </div>
    <nav class="bottom" aria-label="Menu">
      ${bottomItems.map(n => `<button ${n.id === 'more' ? 'data-act="more"' : `data-go="${n.id}"`}><span class="ic">${n.ic}</span>${n.short}${badge(n.id) ? `<span class="dot">${badge(n.id)}</span>` : ''}</button>`).join('')}
    </nav>
  </div>`;
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  placeCrm();
  document.querySelectorAll('[data-act="acct"]').forEach(b => b.onclick = acctModal);
  document.querySelectorAll('[data-act="more"]').forEach(b => b.onclick = () => {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="card" role="dialog" aria-modal="true" aria-label="Thêm"><div class="list">${moreItems.map(n => `<button class="nav" data-go2="${n.id}"><span class="ic">${n.ic}</span>${n.label}</button>`).join('')}</div></div>`;
    document.body.appendChild(m);
    m.onclick = e => { const g = e.target.closest('[data-go2]'); if (g) { m.remove(); go(g.dataset.go2); } else if (e.target === m) m.remove(); };
  });
}
function go(v){
  S.view = v;
  const isCrm = String(v).indexOf('crm:') === 0;
  document.querySelector('.app') && document.querySelector('.app').classList.toggle('crm-on', isCrm);
  const slot = document.getElementById('crmSlot'); if (slot) slot.hidden = !isCrm;
  document.querySelectorAll('[data-go]').forEach(b => { if (b.dataset.go === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  window.scrollTo(0, 0);
  if (isCrm) { if (window.CRMX) window.CRMX.go(v.slice(4)); return; }
  document.querySelectorAll('[data-go]').forEach(b => { if (b.dataset.go === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  window.scrollTo(0, 0);
  ({ board: viewBoard, new: viewNew, mine: viewMine, approve: viewApprove, report: viewReport, score: viewScore, cc: viewCC, pay: viewPay, slip: viewSlip, admin: viewAdmin })[v]();
}
const V = html => { $('#erpView').innerHTML = html; };
const skel = () => V('<div class="skel"></div><div class="skel" style="margin-top:16px;height:80px"></div>');

/* ---------- HÔM NAY ---------- */
async function viewBoard(){
  if (!S.board) skel();
  try { S.board = await call('apiBoard', S.token); } catch (e) { return V(`<div class="empty"><b>Chưa tải được lịch</b>${esc(e.message)}</div>`); }
  if (S.view === 'board') drawBoard();
}
function drawBoard(){
  const d = S.board, today = d.today;
  const f = S.bp === 'all' ? d.entries : d.entries.filter(x => x.boPhan === S.bp);
  const tday = pd(today); let nx = new Date(tday); nx.setDate(nx.getDate() + 1); if (nx.getDay() === 0) nx.setDate(nx.getDate() + 1);
  const kNx = kd(nx);
  const tNow = f.filter(x => x.d === today), tNext = f.filter(x => x.d === kNx), later = f.filter(x => x.d > kNx);
  const off = tNow.filter(x => x.kind === 'off' && !x.cho);
  const uniq = a => [...new Set(a.map(x => x.ma))].length;
  const outN = uniq(tNow.filter(x => x.kind !== 'off' && !x.cho));
  const head = uniq(off) ? `${uniq(off)} người nghỉ hôm nay` : 'Hôm nay đủ quân';
  const sub = [outN ? `${outN} người đi công tác, làm từ xa hoặc ra ngoài.` : '', tNext.length ? `${dShort(kNx)} có ${uniq(tNext)} người báo vắng.` : `${dShort(kNx)} chưa ai báo vắng.`].join(' ');
  const card = x => `<article class="stk k-${x.kind}${x.cho ? ' pending' : ''}">
      ${x.cho ? '<span class="pend">chờ duyệt</span>' : ''}${av(x.ten)}
      <div class="who"><b>${esc(x.ten)}</b><span>${esc(x.boPhan)}</span></div>
      <div class="tagrow"><span class="tag t1">${esc(tagTxt(x))}</span><span class="tag t2">${esc(x.buoi)}</span></div>
      ${x.hoTro ? `<div class="ht">Cần gấp tìm <b>${esc(x.hoTro)}</b></div>` : ''}</article>`;
  const byDay = {}; later.forEach(x => (byDay[x.d] = byDay[x.d] || []).push(x));
  V(`
    ${punchStrip()}
    <p class="muted" style="margin:0;font-weight:600">${dLong(today)}</p>
    <h1>${head}</h1>
    <p class="sub">${esc(sub)}</p>
    <div class="chips" role="group" aria-label="Lọc bộ phận">
      ${['all', ...d.boPhan].map(b => `<button class="chip" data-bp="${esc(b)}" aria-pressed="${S.bp === b}">${b === 'all' ? 'Tất cả' : esc(b)}</button>`).join('')}
    </div>
    ${tNow.length ? `<div class="stickers">${tNow.map(card).join('')}</div>` : `<div class="allin">Không ai vắng${S.bp === 'all' ? '' : ' ở ' + esc(S.bp)}. Ngày làm việc trọn vẹn 🙌</div>`}
    <h2>${dShort(kNx)}</h2>
    ${tNext.length ? `<div class="stickers">${tNext.map(card).join('')}</div>` : '<p class="muted">Chưa ai báo vắng.</p>'}
    <h2>Những ngày tới</h2>
    ${Object.keys(byDay).length ? `<div class="timeline">${Object.keys(byDay).map(k => `
      <div class="tl"><div class="d"><b>${pd(k).getDate()}/${pd(k).getMonth() + 1}</b><span>${TH[pd(k).getDay()]}</span></div>
      <div class="pills">${byDay[k].map(x => `<span class="pill${x.cho ? ' pending' : ''}">${av(x.ten, true)}${esc(x.ten)} <i>${esc(x.buoi)}${x.kind !== 'off' ? ', ' + esc(tagTxt(x).toLowerCase()) : ''}${x.cho ? ', chờ duyệt' : ''}</i></span>`).join('')}</div></div>`).join('')}</div>`
      : `<p class="muted">Chưa có lịch vắng trong ${S.cfg.soNgay} ngày tới.</p>`}
    <div class="legend"><span class="l1">Nghỉ</span><span class="l2">Công tác, làm từ xa</span><span class="l3">Vắng theo giờ</span><span class="l4">Đơn chờ duyệt</span></div>
  `);
  document.querySelectorAll('[data-bp]').forEach(b => b.onclick = () => { S.bp = b.dataset.bp; drawBoard(); });
  bindPunch();
}

/* ---------- XIN NGHỈ ---------- */
function newForm(){
  const t = kd(new Date());
  return { maNV: '', loai: (S.types.find(x => x.ma === 'PN') || S.types[0] || {}).ma, tuNgay: t, denNgay: t, tuBuoi: 'Sáng', denBuoi: 'Chiều', tuGio: '08:00', denGio: '10:00', lyDo: '', hoTro: '', banGiao: '' };
}
function viewNew(){
  if (!S.f) S.f = newForm();
  const f = S.f, hr = ['HCNS', 'ADMIN'].indexOf(S.me.role) >= 0;
  V(`
    <h1>Xin nghỉ</h1>
    <p class="sub">Lịch chung chỉ hiện tên, buổi vắng và người hỗ trợ. Lý do chỉ quản lý duyệt và HCNS thấy.</p>
    <div class="split">
      <form class="card" id="fNew" novalidate>
        ${hr ? `<div class="field"><label for="iMa">Tạo đơn cho</label><select id="iMa" data-f="maNV"><option value="">Chính tôi</option>${S.people.filter(p => p.ma !== S.me.ma).map(p => `<option value="${esc(p.ma)}" ${f.maNV === p.ma ? 'selected' : ''}>${esc(p.ten)} (${esc(p.boPhan)})</option>`).join('')}</select><p class="hint">Đơn tạo hộ được duyệt ngay. Dùng để ghi nhận nghỉ không phép hoặc báo nghỉ qua điện thoại.</p></div>` : ''}
        <div class="field"><span class="lbl" id="lbLoai">Loại</span>
          <div class="types" role="radiogroup" aria-labelledby="lbLoai">${S.types.map(t => `<label><input type="radio" name="loai" value="${esc(t.ma)}" ${f.loai === t.ma ? 'checked' : ''}><span>${esc(t.ten)}</span></label>`).join('')}</div>
          <p class="hint" id="tNote"></p>
        </div>
        <div id="when"></div>
        <div class="field"><label for="iLy">Lý do</label><textarea id="iLy" data-f="lyDo" placeholder="VD: Đưa con đi khám, về quê có việc gia đình...">${esc(f.lyDo)}</textarea>
          <p class="lock">🔒 Riêng tư. Đồng nghiệp không nhìn thấy dòng này.</p></div>
        <div class="field"><label for="iHt">Khi bạn vắng, việc gấp tìm ai?</label><select id="iHt" data-f="hoTro"><option value="">Chưa chọn</option>${S.people.filter(p => p.ma !== S.me.ma).map(p => `<option value="${esc(p.ma)}" ${f.hoTro === p.ma ? 'selected' : ''}>${esc(p.ten)} (${esc(p.boPhan)})</option>`).join('')}</select></div>
        <div class="field"><label for="iBg">Bàn giao (không bắt buộc)</label><textarea id="iBg" data-f="banGiao" placeholder="Đơn đang chạy, khách cần gọi lại, giấy tờ cần nộp...">${esc(f.banGiao)}</textarea></div>
        <button class="btn" id="bSend">Gửi đơn</button>
      </form>
      <aside>
        ${balCard()}
        <div class="pv" id="pv" aria-live="polite"><span class="muted">Chọn ngày để xem số công.</span></div>
      </aside>
    </div>`);
  drawWhen();
  const form = $('#fNew');
  form.addEventListener('input', e => {
    const k = e.target.dataset.f;
    if (k) { f[k] = e.target.value; if (k === 'maNV') { schedule(); } else if (k !== 'lyDo' && k !== 'banGiao') schedule(); }
    if (e.target.name === 'loai') { f.loai = e.target.value; drawWhen(); schedule(); }
  });
  form.onsubmit = submitNew;
  schedule();
}
function balCard(){
  const b = S.bal;
  if (!b) return `<div class="bal"><div class="big">–</div><p style="opacity:.75;margin:10px 0 0">Chưa có quỹ phép. HCNS cần kiểm tra ngày vào làm của bạn.</p></div>`;
  return `<div class="bal"><div class="big">${num(b.conLai)}<small>ngày phép còn lại</small></div>
    <dl><dt>Được hưởng năm nay</dt><dd>${num(b.duocHuong)}</dd><dt>Tồn năm trước</dt><dd>${num(b.ton)}</dd>
    ${b.dieuChinh ? `<dt>Điều chỉnh</dt><dd>${num(b.dieuChinh)}</dd>` : ''}<dt>Đã dùng</dt><dd>${num(b.daDung)}</dd><dt>Đang chờ duyệt</dt><dd>${num(b.dangCho)}</dd><dt>Tích lũy đến nay</dt><dd>${num(b.tichLuy)}</dd></dl>
    ${S.me.thuViec ? '<p style="opacity:.75;font-size:13px;margin:12px 0 0">Đang thử việc: phép tích lũy, dùng được khi lên chính thức.</p>' : ''}</div>`;
}
function drawWhen(){
  const f = S.f, t = S.types.find(x => x.ma === f.loai) || {};
  $('#tNote').textContent = [t.ghiChu, t.baoTruoc ? `Cần báo trước ${t.baoTruoc} ngày.` : ''].filter(Boolean).join(' ');
  const seg = (name, val, opts) => `<div class="seg" role="group">${opts.map(o => `<button type="button" data-seg="${name}" data-v="${o[0]}" aria-pressed="${val === o[0]}">${o[1]}</button>`).join('')}</div>`;
  let html;
  if (t.donVi === 'GIO') {
    html = `<div class="field"><label for="iTu">Ngày</label><input type="date" id="iTu" data-f="tuNgay" value="${f.tuNgay}">${quick()}</div>
      <div class="field row2"><div><label class="lbl" for="iG1">Từ</label><input type="time" id="iG1" data-f="tuGio" value="${f.tuGio}" step="900"></div><div><label class="lbl" for="iG2">Đến</label><input type="time" id="iG2" data-f="denGio" value="${f.denGio}" step="900"></div></div>`;
  } else {
    const same = f.tuNgay === f.denNgay;
    const mode = f.tuBuoi === 'Sáng' && f.denBuoi === 'Chiều' ? 'full' : f.tuBuoi === 'Sáng' ? 'am' : 'pm';
    html = `<div class="field row2"><div><label class="lbl" for="iTu">Từ ngày</label><input type="date" id="iTu" data-f="tuNgay" value="${f.tuNgay}"></div>
      <div><label class="lbl" for="iDen">Đến ngày</label><input type="date" id="iDen" data-f="denNgay" value="${f.denNgay}" min="${f.tuNgay}"></div></div>
      ${quick()}
      <div class="field" style="margin-top:14px">${same
        ? `<span class="lbl">Buổi</span>${seg('one', mode, [['full', 'Cả ngày'], ['am', 'Sáng'], ['pm', 'Chiều']])}`
        : `<div class="row2"><div><span class="lbl">Bắt đầu từ buổi</span>${seg('tuBuoi', f.tuBuoi, [['Sáng', 'Sáng'], ['Chiều', 'Chiều']])}</div><div><span class="lbl">Nghỉ đến hết buổi</span>${seg('denBuoi', f.denBuoi, [['Sáng', 'Sáng'], ['Chiều', 'Chiều']])}</div></div>`}</div>`;
  }
  $('#when').innerHTML = html;
  $('#when').querySelectorAll('[data-seg]').forEach(b => b.onclick = () => {
    const n = b.dataset.seg, v = b.dataset.v;
    if (n === 'one') { f.tuBuoi = v === 'pm' ? 'Chiều' : 'Sáng'; f.denBuoi = v === 'am' ? 'Sáng' : 'Chiều'; } else f[n] = v;
    drawWhen(); schedule();
  });
  $('#when').querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
    const d = new Date(); d.setDate(d.getDate() + Number(b.dataset.q));
    f.tuNgay = f.denNgay = kd(d); drawWhen(); schedule();
  });
  $('#when').querySelectorAll('input[type=date]').forEach(i => i.onchange = () => {
    f[i.dataset.f] = i.value;
    if (i.dataset.f === 'tuNgay' && (!f.denNgay || f.denNgay < f.tuNgay || t.donVi === 'GIO')) f.denNgay = f.tuNgay;
    drawWhen(); schedule();
  });
}
const quick = () => `<div class="quick"><button type="button" data-q="0">Hôm nay</button><button type="button" data-q="1">Ngày mai</button><button type="button" data-q="2">Ngày kia</button></div>`;
let pvT;
function schedule(){ clearTimeout(pvT); pvT = setTimeout(preview, 450); }
function payload(){ const f = Object.assign({}, S.f); if (!f.lyDo) f.lyDo = '...'; return f; }
async function preview(){
  if (S.view !== 'new') return;
  try {
    const r = await call('apiPreview', S.token, payload());
    const pv = $('#pv'); if (!pv) return;
    const t = S.types.find(x => x.ma === S.f.loai) || {};
    const amt = t.donVi === 'GIO' ? `${num(r.soGio)} giờ` : `${num(r.soNgay)} ngày công`;
    const errs = r.errs.filter(e => e.indexOf('Ghi lý do') < 0);
    pv.innerHTML = `<div class="n">= ${amt}</div>
      ${r.days.length > 1 ? `<div class="muted" style="font-size:13px">${r.days.map(x => dShort(x.k) + (x.buoi !== 'Cả ngày' ? ' ' + x.buoi.toLowerCase() : '')).join(', ')}</div>` : ''}
      ${t.truPhep && S.bal && !errs.length ? `<div class="muted" style="font-size:13px;margin-top:4px">Sau đơn này còn ${num(S.bal.conLai - r.soNgay)} ngày phép</div>` : ''}
      ${errs.length || r.warns.length ? `<ul>${errs.map(e => `<li class="e">${esc(e)}</li>`).join('')}${r.warns.map(w => `<li class="w">${esc(w)}</li>`).join('')}</ul>` : ''}`;
  } catch (e) { const pv = $('#pv'); if (pv) pv.innerHTML = `<span class="e">${esc(e.message)}</span>`; }
}
async function submitNew(e){
  e.preventDefault();
  const b = $('#bSend'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Đang gửi';
  try {
    const r = await call('apiSubmit', S.token, S.f);
    toast(r.status === 'Đã duyệt' ? `Đã ghi nhận ${r.id}` : `Đã gửi đơn ${r.id}. Quản lý sẽ nhận email.`);
    S.f = null; S.board = null;
    refreshMeta(); go('mine');
  } catch (er) { toast(er.message, true); b.disabled = false; b.textContent = 'Gửi đơn'; }
}
async function refreshMeta(){ try { const m = await call('apiBootstrap', S.token); S.bal = m.bal; S.pending = m.pending; updBadges(); } catch (e) {} }
function updBadges(){
  document.querySelectorAll('[data-go="approve"]').forEach(b => {
    const old = b.querySelector('.badge,.dot'); if (old) old.remove();
    if (S.pending) b.insertAdjacentHTML('beforeend', `<span class="${b.classList.contains('nav') ? 'badge' : 'dot'}">${S.pending}</span>`);
  });
}

/* ---------- ĐƠN CỦA TÔI ---------- */
async function viewMine(){
  skel();
  let list; try { list = await call('apiMine', S.token); } catch (e) { return V(`<div class="empty"><b>Chưa tải được</b>${esc(e.message)}</div>`); }
  if (S.view !== 'mine') return;
  const today = kd(new Date());
  V(`<h1>Đơn của tôi</h1><p class="sub">Đơn chờ duyệt hủy được ngay. Đơn đã duyệt mà chưa tới ngày thì gửi yêu cầu hủy để quản lý xác nhận.</p>
    ${list.length ? `<div class="list">${list.map(v => `
      <article class="req">
        <header><span class="t">${esc(v.tenLoai)}</span>${v.baoGap ? '<span class="flag">báo gấp</span>' : ''}<span class="st ${stClass(v.tt)}">${esc(v.tt)}</span></header>
        <div class="meta">${fmtRange(v)}${v.soNgay ? `, ${num(v.soNgay)} ngày` : v.soGio ? `, ${num(v.soGio)} giờ` : ''}. Mã ${esc(v.no || v.id)}, gửi ${esc(v.tao.slice(8, 10) + '/' + v.tao.slice(5, 7))}</div>
        ${v.lyDo ? `<div class="why"><b>Lý do</b>${esc(v.lyDo)}</div>` : ''}
        ${v.ghiChu ? `<div class="why"><b>Phản hồi</b>${esc(v.ghiChu)}</div>` : ''}
        ${(v.tt.indexOf('Chờ') === 0 || (v.tt === 'Đã duyệt' && (v.tu > today || S.me.role === 'ADMIN'))) ? `<div class="acts"><button class="btn ghost sm" data-cancel="${esc(v.id)}">${v.tt === 'Đã duyệt' && S.me.role !== 'ADMIN' ? 'Xin hủy đơn' : 'Hủy đơn'}</button></div>` : ''}
      </article>`).join('')}</div>`
      : `<div class="empty"><b>Chưa có đơn nào</b>Khi cần nghỉ, bấm Xin nghỉ.</div>`}`);
  document.querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => {
    if (!confirm('Hủy đơn ' + b.dataset.cancel + '?')) return;
    b.disabled = true;
    try { const r = await call('apiCancel', S.token, b.dataset.cancel); toast(r.tt === 'Xin hủy' ? 'Đã gửi yêu cầu hủy' : 'Đã hủy đơn'); S.board = null; refreshMeta(); viewMine(); }
    catch (e) { toast(e.message, true); b.disabled = false; }
  });
}

/* ---------- DUYỆT ---------- */
async function viewApprove(){
  skel();
  let items; try { items = await call('apiApprovals', S.token); } catch (e) { return V(`<div class="empty"><b>Chưa tải được</b>${esc(e.message)}</div>`); }
  if (S.view !== 'approve') return;
  S.pending = items.length; updBadges();
  V(`<h1>Duyệt đơn</h1><p class="sub">${items.length ? `${items.length} đơn đang chờ bạn.` : ''} Từ chối cần ghi lý do để nhân viên biết cần làm gì.</p>
    ${items.length ? `<div class="list">${items.map(v => `
      <article class="req" id="r-${esc(v.id)}">
        <header>${av(v.ten, true)}<span class="t">${esc(v.ten)}</span><span class="muted">${esc(v.boPhan)}</span>
          ${v.tt === 'Xin hủy' ? '<span class="flag ceo">xin hủy đơn đã duyệt</span>' : ''}${v.baoGap ? '<span class="flag">báo gấp</span>' : ''}${v.needCEO && v.tt !== 'Xin hủy' ? '<span class="flag ceo">cần CEO</span>' : ''}
          <span class="st ${stClass(v.tt)}">${esc(v.tt)}</span></header>
        <div class="meta"><b style="color:var(--ink)">${esc(v.tenLoai)}</b>: ${fmtRange(v)}${v.soNgay ? `, ${num(v.soNgay)} ngày` : v.soGio ? `, ${num(v.soGio)} giờ` : ''}</div>
        <div class="why"><b>Lý do 🔒</b>${esc(v.lyDo)}</div>
        ${v.banGiao ? `<div class="why"><b>Bàn giao</b>${esc(v.banGiao)}</div>` : ''}
        ${v.hoTro ? `<div class="meta">Người hỗ trợ: ${esc(v.hoTro)}</div>` : '<div class="warn">Chưa chọn người hỗ trợ khi vắng.</div>'}
        ${v.bal ? `<div class="meta">Quỹ phép còn ${num(v.bal.conLai)} ngày (đã trừ đơn này và các đơn đang chờ).</div>` : ''}
        ${(v.warn || []).map(w => `<div class="warn">${esc(w)}</div>`).join('')}
        ${v.ghiChu ? `<div class="why"><b>Ghi chú trước</b>${esc(v.ghiChu)}</div>` : ''}
        <div class="acts"><input type="text" placeholder="Ghi chú (bắt buộc khi từ chối)" data-note="${esc(v.id)}" aria-label="Ghi chú">
          <button class="btn ok sm" data-dec="approve" data-id="${esc(v.id)}">${v.tt === 'Xin hủy' ? 'Đồng ý hủy' : 'Duyệt'}</button>
          <button class="btn bad sm" data-dec="reject" data-id="${esc(v.id)}">${v.tt === 'Xin hủy' ? 'Giữ đơn' : 'Từ chối'}</button></div>
      </article>`).join('')}</div>`
      : `<div class="empty"><b>Hết đơn rồi</b>Không còn đơn nào chờ bạn duyệt.</div>`}`);
  document.querySelectorAll('[data-dec]').forEach(b => b.onclick = async () => {
    const id = b.dataset.id, note = document.querySelector(`[data-note="${id}"]`).value;
    b.parentElement.querySelectorAll('button').forEach(x => x.disabled = true);
    try {
      const r = await call('apiDecide', S.token, id, b.dataset.dec, note);
      toast(id + ': ' + r.tt);
      const el = $('#r-' + id); if (el) el.remove();
      S.pending = Math.max(0, S.pending - 1); updBadges(); S.board = null;
      if (!document.querySelector('.req')) viewApprove();
    } catch (e) { toast(e.message, true); b.parentElement.querySelectorAll('button').forEach(x => x.disabled = false); }
  });
}

/* ---------- CHẤM CÔNG ---------- */
function curMonth(){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
async function viewReport(month){
  month = month || (S.rep && S.rep.month) || curMonth();
  V(`<h1>Bảng công</h1><p class="sub">Chỉ tính đơn đã duyệt. Đầu mỗi tháng hệ thống tự chốt tháng trước, khóa sửa đơn và gửi file cho kế toán.</p>
    <div class="toolbar"><input type="month" id="iMon" value="${month}" aria-label="Tháng">
      <div class="tabs" role="group"><button data-tab="sum" aria-pressed="${S.repTab === 'sum'}">Tổng hợp</button><button data-tab="grid" aria-pressed="${S.repTab === 'grid'}">Bảng công ngày</button></div>
      <button class="btn ghost sm" id="bCsv">Tải CSV</button><button class="btn ghost sm" id="bCopy">Sao chép sang Excel</button></div>
    <div id="rep"><div class="skel"></div></div>`);
  $('#iMon').onchange = e => viewReport(e.target.value);
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { S.repTab = b.dataset.tab; document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-pressed', x === b)); drawRep(); });
  $('#bCsv').onclick = () => exportRep('csv');
  $('#bCopy').onclick = () => exportRep('copy');
  try { S.rep = await call('apiReport', S.token, month); } catch (e) { return $('#rep').innerHTML = `<div class="empty"><b>Chưa tải được</b>${esc(e.message)}</div>`; }
  if (S.view === 'report') drawRep();
}
function repMatrix(){
  const r = S.rep;
  if (S.repTab === 'sum') return [r.head, ...r.rows.map(x => x.map(v => typeof v === 'number' ? Math.round(v * 10) / 10 : v))];
  return [['MaNV', 'Họ tên', 'Nhóm', ...r.days.map((d, i) => d ? d + ' ' + r.wd[i] : '').filter(Boolean)], ...r.grid.map(g => g.slice(0, 3 + r.days.filter(Boolean).length))];
}
function drawRep(){
  const r = S.rep, box = $('#rep'); if (!box || !r) return;
  if (!r.rows.length) { box.innerHTML = '<div class="empty"><b>Tháng này chưa có nhân sự</b>Kiểm tra ngày vào làm trong tab NHAN_SU.</div>'; return; }
  if (S.repTab === 'sum') {
    const tot = i => r.rows.reduce((s, x) => s + (Number(x[i]) || 0), 0);
    box.innerHTML = `<div class="facts"><div><b>${r.rows.length}</b><span>nhân sự</span></div><div><b>${num(tot(5))}</b><span>ngày phép năm</span></div><div><b>${num(tot(9) + tot(10))}</b><span>ngày không lương, không phép</span></div><div><b>${num(tot(18))}</b><span>đơn báo gấp</span></div></div>
    <div class="tbl-wrap"><table><thead><tr>${r.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
    ${r.rows.map(x => `<tr>${x.map((v, i) => `<td class="${typeof v === 'number' && !v ? 'z' : ''}${i === 16 ? ' hl' : ''}">${typeof v === 'number' ? num(v) : esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  } else {
    const n = r.days.filter(Boolean).length;
    const cls = v => 'c-' + String(v).split(/[\s/]/)[0].replace('Ô', 'O');
    box.innerHTML = `<p class="hint" style="margin:0 0 10px">x đi làm, x/2 nửa ngày, P phép năm, H việc riêng có lương, Ô ốm, TS thai sản, KL không lương, KP không phép, CT công tác, WFH từ xa, L lễ. "/2" là nửa buổi.</p>
    <div class="tbl-wrap"><table class="grid"><thead><tr><th>Mã</th><th>Họ tên</th><th>Nhóm</th>${r.days.slice(0, n).map((d, i) => `<th class="${r.wd[i] === 'CN' ? 'we' : ''}">${esc(d)}<br>${esc(r.wd[i])}</th>`).join('')}</tr></thead>
    <tbody>${r.grid.map(g => `<tr><td>${esc(g[0])}</td><td>${esc(g[1])}</td><td>${esc(g[2])}</td>${g.slice(3, 3 + n).map(v => `<td class="${v ? cls(v) : ''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
}
function exportRep(kind){
  if (!S.rep) return;
  const m = repMatrix();
  if (kind === 'csv') {
    const csv = '﻿' + m.map(r => r.map(v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = `ChamCong_${S.rep.month}_${S.repTab === 'sum' ? 'TongHop' : 'BangCong'}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { toast('Trình duyệt chặn tải file. Dùng nút Sao chép sang Excel.', true); }
  } else {
    const tsv = m.map(r => r.map(v => String(v == null ? '' : v).replace(/\t|\n/g, ' ')).join('\t')).join('\n');
    const ta = document.createElement('textarea'); ta.value = tsv; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    toast(ok ? 'Đã sao chép. Mở Excel và dán (Ctrl+V).' : 'Không sao chép được, hãy dùng Tải CSV.', !ok);
  }
}

/* ---------- CHUYÊN CẦN ---------- */
async function viewScore(year){
  year = year || (S.att && S.att.year) || new Date().getFullYear();
  const y0 = new Date().getFullYear();
  V(`<h1>Chuyên cần</h1><p class="sub">Phép năm, việc riêng có lương và thai sản là quyền lợi, không bị trừ điểm. Điểm chỉ trừ khi nghỉ không lương, không phép, đi muộn và báo gấp.</p>
    <div class="toolbar"><select id="iYear" aria-label="Năm">${[y0, y0 - 1, y0 - 2].map(y => `<option ${y === Number(year) ? 'selected' : ''}>${y}</option>`).join('')}</select>
    <div class="tabs" role="group"><button data-sort="vang" aria-pressed="${S.scoreSort === 'vang'}">Vắng nhiều nhất</button><button data-sort="diem" aria-pressed="${S.scoreSort === 'diem'}">Điểm thấp nhất</button></div></div>
    <div id="att"><div class="skel"></div></div>`);
  $('#iYear').onchange = e => viewScore(e.target.value);
  document.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { S.scoreSort = b.dataset.sort; document.querySelectorAll('[data-sort]').forEach(x => x.setAttribute('aria-pressed', x === b)); drawScore(); });
  try { S.att = await call('apiAttendance', S.token, year); } catch (e) { return $('#att').innerHTML = `<div class="empty"><b>Chưa tải được</b>${esc(e.message)}</div>`; }
  if (S.view === 'score') drawScore();
}
function drawScore(){
  const a = S.att, box = $('#att'); if (!box || !a) return;
  if (!a.rows.length) { box.innerHTML = '<div class="empty"><b>Chưa có dữ liệu</b></div>'; return; }
  const rows = a.rows.slice().sort((x, y) => S.scoreSort === 'diem' ? x[23] - y[23] : y[15] - x[15]);
  const heat = v => { const n = Number(v) || 0; const c = n === 0 ? 'transparent' : n < 1.5 ? 'var(--sun-t)' : n < 3 ? 'var(--sun)' : 'var(--coral)'; return `<span class="heat" style="background:${c};${n >= 3 ? 'color:#fff' : ''}">${n ? num(n) : '·'}</span>`; };
  const sc = v => `<span class="score" style="background:${v >= 95 ? 'var(--mint)' : v >= 85 ? 'var(--sky)' : v >= 70 ? 'var(--sun)' : 'var(--coral)'}">${num(v)}</span>`;
  const top = a.rows.slice().sort((x, y) => y[15] - x[15])[0], low = a.rows.slice().sort((x, y) => x[23] - y[23])[0];
  const avg = a.rows.reduce((s, x) => s + (Number(x[15]) || 0), 0) / a.rows.length;
  box.innerHTML = `<div class="facts"><div><b>${num(avg)}</b><span>ngày vắng trung bình mỗi người</span></div>
    <div><b>${esc(top[1])}</b><span>vắng nhiều nhất, ${num(top[15])} ngày</span></div><div><b>${esc(low[1])}</b><span>điểm thấp nhất, ${num(low[23])}</span></div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Mã</th><th>Họ tên</th><th>Bộ phận</th>${a.head.slice(3, 15).map(h => `<th>${esc(h)}</th>`).join('')}<th>Tổng vắng</th><th>Phép</th><th>KL</th><th>KP</th><th>Ốm</th><th>Lần muộn</th><th>Báo gấp</th><th>Điểm</th><th>Xếp loại</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td style="text-align:left">${esc(r[2])}</td>${r.slice(3, 15).map(heat).map(h => `<td>${h}</td>`).join('')}
      <td class="hl">${num(r[15])}</td>${r.slice(16, 22).map(v => `<td class="${!Number(v) ? 'z' : ''}">${num(v)}</td>`).join('')}<td>${sc(r[23])}</td><td style="text-align:left">${esc(r[24])}</td></tr>`).join('')}</tbody></table></div>
    <p class="hint">Ô màu theo số ngày vắng trong tháng (không tính công tác, làm từ xa). Đọc cùng bối cảnh: người ốm dài ngày có giấy tờ cần được hỏi han, không phải nhắc nhở.</p>`;
}

/* ---------- TÀI KHOẢN ---------- */
function acctModal(){
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="card" role="dialog" aria-modal="true" aria-label="Tài khoản">
    <div style="display:flex;gap:12px;align-items:center">${av(S.me.ten)}<div><b>${esc(S.me.hoTen)}</b><div class="muted" style="font-size:13px">${esc(S.me.ma)}, ${esc(S.me.chucDanh || S.me.boPhan)}</div></div></div>
    <div class="acts" style="display:flex;gap:10px;margin-top:20px"><button class="btn ghost sm" id="mPw">Đổi mật khẩu</button><button class="btn bad sm" id="mOut">Đăng xuất</button><button class="btn ghost sm" id="mX" style="margin-left:auto">Đóng</button></div></div>`;
  document.body.appendChild(m);
  m.onclick = e => { if (e.target === m) m.remove(); };
  $('#mX').onclick = () => m.remove();
  $('#mOut').onclick = () => { m.remove(); logout(); };
  $('#mPw').onclick = () => { m.remove(); passModal(false); };
}
function passModal(force){
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<form class="card" id="fPw" role="dialog" aria-modal="true" aria-label="Đổi mật khẩu">
    <h2 style="margin-top:0">${force ? 'Đặt mật khẩu của riêng bạn' : 'Đổi mật khẩu'}</h2>
    ${force ? '<p class="muted">Bạn đang dùng mật khẩu tạm do HCNS cấp. Đổi một lần là xong.</p>' : ''}
    <div class="field"><label for="p0">Mật khẩu hiện tại</label><input type="password" id="p0" autocomplete="current-password" required></div>
    <div class="field"><label for="p1">Mật khẩu mới (từ 6 ký tự)</label><input type="password" id="p1" autocomplete="new-password" minlength="6" required></div>
    <div class="field"><label for="p2">Nhập lại mật khẩu mới</label><input type="password" id="p2" autocomplete="new-password" required></div>
    <div style="display:flex;gap:10px"><button class="btn">Lưu mật khẩu</button>${force ? '' : '<button type="button" class="btn ghost" id="pX">Đóng</button>'}</div></form>`;
  document.body.appendChild(m);
  if (!force) $('#pX').onclick = () => m.remove();
  $('#fPw').onsubmit = async e => {
    e.preventDefault();
    if ($('#p1').value !== $('#p2').value) return toast('Hai lần nhập mật khẩu mới chưa khớp.', true);
    try { await call('apiChangePass', S.token, $('#p0').value, $('#p1').value); m.remove(); S.me.mustChange = false; toast('Đã đổi mật khẩu'); }
    catch (er) { toast(er.message, true); }
  };
}

/* ---------- CHẤM CÔNG ---------- */
function deviceId(){ let d = load('ntl_dev'); if (!d) { d = 'D' + Math.random().toString(36).slice(2) + Date.now().toString(36); save('ntl_dev', d); } return d; }
async function getIP(force){
  if (S.ip && !force) return S.ip;
  const srcs = [['https://api.ipify.org?format=json', r => r.json().then(j => j.ip)], ['https://ipv4.icanhazip.com', r => r.text()]];
  for (const [u, f] of srcs) {
    try { const ctl = new AbortController(); setTimeout(() => ctl.abort(), 5000); const r = await fetch(u, { cache: 'no-store', signal: ctl.signal }); const ip = String(await f(r)).trim(); if (ip) { S.ip = ip; return ip; } } catch (e) {}
  }
  return '';
}
function punchStrip(){
  if (!S.me.chamCong) return '';
  const p = S.me.punch;
  const txt = !p ? 'Bạn chưa chấm công hôm nay' : !p.ra ? `Vào lúc ${p.vao}${p.muon ? `, muộn ${p.muon} phút` : ''}` : `Vào ${p.vao}, ra ${p.ra}`;
  const sub = !p ? 'Kết nối wifi công ty, bấm nút và chụp 1 tấm selfie' : !p.ra ? 'Cuối giờ nhớ chấm ra' : 'Chấm lại nếu bạn về muộn hơn';
  return `<div class="punch"><div class="txt">${esc(txt)}<small>${esc(sub)}</small></div><button class="btn" data-punch>${!p ? 'Chấm vào' : 'Chấm ra'}</button></div>`;
}
function bindPunch(){ document.querySelectorAll('[data-punch]').forEach(b => b.onclick = startPunch); }
function startPunch(){
  getIP(true);
  const cam = $('#cam'); cam.value = '';
  cam.onchange = () => { if (cam.files && cam.files[0]) doPunch(cam.files[0]); };
  cam.click();
}
function shrink(file){
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 480 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => rej(new Error('Không đọc được ảnh, chụp lại nhé.'));
    img.src = url;
  });
}
async function doPunch(file){
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="card result"><div class="em"><span class="spin" style="width:40px;height:40px;border-width:4px"></span></div><h2>Đang chấm công</h2><p class="muted">Kiểm tra wifi và lưu ảnh...</p></div>`;
  document.body.appendChild(m);
  try {
    const [photo, ip] = await Promise.all([shrink(file), getIP(true)]);
    const r = await call('apiPunch', S.token, { ip, photo, device: deviceId() });
    const em = r.loai === 'VAO' ? (r.muon ? '⏰' : '✅') : (r.som ? '🏃' : '👋');
    const h = r.loai === 'VAO' ? `Vào ca ${r.gio}` : `Ra ca ${r.gio}`;
    const sub = r.loai === 'VAO' ? (r.muon ? `Muộn ${r.muon} phút so với giờ vào` : 'Đúng giờ. Chúc một ngày làm việc hiệu quả!') : (r.som ? `Về sớm ${r.som} phút so với giờ ra` : 'Cảm ơn bạn, hẹn gặp lại!');
    m.innerHTML = `<div class="card result"><div class="em">${em}</div><h2>${h}</h2><p class="muted">${esc(sub)}</p>${(r.flags || []).length ? `<p class="warn" style="text-align:left">${esc(r.flags.join(', '))}</p>` : ''}<button class="btn" style="margin-top:12px" id="rOk">Xong</button></div>`;
    $('#rOk').onclick = () => m.remove();
    S.me.punch = r.loai === 'VAO' ? { vao: r.gio, ra: '', muon: r.muon } : Object.assign({}, S.me.punch, { ra: r.gio, som: r.som });
    if (S.view === 'board' && S.board) drawBoard(); else if (S.view === 'cc') viewCC();
  } catch (e) {
    m.innerHTML = `<div class="card result"><div class="em">📵</div><h2>Chưa chấm được</h2><p style="white-space:pre-line">${esc(e.message)}</p><button class="btn" id="rOk">Đóng</button></div>`;
    $('#rOk').onclick = () => m.remove();
  }
}
async function viewCC(){
  const hr = can(['HCNS']);
  const p = S.me.punch;
  V(`<h1>Chấm công</h1><p class="sub">Kết nối wifi công ty, bấm nút, chụp 1 tấm selfie. Đầu giờ chấm vào, cuối giờ chấm ra.</p>
    ${S.me.chamCong ? `<div class="bigpunch"><button data-punch class="${p ? 'out' : ''}">${!p ? 'Chấm<br>vào ca' : 'Chấm<br>ra ca'}</button>
      <p>${!p ? 'Chưa chấm hôm nay' : `Vào ${esc(p.vao)}${p.ra ? `, ra ${esc(p.ra)}` : ''}`}</p></div>
      <h2>Tháng này của tôi</h2><div id="myc"><div class="skel" style="height:80px"></div></div>` : ''}
    ${hr ? `<h2>Toàn công ty</h2><div class="toolbar"><input type="date" id="ccDay" value="${kd(new Date())}" aria-label="Ngày"><button class="btn ghost sm" id="ccAdd">Bổ sung công</button>${S.me.role === 'ADMIN' ? '<button class="btn ghost sm" id="ccIp">Đặt IP văn phòng</button>' : ''}</div><div id="ccAll"><div class="skel"></div></div>` : ''}`);
  bindPunch();
  if (S.me.chamCong) call('apiMyAttendance', S.token, '').then(d => {
    S.me.punch = d.today;
    const box = $('#myc'); if (!box) return;
    const late = d.rows.filter(r => r.muon).length;
    box.innerHTML = d.rows.length ? `<div class="facts"><div><b>${d.rows.length}</b><span>ngày đã chấm</span></div><div><b>${late}</b><span>lần đi muộn</span></div><div><b>${d.rows.filter(r => !r.ra).length}</b><span>ngày thiếu giờ ra</span></div></div>
      <div class="tbl-wrap"><table><thead><tr><th>Ngày</th><th>Vào</th><th>Ra</th><th>Muộn</th><th>Về sớm</th><th>Ghi chú</th></tr></thead><tbody>
      ${d.rows.slice().reverse().map(r => `<tr><td>${dShort(r.d)}</td><td>${esc(r.vao)}</td><td>${esc(r.ra) || '<span class="muted">–</span>'}</td><td class="${r.muon ? '' : 'z'}">${r.muon ? r.muon + "'" : '0'}</td><td class="${r.som ? '' : 'z'}">${r.som ? r.som + "'" : '0'}</td><td style="text-align:left">${esc(r.ghiChu)}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty"><b>Chưa có ngày nào</b>Bấm nút phía trên để chấm công.</div>';
  }).catch(e => { const b = $('#myc'); if (b) b.innerHTML = `<div class="empty">${esc(e.message)}</div>`; });
  if (hr) {
    $('#ccDay').onchange = () => loadDay();
    $('#ccAdd').onclick = () => manualModal();
    if ($('#ccIp')) $('#ccIp').onclick = ipModal;
    loadDay();
  }
}
async function loadDay(){
  const box = $('#ccAll'); if (!box) return;
  box.innerHTML = '<div class="skel"></div>';
  let d; try { d = await call('apiAttendanceDay', S.token, $('#ccDay').value); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  S.ccDay = d;
  const now = new Date(), isToday = d.day === kd(now);
  const st = x => x.vao ? (x.muon ? ['b-late', 'Muộn ' + x.muon + "'"] : ['b-ok', 'Đúng giờ']) : x.nghi ? ['b-off', x.nghi] : !d.isWork ? ['b-off', 'Ngày nghỉ'] : ['b-no', isToday ? 'Chưa chấm' : 'Vắng'];
  const done = d.list.filter(x => x.vao).length;
  box.innerHTML = `<div class="facts"><div><b>${done}/${d.list.length}</b><span>đã chấm vào</span></div><div><b>${d.list.filter(x => x.muon).length}</b><span>đi muộn</span></div><div><b>${d.list.filter(x => !x.vao && !x.nghi && d.isWork).length}</b><span>${isToday ? 'chưa chấm' : 'vắng không đơn'}</span></div></div>
    ${d.ips.length ? '' : '<p class="warn">Chưa cài IP wifi văn phòng, chưa ai chấm công được.</p>'}
    <div class="people">${d.list.map(x => { const s = st(x); return `<div class="pc">${av(x.ten, true)}<div><b>${esc(x.ten)}</b><div class="s">${x.vao ? `${esc(x.vao)} → ${esc(x.ra) || '…'}${x.som ? `, sớm ${x.som}'` : ''}` : esc(x.boPhan)}${x.nguon === 'Bổ sung' ? ', bổ sung' : ''}</div>${x.ghiChu ? `<div class="s" style="color:var(--coral)">${esc(x.ghiChu.split(' | ')[0])}</div>` : ''}</div>
      <div style="text-align:right"><span class="badge2 ${s[0]}">${esc(s[1])}</span>${x.anhVao ? `<div><button class="btn ghost sm" style="margin-top:6px" data-photo="${esc(x.ma)}">Ảnh</button></div>` : ''}</div></div>`; }).join('')}</div>`;
  box.querySelectorAll('[data-photo]').forEach(b => b.onclick = () => photoModal(d.list.find(x => x.ma === b.dataset.photo)));
}
async function photoModal(x){
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="card" style="width:min(560px,100%)"><h3>${esc(x.ten)}</h3><p class="muted" style="margin:4px 0 14px">So khớp khuôn mặt với ảnh mẫu</p><div class="photos" id="ph"><div class="skel"></div><div class="skel"></div></div><button class="btn ghost sm" style="margin-top:14px" id="phX">Đóng</button></div>`;
  document.body.appendChild(m);
  $('#phX').onclick = () => m.remove(); m.onclick = e => { if (e.target === m) m.remove(); };
  const ids = [[x.mau, 'Ảnh mẫu'], [x.anhVao, 'Vào ' + x.vao], [x.anhRa, x.ra ? 'Ra ' + x.ra : '']].filter(a => a[0] && a[1]);
  try {
    const imgs = await Promise.all(ids.map(a => call('apiPhoto', S.token, a[0])));
    $('#ph').innerHTML = imgs.map((src, i) => `<figure><img src="${src}" alt="${esc(ids[i][1])}"><figcaption>${esc(ids[i][1])}</figcaption></figure>`).join('');
  } catch (e) { $('#ph').innerHTML = `<p class="e">${esc(e.message)}</p>`; }
}
function manualModal(){
  const d = S.ccDay || { list: [] };
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<form class="card" id="fMan"><h2 style="margin-top:0">Bổ sung công</h2><p class="muted">Dùng khi nhân viên quên chấm, điện thoại hỏng, đi gặp khách từ sáng.</p>
    <div class="field"><label for="mMa">Nhân sự</label><select id="mMa">${d.list.map(x => `<option value="${esc(x.ma)}">${esc(x.ten)}</option>`).join('')}</select></div>
    <div class="field"><label for="mD">Ngày</label><input type="date" id="mD" value="${$('#ccDay') ? $('#ccDay').value : kd(new Date())}"></div>
    <div class="field row2"><div><label class="lbl" for="mV">Giờ vào</label><input type="time" id="mV" value="08:00"></div><div><label class="lbl" for="mR">Giờ ra</label><input type="time" id="mR" value="17:30"></div></div>
    <div class="field"><label for="mL">Lý do</label><input type="text" id="mL" placeholder="VD: Quên chấm, đã xác nhận với trưởng nhóm"></div>
    <div style="display:flex;gap:10px"><button class="btn">Lưu</button><button type="button" class="btn ghost" id="mX">Hủy</button></div></form>`;
  document.body.appendChild(m);
  $('#mX').onclick = () => m.remove();
  $('#fMan').onsubmit = async e => {
    e.preventDefault();
    try { await call('apiManualPunch', S.token, { ma: $('#mMa').value, ngay: $('#mD').value, vao: $('#mV').value, ra: $('#mR').value, lyDo: $('#mL').value }); m.remove(); toast('Đã bổ sung công'); loadDay(); }
    catch (er) { toast(er.message, true); }
  };
}
async function ipModal(){
  const ip = await getIP(true);
  const cur = (S.ccDay && S.ccDay.ips) || [];
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="card"><h2 style="margin-top:0">IP wifi văn phòng</h2>
    <p>IP của máy anh lúc này: <b>${esc(ip || 'không đọc được')}</b></p>
    <p class="muted">Chỉ bấm khi đang kết nối wifi công ty (tắt 4G). Đang lưu: ${esc(cur.join(', ') || 'chưa có')}</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn sm" id="ipAdd" ${ip ? '' : 'disabled'}>Thêm IP này</button><button class="btn ghost sm" id="ipRep" ${ip ? '' : 'disabled'}>Thay toàn bộ bằng IP này</button><button class="btn ghost sm" id="ipX">Đóng</button></div></div>`;
  document.body.appendChild(m);
  $('#ipX').onclick = () => m.remove();
  const set = async rep => { try { const l = await call('apiSetOfficeIP', S.token, ip, rep); m.remove(); toast('IP văn phòng: ' + l.join(', ')); loadDay(); } catch (e) { toast(e.message, true); } };
  $('#ipAdd').onclick = () => set(false); $('#ipRep').onclick = () => set(true);
}

/* ---------- TRẢ LƯƠNG ---------- */
function prevMonth(){ const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
async function viewPay(month, recalc){
  month = month || (S.pay && S.pay.month) || prevMonth();
  V(`<h1>Trả lương</h1><p class="sub">Mở app ngân hàng, quét từng mã QR: số tiền và nội dung đã điền sẵn. Chuyển xong bấm "Đã chuyển".</p>
    <div class="toolbar"><input type="month" id="pMon" value="${month}" aria-label="Tháng"><button class="btn ghost sm" id="pRe">Tính lại lương</button>
      ${S.me.role === 'ADMIN' ? '<button class="btn ghost sm" id="pLock">Chốt lương tháng</button>' : ''}<button class="btn ghost sm" id="pCsv">Tải CSV</button>
      <div class="tabs" role="group"><button data-pt="qr" aria-pressed="${(S.payTab || 'qr') === 'qr'}">Mã QR</button><button data-pt="tbl" aria-pressed="${S.payTab === 'tbl'}">Bảng lương</button></div></div>
    <div id="pay"><div class="skel"></div></div>`);
  $('#pMon').onchange = e => viewPay(e.target.value);
  $('#pRe').onclick = () => viewPay($('#pMon').value, true);
  if ($('#pLock')) $('#pLock').onclick = async () => { if (!confirm('Chốt lương ' + $('#pMon').value + '? Sau khi chốt không tính lại được và nhân viên xem được phiếu lương.')) return; try { await call('apiLockPayroll', S.token, $('#pMon').value); toast('Đã chốt lương'); viewPay($('#pMon').value); } catch (e) { toast(e.message, true); } };
  $('#pCsv').onclick = payCsv;
  document.querySelectorAll('[data-pt]').forEach(b => b.onclick = () => { S.payTab = b.dataset.pt; document.querySelectorAll('[data-pt]').forEach(x => x.setAttribute('aria-pressed', x === b)); drawPay(); });
  try { S.pay = await call('apiPayroll', S.token, month, !!recalc); if (recalc) toast('Đã tính lại lương ' + month); } catch (e) { return $('#pay').innerHTML = `<div class="empty"><b>Chưa tính được</b>${esc(e.message)}</div>`; }
  if (S.view === 'pay') drawPay();
}
function drawPay(){
  const d = S.pay, box = $('#pay'); if (!box || !d) return;
  if (!d.rows.length) { box.innerHTML = '<div class="empty"><b>Chưa có bảng lương</b>Điền LuongCoBan trong tab NHAN_SU rồi bấm Tính lại lương.</div>'; return; }
  const tot = d.rows.reduce((s, r) => s + (Number(r.ThucLinh) || 0), 0);
  const paid = d.rows.filter(r => r.TrangThai === 'Đã chuyển');
  const head = `<div class="facts"><div><b>${vnd(tot)}</b><span>tổng thực lĩnh ${d.locked ? '(đã chốt)' : '(chưa chốt)'}</span></div><div><b>${paid.length}/${d.rows.length}</b><span>người đã chuyển</span></div><div><b>${vnd(tot - paid.reduce((s, r) => s + (Number(r.ThucLinh) || 0), 0))}</b><span>còn phải chuyển</span></div></div>
    ${d.rows.some(r => !Number(r.LuongCoBan)) ? `<p class="warn">${d.rows.filter(r => !Number(r.LuongCoBan)).length} người chưa có lương cứng trong NHAN_SU.</p>` : ''}`;
  if ((S.payTab || 'qr') === 'qr') {
    const rows = d.rows.slice().sort((a, b) => (a.TrangThai === 'Đã chuyển') - (b.TrangThai === 'Đã chuyển'));
    box.innerHTML = head + `<div class="qrgrid">${rows.map(r => { const ok = r.BIN && r.SoTaiKhoan && Number(r.ThucLinh) > 0; const isPaid = r.TrangThai === 'Đã chuyển'; return `
      <article class="qr${isPaid ? ' paid' : ''}"><div style="display:flex;gap:10px;align-items:center">${av(r.HoTen, true)}<div><b>${esc(r.HoTen)}</b><div class="s">${esc(r.BoPhan)}, ${num(r.CongHuongLuong)}/${num(r.CongChuan)} công</div></div></div>
        ${ok ? `<img loading="lazy" src="${esc(r.LinkQR)}" alt="QR chuyển lương ${esc(r.HoTen)}">` : `<div class="noqr">${!Number(r.ThucLinh) ? 'Thực lĩnh bằng 0' : 'Thiếu BIN hoặc số tài khoản trong NHAN_SU'}</div>`}
        <div class="amt">${vnd(r.ThucLinh)}</div>
        <div class="s">${esc(r.NganHang)} ${esc(r.SoTaiKhoan)}<br>${esc(r.ChuTaiKhoan)}<br>Nội dung: ${esc(r.NoiDungCK)}</div>
        ${r.VangKhongPhep ? `<div class="warn">Vắng không chấm công ${num(r.VangKhongPhep)} ngày</div>` : ''}${r.QuenChamRa ? `<div class="warn">Quên chấm ra ${r.QuenChamRa} lần</div>` : ''}
        ${!d.locked && can(['KETOAN']) ? `<button class="btn ghost sm" data-items="${esc(r.MaNV)}">Thưởng, hoa hồng, khấu trừ</button>` : ''}
        <button class="btn ${isPaid ? 'ghost' : 'ok'} sm" data-paid="${esc(r.MaNV)}" data-v="${isPaid ? 0 : 1}">${isPaid ? `Đã chuyển ${esc(String(r.ChuyenLuc).slice(11, 16))}. Bỏ đánh dấu` : 'Đã chuyển'}</button></article>`; }).join('')}</div>`;
    box.querySelectorAll('[data-items]').forEach(b => b.onclick = () => itemsModal(d.rows.find(x => x.MaNV === b.dataset.items)));
    box.querySelectorAll('[data-paid]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { await call('apiMarkPaid', S.token, d.month, b.dataset.paid, b.dataset.v === '1'); const r = d.rows.find(x => x.MaNV === b.dataset.paid); r.TrangThai = b.dataset.v === '1' ? 'Đã chuyển' : 'Chưa chuyển'; r.ChuyenLuc = b.dataset.v === '1' ? kd(new Date()) + ' ' + new Date().toTimeString().slice(0, 5) : ''; drawPay(); }
      catch (e) { toast(e.message, true); b.disabled = false; }
    });
  } else {
    const cols = [['HoTen', 'Họ tên'], ['BoPhan', 'Bộ phận'], ['LuongCoBan', 'Lương cứng'], ['PhuCap', 'Phụ cấp'], ['CongChuan', 'Công chuẩn'], ['CongDiLam', 'Đi làm'], ['CongCT_WFH', 'Công tác, WFH'], ['CongPhep', 'Phép có lương'], ['CongHuongLuong', 'Công hưởng lương'], ['NghiKhongLuong', 'Nghỉ KL'], ['VangKhongPhep', 'Vắng không chấm'], ['LanDiMuon', 'Lần muộn'], ['LuongTheoCong', 'Lương theo công'], ['PhuCapTheoCong', 'Phụ cấp theo công'], ['ThuongHoaHong', 'Thưởng, HH'], ['BHXH', 'BHXH'], ['ThueTNCN', 'Thuế TNCN'], ['TamUng', 'Tạm ứng'], ['KhauTruKhac', 'Khấu trừ khác'], ['ThucLinh', 'THỰC LĨNH'], ['TrangThai', 'Trạng thái']];
    box.innerHTML = head + `<div class="tbl-wrap"><table><thead><tr><th>Mã</th>${cols.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${d.rows.map(r => `<tr><td>${esc(r.MaNV)}</td>${cols.map(c => { const v = r[c[0]]; return `<td class="${c[0] === 'ThucLinh' ? 'hl' : typeof v === 'number' && !v ? 'z' : ''}">${typeof v === 'number' ? (v > 1000 ? Math.round(v).toLocaleString('vi-VN') : num(v)) : esc(v)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="hint">Thưởng, hoa hồng, thuế TNCN, tạm ứng, khấu trừ: kế toán nhập ở các ô vàng trong tab BANG_LUONG. Tính lại lương vẫn giữ các ô này.</p>`;
  }
}
function payCsv(){
  if (!S.pay || !S.pay.rows.length) return;
  const keys = ['MaNV', 'HoTen', 'BoPhan', 'LuongCoBan', 'PhuCap', 'CongChuan', 'CongHuongLuong', 'VangKhongPhep', 'LuongTheoCong', 'PhuCapTheoCong', 'ThuongHoaHong', 'BHXH', 'ThueTNCN', 'TamUng', 'KhauTruKhac', 'ThucLinh', 'NganHang', 'SoTaiKhoan', 'ChuTaiKhoan', 'NoiDungCK', 'TrangThai'];
  const csv = '﻿' + [keys].concat(S.pay.rows.map(r => keys.map(k => r[k]))).map(r => r.map(v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `BangLuong_${S.pay.month}.csv`; document.body.appendChild(a); a.click(); a.remove(); }
  catch (e) { toast('Trình duyệt chặn tải file. Mở tab BANG_LUONG trong Google Sheet.', true); }
}

/* ---------- PHIẾU LƯƠNG ---------- */
async function viewSlip(){
  skel();
  let list; try { list = await call('apiMyPayslips', S.token); } catch (e) { return V(`<div class="empty">${esc(e.message)}</div>`); }
  if (S.view !== 'slip') return;
  const L = (a, b) => `<dt>${a}</dt><dd>${b}</dd>`;
  V(`<h1>Phiếu lương</h1><p class="sub">Chỉ bạn nhìn thấy phiếu lương của mình. Có thắc mắc, nhắn kế toán trong 3 ngày sau khi nhận lương.</p>
    ${list.length ? `<div class="qrgrid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">${list.map(r => `<article class="card slip"><h3 style="margin-bottom:12px">Tháng ${esc(String(r.Thang).slice(5))}/${esc(String(r.Thang).slice(0, 4))}</h3><dl>
      ${L('Công chuẩn', num(r.CongChuan))}${L('Công đi làm', num(r.CongDiLam))}${r.CongCT_WFH ? L('Công tác, làm từ xa', num(r.CongCT_WFH)) : ''}${r.CongPhep ? L('Nghỉ phép có lương', num(r.CongPhep)) : ''}
      ${L('Công hưởng lương', '<b>' + num(r.CongHuongLuong) + '</b>')}${r.NghiKhongLuong ? L('Nghỉ không lương', num(r.NghiKhongLuong)) : ''}${r.VangKhongPhep ? L('Vắng không chấm công', num(r.VangKhongPhep)) : ''}
      ${L('Lương theo công', vnd(r.LuongTheoCong))}${r.PhuCapTheoCong ? L('Phụ cấp', vnd(r.PhuCapTheoCong)) : ''}${r.ThuongHoaHong ? L('Thưởng, hoa hồng', vnd(r.ThuongHoaHong)) : ''}
      ${r.BHXH ? L('BHXH, BHYT, BHTN', '−' + vnd(r.BHXH)) : ''}${r.ThueTNCN ? L('Thuế TNCN', '−' + vnd(r.ThueTNCN)) : ''}${r.TamUng ? L('Tạm ứng', '−' + vnd(r.TamUng)) : ''}${r.KhauTruKhac ? L('Khấu trừ khác', '−' + vnd(r.KhauTruKhac)) : ''}
      </dl><div class="tot">${vnd(r.ThucLinh)}</div><p class="hint">${esc(r.TrangThai)}${r.ChuyenLuc ? ' lúc ' + esc(r.ChuyenLuc) : ''}</p></article>`).join('')}</div>`
      : '<div class="empty"><b>Chưa có phiếu lương</b>Phiếu lương hiện sau khi công ty chốt lương tháng.</div>'}`);
}


/* ---------- NHẬP KHOẢN LƯƠNG ---------- */
function itemsModal(r){
  const m = document.createElement('div'); m.className = 'modal';
  const f = (id, label, v) => `<div class="field"><label for="${id}">${label}</label><input type="text" inputmode="numeric" id="${id}" value="${v ? Math.round(v).toLocaleString('vi-VN') : ''}" placeholder="0"></div>`;
  m.innerHTML = `<form class="card" id="fIt" style="width:min(460px,100%)"><h2 style="margin-top:0">${esc(r.HoTen)}</h2><p class="muted">Lương theo công ${vnd(r.LuongTheoCong)}, phụ cấp ${vnd(r.PhuCapTheoCong)}, BHXH tự tính ${vnd(r.BHXH)}</p>
    <div class="row2">${f('iB', 'Thưởng', r.Thuong)}${f('iC', 'Hoa hồng', r.HoaHong)}</div>
    <div class="row2">${f('iP', 'Thuế TNCN', r.ThueTNCN)}${f('iA', 'Tạm ứng', r.TamUng)}</div>
    ${f('iD', 'Khấu trừ khác', r.KhauTruKhac)}
    <div class="field"><label for="iN">Ghi chú</label><input type="text" id="iN" value="${esc(r.GhiChu || '')}"></div>
    <div style="display:flex;gap:10px"><button class="btn">Lưu</button><button type="button" class="btn ghost" id="iX">Hủy</button></div></form>`;
  document.body.appendChild(m);
  $('#iX').onclick = () => m.remove();
  const n = id => Number(String($(id).value).replace(/[^\d-]/g, '')) || 0;
  $('#fIt').onsubmit = async e => {
    e.preventDefault();
    try {
      const v = await Api.call('pay.items.set', { month: S.pay.month, code: r.MaNV, bonus: n('#iB'), commission: n('#iC'), pit: n('#iP'), advance: n('#iA'), deduction: n('#iD'), note: $('#iN').value });
      const i = S.pay.rows.findIndex(x => x.MaNV === r.MaNV); if (i >= 0) S.pay.rows[i] = Object.assign(S.pay.rows[i], v);
      m.remove(); toast('Đã lưu. Thực lĩnh mới: ' + vnd(v.ThucLinh)); drawPay();
    } catch (er) { toast(er.message, true); }
  };
}

/* ---------- QUẢN TRỊ TÀI KHOẢN & VAI TRÒ ---------- */
const ROLE_VN = { admin: 'Admin', director: 'Giám đốc khối', hr: 'HCNS', accountant: 'Kế toán', sales_manager: 'Trưởng phòng', sales_leader: 'Trưởng nhóm', sales: 'Sale', staff: 'Nhân viên' };
async function viewAdmin(){
  skel();
  try { S.adm = await Api.call('admin.users.list', {}); } catch (e) { return V(`<div class="empty"><b>Chưa tải được</b>${esc(e.message)}</div>`); }
  if (S.view !== 'admin') return;
  const d = S.adm;
  V(`<h1>Quản trị</h1><p class="sub">Tài khoản, vai trò và mật khẩu. Một người có thể có nhiều vai trò, ví dụ Trưởng nhóm kiêm Sale. Luôn phải còn ít nhất 1 Admin.</p>
    <div class="toolbar"><input type="text" id="aQ" placeholder="Tìm tên, mã..." style="max-width:260px"><button class="btn sm" id="aAdd">Thêm người, tài khoản</button></div>
    <div class="facts"><div><b>${d.users.filter(u => u.status === 'active').length}</b><span>tài khoản hoạt động</span></div><div><b>${d.users.filter(u => u.roles.indexOf('admin') >= 0).length}</b><span>Admin</span></div><div><b>${d.users.filter(u => !u.hasPassword && u.status === 'active').length}</b><span>chưa có mật khẩu</span></div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Mã</th><th>Họ tên</th><th>Phòng</th><th>Vai trò</th><th>Trạng thái</th><th>Đăng nhập gần nhất</th><th></th></tr></thead><tbody id="aBody"></tbody></table></div>`);
  const draw = () => {
    const q = ($('#aQ').value || '').toLowerCase();
    $('#aBody').innerHTML = d.users.filter(u => !q || (u.username + ' ' + u.name).toLowerCase().indexOf(q) >= 0).map(u => `<tr>
      <td>${esc(u.username)}</td><td>${esc(u.name)}</td><td style="text-align:left">${esc(u.dept)}</td>
      <td style="text-align:left;white-space:normal">${u.roles.map(r => `<span class="flag${r === 'admin' ? ' ceo' : ''}" style="margin-right:4px">${esc(ROLE_VN[r] || r)}</span>`).join('')}</td>
      <td style="text-align:left">${u.status === 'active' ? (u.hasPassword ? 'Hoạt động' : 'Chưa có mật khẩu') : u.status === 'locked' ? 'Đang khóa' : 'Ngừng'}</td><td>${esc(u.lastLogin)}</td>
      <td style="text-align:left"><button class="btn ghost sm" data-role="${u.id}">Vai trò</button> <button class="btn ghost sm" data-pw="${u.id}">Cấp mật khẩu</button> <button class="btn ghost sm" data-st="${u.id}">${u.status === 'active' ? 'Khóa' : 'Mở'}</button></td></tr>`).join('');
    document.querySelectorAll('[data-role]').forEach(b => b.onclick = () => roleModal(d.users.find(u => u.id === b.dataset.role)));
    document.querySelectorAll('[data-pw]').forEach(b => b.onclick = async () => {
      const u = d.users.find(x => x.id === b.dataset.pw);
      if (!confirm('Cấp mật khẩu tạm mới cho ' + u.name + '? Mật khẩu cũ sẽ không dùng được nữa.')) return;
      try { const r = await Api.call('admin.users.resetPassword', { userId: u.id }); passShow(r); } catch (e) { toast(e.message, true); }
    });
    document.querySelectorAll('[data-st]').forEach(b => b.onclick = async () => {
      const u = d.users.find(x => x.id === b.dataset.st);
      try { await Api.call('admin.users.setStatus', { userId: u.id, status: u.status === 'active' ? 'locked' : 'active' }); toast('Đã cập nhật'); viewAdmin(); } catch (e) { toast(e.message, true); }
    });
  };
  $('#aQ').oninput = draw; $('#aAdd').onclick = addModal; draw();
  renderConfig();
  renderImport();
}
function passShow(r){
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="card"><h2 style="margin-top:0">Mật khẩu tạm</h2><p>Tài khoản <b>${esc(r.username)}</b></p><p style="font-size:34px;font-weight:800;letter-spacing:.1em">${esc(r.password)}</p><p class="muted">Gửi riêng cho người đó. Lần đầu đăng nhập hệ thống bắt đổi mật khẩu. Đóng cửa sổ là không xem lại được.</p><button class="btn" id="pOk">Đã ghi lại</button></div>`;
  document.body.appendChild(m); $('#pOk').onclick = () => { m.remove(); viewAdmin(); };
}
function roleModal(u){
  const d = S.adm, m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<form class="card" id="fR" style="width:min(460px,100%)"><h2 style="margin-top:0">${esc(u.name)}</h2><p class="muted">${esc(u.username)}, ${esc(u.dept)}</p>
    <div class="field"><span class="lbl">Vai trò</span>${d.roles.map(r => `<label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" value="${r.code}" ${u.roles.indexOf(r.code) >= 0 ? 'checked' : ''}> ${esc(ROLE_VN[r.code] || r.name)}</label>`).join('')}</div>
    <div class="field" id="rTeam"><label for="rT">Nhóm phụ trách (với Trưởng nhóm)</label><select id="rT"><option value="">Chưa chọn</option>${d.teams.map(t => `<option value="${t.id}" ${u.teamId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
    <div style="display:flex;gap:10px"><button class="btn">Lưu</button><button type="button" class="btn ghost" id="rX">Hủy</button></div></form>`;
  document.body.appendChild(m); $('#rX').onclick = () => m.remove();
  $('#fR').onsubmit = async e => {
    e.preventDefault();
    const roles = Array.from(m.querySelectorAll('input[type=checkbox]:checked')).map(x => x.value);
    if (roles.indexOf('admin') >= 0 && u.roles.indexOf('admin') < 0 && !confirm('Cấp quyền Admin cho ' + u.name + '? Admin xem và sửa được toàn bộ lương, nhân sự, khách hàng.')) return;
    try { await Api.call('admin.users.setRoles', { userId: u.id, roles, teamId: $('#rT').value }); m.remove(); toast('Đã lưu vai trò'); viewAdmin(); } catch (er) { toast(er.message, true); }
  };
}
function addModal(){
  const d = S.adm, m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<form class="card" id="fA" style="width:min(480px,100%)"><h2 style="margin-top:0">Thêm người, tài khoản</h2><p class="muted">Dùng khi thêm Admin hoặc nhân sự mới. Hồ sơ đầy đủ (ngân hàng, lương) bổ sung sau trong file NT_HR.</p>
    <div class="field"><label for="qN">Họ tên</label><input type="text" id="qN" required></div>
    <div class="row2"><div class="field"><label for="qD">Tên hiển thị</label><input type="text" id="qD" placeholder="VD: Hà KD" required></div><div class="field"><label for="qP">Phòng</label><select id="qP">${d.departments.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div></div>
    <div class="row2"><div class="field"><label for="qC">Chức danh</label><input type="text" id="qC"></div><div class="field"><label for="qE">Email</label><input type="text" id="qE"></div></div>
    <div class="field"><span class="lbl">Vai trò</span>${d.roles.map(r => `<label style="display:inline-flex;gap:6px;align-items:center;margin:4px 12px 4px 0"><input type="checkbox" value="${r.code}" ${r.code === 'staff' ? 'checked' : ''}> ${esc(ROLE_VN[r.code] || r.name)}</label>`).join('')}</div>
    <label style="display:flex;gap:8px;align-items:center;margin-bottom:16px"><input type="checkbox" id="qCC"> Phải chấm công</label>
    <div style="display:flex;gap:10px"><button class="btn">Tạo tài khoản</button><button type="button" class="btn ghost" id="qX">Hủy</button></div></form>`;
  document.body.appendChild(m); $('#qX').onclick = () => m.remove();
  $('#fA').onsubmit = async e => {
    e.preventDefault();
    const roles = Array.from(m.querySelectorAll('.field input[type=checkbox]:checked')).map(x => x.value);
    try { const r = await Api.call('admin.employees.quickAdd', { fullName: $('#qN').value, displayName: $('#qD').value, departmentId: $('#qP').value, position: $('#qC').value, email: $('#qE').value, roles, attendance: $('#qCC').checked }); m.remove(); passShow(r); }
    catch (er) { toast(er.message, true); }
  };
}

boot();

/* ---------- NHẬP DỮ LIỆU TỪ FILE EXCEL (cấu hình CRM, danh mục, dữ liệu cũ) ---------- */
const ERP_BOOK = {"departments": "CORE", "teams": "CORE", "users": "CORE", "roles": "CORE", "permissions": "CORE", "role_permissions": "CORE", "user_roles": "CORE", "settings": "CORE", "holidays": "CORE", "audit_logs": "CORE", "employees": "HR", "employee_compensations": "HR", "employee_bank_accounts": "HR", "attendance_profiles": "HR", "leave_types": "HR", "leave_balances": "HR", "leave_requests": "HR", "leave_request_days": "HR", "attendance_records": "HR", "payroll_periods": "HR", "payslips": "HR", "payslip_items": "HR", "lookups": "CORE"};
const CRM_SHEETS = ['NHAN_SU', 'KHACH_HANG', 'NHAT_KY_CHAM_SOC', 'BAO_GIA', 'BAO_GIA_CHI_TIET', 'BAO_CAO_NGAY', 'LICH_SU_CHUYEN_KH', 'KPI_CHI_TIEU', 'CAU_HINH', 'HO_TRO', 'KH_DANG_CHAY', 'NAP_RUT', 'CLAIM', 'HUONG_DAN'];
const CRM_CONFIG = ['CAU_HINH', 'KPI_CHI_TIEU', 'HUONG_DAN', 'NHAN_SU'];
function renderImport(){
  const box = document.createElement('section'); box.className = 'card'; box.style.marginTop = '20px';
  box.innerHTML = `<h2 style="margin-top:0">Nhập dữ liệu từ file Excel</h2>
    <p class="muted">Dùng để đưa <b>mẫu, danh mục, cấu hình</b> từ Google Sheet CRM cũ sang: mở Sheet CRM → Tệp → Tải xuống → Microsoft Excel (.xlsx), rồi chọn file đó ở đây. Mỗi sheet được chọn sẽ <b>thay toàn bộ</b> sheet cùng tên trên hệ thống.</p>
    <input type="file" id="impF" accept=".xlsx,.xls"><div id="impL" style="margin-top:12px"></div>
    <h2>Mật khẩu tạm hàng loạt</h2><p class="muted">Cấp mật khẩu tạm cho mọi người chưa có mật khẩu trên hệ thống mới. Người đang dùng mật khẩu CRM cũ vẫn giữ nguyên.</p>
    <button class="btn ghost sm" id="bulkPw">Cấp mật khẩu tạm hàng loạt</button><div id="bulkL"></div>`;
  $('#erpView').appendChild(box);
  $('#bulkPw').onclick = async () => {
    if (!confirm('Cấp mật khẩu tạm cho tất cả người chưa có mật khẩu?')) return;
    try {
      const l = await Api.call('admin.users.bulkTemp', { onlyMissing: true });
      $('#bulkL').innerHTML = l.length ? '<p class="muted">Gửi riêng từng người. Đóng trang là không xem lại được.</p><div class="tbl-wrap"><table><thead><tr><th>Mã</th><th>Họ tên</th><th>Mật khẩu tạm</th></tr></thead><tbody>' + l.map(x => `<tr><td>${esc(x.username)}</td><td>${esc(x.name)}</td><td><b>${esc(x.password)}</b></td></tr>`).join('') + '</tbody></table></div>' : '<p class="pv">Ai cũng đã có mật khẩu.</p>';
    } catch (er) { toast(er.message, true); }
  };
  $('#impF').onchange = async () => {
    const f = $('#impF').files[0]; if (!f) return;
    $('#impL').innerHTML = '<div class="skel"></div>';
    try {
      if (!window.XLSX) await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; sc.onload = res; sc.onerror = () => rej(new Error('Không tải được thư viện đọc Excel')); document.head.appendChild(sc); });
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
      const p2 = n => String(n).padStart(2, '0');
      const cellv = v => v instanceof Date ? (v.getFullYear() + '-' + p2(v.getMonth() + 1) + '-' + p2(v.getDate()) + (v.getHours() || v.getMinutes() ? ' ' + p2(v.getHours()) + ':' + p2(v.getMinutes()) : '')) : v;
      const bookOf = n => CRM_SHEETS.indexOf(n) >= 0 ? 'CRM' : (ERP_BOOK[n] || '');
      const list = wb.SheetNames.filter(n => bookOf(n) && n !== 'audit_logs').map(n => {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }).map(r => r.map(cellv));
        while (rows.length && rows[rows.length - 1].every(v => v === '')) rows.pop();
        return { n, rows, book: bookOf(n) };
      });
      if (!list.length) { $('#impL').innerHTML = '<p class="pv e">File không có sheet nào khớp hệ thống (KHACH_HANG, CAU_HINH, employees, users...).</p>'; return; }
      const isErpFile = list.every(x => x.book !== 'CRM');
      $('#impL').innerHTML = `<p><b>${esc(f.name)}</b>: chọn sheet cần đưa sang. Mặc định chọn sẵn phần mẫu, cấu hình.</p>` +
        list.map((x, i) => `<label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" data-i="${i}" ${(isErpFile || CRM_CONFIG.indexOf(x.n) >= 0) ? 'checked' : ''}> <b>${esc(x.n)}</b> <span class="muted">${x.book === 'CRM' ? 'Bán hàng' : 'ERP ' + x.book}, ${Math.max(0, x.rows.length - 1)} dòng</span></label>`).join('') +
        '<button class="btn" id="impGo" style="margin-top:10px">Nhập các sheet đã chọn</button>';
      $('#impGo').onclick = async () => {
        const pick = Array.from(document.querySelectorAll('#impL input[data-i]:checked')).map(c => list[+c.dataset.i]);
        if (!pick.length) return toast('Chưa chọn sheet nào', true);
        if (!confirm('Thay ' + pick.length + ' sheet: ' + pick.map(x => x.n).join(', ') + '?')) return;
        const done = [];
        for (const x of pick) { try { await Api.call('admin.import.sheet', { book: x.book, sheet: x.n, rows: x.rows }); done.push(x.n); } catch (er) { toast(x.n + ': ' + er.message, true); } }
        toast('Đã nhập: ' + done.join(', '));
        $('#impL').innerHTML = '<p class="pv">Đã nhập ' + done.length + ' sheet.' + (pick.some(x => x.n === 'users') ? ' Danh sách tài khoản đã thay: bấm <b>Cấp mật khẩu tạm hàng loạt</b> bên dưới cho những người chưa có mật khẩu, rồi đăng nhập lại.' : ' Tải lại trang để dùng cấu hình mới.') + '</p>';
      };
    } catch (er) { $('#impL').innerHTML = '<p class="pv e">' + esc(er.message) + '</p>'; }
  };
}

/* ---------- SỬA CẤU HÌNH TRỰC TIẾP (như sửa Google Sheet) ---------- */
const CFG_SHEETS = [
  ['CRM', 'CAU_HINH', 'Bán hàng: danh mục, mặc định báo giá, tham số, thông tin công ty, tài khoản, QR'],
  ['CRM', 'KPI_CHI_TIEU', 'Bán hàng: chỉ tiêu KPI'],
  ['CRM', 'HUONG_DAN', 'Bán hàng: hướng dẫn'],
  ['CORE', 'settings', 'Nhân sự: cấu hình chung (giờ làm, phép, Lark, IP...)'],
  ['HR', 'leave_types', 'Nhân sự: loại nghỉ'],
  ['CORE', 'holidays', 'Nhân sự: ngày lễ'],
  ['CORE', 'departments', 'Nhân sự: phòng ban']
];
const CFG_HIDE = ['id', 'created_at', 'created_by', 'updated_at', 'updated_by', 'deleted_at'];
function renderConfig(){
  const box = document.createElement('section'); box.className = 'card'; box.style.marginTop = '20px';
  box.innerHTML = `<h2 style="margin-top:0">Sửa cấu hình</h2>
    <p class="muted">Sửa trực tiếp như trên Google Sheet. Mỗi cột của <b>CAU_HINH</b> là một danh sách (dòng 1 là tên danh sách). Các dòng dạng <b>tên=giá trị</b> (MAC_DINH_BG, THAM_SO, THONG_TIN_CTY) là tham số. Sửa xong bấm Lưu.</p>
    <div class="toolbar"><select id="cfS" style="max-width:520px">${CFG_SHEETS.map((x, i) => `<option value="${i}">${esc(x[1])}: ${esc(x[2])}</option>`).join('')}</select><button class="btn sm" id="cfOpen">Mở</button></div>
    <div id="cfBox"></div>`;
  $('#erpView').appendChild(box);
  $('#cfOpen').onclick = openCfg;
}
async function openCfg(){
  const [book, sheet] = CFG_SHEETS[+$('#cfS').value];
  $('#cfBox').innerHTML = '<div class="skel"></div>';
  let rows;
  try { rows = await Api.call('admin.sheet.get', { book, sheet }); } catch (e) { $('#cfBox').innerHTML = '<p class="pv e">' + esc(e.message) + '</p>'; return; }
  if (!rows.length) rows = [['']];
  const W = Math.max.apply(null, rows.map(r => r.length));
  rows = rows.map(r => { const a = r.slice(); while (a.length < W) a.push(''); return a; });
  const head = rows[0], hidden = book === 'CRM' ? [] : head.map((h, j) => CFG_HIDE.indexOf(h) >= 0 ? j : -1).filter(j => j >= 0);
  const isList = book === 'CRM' && sheet === 'CAU_HINH';
  const draw = () => {
    $('#cfBox').innerHTML = `<div class="tbl-wrap" style="max-height:560px;overflow:auto"><table class="cfg"><thead><tr><th>#</th>${head.map((h, j) => hidden.indexOf(j) >= 0 ? '' : `<th style="text-align:left">${isList ? `<input data-r="0" data-c="${j}" value="${esc(h)}" style="font-weight:800;min-width:140px;background:#fff;color:#17153B">` : esc(h)}</th>`).join('')}<th></th></tr></thead>
      <tbody>${rows.slice(1).map((r, i) => `<tr><td>${i + 1}</td>${r.map((v, j) => hidden.indexOf(j) >= 0 ? '' : `<td style="text-align:left"><input data-r="${i + 1}" data-c="${j}" value="${esc(v)}" style="font-weight:500;min-width:${String(v).length > 30 ? 320 : 140}px"></td>`).join('')}<td><button class="btn ghost sm" data-del="${i + 1}">Xóa dòng</button></td></tr>`).join('')}</tbody></table></div>
      <div class="toolbar" style="margin-top:12px"><button class="btn ghost sm" id="cfAddR">+ Thêm dòng</button>${isList ? '<button class="btn ghost sm" id="cfAddC">+ Thêm danh sách (cột)</button>' : ''}<button class="btn sm" id="cfSave">Lưu ${esc(sheet)}</button></div>`;
    document.querySelectorAll('#cfBox input[data-r]').forEach(inp => inp.oninput = () => { rows[+inp.dataset.r][+inp.dataset.c] = inp.value; });
    document.querySelectorAll('#cfBox [data-del]').forEach(b => b.onclick = () => { rows.splice(+b.dataset.del, 1); draw(); });
    $('#cfAddR').onclick = () => { rows.push(head.map(() => '')); draw(); };
    if (isList) $('#cfAddC').onclick = () => { rows.forEach(r => r.push('')); draw(); };
    $('#cfSave').onclick = async () => {
      const out = rows.filter((r, i) => i === 0 || r.some(v => String(v).trim() !== '')).map(r => r.map(v => { const t = String(v).trim(); return t !== '' && /^-?\d+(\.\d+)?$/.test(t) && !/^0\d/.test(t) ? Number(t) : v; }));
      if (!confirm('Lưu ' + sheet + ' (' + (out.length - 1) + ' dòng)?')) return;
      try { await Api.call('admin.import.sheet', { book, sheet, rows: out }); toast('Đã lưu ' + sheet + '. Tải lại trang để áp dụng.'); } catch (e) { toast(e.message, true); }
    };
  };
  draw();
}

/* ===================== CRM TRONG CÙNG ỨNG DỤNG ===================== */
const CRM_IC = { home: '📊', kh: '👥', bg: '🧾', ht: '🆘', nr: '💳', cl: '❓', daily: '📝', rp: '📈', admin: '🛡️' };
function parkCrm(){ const c = document.getElementById('crm'); if (c && c.parentNode !== document.body) { c.style.display = 'none'; document.body.appendChild(c); } }
function placeCrm(){ const c = document.getElementById('crm'), s = document.getElementById('crmSlot'); if (c && s) { s.appendChild(c); c.style.display = ''; } }
function navItems(){
  const base = NAV.filter(navOk);
  const crm = (S.crmNav || []).map((x, i) => ({ id: 'crm:' + x.p, label: x.p === 'admin' ? 'Phân quyền bán hàng' : x.label, short: x.label.split(' ')[0], ic: CRM_IC[x.p] || '•', grp: i === 0 ? 'Bán hàng' : '' }));
  if (!crm.length) return base;
  const first = base.slice(0, 1), rest = base.slice(1);
  if (rest.length) rest[0] = Object.assign({}, rest[0], { grp: 'Nhân sự' });
  return first.concat(crm, rest);
}
async function initCrm(){
  if (!S.crm || !window.CRMX) return;
  try {
    S.crmNav = await window.CRMX.init(S.token);
    const cur = S.view; shell(); placeCrm(); go(cur);
  } catch (e) { S.crmNav = []; if (!/quyền dùng CRM/.test(e.message)) toast('Chưa mở được phần bán hàng: ' + e.message, true); }
}
window.ERP_LOGOUT = () => logout(true);

})();
