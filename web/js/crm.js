
/* ======================= TIỆN ÍCH ======================= */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const V=()=>$('#view');
const S={token:null,u:null,c:null,page:'',kh:null,khTs:0,home:null,homeTs:0,khMap:{},bg:null,dk:null,care:null,rp:null,dTab:null};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Math.round(Number(n)||0).toLocaleString('vi-VN');
const fmt2=n=>(Number(n)||0).toLocaleString('vi-VN',{maximumFractionDigits:2});
const pct=v=>Math.round((Number(v)||0)*100)+'%';
function pnum(s){if(typeof s==='number')return s;s=String(s==null?'':s).trim().replace(/\s/g,'');if(!s)return 0;
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');else if(/^-?\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');const n=Number(s);return isFinite(n)?n:0;}
const pad=n=>String(n).padStart(2,'0');
function td(){const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function dU(iso){const p=String(iso).slice(0,10).split('-').map(Number);return new Date(Date.UTC(p[0],p[1]-1,p[2]));}
function addDays(iso,n){const d=dU(iso);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
const dow=iso=>dU(iso).getUTCDay();
function dmy(s){if(!s)return'';s=String(s);const t=s.length>10?' '+s.slice(11,16):'';return s.slice(8,10)+'/'+s.slice(5,7)+(s.slice(0,4)!==String(new Date().getFullYear())?'/'+s.slice(2,4):'')+t;}
const L=k=>(S.c.lists[k]||[]);
const opts=(list,sel,blank)=>(blank!==undefined?`<option value="">${esc(blank)}</option>`:'')+list.map(x=>`<option ${String(x)===String(sel)?'selected':''}>${esc(x)}</option>`).join('');
const optsNV=(sel,blank,onlyActive=true)=>(blank!==undefined?`<option value="">${esc(blank)}</option>`:'')+S.c.team.map(x=>`<option value="${esc(x.maNV)}" ${x.maNV===sel?'selected':''}>${esc(x.hoTen)} (${esc(x.maNV)})</option>`).join('');
const isMgr=()=>S.u&&(S.u.vaiTro==='QUANLY'||S.u.vaiTro==='ADMIN');
const blocked=ma=>{const k=S.khMap[ma];if(k&&k.trungKHHT==='Đang chạy'&&S.u.vaiTro!=='ADMIN'){toast('Khách đang giao dịch với công ty — sale không chăm sóc, không báo giá khách này.','bad');return true;}return false;};
const GDC={'Mới - Chưa liên hệ':'#64748B','Đã tiếp cận':'#0E7490','Khai thác nhu cầu':'#4338CA','Đã gửi báo giá':'#7E22CE','Đàm phán - Chờ quyết định':'#A21CAF','Khách mới (đơn đầu)':'#15803D','Khách đang hoạt động':'#047857','Khách VIP':'#A16207','Kho khách ngủ':'#9A3412','Mất khách':'#B42318','Không tiềm năng':'#94A3B8'};
const stageBd=g=>g?`<span class="bd" style="background:${(GDC[g]||'#64748B')}1c;color:${GDC[g]||'#64748B'}">${esc(g)}</span>`:'';
const MDC={'Nóng':'#DC2626','Ấm':'#E8A317','Lạnh':'#3B82F6'};
const dotMd=m=>m?`<span style="white-space:nowrap"><span class="dot" style="background:${MDC[m]||'#999'}"></span>${esc(m)}</span>`:'';
const BTC={'Nháp':'#64748B','Chờ duyệt giá':'#B45309','Đã gửi':'#1D4ED8','Khách đang cân nhắc':'#7E22CE','Đã chốt đơn':'#15803D','Khách từ chối':'#B42318','Hết hạn':'#78716C','Đã thay thế':'#94A3B8'};
const bgBd=t=>`<span class="bd" style="background:${(BTC[t]||'#64748B')}1c;color:${BTC[t]||'#64748B'}">${esc(t)}</span>`;
function tagCb(k){const c=k.canhBao;if(!c)return'';if(c==='KH công ty')return'<span class="tag kc">KH công ty</span>';if(c==='Quá hạn')return`<span class="tag qh">Quá ${k.soNgayQH} ngày</span>`;if(c==='Hôm nay')return'<span class="tag hn">Hôm nay</span>';if(c==='Kho khách ngủ')return'<span class="tag ng">Kho ngủ</span>';return`<span class="tag bq">${esc(c)}</span>`;}
const roleName=r=>({ADMIN:'Quản trị',QUANLY:'Quản lý',SALE:'Nhân viên kinh doanh',KETOAN:'Kế toán'}[r]||r);

/* Gắn nhãn cột vào từng ô để bảng hiển thị dạng thẻ trên điện thoại */
function labelTbl(){$$('table.tbl:not(.ed)').forEach(t=>{const hr=[...t.querySelectorAll('tr')].find(r=>r.querySelector('th'));if(!hr)return;const hs=[...hr.children].map(x=>x.textContent.trim());
  t.querySelectorAll('tr').forEach(tr=>{if(tr===hr)return;let ci=0;[...tr.children].forEach(td=>{if(td.tagName==='TD'&&!td.hasAttribute('data-l'))td.setAttribute('data-l',hs[ci]||'');ci+=Number(td.colSpan)||1;});});});}
new MutationObserver(()=>{clearTimeout(window._lt);window._lt=setTimeout(labelTbl,20);}).observe(document.body,{childList:true,subtree:true});

/* ======================= GỌI MÁY CHỦ ======================= */
function run(fn,...a){return new Promise((res,rej)=>{google.script.run.withSuccessHandler(res).withFailureHandler(e=>{
  let m=String((e&&e.message)||e).replace(/^(Exception|Error):\s*/,'');
  if(m.includes('PHIEN_HET_HAN')){m='Phiên đăng nhập đã hết, vui lòng đăng nhập lại';if(window.ERP_LOGOUT)window.ERP_LOGOUT();}
  rej(new Error(m));}).crm(fn,a);});}  /* [ERP] cổng gọi chung */
const api=(fn,...a)=>run(fn,S.token,...a);
let ldN=0;function loading(on){ldN=Math.max(0,ldN+(on?1:-1));$('#loading').classList.toggle('on',ldN>0);}
async function call(fn,...a){loading(true);try{return await api(fn,...a);}catch(e){if(S.u)toast(e.message,'bad');return null;}finally{loading(false);}}
function toast(msg,type){const d=document.createElement('div');d.className='tt '+(type||'');d.textContent=msg;$('#toast').appendChild(d);setTimeout(()=>d.remove(),type==='bad'?6500:3500);}

/* ======================= ĐĂNG NHẬP ======================= */
async function boot(){
  let tk=null;try{tk=localStorage.getItem('ntcrm_tk');}catch(e){}
  if(tk){S.token=tk;loading(true);try{start(await api('apiStart'));return;}catch(e){S.token=null;}finally{loading(false);}}
  showLogin();
}
function showLogin(){$('#login').classList.remove('hidden');$('#lgMa').focus();}
function setSession(s){S.token=s.token;try{localStorage.setItem('ntcrm_tk',s.token);}catch(e){}}
async function doLogin(){$('#lgErr').textContent='';$('#lgBtn').disabled=true;$('#lgBtn').textContent='Đang đăng nhập…';
  try{const s=await run('apiLoginStart',$('#lgMa').value,$('#lgMk').value);setSession(s);start(s);}
  catch(e){$('#lgErr').textContent=e.message;}finally{$('#lgBtn').disabled=false;$('#lgBtn').textContent='Đăng nhập';}}
$('#lgMk').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
function start(p){S.c=p.boot;S.u=p.boot.user;setKH(p.kh);S.home=p.home;S.homeTs=Date.now();
  $('#login').classList.add('hidden');$('#app').classList.remove('hidden');
  $('#hdDate').textContent=new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
  buildNav();homeBadges(p.home);}  /* [ERP] ERP quyết định mở trang nào */
function homeBadges(d){if(!d)return;setBadge('ht',(d.htCho||[]).length);setBadge('nr',S.u.vaiTro==='SALE'||S.u.vaiTro==='QUANLY'?d.nrTC||0:d.nrCho||0);setBadge('cl',d.clCho||0);}
/* Danh sách khách giữ trên trình duyệt: tìm, lọc tức thì; sau mỗi lần lưu chỉ thay đúng dòng đó. */
const khTen=k=>k.tenCongTy||k.tenLienHe||'';
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase();
function setKH(rows){S.kh=rows||[];S.khTs=Date.now();S.khMap={};S.kh.forEach(k=>{k._f=fold([k.maKH,k.tenLienHe,k.tenCongTy,k.sdt,k.zalo,k.mst,k.nganhHang,k.tinhThanh].join(' '));S.khMap[k.maKH]=k;});}
function patchKH(k){if(!k||!S.kh)return;k._f=fold([k.maKH,k.tenLienHe,k.tenCongTy,k.sdt,k.zalo,k.mst,k.nganhHang,k.tinhThanh].join(' '));
  const i=S.kh.findIndex(x=>x.maKH===k.maKH);if(i>=0)S.kh[i]=k;else S.kh.unshift(k);S.khMap[k.maKH]=k;rerenderLocal();}
function rerenderLocal(){if(S.page==='home')renderHome();else if(S.page==='kh')renderKHTable();}
let khLoading=null;
function reloadKH(){if(khLoading)return khLoading;khLoading=call('apiKHAll').then(d=>{khLoading=null;if(d){setKH(d.rows);rerenderLocal();}return S.kh;});return khLoading;}
function logout(silent){if(!silent&&S.token)run('apiLogout',S.token).catch(()=>{});S.token=null;S.u=null;S.kh=null;S.home=null;
  try{localStorage.removeItem('ntcrm_tk');}catch(e){}closeDrawer();closeModal();$('#app').classList.add('hidden');showLogin();}

/* ======================= ĐIỀU HƯỚNG ======================= */
const IC=p=>`<svg viewBox="0 0 24 24">${p}</svg>`;
const ICON={home:IC('<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>'),
 kh:IC('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>'),
 bg:IC('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/>'),
 daily:IC('<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18M9 15l2 2 4-4"/>'),
 rp:IC('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>'),
 admin:IC('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>'),
 nr:IC('<rect x="2" y="6" width="20" height="14" rx="3"/><path d="M16 13h2M2 10h20M6 6V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/>'),
 cl:IC('<path d="M4 4h16v12H8l-4 4z"/><path d="M12 7v4M12 13.5h.01"/>'),
 ht:IC('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5M12 16.5h.01"/>')};
const ICOL={nr:'#22C55E',cl:'#F97316',home:'#6366F1',kh:'#EC4899',bg:'#F59E0B',ht:'#14B8A6',daily:'#10B981',rp:'#0EA5E9',admin:'#8B5CF6'};
function toggleSide(){if(window.innerWidth<900){document.getElementById('crm').classList.toggle('side-open');return;}
  const a=$('#app');a.classList.toggle('mini');try{localStorage.setItem('ntcrm_mini',a.classList.contains('mini')?'1':'');}catch(e){}}
const PAGES={home:['Bảng điều khiển',()=>pgHome()],kh:['Khách hàng',()=>pgKH()],bg:['Báo giá',()=>pgBG()],ht:['Hỗ trợ khách',()=>pgHT()],nr:['Nạp / rút tiền',()=>pgNR()],cl:['Claim & hỏi đáp',()=>pgCL()],daily:['Báo cáo ngày',()=>pgDaily()],rp:['Báo cáo và KPI',()=>pgReport()],admin:['Nhân sự và phân quyền',()=>pgAdmin()]};
function buildNav(){const items=S.u.vaiTro==='KETOAN'?['nr','cl']:['home','kh','bg','ht','nr','cl','daily','rp'];if(isMgr())items.push('admin');document.getElementById('crm').classList.toggle('kt',S.u.vaiTro==='KETOAN');
  $('#nav').innerHTML=items.map(k=>`<a data-p="${k}" title="${PAGES[k][0]}" style="--c:${ICOL[k]}"><span class="ic">${ICON[k]}</span><span class="lb">${PAGES[k][0]}</span><em class="n hidden" id="nb_${k}"></em></a>`).join('');
  $$('#nav a').forEach(a=>a.onclick=()=>{go(a.dataset.p);document.getElementById('crm').classList.remove('side-open');});
  const ini=String(S.u.hoTen||'?').trim().split(/\s+/).pop().slice(0,1).toUpperCase();
  $('#me').innerHTML=`<div class="av">${esc(ini)}</div><div class="lb"><b>${esc(S.u.hoTen)}</b><span>${esc(S.u.maNV)} · ${roleName(S.u.vaiTro)}</span><div class="mb"><a onclick="openPwd()">Đổi mật khẩu</a><a onclick="logout()">Đăng xuất</a></div></div>`;
  try{if(localStorage.getItem('ntcrm_mini')&&window.innerWidth>=900)$('#app').classList.add('mini');}catch(e){}}
function setBadge(k,n){const e=$('#nb_'+k);if(!e)return;e.textContent=n;e.classList.toggle('hidden',!n);}
function go(p){S.page=p;$$('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.p===p));$('#title').textContent=PAGES[p][0];$('#hdAct').innerHTML='';V().innerHTML='';PAGES[p][1]();}
function refresh(){if(S.page==='home')refreshHome(true);else if(S.page==='kh')renderKHTable();else if(S.page==='bg')loadBG();}
document.addEventListener('keydown',e=>{if(e.key==='F2'){e.preventDefault();quickCare();}if(e.key==='Escape'){if(!$('#modal').classList.contains('hidden'))closeModal();else closeDrawer();}
  if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&S.care&&!$('#modal').classList.contains('hidden'))saveCare();});

/* ======================= DRAWER / MODAL ======================= */
function showDrawer(){$('#drawer').classList.add('on');$('#mask').classList.remove('hidden');document.getElementById('crm').classList.add('drawer-open');}
function closeDrawer(){$('#drawer').classList.remove('on');$('#mask').classList.add('hidden');document.getElementById('crm').classList.remove('drawer-open');S.dk=null;}
function modal(title,body,foot,wide){$('#modal').innerHTML=`<div class="mbox ${wide?'wide':''}"><div class="ph"><h3>${title}</h3><span class="sp"></span><button class="btn s" onclick="closeModal()">Đóng</button></div><div class="pb">${body}</div>${foot?`<div class="mf">${foot}</div>`:''}</div>`;$('#modal').classList.remove('hidden');}
function closeModal(){$('#modal').classList.add('hidden');$('#modal').innerHTML='';S.care=null;S.imgTake=null;}
const chip=(v,on)=>`<span class="chip ${on?'on':''}" data-v="${esc(v)}">${esc(v)}</span>`;
function bindChips(root,onPick){$$('.chips',root).forEach(box=>{box.addEventListener('click',e=>{const c=e.target.closest('.chip');if(!c||box.dataset.lock)return;
  if(box.dataset.multi!==undefined)c.classList.toggle('on');else{$$('.chip',box).forEach(x=>x.classList.remove('on'));c.classList.add('on');}
  if(onPick)onPick(box.dataset.one||box.dataset.k,c.dataset.v);});});}
const chipVal=box=>box.dataset.multi!==undefined?$$('.chip.on',box).map(c=>c.dataset.v):(($('.chip.on',box)||{}).dataset||{}).v||'';

/* ======================= BẢNG ĐIỀU KHIỂN ======================= */
function bandCell(label,v,tg){const r=tg>0?v/tg:0;return`<div><div class="l" title="${esc(label)}">${esc(label)}</div><div class="v">${fmt(v)}${tg>0?`<small> / ${fmt2(tg)}</small>`:''}</div>${tg>0?`<div class="meter"><i class="${r>=1?'ok':r<.5?'lo':''}" style="width:${Math.min(100,r*100)}%"></i></div>`:''}</div>`;}
function pgHome(){renderHome();refreshHome(false);}
async function refreshHome(force){if(!force&&Date.now()-S.homeTs<30000)return;const d=await call('apiHome');if(d){S.home=d;S.homeTs=Date.now();if(S.page==='home')renderHome();}if(Date.now()-S.khTs>120000)reloadKH();}
function renderHome(){const d=S.home;if(!d||!S.kh)return;const kh=S.kh,sc0=($('#homeCan')||{}).scrollTop||0;
  const can=kh.filter(k=>k.canhBao==='Quá hạn'||k.canhBao==='Hôm nay').sort((a,b)=>String(a.ngayHenCham).localeCompare(String(b.ngayHenCham))).slice(0,300);
  const cntOf=f=>kh.filter(f).length;d.can=can;d.cnt={tong:kh.length,quaHan:cntOf(k=>k.canhBao==='Quá hạn'),homNay:cntOf(k=>k.canhBao==='Hôm nay'),nong:cntOf(k=>k.mucDo==='Nóng')};
  d.funnel=S.c.gdThuTu.map(g=>({g,n:cntOf(k=>k.giaiDoan===g)}));
  const keys=['khMoi','tiepCan','ketNoi','chamLai','baoGia','fb','goi','nhanTin'],tg={};d.tg.forEach(t=>tg[t.maChiSo]=t);
  const cells=keys.filter(k=>tg[k]).map(k=>{const x=d.sc.det[k]||{v:d.m[k]||0,tg:0};return bandCell(tg[k].tenChiSo,x.v,x.tg);});
  const sc=d.sc.diem,cls=sc>=85?'g':sc>=70?'a':'r';
  V().innerHTML=`<div class="band" style="--n:${cells.length+1}">${cells.join('')}<div class="score"><div class="l">Điểm KPI hôm nay</div><div class="v">${sc}</div><div class="t">${S.u.vaiTro==='SALE'?(d.daNopBC?'Đã nộp báo cáo ngày':'<a onclick="go(\'daily\')">Chưa nộp báo cáo ngày</a>'):'Gộp '+d.soNguoi+' nhân viên'}</div></div></div>
  <div class="home fill">
    <section class="pane"><div class="ph"><h3>Cần chăm hôm nay</h3><span class="m">${d.cnt.quaHan} quá hạn, ${d.cnt.homNay} đến hạn</span><span class="sp"></span><button class="btn s" onclick="go('kh')">Toàn bộ khách hàng</button></div><div class="scroll" id="homeCan">${tblKH(d.can,true)}</div></section>
    <div class="col">${(d.htCho||[]).length?`<section class="pane" style="max-height:300px"><div class="ph"><h3>Hỗ trợ cần bạn xử lý</h3><span class="m">${d.htCho.length}</span><span class="sp"></span><button class="btn s" onclick="go('ht')">Tất cả</button></div><div class="scroll">${htList(d.htCho)}</div></section>`:''}<section class="pane"><div class="ph"><h3>Phễu khách hàng</h3><span class="m">${d.cnt.tong} khách, ${d.cnt.nong} khách nóng</span></div><div class="pb">${funnel(d.funnel,d.cnt.tong)}</div></section>
      <section class="pane fill"><div class="ph"><h3>Báo giá chờ phản hồi</h3><span class="m">${d.bgCho.length}</span></div><div class="scroll">${d.bgCho.length?`<table class="tbl"><tr><th>Mã BG</th><th>Khách hàng</th><th>Gửi</th><th class="num">Tổng sau VAT</th><th>Trạng thái</th></tr>${d.bgCho.map(b=>`<tr class="ck" onclick="openBG('${b.maBG}')"><td>${b.maBG}</td><td>${esc(b.tenKH)}</td><td>${dmy(b.ngayGui||b.ngayTao)}</td><td class="num">${fmt(b.tongSauVAT)}</td><td>${bgBd(b.trangThai)}</td></tr>`).join('')}</table>`:'<div class="empty">Không có báo giá đang chờ.</div>'}</div></section></div></div>`;
  const hc=$('#homeCan');if(hc)hc.scrollTop=sc0;setBadge('kh',d.cnt.quaHan);homeBadges(d);}
function funnel(list,tot){const mx=Math.max(1,...list.map(x=>x.n));return`<div class="fun">${list.map(x=>`<span>${esc(x.g)}</span><div class="b"><i style="width:${x.n/mx*100}%;background:${GDC[x.g]}"></i></div><b class="num">${x.n}</b>`).join('')}</div>`;}

/* ======================= KHÁCH HÀNG ======================= */
function tblKH(rows,compact){
  if(!rows.length)return'<div class="empty">Không có khách nào cần chăm. Hãy tìm khách mới hoặc chăm sóc khách đang có.</div>';
  return`<table class="tbl"><tr><th>Hẹn chăm</th><th>Khách hàng</th><th>Liên hệ</th>${compact?'':'<th>Loại / Ngành</th><th>Hình thức NK</th>'}<th>Giai đoạn</th><th>Mức độ</th><th>Kết quả gần nhất</th><th class="num">Chăm / BG / Đơn</th>${isMgr()?'<th>Sale</th>':''}<th></th></tr>
  ${rows.map(k=>`<tr class="ck" onclick="openKH('${k.maKH}')"><td>${tagCb(k)||dmy(k.ngayHenCham)}<span class="sub">${k.canhBao?dmy(k.ngayHenCham):''}</span></td>
   <td><b>${esc(k.tenCongTy||k.tenLienHe)}</b><span class="sub">${k.maKH}${k.tenCongTy?' – '+esc(k.tenLienHe):''}</span></td>
   <td>${esc(k.sdt||k.zalo)}<span class="sub">${k.ngayLHGanNhat?'LH '+dmy(k.ngayLHGanNhat):'Chưa liên hệ'}</span></td>
   ${compact?'':`<td>${esc(k.loaiKH)}<span class="sub">${esc(k.nganhHang)}</span></td><td style="max-width:200px">${esc(k.hinhThucNK)}</td>`}
   <td>${stageBd(k.giaiDoan)}</td><td>${dotMd(k.mucDo)}</td><td>${esc(k.ketQuaGanNhat)}</td>
   <td class="num">${k.soLanCham||0} / ${k.soBaoGia||0} / <b>${k.soDon||0}</b></td>${isMgr()?`<td>${esc(k.tenNV)}</td>`:''}
   <td class="act"><button class="btn s" onclick="event.stopPropagation();careFor('${k.maKH}')">Ghi chăm sóc</button> <button class="btn s" onclick="event.stopPropagation();newBG('${k.maKH}')">Báo giá</button></td></tr>`).join('')}</table>`;}
let khTimer=null;
function pgKH(){$('#hdAct').innerHTML='<button class="btn a" onclick="openKH()">Thêm khách hàng</button><button class="btn" onclick="reloadKH()">Tải lại</button>';
  const segs=[['','Tất cả','tong'],['CanCham','Cần chăm','can'],['Quá hạn','Quá hạn','quaHan'],['Bỏ quên','Bỏ quên','boQuen'],['Kho khách ngủ','Kho ngủ','khoNgu']];
  V().innerHTML=`<div class="bar"><input id="fq" placeholder="Tìm tên, SĐT, MST, mã KH, tỉnh…" style="width:270px">
    <select id="fgd">${opts(L('GIAI_DOAN'),'','Mọi giai đoạn')}</select><select id="fmd">${opts(L('MUC_DO'),'','Mọi mức độ')}</select>
    <select id="flo">${opts(L('LOAI_KH'),'','Mọi loại khách')}</select>${isMgr()?`<select id="fnv">${optsNV('','Mọi nhân viên')}</select>`:''}
    <div class="seg" id="fcb">${segs.map(([v,t,c])=>`<button data-v="${v}" class="${v===''?'on':''}">${t}<i id="fc_${c}"></i></button>`).join('')}</div>
    <span class="sp"></span><span class="m" id="fcount"></span></div>
  <section class="pane fill"><div class="scroll" id="khTbl"></div></section>`;
  $('#fq').oninput=()=>{clearTimeout(khTimer);khTimer=setTimeout(renderKHTable,120);};
  $$('#fgd,#fmd,#flo,#fnv').forEach(e=>e.onchange=renderKHTable);
  $('#fcb').onclick=e=>{const b=e.target.closest('button');if(!b)return;$$('#fcb button').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderKHTable();};
/* --- BẮT ĐẦU THÊM MỚI TAB GIAI ĐOẠN --- */
  const gdList = L('GIAI_DOAN') || Object.keys(GDC);
  const stageTabs = `<div class="stage-tabs" id="stgTabs">
    <button data-gd="" class="on" style="--sc: #4F46E5"><span class="t">Tất cả</span><span class="c" id="stc_all">0</span></button>
    ${gdList.map(g => `<button data-gd="${esc(g)}" style="--sc: ${GDC[g]||'#64748B'}"><span class="t">${esc(g)}</span><span class="c" id="stc_${fold(g).replace(/[^a-z0-9]/g,'')}">0</span></button>`).join('')}
  </div>`;
  $('#view .bar').insertAdjacentHTML('afterend', stageTabs);
  $('#fgd').style.display = 'none'; // Ẩn ô chọn giai đoạn cũ đi cho gọn
  $('#stgTabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;$$('#stgTabs button').forEach(x=>x.classList.remove('on'));b.classList.add('on');$('#fgd').value = b.dataset.gd; renderKHTable();};
  /* --- KẾT THÚC THÊM MỚI --- */
  renderKHTable();if(Date.now()-S.khTs>60000)reloadKH();}
function renderKHTable(){if(S.page!=='kh'||!$('#khTbl')||!S.kh)return;const all=S.kh,q=fold($('#fq').value.trim());
  const gd=$('#fgd').value,md=$('#fmd').value,lo=$('#flo').value,nv=$('#fnv')?$('#fnv').value:'',cb=($('#fcb .on')||{dataset:{}}).dataset.v||'';
  const n=f=>all.filter(f).length,set=(id,v)=>{const e=$('#fc_'+id);if(e)e.textContent=v;};
  const qh=n(k=>k.canhBao==='Quá hạn');set('tong',all.length);set('can',qh+n(k=>k.canhBao==='Hôm nay'));set('quaHan',qh);set('boQuen',n(k=>k.canhBao==='Bỏ quên'));set('khoNgu',n(k=>k.giaiDoan==='Kho khách ngủ'));
                     /* --- BẮT ĐẦU THÊM MỚI ĐẾM SỐ KHÁCH --- */
  const stcAll = $('#stc_all'); if(stcAll) stcAll.textContent = all.length;
  (L('GIAI_DOAN') || Object.keys(GDC)).forEach(g => {
    const id = 'stc_' + fold(g).replace(/[^a-z0-9]/g,'');
    const el = $('#' + id);
    if(el) el.textContent = n(k => k.giaiDoan === g);
  });
  /* --- KẾT THÚC THÊM MỚI --- */    
  let r=all.filter(k=>(!q||k._f.includes(q))&&(!gd||k.giaiDoan===gd)&&(!md||k.mucDo===md)&&(!lo||k.loaiKH===lo)&&(!nv||k.maNV===nv)&&
    (!cb||(cb==='CanCham'?(k.canhBao==='Quá hạn'||k.canhBao==='Hôm nay'):k.canhBao===cb||(cb==='Kho khách ngủ'&&k.giaiDoan===cb))));
  const pr={'Quá hạn':0,'Hôm nay':1};r=r.slice().sort((a,b)=>((pr[a.canhBao]??2)-(pr[b.canhBao]??2))||String(a.ngayHenCham||'9').localeCompare(String(b.ngayHenCham||'9')));
  $('#fcount').textContent=`Hiển thị ${Math.min(r.length,500)} / ${r.length} khách`;$('#khTbl').innerHTML=tblKH(r.slice(0,500),false);setBadge('kh',qh);}
const KH_FIELDS=[['tenLienHe','Người liên hệ *','text'],['chucVu','Chức vụ','text'],['tenCongTy','Tên công ty / shop','text',2],
 ['sdt','Số điện thoại *','text'],['zalo','Zalo (SĐT hoặc link)','text'],['mst','Mã số thuế','text'],['email','Email','text'],
 ['facebook','Facebook (link)','text',2],['tinhThanh','Tỉnh / thành phố','text'],['nhomKH','Thuộc nhóm KH (mã KH chính)','text'],
 ['diaChi','Địa chỉ','text',2],['loaiKH','Loại khách *','sel:LOAI_KH'],['nguonKH','Nguồn khách *','sel:NGUON_KH'],
 ['nganhHang','Ngành hàng','sel:NGANH_HANG'],['matHang','Mặt hàng cụ thể','text',2],['doiThu','Đang dùng đơn vị nào','text'],
 ['hinhThucNK','Hình thức nhập khẩu','sel:HINH_THUC_NK',2],['phapNhan','Pháp nhân','sel:PHAP_NHAN'],['canHoaDon','Nhu cầu hóa đơn','sel:CAN_HOA_DON'],
 ['tanSuat','Tần suất nhập','sel:TAN_SUAT'],['giaTriDuKien','Giá trị nhập / tháng','sel:GIA_TRI'],['giaiDoan','Giai đoạn','sel:GIAI_DOAN'],['mucDo','Mức độ','sel:MUC_DO'],
 ['dichVu','Dịch vụ quan tâm','multi:DICH_VU',4],['dacThuHang','Đặc thù hàng hóa','multi:DAC_THU_HANG',4],
 ['ngayHenCham','Ngày hẹn chăm','date'],['sinhNhat','Sinh nhật / ngày kỷ niệm','text'],['maNV','Sale phụ trách','owner',2],
 ['ghiChu','Ghi chú (nhu cầu, tính cách, điều cần lưu ý)','area',4]];
function khForm(k){return`<div class="g4">${KH_FIELDS.map(([key,label,type,span])=>{const v=k[key]==null?'':k[key],cls=span===4?'s4':span===2?'s2':'';
  let inp;
  if(type==='text')inp=`<input data-k="${key}" value="${esc(v)}">`;
  else if(type==='date')inp=`<input type="date" data-k="${key}" value="${esc(String(v).slice(0,10))}">`;
  else if(type==='area')inp=`<textarea data-k="${key}" rows="3">${esc(v)}</textarea>`;
  else if(type.startsWith('sel:'))inp=`<select data-k="${key}">${opts(L(type.slice(4)),v,'— Chọn —')}</select>`;
  else if(type.startsWith('multi:')){const on=String(v).split(',').map(s=>s.trim());inp=`<div class="chips" data-k="${key}" data-multi>${L(type.slice(6)).map(x=>chip(x,on.includes(x))).join('')}</div>`;}
  else if(type==='owner'){if(!isMgr()||!k.maKH)inp=`<input disabled value="${esc(k.tenNV||S.u.hoTen)}">`;
    else inp=`<div style="display:flex;gap:6px"><select data-k="maNV" style="flex:1">${optsNV(k.maNV)}</select><input data-k="lyDoChuyen" placeholder="Lý do nếu chuyển" style="flex:1"></div>`;}
  return`<div class="f ${cls}"><label>${esc(label)}</label>${inp}</div>`;}).join('')}</div>`;}
function collectKH(){const o={};$$('#drawer [data-k]').forEach(e=>{if(e.classList.contains('chips'))o[e.dataset.k]=chipVal(e);else o[e.dataset.k]=e.value;});return o;}
async function openKH(maKH){if(maKH){const d=await call('apiGetKH',maKH);if(!d)return;S.dk=Object.assign(d,{tab:(S.dk&&S.dk.kh&&S.dk.kh.maKH===maKH)?S.dk.tab:'info'});}
  else S.dk={kh:{giaiDoan:S.c.gd.MOI,mucDo:'Lạnh',ngayHenCham:td()},logs:[],bgs:[],chuyen:[],ht:[],nr:[],tab:'info'};
  renderDrawer();showDrawer();}
function dtab(v){if(S.dk.tab==='info')Object.assign(S.dk.kh,collectKH());S.dk.tab=v;renderDrawer();}
function renderDrawer(){const d=S.dk,k=d.kh,isNew=!k.maKH;
  const tabs=[['info','Thông tin'],['nr','Nạp / rút ('+(d.nr||[]).length+')'],['ht','Hỗ trợ ('+(d.ht||[]).length+')'],['log','Lịch sử chăm sóc ('+d.logs.filter(x=>x.kenh!=='Hệ thống').length+')'],['bg','Báo giá ('+d.bgs.length+')'],['chuyen','Chuyển giao ('+(d.chuyen||[]).length+')']];
  $('#drawer').innerHTML=`<div class="dh"><div><h2>${isNew?'Khách hàng mới':esc(k.tenCongTy||k.tenLienHe)}</h2>${isNew?'<div class="m">Hệ thống kiểm tra trùng theo MST và SĐT/Zalo trước khi lưu (Sổ tay 8.1).</div>':`<div class="m">${k.maKH} – ${esc(k.tenLienHe)} – ${esc(k.sdt||k.zalo)} ${stageBd(k.giaiDoan)} ${dotMd(k.mucDo)} ${tagCb(k)} <span class="own">${k.soHuu==='Chủ khách'?'Chủ khách':'Đang theo'}: ${esc(k.tenNV)}</span></div>`}</div><span class="sp"></span>
   ${isNew?'':`<button class="btn" onclick="htNew('${k.maKH}')">${k.maNV===S.u.maNV?'Nhờ quản lý hỗ trợ':'Chỉ đạo sale'}</button><button class="btn" onclick="careFor('${k.maKH}')">Ghi chăm sóc</button><button class="btn" onclick="newBG('${k.maKH}')">Tạo báo giá</button>`}<button class="btn" onclick="closeDrawer()">Đóng</button></div>
   ${k.trungKHHT==='Đang chạy'?'<div class="flag bad"><b>Khách đang giao dịch với công ty.</b> Sale bị khóa chăm sóc và báo giá. Admin xử lý: chuyển cho người phụ trách hoặc chuyển "Không tiềm năng".</div>':k.trungKHHT==='Khách cũ đã ngủ'?'<div class="flag warn"><b>Khách cũ của công ty đã ngủ.</b> Được phép đánh thức.</div>':''}
   ${isNew?'<div class="flag warn" id="chkNew" style="display:none"></div>':''}
   ${isNew?'':`<div class="tabs">${tabs.map(([v,t])=>`<a class="${d.tab===v?'on':''}" onclick="dtab('${v}')">${t}</a>`).join('')}</div>`}
   <div class="db">${d.tab==='info'?khForm(k):d.tab==='nr'?khNR(d.nr||[],k):d.tab==='ht'?khHT(d.ht||[],k):d.tab==='log'?khLogs(d.logs):d.tab==='bg'?khBGs(d.bgs,k):khChuyen(d.chuyen||[])}</div>
   ${d.tab==='info'?`<div class="mf"><span class="m">${isNew?'':`Tạo ${dmy(k.ngayTao)}, chăm ${k.soLanCham||0} lần, ${k.soBaoGia||0} báo giá, ${k.soDon||0} đơn${k.ngayDonGanNhat?', đơn gần nhất '+dmy(k.ngayDonGanNhat):''}`}</span><span class="sp"></span><button class="btn p" onclick="saveKH()">Lưu khách hàng</button></div>`:''}`;
  if(d.tab==='info')bindChips($('#drawer'));
  if(isNew)$$('#drawer [data-k="sdt"],#drawer [data-k="zalo"],#drawer [data-k="mst"]').forEach(e=>e.addEventListener('change',()=>liveCheck(e.value)));}
async function liveCheck(v){v=String(v||'').replace(/\D/g,'');if(v.length<9)return;const b=$('#chkNew');if(!b)return;
  try{const r=await api('apiCheckTrung',v);b.style.display='flex';b.className='flag '+(r.tone==='ok'?'warn':r.tone);if(r.tone==='ok'){b.style.background='var(--greenBg)';b.style.color='#065F46';}else{b.style.background='';b.style.color='';}b.innerHTML='<b>'+esc(r.msg)+'</b> '+esc(r.sub||'');}catch(e){}}
function khHT(list,k){return`<div style="margin-bottom:10px"><button class="btn a" onclick="htNew('${k.maKH}')">${k.maNV===S.u.maNV?'Nhờ quản lý hỗ trợ khách này':'Chỉ đạo sale về khách này'}</button></div>`+(list.length?`<div class="pane">${htList(list)}</div>`:'<div class="empty">Chưa có yêu cầu hỗ trợ hay chỉ đạo nào cho khách này.</div>');}
function khLogs(logs){if(!logs.length)return'<div class="empty">Chưa có lần chăm sóc nào.</div>';
  return`<ul class="tl">${logs.map(c=>`<li class="${c.kenh==='Hệ thống'?'sys':''}"><div class="t"><b>${dmy(c.thoiGian)}</b>${esc(c.tenNV)}</div><div><div class="h">${c.kenh==='Hệ thống'?'<span class="bd" style="background:#EEF2EF">Hệ thống</span>':`<b>${esc(c.kenh)}</b><span class="m">${esc(c.mucDich)}</span><span class="bd" style="background:${c.thanhCong==='Có'?'var(--greenBg)':'var(--redBg)'};color:${c.thanhCong==='Có'?'var(--green)':'var(--red)'}">${esc(c.ketQua)}</span>${dotMd(c.mucDo)}`}${c.maBG?`<a onclick="openBG('${esc(c.maBG)}')">${esc(c.maBG)}</a>`:''}</div><div class="c">${esc(c.noiDung)}</div>${c.ngayHenTiep&&c.kenh!=='Hệ thống'?`<div class="m">Hẹn chăm tiếp ${dmy(c.ngayHenTiep)}</div>`:''}</div></li>`).join('')}</ul>`;}
function khBGs(bgs,k){return`<div style="margin-bottom:10px"><button class="btn a" onclick="newBG('${k.maKH}')">Tạo báo giá mới</button></div>`+(bgs.length?`<table class="tbl"><tr><th>Mã BG</th><th>Ngày</th><th>Mã đơn</th><th>Hàng</th><th class="num">Tổng sau VAT</th><th>Trạng thái</th><th></th></tr>${bgs.map(b=>`<tr class="ck" onclick="openBG('${b.maBG}')"><td>${b.maBG}${b.phienBan>1?' v'+b.phienBan:''}</td><td>${dmy(b.ngayGui||b.ngayTao)}</td><td>${esc(b.maDon)}</td><td class="long">${esc(b.tomTatHang)}</td><td class="num">${fmt(b.tongSauVAT)}</td><td>${bgBd(b.trangThai)}${b.lyDo?`<span class="sub">${esc(b.lyDo)}</span>`:''}</td><td class="act"><button class="btn s" onclick="event.stopPropagation();cloneBG('${b.maBG}')">Nhân bản</button></td></tr>`).join('')}</table>`:'<div class="empty">Chưa có báo giá.</div>');}
function khChuyen(list){return list.length?`<table class="tbl"><tr><th>Thời gian</th><th>Từ</th><th>Sang</th><th>Lý do</th><th>Người thực hiện</th></tr>${list.map(r=>`<tr><td>${dmy(r.thoiGian)}</td><td>${esc(r.tuNV)}</td><td>${esc(r.denNV)}</td><td class="long">${esc(r.lyDo)}</td><td>${esc(r.nguoiThucHien)}</td></tr>`).join('')}</table>`:'<div class="empty">Khách chưa từng được chuyển người phụ trách.</div>';}
async function saveKH(){const o=collectKH();o.maKH=S.dk.kh.maKH||'';if(o.maNV===undefined)delete o.maNV;
  const r=await call('apiSaveKH',o);if(!r)return;toast('Đã lưu khách hàng '+r.maKH,'ok');if(r.warn)toast(r.warn);patchKH(r.kh);
  S.dk=Object.assign(S.dk||{},{kh:r.full,logs:S.dk&&S.dk.logs||[],bgs:S.dk&&S.dk.bgs||[],chuyen:S.dk&&S.dk.chuyen||[],ht:S.dk&&S.dk.ht||[],tab:'info'});renderDrawer();}

/* ======================= CHĂM SÓC ======================= */
function suggestNext(gd,md){if(gd===S.c.gd.LOAI)return'';const n=S.c.nhip;let d=Math.min(n.giaiDoan[gd]||99,n.mucDo[md]||99);if(d===99)d=7;let r=addDays(td(),d);if(dow(r)===0)r=addDays(r,1);return r;}
const KQ_GOI_Y={'Trao đổi được - có quan tâm':['Khai thác nhu cầu','Ấm'],'Xin báo giá':['Khai thác nhu cầu','Nóng'],'Hẹn gọi lại':[null,'Ấm'],'Trao đổi được - chưa có nhu cầu':[null,'Lạnh'],'Đang dùng đơn vị khác':[null,'Lạnh'],'Chê giá cao':['Đàm phán - Chờ quyết định','Ấm'],'Đồng ý chốt đơn':[null,'Nóng'],'Từ chối hẳn':[null,'Lạnh']};
async function careFor(maKH){if(blocked(maKH))return;let k=S.khMap[maKH];if(S.dk&&S.dk.kh&&S.dk.kh.maKH===maKH)k=S.dk.kh;if(!k){const d=await call('apiGetKH',maKH);if(!d)return;k=d.kh;}openCare(k);}
function quickCare(){if(!S.kh)return;
  modal('Ghi chăm sóc nhanh — chọn khách',`<div class="f"><label>Gõ tên, SĐT hoặc mã KH rồi chọn (phím tắt F2)</label><input id="qcK" list="qcL"><datalist id="qcL">${S.kh.filter(k=>k.giaiDoan!=='Không tiềm năng').map(k=>`<option value="${esc(k.maKH+' | '+khTen(k)+' | '+(k.sdt||''))}">`).join('')}</datalist></div>`,'<button class="btn p" onclick="quickCareGo()">Tiếp tục</button>');
  setTimeout(()=>{const i=$('#qcK');i.focus();i.addEventListener('change',quickCareGo);},50);}
function quickCareGo(){const ma=String($('#qcK').value).split('|')[0].trim(),k=S.khMap[ma];if(!k){toast('Chọn khách trong danh sách gợi ý','bad');return;}closeModal();openCare(k);}
function openCare(k,pre){const first=!(Number(k.soLanCham)>0);S.care={maKH:k.maKH,kenh:'Gọi điện',ketQua:'',mucDo:k.mucDo||'Lạnh',first,gd0:k.giaiDoan};
  const md=first?'Tiếp cận lần đầu':'Khai thác nhu cầu';
  modal('Ghi chăm sóc: '+esc(k.tenCongTy||k.tenLienHe||k.ten||k.maKH),`<div class="g4">
   <div class="f s4"><label>Kênh liên hệ</label><div class="chips" data-one="kenh">${L('KENH').map(x=>chip(x,x==='Gọi điện')).join('')}</div></div>
   <div class="f s2"><label>Mục đích</label><select id="cMd">${L('MUC_DICH').map(x=>`<option ${x===md?'selected':''} ${x==='Tiếp cận lần đầu'&&!first?'disabled':''}>${esc(x)}</option>`).join('')}</select></div>
   <div class="f s2"><label>Giai đoạn sau lần chăm này</label><select id="cGd">${opts(L('GIAI_DOAN'),k.giaiDoan||S.c.gd.MOI)}</select></div>
   <div class="f s4"><label>Kết quả</label><div class="chips" data-one="ketQua">${L('KET_QUA').map(x=>chip(x)).join('')}</div></div>
   <div class="f s4"><label>Nội dung trao đổi (tối thiểu 15 ký tự)</label><textarea id="cNd" rows="4" placeholder="Khách nhập mặt hàng gì, khối lượng, đang dùng đơn vị nào, vướng gì, hẹn gì…"></textarea></div>
   <div class="f"><label>Mức độ</label><div class="chips" data-one="mucDo">${L('MUC_DO').map(x=>chip(x,x===S.care.mucDo)).join('')}</div></div>
   <div class="f"><label>Hẹn chăm tiếp</label><input type="date" id="cHen" min="${td()}"></div>
   <div class="f"><label>Mã báo giá liên quan</label><input id="cBg" placeholder="Không bắt buộc"></div>
   <div class="f"><label>&nbsp;</label><div class="m" id="cHint"></div></div></div>`,
   '<span class="m">Ctrl + Enter để lưu</span><span class="sp"></span><button class="btn" onclick="closeModal()">Hủy</button><button class="btn p" onclick="saveCare()">Lưu chăm sóc</button>',true);
  bindChips($('#modal'),(f,v)=>{S.care[f]=v;
    if(f==='ketQua'){const nd=$('#cNd');if(S.c.kqThatBai.includes(v)&&!nd.value.trim())nd.value=v+' — '+(S.care.kenh||'')+'. Sẽ liên hệ lại.';
      const g=KQ_GOI_Y[v];if(g){if(g[0]&&S.c.gdThuTu.indexOf($('#cGd').value)<S.c.gdThuTu.indexOf(g[0]))$('#cGd').value=g[0];if(g[1])setMd(g[1]);}
      if(v==='Đồng ý chốt đơn')toast('Nhớ chuyển báo giá sang "Đã chốt đơn" để hệ thống ghi nhận đơn.');}
    sugHen();});
  $('#cGd').onchange=sugHen;sugHen();
  if(pre){Object.assign(S.care,{kenh:pre.kenh,ketQua:pre.ketQua,mucDo:pre.mucDo});['kenh','ketQua','mucDo'].forEach(f=>$$(`#modal [data-one="${f}"] .chip`).forEach(c=>c.classList.toggle('on',c.dataset.v===pre[f])));
    $('#cMd').value=pre.mucDich;$('#cGd').value=pre.giaiDoanSau;$('#cNd').value=pre.noiDung;$('#cHen').value=pre.ngayHenTiep;$('#cBg').value=pre.maBG||'';}
  setTimeout(()=>$('#cNd').focus(),60);}
function setMd(v){S.care.mucDo=v;$$('#modal [data-one="mucDo"] .chip').forEach(c=>c.classList.toggle('on',c.dataset.v===v));}
function sugHen(){const r=suggestNext($('#cGd').value,S.care.mucDo);$('#cHen').value=r;$('#cHint').textContent=r?'Gợi ý theo nhịp chăm: '+dmy(r):'Không cần hẹn chăm tiếp';}
async function saveCare(){if(!S.care)return;const c=S.care,o={maKH:c.maKH,kenh:c.kenh,mucDich:$('#cMd').value,ketQua:c.ketQua,noiDung:$('#cNd').value,mucDo:c.mucDo,giaiDoanSau:$('#cGd').value,ngayHenTiep:$('#cHen').value,maBG:$('#cBg').value};
  if(!o.ketQua){toast('Chọn kết quả của lần liên hệ','bad');return;}
  if(o.noiDung.trim().length<15){toast('Nội dung tối thiểu 15 ký tự','bad');return;}
  if(o.ngayHenTiep&&o.ngayHenTiep<td()){toast('Ngày hẹn không được ở quá khứ','bad');return;}
  const prev=S.khMap[o.maKH],kRef=prev||(S.dk&&S.dk.kh)||{maKH:o.maKH};closeModal();
  if(prev)patchKH(Object.assign({},prev,{ketQuaGanNhat:o.ketQua,ngayHenCham:o.ngayHenTiep,mucDo:o.mucDo,giaiDoan:o.giaiDoanSau,ngayLHGanNhat:td(),soLanCham:(Number(prev.soLanCham)||0)+1,canhBao:'',soNgayQH:0}));
  toast('Đang lưu chăm sóc…');loading(true);
  try{const r=await api('apiAddCare',o);patchKH(r.kh);toast('Đã ghi chăm sóc. Hẹn tiếp '+(r.ngayHenTiep?dmy(r.ngayHenTiep):'—'),'ok');
    if(S.dk&&S.dk.kh&&S.dk.kh.maKH===o.maKH){S.dk.tab='log';openKH(o.maKH);}if(S.page==='home')refreshHome(true);}
  catch(e){toast('Chưa lưu được: '+e.message,'bad');if(prev)patchKH(prev);openCare(kRef,o);}
  finally{loading(false);}}

/* ======================= BÁO GIÁ ======================= */
let bgTimer=null;
function pgBG(){$('#hdAct').innerHTML='<button class="btn a" onclick="newBG()">Tạo báo giá</button>';
  V().innerHTML=`<div class="bar"><input id="bq" placeholder="Mã BG, khách, mã đơn, mặt hàng…" style="width:260px"><span class="m">Tạo từ</span><input type="date" id="bfr" value="${addDays(td(),-60)}"><span class="m">đến</span><input type="date" id="bto" value="${td()}">
   <select id="btt">${opts(L('TRANG_THAI_BG'),'','Mọi trạng thái')}</select>${isMgr()?`<select id="bnv">${optsNV('','Mọi nhân viên')}</select>`:''}<span class="sp"></span><span class="m" id="bcount"></span></div>
   <section class="pane fill"><div class="scroll" id="bgTbl"></div></section>`;
  $('#bq').oninput=()=>{clearTimeout(bgTimer);bgTimer=setTimeout(loadBG,350);};$$('#bfr,#bto,#btt,#bnv').forEach(e=>e.onchange=loadBG);
  
  /* --- BẮT ĐẦU THÊM MỚI TAB TRẠNG THÁI BÁO GIÁ --- */
  const bgList = L('TRANG_THAI_BG') || Object.keys(BTC);
  const bgTabs = `<div class="stage-tabs" id="bgTabs">
    <button data-tt="" class="on" style="--sc: #4F46E5"><span class="t">Tất cả</span><span class="c" id="btc_all">0</span></button>
    ${bgList.map(t => `<button data-tt="${esc(t)}" style="--sc: ${BTC[t]||'#64748B'}"><span class="t">${esc(t)}</span><span class="c" id="btc_${fold(t).replace(/[^a-z0-9]/g,'')}">0</span></button>`).join('')}
  </div>`;
  
  // Chèn HTML tab vào dưới thanh tìm kiếm (bar)
  $('#view .bar').insertAdjacentHTML('afterend', bgTabs);
  // Ẩn ô chọn trạng thái (select dropdown) cũ cho gọn
  $('#btt').style.display = 'none'; 
  
  // Xử lý khi click vào tab
  $('#bgTabs').onclick = e => {
    const b = e.target.closest('button');
    if(!b) return;
    $$('#bgTabs button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    $('#btt').value = b.dataset.tt; // Gán giá trị tab vào ô select ẩn
    loadBG(); // Tải lại danh sách
  };
  /* --- KẾT THÚC THÊM MỚI --- */

  loadBG();
}
async function loadBG(){if(S.page!=='bg'||!$('#bgTbl'))return;const d=await call('apiListBG',{q:$('#bq').value,tuNgay:$('#bfr').value,denNgay:$('#bto').value,trangThai:$('#btt').value,maNV:$('#bnv')?$('#bnv').value:''});if(!d||!$('#bgTbl'))return;
  $('#bcount').textContent=Object.keys(d.cnt).map(k=>k+': '+d.cnt[k]).join(', ');setBadge('bg',d.cnt['Chờ duyệt giá']&&S.c.duyetGia?d.cnt['Chờ duyệt giá']:0);
  
  /* --- BẮT ĐẦU THÊM MỚI ĐẾM SỐ BÁO GIÁ --- */
  const btcAll = $('#btc_all');
  if (btcAll) {
    let total = 0;
    for (let k in d.cnt) total += (d.cnt[k] || 0);
    btcAll.textContent = total;
  }
  
  (L('TRANG_THAI_BG') || Object.keys(BTC)).forEach(t => {
    const id = 'btc_' + fold(t).replace(/[^a-z0-9]/g,'');
    const el = $('#' + id);
    if(el) el.textContent = d.cnt[t] || 0;
  });
  /* --- KẾT THÚC THÊM MỚI --- */

  $('#bgTbl').innerHTML=d.rows.length?`<table class="tbl"><tr><th>Mã BG</th><th>Tạo</th><th>Gửi</th><th>Khách hàng</th><th>Mã đơn</th><th>Hàng</th><th class="num">Tổng sau VAT</th><th class="num">LN ước tính</th><th>Trạng thái</th>${isMgr()?'<th>Sale</th>':''}<th></th></tr>
   ${d.rows.map(b=>`<tr class="ck" onclick="openBG('${b.maBG}')"><td><b>${b.maBG}</b>${b.phienBan>1?' v'+b.phienBan:''}</td><td>${dmy(b.ngayTao)}</td><td>${dmy(b.ngayGui)}</td><td>${esc(b.tenKH)}<span class="sub">${esc(b.maKH)}</span></td><td>${esc(b.maDon)}</td><td class="long">${esc(b.tomTatHang)}</td><td class="num">${fmt(b.tongSauVAT)}</td><td class="num">${fmt(b.lnUocTinh)}</td><td>${bgBd(b.trangThai)}${b.canhBaoGia&&/CẤM|DUYỆT/.test(b.canhBaoGia)?`<span class="sub r">${b.duyetBoi?'Đã duyệt: '+esc(b.duyetBoi):'Phá khung giá'}</span>`:''}</td>${isMgr()?`<td>${esc(b.tenNV)}</td>`:''}
   <td class="act"><button class="btn s" onclick="event.stopPropagation();printBG('${b.maBG}')">In</button> <button class="btn s" onclick="event.stopPropagation();cloneBG('${b.maBG}')">Nhân bản</button></td></tr>`).join('')}</table>`:'<div class="empty">Chưa có báo giá trong khoảng thời gian này.</div>';}
  $('#bgTbl').innerHTML=d.rows.length?`<table class="tbl"><tr><th>Mã BG</th><th>Tạo</th><th>Gửi</th><th>Khách hàng</th><th>Mã đơn</th><th>Hàng</th><th class="num">Tổng sau VAT</th><th class="num">LN ước tính</th><th>Trạng thái</th>${isMgr()?'<th>Sale</th>':''}<th></th></tr>
   ${d.rows.map(b=>`<tr class="ck" onclick="openBG('${b.maBG}')"><td><b>${b.maBG}</b>${b.phienBan>1?' v'+b.phienBan:''}</td><td>${dmy(b.ngayTao)}</td><td>${dmy(b.ngayGui)}</td><td>${esc(b.tenKH)}<span class="sub">${esc(b.maKH)}</span></td><td>${esc(b.maDon)}</td><td class="long">${esc(b.tomTatHang)}</td><td class="num">${fmt(b.tongSauVAT)}</td><td class="num">${fmt(b.lnUocTinh)}</td><td>${bgBd(b.trangThai)}${b.canhBaoGia&&/CẤM|DUYỆT/.test(b.canhBaoGia)?`<span class="sub r">${b.duyetBoi?'Đã duyệt: '+esc(b.duyetBoi):'Phá khung giá'}</span>`:''}</td>${isMgr()?`<td>${esc(b.tenNV)}</td>`:''}
   <td class="act"><button class="btn s" onclick="event.stopPropagation();printBG('${b.maBG}')">In</button> <button class="btn s" onclick="event.stopPropagation();cloneBG('${b.maBG}')">Nhân bản</button></td></tr>`).join('')}</table>`:'<div class="empty">Chưa có báo giá trong khoảng thời gian này.</div>';}

const BG_NUM_H=['tyGia','shipNoiDiaTe','soKg','donGiaKg','soKhoi','donGiaKhoi','phiDVPct','phiDVTien','phiUTPct','phiKeKhai','phiHopQuy','phiKTCL','phiKhac','lamTron','tyLeXuat','tndnPct'];
const BG_NUM_L=['soLuong','donGiaTe','thueNKPct','vatPct','pctCuoc','giaXuatNhap'];
const emptyLine=()=>({tenHang:'',moTa:'',hsCode:'',dvt:'Chiếc',soLuong:'',donGiaTe:'',thueNKPct:'',vatPct:S.c.md.vatPct,pctCuoc:'',giaXuatNhap:''});
function bgDefaults(){const m=S.c.md;return{maBG:'',maKH:'',maDon:'',tyGia:m.tyGia,hinhThucNK:'',shipNoiDiaTe:'',soKg:'',donGiaKg:m.donGiaKg,soKhoi:'',donGiaKhoi:m.donGiaKhoi,phiDVPct:m.phiDVPct,phiDVTien:'',phiUTPct:m.phiUTPct,coSoUT:m.coSoUyThac,phiKeKhai:0,phiHopQuy:0,phiKTCL:0,phiKhac:0,tenPhiKhac:'',lamTron:m.lamTron,cheDoXuat:'du',tyLeXuat:100,tndnPct:m.tndnPct||20,coSoUT:m.coSoUyThac==='tienHang'?'tienHang':'giaXuat',coSoThueNK:m.coSoThueNK==='giaXuat'?'giaXuat':'toKhai',ghiChu:'',trangThai:'Nháp',phienBan:1};}
async function ensureGon(){if(!S.kh)await reloadKH();return S.kh||[];}
async function newBG(maKH,seed){if(maKH&&blocked(maKH))return;await ensureGon();closeDrawer();const h=Object.assign(bgDefaults(),seed?seed.h:{});
  if(maKH){h.maKH=maKH;const k=S.khMap[maKH];if(k&&!h.hinhThucNK)h.hinhThucNK=k.hinhThucNK||'';}
  S.bg={h,lines:seed?seed.lines:[emptyLine()],dirty:false};enterEditor();}
async function openBG(maBG){const d=await call('apiGetBG',maBG);if(!d)return;await ensureGon();closeDrawer();S.bg={h:d.bg,lines:d.lines.map(l=>({tenHang:l.tenHang,moTa:l.moTa,hsCode:l.hsCode,dvt:l.dvt,soLuong:l.soLuong,donGiaTe:l.donGiaTe,thueNKPct:l.thueNKPct,vatPct:l.vatPct,pctCuoc:l.pctCuoc,giaXuatNhap:l.giaXuatNhap})),dirty:false};enterEditor();}
async function cloneBG(maBG){const d=await call('apiGetBG',maBG);if(!d)return;const b=d.bg,h={};
  ['maKH','tyGia','hinhThucNK','shipNoiDiaTe','soKg','donGiaKg','soKhoi','donGiaKhoi','phiDVPct','phiDVTien','phiUTPct','phiKeKhai','phiHopQuy','phiKTCL','phiKhac','tenPhiKhac','lamTron','cheDoXuat','tyLeXuat','coSoThueNK','coSoUT','tndnPct'].forEach(k=>h[k]=b[k]);h.tyGia=S.c.md.tyGia;h.ghiChu='Nhân bản từ '+maBG;
  await newBG(b.maKH,{h,lines:d.lines.map(l=>({tenHang:l.tenHang,moTa:l.moTa,hsCode:l.hsCode,dvt:l.dvt,soLuong:l.soLuong,donGiaTe:l.donGiaTe,thueNKPct:l.thueNKPct,vatPct:l.vatPct,pctCuoc:l.pctCuoc,giaXuatNhap:l.giaXuatNhap}))});toast('Đã nhân bản. Kiểm tra lại tỷ giá, số lượng rồi lưu.');}
function enterEditor(){S.page='bgEdit';$$('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.p==='bg'));$('#hdAct').innerHTML='';renderBGEditor();}
const bgLocked=()=>['Đã chốt đơn','Khách từ chối','Đã thay thế','Hết hạn'].includes(S.bg.h.trangThai);

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
  const phiDVTien = Math.max(0, Math.round(N(h.phiDVTien))); // Phí dịch vụ cố định (đ): có nhập thì thay cho %
  const phiDVPct = phiDVTien > 0 && tienHang > 0 ? phiDVTien * 100 / tienHang : N(h.phiDVPct), phiUTPct = N(h.phiUTPct), phiKeKhai = N(h.phiKeKhai), phiHopQuy = N(h.phiHopQuy), phiKTCL = N(h.phiKTCL), phiKhac = N(h.phiKhac);
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
    phiDVPct, phiDVTien, phiDV, phiUTPct, phiUT, phiKeKhai, phiHopQuy, phiKTCL, phiKhac, thueNK, thueNKDu, toKhai, lam, lamTronChenh, tong, tongDu, chenh, tndnPct,
    thuThemTNDN, thueNKTang, tongChiPhiThuc, tongThu: tongChiPhiThuc + vat, vat, tongSau: tong + vat, ln, cb, err };
}
const calcBG=(h,lines)=>calcCore(h,lines,S.c.md,pnum);
function renderBGEditor(){const h=S.bg.h,lk=bgLocked(),dis=lk?'disabled':'';$('#title').textContent=h.maBG?'Báo giá '+h.maBG:'Báo giá mới';
  const kh=S.khMap[h.maKH],khv=kh?kh.maKH+' | '+khTen(kh)+' | '+(kh.sdt||''):(h.maKH?h.maKH+' | '+(h.tenKH||''):'');
  const I=(k,label,cls,ph)=>`<div class="f ${cls||''}"><label>${label}</label><input data-h="${k}" class="num" value="${esc(h[k]==null?'':h[k])}" ${dis} ${ph?`placeholder="${ph}"`:''}></div>`;
  const cd=h.cheDoXuat==='thap'||h.cheDoXuat==='cao'?h.cheDoXuat:'du';
  V().innerHTML=`<div class="bge fill"><div class="col">
   <section class="pane"><div class="ph"><h3>${h.maBG?esc(h.maBG)+(h.phienBan>1?' (v'+h.phienBan+')':''):'Báo giá mới'}</h3>${bgBd(h.trangThai)}${h.duyetBoi?`<span class="m">Giá đã duyệt bởi ${esc(h.duyetBoi)}</span>`:''}${h.bgGoc?`<span class="m">Thay cho ${esc(h.bgGoc)}</span>`:''}<span class="sp"></span>${lk?'<span class="m">Báo giá đã khóa. Dùng Nhân bản để tạo đơn mới cho khách.</span>':''}<button class="btn s" onclick="go('bg')">Về danh sách</button></div>
    <div class="pb g8">
     <div class="f s3"><label>Khách hàng *</label><input id="bKH" list="dlKH" value="${esc(khv)}" ${dis||(h.maBG?'disabled':'')} placeholder="Gõ tên, SĐT hoặc mã KH"><datalist id="dlKH">${S.kh.filter(k=>k.giaiDoan!=='Không tiềm năng').map(k=>`<option value="${esc(k.maKH+' | '+khTen(k)+' | '+(k.sdt||''))}">`).join('')}</datalist></div>
     <div class="f"><label>Mã đơn hệ thống</label><input data-h="maDon" value="${esc(h.maDon||'')}" ${dis} placeholder="MD1534"></div>
     ${I('tyGia','Tỷ giá RMB/VND *')}
     <div class="f s3"><label>Hình thức nhập khẩu</label><select data-h="hinhThucNK" ${dis}>${opts(L('HINH_THUC_NK'),h.hinhThucNK,'— Chọn —')}</select></div>
     ${I('shipNoiDiaTe','Ship nội địa TQ cả đơn (¥)','','0')}${I('soKg','Cân nặng cả lô (kg)','','ước tính')}${I('donGiaKg','Đơn giá / kg')}${I('soKhoi','Số khối cả lô (m³)','','ước tính')}${I('donGiaKhoi','Đơn giá / m³')}
     ${I('phiDVPct','Phí dịch vụ (%)')}${I('phiDVTien','Phí dịch vụ cố định (đ)','','để trống = tính theo %')}${I('phiUTPct','Phí ủy thác (%)')}
     <div class="f"><label>Chế độ xuất hóa đơn</label><select data-h="cheDoXuat" id="bCd" ${dis}><option value="du" ${cd==='du'?'selected':''}>Đủ giá trị</option><option value="thap" ${cd==='thap'?'selected':''}>Xuất thấp hơn</option><option value="cao" ${cd==='cao'?'selected':''}>Xuất cao hơn</option></select></div>
     ${I('phiKeKhai','Phí kê khai < 100kg')}${I('phiHopQuy','Phí hợp quy')}${I('lamTron','Làm tròn giá đến')}
     <div class="f"><label>% so với giá đủ (áp cho dòng chưa nhập giá)</label><input data-h="tyLeXuat" id="bTl" class="num" value="${esc(cd==='du'?100:(h.tyLeXuat||''))}" ${dis||(cd==='du'?'disabled':'')} placeholder="${cd==='thap'?'≥ '+(S.c.md.tyLeXuatMin||70):'VD: 115'}"></div>
     <div class="f" id="bTNw" style="${h.cheDoXuat==='cao'?'':'display:none'}"><label>Thuế TNDN thu thêm (%)</label><input data-h="tndnPct" class="num" value="${esc(h.tndnPct==null||h.tndnPct===''?(S.c.md.tndnPct||20):h.tndnPct)}" ${dis} title="Mặc định 20%. Hạ xuống nếu hỗ trợ khách"></div>
     <div class="f"><label>Phí ủy thác tính trên</label><select data-h="coSoUT" id="bUT" ${dis}><option value="giaXuat" ${h.coSoUT!=='tienHang'?'selected':''}>Giá xuất</option><option value="tienHang" ${h.coSoUT==='tienHang'?'selected':''}>Tiền hàng</option></select></div>
     <div class="f s2"><label>Thuế NK tính trên</label><select data-h="coSoThueNK" ${dis}><option value="toKhai" ${h.coSoThueNK!=='giaXuat'?'selected':''}>Trị giá khai APT (giá xuất × ${String(S.c.md.heSoToKhai||0.9425).replace('.',',')})</option><option value="giaXuat" ${h.coSoThueNK==='giaXuat'?'selected':''}>Giá xuất (như bảng báo giá cũ)</option></select></div>
     ${I('phiKTCL','Phí kiểm tra chất lượng')}${I('phiKhac','Phí khác')}<div class="f s2"><label>Tên phí khác (in trên báo giá)</label><input data-h="tenPhiKhac" value="${esc(h.tenPhiKhac||'')}" ${dis} placeholder="VD: Phí kiểm dịch, phí lưu kho…"></div>
     <div class="f s4"><label>Ghi chú trên báo giá</label><input data-h="ghiChu" value="${esc(h.ghiChu||'')}" ${dis}></div>
    </div></section>
   <section class="pane fill"><div class="ph"><h3>Hàng hóa</h3><span class="m">Cước chia theo tiền hàng. Dòng nào hàng to / nặng bất thường thì gõ "% cước" áng chừng, phần còn lại tự chia cho các dòng khác.</span><span class="sp"></span>${lk?'':'<button class="btn s" onclick="addLine()">Thêm dòng hàng</button>'}</div>
    <div class="scroll"><table class="tbl ed"><thead><tr><th style="width:24px">#</th><th style="min-width:130px">Tên hàng *</th><th style="min-width:130px">Mô tả / quy cách</th><th style="min-width:84px">HS code</th><th style="min-width:78px">ĐVT</th><th style="min-width:72px">SL *</th><th style="min-width:76px">Đơn giá ¥</th><th style="min-width:58px">Thuế NK %</th><th style="min-width:52px">VAT %</th><th style="min-width:86px">% cước</th><th class="num">Cước</th><th class="num" style="min-width:${(S.bg.h.cheDoXuat==='thap'||S.bg.h.cheDoXuat==='cao')?120:0}px">${(S.bg.h.cheDoXuat==='thap'||S.bg.h.cheDoXuat==='cao')?'Giá xuất chọn / ĐV':'Giá xuất / ĐV'}</th><th class="num">Giá khai APT / ĐV</th><th class="num">Tổng trước VAT</th><th></th></tr></thead><tbody id="bLines"></tbody></table></div></section>
  </div><aside class="pane sum"><div class="ph"><h3>Cấu thành chi phí</h3></div><div class="pb scroll" id="bSum"></div><div class="mf" id="bAct" style="flex-wrap:wrap"></div></aside></div>`;
  renderLines();bgActions();
  const ed=$('.bge');ed.addEventListener('input',e=>{const t=e.target;if(t.dataset.h){S.bg.h[t.dataset.h]=t.value;S.bg.dirty=true;}else if(t.dataset.l){S.bg.lines[+t.dataset.i][t.dataset.l]=t.value;S.bg.dirty=true;}else return;clearTimeout(bgTimer);bgTimer=setTimeout(recalc,120);});
  ed.addEventListener('change',e=>{if(e.target.dataset.h){S.bg.h[e.target.dataset.h]=e.target.value;S.bg.dirty=true;recalc();}});
  $('#bCd').addEventListener('change',()=>{const v=$('#bCd').value,t=$('#bTl');t.disabled=v==='du';if(v==='du'){t.value=100;}else if(v==='thap'&&pnum(t.value)>=100){t.value=S.c.md.tyLeXuatMin||70;}else if(v==='cao'&&pnum(t.value)<=100){t.value=110;}S.bg.h.tyLeXuat=t.value;t.placeholder=v==='thap'?'≥ '+(S.c.md.tyLeXuatMin||70):'VD: 115';
    const ut=$('#bUT');if(ut){ut.value=v==='thap'?'tienHang':'giaXuat';S.bg.h.coSoUT=ut.value;}const tn=$('#bTNw');if(tn)tn.style.display=v==='cao'?'':'none';renderLines();recalc();});
  const kin=$('#bKH');if(kin)kin.addEventListener('change',()=>{const ma=kin.value.split('|')[0].trim(),k=S.khMap[ma];if(!k){toast('Chọn khách trong danh sách gợi ý','bad');return;}S.bg.h.maKH=k.maKH;S.bg.dirty=true;
    if(!S.bg.h.hinhThucNK&&k.hinhThucNK){S.bg.h.hinhThucNK=k.hinhThucNK;const s=$('[data-h="hinhThucNK"]');if(s)s.value=k.hinhThucNK;}});
  recalc();}
function renderLines(){const lk=bgLocked(),dis=lk?'disabled':'';$('#bLines').innerHTML=S.bg.lines.map((l,i)=>{const F=(k,cls,ph)=>`<input data-l="${k}" data-i="${i}" class="${cls||''}" value="${esc(l[k]==null?'':l[k])}" ${dis} ${ph?`placeholder="${ph}"`:''}>`;
  return`<tr><td class="m">${i+1}</td><td>${F('tenHang')}</td><td>${F('moTa')}</td><td>${F('hsCode')}</td><td><input data-l="dvt" data-i="${i}" list="dlDVT" value="${esc(l.dvt||'')}" ${dis}></td><td>${F('soLuong','num')}</td><td>${F('donGiaTe','num')}</td><td>${F('thueNKPct','num')}</td><td>${F('vatPct','num')}</td><td>${F('pctCuoc','num','tự động')}</td>
   <td class="c" id="lc${i}a"></td><td class="c" id="lc${i}b">${(S.bg.h.cheDoXuat==='thap'||S.bg.h.cheDoXuat==='cao')?`${F('giaXuatNhap','num')}<span class="sub m" id="lc${i}bs"></span>`:''}</td><td class="c" id="lc${i}c"></td><td class="c" id="lc${i}d"></td><td>${lk||S.bg.lines.length<2?'':`<button class="btn s d" onclick="delLine(${i})" title="Xóa dòng">✕</button>`}</td></tr>`;}).join('')+`<datalist id="dlDVT">${L('DVT').map(x=>`<option value="${esc(x)}">`).join('')}</datalist>`;}
function addLine(){S.bg.lines.push(emptyLine());renderLines();recalc();const r=$$('#bLines tr').pop();if(r)$('input',r).focus();}
function delLine(i){S.bg.lines.splice(i,1);S.bg.dirty=true;renderLines();recalc();}
function recalc(){const c=calcBG(S.bg.h,S.bg.lines);S.bg.calc=c;
  c.all.forEach((l,i)=>{const a=$('#lc'+i+'a');if(!a)return;const ok=l.ok&&l.giaXuat;a.textContent=ok?fmt(l.cuocPB):'';if(c.cheDo==='du')$('#lc'+i+'b').textContent=ok?fmt2(l.giaXuat):'';else{const gi=$(`[data-l="giaXuatNhap"][data-i="${i}"]`),bs=$('#lc'+i+'bs');if(gi)gi.placeholder=ok?fmt2(l.giaXuat):'';if(bs)bs.textContent=ok?'đủ: '+fmt2(l.giaXuatDu):'';}
    $('#lc'+i+'c').textContent=ok?fmt(l.giaKhai):'';$('#lc'+i+'d').textContent=ok?fmt(l.tongTruocVAT):'';
    const pc=$(`[data-l="pctCuoc"][data-i="${i}"]`);if(pc)pc.placeholder=l.ok&&l.tyLeCuoc!=null?'tự '+fmt2(l.tyLeCuoc)+'%':'tự động';});
  const R=(a,b,sub,cls)=>`<div class="row"><span>${a}${sub?`<span class="sub m">${sub}</span>`:''}</span><b class="${cls||''}">${b}</b></div>`;
  const cam=c.cb.filter(x=>x.startsWith('CẤM')),duyet=c.cb.filter(x=>x.startsWith('DUYỆT')),lu=c.cb.filter(x=>x.startsWith('LƯU Ý'));
  const kTxt=String(c.k).replace('.',',');
  $('#bSum').innerHTML=R('Tiền hàng',fmt(c.tienHang),'¥'+fmt2(c.tienHangTe)+' × '+fmt(c.ty))+R('Ship nội địa TQ',fmt(c.shipNoiDia))+
   '<div class="sec">Mục phí chính</div>'+R('Vận chuyển TQ – Hà Nội',fmt(c.phiVC),c.phiVC?(c.vcKg>=c.vcKhoi?'theo cân: ':'theo khối: ')+'kg '+fmt(c.vcKg)+' / khối '+fmt(c.vcKhoi):'')+R(c.phiDVTien>0?'Phí dịch vụ (cố định, ≈'+fmt2(c.phiDVPct)+'%)':'Phí dịch vụ '+fmt2(c.phiDVPct)+'%',fmt(c.phiDV))+
   R('Phí ủy thác '+fmt2(c.phiUTPct)+'%',fmt(c.phiUT),c.coSo==='tienHang'?'tính trên tiền hàng (xuất thấp)':'tính trên giá xuất')+
   '<div class="sec">Mục phí phát sinh</div>'+R('Phí kê khai < 100kg',fmt(c.phiKeKhai))+R('Phí hợp quy',fmt(c.phiHopQuy))+(c.phiKTCL?R('Phí kiểm tra chất lượng',fmt(c.phiKTCL)):'')+(c.phiKhac?R(esc(S.bg.h.tenPhiKhac||'Phí khác'),fmt(c.phiKhac)):'')+R('Thuế nhập khẩu',fmt(c.thueNK),c.thueTrenGX?'thuế suất × giá xuất':'thuế suất × trị giá khai APT')+
   '<div class="sec">Giá xuất</div>'+R('Giá đủ giá trị (A)',fmt(c.tongDu))+
   (c.cheDo==='thap'?R('Giá xuất hóa đơn ('+fmt2(c.r*100)+'% A)',fmt(c.tong),'','r')+R('Chi phí thực của đơn',fmt(c.tongChiPhiThuc),'tiền hàng, ship, cước, phí, thuế NK thực, ủy thác'):'')+
   (c.cheDo==='cao'?R('Giá xuất hóa đơn ('+fmt2(c.r*100)+'% A)',fmt(c.tong))+R('Chênh so với A',fmt(c.chenh))+R('Thu thêm TNDN '+c.tndnPct+'% phần chênh',fmt(c.thuThemTNDN),'','r')+(c.thueNKTang?R('Thuế NK tăng thêm do tờ khai cao hơn',fmt(c.thueNKTang),'','r'):'')+R('Tổng thu thêm khách',fmt(c.thuThemTNDN+c.thueNKTang),'','r'):'')+
   R('Tổng trước VAT (hóa đơn)',fmt(c.tong))+R('VAT',fmt(c.vat))+`<div class="row" style="border:0;padding-top:10px"><span>Tổng sau VAT</span><span class="big">${fmt(c.tongSau)}</span></div>`+
   (c.cheDo==='du'?R('Số tiền thu của khách (gồm VAT)',fmt(c.tongThu),'tiền hàng + ship + cước + phí + thuế NK + VAT')+R('Chênh hóa đơn so với số thu',(c.lamTronChenh>0?'+':'')+fmt(c.lamTronChenh),'do làm tròn đơn giá xuất',Math.abs(c.lamTronChenh)>c.all.filter(x=>x.ok).reduce((a,x)=>a+x.soLuong,0)?'r':'g'):'')+
   R('Tờ khai APT',fmt(c.toKhai),'giá xuất × '+kTxt+' ÷ (1 + thuế NK) · '+`<a onclick="bangAPT()">xem bảng khai APT</a>`)+
   `<div class="row"><span>LN ước tính (nội bộ, chưa gồm đàm phán NCC)</span><b class="${c.ln<0?'r':'g'}">${fmt(c.ln)}</b></div>`+
   (c.err?`<div class="warnbox r">${esc(c.err)}</div>`:'')+(cam.length?`<div class="warnbox r"><b>Không được phép:</b> ${cam.map(esc).join('; ')}</div>`:'')+
   (duyet.length?`<div class="warnbox a"><b>Cần Trưởng phòng trở lên duyệt:</b> ${duyet.map(esc).join('; ')}${S.bg.h.duyetBoi?' (đã duyệt)':''}</div>`:'')+(lu.length?`<div class="warnbox a">${lu.map(esc).join('; ')}</div>`:'');}
function bangAPT(){const c=S.bg.calc;if(!c)return;const rows=[];c.all.forEach((l,i)=>{if(!l.ok||!l.giaXuat)return;const x=S.bg.lines[i];rows.push([rows.length+1,x.tenHang,x.moTa||'',x.hsCode||'',fmt2(l.soLuong),x.dvt||'',l.giaKhai,l.triGiaKhai,l.thueNKPct+'%',l.thueNK]);});
  S.aptRows=rows;
  modal('Bảng khai gửi APT'+(S.bg.h.maBG?' – '+esc(S.bg.h.maBG):''),`<p class="m" style="margin-top:0">Đơn giá khai = giá xuất cho khách × ${String(c.k).replace('.',',')} ÷ (1 + thuế suất NK). Thuế NK = thuế suất × trị giá khai.</p><div style="overflow:auto"><table class="tbl"><tr><th>STT</th><th>Tên hàng</th><th>Mô tả</th><th>HS</th><th class="num">SL</th><th>ĐVT</th><th class="num">Đơn giá khai</th><th class="num">Trị giá khai</th><th class="num">Thuế suất</th><th class="num">Thuế NK</th></tr>
   ${rows.map(r=>`<tr><td>${r[0]}</td><td>${esc(r[1])}</td><td class="long">${esc(r[2])}</td><td>${esc(r[3])}</td><td class="num">${r[4]}</td><td>${esc(r[5])}</td><td class="num">${fmt(r[6])}</td><td class="num">${fmt(r[7])}</td><td class="num">${r[8]}</td><td class="num">${fmt(r[9])}</td></tr>`).join('')}
   <tr class="tot"><td colspan="7">Tổng</td><td class="num">${fmt(c.toKhai)}</td><td></td><td class="num">${fmt(c.thueNK)}</td></tr></table></div>
   ${(()=>{const thueKhai=c.all.reduce((a,l)=>a+(l.ok&&l.giaXuat?Math.round(l.triGiaKhai*l.thueNKPct/100):0),0),apt=Math.round((c.toKhai+thueKhai)*1.03),nt=Math.round(apt*1.03);return`<div class="kv2" style="margin-top:12px"><span>Kiểm tra chuỗi giá</span><span></span><span>APT xuất cho Nam Trung</span><b>(${fmt(c.toKhai)} + ${fmt(thueKhai)}) × 1,03 = ${fmt(apt)}</b><span>Nam Trung xuất khách</span><b>${fmt(apt)} × 1,03 = ${fmt(nt)} ${Math.abs(nt-c.tong)<=c.tong*0.001?'<span class="g">≈ giá xuất '+fmt(c.tong)+' ✓</span>':'<span class="r">≠ giá xuất '+fmt(c.tong)+'</span>'}</b></div>`;})()}`,
   '<span class="sp"></span><button class="btn p" onclick="copyAPT()">Sao chép để dán vào Excel / Zalo</button>',true);}
function copyAPT(){const h=['STT','Tên hàng','Mô tả','HS','SL','ĐVT','Đơn giá khai','Trị giá khai','Thuế suất','Thuế NK'];const txt=[h.join('\t')].concat(S.aptRows.map(r=>r.join('\t'))).join('\n');
  const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy');}catch(e){}ta.remove();toast(ok?'Đã sao chép bảng khai APT':'Trình duyệt chặn sao chép, hãy bôi đen bảng và Ctrl+C',ok?'ok':'bad');}
function bgActions(){const h=S.bg.h,t=h.trangThai,b=[];
  if(!bgLocked()&&t!=='Chờ duyệt giá'){b.push('<button class="btn" onclick="saveBG(\'nhap\')">Lưu nháp</button>');b.push(`<button class="btn p" onclick="saveBG('gui')">${['Đã gửi','Khách đang cân nhắc'].includes(t)?'Lưu phiên bản mới và gửi':'Lưu và gửi khách'}</button>`);}
  if(t==='Chờ duyệt giá'){b.push('<span class="m">Đang chờ Trưởng phòng duyệt giá</span>');if(S.c.duyetGia)b.push(`<button class="btn a" onclick="duyetModal('${h.maBG}')">Duyệt giá</button>`);b.push('<button class="btn" onclick="saveBG(\'nhap\')">Sửa và lưu lại</button>');}
  if(h.maBG){b.push(`<button class="btn" onclick="printBG('${h.maBG}')">Xem và in</button>`);b.push(`<button class="btn" onclick="pdfBG('${h.maBG}')">Lưu PDF</button>`);b.push(`<button class="btn" onclick="cloneBG('${h.maBG}')">Nhân bản</button>`);}
  if(['Đã gửi','Khách đang cân nhắc'].includes(t))b.push(`<button class="btn a" onclick="statusModal('${h.maBG}')">Cập nhật kết quả</button>`);
  if(h.linkPDF)b.push(`<a href="${esc(h.linkPDF)}" target="_blank" class="m">Mở PDF đã lưu</a>`);
  $('#bAct').innerHTML=b.join('');}
async function saveBG(action){const h=Object.assign({},S.bg.h);if(!h.maKH){toast('Chọn khách hàng','bad');return;}
  BG_NUM_H.forEach(k=>h[k]=pnum(h[k]));const lines=S.bg.lines.map(l=>{const o=Object.assign({},l);BG_NUM_L.forEach(k=>o[k]=((k==='vatPct'||k==='pctCuoc'||k==='giaXuatNhap')&&(l[k]===''||l[k]==null))?'':pnum(l[k]));return o;});
  const r=await call('apiSaveBG',h,lines,action);if(!r)return;
  toast(r.trangThai==='Chờ duyệt giá'?'Báo giá phá khung giá: đã chuyển Trưởng phòng duyệt trước khi gửi.':r.trangThai==='Đã gửi'?'Đã lưu và ghi nhận gửi khách: '+r.maBG:'Đã lưu nháp '+r.maBG,r.trangThai==='Chờ duyệt giá'?'':'ok');
  patchKH(r.kh);await openBG(r.maBG);}
async function printBG(maBG){if(S.bg&&S.bg.dirty&&S.bg.h.maBG===maBG){toast('Báo giá có thay đổi chưa lưu. Lưu trước khi in.','bad');return;}
  const r=await call('apiBGHtml',maBG);if(!r)return;S.prMa=maBG;S.pr=r;
  modal('Xem trước báo giá '+maBG,`<div class="prbar">
    <div class="f" style="flex:2 1 240px"><label>Nội dung chuyển khoản (in trên báo giá và mã QR)</label><input id="prND" value="${esc(r.noiDungCK||'')}" placeholder="VD: NT12345 chuyen khoan coc — mã khách trên hệ thống đơn hàng"></div>
    <div class="f" style="flex:1 1 210px"><label>Khách chuyển</label><select id="prK"><option value="coc">Cọc theo tiền hàng + phí dịch vụ</option><option value="tong">Toàn bộ đơn</option><option value="nhap">Tự nhập số tiền</option></select></div>
    <div class="f" style="flex:0 0 80px" id="prTLw"><label>% cọc</label><input id="prTL" class="num" value="${r.tyLeCoc}"></div>
    <div class="f" style="flex:1 1 150px"><label>Số tiền (đ)</label><input id="prST" class="num" value="${fmt(r.soTienCK)}" style="font-weight:700"></div>
    <button class="btn p" onclick="prRefresh()">Cập nhật báo giá</button></div>
   <div class="m" id="prInfo" style="margin:-4px 0 8px"></div>
   <div id="printArea" style="background:#fff;padding:8px">${r.html}</div>`,
   '<span class="m">Kiểm tra nội dung và số tiền chuyển khoản trước khi gửi khách.</span><span class="sp"></span><button class="btn" onclick="pdfBG(S.prMa)">Lưu PDF vào Drive</button><button class="btn p" onclick="window.print()">In / Lưu PDF từ trình duyệt</button>',true);
  $('#prK').value=r.kieuCK;prUI();
  $('#prK').onchange=()=>{prUI();prPreview();if($('#prK').value!=='nhap')prRefresh();};
  $('#prTL').oninput=prPreview;$('#prTL').onchange=prRefresh;
  $('#prST').addEventListener('blur',e=>{e.target.value=fmt(pnum(e.target.value));});
  ['prND','prST','prTL'].forEach(id=>$('#'+id).addEventListener('keydown',e=>{if(e.key==='Enter')prRefresh();}));
  if(!r.qrOk)toast('Chưa tạo được mã QR. Admin vào Sheet → menu Nam Trung CRM → "6. Kiểm tra mã QR thanh toán".','bad');
  setTimeout(()=>{const i=$('#prND');if(i&&!i.value)i.focus();},60);}
function prUI(){const k=$('#prK').value,r=S.pr;$('#prTLw').style.display=k==='coc'?'':'none';$('#prST').readOnly=k!=='nhap';$('#prST').style.background=k==='nhap'?'':'#F4F6F3';
  $('#prInfo').innerHTML=`Tổng thanh toán: <b>${fmt(r.tongSauVAT)} đ</b> · Tiền hàng + phí dịch vụ: <b>${fmt(r.coSoCoc)} đ</b>`+(k==='nhap'?' · Để 0 nếu muốn QR không gắn số tiền.':'');}
function prPreview(){const k=$('#prK').value,r=S.pr;if(k==='tong')$('#prST').value=fmt(r.tongSauVAT);if(k==='coc')$('#prST').value=fmt(Math.min(r.tongSauVAT,Math.ceil(r.coSoCoc*pnum($('#prTL').value)/100/1000)*1000));}
const prCK=()=>({kieu:$('#prK').value,tyLe:pnum($('#prTL').value),soTien:pnum($('#prST').value)});
async function prRefresh(){const r=await call('apiBGHtml',S.prMa,$('#prND').value,prCK());if(!r)return;S.pr=r;$('#printArea').innerHTML=r.html;$('#prST').value=fmt(r.soTienCK);prUI();
  toast(r.qrOk?'Đã cập nhật nội dung, số tiền và mã QR':'Đã cập nhật, nhưng chưa tạo được mã QR',r.qrOk?'ok':'bad');}
async function pdfBG(maBG){if(S.bg&&S.bg.dirty&&S.bg.h.maBG===maBG){toast('Lưu báo giá trước khi tạo PDF','bad');return;}
  const inPr=!!$('#prND');const r=await call('apiBGPdf',maBG,inPr?$('#prND').value:null,inPr?prCK():null);if(!r)return;
  modal('Đã lưu PDF',`<p>File đã lưu trong thư mục Drive <b>NamTrung_BaoGia_PDF</b>.</p><input value="${esc(r.url)}" onclick="this.select()" readonly><p><a href="${esc(r.url)}" target="_blank">Mở file PDF</a></p>`);if(S.bg&&S.bg.h.maBG===maBG){S.bg.h.linkPDF=r.url;if($('#bAct'))bgActions();}}
function statusModal(maBG){modal('Cập nhật kết quả báo giá '+maBG,`<div class="g2"><div class="f"><label>Kết quả</label><select id="sTT" onchange="$('#sDon').parentNode.classList.toggle('hidden',this.value!=='Đã chốt đơn');$('#sLD').parentNode.classList.toggle('hidden',this.value!=='Khách từ chối')">${opts(['Khách đang cân nhắc','Đã chốt đơn','Khách từ chối','Hết hạn'],'Đã chốt đơn')}</select></div>
   <div class="f"><label>Mã đơn trên hệ thống đơn hàng *</label><input id="sDon" value="${esc(S.bg&&S.bg.h.maBG===maBG?S.bg.h.maDon||'':'')}"></div><div class="f hidden"><label>Lý do từ chối *</label><select id="sLD">${opts(L('LY_DO_TU_CHOI'),'','— Chọn —')}</select></div></div>
   <p class="m">Chốt đơn: hệ thống cộng số đơn cho khách. Đơn đầu tiên xác lập chủ khách theo Sổ tay 8.1 và khóa báo giá.</p>`,'<button class="btn" onclick="closeModal()">Hủy</button><button class="btn p" onclick="saveStatus(\''+maBG+'\')">Lưu kết quả</button>');}
async function saveStatus(maBG){const r=await call('apiSetBGStatus',maBG,$('#sTT').value,$('#sLD').value,$('#sDon').value);if(!r)return;closeModal();toast('Đã cập nhật: '+r.trangThai,'ok');patchKH(r.kh);if(S.page==='bgEdit')openBG(maBG);else refresh();}
function duyetModal(maBG){modal('Duyệt giá '+maBG,`<p>${esc(S.bg.calc?S.bg.calc.cb.join('; '):'')}</p><div class="f"><label>Ghi chú duyệt (lý do chấp nhận / không chấp nhận)</label><textarea id="dGc" rows="3"></textarea></div>`,`<button class="btn d" onclick="doDuyet('${maBG}',false)">Không duyệt</button><button class="btn p" onclick="doDuyet('${maBG}',true)">Duyệt giá</button>`);}
async function doDuyet(maBG,ok){const r=await call('apiDuyetBG',maBG,ok,$('#dGc').value);if(!r)return;closeModal();toast(ok?'Đã duyệt giá. Sale có thể gửi khách.':'Đã trả lại báo giá cho sale.','ok');openBG(maBG);}

/* ======================= KIỂM TRA TRÙNG ======================= */
function openCheck(){modal('Kiểm tra trước khi tiếp cận khách',`<p class="m" style="margin-top:0">Gõ SĐT hoặc MST của khách vừa tìm được. Hệ thống đối chiếu với khách đang chạy của công ty và khách của các sale khác.</p>
  <div style="display:flex;gap:8px"><input id="ckQ" placeholder="0912 345 678 hoặc 0101234567" style="font-size:16px;height:40px"><button class="btn p" style="height:40px" onclick="doCheck()">Kiểm tra</button></div><div id="ckR"></div>`);
  setTimeout(()=>{const i=$('#ckQ');i.focus();i.addEventListener('keydown',e=>{if(e.key==='Enter')doCheck();});},50);}
async function doCheck(){const r=await call('apiCheckTrung',$('#ckQ').value);if(!r)return;
  $('#ckR').innerHTML=`<div class="chk ${r.tone}"><b>${esc(r.msg)}</b>${esc(r.sub||'')}${r.maKH?` <a onclick="closeModal();openKH('${esc(r.maKH)}')">Mở hồ sơ</a>`:''}${r.tone==='ok'&&!r.maKH?' <a onclick="closeModal();openKH()">Tạo hồ sơ khách</a>':''}</div>`;$('#ckQ').select();}

/* ======================= HỖ TRỢ & CHỈ ĐẠO ======================= */
const HTC={'Chờ quản lý':'q','Chờ sale':'s','Đã xong':'x'};
const htBd=t=>`<span class="ttc ${HTC[t]||'q'}">${esc(t)}</span>`;
function htList(list){S.htMap=S.htMap||{};return'<div class="htl">'+list.map(r=>{S.htMap[r.maHT]=r;const last=(r.traoDoi||[]).slice(-1)[0];
  return`<a onclick="openHT('${r.maHT}')"><div class="t1">${htBd(r.trangThai)}${r.mucUuTien==='Gấp'?'<span class="ttc g">Gấp</span>':''}<b>${esc(r.tenKH)}</b><span class="m">${esc(r.chuDe)} · ${r.loai==='Sale nhờ hỗ trợ'?'Sale '+esc(r.tenSale)+' nhờ':esc(r.tenTao)+' chỉ đạo'}</span><span class="sp"></span><span class="m">${dmy(r.capNhatLuc||r.thoiGian)}</span></div>
  <div class="t2">${last?esc(last.ten)+': '+esc(last.nd):esc(r.noiDung)}</div></a>`;}).join('')+'</div>';}
function htNew(maKH){const k=S.khMap[maKH]||(S.dk&&S.dk.kh)||{};const laSale=k.maNV===S.u.maNV;
  modal((laSale?'Nhờ quản lý hỗ trợ: ':'Chỉ đạo sale: ')+esc(khTen(k)),`<div class="g2">
   <div class="f"><label>Chủ đề</label><select id="hCd">${opts(L('CHU_DE_HO_TRO'),'','— Chọn —')}</select></div>
   <div class="f"><label>Mức ưu tiên</label><select id="hUt">${opts(['Bình thường','Gấp'],'Bình thường')}</select></div>
   <div class="f s4"><label>${laSale?'Khách đang vướng gì, em cần anh/chị hỗ trợ việc gì':'Việc sale cần làm với khách này, hạn và kết quả mong muốn'}</label><textarea id="hNd" rows="5" placeholder="${laSale?'VD: Khách nhập bộ nồi inox 3 lớp, hỏi mã HS và có cần công bố không; khách chê phí ủy thác 1%, xin 0,8%…':'VD: Gọi lại trước thứ 6, đề xuất gom 2 lô để đủ khối, gửi case khách gia dụng tương tự…'}"></textarea></div></div>
   <p class="m">${laSale?'Quản lý trực tiếp của bạn (hoặc Admin) sẽ thấy yêu cầu này trên bảng điều khiển, kèm toàn bộ thông tin và lịch sử chăm sóc khách.':'Sale sẽ thấy chỉ đạo này trên bảng điều khiển và phải phản hồi hoặc báo kết quả.'}</p>`,
   '<button class="btn" onclick="closeModal()">Hủy</button><button class="btn p" onclick="htCreate(\''+maKH+'\')">Gửi</button>');}
async function htCreate(maKH){const r=await call('apiHTCreate',{maKH,chuDe:$('#hCd').value,mucUuTien:$('#hUt').value,noiDung:$('#hNd').value});if(!r)return;closeModal();toast('Đã gửi '+r.maHT,'ok');
  if(S.dk&&S.dk.kh&&S.dk.kh.maKH===maKH){S.dk.tab='ht';openKH(maKH);}if(S.page==='ht')loadHT();}
async function openHT(maHT){const d=await call('apiHTGet',maHT);if(!d)return;S.htCur=d;const r=d.ht,k=d.kh||{},open=r.trangThai!=='Đã xong';
  const thread=[{t:r.thoiGian,by:r.nguoiTao,ten:r.tenTao,nd:r.noiDung}].concat(r.traoDoi||[]);
  modal(`${r.maHT} · ${esc(r.chuDe)} ${htBd(r.trangThai)}`,`<div class="htg"><div>
    <div class="thr">${thread.map(x=>`<div class="bub ${x.by===S.u.maNV?'me':''}"><div class="who">${esc(x.ten||x.by)} · ${dmy(x.t)}</div>${esc(x.nd)}</div>`).join('')}
    ${!open?`<div class="chk ok"><b>Đã xong</b>${esc(r.ketQua||'')}</div>`:''}</div>
    ${open?`<div class="f" style="margin-top:12px"><label>Trả lời / cập nhật</label><textarea id="hRp" rows="3" placeholder="${S.u.maNV===r.maNVSale?'Đã làm gì, khách phản hồi thế nào':'Hướng xử lý, câu chữ gợi ý, giá được duyệt…'}"></textarea></div>`:''}</div>
   <div><div class="kv2"><span>Khách</span><span><a onclick="closeModal();openKH('${esc(r.maKH)}')"><b>${esc(r.tenKH)}</b></a> (${esc(r.maKH)})</span><span>Sale phụ trách</span><span>${esc(r.tenSale)}</span>
    ${[['Liên hệ',k.tenLienHe+' – '+(k.sdt||k.zalo||'')],['Loại / ngành',(k.loaiKH||'')+' / '+(k.nganhHang||'')],['Mặt hàng',k.matHang],['Hình thức NK',k.hinhThucNK],['Pháp nhân / HĐ',(k.phapNhan||'')+' / '+(k.canHoaDon||'')],['Đặc thù hàng',k.dacThuHang],['Tần suất / giá trị',(k.tanSuat||'')+' / '+(k.giaTriDuKien||'')],['Đang dùng',k.doiThu],['Giai đoạn',k.giaiDoan+' · '+(k.mucDo||'')],['Chăm / BG / đơn',(k.soLanCham||0)+' / '+(k.soBaoGia||0)+' / '+(k.soDon||0)],['Ghi chú',k.ghiChu]].filter(x=>x[1]&&String(x[1]).replace(/[\s/–·]/g,'')).map(x=>`<span>${x[0]}</span><span>${esc(x[1])}</span>`).join('')}</div>
    <div class="sec" style="margin:12px 0 6px;font-weight:600">Chăm sóc gần nhất</div>${d.logs.length?d.logs.map(c=>`<div class="mini-log"><b>${dmy(c.thoiGian)} ${esc(c.kenh)}</b> · ${esc(c.ketQua)} · ${esc(c.tenNV)}<br>${esc(c.noiDung)}</div>`).join(''):'<div class="m">Chưa có.</div>'}
    ${d.bgs.length?`<div class="sec" style="margin:12px 0 6px;font-weight:600">Báo giá gần nhất</div>${d.bgs.map(b=>`<div class="mini-log"><a onclick="closeModal();openBG('${b.maBG}')">${b.maBG}</a> · ${fmt(b.tongSauVAT)} đ · ${esc(b.trangThai)}${b.canhBaoGia?`<br><span class="r">${esc(b.canhBaoGia)}</span>`:''}</div>`).join('')}`:''}</div></div>`,
   open?`<span class="m">${r.trangThai==='Chờ quản lý'?'Đang chờ quản lý trả lời':'Đang chờ sale thực hiện / trả lời'}</span><span class="sp"></span><button class="btn" onclick="htReply('${r.maHT}',true)">Gửi và đóng yêu cầu</button><button class="btn p" onclick="htReply('${r.maHT}',false)">Gửi</button>`:'',true);}
async function htReply(maHT,dong){const nd=$('#hRp').value;const r=await call('apiHTReply',maHT,nd,dong,dong?nd:'');if(!r)return;toast(dong?'Đã đóng yêu cầu':'Đã gửi','ok');
  await openHT(maHT);if(S.page==='ht')loadHT();if(S.page==='home')refreshHome(true);}
function pgHT(){S.htLoc=S.htLoc||'mine';
  V().innerHTML=`<div class="bar"><div class="seg" id="htSeg">${[['mine','Cần tôi xử lý'],['mo','Đang mở'],['xong','Đã xong'],['all','Tất cả']].map(([v,t])=>`<button data-v="${v}" class="${S.htLoc===v?'on':''}">${t}<i id="hc_${v}"></i></button>`).join('')}</div><span class="sp"></span><span class="m">Sale nhờ hỗ trợ từ hồ sơ khách. Quản lý chỉ đạo từ hồ sơ khách của sale. Ai đang giữ bóng thì thấy ở mục "Cần tôi xử lý".</span></div>
   <section class="pane fill"><div class="scroll" id="htBody"><div class="empty">Đang tải…</div></div></section>`;
  $('#htSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.htLoc=b.dataset.v;$$('#htSeg button').forEach(x=>x.classList.toggle('on',x===b));loadHT();};loadHT();}
async function loadHT(){const d=await call('apiHTList',{loc:S.htLoc});if(!d||!$('#htBody'))return;
  [['mine',d.cnt.mine],['mo',d.cnt.mo],['xong',d.cnt.xong],['all',d.cnt.tong]].forEach(([k,v])=>{const e=$('#hc_'+k);if(e)e.textContent=v;});setBadge('ht',d.cnt.mine);
  $('#htBody').innerHTML=d.rows.length?htList(d.rows):'<div class="empty">Không có yêu cầu nào.</div>';}

/* ======================= ẢNH ĐÍNH KÈM ======================= */
/** Nén ảnh ở trình duyệt: cạnh dài tối đa 1600px, JPEG 80% (bill rõ chữ, thường dưới 400KB). */
function compressImg(file){return new Promise((res,rej)=>{if(!file||!/^image\//.test(file.type)){rej(new Error('Chỉ nhận file ảnh'));return;}
  const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>{const mx=1600,sc=Math.min(1,mx/Math.max(im.width,im.height));const cv=document.createElement('canvas');cv.width=Math.round(im.width*sc);cv.height=Math.round(im.height*sc);
    const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(im,0,0,cv.width,cv.height);res(cv.toDataURL('image/jpeg',0.8));};im.onerror=()=>rej(new Error('Không đọc được ảnh'));im.src=fr.result;};fr.readAsDataURL(file);});}
/** Ô đính kèm: chọn file hoặc dán ảnh chụp màn hình (Ctrl+V) ngay trong hộp thoại. */
function imgBox(id,label,link){return`<div class="f s4"><label id="${id}L">${label}</label><div class="imgbox" id="${id}"><input type="file" accept="image/*" id="${id}F" style="display:none"><button class="btn s" type="button" onclick="$('#${id}F').click()">Chọn ảnh</button><span class="m">hoặc chụp màn hình rồi bấm Ctrl+V tại đây</span>${link?`<a href="${esc(link)}" target="_blank" class="m">Ảnh đã lưu</a>`:''}<img id="${id}P" class="hidden"></div></div>`;}
function bindImg(id,set){const box=$('#'+id),f=$('#'+id+'F'),pv=$('#'+id+'P');const take=async file=>{try{const d=await compressImg(file);set(d);pv.src=d;pv.classList.remove('hidden');}catch(e){toast(e.message,'bad');}};
  f.onchange=()=>{if(f.files[0])take(f.files[0]);};S.imgTake=take;}
document.addEventListener('paste',e=>{if(!S.imgTake||$('#modal').classList.contains('hidden'))return;const it=[...((e.clipboardData||{}).items||[])].find(x=>x.type&&x.type.startsWith('image/'));if(it){e.preventDefault();S.imgTake(it.getAsFile());}});
const driveId=u=>(String(u||'').match(/[-\w]{25,}/)||[])[0];
function viewImg(url){const id=driveId(url);let v=$('#imgv');if(!v){v=document.createElement('div');v.id='imgv';v.onclick=e=>{if(e.target===v)v.remove();};document.body.appendChild(v);}
  v.innerHTML=`<div class="iv">${id?`<img src="https://drive.google.com/thumbnail?id=${id}&sz=w1600" onerror="this.outerHTML='<p class=m>Không tải được ảnh xem trước.</p>'">`:''}<div style="display:flex;gap:10px;justify-content:center;margin-top:10px"><a class="btn s" href="${esc(url)}" target="_blank">Mở ảnh gốc</a><button class="btn s" onclick="$('#imgv').remove()">Đóng</button></div></div>`;}

/* ======================= NẠP / RÚT TIỀN ======================= */
const NRC={'Chờ kế toán':'s','Đã xác nhận':'x','Từ chối':'g','Đã hủy':'q'};
const nrBd=t=>`<span class="ttc ${NRC[t]||'q'}">${esc(t)}</span>`;
const canKT=()=>S.u.vaiTro==='KETOAN'||S.u.vaiTro==='ADMIN';
function pgNR(){S.nrLoc=S.nrLoc!==undefined?S.nrLoc:(canKT()?'Chờ kế toán':'');
  if(S.u.vaiTro!=='KETOAN')$('#hdAct').innerHTML='<button class="btn a" onclick="nrForm({loai:\'Nạp tiền\'})">Báo khách nạp tiền</button><button class="btn" onclick="nrForm({loai:\'Rút tiền\'})">Yêu cầu rút tiền</button>';
  const segs=[['Chờ kế toán','Chờ kế toán'],['Đã xác nhận','Đã xác nhận'],['Từ chối','Từ chối'],['','Tất cả']];
  V().innerHTML=`<div class="bar"><div class="seg" id="nrSeg">${segs.map(([v,t])=>`<button data-v="${v}" class="${S.nrLoc===v?'on':''}">${t}</button>`).join('')}</div>
   <select id="nrL"><option value="">Nạp và rút</option><option>Nạp tiền</option><option>Rút tiền</option></select>
   <input type="date" id="nrF" value="${addDays(td(),-30)}"><span class="m">đến</span><input type="date" id="nrT" value="${td()}">
   ${S.u.vaiTro!=='SALE'?`<select id="nrN">${optsNV('','Mọi nhân viên')}</select>`:''}<input id="nrQ" placeholder="Mã, khách, mã đơn, nội dung CK…" style="width:230px"></div>
   <div class="band wrap" id="nrTot"></div><section class="pane fill"><div class="scroll" id="nrBody"><div class="empty">Đang tải…</div></div></section>`;
  $('#nrSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.nrLoc=b.dataset.v;$$('#nrSeg button').forEach(x=>x.classList.toggle('on',x===b));loadNR();};
  $$('#nrL,#nrF,#nrT,#nrN').forEach(e=>e.onchange=loadNR);let tm;$('#nrQ').oninput=()=>{clearTimeout(tm);tm=setTimeout(loadNR,350);};loadNR();}
async function loadNR(){if(S.page!=='nr'||!$('#nrBody'))return;const d=await call('apiNRList',{trangThai:S.nrLoc,loai:$('#nrL').value,tuNgay:$('#nrF').value,denNgay:$('#nrT').value,maNV:$('#nrN')?$('#nrN').value:'',q:$('#nrQ').value});if(!d||!$('#nrBody'))return;
  const t=d.tot;S.nrRows={};d.rows.forEach(r=>S.nrRows[r.maGD]=r);
  $('#nrTot').innerHTML=[['Nạp đã xác nhận',fmt(t.napOK),'ok'],['Rút đã chi',fmt(t.rutOK),''],['Nạp chờ kế toán',fmt(t.napCho),'warn'],['Rút chờ kế toán',fmt(t.rutCho),'warn'],['Giao dịch đang chờ',t.soCho,'warn'],['Bị từ chối',t.soTC,'bad']].map(x=>`<div class="${x[2]}"><div class="l">${x[0]}</div><div class="v">${x[1]}</div></div>`).join('');
  if(canKT())setBadge('nr',t.soCho);
  $('#nrBody').innerHTML=d.rows.length?`<table class="tbl"><tr><th>Mã</th><th>Tạo lúc</th><th>Loại</th><th>Sale</th><th>Khách / mã đơn</th><th class="num">Số tiền</th><th>TK công ty · thời gian CK</th><th>Nội dung CK / TK nhận</th><th>Bill</th><th>Trạng thái</th><th>Kế toán</th><th></th></tr>
   ${d.rows.map(r=>`<tr><td><b>${r.maGD}</b></td><td>${dmy(r.thoiGian)}</td><td><span class="ttc ${r.loai==='Nạp tiền'?'x':'s'}">${r.loai==='Nạp tiền'?'Nạp':'Rút'}</span></td><td>${esc(r.tenNV)}</td>
    <td>${esc(r.tenKH)}<span class="sub">${esc(r.maKH)}${r.maDon?' · '+esc(r.maDon):''}</span></td><td class="num"><b>${fmt(r.soTien)}</b></td><td>${esc(r.tkCongTy)}<span class="sub">${dmy(r.ngayCK)}</span></td>
    <td class="long">${esc(r.loai==='Rút tiền'?r.tkKhach:r.noiDungCK)}${r.lyDo?`<span class="sub">${esc(r.lyDo)}</span>`:''}</td><td>${r.linkBill?`<a onclick="viewImg('${esc(r.linkBill)}')">Xem</a>`:''}</td>
    <td>${nrBd(r.trangThai)}</td><td class="long">${r.tenXN?esc(r.tenXN)+' · '+dmy(r.xacNhanLuc):''}${r.maThamChieu?`<span class="sub">Mã TC: ${esc(r.maThamChieu)}</span>`:''}${r.ghiChuKT?`<span class="sub">${esc(r.ghiChuKT)}</span>`:''}</td>
    <td class="act">${r.trangThai==='Chờ kế toán'&&canKT()?`<button class="btn s p" onclick="nrXN('${r.maGD}')">Xử lý</button> `:''}${['Chờ kế toán','Từ chối'].includes(r.trangThai)&&(r.maNV===S.u.maNV||S.u.vaiTro==='ADMIN')?`<button class="btn s" onclick="nrForm(S.nrRows['${r.maGD}'])">Sửa</button> <button class="btn s d" onclick="nrHuy('${r.maGD}')">Hủy</button>`:''}${S.u.vaiTro==='ADMIN'&&['Đã xác nhận','Từ chối'].includes(r.trangThai)?` <button class="btn s" onclick="nrReopen('${r.maGD}')">Mở lại</button>`:''}</td></tr>`).join('')}</table>`:'<div class="empty">Không có giao dịch.</div>';}
function nrForm(r){r=r||{};const nap=(r.loai||'Nạp tiền')==='Nạp tiền';S.nrEdit={maGD:r.maGD||'',loai:r.loai||'Nạp tiền',billData:'',linkBill:r.linkBill||''};
  const k=r.maKH?S.khMap[r.maKH]:null,khv=r.maKH?r.maKH+' | '+(k?khTen(k):r.tenKH||'')+' | '+(k&&k.sdt||''):'';
  modal((r.maGD?'Sửa '+r.maGD:(nap?'Báo khách nạp tiền':'Yêu cầu rút tiền cho khách')),`<div class="g2">
   <div class="f s4"><label>Loại</label><div class="chips" data-one="loai" ${r.maGD?'data-lock="1"':''}>${chip('Nạp tiền',nap)}${chip('Rút tiền',!nap)}</div></div>
   <div class="f s4"><label>Khách hàng *</label><input id="nK" list="nKL" value="${esc(khv)}" placeholder="Gõ tên, SĐT hoặc mã KH"><datalist id="nKL">${(S.kh||[]).map(x=>`<option value="${esc(x.maKH+' | '+khTen(x)+' | '+(x.sdt||''))}">`).join('')}</datalist></div>
   <div class="f"><label>Số tiền (đ) *</label><input id="nT" class="num" value="${r.soTien?fmt(r.soTien):''}" style="font-size:16px;font-weight:700"></div>
   <div class="f"><label>Mã đơn liên quan</label><input id="nD" value="${esc(r.maDon||'')}" placeholder="MD1534"></div>
   <div class="f"><label id="nTkL">${nap?'TK công ty nhận tiền':'Chi từ TK công ty'}</label><select id="nTk">${opts(L('TK_CONG_TY'),r.tkCongTy,'— Chọn —')}</select></div>
   <div class="f"><label>Thời gian chuyển khoản</label><input type="datetime-local" id="nNg" value="${esc(String(r.ngayCK||'').replace(' ','T'))}"></div>
   <div class="f s4 napOnly ${nap?'':'hidden'}"><label>Nội dung chuyển khoản (đúng như trên bill)</label><input id="nND" value="${esc(r.noiDungCK||'')}"></div>
   <div class="f s4 rutOnly ${nap?'hidden':''}"><label>TK nhận của khách * (tên chủ TK – số TK – ngân hàng)</label><input id="nTkK" value="${esc(r.tkKhach||'')}"></div>
   <div class="f s4"><label id="nLyL">${nap?'Ghi chú cho kế toán':'Lý do rút *'}</label><input id="nLy" value="${esc(r.lyDo||'')}"></div>
   ${imgBox('nB',nap?'Ảnh bill chuyển khoản *':'Ảnh đính kèm (nếu có)',r.linkBill)}</div>
   ${r.ghiChuKT?`<div class="warnbox r">Kế toán: ${esc(r.ghiChuKT)}</div>`:''}`,'<button class="btn" onclick="closeModal()">Hủy</button><button class="btn p" id="nSave" onclick="nrSave()">Gửi kế toán</button>');
  bindChips($('#modal'),(f,v)=>{S.nrEdit.loai=v;const n=v==='Nạp tiền';$$('.napOnly').forEach(e=>e.classList.toggle('hidden',!n));$$('.rutOnly').forEach(e=>e.classList.toggle('hidden',n));$('#nTkL').textContent=n?'TK công ty nhận tiền':'Chi từ TK công ty';$('#nLyL').textContent=n?'Ghi chú cho kế toán':'Lý do rút *';$('#nBL').textContent=n?'Ảnh bill chuyển khoản *':'Ảnh đính kèm (nếu có)';});
  bindImg('nB',d=>S.nrEdit.billData=d);$('#nT').addEventListener('blur',e=>{const v=pnum(e.target.value);e.target.value=v?fmt(v):'';});}
async function nrSave(){const e=S.nrEdit,ma=$('#nK').value.split('|')[0].trim();if(!S.khMap[ma]&&!(e.maGD)){toast('Chọn khách trong danh sách gợi ý','bad');return;}
  const o={maGD:e.maGD,loai:e.loai,maKH:ma,soTien:pnum($('#nT').value),maDon:$('#nD').value,tkCongTy:$('#nTk').value,ngayCK:$('#nNg').value,noiDungCK:$('#nND').value,tkKhach:$('#nTkK').value,lyDo:$('#nLy').value,linkBill:e.linkBill,billData:e.billData};
  $('#nSave').disabled=true;$('#nSave').textContent='Đang gửi…';const r=await call('apiNRSave',o);if(!r){$('#nSave').disabled=false;$('#nSave').textContent='Gửi kế toán';return;}
  closeModal();toast('Đã gửi kế toán: '+r.maGD,'ok');if(r.warn)toast(r.warn);if(S.page==='nr')loadNR();if(S.dk&&S.dk.kh&&S.dk.kh.maKH===ma){S.dk.tab='nr';openKH(ma);}}
function nrXN(maGD){const r=S.nrRows[maGD];modal('Xử lý '+maGD,`<div class="kv2"><span>Loại</span><b>${esc(r.loai)}</b><span>Khách</span><span>${esc(r.tenKH)} (${esc(r.maKH)})</span><span>Sale</span><span>${esc(r.tenNV)}</span><span>Số tiền</span><b style="font-size:18px">${fmt(r.soTien)} đ</b><span>TK công ty</span><span>${esc(r.tkCongTy)}</span><span>Thời gian CK</span><span>${esc(r.ngayCK)}</span>
   ${r.noiDungCK?`<span>Nội dung CK</span><span>${esc(r.noiDungCK)}</span>`:''}${r.tkKhach?`<span>TK nhận của khách</span><b>${esc(r.tkKhach)}</b>`:''}${r.lyDo?`<span>Ghi chú sale</span><span>${esc(r.lyDo)}</span>`:''}${r.linkBill?`<span>Bill</span><a onclick="viewImg('${esc(r.linkBill)}')">Xem ảnh</a>`:''}</div>
   <div class="g2" style="margin-top:14px"><div class="f"><label>Mã tham chiếu ngân hàng</label><input id="xTC"></div><div class="f"><label>Ghi chú (bắt buộc khi từ chối)</label><input id="xGC"></div></div>`,
   `<button class="btn d" onclick="nrDo('${maGD}',false)">Từ chối</button><span class="sp"></span><button class="btn p" onclick="nrDo('${maGD}',true)">${r.loai==='Nạp tiền'?'Xác nhận đã nhận tiền':'Xác nhận đã chi tiền'}</button>`);}
async function nrDo(maGD,ok){const r=await call('apiNRConfirm',maGD,ok,$('#xTC').value,$('#xGC').value);if(!r)return;closeModal();toast((ok?'Đã xác nhận ':'Đã từ chối ')+maGD,'ok');loadNR();}
let nrHuyT=0;async function nrHuy(maGD){if(Date.now()-nrHuyT>4000){nrHuyT=Date.now();toast('Bấm Hủy lần nữa để xác nhận hủy '+maGD);return;}nrHuyT=0;const r=await call('apiNRCancel',maGD);if(r){toast('Đã hủy '+maGD,'ok');loadNR();}}
async function nrReopen(maGD){const r=await call('apiNRReopen',maGD);if(r){toast('Đã mở lại '+maGD+' về Chờ kế toán','ok');loadNR();}}
function khNR(list,k){return`<div style="margin-bottom:10px;display:flex;gap:8px"><button class="btn a" onclick="nrForm({loai:'Nạp tiền',maKH:'${k.maKH}'})">Báo khách nạp tiền</button><button class="btn" onclick="nrForm({loai:'Rút tiền',maKH:'${k.maKH}'})">Yêu cầu rút tiền</button></div>`+
  (list.length?`<table class="tbl"><tr><th>Mã</th><th>Ngày</th><th>Loại</th><th class="num">Số tiền</th><th>Mã đơn</th><th>Trạng thái</th><th>Kế toán</th></tr>${list.map(r=>`<tr><td>${r.maGD}</td><td>${dmy(r.thoiGian)}</td><td>${esc(r.loai)}</td><td class="num">${fmt(r.soTien)}</td><td>${esc(r.maDon)}</td><td>${nrBd(r.trangThai)}</td><td class="long">${esc(r.ghiChuKT||r.tenXN||'')}</td></tr>`).join('')}</table>`:'<div class="empty">Chưa có giao dịch nạp / rút.</div>');}

/* ======================= CLAIM & HỎI ĐÁP ======================= */
const CLC={'Chờ quản trị':'q','Chờ người gửi':'s','Đã xong':'x'};
function pgCL(){S.clLoc=S.clLoc||(S.u.vaiTro==='ADMIN'?'can':'mo');
  $('#hdAct').innerHTML='<button class="btn a" onclick="clForm()">Gửi claim / câu hỏi</button>';
  const segs=[['can','Cần tôi xử lý'],['mo','Đang mở'],['xong','Đã xong'],['faq','Hỏi đáp chung']];
  V().innerHTML=`<div class="bar"><div class="seg" id="clSeg">${segs.map(([v,t])=>`<button data-v="${v}" class="${S.clLoc===v?'on':''}">${t}<i id="cc_${v}"></i></button>`).join('')}</div><input id="clQ" placeholder="Tìm trong tiêu đề, nội dung, câu trả lời…" style="width:300px"><span class="sp"></span><span class="m">Claim, đề xuất, câu hỏi gửi thẳng Quản trị. Câu trả lời hay được đưa vào "Hỏi đáp chung" cho mọi người cùng xem.</span></div>
   <section class="pane fill"><div class="scroll" id="clBody"><div class="empty">Đang tải…</div></div></section>`;
  $('#clSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.clLoc=b.dataset.v;$$('#clSeg button').forEach(x=>x.classList.toggle('on',x===b));loadCL();};let tm;$('#clQ').oninput=()=>{clearTimeout(tm);tm=setTimeout(loadCL,350);};loadCL();}
async function loadCL(){const d=await call('apiCLList',{loc:S.clLoc,q:$('#clQ').value});if(!d||!$('#clBody'))return;
  ['can','mo','xong','faq'].forEach(k=>{const e=$('#cc_'+k);if(e)e.textContent=d.cnt[k];});setBadge('cl',d.cnt.can);
  if(S.clLoc==='faq'){$('#clBody').innerHTML=d.rows.length?'<div class="faq">'+d.rows.map(r=>`<details><summary><span class="m">${esc(r.loai)}</span> <b>${esc(r.tieuDe)}</b></summary><div class="fq"><div class="m">Hỏi: ${esc(r.noiDung)}</div><div class="fa">${esc(r.ketQua)}</div><a class="m" onclick="openCL('${r.maCL}')">Xem cả trao đổi</a></div></details>`).join('')+'</div>':'<div class="empty">Chưa có câu hỏi nào được đưa vào hỏi đáp chung.</div>';return;}
  $('#clBody').innerHTML=d.rows.length?'<div class="htl">'+d.rows.map(r=>{const last=(r.traoDoi||[]).slice(-1)[0];return`<a onclick="openCL('${r.maCL}')"><div class="t1"><span class="ttc ${CLC[r.trangThai]||'q'}">${esc(r.trangThai)}</span>${r.mucDo==='Gấp'?'<span class="ttc g">Gấp</span>':''}<b>${esc(r.tieuDe)}</b><span class="m">${esc(r.loai)} · ${esc(r.tenGui)}</span>${r.congKhai==='Có'?'<span class="ttc x">Hỏi đáp chung</span>':''}<span class="sp"></span><span class="m">${r.maCL} · ${dmy(r.capNhatLuc||r.thoiGian)}</span></div><div class="t2">${last?esc(last.ten)+': '+esc(last.nd):esc(r.noiDung)}</div></a>`;}).join('')+'</div>':'<div class="empty">Không có mục nào.</div>';}
function clForm(){S.clEdit={anhData:''};modal('Gửi claim / câu hỏi tới Quản trị',`<div class="g2">
   <div class="f"><label>Loại *</label><select id="cLo">${opts(L('LOAI_CLAIM'),'','— Chọn —')}</select></div><div class="f"><label>Mức độ</label><select id="cMd2">${opts(['Bình thường','Gấp'],'Bình thường')}</select></div>
   <div class="f s4"><label>Tiêu đề *</label><input id="cTd" placeholder="VD: Khách KH000123 báo thiếu 5 bộ nồi đơn MD1534"></div>
   <div class="f s4"><label>Nội dung chi tiết *</label><textarea id="cNd2" rows="5" placeholder="Chuyện gì xảy ra, từ khi nào, đã xử lý gì, đề xuất hướng giải quyết…"></textarea></div>
   <div class="f"><label>Khách liên quan (nếu có)</label><input id="cK" list="cKL" placeholder="Mã hoặc tên KH"><datalist id="cKL">${(S.kh||[]).map(x=>`<option value="${esc(x.maKH+' | '+khTen(x))}">`).join('')}</datalist></div><div class="f"><label>Mã đơn liên quan</label><input id="cD"></div>
   ${imgBox('cA','Ảnh đính kèm (nếu có)','')}</div>`,'<button class="btn" onclick="closeModal()">Hủy</button><button class="btn p" id="cSave" onclick="clSave()">Gửi</button>');bindImg('cA',d=>S.clEdit.anhData=d);}
async function clSave(){const o={loai:$('#cLo').value,mucDo:$('#cMd2').value,tieuDe:$('#cTd').value,noiDung:$('#cNd2').value,maKH:$('#cK').value.split('|')[0].trim(),maDon:$('#cD').value,anhData:S.clEdit.anhData};
  $('#cSave').disabled=true;const r=await call('apiCLCreate',o);if(!r){$('#cSave').disabled=false;return;}closeModal();toast('Đã gửi '+r.maCL,'ok');if(S.page==='cl')loadCL();}
async function openCL(maCL){const r=await call('apiCLGet',maCL);if(!r)return;const adm=S.u.vaiTro==='ADMIN',own=r.nguoiGui===S.u.maNV,open=r.trangThai!=='Đã xong',can=open&&(adm||own);
  const thread=[{t:r.thoiGian,by:r.nguoiGui,ten:r.tenGui,nd:r.noiDung}].concat(r.traoDoi||[]);
  modal(`${r.maCL} · ${esc(r.tieuDe)} <span class="ttc ${CLC[r.trangThai]||'q'}">${esc(r.trangThai)}</span>`,`<div class="m" style="margin-bottom:10px">${esc(r.loai)} · ${esc(r.mucDo)}${r.maKH?' · KH '+esc(r.maKH):''}${r.maDon?' · Đơn '+esc(r.maDon):''}${r.linkAnh?` · <a onclick="viewImg('${esc(r.linkAnh)}')">Xem ảnh</a>`:''}</div>
   <div class="thr">${thread.map(x=>`<div class="bub ${x.by===S.u.maNV?'me':''}"><div class="who">${esc(x.ten||x.by)} · ${dmy(x.t)}</div>${esc(x.nd)}</div>`).join('')}${!open?`<div class="chk ok"><b>Kết quả</b>${esc(r.ketQua||'')}</div>`:''}</div>
   ${can?`<div class="f" style="margin-top:12px"><label>Trả lời</label><textarea id="cRp" rows="3"></textarea></div>${adm?`<label class="m" style="display:flex;gap:6px;align-items:center;margin-top:8px"><input type="checkbox" id="cPub" ${r.congKhai==='Có'?'checked':''} style="width:auto;height:auto">Đưa câu hỏi và câu trả lời vào "Hỏi đáp chung" khi đóng</label>`:''}`:''}
   ${!open&&adm?`<label class="m" style="display:flex;gap:6px;align-items:center;margin-top:10px"><input type="checkbox" ${r.congKhai==='Có'?'checked':''} onchange="clPub('${r.maCL}',this.checked)" style="width:auto;height:auto">Hiển thị trong Hỏi đáp chung</label>`:''}`,
   can?`<span class="sp"></span><button class="btn" onclick="clReply('${r.maCL}',true)">Gửi và đóng</button><button class="btn p" onclick="clReply('${r.maCL}',false)">Gửi</button>`:'',true);}
async function clReply(maCL,dong){const pub=$('#cPub')?$('#cPub').checked:null;const r=await call('apiCLReply',maCL,$('#cRp').value,dong,pub);if(!r)return;toast(dong?'Đã đóng':'Đã gửi','ok');await openCL(maCL);if(S.page==='cl')loadCL();}
async function clPub(maCL,on){const r=await call('apiCLPublic',maCL,on);if(r)toast(on?'Đã đưa vào Hỏi đáp chung':'Đã gỡ khỏi Hỏi đáp chung','ok');}

/* ======================= BÁO CÁO NGÀY ======================= */
function scoreC(x,tg,days,heSo){let tot=0,w=0;const det={};tg.forEach(t=>{const hs=['fb','dungHan'].includes(t.maChiSo)?1:(heSo||1);const g=Math.round(t.ngay*days*hs*10)/10,v=x[t.maChiSo]||0,r=g>0?v/g:null;det[t.maChiSo]={v,tg:g,r};if(t.trongSo>0&&g>0){tot+=Math.min(r,1.2)*t.trongSo;w+=t.trongSo;}});return{diem:w?Math.round(tot/w*1000)/10:0,det};}
function pgDaily(){S.dTab=S.dTab||(isMgr()?'team':'me');
  V().innerHTML=(isMgr()?`<div class="seg" style="align-self:flex-start"><button class="${S.dTab==='team'?'on':''}" onclick="S.dTab='team';pgDaily()">Duyệt báo cáo nhóm</button><button class="${S.dTab==='me'?'on':''}" onclick="S.dTab='me';pgDaily()">Báo cáo của tôi</button></div>`:'')+'<div id="dBody" class="fill col"></div>';
  if(S.dTab==='me')dailyMe();else dailyTeam();}
const DSELF=[['s_dataTim','Data khách tìm được','n'],['s_tongGoi','Tổng cuộc gọi thực tế','n'],['s_tongNhan','Tổng tin nhắn thực tế','n'],['s_ketBanZalo','Kết bạn Zalo mới','n'],
 ['s_group','Group tham gia / đăng bài','n'],['s_tuongTacFB','Tương tác thu về từ bài (inbox, comment)','t',3],['s_fb1','Link bài FB chính ngạch 1 *','t',2],['s_fb2','Link bài FB chính ngạch 2 *','t',2],['s_fb3','Link bài FB 3 (thêm)','t',4],
 ['s_khoKhan','Khó khăn hôm nay, cần hỗ trợ gì','a',4],['s_keHoach','Kế hoạch ngày mai: khách nào cần chăm, chốt *','a',4],['s_baiHoc','Bài học / cách làm hay rút ra','a',4]];
async function dailyMe(){const d=await call('apiDailyGet');if(!d)return;S.dly=d;const bc=d.bc||{};
  $('#dBody').innerHTML=`<div class="dly fill">
   <section class="pane"><div class="ph"><h3>Hệ thống ghi nhận hôm nay</h3></div><div class="pb scroll" id="dMet"></div></section>
   <section class="pane"><div class="ph"><h3>Tự khai và kế hoạch</h3><span class="m">${bc.thoiGianNop?'Đã nộp lúc '+dmy(bc.thoiGianNop)+' ('+esc(bc.dungHan)+')':'Hạn nộp trước '+S.c.gioHan+':00'}</span></div>
    <div class="pb scroll"><div class="g4">${DSELF.map(([k,l,t,sp])=>`<div class="f ${sp===4?'s4':sp===2?'s2':sp===3?'s3':''}"><label>${esc(l)}</label>${t==='a'?`<textarea data-d="${k}" rows="2">${esc(bc[k]||'')}</textarea>`:`<input data-d="${k}" class="${t==='n'?'num':''}" value="${esc(bc[k]==null?'':bc[k])}" ${t==='t'&&k.startsWith('s_fb')?'placeholder="https://facebook.com/…"':''}>`}</div>`).join('')}</div>
    ${bc.ql_nhanXet||bc.ql_xacNhanFB?`<div class="warnbox a" style="margin-top:12px"><b>Quản lý ${esc(bc.ql_nguoiDuyet||'')}:</b> FB ${esc(bc.ql_xacNhanFB||'chưa xác nhận')}. ${esc(bc.ql_nhanXet||'')}</div>`:''}</div>
    <div class="mf"><span class="m">Số liệu bên trái hệ thống tự đếm từ nhật ký chăm sóc, không sửa tay được.</span><span class="sp"></span><button class="btn p" onclick="submitDaily()">${bc.maBC?'Cập nhật báo cáo':'Nộp báo cáo ngày'}</button></div></section>
   <section class="pane"><div class="ph"><h3>14 ngày gần nhất</h3></div><div class="scroll">${d.hist.length?`<table class="tbl"><tr><th>Ngày</th><th class="num">Điểm</th><th>Nộp</th><th>FB</th><th>Nhận xét</th></tr>${d.hist.map(r=>`<tr><td>${dmy(r.ngay)}</td><td class="num">${pill(r.diemKPI)}</td><td>${r.dungHan==='Đúng hạn'?'<span class="g">Đúng hạn</span>':'<span class="r">Trễ</span>'}</td><td>${esc(r.ql_xacNhanFB||'—')}</td><td class="long">${esc(r.ql_nhanXet)}</td></tr>`).join('')}</table>`:'<div class="empty">Chưa có báo cáo.</div>'}</div></section></div>`;
  $$('#dBody [data-d^="s_fb"]').forEach(e=>e.oninput=dailyMet);dailyMet();}
function dailyMet(){const d=S.dly,m=Object.assign({},d.m);m.fb=$$('#dBody [data-d^="s_fb"]').filter(e=>e.value.trim()).length;
  const bc=d.bc||{};m.dungHan=bc.dungHan?(bc.dungHan==='Đúng hạn'?1:0):(new Date().getHours()<S.c.gioHan?1:0);
  const sc=scoreC(m,d.tg,1,d.heSo);
  $('#dMet').innerHTML=d.tg.filter(t=>t.ngay>0||t.maChiSo==='donChot').map(t=>{const x=sc.det[t.maChiSo],r=x.r||0;return`<div class="mrow"><span>${esc(t.tenChiSo)}${t.trongSo?` <span class="m">(${t.trongSo}%)</span>`:''}</span><b>${fmt(x.v)}${x.tg?' / '+fmt2(x.tg):''}</b>${x.tg?`<div class="meter"><i class="${r>=1?'ok':r<.5?'lo':''}" style="width:${Math.min(100,r*100)}%"></i></div>`:''}</div>`;}).join('')+
   `<div style="margin-top:14px;display:flex;align-items:baseline;gap:10px"><span class="m">Điểm KPI ngày (tạm tính)</span><span style="font-size:30px;font-weight:700;color:var(--ink)">${sc.diem}</span></div>${d.heSo!==1?`<div class="m">Hệ số chỉ tiêu của bạn: ${d.heSo}</div>`:''}`;}
async function submitDaily(){const o={};$$('#dBody [data-d]').forEach(e=>o[e.dataset.d]=e.value);
  if(!o.s_fb1||!o.s_fb2)toast('Bạn chưa nhập đủ 2 link bài FB chính ngạch, điểm FB sẽ bị trừ.');
  const r=await call('apiDailySubmit',o);if(!r)return;toast('Đã nộp báo cáo ngày. Điểm '+r.diem+' ('+r.dungHan+')','ok');dailyMe();}
const pill=v=>{v=Number(v)||0;return`<span class="pill ${v>=85?'g':v>=70?'a':'r'}">${v}</span>`;};
async function dailyTeam(){const ngay=(S.dTeamDate||td());
  $('#dBody').innerHTML=`<div class="bar"><span class="m">Ngày</span><input type="date" id="dtD" value="${ngay}" max="${td()}" onchange="S.dTeamDate=this.value;dailyTeam()"><span class="m">Xác nhận bài FB đúng chủ đề chính ngạch, đăng công khai, đúng ngày. "Không đạt" sẽ trừ điểm FB của ngày đó.</span></div><section class="pane fill"><div class="scroll" id="dtT"></div></section>`;
  const rows=await call('apiDailyTeam',ngay);if(!rows)return;
  $('#dtT').innerHTML=`<table class="tbl"><tr><th>Nhân viên</th><th>Nộp lúc</th><th class="num">Điểm</th><th class="num">KH mới</th><th class="num">Tiếp cận</th><th class="num">Kết nối</th><th class="num">Chăm cũ</th><th class="num">BG</th><th class="num">Gọi (nhật ký / tự khai)</th><th>Bài FB</th><th>Kế hoạch mai / khó khăn</th><th style="width:120px">FB</th><th style="width:220px">Nhận xét</th><th></th></tr>
   ${rows.map(x=>{const b=x.bc,m=x.m;return`<tr><td><b>${esc(x.hoTen)}</b><span class="sub">${x.maNV}</span></td><td>${b?dmy(b.thoiGianNop)+(b.dungHan==='Trễ'?' <span class="r">trễ</span>':''):'<span class="r">Chưa nộp</span>'}</td><td class="num">${pill(b?b.diemKPI:x.diemLive)}</td>
    <td class="num">${m.khMoi}</td><td class="num">${m.tiepCan}</td><td class="num">${m.ketNoi}</td><td class="num">${m.chamLai}</td><td class="num">${m.baoGia}</td><td class="num">${m.goi} / ${b?b.s_tongGoi||0:'—'}</td>
    <td>${b?['s_fb1','s_fb2','s_fb3'].filter(k=>b[k]).map((k,i)=>`<a href="${esc(b[k])}" target="_blank">Bài ${i+1}</a>`).join(' ')||'<span class="r">Không có</span>':''}</td>
    <td class="long">${b?esc(b.s_keHoach)+(b.s_khoKhan?`<span class="sub r">${esc(b.s_khoKhan)}</span>`:''):''}</td>
    <td>${b?`<select id="xn_${x.maNV}">${opts(['Đạt','Không đạt'],b.ql_xacNhanFB,'—')}</select>`:''}</td><td>${b?`<input id="nx_${x.maNV}" value="${esc(b.ql_nhanXet||'')}" placeholder="Nhận xét, việc cần sửa">`:''}</td>
    <td>${b?`<button class="btn s" onclick="reviewDaily('${b.maBC}','${x.maNV}')">Lưu</button>`:''}</td></tr>`;}).join('')}</table>`;}
async function reviewDaily(maBC,ma){const r=await call('apiDailyReview',maBC,$('#xn_'+ma).value,$('#nx_'+ma).value);if(r){toast('Đã lưu nhận xét. Điểm '+r.diem,'ok');dailyTeam();}}

/* ======================= BÁO CÁO TỔNG HỢP ======================= */
const RPT=[['tongquan','Tổng quan kinh doanh'],['kpi','KPI hoạt động'],['cancham','Khách cần chăm'],['chamsoc','Nhật ký chăm sóc'],['baogia','Báo giá'],['phieu','Phễu theo nhân viên'],['giukhach','Giữ khách và mua lại'],['nguon','Nguồn và chân dung khách'],['fb','Bài đăng Facebook'],['nopbaocao','Nộp báo cáo ngày'],['naprut','Nạp / rút tiền'],['hotro','Hỗ trợ và chỉ đạo'],['trungkhht','Trùng khách đang chạy'],['chuyenkh','Lịch sử chuyển khách']];
const PRESET=[['homnay','Hôm nay'],['homqua','Hôm qua'],['tuannay','Tuần này'],['tuantruoc','Tuần trước'],['thangnay','Tháng này'],['thangtruoc','Tháng trước'],['30ngay','30 ngày qua'],['quynay','Quý này'],['tuychon','Tùy chọn']];
function presetRange(p){const t=td(),d=dU(t),wd=(dow(t)+6)%7,mon=addDays(t,-wd),y=d.getUTCFullYear(),mo=d.getUTCMonth();const ym=(Y,M)=>Y+'-'+pad(M+1)+'-01';
  switch(p){case'homnay':return[t,t];case'homqua':return[addDays(t,-1),addDays(t,-1)];case'tuannay':return[mon,t];case'tuantruoc':return[addDays(mon,-7),addDays(mon,-1)];
  case'thangnay':return[ym(y,mo),t];case'thangtruoc':{const s=mo===0?ym(y-1,11):ym(y,mo-1);return[s,addDays(ym(y,mo),-1)];}case'30ngay':return[addDays(t,-29),t];
  case'quynay':return[ym(y,Math.floor(mo/3)*3),t];default:return null;}}
function pgReport(){S.rp=S.rp||{type:'tongquan',preset:'thangnay'};const adm=S.u.vaiTro==='ADMIN';
  V().innerHTML=`<div class="rpt fill"><nav class="pane rmenu scroll" style="padding:6px 0">${RPT.map(([k,t])=>`<a data-r="${k}" class="${S.rp.type===k?'on':''}">${t}</a>`).join('')}</nav>
   <div class="col"><div class="bar"><select id="rP">${PRESET.map(([k,t])=>`<option value="${k}" ${S.rp.preset===k?'selected':''}>${t}</option>`).join('')}</select><input type="date" id="rF"><span class="m">đến</span><input type="date" id="rT">
    ${adm?`<select id="rQ"><option value="">Mọi nhóm</option>${S.c.quanLy.map(q=>`<option value="${esc(q.maNV)}">Nhóm ${esc(q.hoTen)}</option>`).join('')}</select>`:''}${isMgr()?`<select id="rN">${optsNV('','Mọi nhân viên')}</select>`:''}
    <button class="btn p" onclick="runReport()">Xem báo cáo</button></div><div id="rOut" class="fill scroll"></div></div></div>`;
  $$('.rmenu a').forEach(a=>a.onclick=()=>{S.rp.type=a.dataset.r;$$('.rmenu a').forEach(x=>x.classList.toggle('on',x===a));runReport();});
  $('#rP').onchange=()=>{S.rp.preset=$('#rP').value;applyPreset();if(S.rp.preset!=='tuychon')runReport();};$$('#rF,#rT').forEach(e=>e.onchange=()=>{$('#rP').value='tuychon';S.rp.preset='tuychon';});
  applyPreset();runReport();}
function applyPreset(){const r=presetRange(S.rp.preset);if(r){$('#rF').value=r[0];$('#rT').value=r[1];}else if(!$('#rF').value){$('#rF').value=td();$('#rT').value=td();}}
async function runReport(){$('#rOut').innerHTML='<div class="empty">Đang tổng hợp…</div>';
  const d=await call('apiReport',S.rp.type,{tuNgay:$('#rF').value,denNgay:$('#rT').value,maQL:$('#rQ')?$('#rQ').value:'',maNV:$('#rN')?$('#rN').value:''});if(!d){$('#rOut').innerHTML='';return;}S.rpData=d;
  $('#rOut').innerHTML=`<div class="rout"><div class="rh"><h2>${esc(d.title)}</h2><div class="m">Kỳ: ${esc(d.ky)}${d.sub?' – '+esc(d.sub):''}</div></div>
   ${d.cards&&d.cards.length?`<div class="band wrap">${d.cards.map(c=>`<div class="${c.tone||''}"><div class="l">${esc(c.label)}</div><div class="v">${typeof c.value==='number'?fmt(c.value):esc(c.value)}</div>${c.note?`<div class="t">${esc(c.note)}</div>`:''}</div>`).join('')}</div>`:''}
   ${d.tables.map((t,i)=>`<section class="pane"><div class="ph"><h3>${esc(t.title)}</h3><span class="m">${t.rows.length} dòng</span><span class="sp"></span><button class="btn s" onclick="copyTbl(${i})">Sao chép sang Sheet</button></div><div class="scroll">${t.rows.length?`<table class="tbl"><tr>${t.cols.map(c=>`<th class="${['num','money','pct','score','kpi'].includes(c.type)?'num':c.type==='mark'?'ctr':''}">${esc(c.label)}</th>`).join('')}</tr>${t.rows.map(r=>`<tr>${t.cols.map(c=>cell(c,r[c.k])).join('')}</tr>`).join('')}</table>`:'<div class="empty">Không có dữ liệu trong kỳ.</div>'}</div></section>`).join('')}</div>`;}
function cell(c,v){switch(c.type){
  case'num':return`<td class="num">${fmt(v)}</td>`;case'money':return`<td class="num">${fmt(v)}</td>`;case'pct':return`<td class="num">${pct(v)}</td>`;
  case'bar':return`<td style="min-width:160px"><div style="display:flex;align-items:center;gap:8px"><div class="meter" style="flex:1;margin:0;height:8px"><i style="width:${Math.min(100,(v||0)*100)}%"></i></div><span class="m">${pct(v)}</span></div></td>`;
  case'score':return`<td class="num">${pill(v)}</td>`;case'stage':return`<td>${stageBd(v)}</td>`;case'bgtt':return`<td>${bgBd(v)}</td>`;
  case'kpi':{if(!v)return'<td></td>';const r=v.r;return`<td class="num"><span class="kv ${r==null?'':r>=1?'ok':r<.7?'lo':''}">${fmt(v.v)}</span>${v.tg?`<span class="m"> / ${fmt2(v.tg)}</span>`:''}</td>`;}
  case'tag':return`<td><span class="pill ${v==='Xuất sắc'||v==='Đạt'?'g':v==='Cần cải thiện'?'a':'r'}">${esc(v)}</span></td>`;
  case'warn':return`<td>${v==='Quá hạn'?'<span class="tag qh">Quá hạn</span>':v==='Hôm nay'?'<span class="tag hn">Hôm nay</span>':esc(v)}</td>`;
  case'link':return`<td>${v?`<a href="${esc(v)}" target="_blank">Mở</a>`:''}</td>`;
  case'mark':return`<td style="text-align:center">${v==='ok'?'<span class="g">✓</span>':v==='late'?'<span style="color:#A16207">⏱</span>':v==='x'?'<span class="r">✗</span>':''}</td>`;
  case'long':return`<td class="long">${esc(v)}</td>`;default:return`<td>${esc(v)}</td>`;}}
function copyTbl(i){const t=S.rpData.tables[i],val=(c,v)=>v&&typeof v==='object'?(v.v+(v.tg?'/'+v.tg:'')):c.type==='pct'||c.type==='bar'?Math.round((v||0)*1000)/10+'%':(v==null?'':String(v).replace(/[\t\n]/g,' '));
  const txt=[t.cols.map(c=>c.label).join('\t')].concat(t.rows.map(r=>t.cols.map(c=>val(c,r[c.k])).join('\t'))).join('\n');
  const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy');}catch(e){}ta.remove();
  toast(ok?'Đã sao chép. Mở Google Sheet và dán (Ctrl+V).':'Trình duyệt chặn sao chép. Bôi đen bảng và Ctrl+C.',ok?'ok':'bad');}

/* ======================= NHÂN SỰ ======================= */
async function pgAdmin(){const list=await call('apiUsers');if(!list||S.page!=='admin')return;S.users=list;const adm=S.u.vaiTro==='ADMIN';
  if(adm)$('#hdAct').innerHTML='<button class="btn a" onclick="editUser()">Thêm nhân viên</button>';
  const nm=ma=>{const x=list.find(u=>u.maNV===ma);return x?x.hoTen:ma;};
  V().innerHTML=`<div class="adm fill"><section class="pane"><div class="ph"><h3>Nhân sự</h3><span class="m">${list.filter(u=>u.trangThai==='Đang làm').length} đang làm / ${list.length}</span></div><div class="scroll"><table class="tbl"><tr><th>Mã NV</th><th>Họ tên</th><th>Vai trò</th><th>Cấp bậc</th><th>Quản lý trực tiếp</th><th>Email</th><th class="num">Hệ số KPI</th><th>Trạng thái</th></tr>
   ${list.map(u=>`<tr class="${adm?'ck':''}" ${adm?`onclick="editUser('${u.maNV}')"`:''}><td><b>${u.maNV}</b></td><td>${esc(u.hoTen)}</td><td>${roleName(u.vaiTro)}</td><td>${esc(u.capBac)}</td><td>${esc(u.maQuanLy?nm(u.maQuanLy):'')}</td><td>${esc(u.email)}</td><td class="num">${esc(u.heSoKPI)}</td><td>${u.trangThai==='Đang làm'?'<span class="g">Đang làm</span>':'<span class="r">'+esc(u.trangThai)+'</span>'}</td></tr>`).join('')}</table></div></section>
   <div class="col"><section class="pane" id="uForm"><div class="pb m">${adm?'Bấm một nhân viên để sửa, hoặc Thêm nhân viên. Sale chỉ thấy khách của mình; Quản lý thấy khách của nhân viên có "Quản lý trực tiếp" là mình; Admin thấy toàn bộ.':'Thêm và sửa nhân sự do Admin thực hiện. Quản lý được chuyển khách trong nhóm.'}</div></section>
    <section class="pane"><div class="ph"><h3>Chuyển khách hàng</h3></div><div class="pb g2">
     <div class="f"><label>Từ nhân viên</label><select id="tTu">${list.map(u=>`<option value="${u.maNV}">${esc(u.hoTen)} (${u.maNV})${u.trangThai!=='Đang làm'?' – đã nghỉ':''}</option>`).join('')}</select></div>
     <div class="f"><label>Sang nhân viên</label><select id="tDen">${list.filter(u=>u.trangThai==='Đang làm').map(u=>`<option value="${u.maNV}">${esc(u.hoTen)} (${u.maNV})</option>`).join('')}</select></div>
     <div class="f s4"><label>Lý do (bắt buộc, lưu vào lịch sử chuyển khách)</label><input id="tLy" placeholder="VD: Nhân viên nghỉ việc / Kho khách ngủ phân bổ lại"></div>
     <div class="s4"><button class="btn a" id="tBtn" onclick="doTransfer()">Chuyển toàn bộ khách</button> <span class="m">Muốn chuyển từng khách: mở khách, đổi "Sale phụ trách".</span></div></div></section>
    ${adm?`<section class="pane"><div class="ph"><h3>Khách đang chạy của công ty</h3><span class="m" id="khhtInfo"></span></div><div class="pb">
     <p class="m" style="margin-top:0">Mỗi tháng: xuất danh sách khách từ hệ thống đơn hàng, chọn đúng 8 cột theo thứ tự <b>Mã KH · Tên · SĐT · SĐT 2/Zalo · MST · Ngày đơn gần nhất · Phụ trách · Ghi chú</b>, copy rồi dán vào ô dưới. Danh sách mới thay hoàn toàn danh sách cũ. Khách có đơn trong <span id="khhtNg"></span> ngày = đang chạy, sale bị chặn.</p>
     <textarea id="khhtTxt" rows="5" placeholder="Dán từ Excel / Google Sheet vào đây"></textarea>
     <div style="display:flex;gap:10px;align-items:center;margin-top:8px"><label class="m" style="display:flex;gap:5px;align-items:center"><input type="checkbox" id="khhtHdr" checked style="width:auto;height:auto">Dòng đầu là tiêu đề</label><span class="m" id="khhtPrev"></span><span class="sp"></span><button class="btn a" id="khhtBtn" onclick="doKHHT()">Cập nhật danh sách</button></div></div></section>`:''}</div></div>`;
  if(adm){$('#khhtTxt').oninput=()=>{const r=parseTSV();$('#khhtPrev').textContent=r.length?r.length+' dòng, ví dụ: '+r[0].slice(0,3).join(' | '):'';};
    call('apiKHHTInfo').then(i=>{if(!i||!$('#khhtInfo'))return;$('#khhtInfo').textContent=i.soDong?i.soDong+' khách, cập nhật '+dmy(i.capNhatLuc):'Chưa có dữ liệu';$('#khhtNg').textContent=i.nguong;});}}
function parseTSV(){const t=($('#khhtTxt')||{}).value||'';let rows=t.split(/\r?\n/).filter(x=>x.trim()).map(x=>x.split('\t'));if($('#khhtHdr').checked)rows=rows.slice(1);return rows;}
let kConfirm=0;async function doKHHT(){const rows=parseTSV();if(!rows.length){toast('Chưa có dữ liệu để cập nhật','bad');return;}
  if(rows[0].length<5){toast('Cần đủ cột theo thứ tự hướng dẫn (ít nhất tới cột MST). Dữ liệu đang có '+rows[0].length+' cột.','bad');return;}
  if(Date.now()-kConfirm>5000){kConfirm=Date.now();$('#khhtBtn').textContent='Bấm lần nữa để thay danh sách';toast('Sẽ thay toàn bộ danh sách cũ bằng '+rows.length+' dòng mới. Bấm lần nữa trong 5 giây để xác nhận.');return;}
  kConfirm=0;$('#khhtBtn').textContent='Cập nhật danh sách';const r=await call('apiImportKHHT',rows);if(!r)return;
  toast(`Đã cập nhật ${r.soDong} khách (${r.dangChay} đang chạy${r.boQua?', bỏ qua '+r.boQua+' dòng thiếu SĐT/MST':''}). ${r.trungCRM} hồ sơ CRM trùng khách đang chạy.`,'ok');$('#khhtTxt').value='';reloadKH();pgAdmin();}
function editUser(ma){const u=ma?S.users.find(x=>x.maNV===ma):{vaiTro:'SALE',trangThai:'Đang làm',heSoKPI:1,capBac:'Nhân viên KD'};const mgrs=S.users.filter(x=>['QUANLY','ADMIN'].includes(x.vaiTro)&&x.maNV!==ma);
  $('#uForm').innerHTML=`<div class="ph"><h3>${ma?'Sửa '+esc(u.hoTen):'Thêm nhân viên'}</h3></div><div class="pb g2">
   <div class="f"><label>Mã NV *</label><input id="uMa" value="${esc(u.maNV||'')}" ${ma?'disabled':''} placeholder="NV001"></div><div class="f"><label>Họ tên *</label><input id="uTen" value="${esc(u.hoTen||'')}"></div>
   <div class="f"><label>Email Google (để tự đăng nhập)</label><input id="uEm" value="${esc(u.email||'')}"></div><div class="f"><label>SĐT (in trên báo giá)</label><input id="uSdt" value="${esc(u.sdt||'')}"></div>
   <div class="f"><label>Vai trò *</label><select id="uVt">${['SALE','QUANLY','KETOAN','ADMIN'].map(v=>`<option value="${v}" ${u.vaiTro===v?'selected':''}>${roleName(v)}</option>`).join('')}</select></div>
   <div class="f"><label>Quản lý trực tiếp</label><select id="uQl"><option value="">— Không —</option>${mgrs.map(x=>`<option value="${x.maNV}" ${u.maQuanLy===x.maNV?'selected':''}>${esc(x.hoTen)}</option>`).join('')}</select></div>
   <div class="f"><label>Cấp bậc</label><select id="uCb">${opts(L('CAP_BAC'),u.capBac)}</select></div><div class="f"><label>Trạng thái</label><select id="uTt">${opts(['Đang làm','Đã nghỉ'],u.trangThai)}</select></div>
   <div class="f"><label>Ngày vào</label><input type="date" id="uNv" value="${esc(u.ngayVao||'')}"></div><div class="f"><label>Hệ số KPI (0,7 cho 2 tháng đầu)</label><input id="uHs" value="${esc(u.heSoKPI||1)}"></div>
   <div class="f s4"><label>${ma?'Mật khẩu mới (để trống nếu không đổi)':'Mật khẩu *'}</label><input id="uMk" type="password" autocomplete="new-password"></div></div>
   <div class="mf"><span class="sp"></span><button class="btn" onclick="pgAdmin()">Hủy</button><button class="btn p" onclick="saveUser(${ma?'false':'true'})">Lưu nhân viên</button></div>`;}
async function saveUser(isNew){const o={isNew,maNV:$('#uMa').value,hoTen:$('#uTen').value,email:$('#uEm').value,sdt:$('#uSdt').value,vaiTro:$('#uVt').value,maQuanLy:$('#uQl').value,capBac:$('#uCb').value,trangThai:$('#uTt').value,ngayVao:$('#uNv').value,heSoKPI:pnum($('#uHs').value)||1,matKhauMoi:$('#uMk').value};
  const r=await call('apiSaveUser',o);if(!r)return;toast('Đã lưu '+r.maNV,'ok');const b=await call('apiBootstrap');if(b)S.c=b;pgAdmin();}
let tConfirm=0;async function doTransfer(){const tu=$('#tTu').value,den=$('#tDen').value,ly=$('#tLy').value.trim();
  if(tu===den){toast('Chọn hai nhân viên khác nhau','bad');return;}if(!ly){toast('Ghi lý do chuyển','bad');return;}
  if(Date.now()-tConfirm>5000){tConfirm=Date.now();$('#tBtn').textContent='Bấm lần nữa để xác nhận';toast('Sẽ chuyển TOÀN BỘ khách của '+tu+' sang '+den+'. Bấm lần nữa trong 5 giây để xác nhận.');return;}
  tConfirm=0;const r=await call('apiChuyenKH',tu,den,ly,null);$('#tBtn').textContent='Chuyển toàn bộ khách';if(r){toast('Đã chuyển '+r.soKH+' khách','ok');reloadKH();}}

/* ======================= ĐỔI MẬT KHẨU ======================= */
function openPwd(){modal('Đổi mật khẩu','<div class="g2"><div class="f s4"><label>Mật khẩu hiện tại</label><input type="password" id="pw0"></div><div class="f"><label>Mật khẩu mới (≥ 6 ký tự)</label><input type="password" id="pw1"></div><div class="f"><label>Nhập lại</label><input type="password" id="pw2"></div></div>','<button class="btn p" onclick="savePwd()">Đổi mật khẩu</button>');}
async function savePwd(){if($('#pw1').value!==$('#pw2').value){toast('Hai lần nhập không khớp','bad');return;}const r=await call('apiDoiMatKhau',$('#pw0').value,$('#pw1').value);if(r){closeModal();toast('Đã đổi mật khẩu','ok');}}

/* [ERP] không tự khởi động: ERP gọi CRMX.init sau khi đăng nhập */

/* ===================== [ERP] CẦU NỐI ===================== */
function crmNavItems(){const items=S.u.vaiTro==='KETOAN'?['nr','cl']:['home','kh','bg','ht','nr','cl','daily','rp'];if(isMgr())items.push('admin');return items.map(k=>({p:k,label:PAGES[k][0]}));}
window.CRMX={
  async init(token){S.token=token;const p=await api('apiStart');start(p);return crmNavItems();},
  go(p){if(!S.u)return;go(p);},
  reset(){S.token=null;S.u=null;S.kh=null;S.home=null;closeModal();closeDrawer();}
};
