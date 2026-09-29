import crypto from 'node:crypto';

// 测试账号口令从环境变量读取（不要提交口令字面量到仓库）
if (!process.env.E2E_PASS) { console.error('[e2e] 未设置 E2E_PASS 环境变量（测试账号口令）'); process.exit(2) }
const BASE = 'http://127.0.0.1:18322';
const out = {};
const login = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'cptest', password: process.env.E2E_PASS }) }).then(r => r.json());
const T = login.data.token, H = { Authorization: 'Bearer ' + T };
out.tokenUid = JSON.parse(atob(T.split('.')[1])).uid;

async function upload(name, buf, type = 'application/octet-stream') {
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  const init = await fetch(BASE + '/api/upload/init', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ policyId: 11, parent: '', name, size: buf.length, hash, chunkSize: buf.length }) }).then(r => r.json());
  if (!init.data.instant) {
    const sid = init.data.sessionId;
    await fetch(`${BASE}/api/upload/chunk/${sid}/0`, { method: 'PUT', headers: H, body: buf });
    await fetch(BASE + '/api/upload/complete', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: sid }) });
  }
}
// 1) 存储型 XSS 载体：HTML + SVG
const html = Buffer.from('<html><body><script>alert(document.cookie)<\/script><h1>xss</h1></body></html>');
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="10" height="10"/></svg>');
await upload('attack.html', html, 'text/html');
await upload('attack.svg', svg, 'image/svg+xml');
const r1 = await fetch(BASE + '/api/fs/raw?policyId=11&path=%2Fattack.html&t=' + T);
out.rawHtml = { status: r1.status, contentType: r1.headers.get('content-type'), disposition: r1.headers.get('content-disposition'), csp: (r1.headers.get('content-security-policy') || '').slice(0, 60), nosniff: r1.headers.get('x-content-type-options') };
const r2 = await fetch(BASE + '/api/fs/raw?policyId=11&path=%2Fattack.svg&t=' + T);
out.rawSvg = { contentType: r2.headers.get('content-type'), disposition: r2.headers.get('content-disposition') };
// SVG 里能否执行脚本：内嵌为 img 无法执行；直接导航时看 CSP script-src
const r3 = await fetch(BASE + '/api/fs/text?policyId=11&path=%2Fattack.html&t=' + T);
out.rawTextHtml = { contentType: r3.headers.get('content-type'), bodyHead: (await r3.text()).slice(0, 60) };

// 2) 路径穿越
const tv = [];
for (const p of ['..%2F..%2F..%2Fetc%2Fpasswd', '%2e%2e%2fadmin%2fx', '/..%2f..%2fsecret.key', '....//....//x']) {
  const rr = await fetch(BASE + `/api/fs/raw?policyId=11&path=${p}&t=` + T);
  tv.push({ p, status: rr.status, ct: (rr.headers.get('content-type') || '').slice(0, 30) });
}
out.traversal = tv;

// 3) 越权：admin 接口
const a1 = await fetch(BASE + '/api/admin/users?page=1&size=5', { headers: H });
out.adminApi = a1.status;
const a2 = await fetch(BASE + '/api/admin/settings', { headers: H });
out.adminSettings = a2.status;

// 4) JWT 篡改
const parts = T.split('.');
const tampered = parts[0] + '.' + Buffer.from(JSON.stringify({ uid: 1, role: 'admin', ver: 0, exp: 9999999999 })).toString('base64url') + '.' + parts[2];
const t1 = await fetch(BASE + '/api/auth/me', { headers: { Authorization: 'Bearer ' + tampered } });
out.jwtTampered = t1.status;

// 5) CORS
const c1 = await fetch(BASE + '/api/site/public');
out.cors = c1.headers.get('access-control-allow-origin');

// 6) 跨用户隔离：尝试访问 admin 的目录
const iso = await fetch(BASE + '/api/fs/list?policyId=2&path=' + encodeURIComponent('/../admin') + '&t=' + T).then(r => r.json());
out.isolationProbe = { code: iso.code, msg: (iso.msg || '').slice(0, 40), count: iso.data ? (iso.data.items || []).length : -1 };

// 7) 离线下载 SSRF（内网地址）
const o1 = await fetch(BASE + '/api/offline', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'http://127.0.0.1:18322/api/site/public', policyId: 11, dest: '/' }) }).then(r => r.json());
out.offlineInternal = { code: o1.code, msg: (o1.msg || '').slice(0, 60) };
const o2 = await fetch(BASE + '/api/offline', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'http://169.254.169.254/latest/meta-data/', policyId: 11, dest: '/' }) }).then(r => r.json());
out.offlineMetadata = { code: o2.code, msg: (o2.msg || '').slice(0, 60) };

console.log(JSON.stringify(out, null, 1));
