import React, { useState, useMemo, useEffect } from 'react';
import "./CheckPage.css";
import generateReceiptPDF from "./lib/generateReceiptPDF";
import * as PKG from "./config/packages";

/* ---------------------- CONFIG ---------------------- */
const FORCE_ADMIN_MODE = true;
const HOST = window.location.hostname;
const PROXY = (process.env.REACT_APP_API_BASE || "https://siamguards-proxy.phet67249.workers.dev").replace(/\/$/, "");
const API_BASES = (HOST === "localhost" || HOST === "127.0.0.1") ? ["", PROXY] : [PROXY];

// localStorage: เบอร์ล่าสุด + auto-run
const LS_LAST_PHONE_KEY = "sg_lastPhone";
const AUTORUN_LAST = true;

// ลิงก์ชำระเงินแบบ fix ต่อแพ็กเกจ
const PAY_LINK_3993 = process.env.REACT_APP_PAY_LINK_3993 || "https://pay.beamcheckout.com/siamguard/74p9WPUCmO";
const PAY_LINK_5500 = process.env.REACT_APP_PAY_LINK_5500 || "https://pay.beamcheckout.com/siamguard/oBND7tFiJN";
const PAY_LINK_8500 = process.env.REACT_APP_PAY_LINK_8500 || "https://pay.beamcheckout.com/siamguard/NgGR8y4meS";
// ลิงก์ติดต่อแอดมินไลน์
const LINE_ADMIN_URL = process.env.REACT_APP_LINE_ADMIN_URL || "https://lin.ee/7K4hHjf";

/* ---------------------- LIFF helpers (บนสุดของไฟล์ นอกคอมโพเนนต์) ---------------------- */
const LIFF_ID = process.env.REACT_APP_LIFF_ID || ""; // ตั้งค่าใน .env (REACT_APP_LIFF_ID)

const hasLiff = () => typeof window !== "undefined" && !!window.liff;

const ensureLiffReady = async () => {
  if (!hasLiff() || !LIFF_ID) return false;
  const liff = window.liff;
  // ป้องกัน init ซ้ำ
  if (!liff._sgInited) {
    try { await liff.init({ liffId: LIFF_ID }); } catch (e) { /* ignore */ }
    liff._sgInited = true;
  }
  try { await liff.ready; } catch (e) { /* ignore */ }
  return true;
};

// ===== Upload API (ใช้ Worker R2) =====
const UPLOAD_API =
  process.env.REACT_APP_UPLOAD_API ||
  "https://siamguard-upload.phet67249.workers.dev/api/upload";

async function uploadPdfAndGetUrl(blob, filename) {
  const form = new FormData();
  form.append("file", blob, filename);
  const res = await fetch(UPLOAD_API, { method: "POST", body: form });
  if (!res.ok) throw new Error(`UPLOAD_FAILED_${res.status}`);
  const { url } = await res.json();
  return url; // https://.../receipts/xxx.pdf
}

function buildReceiptFlex(pdfUrl) {
  return {
    type: "flex",
    altText: "ใบเสร็จรับเงิน Siam Guard",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: "ใบเสร็จรับเงิน", weight: "bold", size: "lg" },
          { type: "text", text: "กดปุ่มเพื่อดาวน์โหลดไฟล์ PDF", size: "sm", color: "#666666" }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "button", style: "primary", action: { type: "uri", label: "ดาวน์โหลด PDF", uri: pdfUrl } }
        ],
        flex: 0
      }
    }
  };
}

function buildCheckUrls(digits) {
  const v = Date.now();
  return API_BASES.map(base => `${base}/api/check-contract?phone=${encodeURIComponent(digits)}&v=${v}`);
}

/** Package helpers (key/label/price) */
// → คืนคีย์แพ็กเกจ "spray" | "bait" | "mix"
function derivePkgKey(c) {
  if (!c) return "spray";
  if (c.pkg && ["spray","bait","mix"].includes(String(c.pkg).toLowerCase())) {
    return String(c.pkg).toLowerCase();
  }
  const raw = `${c?.package || ""}|${c?.packageLabel || ""}|${c?.servicePackage || ""}|${c?.servicePackageLabel || ""}|${c?.serviceType || ""}`
    .toLowerCase();
  if (/\bmix|ผสม|combo/.test(raw)) return "mix";
  if (/\bbait|เหยื่อ/.test(raw)) return "bait";
  if (/\bspray|ฉีด/.test(raw)) return "spray";
  const text = `${c?.priceText || ""}`.toLowerCase();
  if (/8500/.test(text)) return "mix";
  if (/5500/.test(text)) return "bait";
  return "spray";
}

const labelFromContract = (c) => {
  const k = derivePkgKey(c);
  return typeof PKG.getPackageLabel === "function"
    ? PKG.getPackageLabel(k)
    : (PKG.PACKAGE_LABEL?.[k] ?? k);
};

const priceTextFrom = (c) => {
  if (c?.priceText) return String(c.priceText);
  const priceKey = derivePkgKey(c);
  const priceFn  = PKG.getPackagePrice;
  const priceMap = PKG.PACKAGE_PRICE;
  const price    = (typeof priceFn === "function") ? priceFn(priceKey) : (priceMap?.[priceKey] ?? 0);
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

const normKey = (s) => String(s || '').toLowerCase().replace(/\u00a0/g, ' ').replace(/\s+/g, '').replace(/[/|_.()]/g, '');

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

const basePriceFrom = (c) => {
  const fromText = toNumberSafe(priceTextFrom(c));
  if (fromText > 0) return fromText;
  const k = derivePkgKey(c);
  const fn  = PKG.getPackagePrice;
  const map = PKG.PACKAGE_PRICE;
  const v   = (typeof fn === "function") ? fn(k) : (map?.[k]);
  return Number(v ?? 0);
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

function selectFixedPayLinkByBasePrice(basePrice) {
  const n = Math.round(toNumberSafe(basePrice));
  if (n === 3993) return PAY_LINK_3993;
  if (n === 5500) return PAY_LINK_5500;
  if (n === 8500) return PAY_LINK_8500;
  return ""; // ไม่พบแพ็กเกจที่แมตช์
}

const netTotalFrom = (c) => {
  const direct = firstNonEmpty(c?.netTotal, c?.['ราคาสุทธิ'], c?.netBeforeVat);
  const n = toNumberSafe(direct);
  if (n || direct === 0) return n;
  return Math.max(0, Math.round(basePriceFrom(c) - discountFrom(c) + addonsSubtotalFrom(c)));
};

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

// ==== อ่านข้อมูลรอบบริการจาก JSON ใหม่ (ถ้ามี) ====
function readScheduleJsonArrays(c) {
  try {
    const raw =
      c?.serviceScheduleJson ||
      c?.service_schedule_json ||
      c?.serviceSchedule ||
      "";
    if (!raw) return { spray: [], bait: [] };
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    const spray = Array.isArray(obj?.spray) ? obj.spray.filter(Boolean) : [];
    const bait  = Array.isArray(obj?.bait)  ? obj.bait.filter(Boolean)  : [];
    return { spray, bait };
  } catch {
    return { spray: [], bait: [] };
  }
}

// ----- Month–Year (Thai, พ.ศ.) -----
const parseDate = (v) => {
  if (!v) return null;
  const s = String(v).trim();
  // พยายาม parse รูปแบบที่ใช้บ่อย
  let d = new Date(s);
  if (isNaN(d)) {
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); // YYYY-MM-DD
    if (m) d = new Date(+m[1], +m[2]-1, +m[3]);
    else {
      m = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/); // DD/MM/YYYY
      if (m) d = new Date(+m[3], +m[2]-1, +m[1]);
    }
  }
  return isNaN(d) ? null : d;
};

const fmtMonthYearTH = (v, { short=false } = {}) => {
  const d = parseDate(v);
  if (!d) return "";
  return d.toLocaleDateString('th-TH', {
    month: short ? 'short' : 'long',
    year: 'numeric'
  });
};

// แปลงค่าทุกแบบให้เป็น Date
function toDateFlexible(v) {
  if (!v && v !== 0) return null;
  if (v instanceof Date && !isNaN(v)) return v;

  // Excel serial number (เช่นจาก Google Sheets)
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d) ? null : d;
  }

  const s = String(v).trim();
  if (!s) return null;

  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, Y, M, D] = m;
    const d = new Date(Number(Y), Number(M) - 1, Number(D));
    return isNaN(d) ? null : d;
  }

  // DD/MM/YYYY หรือ DD-MM-YYYY (พ.ศ./ค.ศ.)
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    let Y = parseInt(y, 10);
    if (Y > 2400) Y -= 543; // เผื่อกรอกเป็น พ.ศ.
    const dt = new Date(Y, parseInt(mo, 10) - 1, parseInt(d, 10));
    return isNaN(dt) ? null : dt;
  }

  // fallback ให้ Date parse เอง
  const dt = new Date(s);
  return isNaN(dt) ? null : dt;
}

// format dd/MM/yyyy (พ.ศ.)
function fmtThaiDMY(v, useBuddhist = true) {
  const d = toDateFlexible(v);
  if (!d) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear() + (useBuddhist ? 543 : 0);
  return `${dd}/${mm}/${yyyy}`;
}

/* ---------------------- COMPONENTS ---------------------- */
const NotesFlex = ({ payUrl, adminUrl, showAdmin }) => (
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
              {payUrl
                ? <a href={payUrl} target="_blank" rel="noopener noreferrer" className="link-pay">ไปหน้าชำระเงิน</a>
                : (showAdmin && adminUrl
                  ? <a href={adminUrl} target="_blank" rel="noopener noreferrer" className="link-admin">ติดต่อแอดมิน</a>
              : null)}
            </li>
            <li>บัตรเครดิต รองรับการผ่อนชำระ 0% 6 เดือน <span className="muted">(service charge 3%)</span></li>
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

  // อยู่ใน LINE app ไหม (เพื่อเปลี่ยนโหมดปุ่ม)
  const [inLineApp, setInLineApp] = useState(false);
  useEffect(() => {
    (async () => {
      const ok = await ensureLiffReady();
      if (ok && window.liff.isInClient()) setInLineApp(true);
    })();
  }, []);

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
  
  // Spray แบบไดนามิก: ใช้ JSON ใหม่ก่อน → legacy → สูตร (start+4m,+8m)
  const readSprayDates = (c, start) => {
    // 1) JSON ใหม่
    const json = readScheduleJsonArrays(c).spray;
    if (json.length) return json;

    // 2) legacy keys/services[]
    const out = [];
    if (c?.serviceSpray1) out.push(c.serviceSpray1);
    if (c?.serviceSpray2) out.push(c.serviceSpray2);
    if (Array.isArray(c?.services)) {
      const arr = c.services
        .filter(s => /(spray|ฉีดพ่น)/i.test(String(s?.label||"")) && s?.date)
        .sort((a,b)=>String(a.label).localeCompare(String(b.label)))
        .map(s => s.date);
      arr.forEach(d => { if (!out.includes(d)) out.push(d); });
    }
    if (out.length) return out;

    // 3) สูตร fallback
    if (!start) return [];
    const s1 = addMonths(start, 4);
    const s2 = addMonths(s1, 4);
    return [s1, s2];
  };

  // Bait แบบไดนามิก: ใช้ JSON ใหม่ก่อน → legacy → สูตร 20 วัน * 5
  const readBaitDates = (c, start) => {
    // 1) JSON ใหม่
    const json = readScheduleJsonArrays(c).bait;
    if (json.length) return json;

    // 2) legacy keys/services[]
    const out = [];
    for (let i=1;i<=5;i++) {
      const k = `serviceBait${i}`;
      if (c?.[k]) out.push(c[k]);
    }
    if (Array.isArray(c?.services)) {
      const arr = c.services
        .filter(s => /(bait|เหยื่อ)/i.test(String(s?.label||"")) && s?.date)
        .sort((a,b)=>String(a.label).localeCompare(String(b.label)))
        .map(s => s.date);
      arr.forEach(d => { if (!out.includes(d)) out.push(d); });
    }
    if (out.length) return out;

    // 3) สูตร fallback
    if (!start) return [];
    return [20,40,60,80,100].map(d => addDays(start, d));
  };

  /** ===== กำหนดการ ===== */
  const scheduleGroups = useMemo(() => {
    if (!contract) return [];
    const pkgKey = derivePkgKey(contract);
    const start  = contract.startDate || "";
    const end    = contract.endDate || (start ? addMonths(start, 12) : "");

    const sprayDates = readSprayDates(contract, start);
    const baitDates  = readBaitDates(contract, start);
    
    const sprayGroup = {
      title: `ฉีดพ่น (${sprayDates.length} ครั้ง)`,
      kind: "spray",
      items: sprayDates.map((d, i) => ({ kind: "spray", label: `ครั้งที่ ${i+1}`, date: d }))
    };
    const baitGroup = {
      title: `วางเหยื่อ (${baitDates.length} ครั้ง)`,
      kind: "bait",
      items: baitDates.map((d, i) => ({ kind: "bait", label: `ครั้งที่ ${i+1}`, date: d }))
    };
    const endGroup = {
      title: "สิ้นสุดสัญญา",
      kind: "end",
      items: [{ kind: "end", label: "สิ้นสุดสัญญา", date: end, isEnd: true }]
    };

    if (pkgKey === "spray") return [sprayGroup, endGroup];
    if (pkgKey === "bait")  return [baitGroup, sprayGroup, endGroup];
    return [baitGroup, sprayGroup, endGroup]; // mix
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

  // ====== ค่าใช้จ่าย (ก่อน/หลัง VAT) ======
  const discount = useMemo(() => discountFrom(contract), [contract]);
  const addonsSubtotal = useMemo(() => addonsSubtotalFrom(contract), [contract]);
  const hasAdjustments = useMemo(() => {
    return toNumberSafe(discount) > 0 || toNumberSafe(addonsSubtotal) > 0;
  }, [discount, addonsSubtotal]);
  const addonsArr = useMemo(() => addonsFrom(contract), [contract]);

  const subTotal = useMemo(() => netTotalFrom(contract), [contract]);
  const grandTotal = subTotal;

  // ลิงก์จ่ายเงิน → ใช้ยอดสุทธิหลัง VAT
  const payUrl = useMemo(() => {
    if (FORCE_ADMIN_MODE) return "";  // ปิดลิงก์จ่ายเงินทั้งหมด
    // ถ้ามีส่วนลด/ค่าบริการเพิ่มเติม → ไม่แสดงลิงก์ชำระ (จะโชว์ "ติดต่อแอดมิน" แทน)
    if (hasAdjustments) return "";
    // เลือกจากราคา base (ก่อนหักส่วนลด/บวกเพิ่ม)
    const base = basePriceFrom(contract);
    const fixed = selectFixedPayLinkByBasePrice(base);
    return fixed || "";
  }, [contract, hasAdjustments]);

  async function handleDownloadReceipt(current) {
    if (!current) return;
    setDownloading(true);
    try {
      const companyName   = process.env.REACT_APP_COMPANY_NAME   || "Siam Guard";
      const companyAddr   = process.env.REACT_APP_COMPANY_ADDR   || "สำนักงานใหญ่ แขวง/เขต กรุงเทพฯ";
      const companyPhone  = process.env.REACT_APP_COMPANY_PHONE  || "02-xxx-xxxx";
      const companyTaxId  = process.env.REACT_APP_COMPANY_TAXID  || "";

      // ---- วันเริ่มสัญญา: ดึงจากหลายคีย์ แล้ว normalize เป็น dd/MM/yyyy (ค.ศ.) ----
      const pickStartRaw =
        firstNonEmpty(
          current.startDate,
          current.startYMD,
          current.service1Date,
          current.firstServiceDate,
          current.beginDate
        ) || "";

      const startFromForm = (() => {
        if (!pickStartRaw) return "";
        // YYYY-MM-DD → dd/MM/yyyy
        const m = String(pickStartRaw).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;   // 08/10/2025
        return String(pickStartRaw).trim();        // รองรับ dd/MM/yyyy โดยตรง
      })();

      const basePrice = basePriceFrom(current);
      const addOnsArr = addonsFrom(current);
      const addOnsSubtotal = addonsSubtotalFrom(current);

      const items = [
        { description: labelFromContract(current), qty: 1, unitPrice: basePrice },
        ...addOnsArr.map(a => ({
          description: a.name || "บริการเพิ่มเติม",
          qty: toNumberSafe(a.qty) || 1,
          unitPrice: toNumberSafe(a.price) || 0
        })),
      ];
      if (addOnsArr.length === 0 && toNumberSafe(addOnsSubtotal) > 0) {
        items.push({ description: "ค่าบริการเพิ่มเติม (รวม)", qty: 1, unitPrice: toNumberSafe(addOnsSubtotal) });
      }

      const receiptNo =
        firstNonEmpty(current.receiptNo, current.invoiceNumber, current.quotationNumber) ||
        `RN-${toYMD(new Date()).replace(/-/g, "")}-${String(normalizePhone(current.phone)).slice(-4).padStart(4,"0")}`;

      const payload = {
        companyName: companyName, companyAddress: companyAddr, companyPhone: companyPhone, companyTaxId: companyTaxId,
        clientName: current.name || current.customerName || current.clientName || "-",
        clientPhone: current.phone || current.clientPhone || "-",
        clientAddress: current.address || current.clientAddress || "-",
        clientTaxId: current.taxId || current.clientTaxId || "",
        receiptNo,
        issueDate: new Date(),
        // ส่งผ่าน payload ด้วย เผื่อ lib จะอ่านจากคีย์นี้
        contractStartDate: startFromForm,
        items,
        discount: toNumberSafe(discountFrom(current)),
        vatEnabled: false,
        vatRate: 0,
        alreadyPaid: toNumberSafe(current.deposit || current.alreadyPaid || 0),
      };

      const filename = `Receipt-${receiptNo}.pdf`;

      // ✅ “คันโยก” บังคับวันใน PDF ให้เท่ากับวันเริ่มสัญญาเสมอ (dd/MM/yyyy – ค.ศ.)
      const blob = await generateReceiptPDF(payload, {
        returnType: "blob",
        filename,
        forceReceiptDate: startFromForm,   // <<<<<<<<<< สำคัญสุด
      });

      // --- หลังได้ blob แล้ว ---
      const isLineUA = /Line\/|LIFF/i.test(navigator.userAgent);

      // อัปโหลดก่อนเสมอ เพื่อให้ได้ลิงก์ใช้งานได้ใน LINE
      let pdfUrl = "";
      try {
        pdfUrl = await uploadPdfAndGetUrl(blob, filename);
      } catch (e) {
        console.error("UPLOAD_FAILED", e);
        if (!isLineUA) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = filename;
          document.body.appendChild(a); a.click();
          a.remove(); URL.revokeObjectURL(url);
          return;
        }
        alert("อัปโหลดใบเสร็จไม่สำเร็จ กรุณาลองใหม่");
        return;
      }

      let shared = false;
      try {
        const ready = await ensureLiffReady();
        if (ready && window.liff.isInClient() && window.liff.isApiAvailable("shareTargetPicker")) {
          const flex = buildReceiptFlex(pdfUrl);
          await window.liff.shareTargetPicker([flex]);
          shared = true;
        }
      } catch (err) {
        console.warn("shareTargetPicker failed:", err);
      }

      if (!shared && (isLineUA || (hasLiff() && window.liff.isInClient()))) {
        try {
          await ensureLiffReady();
          window.liff.openWindow({ url: pdfUrl, external: true });
        } catch {
          window.location.href = pdfUrl;
        }
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
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
            {(c.startDate || "ไม่ทราบวันเริ่ม")} · {typeof PKG.getPackageLabel === "function" ? PKG.getPackageLabel(key) : (PKG.PACKAGE_LABEL?.[key] ?? key)}
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
              <div className="field stack">
                <label>วันที่เริ่ม</label>
                <div className="value">{fmtThaiDMY(contract.startDate) || "-"}</div>
              </div>
              <div className="field">
                <label>สิ้นสุดสัญญา</label>
                <div className="value">
                  {fmtThaiDMY(contract.endDate || (contract.startDate ? addMonths(contract.startDate, 12) : "")) || "-"}
                </div>
              </div>
              
              {contract.address && (
                <div className="field span2"><label>ที่อยู่</label><div className="value">{contract.address}</div></div>
              )}

              <NotesFlex
                payUrl={payUrl}
                adminUrl={LINE_ADMIN_URL}
                showAdmin={!payUrl}
              />
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
                title={inLineApp ? "ส่งเข้าแชท LINE" : "ดาวน์โหลดใบเสร็จ PDF"}
              >
                {downloading ? "กำลังสร้าง..." : (inLineApp ? "ส่งใบเสร็จเข้าแชท" : "รับใบเสร็จ (PDF)")}
              </button>
            </div>
            <div className="bill">
              <div className="bill__row">
                <div>ส่วนลด</div>
                <div className="bill__val">-{Number(discount || 0).toLocaleString('th-TH')}</div>
              </div>
              <div className="bill__row">
                <div>ค่าบริการเพิ่มเติม (Add-on)</div>
                <div className="bill__val">+{Number(addonsSubtotal || 0).toLocaleString('th-TH')}</div>
              </div>

              <hr className="bill__sep" />

              <div className="bill__row">
                <div>รวม</div>
                <div className="bill__val">{Number(subTotal || 0).toLocaleString('th-TH')}</div>
              </div>
              <div className="bill__row bill__row--total">
                <div>ราคาสุทธิ</div>
                <div className="bill__val">{Number(grandTotal || 0).toLocaleString('th-TH')}</div>
              </div>
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
                  const sg = scheduleGroups;
                  const spray = sg.find(g => g.kind === "spray")?.items?.length || 0;
                  const bait  = sg.find(g => g.kind === "bait")?.items?.length  || 0;
                  if (k === "spray") return `ฉีดพ่น: ${spray} ครั้ง`;
                  if (k === "bait")  return `วางเหยื่อ: ${bait} ครั้ง · ฉีดพ่น: ${spray} ครั้ง`;
                  return `ผสมผสาน · เหยื่อ: ${bait} ครั้ง · ฉีดพ่น: ${spray} ครั้ง`;
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
                        <div className="date">{fmtMonthYearTH(item.date, { short:true }) || "-"}</div>
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
