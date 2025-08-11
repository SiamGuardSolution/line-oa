// api/submit-contract.js
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const googleScriptUrl = 'https://script.google.com/macros/s/AKfycbxY9iv0kRuZ7fHfRJUNnRzQxF2ocp6HwJQ1jOzyLWvHV2_dxMTLzNnmWVfxj_Ef3d_dWw/exec';

    const response = await fetch(googleScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const text = await response.text();
    let result;
    try { result = JSON.parse(text); } catch { result = { raw: text }; }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Proxy failed', message: error.message });
  }
};
