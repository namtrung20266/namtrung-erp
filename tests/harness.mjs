// Chạy y hệt Edge Function nhưng trên Node + PGlite (Postgres thật chạy trong bộ nhớ)
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import { makeEnv, hashTools } from '../supabase/functions/api/runtime.js';
import { createApp } from '../supabase/functions/api/app.bundle.js';
import { loadSnapshot, flushChanges } from '../supabase/functions/api/db.js';
export async function boot() {
  const db = new PGlite();
  const init = fs.readFileSync(new URL('../supabase/migrations/20261025000100_init.sql', import.meta.url), 'utf8')
    .split('-- Kho ảnh')[0];
  await db.exec(init);
  await db.exec(`insert into app_props (key, value) values ('SALT', 'test-salt'), ('JOB_KEY','k'), ('DB_CORE','CORE'),('DB_HR','HR'),('DB_CRM','CRM') on conflict do nothing;`);
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261025000200_seed.sql', import.meta.url), 'utf8'));
  const q = async (t, p) => (await db.query(t, p || [])).rows;
  const uploads = [];
  async function run(fn, args) {
    const books = fn === 'api' && !/^admin\.(import|sheet)/.test(String(args[0])) ? ['CORE', 'HR'] : ['CORE', 'HR', 'CRM'];
    const snap = await loadSnapshot(q, books);
    const env = makeEnv(snap, { appUrl: 'https://nt.example/', storageBase: 'https://sb.example/storage/v1/object/public/files/' });
    env.audit = [];
    const app = createApp(env);
    let result, error = null;
    try {
      if (fn === 'api') result = app.api(args[0], args[1], args[2]);
      else if (fn === 'crm') result = app.crm(args[0], args[1]);
      else if (fn === 'job') { app.jobHangNgay(); result = 'ok'; }
    } catch (e) { error = e.message; if (process.env.DEBUG) console.error(e.stack); }
    const ch = env.collect();
    uploads.push(...ch.uploads);
    await q('begin'); await flushChanges(q, ch, env.audit); await q('commit');
    return { error, result: result === undefined ? null : JSON.parse(JSON.stringify(result)) };
  }
  async function setPassword(username, pw) {
    const rows = await q("select idx, cells from app_rows where book='CORE' and sheet='users' order by idx");
    const head = rows[0].cells, iu = head.indexOf('username'), ip = head.indexOf('password_hash'), im = head.indexOf('must_change_password');
    const salt = (await q("select value from app_props where key='SALT'"))[0].value;
    const h = hashTools.sha256(salt + '|' + username.toUpperCase() + '|' + pw);
    const b64 = Buffer.from(h).toString('base64');
    for (const r of rows.slice(1)) if (String(r.cells[iu]).toUpperCase() === username.toUpperCase()) {
      r.cells[ip] = 'v2:' + b64; r.cells[im] = false;
      await q("update app_rows set cells = $1::jsonb where book='CORE' and sheet='users' and idx=$2", [JSON.stringify(r.cells), r.idx]);
    }
  }
  return { db, q, run, setPassword, uploads };
}
