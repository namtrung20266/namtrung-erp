"""Sinh dữ liệu khởi tạo KHÔNG chứa dữ liệu cá nhân (an toàn khi đưa code lên GitHub):
cấu trúc bảng, vai trò, quyền, phòng ban, loại nghỉ, danh mục, cấu hình chung, chỉ tiêu KPI,
và 1 tài khoản quản trị NT001 (mật khẩu ban đầu sinh ngẫu nhiên khi chạy migration).
Dữ liệu thật (nhân sự, ngân hàng, mẫu CRM, khách cũ...) admin tự nhập từ file Excel trong mục Quản trị."""
import json, datetime as dt, pathlib, sys, openpyxl
ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'tools/seed_src'
def cell(v):
    if isinstance(v, (dt.datetime, dt.date)):
        d = v if isinstance(v, dt.datetime) else dt.datetime(v.year, v.month, v.day)
        return {'$d': int(dt.datetime(d.year, d.month, d.day, d.hour, d.minute, d.second, tzinfo=dt.timezone.utc).timestamp() * 1000)}
    return '' if v is None else v
def read(path):
    wb = openpyxl.load_workbook(path, data_only=True); out = {}
    for ws in wb:
        rows = [[cell(v) for v in r] for r in ws.iter_rows(values_only=True)]
        while rows and all(v == '' for v in rows[-1]): rows.pop()
        rows = [r[:max([i + 1 for i, v in enumerate(r) if v != ''] or [0])] for r in rows]
        out[ws.title] = rows
    return out
core, hr, crm = read(SRC / 'NT_CORE.xlsx'), read(SRC / 'NT_HR.xlsx'), read(SRC / 'CRM_mau.xlsx')
KEEP_CORE = {'roles', 'permissions', 'role_permissions', 'departments', 'lookups', 'holidays'}
KEEP_HR = {'leave_types'}
def col(rows, name): return rows[0].index(name)
seed = {'CORE': {}, 'HR': {}, 'CRM': {}}
for n, rows in core.items(): seed['CORE'][n] = rows if n in KEEP_CORE else rows[:1]
for n, rows in hr.items(): seed['HR'][n] = rows if n in KEEP_HR else rows[:1]
# cấu hình chung: bỏ các giá trị riêng tư (webhook, email, IP)
st = core['settings']; ik, iv = col(st, 'key'), col(st, 'value')
seed['CORE']['settings'] = [st[0]] + [[('' if (j == iv and r[ik] in ('hr.lark_webhook', 'hr.email_ke_toan', 'hr.ip_van_phong')) else v) for j, v in enumerate(r)] for r in st[1:]]
# 1 tài khoản quản trị
emp = hr['employees']; admin_emp = next(r for r in emp[1:] if r[col(emp, 'employee_code')] == 'NT001')
e = [''] * len(emp[0])
for k in ('id', 'employee_code', 'department_id', 'work_schedule', 'employment_status', 'employee_type', 'hire_date', 'kpi_coefficient', 'created_at'): e[col(emp, k)] = admin_emp[col(emp, k)]
e[col(emp, 'full_name')] = 'Quản trị hệ thống'; e[col(emp, 'display_name')] = 'Admin'; e[col(emp, 'position')] = 'Quản trị'
e[col(emp, 'attendance_required')] = False; e[col(emp, 'legacy_codes')] = 'crm:ADMIN'
seed['HR']['employees'] = [emp[0], e]
us = core['users']; au = next(r for r in us[1:] if r[col(us, 'username')] == 'NT001')
u = [''] * len(us[0])
for k in ('id', 'employee_id', 'username', 'created_at'): u[col(us, k)] = au[col(us, k)]
u[col(us, 'status')] = 'active'; u[col(us, 'must_change_password')] = True
seed['CORE']['users'] = [us[0], u]
ur = core['user_roles']; roles = core['roles']; admin_role = next(r[col(roles, 'id')] for r in roles[1:] if r[col(roles, 'code')] == 'admin')
seed['CORE']['user_roles'] = [ur[0]] + [r for r in ur[1:] if r[col(ur, 'user_id')] == u[col(us, 'id')] and r[col(ur, 'role_id')] == admin_role][:1]
# CRM: chỉ tiêu KPI + quản trị; còn lại chỉ dòng tiêu đề (mẫu đầy đủ nhập từ file Excel CRM)
for n, rows in crm.items(): seed['CRM'][n] = rows[:1]
seed['CRM']['KPI_CHI_TIEU'] = [r[:5] for r in crm['KPI_CHI_TIEU']]
ns = crm['NHAN_SU']; a = next(r for r in ns[1:] if r[0] == 'ADMIN'); a = a[:]; a[2] = ''; a[10] = ''
seed['CRM']['NHAN_SU'] = [ns[0], a]
(ROOT / 'tests/seed.json').write_text(json.dumps(seed, ensure_ascii=False), encoding='utf-8')
def lit(s): return "'" + s.replace("'", "''") + "'"
lines = ['-- SINH TỰ ĐỘNG bởi tools/build_seed.py — cấu trúc + cấu hình chung, KHÔNG có dữ liệu cá nhân.', 'begin;']
for b, sheets in seed.items():
    for sh, rows in sheets.items():
        vals = [f"({lit(b)},{lit(sh)},{i + 1},{lit(json.dumps(r, ensure_ascii=False))}::jsonb)" for i, r in enumerate(rows)]
        for k in range(0, len(vals), 200):
            lines.append('insert into app_rows (book, sheet, idx, cells) values\n' + ',\n'.join(vals[k:k + 200]) + '\non conflict (book, sheet, idx) do nothing;')
lines += ["-- mật khẩu ban đầu của NT001 (đổi ngay lần đăng nhập đầu); xem bằng: select value from app_props where key = 'ADMIN_INIT_PW';",
          "insert into app_props (key, value) values ('ADMIN_INIT_PW', lpad((floor(random() * 100000000))::bigint::text, 8, '0')) on conflict (key) do nothing;", 'commit;']
(ROOT / 'supabase/migrations/20261025000200_seed.sql').write_text('\n'.join(lines), encoding='utf-8')
print({b: {k: len(v) for k, v in s.items() if len(v) > 1} for b, s in seed.items()})
