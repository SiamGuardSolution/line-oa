// CheckPage.jsx
import React, { useMemo, useState } from "react";
import "./CheckPage.css";

const API_BASE =
  process.env.REACT_APP_API_BASE ||
  "https://siamguards-proxy.phet67249.workers.dev";
const api = (p) => `${API_BASE ? API_BASE : ""}${p}`;

// ===== Helpers =====
const pkgLabel = (val) => {
  const v = String(val || "").toLowerCase();
  if (v.includes("8500") || v.includes("ผสม") || v.includes("mix") || v.includes("combo")) {
    return "ผสมผสาน 8,500 บาท/ปี";
  }
  if (v.includes("5500") || v.includes("เหยื่อ") || v.includes("bait")) {
    return "วางเหยื่อ 5,500 บาท";
  }
  return "อัดน้ำยา+ฉีดพ่น 3,993 บาท/ปี";
};

function derivePkg(c) {
  const raw = `${c?.servicePackage || ""}|${c?.servicePackageLabel || ""}|${c?.serviceType || ""}`
    .toLowerCase()
    .replace(/[,\s]/g, "");
  if (raw.includes("8500") || raw.includes("ผสม") || raw.includes("mix") || raw.includes("combo")) {
    return "8500"; // mix
  }
  if (raw.includes("เหยื่อ") || raw.includes("bait") || raw.includes("5500")) {
    return "5500"; // bait
  }
  return "3993";   // spray
}

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
const isValidDateStr = (s) => !!s && !isNaN(new Date(s));

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
      const res = await fetch(url, {
        headers: { Accept: "application/json", "Cache-Control": "no-store" },
      });
      const ct = res.headers.get("content-type") || "";

      let data;
      if (ct.includes("application/json")) {
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

  // กำหนดการตามแพ็กเกจ (รองรับ 3993 / 5500 / 8500)
  const schedule = useMemo(() => {
    if (!contract) return [];
    const pkg = derivePkg(contract);
    const start = isValidDateStr(contract.startDate) ? contract.startDate : "";
    const last  = isValidDateStr(contract.lastServiceDate) ? contract.lastServiceDate : "";

    // spray
    const makeSpray = () => {
      const s1 = contract.serviceDate1 || (start ? addMonths(start, 4) : "");
      const s2 = contract.serviceDate2 || (s1 ? addMonths(s1, 4) : "");
      const items = [];
      if (s1) items.push({ label: "Service ครั้งที่ 1 (+4 เดือน)", date: s1 });
      if (s2) items.push({ label: "Service ครั้งที่ 2 (+4 เดือนจากครั้งที่ 1)", date: s2 });
      return items;
    };

    // bait (ทุก 20 วัน × 6, end +120 วัน (ยึด start ถ้ามี ไม่งั้น base))
    const makeBait = () => {
      const base = last || start;
      if (!base) return [];
      const slots = Array.from({ length: 6 }).map((_, i) => ({
        label: `Service ครั้งที่ ${i + 1}`,
        date: addDays(base, 20 * (i + 1)),
      }));
      const end = addDays(start || base, 120);
      return [...slots, { label: "สิ้นสุดสัญญา (+120 วัน)", date: end, isEnd: true }];
    };

    if (pkg === "3993") {
      const items = makeSpray();
      const end = start ? addMonths(start, 12) : "";
      return end ? [...items, { label: "สิ้นสุดสัญญา (+1 ปี)", date: end, isEnd: true }] : items;
    }

    if (pkg === "5500") {
      return makeBait();
    }

    // 8500 (mix): รวม bait(20×6) + spray(2 ครั้ง), สิ้นสุด +1 ปี
    const mixSpray = makeSpray();
    const mixBait  = makeBait().filter(x => !x.isEnd); // ไม่เอา end +120 วันใน mix
    const merged   = [...mixBait, ...mixSpray].sort((a,b)=> new Date(a.date) - new Date(b.date));
    const endYear  = start ? addMonths(start, 12) : "";
    return endYear ? [...merged, { label: "สิ้นสุดสัญญา (+1 ปี)", date: endYear, isEnd: true }] : merged;
  }, [contract]);

  // สถานะสัญญา (ตามกติกาแต่ละแพ็กเกจ)
  const status = useMemo(() => {
    if (!contract) return null;
    const pkg = derivePkg(contract);
    let assumedEnd = "";

    if (pkg === "5500") {
      const base = isValidDateStr(contract.startDate) ? contract.startDate : contract.lastServiceDate;
      if (base) assumedEnd = addDays(base, 120);
    } else {
      // 3993 และ 8500 = สิ้นสุด +1 ปี (ใช้ start หรือ end เดิม)
      assumedEnd = contract.endDate || (isValidDateStr(contract.startDate) ? addMonths(contract.startDate, 12) : "");
    }
    if (!assumedEnd) return null;

    const end = new Date(assumedEnd);
    if (isNaN(end)) return null;
    const today = new Date();
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return end < todayMid ? { text: "หมดอายุ", tone: "danger" } : { text: "ใช้งานอยู่", tone: "success" };
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

      {loading && (
        <div className="card skeleton">
          <div className="s1" />
          <div className="s2" />
          <div className="s3" />
        </div>
      )}

      {contracts.length > 1 && !loading && (
        <div className="card" style={{ padding: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {contracts.map((c, i) => {
              const p = derivePkg(c);
              return (
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
                  title={c.servicePackageLabel || pkgLabel(p)}
                >
                  {(c.startDate || "ไม่ทราบวันเริ่ม")} · {
                    p === "5500" ? "เหยื่อ" : p === "8500" ? "ผสมผสาน" : "ฉีดพ่น"
                  }
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
            พบ {contracts.length} สัญญา — กดเพื่อสลับดูรายละเอียด
          </div>
        </div>
      )}

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
                <div className="value">
                  {contract.servicePackageLabel || pkgLabel(derivePkg(contract))}
                </div>
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
                <div className="value">
                  {(() => {
                    const p = derivePkg(contract);
                    if (p === "5500") {
                      const base = contract.startDate || contract.lastServiceDate;
                      return base ? addDays(base, 120) : "-";
                    }
                    // 3993 / 8500
                    return contract.endDate || (contract.startDate ? addMonths(contract.startDate, 12) : "-");
                  })()}
                </div>
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
                {(() => {
                  const p = derivePkg(contract);
                  if (p === "5500") return "ทุก 20 วัน (6 ครั้ง)";
                  if (p === "8500") return "ผสมผสาน: เหยื่อทุก 20 วัน + ฉีดพ่น 2 ครั้ง";
                  return "2 ครั้ง / ปี";
                })()}
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
