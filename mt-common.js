/* MoldTracking common script - v0.1 (2026-10-04)
   v0.1: first version. Address storage, API call, error display + logging, self-check line.
   Every page includes this file. If it fails to load, the bottom line stays
   "Script chưa chạy · 프로그램 실행 안 됨", which is the signal to check file names (case sensitive). */
var MT = (function () {
  var VERSION = 'v0.1';
  var GAS_RE = /^https:\/\/script\.google\.com\/[A-Za-z0-9_.\-\/]+\/exec$/;
  var ID_RE = /^[A-Z0-9-]{3,19}$/;
  var pageName = '?';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  function gasUrl() { return get('mtGasUrl'); }
  function hasGas() { return GAS_RE.test(gasUrl()); }
  function setGasUrl(u) { u = String(u || '').trim(); if (!GAS_RE.test(u)) return false; return set('mtGasUrl', u); }

  // A link such as input.html#gas=<address> stores the address on this phone, then the hash is removed.
  function readHash() {
    var m = /[#&]gas=([^&]+)/.exec(location.hash || '');
    if (!m) return false;
    var ok = false;
    try { ok = setGasUrl(decodeURIComponent(m[1])); } catch (e) {}
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    return ok;
  }

  function deviceId() {
    var d = get('mtDevice');
    if (!d) { d = 'D' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase(); set('mtDevice', d); }
    return d;
  }

  function named(name, message) { var e = new Error(message); e.name = name; return e; }

  // POST as text/plain: a "simple request", so the browser sends no preflight (Apps Script cannot answer one).
  function api(action, data, noLog) {
    if (!hasGas()) return Promise.reject(named('NoAddress', 'Chưa có địa chỉ Sheet · 시트 주소 없음 (setup.html)'));
    var body = { action: action, device: deviceId() }, k;
    for (k in (data || {})) body[k] = data[k];
    var opt = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) };
    var timer = null;
    if (typeof AbortController === 'function') {
      var ac = new AbortController();
      opt.signal = ac.signal;
      timer = setTimeout(function () { ac.abort(); }, 30000);
    }
    return fetch(gasUrl(), opt).then(function (r) {
      if (!r.ok) throw named('HttpError', 'HTTP ' + r.status);
      return r.text();
    }).then(function (t) {
      if (timer) clearTimeout(timer);
      var j;
      try { j = JSON.parse(t); } catch (e) { throw named('BadReply', 'Không phải JSON · JSON 아님: ' + t.substring(0, 80)); }
      if (!j.ok) throw named('ApiError', j.error || 'unknown');
      return j;
    }).catch(function (e) {
      if (timer) clearTimeout(timer);
      if (e && e.name === 'AbortError') e = named('Timeout', 'Quá 30 giây · 30초 초과');
      if (e && e.name === 'TypeError') e = named('NetworkError', 'Không kết nối được · 연결 안 됨 (' + e.message + ')');
      throw e;
    });
  }

  // Error on screen with its name (one screenshot is enough to find the cause) and in the Errors sheet.
  function showError(where, e, noLog) {
    var name = e && e.name ? e.name : 'Error', message = e && e.message ? e.message : String(e);
    var box = $('err');
    if (box) { box.style.display = 'block'; box.textContent = 'Lỗi · 오류 [' + where + '] ' + name + ': ' + message; }
    // ApiError is already written to the Errors sheet by the server.
    if (!noLog && hasGas() && ['NetworkError', 'Timeout', 'NoAddress', 'ApiError'].indexOf(name) < 0) {
      api('logError', { page: pageName + ':' + where, name: name, message: message }).catch(function () {});
    }
  }
  function clearError() { var box = $('err'); if (box) { box.style.display = 'none'; box.textContent = ''; } }

  function init(name, pageVersion, extra) {
    pageName = name;
    readHash();
    window.addEventListener('error', function (ev) { showError('script', ev.error || named('ScriptError', ev.message)); });
    window.addEventListener('unhandledrejection', function (ev) { showError('promise', ev.reason); });
    var sc = $('selfcheck');
    if (sc) sc.textContent = 'Script OK · 프로그램 실행 중 — ' + name + ' ' + pageVersion + ' / common ' + VERSION + (extra ? ' / ' + extra : '');
    var na = $('noaddr');
    if (na && !hasGas()) na.style.display = 'block';
  }

  function fmtTime(ms) {
    if (!ms) return '';
    var d = new Date(ms), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  var STATUS = {
    NEW:   'Chưa bắt đầu · 미착수', WAIT: 'Đang chờ · 대기', RUN: 'Đang làm · 진행 중', DONE: 'Xong · 완료',
    MOVED: 'Đã xuất · 출고됨',     NG:   'Không đạt · 불합격', HOLD: 'Tạm dừng · 중단'
  };

  return { VERSION: VERSION, GAS_RE: GAS_RE, ID_RE: ID_RE, $: $, esc: esc, get: get, set: set, gasUrl: gasUrl,
           hasGas: hasGas, setGasUrl: setGasUrl, deviceId: deviceId, api: api, showError: showError,
           clearError: clearError, init: init, fmtTime: fmtTime, STATUS: STATUS, named: named };
})();
