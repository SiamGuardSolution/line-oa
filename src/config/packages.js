// src/config/packages.js
// NOTE: เก็บ key เดิมไว้ (spray/bait/mix) จะได้ไม่ต้องย้ายข้อมูล/แก้ API
export const PACKAGE_LABEL = {
  spray: "[ระบบอัดน้ำยาลงท่อ + ฉีดพ่นเสริมทุกจุดภายในบ้าน]",        // เช่น "อัดท่อ + ฉีดพ่นรายปี"
  bait:  "[ระบบเหยื่อ + ฉีดพ่นเสริมทุกจุดภายในบ้าน]",     // เช่น "วางสถานีเหยื่อภายใน/นอกบ้าน"
  mix:   "[ระบบเหยื่อ + อัดน้ำยาลงท่อ + ฉีดพ่นเสริมทุกจุดภายในบ้าน]",           // เช่น "แพ็กเกจผสม (ท่อ+เหยื่อ)"
};

export const PACKAGE_PRICE = {
  pipe3993: 3993,
  bait5500_in: 5500,
  bait5500_out: 5500,
  bait5500_both: 5500,
  combo8500: 8500,
};

// helpers
export const getPackageLabel = k => PACKAGE_LABEL[k] || String(k || "");
export const getPackagePrice = k => PACKAGE_PRICE[k] ?? 0;
