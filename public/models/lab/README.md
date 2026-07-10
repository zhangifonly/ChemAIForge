# 3D 实验器材模型放置说明

把下载的 glTF/glb 模型放在这里，文件名按下表命名，前端会自动加载。

## 命名约定（前端按这些路径加载）

| 文件名 | 用途 | 建议 |
|--------|------|------|
| `test-tube.glb` | 试管 | 竖直、原点在底部、约 0.15m 直径 |
| `beaker.glb` | 烧杯 | 同上比例 |
| `erlenmeyer-flask.glb` | 锥形瓶 | |
| `tube-rack.glb` | 试管架 | 木质 |
| `bench.glb`（可选） | 实验台桌面 | 不放则用程序化台面 |

## 要求
- 格式：`.glb`（二进制 glTF，单文件，含 PBR 贴图）优先；`.gltf`+贴图也可（同目录）
- 玻璃部分材质名含 "glass" 时，前端会自动识别并增强透明/折射（见 GltfModel.tsx）
- 模型无需手工调缩放/朝向：GltfModel 的 auto-fit 会按 `fit` 参数自动归一化
  （缩放到目标高度、XZ 居中、底面落地、可选 Z-up→Y-up 立起）
- 单模型建议 < 5MB，可用 Draco 压缩
- 授权：仅放 CC0 / CC-BY / 已购买可商用 的模型；CC-BY 请在 CREDITS.md 注明作者

## 已放置模型
- `beaker.glb` — Sketchfab「Glass Beaker」(tumble3D) — CC-BY 4.0 — 用于铁置换硫酸铜（实为锥形瓶造型）
- `tube-rack.glb` — Sketchfab「Test Tube Rack」(Harry Bond) — CC-BY 4.0 — 备用，后续接入

详细署名见 CREDITS.md。
