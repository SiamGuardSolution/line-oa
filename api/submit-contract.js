export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const googleScriptUrl = 'https://script.google.com/macros/s/AKfycbxXQVoFHRxLDpLq_2Rwc1i4QyG03_PKxFfLcbfo8T9avLEftOJZ9KQKQ-JULILKX2DYBg/exec'; // เปลี่ยน URL ตรงนี้

    const response = await fetch(googleScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const result = await response.json();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Proxy failed', message: error.message });
  }
}
