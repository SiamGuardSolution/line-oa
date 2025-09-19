import React, { useState, useMemo, useEffect } from 'react';
import "./CheckPage.css";
import generateReceiptPDF from "./lib/generateReceiptPDF";
import { getPackageLabel, getPackagePrice } from "./config/packages";

/* ---------------------- CONFIG ---------------------- */
const HOST = window.location.hostname;
const PROXY = (process.env.REACT_APP_API_BASE || "https://siamguards-proxy.phet67249.workers.dev").replace(/\/$/, "");
const API_BASES = (HOST === "localhost" || HOST === "127.0.0.1") ? ["", PROXY] : [PROXY];

// localStorage: เบอร์ล่าสุด + auto-run
const LS_LAST_PHONE_KEY = "sg_lastPhone";
const AUTORUN_LAST = true;

/* ---------------------- HELPERS ---------------------- */
function buildCheckUrls(digits) {
  const v = Date.now();
  return API_BASES.map(base => `${base}/api/check-contract?phone=${encodeURIComponent(digits)}&v=${v}`);
}

/** Package helpers (key/label/price) */
// → คืนคีย์แพ็กเกจ "spray" | "bait" | "mix"
function derivePkgKey(c) {
  if (!c) return "spray";
  // 1) ถ้า API/ชีตส่งคีย์มา
  if (c.pkg && ["spray","bait","mix"].includes(String(c.pkg).toLowerCase())) {
    return String(c.pkg).toLowerCase();
  }
  // 2) เดิมเคยจับจากข้อความ label/ประเภท
  const raw = `${c?.package || ""}|${c?.packageLabel || ""}|${c?.servicePackage || ""}|${c?.servicePackageLabel || ""}|${c?.serviceType || ""}`
    .toLowerCase();
  if (/\bmix|ผสม|combo/.test(raw)) return "mix";
  if (/\bbait|เหยื่อ/.test(raw)) return "bait";
  if (/\bspray|ฉีด/.test(raw)) return "spray";

  // 3) สุดท้าย เผื่อระบบเก่าเคยฝังราคาไว้ในข้อความ
  const text = `${c?.priceText || ""}`.toLowerCase();
  if (/8500/.test(text)) return "mix";
  if (/5500/.test(text)) return "bait";
  return "spray";
}

const labelFromContract = (c) => getPackageLabel(derivePkgKey(c));

const priceTextFrom = (c) => {
  // ถ้า API มี text มาอยู่แล้วก็ใช้เลย
  if (c?.priceText) return String(c.priceText);
  // ไม่งั้นแปลงจาก config เป็นข้อความราคา
  const price = getPackagePrice(derivePkgKey(c)) ?? 0;
  return price ? `${Number(price).toLocaleString('th-TH')} บาท` : "-";
};

const toNumberSafe = (v) => {
  if (v == null) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v).replace(/\u00a0/g, ' ').replace(/[,\s]/g, '').replace(/[^\d.-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const firstNonEmpty = (...vals) => vals.find(v => v !== undefined && v !== null && String(v).trim() !== "");

const normKey = (s) => String(s || '').toLowerCase().replace(/\u00a0/g, ' ').replace(/\s+/g, '').replace(/[/|_.\-()]/g, '');

const pickByAliasesDeep = (obj, aliases) => {
  if (!obj || typeof obj !== 'object') return undefined;
  const want = new Set(aliases.map(normKey));
  const walk = (v) => {
    if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) {
        if (want.has(normKey(k))) return v[k];
        const hit = walk(v[k]);
        if (hit !== undefined) return hit;
      }
    }
    return undefined;
  };
  return walk(obj);
};

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const scanDiscountInStrings = (obj) => {
  const kws = ['ส่วนลด', 'discount'];
  let found = 0;
  const walk = (v) => {
    if (found) return;
    if (typeof v === 'string') {
      const s = v.replace(/\u00a0/g, ' ');
      for (const kw of kws) {
        const re = new RegExp(escapeRx(kw) + '\\s*[:=]?\\s*([\\d,.]+)', 'i');
        const m = s.match(re);
        if (m && m[1]) { found = toNumberSafe(m[1]); return; }
      }
    } else if (Array.isArray(v)) {
      for (const x of v) walk(x);
    } else if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) walk(v[k]);
    }
  };
  walk(obj);
  return found || 0;
};

// ราคา base จาก config เป็นหลัก (ถ้า API ส่ง priceText มาเป็นตัวเลข ก็รองรับ)
const basePriceFrom = (c) => {
  const fromText = toNumberSafe(priceTextFrom(c));
  if (fromText > 0) return fromText;
  return getPackagePrice(derivePkgKey(c)) ?? 0;
};

const discountFrom = (c) => {
  const aliases = [
    'ส่วนลด', 'ส่วนลด บาท', 'ส่วนลด(บาท)', 'ส่วนลด (บาท)', 'ส่วนลดบาท',
    'discount', 'discount baht', 'discount(baht)', 'discount (baht)', 'discountbaht'
  ];
  const direct =
    c?.discount ?? c?.discountBaht ??
    c?.['ส่วนลด'] ?? c?.['ส่วนลดบาท'] ?? c?.['ส่วนลด (บาท)'] ?? c?.['ส่วนลด(บาท)'] ??
    c?.['Discount(Baht)'] ?? c?.['discount (baht)'];
  if (direct != null && direct !== '') return toNumberSafe(direct);
  const deep = pickByAliasesDeep(c, aliases);
  if (deep != null && deep !== '') {
    const n = toNumberSafe(deep);
    if (n > 0) return n;
  }
  return scanDiscountInStrings(c);
};

const addonsFrom = (c) => {
  if (!c) return [];
  if (Array.isArray(c.addons)) return c.addons;
  const raw = firstNonEmpty(c?.['Add-ons JSON'], c?.addonsJson);
  try {
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
};

const addonsSubtotalFrom = (c) => {
  const direct = firstNonEmpty(c?.addonsSubtotal, c?.['ค่าบริการเพิ่มเติม']);
  const n = toNumberSafe(direct);
  if (n > 0) return n;
  const arr = addonsFrom(c);
  return arr.reduce((s, a) => s + toNumberSafe(a.qty) * toNumberSafe(a.price), 0);
};

const netTotalFrom = (c) => {
  const direct = firstNonEmpty(c?.netTotal, c?.['ราคาสุทธิ'], c?.netBeforeVat);
  const n = toNumberSafe(direct);
  if (n || direct === 0) return n;
  return Math.max(0, Math.round(basePriceFrom(c) - discountFrom(c) + addonsSubtotalFrom(c)));
};

const netAmountFrom = (c) => netTotalFrom(c);

const SHOW_PAY_LINK = true;

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
  const d = new Date(dateStr); if (isNaN(d)) return "";
  d.setDate(d.getDate() + days); return toYMD(d);
};
const addMonths = (dateStr, n) => {
  if (!dateStr) return "";
  const d = new Date(dateStr); if (isNaN(d)) return "";
  const day = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() < day) d.setDate(0);
  return toYMD(d);
};

/* -------- schedule helpers -------- */
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

/* ---------------------- COMPONENTS ---------------------- */
const NotesFlex = ({ payUrl }) => (
  <section className="notes-flex" aria-label="หมายเหตุการให้บริการ">
    <header className="notes-flex__header">หมายเหตุ</header>
    <ol className="notes-flex__list">
      <li><span className="badge">1</span><div>วันที่ครบกำหนด คือ วันที่ที่ครบกำหนดบริการตามเงื่อนไข เป็นเพียงกำหนดการนัดหมายส่งงานเท่านั้น</div></li>
      <li><span className="badge">2</span><div>วันที่เข้าบริการ คือ วันที่เข้ารับบริการจริง ซึ่งทางบริษัทฯ ได้ทำการนัดหมายลูกค้าอย่างชัดเจน</div></li>
      <li><span className="badge">3</span><div>ตารางครบกำหนดด้านล่าง ลูกค้าสามารถขอเปลี่ยนวันได้ด้วยตัวเองทาง Line Official Account หรือโทรนัดกับเจ้าหน้าที่ โดยปกติแล้วทางเราจะโทรนัดล่วงหน้าก่อนประมาณ 2–7 วัน</div></li>
      <li><span className="badge">4</span><div>หากเกิดความเสียหายจากการให้บริการ เช่น เจาะโดนท่อน้ำดี บริษัทฯ จะรับผิดชอบซ่อมแซมให้ลูกค้าสูงสุด <strong>5,000 บาท</strong></div></li>
      <li>
        <span className="badge">5</span>
        <div>
          ลูกค้าสามารถเลือกชำระค่าบริการได้ผ่าน 3 ช่องทาง
          <ol className="notes-flex__sublist">
            <li className="notes-row">
              <span>เงินสด/โอน ณ วันที่ให้บริการ</span>
              {payUrl && <a href={payUrl} target="_blank" rel="noopener noreferrer" className="link-pay">ไปหน้าชำระเงิน</a>}
            </li>
            <li>บัตรเครดิต รองรับการผ่อนชำระ 0% 6 เดือน <span className="muted">(service charge 3%)</span></li>
            <li>เครดิตจากบริษัท สามารถใช้บริการก่อนและชำระภายหลัง <span className="muted">(ไม่มีค่าธรรมเนียม)</span></li>
          </ol>
        </div>
      </li>
    </ol>
  </section>
);

/* ---------------------- MAIN ---------------------- */
export default function CheckPage() {
  const [phoneInput, setPhoneInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  // หลายสัญญา + index ที่เลือก
  const [contracts, setContracts] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);

  // contract ปัจจุบัน
  const contract = useMemo(
    () => (contracts && contracts.length ? (contracts[activeIdx] || null) : null),
    [contracts, activeIdx]
  );

  // โหลดเบอร์ล่าสุด
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_LAST_PHONE_KEY);
      if (saved) {
        setPhoneInput(saved);
        if (AUTORUN_LAST) void searchByDigits(saved);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- NEW: map services[] -> service1, service2,... (อ่านจากชีตก่อนเสมอ) ----
  const normalizeContractRecord = (c) => {
    if (!c) return c;
    const out = { ...c };

    const svc = Array.isArray(c.services) ? c.services : [];
    const getByIndex = (n) => svc[n - 1]?.date || "";

    const findByLabel = (n) => {
      const re = new RegExp(`(service\\s*รอบที่\\s*${n}|รอบที่\\s*${n}|ครั้งที่\\s*${n})`, 'i');
      const hit = svc.find(x => re.test(String(x?.label || "")));
      return hit?.date || "";
    };

    for (let i = 1; i <= 6; i++) {
      out[`service${i}`] = firstNonEmpty(findByLabel(i), getByIndex(i), out[`service${i}`]) || "";
    }
    return out;
  };

  // fetch helper
  const searchByDigits = async (digits) => {
    setError("");
    if (!digits || digits.length < 9) { setError("กรุณากรอกเบอร์โทรอย่างน้อย 9 หลัก"); return; }

    setLoading(true);
    setContracts([]);

    try {
      const urls = buildCheckUrls(digits);
      let data = null, lastErr = null;

      for (const url of urls) {
        try {
          const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
          const ct = res.headers.get("content-type") || "";
          if (!ct.includes("application/json")) throw new Error(`BAD_CONTENT_TYPE:${ct}`);
          const body = await res.json();
          if (!res.ok) throw new Error(`HTTP_${res.status}`);
          data = body; break;
        } catch (err) { console.warn("[CHECK] endpoint failed, fallback next →", err); lastErr = err; }
      }
      if (!data) throw lastErr || new Error("FETCH_FAILED");

      let list = [];
      if (Array.isArray(data.contracts) && data.contracts.length) list = data.contracts;
      else if (data.contract) list = [data.contract];

      list = list.map(normalizeContractRecord);

      if (list.length) { setContracts(list); setActiveIdx(0); }
      else { setContracts([]); setError("ไม่พบข้อมูลสัญญาตามเบอร์ที่ระบุ"); }
    } catch (err) {
      console.error("[CHECK] fetch failed:", err);
      setError("ดึงข้อมูลไม่สำเร็จ กรุณาลองใหม่");
    } finally { setLoading(false); }
  };

  const onSearch = async (e) => {
    e?.preventDefault?.();
    const digits = normalizePhone(phoneInput);
    try { localStorage.setItem(LS_LAST_PHONE_KEY, digits); } catch {}
    await searchByDigits(digits);
  };

  /** ===== กำหนดการ: ใช้ค่าจากชีตก่อน แล้วค่อย fallback ===== */
  const scheduleGroups = useMemo(() => {
    if (!contract) return [];
    const pkgKey = derivePkgKey(contract);
    const start  = contract.startDate || "";

    // ใช้วันที่จากชีตที่ normalize แล้วก่อน (service1/service2)
    const sprayS1 = firstNonEmpty(contract.service1) || (start ? addMonths(start, 4) : "");
    const sprayS2 = firstNonEmpty(contract.service2) || (sprayS1 ? addMonths(sprayS1, 4) : (start ? addMonths(start, 8) : ""));

    // bait จาก services[] ตามลำดับ/label
    const baitDates = (contract?.services || [])
      .filter(s => /(bait|เหยื่อ|ครั้งที่|รอบที่)/i.test(s.label || "") && s.date)
      .map(s => s.date);

    const end = contract.endDate || (start ? addMonths(start, 12) : "");

    if (pkgKey === "spray") {
      return [
        { title: "ฉีดพ่น (2 ครั้ง/ปี)", kind: "spray", items: makeSprayItems(start, sprayS1, sprayS2) },
        { title: "สิ้นสุดสัญญา",        kind: "end",   items: [{ kind: "end", label: "สิ้นสุดสัญญา (+1 ปี)", date: end, isEnd: true }] },
      ];
    }

    if (pkgKey === "bait") {
      const items = baitDates.length
        ? baitDates.map((d, i) => ({ kind: "bait", label: `ครั้งที่ ${i + 1}`, date: d }))
        : makeBaitItems(start, 5, 20);
      return [
        { title: "วางเหยื่อ (ทุก 20 วัน 5 ครั้ง)", kind: "bait", items },
        { title: "สิ้นสุดสัญญา",                    kind: "end",  items: [{ kind: "end", label: "สิ้นสุดสัญญา (+1 ปี)", date: end, isEnd: true }] },
      ];
    }

    // mix
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
    const assumedEnd = contract.endDate || (contract.startDate ? addMonths(contract.startDate, 12) : "");
    if (!assumedEnd) return null;
    const end = new Date(assumedEnd); if (isNaN(end)) return null;
    const today = new Date();
    const mid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return end < mid ? { text: "หมดอายุ", tone: "danger" } : { text: "ใช้งานอยู่", tone: "success" };
  }, [contract]);

  const contractRef = useMemo(() => {
    if (!contract) return "";
    const ref = firstNonEmpty(
      contract.number, contract.contractNumber, contract.ref,
      contract.quotationNumber, contract.invoiceNumber,
      contract.contract_no, contract.id, contract._id, contract.contractId
    );
    if (ref) return String(ref);
    const alt = [normalizePhone(contract.phone), contract.startDate].filter(Boolean).join("-");
    return alt || "";
  }, [contract]);

  const netAmount = useMemo(() => netAmountFrom(contract), [contract]);
  const payUrl = useMemo(() => {
    if (!contractRef) return "";
    const parts = [`/pay?ref=${encodeURIComponent(contractRef)}`];
    if (netAmount > 0) parts.push(`amt=${encodeURIComponent(netAmount.toFixed(2))}`);
    return parts.join("&");
  }, [contractRef, netAmount]);

  const discount = useMemo(() => discountFrom(contract), [contract]);
  const addonsSubtotal = useMemo(() => addonsSubtotalFrom(contract), [contract]);
  const addonsArr = useMemo(() => addonsFrom(contract), [contract]);
  const netTotal = useMemo(() => netTotalFrom(contract), [contract]);

  async function handleDownloadReceipt(current) {
    if (!current) return;
    setDownloading(true);
    try {
      const companyName   = process.env.REACT_APP_COMPANY_NAME   || "Siam Guard";
      const companyAddr   = process.env.REACT_APP_COMPANY_ADDR   || "สำนักงานใหญ่ แขวง/เขต กรุงเทพฯ";
      const companyPhone  = process.env.REACT_APP_COMPANY_PHONE  || "02-xxx-xxxx";
      const companyTaxId  = process.env.REACT_APP_COMPANY_TAXID  || "";

      const contractStartDate =
        current.startDate || current.startYMD || current.service1Date || current.firstServiceDate || current.beginDate || null;

      const basePrice = basePriceFrom(current);
      const addOns = addonsFrom(current);
      const items = [
        { description: labelFromContract(current), qty: 1, unitPrice: basePrice },
        ...addOns.map(a => ({ description: a.name || "บริการเพิ่มเติม", qty: toNumberSafe(a.qty) || 1, unitPrice: toNumberSafe(a.price) || 0 })),
      ];

      const receiptNo =
        firstNonEmpty(current.receiptNo, current.invoiceNumber, current.quotationNumber) ||
        `RN-${toYMD(new Date()).replace(/-/g, "")}-${String(normalizePhone(current.phone)).slice(-4).padStart(4,"0")}`;

      const payload = {
        companyName: companyName, companyAddress: companyAddr, companyPhone: companyPhone, companyTaxId: companyTaxId,
        clientName: current.name || current.customerName || current.clientName || "-",
        clientPhone: current.phone || current.clientPhone || "-",
        clientAddress: current.address || current.clientAddress || "-",
        clientTaxId: current.taxId || current.clientTaxId || "",
        receiptNo, issueDate: new Date(), contractStartDate,
        items, discount: discountFrom(current), vatRate: 0, alreadyPaid: toNumberSafe(current.deposit || current.alreadyPaid || 0),
      };

      const filename = `Receipt-${receiptNo}.pdf`;
      const blob = await generateReceiptPDF(payload, { returnType: "blob", filename });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } finally { setDownloading(false); }
  }

  /* ---------------------- RENDER ---------------------- */
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
          <button type="submit" disabled={loading}>{loading ? "กำลังค้นหา..." : "ค้นหา"}</button>
        </form>
        {error && <div className="alert">{error}</div>}
      </header>

      {loading && (
        <div className="card skeleton">
          <div className="s1" /><div className="s2" /><div className="s3" />
        </div>
      )}

      {contracts.map((c, i) => {
        const key = derivePkgKey(c);
        return (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            style={{
              border: "1px solid #e6eef7", borderRadius: 999, padding: "8px 12px",
              background: i === activeIdx ? "#e8f1ff" : "#fff", fontWeight: i === activeIdx ? 700 : 500,
              cursor: "pointer", marginRight: 8, marginBottom: 8,
            }}
            title={labelFromContract(c)}
          >
            {(c.startDate || "ไม่ทราบวันเริ่ม")} · {getPackageLabel(key)}
          </button>
        );
      })}

      {contract && (
        <>
          <section className="card">
            <div className="row between">
              <h2 className="title">สัญญาของคุณ</h2>
              {contractStatus && <span className={`badge ${contractStatus.tone}`}>{contractStatus.text}</span>}
            </div>

            <div className="grid two">
              <div className="field"><label>ชื่อลูกค้า</label><div className="value">{contract.name || "-"}</div></div>
              <div className="field stack"><label>เบอร์โทร</label><div className="value">{formatThaiPhone(normalizePhone(contract.phone))}</div></div>
              <div className="field"><label>แพ็กเกจ</label><div className="value">{labelFromContract(contract)}</div></div>
              <div className="field"><label>ประเภทบริการ</label><div className="value">{contract.serviceType || "กำจัดปลวก"}</div></div>
              <div className="field stack"><label>วันที่เริ่ม</label><div className="value">{contract.startDate || "-"}</div></div>
              <div className="field"><label>สิ้นสุดสัญญา</label><div className="value">{contract.endDate || (contract.startDate ? addMonths(contract.startDate, 12) : "-")}</div></div>

              {contract.address && (
                <div className="field span2"><label>ที่อยู่</label><div className="value">{contract.address}</div></div>
              )}

              <NotesFlex payUrl={SHOW_PAY_LINK ? payUrl : ""} />
            </div>
          </section>

          {/* สรุปค่าใช้จ่าย + ปุ่มรับใบเสร็จ */}
          <section className="card">
            <div className="row between">
              <h3 className="title">สรุปค่าใช้จ่าย</h3>
              <button
                onClick={() => handleDownloadReceipt(contract)}
                disabled={downloading}
                style={{ padding: "10px 14px", borderRadius: 10, border: "none", background: "#2a7de1", color: "#fff", fontWeight: 700, boxShadow: "0 2px 8px rgba(42,125,225,.25)", cursor: downloading ? "not-allowed" : "pointer" }}
                title="ดาวน์โหลดใบเสร็จ PDF"
              >
                {downloading ? "กำลังสร้าง..." : "รับใบเสร็จ (PDF)"}
              </button>
            </div>

            <div className="bill">
              <div className="bill__row"><div>ส่วนลด</div><div className="bill__val">-{Number(discount || 0).toLocaleString('th-TH')}</div></div>
              <div className="bill__row"><div>ค่าบริการเพิ่มเติม (Add-on)</div><div className="bill__val">+{Number(addonsSubtotal || 0).toLocaleString('th-TH')}</div></div>
              <hr className="bill__sep" />
              <div className="bill__row bill__row--total"><div>ราคาสุทธิ</div><div className="bill__val">{Number(netTotal || 0).toLocaleString('th-TH')}</div></div>
            </div>

            {addonsArr.length > 0 && (
              <>
                <h4 style={{ marginTop: 10 }}>รายละเอียด Add-on</h4>
                <div className="addons-table">
                  <div className="addons-row addons-row--head"><div>รายการ</div><div>จำนวน</div><div>ราคา/หน่วย</div><div>รวม</div></div>
                  {addonsArr.map((a, i) => {
                    const qty = toNumberSafe(a.qty); const price = toNumberSafe(a.price);
                    return (
                      <div className="addons-row" key={i}>
                        <div>{a.name || '-'}</div>
                        <div>{qty}</div>
                        <div>{Number(price).toLocaleString('th-TH')}</div>
                        <div>{Number(qty * price).toLocaleString('th-TH')}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          <section className="card">
            <div className="row between">
              <h3 className="title">กำหนดการ</h3>
              <span className="pill">
                {(() => {
                  const k = derivePkgKey(contract);
                  if (k === "bait") return "วางเหยื่อ: ทุก 20 วัน (5 ครั้ง)";
                  if (k === "spray") return "ฉีดพ่น: 2 ครั้ง / ปี";
                  return "ผสมผสาน: เหยื่อ 5 ครั้ง + ฉีดพ่น 2 ครั้ง";
                })()}
              </span>
            </div>

            {scheduleGroups.map((group, gi) => (
              <div className="timeline-group" key={gi}>
                <div className="group-title"><span className={`chip ${group.kind}`}>{group.title}</span></div>
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

      <footer className="foot-hint">กรณีไม่พบข้อมูล ลองตรวจสอบจำนวนหลักของเบอร์โทรอีกครั้ง</footer>
    </div>
  );
}
