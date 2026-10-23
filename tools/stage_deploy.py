# -*- coding: utf-8 -*-
"""
发布暂存：把要上公网的静态文件复制到独立暂存目录。

只拷贝站点运行必需的目录，不带 _dev / tools / docs / .gitignore，
避免把开发中间物和开发脚本暴露到公网。

用法：python tools/stage_deploy.py
输出：E:\\xxjz\\_deploy_tevat
"""
import os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGE = r"E:\xxjz\_deploy_tevat"

# 要上公网的目录 / 文件
DIRS = ["css", "js", "assets", "vendor"]
FILES = ["index.html"]


def main():
    if os.path.exists(STAGE):
        shutil.rmtree(STAGE)
    os.makedirs(STAGE)

    total = 0
    for d in DIRS:
        src = os.path.join(ROOT, d)
        if not os.path.isdir(src):
            print("跳过（不存在）:", d)
            continue
        for dirpath, dirnames, filenames in os.walk(src):
            rel = os.path.relpath(dirpath, ROOT)
            out = os.path.join(STAGE, rel)
            os.makedirs(out, exist_ok=True)
            for fn in filenames:
                s = os.path.join(dirpath, fn)
                shutil.copy2(s, os.path.join(out, fn))
                total += os.path.getsize(s)

    for f in FILES:
        s = os.path.join(ROOT, f)
        if os.path.exists(s):
            shutil.copy2(s, os.path.join(STAGE, f))
            total += os.path.getsize(s)

    print("暂存完成: %s" % STAGE)
    print("合计: %.1f KB / %d 个文件" % (total / 1024, sum(len(fs) for _, _, fs in os.walk(STAGE))))

    # 生产版钉死：禁用调试直达
    # （公网域名理论上不该命中本地白名单，但这是发布到开放互联网的东西，多钉一道）
    idx = os.path.join(STAGE, "index.html")
    s = open(idx, encoding="utf-8").read()
    old = "const localDev = isLocalDevHost(currentHost());"
    new = "const localDev = false;  // 生产部署版：禁用调试直达"
    if old not in s:
        print("!! 未找到 localDev 赋值行，index.html 结构可能变了，终止发布")
        sys.exit(1)
    s = s.replace(old, new)
    open(idx, "w", encoding="utf-8").write(s)
    print("已关闭调试直达（生产版）")

    # 自检：暂存目录里不该出现任何开发中间物
    bad = []
    for dirpath, dirnames, filenames in os.walk(STAGE):
        for fn in filenames:
            if fn.endswith(".bak") or fn.startswith(".") or fn.endswith(".py"):
                bad.append(os.path.join(dirpath, fn))
        for dn in list(dirnames):
            if dn in ("_dev", "tools", "docs", ".git", "node_modules"):
                bad.append(os.path.join(dirpath, dn))
    if bad:
        print("!! 暂存目录混入了不该发布的内容:")
        for b in bad:
            print("   ", b)
        sys.exit(1)
    print("自检通过：无开发中间物")


if __name__ == "__main__":
    main()
