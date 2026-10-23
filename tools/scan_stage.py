# -*- coding: utf-8 -*-
"""
发布前扫描：暂存目录里不能出现个人版痕迹、机器路径、凭据。
命中即 FAIL，退出码 1。

扫描分两层：
  A) 全文扫描 —— 个人字符串、本机路径、凭据（含 vendor/）
  B) 非 vendor 扫描 —— 数字型个人标记（日期 / 站点 ID）
     理由：three.min.js 里 RGBFormat 的常量就是 1022，裸 4 位数字在压缩库里必撞，
     所以数字标记只在日期形态（10/22、10-22、10.22、10月22）下判定。
"""
import os, re, sys

STAGE = r"E:\xxjz\_deploy_tevat"

# A 层：个人字符串（任何文件都查）
PERSONAL_STR = [
    "虾虾家族", "爱你的老公", "亲爱的", "生日快乐",
    "胡金龙", "大米饭", "二孩老爹", "生日网站",
    "胡工", "hugong", "HuGong",
]

# A 层：本机路径 / 内部标识
LOCALPATH = [
    "E:\\xxjz", "E:/xxjz", "C:\\Users\\OSANN", "osann",
    "tevat-archive", "localhost:8899", "localhost:8900", "localhost:8901",
    "192.168.91.240", "192.168.70.32",
]

# A 层：凭据
SECRET = [
    r"ak_[0-9a-f]{16,}", r"ghp_[0-9A-Za-z]{20,}", r"gho_[0-9A-Za-z]{20,}",
    r"sk-[0-9A-Za-z]{20,}", r"glpat-[0-9A-Za-z\-_]{20,}",
    r"password\s*=\s*['\"][^'\"]{6,}", r"api[_-]?key\s*=\s*['\"][^'\"]{8,}",
    r"secret\s*=\s*['\"][^'\"]{8,}", r"Bearer\s+[0-9A-Za-z\-_\.]{20,}",
]

# B 层：数字型个人标记（仅非 vendor，且日期形态）
DATE_PATTERNS = [
    (r"10[./\-年]0?22", "10/22（个人生日）"),
    (r"0?5[./\-年]0?22", "05/22（个人生日）"),
    (r"527619", "站点 ID 527619"),
    (r"\b1986\b", "年份 1986"),
]

SKIP_EXT = {".ttf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".woff", ".woff2", ".ico"}
VENDOR_DIRS = {"vendor"}

hits = []
scanned_all = 0
scanned_b = 0

for dirpath, dirnames, filenames in os.walk(STAGE):
    rel_dir = os.path.relpath(dirpath, STAGE)
    is_vendor = any(part in VENDOR_DIRS for part in rel_dir.split(os.sep))
    for fn in filenames:
        p = os.path.join(dirpath, fn)
        rel = os.path.relpath(p, STAGE)
        ext = os.path.splitext(fn)[1].lower()
        if ext in SKIP_EXT:
            continue
        try:
            txt = open(p, encoding="utf-8").read()
        except Exception:
            continue
        scanned_all += 1
        for kw in PERSONAL_STR:
            if kw in txt:
                hits.append(("个人痕迹", kw, rel))
        for kw in LOCALPATH:
            if kw in txt:
                hits.append(("本机路径", kw, rel))
        for pat in SECRET:
            for m in re.finditer(pat, txt, re.I):
                hits.append(("凭据", m.group(0)[:40], rel))
        if not is_vendor:
            scanned_b += 1
            for pat, label in DATE_PATTERNS:
                for m in re.finditer(pat, txt):
                    hits.append(("个人数字", m.group(0), rel))

print("全文扫描 %d 个文本文件；其中非 vendor %d 个做了数字型日期检查" % (scanned_all, scanned_b))
if hits:
    print("\n!! 命中 %d 处，发布终止:" % len(hits))
    for kind, kw, rel in hits:
        print("   [%s] %r  <-  %s" % (kind, kw, rel))
    sys.exit(1)
print("✓ 未发现个人痕迹 / 本机路径 / 凭据")
