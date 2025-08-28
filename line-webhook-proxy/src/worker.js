// line-webhook-proxy/src/worker.js
export default {
  async fetch(request, env, ctx) {
    // ให้ Verify/GET และ HEAD ตอบ 200 เร็วๆ
    if (request.method === 'GET' || request.method === 'HEAD') {
      return new Response('OK', { status: 200 });
    }

    // รับเฉพาะ POST จาก LINE
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const target = env.APPS_SCRIPT_EXEC_URL;
    if (!target) return new Response('Missing APPS_SCRIPT_EXEC_URL', { status: 500 });

    const raw = await request.text();
    const fwdHeaders = {
      'Content-Type': request.headers.get('content-type') || 'application/json',
      'X-Line-Signature': request.headers.get('x-line-signature') || '',
    };

    // ส่งต่อไป Apps Script แบบเบื้องหลัง (preserve POST ข้าม 302)
    ctx.waitUntil((async () => {
      try {
        let resp = await fetch(target, {
          method: 'POST',
          headers: fwdHeaders,
          body: raw,
          redirect: 'manual',      // กัน POST ถูกแปลงเป็น GET
        });

        let hops = 0;
        while (resp.status >= 300 && resp.status < 400 && hops < 4) {
          const loc = resp.headers.get('Location');
          if (!loc) break;
          resp = await fetch(loc, {
            method: 'POST',
            headers: fwdHeaders,
            body: raw,
            redirect: 'manual',
          });
          hops++;
        }

        // (ออปชัน) log ช่วยดีบัก
        // console.log('Forwarded to Apps Script, status:', resp.status);
      } catch (err) {
        // console.error('Forward error:', err);
      }
    })());

    // ตอบ LINE ทันที เพื่อไม่ให้ timeout
    return new Response('OK', { status: 200 });
  }
};
