// Đọc / ghi "sổ dữ liệu" trên Postgres. q(text, params) là hàm chạy SQL (postgres.js hoặc PGlite khi kiểm thử).
export async function loadSnapshot(q, books) {
  const snap = { books: {}, props: {}, cache: {} };
  books.forEach(b => snap.books[b] = {});
  const rows = await q('select book, sheet, idx, cells from app_rows where book = any($1::text[]) order by book, sheet, idx', [books]);
  for (const r of rows) {
    const sh = snap.books[r.book][r.sheet] || (snap.books[r.book][r.sheet] = []);
    sh[r.idx - 1] = typeof r.cells === 'string' ? JSON.parse(r.cells) : r.cells;
  }
  Object.values(snap.books).forEach(b => Object.keys(b).forEach(k => { const a = b[k]; for (let i = 0; i < a.length; i++) if (!a[i]) a[i] = []; }));
  for (const r of await q('select key, value from app_props', [])) snap.props[r.key] = r.value;
  for (const r of await q('select key, value, expires_at from app_cache where expires_at > $1', [Date.now()])) snap.cache[r.key] = { v: r.value, exp: Number(r.expires_at) };
  return snap;
}

export async function flushChanges(q, ch, audit) {
  for (const s of ch.sheets) {
    if (s.mode === 'drop' || s.mode === 'replace') await q('delete from app_rows where book = $1 and sheet = $2', [s.book, s.sheet]);
    if (s.mode === 'drop' || !s.rows.length) continue;
    for (let i = 0; i < s.rows.length; i += 500) {
      const part = s.rows.slice(i, i + 500);
      await q(`insert into app_rows (book, sheet, idx, cells)
        select $1, $2, (x->>'idx')::int, x->'cells' from jsonb_array_elements($3::jsonb) x
        on conflict (book, sheet, idx) do update set cells = excluded.cells`, [s.book, s.sheet, part]);
    }
  }
  for (const [k, v] of Object.entries(ch.props)) {
    if (v === null) await q('delete from app_props where key = $1', [k]);
    else await q('insert into app_props (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value', [k, v]);
  }
  const cs = Object.entries(ch.cacheSet);
  if (cs.length) await q(`insert into app_cache (key, value, expires_at)
      select x->>'k', x->>'v', (x->>'e')::bigint from jsonb_array_elements($1::jsonb) x
      on conflict (key) do update set value = excluded.value, expires_at = excluded.expires_at`, [cs.map(([k, o]) => ({ k, v: o.v, e: o.exp }))]);
  if (ch.cacheDel.length) await q('delete from app_cache where key = any($1::text[])', [ch.cacheDel]);
  if (audit && audit.length) await q(`insert into app_audit (at, user_id, action, entity, entity_id, after)
      select x->>'at', x->>'user_id', x->>'action', x->>'entity', x->>'entity_id', x->>'after' from jsonb_array_elements($1::jsonb) x`, [audit]);
}
