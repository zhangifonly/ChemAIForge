"use client";

// 锥形瓶（250 mL）+ 瓶内待测液：酚酞粉红深度由 pink(0~1) 驱动。
// 摇动时整瓶轻微倾摆且液面晃动，模拟"边滴边摇"的真实操作。
// 坐标：y=0 为瓶底，瓶口约 y=1.28。
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, MeshStandardMaterial } from "three";
import { Color, MathUtils } from "three";

// 液面几何量放在 model.ts（可单测），此处只做呈现并转出，便于场景侧单点引用
import { FLASK_MOUTH_Y, FLASK_LIQUID_TOP } from "./model";
export { FLASK_MOUTH_Y, FLASK_LIQUID_TOP, flaskLevelY } from "./model";

// 玻璃：适度不透明 + 较强环境反射，保证薄壁容器在浅色背景下仍有清晰轮廓。
// transmission 过高会让锥形瓶"消失"，故压到 0.45 并靠 clearcoat 提亮边缘高光。
const glassMat = (
  <meshPhysicalMaterial
    color="#e8f3fb"
    transparent
    opacity={0.42}
    roughness={0.06}
    metalness={0.02}
    transmission={0.45}
    thickness={0.6}
    ior={1.47}
    clearcoat={1}
    clearcoatRoughness={0.05}
    side={2}
    depthWrite={false}
  />
);

/** 瓶内液体：颜色在无色与酚酞粉红之间按 pink 插值；摇动时液面轻摆 */
function FlaskLiquid({ pink, swirl, levelY }: { pink: number; swirl: boolean; levelY: number }) {
  const mat = useRef<MeshStandardMaterial>(null);
  const surfMat = useRef<MeshStandardMaterial>(null);
  const grp = useRef<Group>(null);
  const clear = useRef(new Color("#eaf2f8"));
  // 酚酞在碱性中呈淡紫红（品红偏紫），不是荧光洋红；滴定初期更接近浅玫红
  const rose = useRef(new Color("#d98ab0"));
  const t = useRef(0);

  useFrame((_, dt) => {
    t.current += dt;
    if (mat.current) {
      const target = clear.current.clone().lerp(rose.current, Math.min(1, pink));
      mat.current.color.lerp(target, Math.min(1, dt * 6));
      // 自发光压低：溶液是被照亮的，不该自己发光（过强会显得像荧光染料）
      mat.current.emissive.copy(mat.current.color);
      mat.current.emissiveIntensity = 0.06 + pink * 0.1;
      mat.current.opacity = MathUtils.lerp(mat.current.opacity, 0.72 + pink * 0.14, Math.min(1, dt * 5));
      // 液面比液柱略深一点（视线穿过的液层更厚），但同色系，避免出现色块断层
      if (surfMat.current) {
        surfMat.current.color.copy(mat.current.color).multiplyScalar(0.94);
      }
    }
    if (grp.current) {
      // 摇动：液面绕两轴小幅倾斜
      const amp = swirl ? 0.09 : 0;
      grp.current.rotation.z = MathUtils.lerp(grp.current.rotation.z, Math.sin(t.current * 7) * amp, 0.3);
      grp.current.rotation.x = MathUtils.lerp(grp.current.rotation.x, Math.cos(t.current * 7) * amp, 0.3);
    }
  });

  // 瓶身为圆锥台（底 r=0.62 → 颈 r=0.19），液面处半径按高度插值；
  // 再内收 0.035 让液体确实待在玻璃内壁之内，而不是贴着轮廓看似溢出。
  const rAt = (y: number) => MathUtils.lerp(0.585, 0.175, Math.min(1, y / 1.1)) - 0.075;
  const rTop = rAt(levelY);
  return (
    <group ref={grp} position={[0, 0.018, 0]}>
      {/* 液柱侧壁：顶端开口，顶面交给下面的液面片，避免两面共面产生 z-fighting 条纹 */}
      <mesh position={[0, levelY / 2, 0]}>
        <cylinderGeometry args={[rTop, rAt(0), levelY, 44, 1, true]} />
        <meshStandardMaterial
          ref={mat}
          color="#eaf2f8"
          transparent
          opacity={0.68}
          roughness={0.12}
          side={2}
        />
      </mesh>
      {/* 液面：颜色跟随主体色平滑插值，避免阈值切换出现硬边 */}
      <mesh position={[0, levelY - 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[rTop, 44]} />
        <meshStandardMaterial
          ref={surfMat}
          color="#dce9f2"
          transparent
          opacity={0.9}
          roughness={0.05}
          metalness={0.15}
        />
      </mesh>
    </group>
  );
}

/** 锥形瓶玻璃本体：锥形瓶身 + 细颈 + 外翻瓶口 + 磨砂标签区 */
export function Flask({
  pink,
  swirl,
  levelY = FLASK_LIQUID_TOP,
  hasLiquid = true,
}: {
  pink: number;
  swirl: boolean;
  levelY?: number;
  hasLiquid?: boolean;
}) {
  const grp = useRef<Group>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    if (!grp.current) return;
    // 摇瓶：整瓶绕底部小幅画圈
    const amp = swirl ? 0.05 : 0;
    grp.current.rotation.z = MathUtils.lerp(grp.current.rotation.z, Math.sin(t.current * 7) * amp, 0.25);
    grp.current.position.x = MathUtils.lerp(grp.current.position.x, Math.sin(t.current * 7) * amp * 0.5, 0.25);
  });
  return (
    <group ref={grp}>
      {/* 瓶身圆锥台 */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.19, 0.62, 1.1, 48, 1, true]} />
        {glassMat}
      </mesh>
      {/* 瓶底 */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.62, 48]} />
        {glassMat}
      </mesh>
      {/* 瓶颈 */}
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.3, 32, 1, true]} />
        {glassMat}
      </mesh>
      {/* 外翻瓶口 */}
      <mesh position={[0, FLASK_MOUTH_Y + 0.07, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.022, 12, 40]} />
        <meshStandardMaterial color="#e9f3ff" roughness={0.18} metalness={0.15} transparent opacity={0.9} />
      </mesh>
      {/* 磨砂标签区（真实锥形瓶特征） */}
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.283, 0.315, 0.3, 40, 1, true]} />
        <meshStandardMaterial color="#f2f6f8" roughness={0.95} transparent opacity={0.32} side={2} depthWrite={false} />
      </mesh>
      {hasLiquid && <FlaskLiquid pink={pink} swirl={swirl} levelY={levelY} />}
    </group>
  );
}
