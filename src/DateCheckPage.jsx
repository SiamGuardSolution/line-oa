import React, { useMemo, useState } from "react";
import "./DateCheckPage.css";

const PROXY_BASE = (process.env.REACT_APP_API_BASE || "https://siamguards-proxy.phet67249.workers.dev")
  .replace(/\/$/, "");

function normalizeSheetKey(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "spray") return "Spray";
  if (s === "bait") return "Bait";
  if (s === "mix") return "Mix";
  return v ? String(v) : "Other";
}

function parseServiceHeaderToGroupRound(headerText) {
  const s = String(headerText || "").trim();
  const m = s.match(/รอบที่\s*(\d+)/i);
  const round = m ? Number(m[1]) : null;

  if (/^Service\s+Spray/i.test(s)) return { serviceGroup: "spray", serviceIndex: round };
  if (/^Service\s+Bait\s*\(ภายใน\)/i.test(s)) return { serviceGroup: "bait_in", serviceIndex: round };
  if (/^Service\s+Bait\s*\(ภายนอก\)/i.test(s)) return { serviceGroup: "bait_out", serviceIndex: round };
  return { serviceGroup: "", serviceIndex: round };
}

function labelOfGroup(g) {
  if (g === "spray") return "Spray";
  if (g === "bait_in") return "Bait (ภายใน)";
  if (g === "bait_out") return "Bait (ภายนอก)";
  return "-";
}

function shortServiceLabel(header) {
  const p = parseServiceHeaderToGroupRound(header);
  if (!p.serviceGroup || !p.serviceIndex) return header;
  return `${labelOfGroup(p.serviceGroup)} #${p.serviceIndex}`;
}

function safeText(v) {
  return String(v ?? "").trim();
}

async function fetchJsonWithRaw(url, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  let raw = "";
  try {
    res = await fetch(url, { method: "GET", signal: controller.signal });
    raw = await res.text();
  } finally {
    clearTimeout(timer);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`API ตอบกลับไม่ใช่ JSON (status ${res?.status ?? "?"}) : ${String(raw || "").slice(0, 220)}`);
  }

  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || `NOT_OK (${res.status})`);
  }

  return { data, raw, res };
}

function chipTextStatus(v) {
  const s = safeText(v);
  if (!s) return { text: "-", tone: "muted" };
  const low = s.toLowerCase();
  const done = low.includes("เสร็จ") || low.includes("เรียบร้อย") || low === "done" || low === "completed" || low === "true" || low === "yes" || low === "1";
  return { text: s, tone: done ? "done" : "pending" };
}

export default function DateCheckPage() {
  // input สำหรับ “ยิง API”
  const [date, setDate] = useState("");     // YYYY-MM-DD (optional)
  const [query, setQuery] = useState("");   // คำค้น (optional)

  // UI state
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [results, setResults] = useState([]);

  // filter ภายในผลลัพธ์ (local)
  const [localFilter, setLocalFilter] = useState("");

  const [activeTab, setActiveTab] = useState("All"); // All | Bait | Spray | Mix
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [expandedKey, setExpandedKey] = useState("");

  // ===== Row detail (Service ทั้งหมด) =====
  const [rowDetailCache, setRowDetailCache] = useState({});      // rowKey -> detail data
  const [rowDetailLoading, setRowDetailLoading] = useState({});  // rowKey -> boolean
  const [rowDetailErr, setRowDetailErr] = useState({});          // rowKey -> msg

  // ===== Service Shift modal =====
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftTarget, setShiftTarget] = useState(null);

  const [shiftServiceOptions, setShiftServiceOptions] = useState([]);
  const [shiftPick, setShiftPick] = useState({ header: "", serviceGroup: "", serviceIndex: 1 });
  const [shiftNewDate, setShiftNewDate] = useState("");

  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftErr, setShiftErr] = useState("");
  const [shiftPreview, setShiftPreview] = useState(null);
  const [shiftApplyResult, setShiftApplyResult] = useState(null);
  const [shiftRaw, setShiftRaw] = useState("");

  const grouped = useMemo(() => {
    const g = { Bait: [], Spray: [], Mix: [] };
    for (const r of results || []) {
      const key = normalizeSheetKey(r.sheet || r.sheetName || r.tab || r.type);
      if (!g[key]) g[key] = [];
      g[key].push(r);
    }
    return g;
  }, [results]);

  const allRows = useMemo(() => {
    const arr = [];
    ["Bait", "Spray", "Mix"].forEach((k) => {
      for (const r of grouped[k] || []) {
        const rowNumber = r.rowNumber || r.row || r.rowIndex || "";
        const sheetName = r.sheetName || r.sheet || k;
        const rowKey = `${sheetName}#${rowNumber}`;
        arr.push({ ...r, sheetKey: k, sheetName, rowNumber, rowKey });
      }
    });
    return arr;
  }, [grouped]);

  // local filter + tab
  const filteredRows = useMemo(() => {
    const f = safeText(localFilter).toLowerCase();
    const tab = activeTab;
    const base = tab === "All" ? allRows : allRows.filter((r) => r.sheetKey === tab);

    if (!f) return base;

    return base.filter((r) => {
      const name = safeText(r.name || r.customerName);
      const phone = safeText(r.phone || r.tel || r.mobile);
      const address = safeText(r.address || r.addr);
      const services = Array.isArray(r.services) ? r.services.join(" ") : "";
      const hay = `${name} ${phone} ${address} ${services}`.toLowerCase();
      return hay.includes(f);
    });
  }, [allRows, activeTab, localFilter]);

  const pageCount = useMemo(() => {
    const n = filteredRows.length;
    return Math.max(1, Math.ceil(n / pageSize));
  }, [filteredRows.length, pageSize]);

  const pageRows = useMemo(() => {
    const p = Math.min(Math.max(page, 1), pageCount);
    const start = (p - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize, pageCount]);

  // ===== API Search =====
  async function onSearch() {
    setErr("");
    setResults([]);
    setExpandedKey("");
    setPage(1);

    const hasDate = !!safeText(date);
    const hasQuery = !!safeText(query);

    if (!hasDate && !hasQuery) {
      setErr("กรุณาเลือกวันที่ หรือพิมพ์คำค้นก่อน");
      return;
    }

    setLoading(true);
    try {
      let url = "";

      if (hasQuery) {
        const qs = new URLSearchParams({
          action: "searchScan",
          q: safeText(query),
        });
        if (hasDate) qs.set("date", safeText(date));
        url = `${PROXY_BASE}/api/check?${qs.toString()}`;
      } else {
        url = `${PROXY_BASE}/api/check?action=dateScan&date=${encodeURIComponent(date)}`;
      }

      const { data } = await fetchJsonWithRaw(url);
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (e) {
      const msg = e?.name === "AbortError" ? "คำขอหมดเวลา (timeout)" : String(e?.message || e);
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  async function refreshCurrentSearch() {
    return onSearch();
  }

  // ===== Fetch ServiceRowDetail =====
  async function fetchRowDetail(rowObj) {
    const rowKey = rowObj?.rowKey;
    if (!rowKey) return;
    if (rowDetailCache[rowKey]) return;

    const sheet = rowObj.sheetName || rowObj.sheet;
    const rowNumber = rowObj.rowNumber;

    const qs = new URLSearchParams({
      action: "serviceRowDetail",
      sheet: String(sheet),
      rowNumber: String(rowNumber),
    });

    const url = `${PROXY_BASE}/api/check?${qs.toString()}`;

    setRowDetailLoading((m) => ({ ...m, [rowKey]: true }));
    setRowDetailErr((m) => ({ ...m, [rowKey]: "" }));

    try {
      const { data } = await fetchJsonWithRaw(url);
      setRowDetailCache((m) => ({ ...m, [rowKey]: data }));
    } catch (e) {
      setRowDetailErr((m) => ({ ...m, [rowKey]: String(e?.message || e) }));
    } finally {
      setRowDetailLoading((m) => ({ ...m, [rowKey]: false }));
    }
  }

  // ===== Shift Modal =====
  function openShiftModal(rowObj) {
    setShiftErr("");
    setShiftPreview(null);
    setShiftApplyResult(null);
    setShiftRaw("");

    const services = Array.isArray(rowObj.services) ? rowObj.services : [];
    const options = services
      .map((h) => {
        const parsed = parseServiceHeaderToGroupRound(h);
        return {
          header: h,
          serviceGroup: parsed.serviceGroup,
          serviceIndex: parsed.serviceIndex || 1,
          short: shortServiceLabel(h),
        };
      })
      .filter((x) => x.serviceGroup && x.serviceIndex);

    setShiftTarget(rowObj);
    setShiftServiceOptions(options);

    if (options.length) {
      setShiftPick({
        header: options[0].header,
        serviceGroup: options[0].serviceGroup,
        serviceIndex: options[0].serviceIndex,
      });
    } else {
      setShiftPick({ header: "", serviceGroup: "spray", serviceIndex: 1 });
    }

    setShiftNewDate(date || "");
    setShiftOpen(true);
  }

  async function callServiceShiftApi(actionName) {
    setShiftErr("");
    setShiftRaw("");
    setShiftApplyResult(null);

    if (!shiftTarget) return setShiftErr("ยังไม่ได้เลือกแถว");
    const sheet = shiftTarget.sheetName || shiftTarget.sheet;
    const rowNumber = shiftTarget.rowNumber;

    if (!sheet || !rowNumber) return setShiftErr("ขาดข้อมูล sheet/rowNumber");
    if (!shiftPick.serviceGroup || !shiftPick.serviceIndex) return setShiftErr("กรุณาเลือกบริการ/รอบให้ถูกต้อง");
    if (!shiftNewDate) return setShiftErr("กรุณาเลือกวันใหม่");

    const qs = new URLSearchParams({
      action: actionName,
      sheet: String(sheet),
      rowNumber: String(rowNumber),
      serviceGroup: String(shiftPick.serviceGroup),
      serviceIndex: String(shiftPick.serviceIndex),
      newDate: String(shiftNewDate),
    });

    const url = `${PROXY_BASE}/api/check?${qs.toString()}`;

    setShiftLoading(true);
    try {
      const { data, raw } = await fetchJsonWithRaw(url);
      setShiftRaw(raw);

      if (actionName === "serviceShiftPreview") {
        setShiftPreview(data);
      } else {
        setShiftApplyResult(data);
        setShiftPreview(data);

        // รีเฟรช results
        await refreshCurrentSearch();

        // และล้าง cache ของแถวนี้ เพื่อให้ “ดู” แล้วเห็นวันที่ล่าสุดแน่นอน
        const rowKey = shiftTarget?.rowKey;
        if (rowKey) {
          setRowDetailCache((m) => {
            const copy = { ...m };
            delete copy[rowKey];
            return copy;
          });
        }
      }
    } catch (e) {
      const msg = e?.name === "AbortError" ? "คำขอหมดเวลา (timeout)" : String(e?.message || e);
      setShiftErr(msg);
    } finally {
      setShiftLoading(false);
    }
  }

  const counts = useMemo(() => {
    return {
      All: allRows.length,
      Bait: (grouped.Bait || []).length,
      Spray: (grouped.Spray || []).length,
      Mix: (grouped.Mix || []).length,
    };
  }, [allRows.length, grouped]);

  function setTab(t) {
    setActiveTab(t);
    setPage(1);
    setExpandedKey("");
  }

  function onChangeLocalFilter(v) {
    setLocalFilter(v);
    setPage(1);
    setExpandedKey("");
  }

  function toggleExpand(rowObj) {
    const rowKey = rowObj?.rowKey;
    if (!rowKey) return;
    setExpandedKey((prev) => {
      const next = prev === rowKey ? "" : rowKey;
      if (next) fetchRowDetail(rowObj);
      return next;
    });
  }

  function renderServiceAll(detail) {
    const svc = detail?.services || {};
    const blocks = [
      { key: "spray", label: "Spray" },
      { key: "bait_in", label: "Bait (ภายใน)" },
      { key: "bait_out", label: "Bait (ภายนอก)" },
    ];

    return (
      <div className="dc-servgrid">
        {blocks.map((b) => {
          const rows = Array.isArray(svc[b.key]) ? svc[b.key] : [];
          return (
            <div className="dc-servbox" key={b.key}>
              <div className="dc-servtitle">{b.label}</div>
              <div className="dc-tablewrap">
                <table className="dc-table dc-table--mini">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>รอบ</th>
                      <th style={{ width: 140 }}>วันที่</th>
                      <th>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length ? (
                      rows.map((it) => {
                        const st = chipTextStatus(it.status);
                        return (
                          <tr key={`${b.key}-${it.round}`}>
                            <td>#{it.round}</td>
                            <td>{it.date || "-"}</td>
                            <td>
                              <span className={`dc-pill dc-pill--${st.tone}`}>{st.text}</span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={3}>
                          <div className="dc-empty">— ไม่มีคอลัมน์ชุดนี้ในชีต —</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="datecheck-container">
      <div className="dc-top">
        <h1>ตรวจสอบงานตามวันที่</h1>
        <p className="dc-subtitle">✅ เลือกวันที่ “หรือ” พิมพ์คำค้น แล้วกดค้นหา → ระบบจะยิง API เพื่อดึงผลลัพธ์</p>
        <div className="dc-subtitle" style={{ opacity: 0.7 }}>
          API: {PROXY_BASE}
        </div>
      </div>

      {/* ===== Search bar ===== */}
      <div className="dc-card dc-card--sticky">
        <div className="dc-row dc-row--wrap">
          <div className="dc-field">
            <label className="dc-label">เลือกวันที่ (ไม่บังคับ)</label>
            <input className="dc-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="dc-field dc-field--grow">
            <label className="dc-label">คำค้น (ยิง API) — ชื่อ/เบอร์/ที่อยู่</label>
            <input
              className="dc-input"
              placeholder="เช่น 089xxxxxxx, นาย กำจัดปลวก, คลองหลวง..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="dc-field dc-field--btn">
            <label className="dc-label">&nbsp;</label>
            <button className="dc-btn" onClick={onSearch} disabled={loading}>
              {loading ? "กำลังค้นหา..." : "ค้นหา"}
            </button>
          </div>
        </div>

        {/* Local filter */}
        <div className="dc-row dc-row--wrap" style={{ marginTop: 10 }}>
          <div className="dc-field dc-field--grow">
            <label className="dc-label">กรองภายในผลลัพธ์ (ไม่ยิง API)</label>
            <input
              className="dc-input"
              placeholder="กรองเพิ่มในหน้าจอ เช่น ถนน/หมู่บ้าน/เบอร์บางส่วน..."
              value={localFilter}
              onChange={(e) => onChangeLocalFilter(e.target.value)}
              disabled={!results?.length}
            />
          </div>

          <div className="dc-field dc-field--btn">
            <label className="dc-label">&nbsp;</label>
            <button
              className="dc-btn dc-btn--ghost"
              onClick={() => setLocalFilter("")}
              disabled={!results?.length}
            >
              ล้างตัวกรอง
            </button>
          </div>
        </div>

        {err ? <div className="dc-error">⚠ {err}</div> : null}

        <div className="dc-meta dc-meta--row">
          <div>
            {results?.length ? (
              <span>
                พบทั้งหมด <b>{results.length}</b> รายการ
              </span>
            ) : (
              <span>ยังไม่มีผลลัพธ์</span>
            )}
          </div>

          <div className="dc-meta-right">
            <span style={{ opacity: 0.8 }}>ต่อหน้า</span>
            <select
              className="dc-input dc-input--mini"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              disabled={!results?.length}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        <div className="dc-tabs">
          {["All", "Bait", "Spray", "Mix"].map((t) => (
            <button
              key={t}
              className={`dc-tab ${activeTab === t ? "dc-tab--active" : ""}`}
              onClick={() => setTab(t)}
              disabled={!results?.length}
            >
              {t} <span className="dc-badge">{counts[t]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ===== Result table ===== */}
      <div className="dc-card">
        <div className="dc-tablewrap">
          <table className="dc-table dc-table--compact">
            <thead>
              <tr>
                <th style={{ width: 88 }}>ชีต</th>
                <th style={{ width: 220 }}>ชื่อ</th>
                <th style={{ width: 140 }}>เบอร์โทร</th>
                <th>ที่อยู่</th>
                <th style={{ width: 240 }}>Service ที่เจอ</th>
                <th style={{ width: 160 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length ? (
                pageRows.map((r, idx) => {
                  const name = safeText(r.name || r.customerName) || "-";
                  const phone = safeText(r.phone || r.tel || r.mobile) || "-";
                  const address = safeText(r.address || r.addr) || "-";

                  const services =
                    Array.isArray(r.services) ? r.services :
                    Array.isArray(r.serviceColumns) ? r.serviceColumns :
                    Array.isArray(r.cols) ? r.cols :
                    [];

                  const sheetName = r.sheetName || r.sheetKey;
                  const rowNumber = r.rowNumber || "-";
                  const canShift = !!(sheetName && rowNumber && rowNumber !== "-");

                  const topServices = services.slice(0, 2);
                  const more = services.length - topServices.length;
                  const isExpanded = expandedKey === r.rowKey;

                  const detail = rowDetailCache[r.rowKey];
                  const isDL = !!rowDetailLoading[r.rowKey];
                  const derr = rowDetailErr[r.rowKey];

                  return (
                    <React.Fragment key={`${r.rowKey}-${idx}`}>
                      <tr>
                        <td>
                          <span className={`dc-chip dc-chip--${r.sheetKey.toLowerCase()}`}>{r.sheetKey}</span>
                        </td>
                        <td>
                          <div className="dc-name">{name}</div>
                          <div className="dc-subline">
                            แถว #{rowNumber} ({sheetName})
                          </div>
                        </td>
                        <td>{phone}</td>
                        <td className="dc-address dc-ellipsis">{address}</td>
                        <td>
                          <div className="dc-tags dc-tags--tight">
                            {topServices.map((s, i) => (
                              <span className="dc-tag" key={i} title={s}>
                                {shortServiceLabel(s)}
                              </span>
                            ))}
                            {more > 0 ? <span className="dc-tag dc-tag--muted">+{more} more</span> : null}
                            {!services.length ? (
                              <span className="dc-tag dc-tag--warn" title="มักเกิดจากค้นด้วยคำค้น (ไม่ได้ match วันที่) หรือ API ไม่คืน services">
                                ไม่ระบุ
                              </span>
                            ) : null}
                          </div>

                          {!services.length ? (
                            <div className="dc-hint">
                              * กด “ดู” เพื่อดึง Service ทั้งหมดจากแถวจริง
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <div className="dc-actions">
                            <button className="dc-btn dc-btn--small" onClick={() => openShiftModal(r)} disabled={!canShift}>
                              เลื่อนวัน
                            </button>
                            <button className="dc-btn dc-btn--ghost dc-btn--small" onClick={() => toggleExpand(r)}>
                              {isExpanded ? "ย่อ" : "ดู"}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr className="dc-expandrow">
                          <td colSpan={6}>
                            <div className="dc-expandbox">
                              <div className="dc-expand-col">
                                <div className="dc-expand-title">ที่อยู่เต็ม</div>
                                <div className="dc-expand-text">{address || "-"}</div>
                              </div>

                              <div className="dc-expand-col">
                                <div className="dc-expand-title">Service ทั้งหมดของลูกค้าคนนี้ (วันที่ + สถานะ)</div>

                                {isDL ? (
                                  <div className="dc-empty">กำลังโหลด Service ทั้งหมด...</div>
                                ) : derr ? (
                                  <div className="dc-error">⚠ {derr}</div>
                                ) : detail?.services ? (
                                  renderServiceAll(detail)
                                ) : (
                                  <div className="dc-empty">
                                    ยังไม่มีข้อมูล (ถ้าเห็นข้อความนี้ แปลว่า API serviceRowDetail ยังไม่พร้อม)
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="dc-empty">— ไม่พบข้อมูล —</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="dc-pager">
          <button className="dc-btn dc-btn--ghost dc-btn--small" onClick={() => setPage(1)} disabled={page <= 1}>
            {"<<"}
          </button>
          <button className="dc-btn dc-btn--ghost dc-btn--small" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            {"<"}
          </button>

          <div className="dc-pager-mid">
            หน้า <b>{Math.min(page, pageCount)}</b> / {pageCount} &nbsp;|&nbsp; ทั้งหมด <b>{filteredRows.length}</b> แถว
          </div>

          <button className="dc-btn dc-btn--ghost dc-btn--small" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount}>
            {">"}
          </button>
          <button className="dc-btn dc-btn--ghost dc-btn--small" onClick={() => setPage(pageCount)} disabled={page >= pageCount}>
            {">>"}
          </button>
        </div>
      </div>

      {/* ===== Shift Modal ===== */}
      {shiftOpen ? (
        <div className="dc-modal-backdrop" onClick={() => setShiftOpen(false)}>
          <div className="dc-modal dc-modal--wide" onClick={(ev) => ev.stopPropagation()}>
            <div className="dc-modal-head">
              <div>
                <div className="dc-modal-title">เลื่อนวันบริการ</div>
                <div className="dc-modal-sub">
                  Sheet: <b>{shiftTarget?.sheetName || shiftTarget?.sheet}</b> | แถว <b>#{shiftTarget?.rowNumber}</b> | ลูกค้า{" "}
                  <b>{safeText(shiftTarget?.name || shiftTarget?.customerName) || "-"}</b>
                </div>
              </div>
              <button className="dc-btn dc-btn--ghost" onClick={() => setShiftOpen(false)}>
                ปิด
              </button>
            </div>

            <div className="dc-modal-body">
              <div className="dc-grid2">
                <div className="dc-panel">
                  <div className="dc-panel-title">1) เลือก “ช่อง Service” ที่ต้องการเลื่อน</div>

                  {shiftServiceOptions.length ? (
                    <div className="dc-radiolist">
                      {shiftServiceOptions.map((o, i) => {
                        const checked = shiftPick.header === o.header;
                        return (
                          <label key={i} className={`dc-radioitem ${checked ? "dc-radioitem--on" : ""}`}>
                            <input
                              type="radio"
                              name="svcPick"
                              checked={checked}
                              onChange={() => {
                                setShiftPick({ header: o.header, serviceGroup: o.serviceGroup, serviceIndex: o.serviceIndex });
                                setShiftPreview(null);
                                setShiftApplyResult(null);
                                setShiftErr("");
                                setShiftRaw("");
                              }}
                            />
                            <div className="dc-radioitem-main">
                              <div className="dc-radioitem-title">{o.short}</div>
                              <div className="dc-radioitem-sub">{o.header}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="dc-empty">
                      ไม่พบ Service list ในผลลัพธ์ (ถ้าค้นด้วยคำค้นอย่างเดียว มักไม่รู้ว่า “เจอที่รอบไหน”)
                      <br />
                      แนะนำ: กด “ดู” ที่แถวก่อน เพื่อดูตาราง Service ทั้งหมด แล้วค่อยเลือกเลื่อนวันจากรอบที่ต้องการ
                    </div>
                  )}

                  <div className="dc-panel-title" style={{ marginTop: 12 }}>
                    2) เลือก “วันใหม่”
                  </div>
                  <input
                    className="dc-input"
                    type="date"
                    value={shiftNewDate}
                    onChange={(e) => {
                      setShiftNewDate(e.target.value);
                      setShiftPreview(null);
                      setShiftApplyResult(null);
                      setShiftErr("");
                      setShiftRaw("");
                    }}
                  />

                  <div className="dc-minihelp">
                    คำนวณแบบ “ยึดระยะห่างเดิมในแถว” และแก้เฉพาะรอบที่ยังไม่เสร็จ (ถ้ารอบถัดไปว่าง → หยุด)
                  </div>

                  {shiftErr ? (
                    <div className="dc-error" style={{ marginTop: 10 }}>
                      ⚠ {shiftErr}
                    </div>
                  ) : null}
                </div>

                <div className="dc-panel">
                  <div className="dc-panel-title">3) Preview ผลก่อนบันทึก</div>

                  <div className="dc-actions" style={{ marginBottom: 10 }}>
                    <button className="dc-btn" onClick={() => callServiceShiftApi("serviceShiftPreview")} disabled={shiftLoading}>
                      {shiftLoading ? "กำลังทำ..." : "Preview"}
                    </button>

                    <button
                      className="dc-btn dc-btn--danger"
                      onClick={() => callServiceShiftApi("serviceShiftApply")}
                      disabled={shiftLoading || !shiftPreview}
                      title={!shiftPreview ? "กรุณา Preview ก่อน" : ""}
                    >
                      ยืนยัน Apply
                    </button>
                  </div>

                  {shiftPreview?.preview?.length ? (
                    <>
                      <div className="dc-tablewrap">
                        <table className="dc-table dc-table--compact">
                          <thead>
                            <tr>
                              <th style={{ width: 80 }}>รอบ</th>
                              <th>คอลัมน์</th>
                              <th style={{ width: 130 }}>ก่อน</th>
                              <th style={{ width: 130 }}>หลัง</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shiftPreview.preview.map((p, i) => (
                              <tr key={i}>
                                <td>{p.round}</td>
                                <td>{p.col}</td>
                                <td>{p.before || "-"}</td>
                                <td>
                                  <b>{p.after || "-"}</b>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {shiftPreview.stoppedReason ? <div className="dc-minihelp">หยุดคำนวณเพราะ: {shiftPreview.stoppedReason}</div> : null}
                      {shiftPreview.warning ? <div className="dc-minihelp">⚠ {shiftPreview.warning}</div> : null}
                      {shiftApplyResult?.ok ? <div className="dc-success">✅ Apply สำเร็จ</div> : null}
                    </>
                  ) : (
                    <div className="dc-empty">กด Preview เพื่อดูผลลัพธ์ก่อนบันทึก</div>
                  )}

                  {shiftRaw ? (
                    <details style={{ marginTop: 10 }}>
                      <summary>ดู raw response (debug)</summary>
                      <pre className="dc-raw">{shiftRaw}</pre>
                    </details>
                  ) : null}
                </div>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="dc-btn dc-btn--ghost" onClick={() => setShiftOpen(false)}>
                  ปิด
                </button>
                <button className="dc-btn" onClick={refreshCurrentSearch} disabled={loading}>
                  รีเฟรชผลลัพธ์
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
