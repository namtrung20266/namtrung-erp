-- NAM TRUNG ERP — khung lưu trữ trên Supabase
-- Mỗi "sổ" (CORE, HR, CRM) gồm các "sheet"; mỗi dòng sheet là 1 bản ghi jsonb.
-- Toàn bộ truy cập đi qua Edge Function "api" (khóa service). Trình duyệt không đọc bảng trực tiếp.
create table if not exists app_rows (
  book  text not null,
  sheet text not null,
  idx   int  not null,
  cells jsonb not null default '[]'::jsonb,
  primary key (book, sheet, idx)
);
create table if not exists app_props (key text primary key, value text);
create table if not exists app_cache (key text primary key, value text not null, expires_at bigint not null);
create index if not exists app_cache_exp on app_cache (expires_at);
create table if not exists app_audit (
  id bigserial primary key, at text, user_id text, action text, entity text, entity_id text, after text,
  created_at timestamptz not null default now()
);
alter table app_rows  enable row level security;
alter table app_props enable row level security;
alter table app_cache enable row level security;
alter table app_audit enable row level security;

-- Kho ảnh (bill nạp rút, ảnh claim, ảnh chấm công)
insert into storage.buckets (id, name, public) values ('files', 'files', true) on conflict (id) do nothing;

-- Tham số hệ thống
insert into app_props (key, value) values
  ('SALT', gen_random_uuid()::text),
  ('JOB_KEY', gen_random_uuid()::text),
  ('DB_CORE', 'CORE'), ('DB_HR', 'HR'), ('DB_CRM', 'CRM')
on conflict (key) do nothing;

-- Lịch chạy 07:30 giờ VN mỗi ngày (00:30 UTC): nhắc đơn, tin Lark, chốt công, việc hằng ngày của CRM
create extension if not exists pg_net;
create extension if not exists pg_cron;
select cron.schedule('nt-daily', '30 0 * * *', $cron$
  select net.http_post(
    url := (select value from app_props where key = 'FUNC_URL'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-job-key', (select value from app_props where key = 'JOB_KEY')),
    body := '{"fn":"job"}'::jsonb)
$cron$);
-- Dọn phiên đăng nhập hết hạn mỗi đêm
select cron.schedule('nt-clean-cache', '0 20 * * *', $c$ delete from app_cache where expires_at < (extract(epoch from now()) * 1000)::bigint $c$);
