import React, { useMemo, useState } from "react";
import "./DateCheckPage.css";

/** endpoint หลักที่เราอยากใช้ */
const API_CHECK = "/api/check";

/** normalize ชื่อชีตให้ได้ 3 กลุ่มแน่นอน */
function normalizeSheetKey(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "spray") return "Spray";
  if (s === "bait") return "Bait";
  if (s === "mix") return "Mix";
  return v ? String(v) : "Other";
}

async function fetchJsonWithTimeout(url, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  const res = await fetch(url, { method: "GET", signal: controller.signal });
  clearTimeout(timer);

  const raw = await res.text();

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    const preview = String(raw || "").slice(0, 180);
    throw new Error(`API ตอบกลับไม่ใช่ JSON (status ${res.status}) : ${preview}`);
  }

  if (!res.ok || data?.ok === false) {
    // ถ้าเป็น Next/Vercel 404 มักได้ {code, message}
    const msg =
      data?.error ||
      data?.message ||
      (data?.code ? `${data.code}: ${data.message || ""}` : "") ||
      `NOT_OK (${res.status})`;
    const err = new Error(msg.trim() || `NOT_OK (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export default function DateCheckPage() {
  const [date, setDate] = useState(""); // YYYY-MM-DD
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [results, setResults] = useState([]);

  const grouped = useMemo(() => {
    const g = { Bait: [], Spray: [], Mix: [] };
    for (const r of results || []) {
      const key = normalizeSheetKey(r.sheet || r.sheetName || r.tab || r.type);
      if (!g[key]) g[key] = [];
      g[key].push(r);
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
      // 1) ยิงไป endpoint หลัก (ใหม่)
      const u1 = `${API_CHECK}?action=dateScan&date=${encodeURIComponent(date)}`;

      // 2) fallback ยิงไป /api/exec (pass-through)
      const u2 = `/api/exec?action=dateScan&date=${encodeURIComponent(date)}`;

      // 3) fallback สุดท้าย เผื่อบางที่ยังใช้แบบ path=date-scan (ถ้าคุณทำไว้ใน GAS)
      const u3 = `${API_CHECK}?path=date-scan&date=${encodeURIComponent(date)}`;

      let data = null;
      try {
        data = await fetchJsonWithTimeout(u1);
      } catch (e1) {
        try {
          data = await fetchJsonWithTimeout(u2);
        } catch (e2) {
          data = await fetchJsonWithTimeout(u3);
        }
      }

      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (e) {
      const msg =
        e?.name === "AbortError"
          ? "คำขอหมดเวลา (timeout)"
          : String(e?.message || e);
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  const renderTable = (k) => {
    const rows = grouped[k] || [];
    if (!rows.length) return <div className="dc-empty">— ไม่พบข้อมูล —</div>;

    return (
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
            {rows.map((r, idx) => {
              const name = r.name || r.customerName || "-";
              const phone = r.phone || r.tel || r.mobile || "-";
              const address = r.address || r.addr || "-";

              const services = Array.isArray(r.services)
                ? r.services
                : Array.isArray(r.serviceColumns)
                ? r.serviceColumns
                : Array.isArray(r.cols)
                ? r.cols
                : [];

              const rowNumber = r.rowNumber || r.row || r.rowIndex || "-";
              const sheetName = r.sheetName || r.sheet || k;

              return (
                <tr key={`${k}-${rowNumber}-${idx}`}>
                  <td>{name}</td>
                  <td>{phone}</td>
                  <td className="dc-address">{address}</td>
                  <td>
                    <div className="dc-tags">
                      {services.length ? (
                        services.map((s, i) => (
                          <span className="dc-tag" key={i}>
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="dc-tag dc-tag--muted">ไม่ระบุคอลัมน์</span>
                      )}
                    </div>
                    <div className="dc-rowhint">
                      แถว #{rowNumber} ({sheetName})
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

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
          {results?.length ? <span>พบทั้งหมด {results.length} รายการ</span> : <span>ยังไม่มีผลลัพธ์</span>}
        </div>
      </div>

      <div className="dc-section">
        <h2 className="dc-h2">Bait</h2>
        {renderTable("Bait")}
      </div>

      <div className="dc-section">
        <h2 className="dc-h2">Spray</h2>
        {renderTable("Spray")}
      </div>

      <div className="dc-section">
        <h2 className="dc-h2">Mix</h2>
        {renderTable("Mix")}
      </div>
    </div>
  );
}
