import React, { useMemo, useState } from "react";
import "./DateCheckPage.css";

/** ✅ ใช้ endpoint เดียวกับระบบ check ที่ proxy รองรับจริง */
const API_EXEC = "/api/exec";

function normalizeSheetKey(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "spray") return "Spray";
  if (s === "bait") return "Bait";
  if (s === "mix") return "Mix";
  return v ? String(v) : "Other";
}

function toErrText(e) {
  if (!e) return "เกิดข้อผิดพลาด";
  if (typeof e === "string") return e;
  if (e?.name === "AbortError") return "คำขอหมดเวลา (timeout)";
  const m = e?.message;
  if (typeof m === "string") return m;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      // ✅ ยิงไปที่ /api/exec เหมือนหน้า check
      const url = `${API_EXEC}?action=dateScan&date=${encodeURIComponent(date)}`;

      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const raw = await res.text();

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        const preview = String(raw || "").slice(0, 180);
        throw new Error(`API ตอบกลับไม่ใช่ JSON (status ${res.status}) : ${preview}`);
      }

      if (!res.ok || data?.ok === false) {
        // รองรับ error เป็น string/object
        const msg =
          typeof data?.error === "string"
            ? data.error
            : data?.error
            ? JSON.stringify(data.error)
            : `NOT_OK (${res.status})`;
        throw new Error(msg);
      }

      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (e) {
      setErr(toErrText(e));
    } finally {
      clearTimeout(timer);
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
