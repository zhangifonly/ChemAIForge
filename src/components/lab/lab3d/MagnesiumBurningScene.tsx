"use client";

// 镁条燃烧 3D 场景：坩埚钳夹持镁条置于石棉网上方，点燃后发出耀眼白光、
// 冒白烟，燃尽后留下白色氧化镁粉末。apparatus：坩埚钳 / 石棉网 / 酒精灯。
// 状态：hasMg（银白镁条）→ reacted（白光+白烟，镁条转为白色氧化镁）。
import { LabBench } from "./LabPrimitives";
import { BrightFlare, Smoke } from "./phenomena";

export interface MagnesiumBurningProps {
  hasMg: boolean; // 镁条已夹取
  reacted: boolean; // 已点燃燃烧
}

export function MagnesiumBurningScene({ hasMg, reacted }: MagnesiumBurningProps) {
  return (
    <group position={[0, -1.0, 0]}>
      <LabBench />
      <AsbestosMesh />
      <Tongs />
      {hasMg && <MagnesiumRibbon reacted={reacted} />}
      {reacted && (
        <>
          <BrightFlare position={[0, 1.35, 0]} radius={0.16} />
          <Smoke origin={[0, 1.45, 0]} count={45} topY={2.8} />
          <pointLight position={[0, 1.35, 0]} intensity={8} distance={5} color="#ffffff" />
        </>
      )}
    </group>
  );
}

// 石棉网（承接燃烧残渣）：带铁圈的方形网
function AsbestosMesh() {
  return (
    <group position={[0, 0.5, 0]}>
      <mesh receiveShadow>
        <boxGeometry args={[1.0, 0.03, 1.0]} />
        <meshStandardMaterial color="#8d8d8d" roughness={0.9} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.5, 0.006, 0.5]} />
        <meshStandardMaterial color="#d9d2c4" roughness={1} />
      </mesh>
    </group>
  );
}

// 坩埚钳：两根细长金属臂，斜向夹住上方镁条
function Tongs() {
  const mat = <meshStandardMaterial color="#9aa0a6" metalness={0.8} roughness={0.35} />;
  return (
    <group position={[0, 1.0, -0.5]} rotation={[0.5, 0, 0]}>
      {[-0.05, 0.05].map((x) => (
        <mesh key={x} position={[x, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 1.1, 12]} />
          {mat}
        </mesh>
      ))}
    </group>
  );
}

// 镁条：竖直银白细条；燃烧后转白色氧化镁并略缩短、发暗白
function MagnesiumRibbon({ reacted }: { reacted: boolean }) {
  return (
    <mesh position={[0, 1.3, 0]} castShadow>
      <boxGeometry args={[0.05, reacted ? 0.28 : 0.42, 0.02]} />
      {reacted ? (
        <meshStandardMaterial color="#f4f4f0" roughness={0.95} metalness={0} />
      ) : (
        <meshStandardMaterial color="#c9ccd1" roughness={0.3} metalness={0.85} />
      )}
    </mesh>
  );
}
