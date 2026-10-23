#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
生成中文像素字体子集（OFL 1.1 合规）

为什么不用 Zpix（最像素）：
  Zpix 的版权声明明确禁止「修改 / 反编译 / 转换 / 拆分」，
  连免费的个人使用档也不允许做子集。开源仓库里放一个从 Zpix 拆出来的
  字体文件属于再分发违规，所以本工程改用 SIL OFL 1.1 的 Fusion Pixel Font。

OFL 1.1 允许修改与再分发，条件：
  - 衍生版本仍然以 OFL 分发
  - 附上版权声明与许可证全文
  - 若有 Reserved Font Name，衍生版本不得使用（Fusion Pixel 未声明 RFN，
    这里仍然改名成 Fusion Pixel Subset 以示区分）
  - 字体本身不得单独售卖（本工程不售卖）

用法：python _dev/build_font_subset.py
"""
import os, glob, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEV = os.path.join(ROOT, "_dev")
SRC = os.path.join(DEV, "fusion", "fusion-pixel-12px-proportional-zh_hans.ttf")
OUT_DIR = os.path.join(ROOT, "assets", "fonts")
OUT = os.path.join(OUT_DIR, "fusion-pixel-subset.ttf")
CHARS_TXT = os.path.join(DEV, "subset_chars.txt")
NEW_FAMILY = "Fusion Pixel Subset"

# 站点用不到但常见的兜底字，避免用户改文案后缺字
FALLBACK = (
    "的一是了我不人在他有这个上们来到时大地为子中你说生国年着就那和要她出也得里后自以会家可下而过天去能对小多然于心学么之都好看起发当没成只如事把还用第样道想作种开美总从无情己面最女但现前些所同日手又行意动方期它头经长儿回位分爱老因很给名法间斯知世什两次使身者被高已亲其进此话常与活正感"
    "零一二三四五六七八九十百千万亿点号年月日時分秒元角"
    "开关上下左右前后里外中大小多少新旧高低快慢好坏真假有无能会可要应该让使"
    "请谢谢你好再见吗呢吧啊呀哦嗯哈嘿哦嘿哇喔"
    "第层关卡提示答案错误正确成功失败锁定解锁系统终端观测站密钥档案记录时间日期"
    "请输入口令点击屏幕触摸返回继续开始结束重播暂停退出关闭设置帮助关于版本"
    "角色生日名字愿望天空星星月亮太阳火焰烟花星空地图重启点亮熄灭消失出现"
    "代码开源协议许可证免责说明仓库部署构建使用说明贡献者致谢"
)


def collect_chars():
    chars = set()
    for pat in ("index.html", "js/*.js", "css/*.css"):
        for fp in glob.glob(os.path.join(ROOT, pat)):
            with open(fp, encoding="utf-8") as f:
                chars |= set(f.read())
    chars |= set(FALLBACK)
    for i in range(0x20, 0x7F):
        chars.add(chr(i))
    chars |= set("，。、；：？！“”‘’（）《》—…·　「」【】～￥°　")
    chars |= set("★☆●○◆◇▲▼■□△▽←→↑↓√×÷±")
    return "".join(sorted(c for c in chars if ord(c) > 31))


def main():
    if not os.path.exists(SRC):
        print("找不到源字体:", SRC)
        print("请先下载 Fusion Pixel Font 12px proportional zh-Hans TTF")
        sys.exit(1)

    uni = collect_chars()
    with open(CHARS_TXT, "w", encoding="utf-8") as f:
        f.write(uni)
    print("字符集:", len(uni))

    os.makedirs(OUT_DIR, exist_ok=True)
    cmd = [
        sys.executable, "-m", "fontTools.subset", SRC,
        "--text=" + uni,
        "--output-file=" + OUT,
        "--layout-features=",
        "--no-hinting",
        "--desubroutinize",
        "--name-IDs=*",
        "--drop-tables+=DSIG",
        "--recalc-bounds",
        "--notdef-outline",
        "--name-legacy",
    ]
    subprocess.run(cmd, check=True)

    # 改名：标注这是子集（OFL 未声明 RFN，改名仅为区分）
    from fontTools.ttLib import TTFont
    f = TTFont(OUT)
    name = f["name"]
    for rec in list(name.names):
        if rec.nameID in (1, 3, 4, 6, 16):
            try:
                val = rec.toUnicode()
            except Exception:
                continue
            new = val
            if rec.nameID == 1:
                new = NEW_FAMILY
            elif rec.nameID == 4:
                new = NEW_FAMILY + " Regular"
            elif rec.nameID == 6:
                new = "FusionPixelSubset-Regular"
            elif rec.nameID == 3:
                new = val + " (subset)"
            elif rec.nameID == 16:
                new = NEW_FAMILY
            name.setName(new, rec.nameID, rec.platformID, rec.platEncID, rec.langID)
    # 版权 / 许可证声明必须随字体一起分发（OFL 条件 2）
    name.setName(
        "Fusion Pixel Font (c) 2022 TakWolf. Derived subset. Licensed under SIL OFL 1.1. "
        "See assets/fonts/OFL-FusionPixel.txt.",
        0, 3, 1, 0x409)
    name.setName(
        "Fusion Pixel Font (c) 2022 TakWolf. Derived subset. Licensed under SIL OFL 1.1. "
        "See assets/fonts/OFL-FusionPixel.txt.",
        13, 3, 1, 0x409)
    f.save(OUT)
    f.close()

    kb = os.path.getsize(OUT) / 1024
    print("输出: %s (%.1f KB)" % (OUT, kb))

    # 许可证随字体一起分发
    src_ofl = os.path.join(DEV, "fusion", "OFL.txt")
    dst_ofl = os.path.join(OUT_DIR, "OFL-FusionPixel.txt")
    if os.path.exists(src_ofl):
        with open(src_ofl, encoding="utf-8") as a, open(dst_ofl, "w", encoding="utf-8") as b:
            b.write(a.read())
        print("许可证已复制:", dst_ofl)


if __name__ == "__main__":
    main()
