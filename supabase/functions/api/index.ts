// =====================================================================
// NAM TRUNG ERP — API duy nhất (Supabase Edge Function)
// Giao diện gửi { fn, args } giống google.script.run.<fn>(...args)
// =====================================================================
import postgres from 'postgres';
import { makeEnv } from './runtime.js';
import { createApp } from './app.bundle.js';
import { loadSnapshot, flushChanges } from './db.js';

const DB_URL = Deno.env.get('SUPABASE_DB_URL')!;
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sql = postgres(DB_URL, { max: Number(Deno.env.get('DB_POOL') || 4), prepare: false, idle_timeout: 20 });
const STORAGE_BASE = SB_URL + '/storage/v1/object/public/files/';
// Lưu địa chỉ API để lịch chạy hằng ngày (pg_cron) gọi đúng chỗ
sql`insert into app_props (key, value) values ('FUNC_URL', ${SB_URL + '/functions/v1/api'}) on conflict (key) do update set value = excluded.value`.catch(() => {});
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-job-key', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

// Các chức năng chỉ đọc: chạy song song, không cần khóa
const READ_ERP = new Set(['app.bootstrap', 'hr.absence.board', 'hr.leave.preview', 'hr.leave.mine', 'hr.leave.pending', 'att.mine', 'att.day', 'att.photo', 'pay.slips', 'pay.mySlips', 'rpt.hr.monthly', 'rpt.hr.attendanceScore', 'admin.users.list', 'auth.logout']);
const READ_CRM = new Set(['apiBootstrap', 'apiListKH', 'apiKHGon', 'apiGetKH', 'apiGetBG', 'apiListBG', 'apiCheckTrung', 'apiKHHTInfo', 'apiHTGet', 'apiHTList', 'apiNRList', 'apiCLList', 'apiCLGet', 'apiHome', 'apiKHAll', 'apiStart', 'apiDailyGet', 'apiDailyTeam', 'apiReport', 'apiUsers', 'apiLogout']);

async function upload(u: { path: string, bytes: number[], type: string }) {
  const r = await fetch(`${SB_URL}/storage/v1/object/files/${u.path}`, { method: 'POST', headers: { Authorization: `Bearer ${SERVICE}`, 'Content-Type': u.type, 'x-upsert': 'true' }, body: new Uint8Array(u.bytes) });
  if (!r.ok) throw new Error('Không lưu được ảnh: ' + (await r.text()).slice(0, 200));
}

async function run(fn: string, args: unknown[], appUrl: string) {
  const books = fn === 'api' && !/^admin\.import/.test(String(args[0])) ? ['CORE', 'HR'] : ['CORE', 'HR', 'CRM'];
  const write = fn === 'job' || (fn === 'api' && !READ_ERP.has(String(args[0]))) || (fn === 'crm' && !READ_CRM.has(String(args[0])));
  const conn = await sql.reserve();
  const q = (t: string, p: unknown[]) => conn.unsafe(t, p as never[]);
  try {
    if (write) await q('select pg_advisory_lock(424242)', []);
    const snap = await loadSnapshot(q, books);
    const env: any = makeEnv(snap, { appUrl, storageBase: STORAGE_BASE });
    env.audit = [];
    const app = createApp(env);
    let result: unknown, error: string | null = null;
    try {
      if (fn === 'api') result = app.api(args[0], args[1], args[2]);
      else if (fn === 'crm') result = app.crm(args[0], args[1]);
      else if (fn === 'job') { app.jobHangNgay(); result = 'ok'; }
      else throw new Error('Không có chức năng ' + fn);
    } catch (e) { error = (e as Error).message || String(e); }
    const ch = env.collect();
    for (const u of ch.uploads) await upload(u);
    if (ch.sheets.length || Object.keys(ch.props).length || Object.keys(ch.cacheSet).length || ch.cacheDel.length || env.audit.length) {
      await q('begin', []);
      try { await flushChanges(q, ch, env.audit); await q('commit', []); } catch (e) { await q('rollback', []); throw e; }
    }
    for (const f of ch.fetches) if (/larksuite|feishu/.test(f.url)) fetch(f.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: f.o.payload }).catch(() => {});
    return { error, result };
  } finally {
    if (write) await q('select pg_advisory_unlock(424242)', []).catch(() => {});
    conn.release();
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json();
    const fn = String(body.fn || '');
    if (fn === 'job') {
      const rows = await sql`select value from app_props where key = 'JOB_KEY'`;
      const value = rows.length ? rows[0].value : '';
      if (!value || req.headers.get('x-job-key') !== value) return new Response('forbidden', { status: 403, headers: CORS });
    } else if (fn !== 'api' && fn !== 'crm') return new Response(JSON.stringify({ ok: false, error: 'Sai chức năng' }), { headers: { ...CORS, 'content-type': 'application/json' } });
    const appUrl = String(body.appUrl || '');
    const { error, result } = await run(fn, Array.isArray(body.args) ? body.args : [], appUrl);
    return new Response(JSON.stringify(error ? { ok: false, error } : { ok: true, result: result === undefined ? null : result }), { headers: { ...CORS, 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'Lỗi máy chủ: ' + ((e as Error).message || e) }), { status: 500, headers: { ...CORS, 'content-type': 'application/json' } });
  }
});
