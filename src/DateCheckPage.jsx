import React, { useMemo, useState } from "react";
import "./DateCheckPage.css";

/* ---------------------- CONFIG (เหมือน CheckPage) ---------------------- */
const HOST = window.location.hostname;
const PROXY = (process.env.REACT_APP_API_BASE || "https://siamguards-proxy.phet67249.workers.dev").replace(/\/$/, "");
const API_BASES = (HOST === "localhost" || HOST === "127.0.0.1") ? ["", PROXY] : [PROXY];

/* ---------------------- Helpers ---------------------- */
async function fetchJsonWithFallback(urlPath) {
  let lastErr = null;

  for (const base of API_BASES) {
    const url = `${base}${urlPath}`;
    try {
      const r = await fetch(url, { method: "GET" });
      const text = await r.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        // ถ้าได้ HTML/ข้อความแปลกๆ จะเห็นหัวข้อความชัด
        throw new Error(`NOT_JSON: ${text.slice(0, 140)}`);
      }

      if (!r.ok) throw new Error(data?.error || `HTTP_${r.status}`);
      return data;
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("REQUEST_FAILED");
}

async function fetchDateScan(date) {
  // 1) ลองแบบ path ก่อน (แนะนำให้ GAS รองรับ path=date-scan)
  const u1 = `/exec?path=date-scan&date=${encodeURIComponent(date)}`;
  const d1 = await fetchJsonWithFallback(u1);

  // ถ้า ok แล้วจบ
  if (d1?.ok) return d1;

  // 2) ถ้า GAS ยังไม่รองรับ path ให้ลองแบบ action
  const u2 = `/exec?action=dateScan&date=${encodeURIComponent(date)}`;
  const d2 = await fetchJsonWithFallback(u2);
  return d2;
}

export default function DateCheckPage() {
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [results, setResults] = useState([]);

  const grouped = useMemo(() => {
    const g = { Spray: [], Bait: [], Mix: [] };
    for (const r of results || []) {
      const k = r.sheet || "Other";
      if (!g[k]) g[k] = [];
      g[k].push(r);
    }
    return g;
  }, [results]);

  async function onSearch() {
    setErr("");
    setResults([]);

    if (!date) {
      setErr("กรุณาเลือกวันที่ก่อน");
      return;
    }

    setLoading(true);
    try {
      const data = await fetchDateScan(date);

      if (!data?.ok) throw new Error(data?.error || "ค้นหาไม่สำเร็จ");
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="datecheck-container">
      <div className="dc-top">
        <h1>ตรวจสอบงานตามวันที่</h1>
        <p className="dc-subtitle">
          เลือกวันที่ → ระบบจะค้นหาทุกแถวใน Spray / Bait / Mix และบอกว่า “วันที่นี้อยู่ในคอลัมน์ Service ไหน”
        </p>
      </div>

      <div className="dc-card">
        <div className="dc-row">
          <label className="dc-label">เลือกวันที่</label>
          <input
            className="dc-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button className="dc-btn" onClick={onSearch} disabled={loading}>
            {loading ? "กำลังค้นหา..." : "ค้นหา"}
          </button>
        </div>

        {err ? <div className="dc-error">⚠ {err}</div> : null}

        <div className="dc-meta">
          {results?.length ? (
            <span>พบทั้งหมด {results.length} รายการ</span>
          ) : (
            <span>ยังไม่มีผลลัพธ์</span>
          )}
        </div>
      </div>

      {/* Results */}
      {["Bait", "Spray", "Mix"].map((k) => (
        <div key={k} className="dc-section">
          <h2 className="dc-h2">{k}</h2>

          {!grouped[k]?.length ? (
            <div className="dc-empty">— ไม่พบข้อมูล —</div>
          ) : (
            <div className="dc-tablewrap">
              <table className="dc-table">
                <thead>
                  <tr>
                    <th style={{ width: 220 }}>ชื่อ</th>
                    <th style={{ width: 140 }}>เบอร์โทร</th>
                    <th>ที่อยู่</th>
                    <th style={{ width: 260 }}>พบในคอลัมน์ Service</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[k].map((r, idx) => (
                    <tr key={`${k}-${r.rowNumber}-${idx}`}>
                      <td>{r.name || "-"}</td>
                      <td>{r.phone || "-"}</td>
                      <td className="dc-address">{r.address || "-"}</td>
                      <td>
                        <div className="dc-tags">
                          {(r.services || []).map((s, i) => (
                            <span className="dc-tag" key={i}>{s}</span>
                          ))}
                        </div>
                        <div className="dc-rowhint">
                          แถว #{r.rowNumber} ({r.sheetName})
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
