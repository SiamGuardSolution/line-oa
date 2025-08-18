import React, { useMemo, useState } from "react";
import "./CheckPage.css";

const API_BASE =
  process.env.REACT_APP_API_BASE ||
  "https://siamguards-proxy.phet67249.workers.dev"; // ← ใส่ของคุณ
const api = (p) => `${API_BASE ? API_BASE : ""}${p}`;

const pkgLabel = (val) =>
  val === "bait" ? "วางเหยื่อ 5,500 บาท" : "อัดน้ำยา+ฉีดพ่น 3,993 บาท/ปี";

const normalizePhone = (val) => (val || "").replace(/\D/g, "").slice(0, 10);
const formatThaiPhone = (digits) => {
  if (!digits) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const toYMD = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
const addDays = (dateStr, days) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  d.setDate(d.getDate() + days);
  return toYMD(d);
};
const addMonths = (dateStr, n) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  const day = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() < day) d.setDate(0);
  return toYMD(d);
};

export default function CheckPage() {
  const [phoneInput, setPhoneInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // หลายสัญญา + index ที่เลือก
  const [contracts, setContracts] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);

  // ใช้ค่าที่เลือกมาเป็น "contract ปัจจุบัน"
  const contract = useMemo(
    () => (contracts && contracts.length ? contracts[activeIdx] || null : null),
    [contracts, activeIdx]
  );

  // ค้นหาจากเบอร์
  const onSearch = async (e) => {
    e?.preventDefault?.();
    setError("");
    const digits = normalizePhone(phoneInput);
    if (!digits || digits.length < 9) {
      setError("กรุณากรอกเบอร์โทรอย่างน้อย 9 หลัก");
      return;
    }
    setLoading(true);
    setContracts([]); // เคลียร์ผลก่อนหน้า

    try {
      const url = api(`/api/check-contract?phone=${encodeURIComponent(digits)}&v=${Date.now()}`);
      console.log("[CHECK] url:", url);

      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const ct = res.headers.get("content-type") || "";

      let data;
      if (ct.includes("application/json")) {
        // ปลอดภัยสุด: ให้ browser parse JSON ให้เลย
        data = await res.json();
      } else {
        const raw = await res.text();
        console.error("[CHECK] Non-JSON response", res.status, ct, raw.slice(0, 400));
        setError("เซิร์ฟเวอร์ตอบกลับไม่ใช่ JSON กรุณาลองใหม่");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        console.error("[CHECK] HTTP error", res.status, data);
        setError("ดึงข้อมูลไม่สำเร็จ กรุณาลองใหม่");
        setLoading(false);
        return;
      }

      if (Array.isArray(data.contracts) && data.contracts.length) {
        setContracts(data.contracts);
        setActiveIdx(0);
      } else if (data.contract) {
        setContracts([data.contract]);
        setActiveIdx(0);
      } else {
        setContracts([]);
        setError("ไม่พบข้อมูลสัญญาตามเบอร์ที่ระบุ");
      }
    } catch (err) {
      console.error("[CHECK] fetch failed:", err);
      setError("ดึงข้อมูลไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  // สร้างกำหนดการตามแพ็กเกจของ "contract ปัจจุบัน"
  const schedule = useMemo(() => {
    if (!contract) return [];
    const pkg = contract.servicePackage;
    const start = contract.startDate;
    if (pkg === "spray") {
      const s1 = contract.serviceDate1 || addMonths(start, 4);
      const s2 = contract.serviceDate2 || addMonths(s1, 4);
      const end = contract.endDate || addMonths(start, 12);
      return [
        { label: "รอบบริการครั้งที่ 1 (+4 เดือน)", date: s1 },
        { label: "รอบบริการครั้งที่ 2 (+4 เดือนจากครั้งที่ 1)", date: s2 },
        { label: "สิ้นสุดสัญญา (+1 ปี)", date: end, isEnd: true },
      ];
    }
    const base = contract.lastServiceDate || start;
    const slots = Array.from({ length: 6 }).map((_, i) => ({
      label: `รอบบริการครั้งที่ ${i + 1}`,
      date: addDays(base, 15 * (i + 1)),
    }));
    const end = contract.endDate || addMonths(start, 3);
    return [...slots, { label: "สิ้นสุดสัญญา (3 เดือน)", date: end, isEnd: true }];
  }, [contract]);

  // สถานะสัญญา
  const status = useMemo(() => {
    if (!contract?.endDate) return null;
    const today = new Date();
    const end = new Date(contract.endDate);
    if (isNaN(end)) return null;
    if (end < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      return { text: "หมดอายุ", tone: "danger" };
    }
    return { text: "ใช้งานอยู่", tone: "success" };
  }, [contract]);

  return (
    <div className="check-container">
      <header className="top">
        <h1>ตรวจสอบสัญญา</h1>
        <p className="subtitle">กรอกเบอร์โทรลูกค้าเพื่อดูสถานะและรอบบริการ</p>
        <form className="searchbar" onSubmit={onSearch}>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="0xx-xxx-xxxx"
            value={formatThaiPhone(normalizePhone(phoneInput))}
            onChange={(e) => setPhoneInput(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? "กำลังค้นหา..." : "ค้นหา"}
          </button>
        </form>
        {error && <div className="alert">{error}</div>}
      </header>

      {/* Loading skeleton */}
      {loading && (
        <div className="card skeleton">
          <div className="s1" />
          <div className="s2" />
          <div className="s3" />
        </div>
      )}

      {/* ตัวเลือกสัญญา (กรณีมีหลายรายการ) */}
      {contracts.length > 1 && !loading && (
        <div className="card" style={{ padding: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {contracts.map((c, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                style={{
                  border: "1px solid #e6eef7",
                  borderRadius: 999,
                  padding: "8px 12px",
                  background: i === activeIdx ? "#e8f1ff" : "#fff",
                  fontWeight: i === activeIdx ? 700 : 500,
                  cursor: "pointer",
                }}
                title={c.servicePackageLabel || c.servicePackage}
              >
                {(c.startDate || "ไม่ทราบวันเริ่ม")} · {c.servicePackage === "bait" ? "วางเหยื่อ" : "ฉีดพ่น"}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
            พบ {contracts.length} สัญญา — กดเพื่อสลับดูรายละเอียด
          </div>
        </div>
      )}

      {/* ผลลัพธ์ของสัญญาที่เลือก */}
      {contract && (
        <>
          <section className="card">
            <div className="row between">
              <h2 className="title">สัญญาของคุณ</h2>
              {status && <span className={`badge ${status.tone}`}>{status.text}</span>}
            </div>

            <div className="grid two">
              <div className="field">
                <label>ชื่อลูกค้า</label>
                <div className="value">{contract.name || "-"}</div>
              </div>
              <div className="field">
                <label>เบอร์โทร</label>
                <div className="value">{formatThaiPhone(normalizePhone(contract.phone))}</div>
              </div>

              <div className="field">
                <label>แพ็กเกจ</label>
                <div className="value">{pkgLabel(contract.servicePackage)}</div>
              </div>
              <div className="field">
                <label>ประเภทบริการ</label>
                <div className="value">{contract.serviceType || "-"}</div>
              </div>

              <div className="field">
                <label>วันที่เริ่ม</label>
                <div className="value">{contract.startDate || "-"}</div>
              </div>
              <div className="field">
                <label>สิ้นสุดสัญญา</label>
                <div className="value">{contract.endDate || "-"}</div>
              </div>

              {contract.address && (
                <div className="field span2">
                  <label>ที่อยู่</label>
                  <div className="value">{contract.address}</div>
                </div>
              )}

              {contract.note && (
                <div className="field span2">
                  <label>หมายเหตุ</label>
                  <div className="value">{contract.note}</div>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="row between">
              <h3 className="title">กำหนดการ</h3>
              <span className="pill">
                {contract.servicePackage === "bait" ? "ทุก 15 วัน (6 ครั้ง)" : "2 ครั้ง / ปี"}
              </span>
            </div>

            <ol className="timeline">
              {schedule.map((item, idx) => (
                <li key={idx} className={item.isEnd ? "end" : ""}>
                  <div className="dot" />
                  <div className="meta">
                    <div className="label">{item.label}</div>
                    <div className="date">{item.date || "-"}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      <footer className="foot-hint">
        กรณีไม่พบข้อมูล ลองตรวจสอบจำนวนหลักของเบอร์โทรอีกครั้ง
      </footer>
    </div>
  );
}
