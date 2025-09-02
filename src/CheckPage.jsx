import React, { useState, useMemo } from 'react';
import "./CheckPage.css";

/** ==== API endpoints (ลอง same-origin ก่อน ถ้าไม่สำเร็จค่อย fallback ไป workers.dev) ==== */
const API_BASES = [
  "", // same-origin → /api/*
  (process.env.REACT_APP_API_BASE || "https://siamguards-proxy.phet67249.workers.dev").replace(/\/$/, "")
];

function buildCheckUrls(digits) {
  const v = Date.now();
  return API_BASES.map(
    base => `${base}/api/check-contract?phone=${encodeURIComponent(digits)}&v=${v}`
  );
}

/** ==== Package helpers (label/price) ==== */
function derivePkg(c) {
  if (!c) return "3993";
  // ค่าแบบใหม่จาก API
  if (c.pkg) {
    if (c.pkg === "mix")  return "8500";
    if (c.pkg === "bait") return "5500";
    return "3993";
  }
  // fallback: API เก่า
  const raw = `${c?.servicePackage || ""}|${c?.servicePackageLabel || ""}|${c?.serviceType || ""}`
    .toLowerCase().replace(/[,\s]/g, "");
  if (raw.includes("8500") || raw.includes("ผสม") || raw.includes("mix") || raw.includes("combo")) return "8500";
  if (raw.includes("เหยื่อ") || raw.includes("bait") || raw.includes("5500")) return "5500";
  return "3993";
}

const labelFromContract = (c) => {
  const code = derivePkg(c);
  return c?.packageLabel ||
    (code === "8500" ? "ผสมผสาน 8,500 บาท/ปี"
      : code === "5500" ? "วางเหยื่อ 5,500 บาท"
      : "อัดน้ำยา+ฉีดพ่น 3,993 บาท/ปี");
};

const priceTextFrom = (c) => {
  if (!c) return "-";
  if (c.priceText) return c.priceText; // จาก API ถ้ามี
  const code = derivePkg(c);
  if (code === "8500") return "8,500 บาท/ปี";
  if (code === "5500") return "5,500 บาท";
  return "3,993 บาท/ปี";
};

/** ==== utils ==== */
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

/** --- schedule helpers --- */
const makeBaitItems = (base, count = 5, stepDays = 20) =>
  Array.from({ length: count }).map((_, i) => ({
    kind: "bait",
    label: `ครั้งที่ ${i + 1}`,
    date: addDays(base, stepDays * (i + 1)),
  }));

const makeSprayItems = (start, s1, s2) => [
  { kind: "spray", label: "ครั้งที่ 1 (+4 เดือน)", date: s1 },
  { kind: "spray", label: "ครั้งที่ 2 (+4 เดือนจากครั้งที่ 1)", date: s2 },
];

/** --- Notes (หมายเหตุ) --- */
const NotesFlex = () => (
  <section className="notes-flex" aria-label="หมายเหตุการให้บริการ">
    <header className="notes-flex__header">หมายเหตุ</header>
    <ol className="notes-flex__list">
      <li>
        <span className="badge">1</span>
        <div>
          วันที่ครบกำหนด คือ วันที่ที่ครบกำหนดบริการตามเงื่อนไข
          เป็นเพียงกำหนดการนัดหมายส่งงานเท่านั้น
        </div>
      </li>
      <li>
        <span className="badge">2</span>
        <div>
          วันที่เข้าบริการ คือ วันที่เข้ารับบริการจริง
          ซึ่งทางบริษัทฯ ได้ทำการนัดหมายลูกค้าอย่างชัดเจน
        </div>
      </li>
      <li>
        <span className="badge">3</span>
        <div>
          ตารางครบกำหนดด้านล่าง ลูกค้าสามารถขอเปลี่ยนวันได้ด้วยตัวเองทาง
          Line Official Account หรือโทรนัดกับเจ้าหน้าที่
          โดยปกติแล้วทางเราจะโทรนัดล่วงหน้าก่อนประมาณ 2–7 วัน
        </div>
      </li>
      <li>
        <span className="badge">4</span>
        <div>
          หากเกิดความเสียหายจากการให้บริการ เช่น เจาะโดนท่อน้ำดี
          บริษัทฯ จะรับผิดชอบซ่อมแซมให้ลูกค้าสูงสุด <strong>5,000 บาท</strong>
          โดยสามารถหักจากค่าบริการที่ลูกค้าต้องชำระได้เลย
          และบริษัทฯ จะจ่ายในส่วนที่เหลือ
        </div>
      </li>
      <li>
        <span className="badge">5</span>
        <div>
          ลูกค้าสามารถเลือกชำระค่าบริการได้ผ่าน 3 ช่องทาง ดังนี้
          <ol className="notes-flex__sublist">
            <li>เงินสด/โอน ณ วันที่ให้บริการ</li>
            <li>
              บัตรเครดิต รองรับการผ่อนชำระ 0% 6 เดือน
              <span className="muted"> (service charge 3%)</span>
            </li>
            <li>
              เครดิตจากบริษัท สามารถใช้บริการก่อนและชำระภายหลัง
              <span className="muted"> (ไม่มีค่าธรรมเนียม)</span>
            </li>
          </ol>
        </div>
      </li>
    </ol>
  </section>
);

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

  /** ค้นหาจากเบอร์ */
  const onSearch = async (e) => {
    e?.preventDefault?.();
    setError("");
    const digits = normalizePhone(phoneInput);
    if (!digits || digits.length < 9) {
      setError("กรุณากรอกเบอร์โทรอย่างน้อย 9 หลัก");
      return;
    }

    setLoading(true);
    setContracts([]);

    try {
      const urls = buildCheckUrls(digits);
      let data = null, lastErr = null;

      for (const url of urls) {
        try {
          const res = await fetch(url, {
            cache: "no-store",
            headers: { Accept: "application/json" },
          });

          const ct = res.headers.get("content-type") || "";
          if (!ct.includes("application/json")) throw new Error(`BAD_CONTENT_TYPE:${ct}`);

          const body = await res.json();
          if (!res.ok) throw new Error(`HTTP_${res.status}`);

          data = body; // สำเร็จ ออกจากลูป
          break;
        } catch (err) {
          console.warn("[CHECK] endpoint failed, fallback next →", err);
          lastErr = err;
        }
      }

      if (!data) throw lastErr || new Error("FETCH_FAILED");

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

  /** ===== กำหนดการตามแพ็กเกจ ===== */
  const scheduleGroups = useMemo(() => {
    if (!contract) return [];
    const pkg   = derivePkg(contract);
    const start = contract.startDate || "";

    // ดึงวันจาก services ถ้ามี (รองรับไทย/อังกฤษ)
    const findServiceDate = (regex) => {
      const arr = contract?.services || [];
      const hit = arr.find(s => regex.test((s.label || "").toLowerCase()));
      return hit?.date || "";
    };

    const sprayS1 = findServiceDate(/spray.*รอบที่\s*1|^service\s*รอบที่\s*1/i)
                || (start ? addMonths(start, 4) : "");
    const sprayS2 = findServiceDate(/spray.*รอบที่\s*2|^service\s*รอบที่\s*2/i)
                || (sprayS1 ? addMonths(sprayS1, 4) : (start ? addMonths(start, 8) : ""));

    const baitDates = (contract?.services || [])
      .filter(s => /(bait|เหยื่อ)/i.test(s.label || "") && s.date)
      .map(s => s.date);

    // วันสิ้นสุด: ใช้ endDate ก่อน ถ้าไม่มีให้ +1 ปี (ทุกแพ็กเกจ)
    const end = contract.endDate || (start ? addMonths(start, 12) : "");

    if (pkg === "3993") { // Spray
      return [
        { title: "ฉีดพ่น (2 ครั้ง/ปี)", kind: "spray", items: makeSprayItems(start, sprayS1, sprayS2) },
        { title: "สิ้นสุดสัญญา",        kind: "end",   items: [{ kind: "end", label: "สิ้นสุดสัญญา (+1 ปี)", date: end, isEnd: true }] },
      ];
    }

    if (pkg === "5500") { // Bait (5 ครั้ง)
      const items = baitDates.length
        ? baitDates.map((d, i) => ({ kind: "bait", label: `ครั้งที่ ${i + 1}`, date: d }))
        : makeBaitItems(start, 5, 20);
      return [
        { title: "วางเหยื่อ (ทุก 20 วัน 5 ครั้ง)", kind: "bait", items },
        { title: "สิ้นสุดสัญญา",                    kind: "end",  items: [{ kind: "end", label: "สิ้นสุดสัญญา (+1 ปี)", date: end, isEnd: true }] },
      ];
    }

    // Mix = Bait 5 ครั้ง + Spray 2 ครั้ง
    const baitItems = baitDates.length
      ? baitDates.map((d, i) => ({ kind: "bait", label: `ครั้งที่ ${i + 1}`, date: d }))
      : makeBaitItems(start, 5, 20);

    return [
      { title: "วางเหยื่อ (ทุก 20 วัน 5 ครั้ง)", kind: "bait",  items: baitItems },
      { title: "ฉีดพ่น (2 ครั้ง/ปี)",            kind: "spray", items: makeSprayItems(start, sprayS1, sprayS2) },
      { title: "สิ้นสุดสัญญา",                  kind: "end",   items: [{ kind: "end", label: "สิ้นสุดสัญญา (+1 ปี)", date: end, isEnd: true }] },
    ];
  }, [contract]);

  const contractStatus = useMemo(() => {
    if (!contract) return null;
    const assumedEnd =
      contract.endDate || (contract.startDate ? addMonths(contract.startDate, 12) : "");
    if (!assumedEnd) return null;

    const end = new Date(assumedEnd);
    if (isNaN(end)) return null;

    const today = new Date();
    const mid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return end < mid ? { text: "หมดอายุ", tone: "danger" } : { text: "ใช้งานอยู่", tone: "success" };
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

      {contracts.map((c, i) => {
        const p = derivePkg(c); // ใช้จริง
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
              marginRight: 8,
              marginBottom: 8,
            }}
            title={labelFromContract(c)}
          >
            {(c.startDate || "ไม่ทราบวันเริ่ม")} · {p === "5500" ? "เหยื่อ" : p === "8500" ? "ผสมผสาน" : "ฉีดพ่น"}
          </button>
        );
      })}

      {contract && (
        <>
          <section className="card">
            <div className="row between">
              <h2 className="title">สัญญาของคุณ</h2>
              {contractStatus && (
                <span className={`badge ${contractStatus.tone}`}>{contractStatus.text}</span>
              )}
            </div>

            <div className="grid two">
              <div className="field">
                <label>ชื่อลูกค้า</label>
                <div className="value">{contract.name || "-"}</div>
              </div>
              <div className="field stack">
                <label>เบอร์โทร</label>
                <div className="value">{formatThaiPhone(normalizePhone(contract.phone))}</div>
              </div>
              <div className="field">
                <label>แพ็กเกจ</label>
                <div className="value">{labelFromContract(contract)}</div>
              </div>
              <div className="field stack">
                <label>ราคาแพ็กเกจ</label>
                <div className="value">{priceTextFrom(contract)}</div>
              </div>
              <div className="field">
                <label>ประเภทบริการ</label>
                <div className="value">{contract.serviceType || "กำจัดปลวก"}</div>
              </div>
              <div className="field stack">
                <label>วันที่เริ่ม</label>
                <div className="value">{contract.startDate || "-"}</div>
              </div>
              <div className="field">
                <label>สิ้นสุดสัญญา</label>
                <div className="value">
                  {contract.endDate || (contract.startDate ? addMonths(contract.startDate, 12) : "-")}
                </div>
              </div>

              {contract.address && (
                <div className="field span2">
                  <label>ที่อยู่</label>
                  <div className="value">{contract.address}</div>
                </div>
              )}

              <NotesFlex />
            </div>
          </section>

          <section className="card">
            <div className="row between">
              <h3 className="title">กำหนดการ</h3>
              <span className="pill">
                {(() => {
                  const pkg = derivePkg(contract);
                  if (pkg === "5500") return "วางเหยื่อ: ทุก 20 วัน (5 ครั้ง)";
                  if (pkg === "3993") return "ฉีดพ่น: 2 ครั้ง / ปี";
                  return "ผสมผสาน: เหยื่อ 5 ครั้ง + ฉีดพ่น 2 ครั้ง";
                })()}
              </span>
            </div>

            {scheduleGroups.map((group, gi) => (
              <div className="timeline-group" key={gi}>
                <div className="group-title">
                  <span className={`chip ${group.kind}`}>{group.title}</span>
                </div>

                <ol className="timeline">
                  {group.items.map((item, idx) => (
                    <li key={idx} className={item.isEnd ? "end" : ""}>
                      <div className={`dot ${item.kind}`} />
                      <div className="meta">
                        <div className="label">{item.label}</div>
                        <div className="date">{item.date || "-"}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </section>
        </>
      )}

      <footer className="foot-hint">
        กรณีไม่พบข้อมูล ลองตรวจสอบจำนวนหลักของเบอร์โทรอีกครั้ง
      </footer>
    </div>
  );
}
