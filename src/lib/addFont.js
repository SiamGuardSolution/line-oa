// src/lib/addFont.js
export async function addFont(doc, url, name, style = 'normal') {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const vfsName = `${name}-${style}.ttf`;
  doc.addFileToVFS(vfsName, base64);
  doc.addFont(vfsName, name, style);
}
