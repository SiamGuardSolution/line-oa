import React, { useMemo, useState } from "react";
import "./CheckPage.css";

// สีและชื่อแพ็กเกจ
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
  const [contract, setContract] = useState(null);
  const [error, setError] = useState("");

  // ดึงข้อมูลสัญญาตามเบอร์
  const onSearch = async (e) => {
    e?.preventDefault?.();
    setError("");
    const digits = normalizePhone(phoneInput);
    if (!digits || digits.length < 9) {
      setError("กรุณากรอกเบอร์โทรอย่างน้อย 9 หลัก");
      return;
    }
    setLoading(true);
    setContract(null);
    try {
      // ปรับ endpoint ให้ตรงโปรเจกต์ของคุณ
      const res = await fetch(`/api/check-contract?phone=${digits}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || !data.contract) {
        setError("ไม่พบข้อมูลสัญญาตามเบอร์ที่ระบุ");
      } else {
        setContract(data.contract);
      }
    } catch (err) {
      console.error(err);
      setError("ดึงข้อมูลไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  // เตรียมชุด “กำหนดการ” ตามแพ็กเกจ (แสดงเฉพาะของแพ็กเกจนั้น)
  const schedule = useMemo(() => {
    if (!contract) return [];
    const pkg = contract.servicePackage; // 'spray' | 'bait'
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
    // bait: 6 นัดภายใน 3 เดือน (ทุก 15 วันจากวันล่าสุด/วันที่เริ่ม)
    const base = contract.lastServiceDate || start;
    const slots = Array.from({ length: 6 }).map((_, i) => ({
      label: `รอบบริการครั้งที่ ${i + 1}`,
      date: addDays(base, 15 * (i + 1)),
    }));
    const end = contract.endDate || addMonths(start, 3);
    return [...slots, { label: "สิ้นสุดสัญญา (3 เดือน)", date: end, isEnd: true }];
  }, [contract]);

  // สถานะ: หมดอายุหรือยัง
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

      {/* สเกเลตันโหลด */}
      {loading && (
        <div className="card skeleton">
          <div className="s1" />
          <div className="s2" />
          <div className="s3" />
        </div>
      )}

      {/* ผลลัพธ์ */}
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

          {/* กำหนดการ (แสดงเฉพาะของแพ็กเกจที่เลือก) */}
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
        {/* เคล็ดลับเล็กน้อยสำหรับผู้ใช้ */}
        กรณีไม่พบข้อมูล ลองตรวจสอบจำนวนหลักของเบอร์โทรอีกครั้ง
      </footer>
    </div>
  );
}
