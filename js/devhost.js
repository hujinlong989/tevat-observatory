/* ============================================================
   调试入口白名单：判断当前环境是否允许「跳过密码门直达关卡/终局」
   —— 独立成文件，便于在 Node 里直接单测（不需要起浏览器）
   —— 规则：只认回环地址与内网段；任何公网域名都进不来
   —— hostname 允许被覆盖（window.__HOST_OVERRIDE），用于自动化测试
      模拟"部署到公网域名"的行为；正常访问时无人覆盖，等价于 location.hostname
   ============================================================ */
function isLocalDevHost(hostname) {
  if (!hostname) return false;
  return /^(localhost|127\.0\.0\.1|\[::1\]|192\.168\.|10\.)/.test(hostname);
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
