// api/submit-contract.js  (CommonJS / Next.js API route หรือ Vercel)
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxvD66P9k2NxFOquKyYMvTXYf5xm-fhu36yZtEWARfyAZ4J7c1-SYMD6U4imW1f5hVC4A/exec';

function readJsonBody(req) {
  if (req.body && Object.keys(req.body).length) return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  // รองรับ preflight กรณีมี reverse proxy อื่น ๆ
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok:false, error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);

    // map ให้แน่ใจว่ามี "package" เสมอ (GAS ใช้คีย์นี้ตัดสินชีต)
    const payload = { ...body, package: body.servicePackage ?? body.package };

    // ===== จุดสำคัญ: ส่งเป็น text/plain ตามรูปแบบที่ doPost ใน GAS อ่าน =====
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?path=submit&debug=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }

    if (!response.ok || json?.ok === false) {
      res.status(response.status || 500).json(json);
      return;
    }
    res.status(200).json(json);
  } catch (err) {
    res.status(500).json({ ok:false, error: 'Proxy failed', message: err?.message || String(err) });
  }
};
