# Nam Trung ERP

Một ứng dụng duy nhất cho Nam Trung Group: **Bán hàng (CRM)** + **Nhân sự, chấm công, nghỉ phép, lương** + **Quản trị**.
Chạy trên **Supabase** (cơ sở dữ liệu, API, kho ảnh, lịch chạy hằng ngày) và **GitHub Pages** (giao diện).

## Cấu trúc thư mục

| Thư mục | Nội dung | Ai sửa |
|---|---|---|
| `src/server/erp/` | Nghiệp vụ ERP: đăng nhập, phân quyền, nghỉ phép, chấm công, lương, báo cáo, quản trị | Dev |
| `src/server/crm/CrmModule.js` | Toàn bộ nghiệp vụ CRM (khách, chăm sóc, báo giá, nạp rút, claim, hỗ trợ, KPI, 14 báo cáo) | Dev |
| `src/server/overrides.js` | Phần riêng khi chạy trên Supabase (nhập Excel, ảnh, nhật ký) | Dev |
| `tools/web_src/` | Giao diện gốc: `erp_client.js` (ERP), `crm_index.html` (CRM), `erp_css.css` | Dev |
| `tools/build_server.py` | Gộp `src/server` → `supabase/functions/api/app.bundle.js` | Chạy khi sửa server |
| `tools/build_web.py` | Ghép ERP + CRM thành 1 giao diện → `web/` | Chạy khi sửa giao diện |
| `tools/build_seed.py` | Sinh dữ liệu khởi tạo (không chứa dữ liệu cá nhân) | Hiếm khi |
| `supabase/functions/api/` | API duy nhất: `index.ts` (cổng), `runtime.js` (lớp chạy), `db.js` (Postgres) | Hiếm khi |
| `supabase/migrations/` | Tạo bảng, kho ảnh, lịch chạy, dữ liệu khởi tạo | Hiếm khi |
| `web/` | Giao diện đã ghép (tự sinh) | Không sửa tay |
| `tests/` | Kiểm thử đầu-cuối trên Postgres thật (PGlite) + máy chủ chạy thử | Dev |

## Sửa và đưa lên
```bash
npm install            # lần đầu
npm run build          # gộp server + ghép giao diện
npm test               # 59 tình huống ERP + CRM trên Postgres
npm run dev            # chạy thử ở http://localhost:8787
git push               # GitHub Actions tự đưa lên Supabase + GitHub Pages
```

## Thêm trường thông tin
- **CRM:** thêm vào `SCHEMA` trong `src/server/crm/CrmModule.js` + ô nhập trong `tools/web_src/crm_index.html`. Cột mới tự thêm vào dữ liệu ở lần chạy sau.
- **ERP:** thêm cột vào `src/server/erp/Schema.js` và dùng trong nghiệp vụ.

## Cài đặt lần đầu (1 lần)
1. GitHub → repo → Settings → Secrets and variables → Actions:
   - Secret `SUPABASE_ACCESS_TOKEN`: tạo ở supabase.com → Account → Access Tokens.
   - Secret `SUPABASE_DB_PASSWORD`: mật khẩu cơ sở dữ liệu của project Supabase.
   - Variable `SUPABASE_PROJECT_REF`: mã project (trong link `supabase.com/dashboard/project/<mã>`).
2. Settings → Pages → Source: **GitHub Actions**.
3. Actions → Deploy Nam Trung ERP → Run workflow.
4. Supabase → SQL Editor: `select value from app_props where key = 'ADMIN_INIT_PW';` → mật khẩu ban đầu của **NT001**.
5. Mở link GitHub Pages → đăng nhập NT001 → đổi mật khẩu → **Quản trị → Nhập dữ liệu từ file Excel**:
   file nhân sự `NT_CORE.xlsx`, `NT_HR.xlsx`, rồi file Google Sheet CRM (tải về dạng .xlsx) → **Cấp mật khẩu tạm hàng loạt**.
