"use client";

// 3D 画布外壳：统一相机、灯光、程序化环境、接触阴影与 Bloom。
// 供通用实验台与滴定台共用，避免灯光参数漂移。
import { Suspense, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer, ContactShadows } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useTranslations } from "next-intl";

export interface SceneShellProps {
  children: ReactNode;
  /** 相机初始位置 */
  camera?: [number, number, number];
  /** 轨道中心 */
  target?: [number, number, number];
  /** 接触阴影所在平面高度（应贴合场景台面） */
  shadowY?: number;
  /** 是否自动旋转（精细操作场景应关闭，避免干扰拖拽） */
  autoRotate?: boolean;
  minDistance?: number;
  maxDistance?: number;
  className?: string;
  hint?: string;
  /** 触屏设备上的提示；不传则用通用的「单指旋转 · 双指缩放」 */
  hintTouch?: string;
  /** 视场角：竖高装置可增大以在有限画布内容纳全高 */
  fov?: number;
  /** 外层容器附加类名（如网格排序），与控制高度的 className 分开 */
  wrapperClassName?: string;
}

export function SceneShell({
  children,
  camera = [2.8, 2.0, 4.4],
  target = [0, 0.2, 0],
  shadowY = -0.995,
  autoRotate = true,
  minDistance = 3.5,
  maxDistance = 9,
  className = "h-[360px] sm:h-[440px] lg:h-[520px]",
  hint,
  hintTouch,
  fov = 40,
  wrapperClassName = "",
}: SceneShellProps) {
  const t = useTranslations("workbench");
  // 默认提示语在函数体内取，参数默认值处拿不到 hook
  // 触屏设备没有滚轮：「滚轮缩放」在手机上是做不到的操作。
  // 按 pointer:coarse 判断主输入是不是手指，而不是看屏幕宽度 —— 平板横屏很宽，同样没有滚轮
  const mouseHint = hint ?? t("sceneHint");
  const touchHint = hintTouch ?? (hint ? hint : t("sceneHintTouch"));
  const hintText = (
    <>
      <span className="[@media(pointer:coarse)]:hidden">{mouseHint}</span>
      <span className="hidden [@media(pointer:coarse)]:inline">{touchHint}</span>
    </>
  );
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#dfe7ee] to-[#c2cdd6] ${className} ${wrapperClassName}`}
    >
      <Canvas
        shadows
        camera={{ position: camera, fov: fov }}
        dpr={[1, 2]}
        // ACES 色调映射 + 略低曝光：避免浅色台面在强光下过曝成白块把玻璃器皿"吃掉"
        gl={{ antialias: true, alpha: false, toneMappingExposure: 0.92 }}
      >
        <color attach="background" args={["#d3dce4"]} />
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[4, 7, 4]}
          intensity={1.35}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={0.5}
          shadow-camera-far={20}
        />
        <Suspense fallback={null}>
          {children}
          {/* 程序化环境光：自发光面光源构成反射环境，无需外网 HDR */}
          <Environment resolution={256}>
            <Lightformer intensity={2} position={[0, 3, 2]} scale={[4, 4, 1]} color="#ffffff" />
            <Lightformer intensity={1.2} position={[-3, 1, 1]} scale={[3, 3, 1]} color="#bcd8ff" />
            <Lightformer intensity={1} position={[3, 1, -1]} scale={[3, 3, 1]} color="#ffe6c4" />
          </Environment>
          <ContactShadows position={[0, shadowY, 0]} opacity={0.35} scale={10} blur={2.6} far={4} />
          <EffectComposer>
            {/* 阈值 0.95：仅燃烧/闪光类真高光参与泛光，浅色台面与瓷板不再被推爆 */}
            <Bloom luminanceThreshold={0.95} intensity={0.3} mipmapBlur radius={0.5} />
          </EffectComposer>
        </Suspense>
        <OrbitControls
          // makeDefault：让场景内的可拖拽部件能取到 controls 并在拖拽期间临时禁用它，
          // 否则拖旋塞会同时旋转相机，部件从指针下跑掉、拖拽随即失效。
          makeDefault
          enablePan={false}
          autoRotate={autoRotate}
          autoRotateSpeed={0.5}
          target={target}
          minDistance={minDistance}
          maxDistance={maxDistance}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
        />
      </Canvas>
      <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/30 px-3 py-1 text-xs text-white/70 backdrop-blur">
        {hintText}
      </span>
    </div>
  );
}
