export default async function handler(req, res) {
  try {
    const date = String(req.query?.date || "");
    if (!date) return res.status(400).json({ ok: false, error: "Missing date" });

    // ✅ ใส่เป็น env ใน Vercel: CHECK_API_URL = https://script.google.com/macros/s/xxxx/exec
    const base = process.env.CHECK_API_URL;
    if (!base) return res.status(500).json({ ok: false, error: "Missing CHECK_API_URL env" });

    const url = `${base}?action=dateScan&date=${encodeURIComponent(date)}`;
    const r = await fetch(url, { method: "GET" });

    const text = await r.text();
    res.status(r.status).setHeader("content-type", "application/json; charset=utf-8");
    return res.send(text);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
