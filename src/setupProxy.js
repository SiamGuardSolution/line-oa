// src/setupProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

const qs = require('querystring');

// ตั้งค่าจาก .env (อย่างน้อยต้องมีค่าใดค่าหนึ่ง)
const GAS_EXEC_BASE =
  (process.env.REACT_APP_GAS_EXEC || process.env.GAS_EXEC || '').replace(/\/$/, '');

const GAS_DEPLOYMENT_ID =
  process.env.REACT_APP_GAS_DEPLOYMENT_ID ||
  process.env.GAS_DEPLOYMENT_ID ||
  '';

if (!GAS_EXEC_BASE && !GAS_DEPLOYMENT_ID) {
  // แจ้งเตือนชัดเจนตอนรัน dev
  console.warn(
    '[setupProxy] Missing GAS endpoint. Set one of:\n' +
      '  REACT_APP_GAS_EXEC=https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec\n' +
      '  or REACT_APP_GAS_DEPLOYMENT_ID=<DEPLOYMENT_ID>'
  );
}

const TARGET_ORIGIN = 'https://script.google.com';

// helper: สร้าง path ปลายทาง /macros/s/<id>/exec?... (ถ้าไม่ได้กำหนด GAS_EXEC_BASE)
const execPath = (tail) =>
  GAS_EXEC_BASE
    ? `${new URL(tail, GAS_EXEC_BASE).pathname}${new URL(tail, GAS_EXEC_BASE).search}`
    : `/macros/s/${GAS_DEPLOYMENT_ID}/exec${tail.startsWith('?') ? tail : `?${tail.replace(/^\?/, '')}`}`;

module.exports = function (app) {
  // ===== SUBMIT: POST /api/submit-contract  ->  .../exec?path=submit
  app.use(
    '/api/submit-contract',
    createProxyMiddleware({
      target: GAS_EXEC_BASE || TARGET_ORIGIN,
      changeOrigin: true,
      xfwd: true,
      // คง body JSON ให้ Apps Script อ่านได้
      onProxyReq(proxyReq, req) {
        // http-proxy-middleware จะส่ง body ให้อยู่แล้วถ้า content-type ถูกต้อง
        // ไม่ต้องทำอะไรเพิ่ม เว้นแต่ต้องการแปลงเอง
      },
      pathRewrite: function (path /*, req */) {
        // ไม่ต้องสน query อื่น ๆ สำหรับ submit (ถ้ามีจะคงไว้ก็ได้)
        const q = path.split('?')[1];
        const query = qs.stringify(Object.assign({ path: 'submit' }, q ? qs.parse(q) : {}));
        return execPath(`?${query}`);
      },
      logLevel: 'warn',
      secure: true,
      timeout: 30_000,
      proxyTimeout: 30_000,
      onError(err, req, res) {
        console.error('[proxy submit] ', err && err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'SUBMIT_PROXY_FAILED' }));
      },
    })
  );

  // ===== CHECK: GET /api/check-contract?phone=...  ->  .../exec?path=check&phone=...
  app.use(
    '/api/check-contract',
    createProxyMiddleware({
      target: GAS_EXEC_BASE || TARGET_ORIGIN,
      changeOrigin: true,
      xfwd: true,
      pathRewrite: function (path /*, req */) {
        const q = path.split('?')[1]; // เอา query เดิมทั้งหมด
        const query = qs.stringify(Object.assign({ path: 'check' }, q ? qs.parse(q) : {}));
        return execPath(`?${query}`);
      },
      logLevel: 'warn',
      secure: true,
      timeout: 30_000,
      proxyTimeout: 30_000,
      onError(err, req, res) {
        console.error('[proxy check] ', err && err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'CHECK_PROXY_FAILED' }));
      },
    })
  );
};
