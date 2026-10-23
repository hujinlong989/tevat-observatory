/* ============================================================
   调试入口白名单：判断当前环境是否允许「跳过密码门直达关卡/终局」
   —— 独立成文件，便于在 Node 里直接单测（不需要起浏览器）
   —— 规则：只认回环地址与内网 IP 字面量；任何公网域名都进不来
   —— hostname 允许被覆盖（window.__HOST_OVERRIDE），用于自动化测试
      模拟"部署到公网域名"的行为；正常访问时无人覆盖，等价于 location.hostname
   ============================================================ */

/* 注意：内网段必须写成「完整 IP 字面量」并带数字边界。
   早期写法是前缀匹配 /^...|10\.|192\.168\./，
   会把 10.example.com / 192.168.example.com 这类公网域名误判成内网，
   从而在生产环境开启调试直达（可跳过前面的关卡直达终局）。已修正。 */
function isLocalDevHost(hostname) {
  if (!hostname) return false;
  const h = String(hostname).trim().toLowerCase();
  // 回环：localhost / 127.0.0.1 / [::1]
  if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1') return true;
  // 私有网段：必须是 4 段十进制数字，不允许再跟任何域名后缀
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some(n => n > 255)) return false;
  if (o[0] === 10) return true;                                  // 10.0.0.0/8
  if (o[0] === 192 && o[1] === 168) return true;                 // 192.168.0.0/16
  return false;
}

/** 取当前生效的 hostname（测试可覆盖） */
function currentHost() {
  if (typeof window !== 'undefined' && window.__HOST_OVERRIDE) return window.__HOST_OVERRIDE;
  return (typeof location !== 'undefined') ? location.hostname : '';
}

if (typeof window !== 'undefined') {
  window.__isLocalDevHost = isLocalDevHost;
  window.__currentHost = currentHost;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { isLocalDevHost, currentHost };
