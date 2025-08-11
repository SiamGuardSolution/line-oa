// api/submit-contract.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const googleScriptUrl =
      'https://script.google.com/macros/s/AKfycbxY9iv0kRuZ7fHfRJUNnRzQxF2ocp6HwJQ1jOzyLWvHV2_dxMTLzNnmWVfxj_Ef3d_dWw/exec'; // ใส่ URL ของคุณ

    const response = await fetch(googleScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // หากต้อง map ชื่อ field เพิ่ม ให้ทำที่นี่ก่อน stringify
      body: JSON.stringify(req.body),
    });

    // คาดหวังว่า GAS จะตอบเป็น JSON เช่น { result: "success" }
    const result = await response.json();
    return res.status(200).json(result);
  } catch (error) {
    return res
      .status(500)
      .json({ error: 'Proxy failed', message: error.message });
  }
}
