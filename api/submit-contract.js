// api/submit-contract.js
// ✅ ใช้กับ Vercel Serverless Function (โปรเจกต์ CRA ก็ใช้ได้)
// ต้องตั้งค่า ENV: GAS_EXEC_URL = https://script.google.com/macros/s/XXXXX/exec

const FALLBACK_GAS = 'https://script.google.com/macros/s/AKfycbxvD66P9k2NxFOquKyYMvTXYf5xm-fhu36yZtEWARfyAZ4J7c1-SYMD6U4imW1f5hVC4A/exec';
const ALLOW_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://contract.siamguards.com', // แก้/เพิ่มโดเมนจริงของคุณ
  'https://siamguards.com',
];

function allowOrigin(origin) {
  return origin && (ALLOW_ORIGINS.includes(origin) || ALLOW_ORIGINS.includes('*'));
}
function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (allowOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function readJsonBody(req) {
  if (req.body && Object.keys(req.body).length) return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  setCors(req, res);

  // Preflight
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'METHOD_NOT_ALLOWED' });

  try {
    const body = await readJsonBody(req);
    // ให้แน่ใจว่ามี package เสมอ (GAS ใช้ตัดสินว่าจะลงชีตไหน)
    const payload = { ...body, package: body?.servicePackage ?? body?.package };

    const GAS_EXEC_URL = process.env.GAS_EXEC_URL || FALLBACK_GAS;
    const url = new URL(GAS_EXEC_URL);
    url.searchParams.set('path', 'submit');

    // ⏱️ กันค้าง: 15 วินาที
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);

    const resp = await fetch(url.toString(), {
      method: 'POST',
      // ส่งเป็น text/plain เพื่อลดปัญหา doPost + CORS ของ GAS
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: ac.signal,
    }).catch((e) => { throw new Error('FETCH_GAS_FAILED: ' + (e?.message || e)); });
    clearTimeout(t);

    const text = await resp.text();
    let json; try { json = JSON.parse(text); } catch { json = { ok: resp.ok, raw: text }; }

    // ส่งต่อสถานะเดิมจาก GAS
    if (!resp.ok || json?.ok === false) {
      return res.status(resp.status || 500).json(json);
    }
    return res.status(200).json(json);
  } catch (e) {
    const isAbort = String(e?.message || e).includes('aborted');
    return res.status(isAbort ? 504 : 500).json({
      ok: false,
      error: isAbort ? 'UPSTREAM_TIMEOUT' : 'PROXY_ERROR',
      message: String(e?.message || e),
    });
  }
};
