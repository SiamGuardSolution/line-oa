import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const API   = process.env.NEXT_PUBLIC_GAS_API_BASE;           // ต้องลงท้าย /exec
const DEBUG = (process.env.NEXT_PUBLIC_DEBUG ?? "true") !== "false";

/* ---------- helpers ---------- */
const imgCache = new Map(); // cache dataUrl by original url/id

function fmtDate(s){
  try { return new Date(s).toLocaleDateString("th-TH"); }
  catch { return String(s || "-"); }
}
function fmtTime(s){
  if(!s) return "-";
  if(/^\d{1,2}:\d{2}/.test(String(s))) return s;
  try { return new Date(s).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"}); }
  catch { return String(s); }
}
function toRawUrl(any){
  // รองรับทั้ง {url:"..."}, "https://...", หรือ "FILE_ID"
  if(!any) return "";
  if (typeof any === "object" && any.url) return String(any.url);
  const s = String(any);
  if (s.startsWith("http")) return s;
  // เป็น id เปล่า → แปลงเป็นลิงก์ drive มาตรฐาน (proxy รับได้ทั้ง src เต็มหรือ id)
  return `https://drive.google.com/uc?id=${encodeURIComponent(s)}`;
}

// เรียก proxy เสมอด้วย src (ลิงก์เต็ม) + cache + retry เบาๆ + LOG
async function fetchDataUrlViaProxy(originalUrl, retry = 1){
  if(!originalUrl) return "";
  if(imgCache.has(originalUrl)) return imgCache.get(originalUrl);

  const url = `${API}?route=file64&src=${encodeURIComponent(originalUrl)}`;
  try{
    DEBUG && console.log("[file64] fetch:", url);
    const r = await fetch(url);
    const j = await r.json();
    if(j?.ok && j.dataUrl){
      DEBUG && console.log("[file64] ok:", originalUrl.slice(0,80), "len:", j.dataUrl.length);
      imgCache.set(originalUrl, j.dataUrl);
      return j.dataUrl;
    }
    DEBUG && console.warn("[file64] error payload:", j);
    if (retry > 0) return fetchDataUrlViaProxy(originalUrl, retry - 1);
    return "";
  }catch(err){
    DEBUG && console.warn("[file64] fetch failed:", err);
    if (retry > 0) return fetchDataUrlViaProxy(originalUrl, retry - 1);
    return "";
  }
}
/* ---------- end helpers ---------- */

export default function Report(){
  const router = useRouter();
  const id = router.query?.id;
  const [data,setData]     = useState(null);
  const [signSrc,setSign]  = useState("");
  const [photos,setPhotos] = useState([]); // { ...p, _src }
  const [err,setErr]       = useState("");

  useEffect(() => {
    DEBUG && console.log("API at runtime:", API);
  }, []);

  // โหลดข้อมูลรายงาน + LOG
  useEffect(()=>{
    if(!router.isReady || !id || !API) return;
    let aborted = false;

    (async ()=>{
      const reportUrl = `${API}?route=report&id=${encodeURIComponent(id)}`;
      try{
        DEBUG && console.log("[report] fetch:", reportUrl);
        const res = await fetch(reportUrl);
        const j = await res.json();
        if(aborted) return;
        if(j.ok){
          DEBUG && console.log("[report] ok: service_id:", id,
            "| photos:", (j.data?.photos||[]).length,
            "| chems:", (j.data?.chemicals||[]).length);
          setData(j.data);
        }else{
          DEBUG && console.warn("[report] error:", j.error);
          setErr(j.error || "โหลดไม่สำเร็จ");
        }
      }catch(e){
        DEBUG && console.warn("[report] fetch failed:", e);
        if(!aborted) setErr(String(e));
      }
    })();

    return ()=>{ aborted = true; };
  },[router.isReady, id]);

  // เตรียมลายเซ็น + รูปถ่าย + LOG
  useEffect(()=>{
    if(!data) return;
    let aborted = false;

    // ลายเซ็น
    (async ()=>{
      const raw = toRawUrl(data?.service?.signature_url?.url || data?.service?.signature_url);
      if(!raw){
        DEBUG && console.log("[sign] no signature_url");
        return;
      }
      const d = await fetchDataUrlViaProxy(raw);
      if(!aborted) setSign(d);
    })();

    // รูปถ่าย
    (async ()=>{
      const list = data.photos || [];
      DEBUG && console.log("[photos] total:", list.length);
      const done = await Promise.all(list.map(async (p, idx)=>{
        const raw = toRawUrl(p?.photo_url?.url || p?.photo_url);
        const _src = raw ? await fetchDataUrlViaProxy(raw) : "";
        if (DEBUG && !_src) console.warn("[photos] empty dataUrl at idx:", idx, "| zone:", p?.zone, "| raw:", raw);
        return { ...p, _src };
      }));

      console.log('[photos] ok:', done.length,
      done.map(d => (d._src ? d._src.slice(0,30) : 'EMPTY')));

      if(!aborted) setPhotos(done);
    })();

    return ()=>{ aborted = true; };
  },[data]);

  // จัดกลุ่มรูปด้วย zone
  const groups = useMemo(()=>{
    return (photos || []).reduce((m,p)=>{
      const z = p?.zone || "ทั่วไป";
      (m[z] = m[z] || []).push(p);
      return m;
    }, {});
  }, [photos]);

  if(err)   return <main style={{maxWidth:960,margin:"24px auto"}}>เกิดข้อผิดพลาด: {err}</main>;
  if(!data) return <main style={{maxWidth:960,margin:"24px auto"}}>กำลังโหลด...</main>;

  const { service, chemicals = [] } = data;

  return (
    <main style={{maxWidth:960,margin:"24px auto",padding:16}}>
      <h1 style={{borderLeft:"8px solid #ff6a00",paddingLeft:12,marginBottom:16}}>ข้อมูลการบริการ</h1>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div>
          <b>{service.customer_name}</b><br/>{service.address}<br/>
          แพ็กเกจ: {service.package}<br/>เลขสัญญา: {service.contract_no}
        </div>
        <div>
          วันที่: {fmtDate(service.date)}<br/>
          เวลา: {fmtTime(service.time_start)} - {fmtTime(service.time_end)}<br/>
          พนักงาน: {service.staff_name}<br/>
          {signSrc
            ? <img src={signSrc} alt="sign" style={{maxHeight:100}}/>
            : <span style={{color:"#aaa"}}>ไม่มีลายเซ็น</span>}
        </div>
      </div>

      <h2 style={{marginTop:24}}>รูปถ่ายหน้างาน</h2>
      {Object.keys(groups).length === 0 && (
        <div style={{color:"#888"}}>ไม่มีรูปที่แนบมา</div>
      )}

      {Object.entries(groups).map(([zone,list])=>(
        <section key={zone} style={{margin:"8px 0 24px"}}>
          <h3>{zone}</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
            {list.map((p,i)=>(
              p._src
                ? <img
                    key={zone+"-"+i}
                    src={p._src}
                    alt={`รูปหน้างาน ${zone}`}
                    // บังคับโหลดทันที + ลดการดีเลย์ของ dev overlay
                    loading="eager"
                    decoding="sync"
                    // ใส่ขนาดคงที่กัน layout shift
                    width={400}
                    height={180}
                    style={{
                      width:"100%",
                      height:180,
                      objectFit:"cover",
                      borderRadius:10,
                      background:"#f2f2f2"
                    }}
                    onError={(e)=>{ e.currentTarget.alt = 'โหลดรูปไม่สำเร็จ'; }}
                  />
                : <div key={zone+"-"+i}
                      style={{width:"100%",height:180,borderRadius:10,background:"#f8f8f8",display:"grid",placeItems:"center",color:"#aaa"}}>
                    ไม่มีรูป / โหลดไม่สำเร็จ
                  </div>
            ))}
          </div>
        </section>
      ))}

      {!!chemicals.length && (
        <section>
          <h2>สารเคมีที่ใช้</h2>
          <ul>
            {chemicals.map((c,i)=> (
              <li key={i}>
                {c.link_info
                  ? <a href={c.link_info} target="_blank" rel="noreferrer">{c.chemical_name}</a>
                  : c.chemical_name}
                {c.qty ? ` – ${c.qty}` : ""} {c.remark ? ` (${c.remark})` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Dev helper: summary */}
      {DEBUG && (
        <pre style={{marginTop:24,padding:12,background:"#fafafa",border:"1px solid #eee",borderRadius:8,overflow:"auto"}}>
{`DEBUG
API: ${API}
service_id: ${String(id)}
photos: ${photos.length} (rendered), groups: ${Object.keys(groups).length}
`}
        </pre>
      )}
    </main>
  );
}
