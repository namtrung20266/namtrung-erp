"""Ghép giao diện ERP + CRM thành MỘT ứng dụng (web/). Nguồn: tools/web_src/."""
import pathlib, re
ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / 'tools/web_src'
WEB = ROOT / 'web'

# ---------------- bộ tách phạm vi CSS ----------------
def split_top(s, ch=','):
    out, depth, cur = [], 0, ''
    for c in s:
        if c in '([': depth += 1
        elif c in ')]': depth -= 1
        if c == ch and depth == 0: out.append(cur); cur = ''
        else: cur += c
    out.append(cur); return out
def blocks(css):
    """Tách CSS cấp cao nhất thành (prelude, body) — body là chuỗi trong ngoặc nhọn."""
    i, n, out = 0, len(css), []
    while i < n:
        j = css.find('{', i)
        if j < 0: break
        pre = css[i:j]; depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{': depth += 1
            elif css[k] == '}': depth -= 1
            k += 1
        out.append((pre.strip(), css[j + 1:k - 1])); i = k
    return out
def scope_css(css, fn_sel, keep_print):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    out = []
    for pre, body in blocks(css):
        if pre.startswith('@media') or pre.startswith('@supports'):
            if keep_print and 'print' in pre: out.append(pre + '{' + body + '}')
            else: out.append(pre + '{' + scope_css(body, fn_sel, keep_print) + '}')
        elif pre.startswith('@'):
            out.append(pre + '{' + body + '}')
        else:
            sels = [fn_sel(s.strip()) for s in split_top(pre) if s.strip()]
            out.append(','.join(sels) + '{' + body + '}')
    return '\n'.join(out)
def crm_sel(s):
    if s.startswith(':root'): return '#crm' + s[5:]
    m = re.match(r'^(html|body)(?=$|[.:\s>#\[])', s)
    if m: return '#crm' + s[len(m.group(1)):]
    if s == '*': return '#crm,#crm *'
    return '#crm ' + s
def erp_sel(s):
    if re.match(r'^(html|body|:root)$', s): return s
    m = re.search(r'::?(before|after|placeholder|selection|-webkit-[\w-]+)$', s)
    if m: return s[:m.start()] + ':not(#crm *)' + s[m.start():]
    return s + ':not(#crm *)'

# ---------------- CSS ----------------
erp_css = (SRC / 'erp_css.css').read_text(encoding='ascii')
crm_html = (SRC / 'crm_index.html').read_text(encoding='utf-8')
crm_css = crm_html[crm_html.find('<style>') + 7:crm_html.find('</style>')]
EMBED_CSS = """
/* ===== CRM nằm trong khung ERP ===== */
#crm{min-height:100%;border-radius:18px;overflow:hidden}
#crm aside.side,#crm .ham,#crm #login,#crm #smask{display:none!important}
#crm #app{display:block!important;height:auto!important;min-height:calc(100vh - 48px)}
#crm #app>main{height:auto!important;min-height:calc(100vh - 48px)}
#crm #mask{z-index:79}#crm #drawer{z-index:80}#crm #modal{z-index:90}#crm #imgv{z-index:95}#crm #toast{z-index:99}
@media (max-width:900px){#crm .fab{bottom:104px!important}#crm #toast{bottom:110px}#crm #drawer{width:100vw}}
"""
(WEB / 'css').mkdir(parents=True, exist_ok=True)
(WEB / 'css/erp.css').write_text(scope_css(erp_css, erp_sel, False) + """
/* khung CRM trong ERP */
#crmSlot:not([hidden]){display:block;padding:0}
.rail .grp{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--mute,#6B6A8E);margin:14px 12px 4px}
.app.crm-on main#erpView{display:none}
""", encoding='utf-8')
(WEB / 'css/crm.css').write_text(scope_css(crm_css, crm_sel, True) + EMBED_CSS, encoding='utf-8')

# ---------------- JS CRM (giữ nguyên, chỉ thêm điểm nối) ----------------
crm_body = crm_html[crm_html.find('<body>') + 6:crm_html.find('<script>')]
crm_js = crm_html[crm_html.find('<script>') + 8:crm_html.rfind('</script>')]
R = [
 ("rej(new Error(m));})[fn](...a);});}", "rej(new Error(m));}).crm(fn,a);});}  /* [ERP] cổng gọi chung */"),
 ("if(m.includes('PHIEN_HET_HAN')){m='Phiên đăng nhập đã hết, vui lòng đăng nhập lại';if(S.u){toast(m,'bad');logout(true);}}",
  "if(m.includes('PHIEN_HET_HAN')){m='Phiên đăng nhập đã hết, vui lòng đăng nhập lại';if(window.ERP_LOGOUT)window.ERP_LOGOUT();}"),
 ("buildNav();homeBadges(p.home);go(S.u.vaiTro==='KETOAN'?'nr':'home');}", "buildNav();homeBadges(p.home);}  /* [ERP] ERP quyết định mở trang nào */"),
 ("\nboot();\n", "\n/* [ERP] không tự khởi động: ERP gọi CRMX.init sau khi đăng nhập */\n"),
]
for a, b in R:
    assert crm_js.count(a) == 1, a[:50]
    crm_js = crm_js.replace(a, b)
crm_js = crm_js.replace('document.body.classList', "document.getElementById('crm').classList")
crm_js += r"""
/* ===================== [ERP] CẦU NỐI ===================== */
function crmNavItems(){const items=S.u.vaiTro==='KETOAN'?['nr','cl']:['home','kh','bg','ht','nr','cl','daily','rp'];if(isMgr())items.push('admin');return items.map(k=>({p:k,label:PAGES[k][0]}));}
window.CRMX={
  async init(token){S.token=token;const p=await api('apiStart');start(p);return crmNavItems();},
  go(p){if(!S.u)return;go(p);},
  reset(){S.token=null;S.u=null;S.kh=null;S.home=null;closeModal();closeDrawer();}
};
"""
(WEB / 'js').mkdir(parents=True, exist_ok=True)
(WEB / 'js/crm.js').write_text(crm_js, encoding='utf-8')

# ---------------- JS ERP ----------------
e = (SRC / 'erp_client.js').read_text(encoding='utf-8')
E = [
 ("  { id: 'crm',     label: 'CRM bán hàng', short: 'CRM', ic: '💼', test: () => !!S.crm },\n", ""),
 ("""  if (v === 'crm') { const u = (S.webUrl || '') + '?app=crm'; try { window.top.location.href = u; } catch (e) { window.open(u, '_top'); } return; }
  S.view = v;""",
  """  S.view = v;
  const isCrm = String(v).indexOf('crm:') === 0;
  document.querySelector('.app') && document.querySelector('.app').classList.toggle('crm-on', isCrm);
  const slot = document.getElementById('crmSlot'); if (slot) slot.hidden = !isCrm;
  document.querySelectorAll('[data-go]').forEach(b => { if (b.dataset.go === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  window.scrollTo(0, 0);
  if (isCrm) { if (window.CRMX) window.CRMX.go(v.slice(4)); return; }"""),
 ("      <main id=\"view\"></main>", "      <main id=\"erpView\"></main><section id=\"crmSlot\" hidden></section>"),
 ("  const items = NAV.filter(navOk);\n", "  parkCrm();\n  const items = navItems();\n"),
 ("  const bottomItems = items.length > 5 ? items.slice(0, 4).concat([{ id: 'more', short: 'Thêm', ic: '☰' }]) : items;",
  "  const pri = ['board', 'cc', 'crm:kh', 'crm:home', 'new', 'crm:nr'].filter(id => items.some(n => n.id === id)).slice(0, 4);\n  const bottomItems = items.length > 5 ? pri.map(id => items.find(n => n.id === id)).concat([{ id: 'more', short: 'Thêm', ic: '☰' }]) : items;\n  const moreItems = items.filter(n => bottomItems.indexOf(n) < 0);"),
 ("${items.map(n => `<button class=\"nav\" data-go=\"${n.id}\">", "${items.map(n => `${n.grp ? `<div class=\"grp\">${n.grp}</div>` : ''}<button class=\"nav\" data-go=\"${n.id}\">"),
 ("items.slice(4).map(n => `<button class=\"nav\" data-go2", "moreItems.map(n => `<button class=\"nav\" data-go2"),
 ("    go(ids.indexOf(START) >= 0 ? START : 'board');", "    go(ids.indexOf(START) >= 0 ? START : 'board');\n    initCrm();"),
 ("    const ids = NAV.filter(navOk).map(n => n.id);", "    S.crmNav = [];\n    const ids = navItems().map(n => n.id);"),
 ("function logout(silent){\n", "function logout(silent){\n  parkCrm(); if (window.CRMX) window.CRMX.reset();\n"),
 ("function renderLogin(err){\n", "function renderLogin(err){\n  parkCrm();\n"),
]
for a, b in E:
    assert e.count(a) >= 1, a[:60]
    e = e.replace(a, b)
e = e.replace("'#view'", "'#erpView'")
import json as _j
_sch = (ROOT / 'src/server/erp/Schema.js').read_text(encoding='utf-8')
_sch = _j.loads(_sch[_sch.index('{'):_sch.rstrip().rstrip(';').rindex('}') + 1])
e = e.replace('__ERP_BOOK__', _j.dumps({k: v['db'] for k, v in _sch.items()}))
e += r"""
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
"""
# đặt CRM vào khung sau mỗi lần dựng lại khung
e = e.replace("  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));\n  document.querySelectorAll('[data-act=\"acct\"]').forEach(b => b.onclick = acctModal);",
              "  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));\n  placeCrm();\n  document.querySelectorAll('[data-act=\"acct\"]').forEach(b => b.onclick = acctModal);")
e = '/* GIAO DIỆN ERP (nhân sự, chấm công, lương, quản trị) + khung chung cho phần bán hàng */\n(function () {\n' + e + '\n})();\n'
(WEB / 'js/erp.js').write_text(e, encoding='utf-8')

# ---------------- index.html ----------------
html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Nam Trung · ERP</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/erp.css">
<link rel="stylesheet" href="css/crm.css">
</head>
<body>
<div class="bar" id="bar"></div>
<div id="root"><p style="font-family:Arial,sans-serif;padding:40px;color:#6B6A8E">Đang tải...</p></div>
<input type="file" id="cam" accept="image/*" capture="user" hidden>
<div id="crm" style="display:none">{crm_body}</div>
<script src="js/config.js"></script>
<script src="js/bridge.js"></script>
<script src="js/crm.js"></script>
<script src="js/erp.js"></script>
</body>
</html>
"""
(WEB / 'index.html').write_text(html, encoding='utf-8')
print('web ok', {p.name: p.stat().st_size for p in list((WEB / 'js').glob('*')) + list((WEB / 'css').glob('*'))})
