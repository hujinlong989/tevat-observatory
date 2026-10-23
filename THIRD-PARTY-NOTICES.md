# 三方组件与素材声明

本文件说明本仓库中**不属于 MIT License 覆盖范围**的组件与素材。
仓库根目录的 [LICENSE](LICENSE) 只适用于源代码。

---

## 1. 字体

### Press Start 2P — `assets/fonts/PressStart2P.ttf`

- 用途：拉丁字符 / 数字 / 状态栏等单色终端文字
- 作者：CodeMan38
- 授权：SIL Open Font License, Version 1.1
- 来源：<https://fonts.google.com/specimen/Press+Start+2P>
- 说明：按 OFL 要求原样分发，未做修改

### Fusion Pixel Font（缝合像素字体） — `assets/fonts/fusion-pixel-subset.ttf`

- 用途：中文像素字体（12px 网格，与拉丁像素字体混排）
- 作者：TakWolf
- 授权：SIL Open Font License, Version 1.1
- 来源：<https://github.com/TakWolf/fusion-pixel-font>
- 许可证全文：`assets/fonts/OFL-FusionPixel.txt`
- **本仓库中的文件是从上游 12px proportional zh-Hans 版本裁剪出的子集**
  - 裁剪方式：`tools/build_font_subset.py`（fontTools subset），仅保留站点实际用到的字符
  - 子集字体已改名族名为 `Fusion Pixel Subset`，PostScript 名为 `FusionPixelSubset-Regular`
  - 改名原因：明确标注这是衍生版本。上游未声明 Reserved Font Name，改名是额外的谨慎处理
  - 许可证与版权声明已写入字体的 name 表（nameID 0 与 13），随文件一同分发
  - 重建方式：下载上游 `fusion-pixel-font-12px-proportional-zh_hans.ttf`，放到
    `_dev/fusion/` 后运行 `python tools/build_font_subset.py`

> Fusion Pixel Font 本身融合了多个开源点阵字体（Ark Pixel、Cubic 11、Galmuri 等），
> 上游仓库内附有各自的许可证，位于其发行包的 `LICENSES/` 目录。

---

## 2. 角色立绘

`assets/sprite/*.png`

- 六张透明背景 PNG，为 **AI 生成的原创 8-bit 像素画**
- 生成方式：以角色的**外形特征描述**（发型、服饰、配色、气质）为提示词生成，
  未使用游戏名称、未使用任何官方素材作为输入，也未做抠图 / 描摹 / 改绘
- 未经官方授权，仅用于非商业同人创作

---

## 3. 运行时库

### three.js — `vendor/three.min.js`

- 用途：终局星空、角色立绘漂浮、粒子烟花
- 作者：mrdoob / three.js contributors
- 授权：MIT
- 来源：<https://threejs.org/>

---

## 4. 音效

`js/audio.js` 中的全部音效为 **WebAudio 实时合成**（方波 / 三角波振荡器 + 包络），
不包含任何来自游戏的音频采样文件。

---

## 5. 免责声明

本项目是**非官方的同人 / 致敬作品**，与 miHoYo / 米哈游及《原神》官方无任何关联、
未经其授权或认可。

《原神》相关角色名称、设定、美术与相关知识产权归 miHoYo / 米哈游所有。
本仓库仅用于技术学习与非商业同人创作，请勿用于商业用途。
