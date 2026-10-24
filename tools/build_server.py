"""Gộp code nghiệp vụ (src/server) thành 1 module cho Supabase Edge Function."""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
ERP = ['Schema', 'Core', 'Hr', 'HrOps', 'Admin']
parts = [(ROOT / 'src/server/erp' / f'{n}.js').read_text(encoding='utf-8') for n in ERP]
parts.append((ROOT / 'src/server/crm/CrmModule.js').read_text(encoding='utf-8'))
parts.append((ROOT / 'src/server/overrides.js').read_text(encoding='utf-8'))
head = """// =====================================================================
// SINH TỰ ĐỘNG bởi tools/build_server.py — KHÔNG SỬA TAY.
// Sửa code ở src/server/erp, src/server/crm, src/server/overrides.js rồi chạy lại build.
// =====================================================================
export function createApp(ENV) {
  const globalThis = {};
  const { Date, SpreadsheetApp, PropertiesService, CacheService, LockService, Utilities, DriveApp, HtmlService, Session, ScriptApp, MailApp, UrlFetchApp, Logger } = ENV;
  function __ROUTES_() { return globalThis.__ROUTES || {}; }
"""
tail = """
  return { api, crm, jobHangNgay, CRM_, routes: __ROUTES_ };
}
"""
out = head + '\n'.join(parts) + tail
(ROOT / 'supabase/functions/api/app.bundle.js').write_text(out, encoding='utf-8')
print('app.bundle.js', len(out))
