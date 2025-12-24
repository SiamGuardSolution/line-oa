import React, { useMemo, useState } from "react";
import "./DateCheckPage.css";

/** เหมือน CheckPage: มี PROXY fallback */
const HOST = window.location.hostname;
const PROXY = (process.env.REACT_APP_API_BASE || "https://siamguards-proxy.phet67249.workers.dev").replace(/\/$/, "");
const API_BASES =
  HOST === "localhost" || HOST === "127.0.0.1"
    ? ["", PROXY] // dev: ลอง local ก่อน ถ้าไม่ได้ค่อยยิง proxy
    : ["", PROXY]; // prod: ลอง same-origin ก่อน แล้วค่อย proxy

function normalizeSheetKey(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "spray") return "Spray";
  if (s === "bait") return "Bait";
  if (s === "mix") return "Mix";
  return v ? String(v) : "Other";
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function errText(x) {
  if (!x) return "เกิดข้อผิดพลาด";
  if (typeof x === "string") return x;
  if (x?.name === "AbortError") return "คำขอหมดเวลา (timeout)";
  if (typeof x?.message === "string") return x.message;
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

/** fetch JSON + timeout + คืนรายละเอียดไว้ debug */
async function fetchJson(url, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    const raw = await res.text();
    const json = safeJsonParse(raw);

    return {
      ok: res.ok && json && json.ok !== false,
      status: res.status,
      json,
      raw,
      url,
    };
  } finally {
    clearTimeout(timer);
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

    const encDate = encodeURIComponent(date);

    // ✅ สร้างชุด URL ที่ “เป็นไปได้” ตาม proxy ที่คุณเคยใช้จริง
    const buildCandidates = (base) => {
      const b = base ? base.replace(/\/$/, "") : "";
      const prefix = b; // base อาจเป็น "" หรือ https://...workers.dev

      // ถ้า base เป็น same-origin (""), ก็จะกลายเป็น "/api/..."
      // ถ้า base เป็น PROXY, ก็จะกลายเป็น "https://.../api/..."
      return [
        `${prefix}/api/check?action=dateScan&date=${encDate}`,
        `${prefix}/api/exec?action=dateScan&date=${encDate}`,
        `${prefix}/api/exec?path=date-scan&date=${encDate}`,     // บางระบบใช้ path
        `${prefix}/exec?action=dateScan&date=${encDate}`,        // บาง proxy ใช้ /exec
        `${prefix}/exec?path=date-scan&date=${encDate}`,
        `${prefix}/?action=dateScan&date=${encDate}`,            // บาง proxy รับที่ root
        `${prefix}/?path=date-scan&date=${encDate}`,
      ].map((u) => u.replace(/^\/\//, "/")); // กันกรณี base="" แล้วได้ "//api"
    };

    let lastFail = null;

    try {
      // ✅ ลองทีละตัวจนกว่าจะเจอ ok:true
      for (const base of API_BASES) {
        const candidates = buildCandidates(base);

        for (const url of candidates) {
          const r = await fetchJson(url, 15000);

          if (r.ok && Array.isArray(r.json?.results)) {
            setResults(r.json.results);
            setErr("");
            return;
          }

          // เก็บไว้เป็น error ล่าสุด เพื่อแสดงถ้าลองหมดแล้วไม่เจอ
          lastFail = r;

          // ถ้าได้ JSON ok:false ก็ลองตัวถัดไปได้เลย
          // ถ้าเป็น 404 ก็ลองตัวถัดไป
        }
      }

      // ลองหมดแล้วไม่เจอ
      if (lastFail) {
        const apiErr =
          (lastFail.json && (lastFail.json.error || lastFail.json.message)) ||
          `HTTP ${lastFail.status}`;

        // โชว์ให้รู้ด้วยว่า “ล้มที่ URL ไหน”
        setErr(`${apiErr} @ ${lastFail.url}`);
      } else {
        setErr("ไม่สามารถเรียก API ได้");
      }
    } catch (e) {
      setErr(errText(e));
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
                    <div className="dc-rowhint">แถว #{rowNumber} ({sheetName})</div>
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
