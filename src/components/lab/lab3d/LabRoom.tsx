"use client";

// 实验室环境：瓷砖墙、墙前试剂搁板（瓶签写本实验真实试剂名）、台面后方的背景器皿。
//
// 为什么要这一层：原先 3D 场景只有一张米色平面加一面灰墙，器皿孤零零立在中间，
// 看不出这是一张实验台 —— 专业虚拟实验软件的"在实验室里"的感觉，一大半来自环境。
// 所有场景都经 LabBench 引入本组件，改这一处 501 个实验的 3D 视图一起受益。
// 贴图全部用 Canvas 程序化生成：不依赖外网资源，也不增加静态文件体积。
import { createContext, useContext, useEffect, useMemo } from "react";
import * as THREE from "three";
import { resolveSubstance } from "../reagents";

/**
 * 本实验的试剂名，供搁板上的试剂瓶贴瓶签。
 * 用 Context 而不是逐层传 prop：11 个手写场景各自调用 LabBench，
 * 一个个加参数既散又容易漏。Provider 放在 Canvas 内部，同一 reconciler 里可正常传递。
 */
export const BenchLabelsContext = createContext<string[]>([]);

/**
 * 瓶签上印的名字（中文名 → 当前语言译名）。
 *
 * 与 BenchLabelsContext 分开：瓶子的棕色避光判定（AMBER）与色带类别都按中文名
 * 匹配，那是化学属性、不随语言变；只有印在瓶签上的字要换成学生读得懂的。
 */
export const BenchTermsContext = createContext<Record<string, string> | null>(null);

/** 搁板最多摆几瓶：再多瓶签字号就小到看不清 */
const MAX_BOTTLES = 5;

// 见光易分解、按规范须装棕色瓶的试剂（硝酸银、硝酸、高锰酸钾、双氧水、氯水、溴水…）。
// 硝酸只匹配以「硝酸」结尾的名字：硝酸钠、硝酸钾是稳定的盐，不需要避光。
const AMBER = /硝酸银|硝酸$|高锰酸钾|过氧化氢|双氧水|氯水|溴水|碘水|碘酒/;

export function LabRoom() {
  const labels = useContext(BenchLabelsContext).slice(0, MAX_BOTTLES);
  return (
    <group>
      <TiledWall />
      {/* 没有试剂名时不摆空搁板：一块空板比没有更显得"缺了什么" */}
      {labels.length > 0 && <WallShelf labels={labels} />}
      <BackGlassware />
    </group>
  );
}

// 墙面尺寸：滴定台为装下 1 米多高的滴定管把镜头拉到约 10 个单位远，
// 16 宽的墙在那个视距下左右两侧会露出墙边，故取 32×14
const WALL_W = 32;
const WALL_H = 14;

// 瓷砖墙：实验室墙面的通行做法（耐腐蚀、易清洗），替代原先的纯灰平面
function TiledWall() {
  const tex = useDisposable(() => {
    const t = makeTileTexture();
    // 一个图块 4 块砖、边长 1.2 → 每块砖 0.3，和台面上器皿的尺度相称
    t.repeat.set(WALL_W / 1.2, WALL_H / 1.2);
    return t;
  }, []);
  return (
    <mesh position={[0, WALL_H / 2 - 1.5, -3.2]} receiveShadow>
      <planeGeometry args={[WALL_W, WALL_H]} />
      <meshStandardMaterial map={tex} roughness={0.55} metalness={0} />
    </mesh>
  );
}

/**
 * 台面靠墙处的试剂瓶：瓶签写本实验的试剂名，学生能看出台上用的东西从哪来。
 * 偏置到左侧而不是居中：搁板横跨器皿正上方，滴定台那种竖高装置（滴定管连旋塞）
 * 会被它从中间切断，提示气泡也压在板后。竖直方向躲不开——装置高过任何合理的
 * 搁板高度——只能横向让开，备用器皿因此统一摆到右侧。
 */
function WallShelf({ labels }: { labels: string[] }) {
  // 试剂瓶直接摆在台面靠墙处，不做悬挂搁板。
  //
  // 试过 1.35 和 2.1 两个悬挂高度，都不成立：低了被量热计一类的大器皿挡掉半截瓶签，
  // 高了又顶出画面 —— 通用场景的镜头只有 2.8 远、fov 42，竖直视野本就装不下墙上的东西，
  // 而 501 个实验的装置高度从试管到滴定管跨了一个数量级，不存在一个通吃的高度。
  // 摆在台面上则只需横向让开主装置（|x|<1.6），各种取景下都能看到。
  const y = 0;
  // -3.1：量热计这类大器皿在近景镜头下轮廓能盖到 x≈-1.5，再靠内的瓶子会被挡掉
  const x = -3.1;
  const z = -2.5;
  const gap = 0.52;
  const x0 = x - ((labels.length - 1) * gap) / 2;
  return (
    <group>
      {/* 白瓷托盘：试剂瓶集中摆放的常规做法，也给深色台面一块浅底衬出瓶身 */}
      <mesh position={[x, y + 0.015, z]} receiveShadow>
        <boxGeometry args={[labels.length * gap + 0.5, 0.03, 0.5]} />
        <meshStandardMaterial color="#e6e8e4" roughness={0.6} />
      </mesh>
      {labels.map((label, i) => (
        <ReagentBottle key={`${i}-${label}`} label={label} position={[x0 + i * gap, y + 0.03, z]} />
      ))}
    </group>
  );
}

/** 细口试剂瓶：玻璃瓶身 + 瓶签 + 瓶塞。见光易分解的试剂用棕色瓶 */
function ReagentBottle({
  label,
  position,
}: {
  label: string;
  position: [number, number, number];
}) {
  const terms = useContext(BenchTermsContext);
  const printed = terms?.[label] ?? label;
  // 纹理按"印出来的字 + 类别键"缓存：换语言时要重画，但类别色仍按中文名判定
  const tex = useDisposable(() => makeLabelTexture(printed, label), [printed, label]);
  const amber = AMBER.test(label);
  // 尺寸比真实 500 mL 试剂瓶略大：搁板离镜头约 6 个单位，按真实比例瓶签字小到读不出
  const r = 0.18;
  // 瓶签只包瓶身正面约 110°：整圈包裹时从正面看文字两端会卷到背面去
  const arc = 1.9;
  return (
    <group position={position}>
      <mesh position={[0, 0.26, 0]} castShadow>
        <cylinderGeometry args={[r, r, 0.52, 32]} />
        <meshPhysicalMaterial
          color={amber ? "#7a4a1c" : "#e8f1f6"}
          transparent
          opacity={amber ? 0.85 : 0.45}
          roughness={0.12}
          transmission={amber ? 0.2 : 0.6}
          ior={1.45}
        />
      </mesh>
      {/* 瓶签：略大于瓶身半径，避免与玻璃面 z-fighting 闪烁 */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[r * 1.015, r * 1.015, 0.28, 32, 1, true, -arc / 2, arc]} />
        <meshStandardMaterial map={tex} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      {/* 瓶肩 + 瓶颈 + 磨口瓶塞 */}
      <mesh position={[0, 0.56, 0]} castShadow>
        <cylinderGeometry args={[0.07, r, 0.08, 32]} />
        <meshPhysicalMaterial color={amber ? "#7a4a1c" : "#e8f1f6"} transparent opacity={0.6} roughness={0.12} />
      </mesh>
      <mesh position={[0, 0.645, 0]} castShadow>
        <cylinderGeometry args={[0.065, 0.06, 0.1, 24]} />
        <meshStandardMaterial color="#f2f2ee" roughness={0.3} />
      </mesh>
    </group>
  );
}

/**
 * 台面靠墙处的备用器皿：量筒 + 容量瓶，摆在右侧。
 * 与左侧的试剂瓶分居两边，都贴着墙根（z≈-2.5）：主装置（含集气瓶、导气管等
 * 附属装置）都在 |x|<1.6 以内，这样既给出纵深层次，又不会挡住看点。
 */
function BackGlassware() {
  const glass = (
    <meshPhysicalMaterial
      color="#eef7ff"
      transparent
      opacity={0.25}
      roughness={0.07}
      transmission={0.7}
      ior={1.3}
      depthWrite={false}
    />
  );
  return (
    <group>
      {/* 量筒：六角底座 + 细长筒身 + 刻度环 */}
      <group position={[2.0, 0, -2.5]}>
        <mesh position={[0, 0.02, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.22, 0.04, 6]} />
          {glass}
        </mesh>
        <mesh position={[0, 0.62, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 1.16, 32, 1, true]} />
          {glass}
        </mesh>
        {[0.3, 0.5, 0.7, 0.9, 1.1].map((h) => (
          <mesh key={h} position={[0, h, 0]}>
            <torusGeometry args={[0.092, 0.003, 6, 32]} />
            <meshBasicMaterial color="#6b7a86" />
          </mesh>
        ))}
      </group>
      {/* 容量瓶：平底 + 梨形瓶身 + 细长瓶颈 + 刻度线 + 塞子。
          瓶身不能用贴地的正球：球心必须抬到半径高度，否则下半球陷进台面 ——
          深色台面上看起来就只剩一根瓶颈。真容量瓶也是平底的（要能立住）。 */}
      <group position={[2.8, 0, -2.5]}>
        <mesh position={[0, 0.01, 0]} castShadow>
          <cylinderGeometry args={[0.17, 0.19, 0.02, 32]} />
          {glass}
        </mesh>
        <mesh position={[0, 0.27, 0]} castShadow scale={[1, 0.95, 1]}>
          <sphereGeometry args={[0.25, 32, 24]} />
          {glass}
        </mesh>
        {/* 瓶身赤道圈：纯透明玻璃在深色台面上几乎没有轮廓，量筒靠刻度环才看得出形状，
            容量瓶同样需要一条实线勾边，否则只剩瓶颈和塞子悬在空中 */}
        <mesh position={[0, 0.27, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.249, 0.004, 6, 40]} />
          <meshBasicMaterial color="#8794a0" />
        </mesh>
        <mesh position={[0, 0.74, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 0.44, 24, 1, true]} />
          {glass}
        </mesh>
        {/* 刻度线：容量瓶的定容线，刻在瓶颈中部 */}
        <mesh position={[0, 0.8, 0]}>
          <torusGeometry args={[0.047, 0.004, 6, 24]} />
          <meshBasicMaterial color="#6b7a86" />
        </mesh>
        <mesh position={[0, 0.99, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.048, 0.09, 20]} />
          <meshStandardMaterial color="#f2f2ee" roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

/** 白瓷砖贴图：一块 4×4 砖的图块，按墙面尺寸平铺 */
function makeTileTexture(): THREE.CanvasTexture {
  const size = 512;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#cfd7dd"; // 灰缝
  ctx.fillRect(0, 0, size, size);
  const n = 4;
  const cell = size / n;
  const gap = 5;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // 每块砖亮度略有起伏：完全一致的砖面看起来像印刷品而不是瓷砖
      const l = 94 + ((i * 7 + j * 3) % 4);
      ctx.fillStyle = `hsl(205 18% ${l}%)`;
      ctx.fillRect(i * cell + gap / 2, j * cell + gap / 2, cell - gap, cell - gap);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 瓶签贴图：白底、顶部色带、中文试剂名。
 * 色带沿用试剂柜的常见分类色（酸红、碱蓝、其余绿），扫一眼能分出类别。
 */
function makeLabelTexture(text: string, categoryKey: string = text): THREE.CanvasTexture {
  const w = 256;
  const h = 160;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#fbfaf6";
  ctx.fillRect(0, 0, w, h);
  // 按解析出的物质类别取色，不按字面：「碳酸钠」名字里有"酸"，但它是盐
  const category = resolveSubstance(categoryKey).category;
  ctx.fillStyle = category === "acid" ? "#d9534f" : category === "base" ? "#3b7dd8" : "#2f9e6e";
  ctx.fillRect(0, 0, w, 26);
  ctx.fillStyle = "#1f2933";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // 名字长时缩小字号，保证整名落在瓶签内而不是被截断
  // 字号按实测宽度缩放而不是按字数分档：「盐酸」两个字，
  // 「Salzsäure」九个字母，「حمض الهيدروكلوريك」更长 —— 按字数算会一律缩到看不清。
  // 从大号开始量，放不下再缩，最小 20px；超长的再允许折成两行
  const font = (px: number) =>
    `600 ${px}px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Noto Sans",sans-serif`;
  const maxW = w - 16;
  let size = 54;
  ctx.font = font(size);
  while (size > 20 && ctx.measureText(text).width > maxW) ctx.font = font((size -= 2));
  const midY = 26 + (h - 26) / 2;
  if (ctx.measureText(text).width <= maxW) {
    ctx.fillText(text, w / 2, midY);
  } else {
    // 折两行：在最接近中点的空格处断开，没有空格（如长复合词）就硬截断
    const cut = text.lastIndexOf(" ", Math.ceil(text.length / 2)) ;
    const at = cut > 0 ? cut : Math.ceil(text.length / 2);
    ctx.fillText(text.slice(0, at).trim(), w / 2, midY - size * 0.55, maxW);
    ctx.fillText(text.slice(at).trim(), w / 2, midY + size * 0.55, maxW);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 释放 Canvas 贴图：场景随实验切换反复挂载，不释放会持续占用显存 */
function useDisposable<T extends { dispose: () => void }>(make: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(make, deps);
  useEffect(() => () => value.dispose(), [value]);
  return value;
}
