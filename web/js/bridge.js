/* Cổng gọi máy chủ: giữ nguyên cách gọi google.script.run.<fn>(...) của code cũ, chuyển sang API Supabase */
(function () {
  function call(fn, args, ok, fail) {
    fetch(window.NT_API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fn: fn, args: args, appUrl: location.origin + location.pathname }) })
      .then(r => r.json())
      .then(d => { if (d && d.ok) ok && ok(d.result); else fail && fail(new Error((d && d.error) || 'Lỗi máy chủ')); })
      .catch(e => fail && fail(new Error('Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.')));
  }
  function runner(ok, fail) {
    return new Proxy({}, { get: function (t, p) {
      if (p === 'withSuccessHandler') return f => runner(f, fail);
      if (p === 'withFailureHandler') return f => runner(ok, f);
      if (p === 'api') return (route, token, payload) => call('api', [route, token, payload], ok, fail);
      if (p === 'crm') return (fn, args) => call('crm', [fn, args], ok, fail);
      return () => fail && fail(new Error('Không có chức năng ' + String(p)));
    } });
  }
  window.google = { script: { run: runner(null, null), url: { getLocation: f => { const p = {}; new URLSearchParams(location.search).forEach((v, k) => p[k] = v); f({ parameter: p }); } } } };
})();
