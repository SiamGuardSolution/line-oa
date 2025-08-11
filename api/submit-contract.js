// api/submit-contract.js  (CommonJS)
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxY9iv0kRuZ7fHfRJUNnRzQxF2ocp6HwJQ1jOzyLWvHV2_dxMTLzNnmWVfxj_Ef3d_dWw/exec';

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
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);

    // ปลอดภัย: map servicePackage -> package เผื่อ GAS ใช้ชื่อเดิม
    const payload = { ...body, package: body.servicePackage ?? body.package };

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await response.text(); // อ่านดิบก่อน กันกรณี GAS ตอบ HTML/ข้อความ
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }

    // ส่งสถานะกลับไปที่ client
    if (!response.ok) {
      res.status(response.status).json(json);
      return;
    }
    res.status(200).json(json);
  } catch (err) {
    res.status(500).json({ error: 'Proxy failed', message: err.message });
  }
};
